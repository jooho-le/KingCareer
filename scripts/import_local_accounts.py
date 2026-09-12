"""Explicit SQLite account import. Defaults to a fully rolled-back rehearsal.

Reads deployment.env privately. Preserves target accounts and never copies login
sessions. --apply stores a consistent SQLite backup in ignored .local/ first.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
import sys

import psycopg
from psycopg import sql
from psycopg.rows import dict_row
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
TABLES = ('users', 'saved', 'events', 'activities', 'diagnoses', 'simulations',
          'projects', 'project_revisions', 'requests', 'career_reviews')
LOCK = 704296831


def run(apply=False):
    settings = dotenv_values(ROOT / 'deployment.env')
    local = dotenv_values(ROOT / 'backend' / '.env')
    directory = Path(local.get('KINGCAREER_DATA_DIR') or 'backend/storage')
    source = (directory if directory.is_absolute() else ROOT / directory) / 'kingcareer.db'
    # SQLite backup includes committed WAL content and gives a consistent snapshot.
    snapshot = sqlite3.connect(':memory:')
    snapshot.row_factory = sqlite3.Row
    with sqlite3.connect(source.as_uri() + '?mode=ro', uri=True) as live:
        live.backup(snapshot)
    if snapshot.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
        raise RuntimeError('Source integrity check failed')
    if snapshot.execute('PRAGMA foreign_key_check').fetchall():
        raise RuntimeError('Source foreign key check failed')
    records = {table: [dict(row) for row in snapshot.execute('SELECT * FROM ' + table)] for table in TABLES}
    backup_path = None
    if apply:
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        backup_path = ROOT / '.local' / 'account-migration' / stamp
        backup_path.mkdir(parents=True)
        with sqlite3.connect(backup_path / 'source.db') as backup:
            snapshot.backup(backup)
    snapshot.close()
    with psycopg.connect(settings['KINGCAREER_DATABASE_URL'], row_factory=dict_row,
                         prepare_threshold=None, connect_timeout=10) as target:
        target.execute(sql.SQL('SET LOCAL search_path TO {}, pg_catalog').format(
            sql.Identifier(settings.get('KINGCAREER_DATABASE_SCHEMA', 'kingcareer'))))
        target.execute("SET LOCAL lock_timeout='10s'")
        target.execute("SET LOCAL statement_timeout='30s'")
        target.execute('SELECT pg_advisory_xact_lock(%s)', (LOCK,))
        before = {table: target.execute(sql.SQL('SELECT * FROM {}').format(sql.Identifier(table))).fetchall() for table in TABLES}
        if apply:
            (backup_path / 'target-before.json').write_text(json.dumps(before, ensure_ascii=False), encoding='utf-8')
        existing = before['users']
        # Never merge accounts by name: identities might belong to different people.
        for user in records['users']:
            if any(row['username'].lower() == user['username'].lower() and row['id'] != user['id'] for row in existing):
                raise RuntimeError('Username collision: no data imported')
            if any(row['id'] == user['id'] and row['username'] != user['username'] for row in existing):
                raise RuntimeError('Account identity collision: no data imported')
        new_ids = {user['id'] for user in records['users']} - {row['id'] for row in existing}
        counts = {}
        for table in TABLES:
            selected = [row for row in records[table] if row['id' if table == 'users' else 'user_id'] in new_ids]
            counts[table] = len(selected)
            if selected:
                columns = list(selected[0])
                statement = sql.SQL('INSERT INTO {} ({}) VALUES ({})').format(
                    sql.Identifier(table), sql.SQL(',').join(map(sql.Identifier, columns)),
                    sql.SQL(',').join(sql.Placeholder() for _ in columns))
                with target.cursor() as cursor:
                    cursor.executemany(statement, [tuple(row[col] for col in columns) for row in selected])
                column = 'id' if table == 'users' else 'user_id'
                actual = target.execute(sql.SQL('SELECT * FROM {} WHERE {} = ANY(%s)').format(
                    sql.Identifier(table), sql.Identifier(column)), (list(new_ids),)).fetchall()
                canonical = lambda rows: sorted(json.dumps(row, sort_keys=True, ensure_ascii=False) for row in rows)
                if canonical(actual) != canonical(selected):
                    raise RuntimeError('Imported row verification failed: ' + table)
            # Confirm every pre-existing target row remains byte-for-byte unchanged.
            current = target.execute(sql.SQL('SELECT * FROM {}').format(sql.Identifier(table))).fetchall()
            encoded = {json.dumps(row, sort_keys=True, ensure_ascii=False) for row in current}
            if any(json.dumps(row, sort_keys=True, ensure_ascii=False) not in encoded for row in before[table]):
                raise RuntimeError('Target preservation verification failed: ' + table)
        if apply:
            target.commit()
        else:
            target.rollback()
        print(json.dumps({'applied': apply, 'counts': counts,
                          'existingAccountsSkipped': len(records['users']) - len(new_ids),
                          'backup': str(backup_path) if backup_path else None}, ensure_ascii=True))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    try:
        run(args.apply)
    except Exception as error:
        # Connection exceptions can contain credentials; never emit raw exceptions.
        print(f'Import failed ({type(error).__name__}); transaction rolled back. No credentials logged.', file=sys.stderr)
        raise SystemExit(1)
