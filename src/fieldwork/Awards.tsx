import { useEffect, useState } from "react";
import { api, errorMessage } from "../api";
import { useApp } from "../store";
import type { Achievements, Certificate } from "./types";
import { downloadFile } from "./types";
import "./fieldwork.css";
import "./simulation-feedback.css";

const art = {
  farmer: "smartfarm",
  developer: "developer",
  nurse: "nurse",
  engineer: "automotive",
  researcher: "food_research",
};
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
const wrapText = (text: string, size = 18) => {
  const chars = Array.from(text);
  return Array.from({ length: Math.ceil(chars.length / size) }, (_, i) => chars.slice(i * size, (i + 1) * size).join(""));
};
async function imageData(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) throw new Error("캐릭터 이미지를 불러오지 못했어요.");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
export function CertificateCard({ certificate }: { certificate: Certificate }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const crabPath = `/brand/12_career_kingcrabs/${certificate.careerId}.png`;
  const imagePath = `/brand/05_career_illustrations/${art[certificate.careerId]}.png`;
  const exportCard = async () => {
    setBusy(true);
    setError("");
    try {
      const png = await imageData(crabPath);
      const occupation = await imageData(imagePath);
      const badgeImages = await Promise.all(
        certificate.badges.map((b) =>
          imageData(`/brand/08_badges/experience_badge_${b.art}.png`),
        ),
      );
      const nameLength = Math.min(
        420,
        Array.from(certificate.name).length * 27,
      );
      const badgeReasons = certificate.badges.map((badge) => wrapText(badge.earnedReason || badge.description));
      const badgeHeight = 76 + Math.max(1, ...badgeReasons.map((lines) => lines.length)) * 20;
      const cardHeight = 540 + badgeHeight + 100;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${cardHeight}" viewBox="0 0 900 ${cardHeight}">
        <rect width="900" height="${cardHeight}" rx="32" fill="#F6F5F1"/><rect width="900" height="16" fill="#FF6A1F"/>
        <circle cx="745" cy="160" r="72" fill="#0967FF"/>
        <image href="${png}" x="510" y="180" width="340" height="340"/>
        <circle cx="785" cy="460" r="60" fill="white" stroke="#0967FF" stroke-width="3"/>
        <image href="${occupation}" x="735" y="410" width="100" height="100"/>
        <g fill="#242834" font-family="sans-serif">
          <text x="52" y="75" fill="#7C3AED" font-size="24" font-weight="bold">KingCareer · EXPERIENCE RECORD</text>
          <text x="52" y="158" font-size="35" font-weight="bold">${escape(certificate.title)}</text>
          <text x="52" y="207" font-size="35" font-weight="bold">체험 수료</text>
          <text x="52" y="295" font-size="27" textLength="${nameLength}" lengthAdjust="spacingAndGlyphs">${escape(certificate.name)}</text>
          <text x="52" y="334" font-size="17">${escape(new Date(certificate.date).toLocaleDateString("ko-KR"))}</text>
          <text x="52" y="395" font-size="17">${escape(certificate.summary)}</text>
          ${certificate.badges.map((b, i) => `<rect x="${52 + i * 263}" y="540" width="250" height="${badgeHeight}" rx="18" fill="#ede5fa"/><image href="${badgeImages[i]}" x="${61 + i * 263}" y="550" width="52" height="52"/><text x="${119 + i * 263}" y="582" font-size="15">${escape(b.name)}</text>${badgeReasons[i].map((line, n) => `<text x="${64 + i * 263}" y="${620 + n * 20}" font-size="12">${escape(line)}</text>`).join("")}`).join("")}
          <text x="52" y="${cardHeight - 62}" font-size="14">KingCareer 교육용 직무체험 기록 · 자격증이나 직무 능력 인증이 아닙니다.</text>
          <text x="52" y="${cardHeight - 30}" font-size="12" fill="#727782">기록 ${escape(certificate.id)}</text>
        </g></svg>`;
      downloadFile(
        "KingCareer-수료카드.svg",
        svg,
        "image/svg+xml;charset=utf-8",
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="kc-certificate">
      <div>
        <span className="kc-eyebrow">MY CAREER COLLECTION</span>
        <h2>
          {certificate.title}
          <br />
          체험 수료
        </h2>
        <p className="kc-certificate-name">{certificate.name}</p>
        <p>{new Date(certificate.date).toLocaleDateString("ko-KR")}</p>
        <p>{certificate.summary}</p>
        <div className="kc-earned-badges">
          {certificate.badges.map((b) => (
            <div key={b.id} className="kc-earned-badge">
              <img
                src={`/brand/08_badges/experience_badge_${b.art}.png`}
                alt=""
              />
              <div><strong>{b.name}</strong><p>{b.earnedReason || b.description}</p></div>
            </div>
          ))}
        </div>
        <small>
          KingCareer 교육용 체험 기록이에요. 자격증이나 직무 능력 인증은
          아니에요.
        </small>
        <button
          className="kc-button"
          disabled={busy}
          onClick={() => void exportCard()}
        >
          {busy ? "카드 만드는 중…" : "수료 카드 다운로드"}
        </button>
        {error && <p role="alert">{error} 버튼을 눌러 다시 시도해 주세요.</p>}
      </div>
      <div className="kc-certificate-art-wrap">
        <img
          className="kc-certificate-art"
          src={crabPath}
          alt="수료를 축하하는 크랩 캐릭터"
        />
        <img
          className="kc-career-stamp"
          src={imagePath}
          alt={`${certificate.title} 직업 그림`}
        />
      </div>
    </article>
  );
}
export function AwardsShelf({ activityId }: { activityId?: string }) {
  const { user, state } = useApp();
  const [data, setData] = useState<Achievements | null>(null),
    [error, setError] = useState("");
  const [selected, setSelected] = useState(activityId || ""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!user) return;
    let live = true;
    setError("");
    api<Achievements>("/achievements")
      .then((value) => {
        if (live) setData(value);
      })
      .catch((e) => {
        if (live) setError(errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [user?.username, state.activities.length, activityId, retry, user?.name]);
  if (!user) return null;
  if (error)
    return (
      <div className="kc-error" role="alert">
        {error}{" "}
        <button onClick={() => setRetry((n) => n + 1)}>다시 불러오기</button>
      </div>
    );
  if (!data) return <p role="status">나의 수료 카드와 배지를 불러오는 중…</p>;
  const current =
    data.certificates.find((c) => c.id === selected) || data.certificates[0];
  return (
    <section className="kc-awards">
      <div className="kc-section-heading">
        <div>
          <span className="kc-eyebrow">COLLECT YOUR EXPERIENCE</span>
          <h2>해본 일들이 나의 컬렉션으로</h2>
        </div>
        <span>{data.certificates.length}개의 수료 기록</span>
      </div>
      {!activityId && (
        <div className="kc-badge-grid">
          {data.availableBadges.map((b) => {
            const earned = data.badges.find((x) => x.id === b.id);
            return (
              <article key={b.id} className={earned ? "" : "is-locked"}>
                <img
                  src={`/brand/08_badges/experience_badge_${b.art}.png`}
                  alt=""
                />
                <strong>{b.name}</strong>
                <p>{earned?.earnedReason || b.description}</p>
                <small>{earned ? "획득했어요" : "아직 만나지 않은 배지"}</small>
              </article>
            );
          })}
        </div>
      )}
      {data.certificates.length > 1 && (
        <label>
          수료 기록 선택{" "}
          <select
            value={current?.id}
            onChange={(e) => setSelected(e.target.value)}
          >
            {data.certificates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} · {new Date(c.date).toLocaleDateString("ko-KR")}
              </option>
            ))}
          </select>
        </label>
      )}
      {current ? (
        <CertificateCard certificate={current} />
      ) : (
        <p className="kc-empty">
          첫 직무체험을 마치면 이곳에 나만의 수료 카드가 생겨요.
        </p>
      )}
    </section>
  );
}
