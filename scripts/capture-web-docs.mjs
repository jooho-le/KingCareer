// Use the same real account/API capture flow at a desktop viewport.
process.argv.push('--desktop');
await import('./capture-mobile-docs.mjs');
