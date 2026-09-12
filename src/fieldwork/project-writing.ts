// Reserved draft markers survive autosave; unfinished scaffolds are not submissions.
export const hasWritingBlanks = (value: string) =>
  /〔채우기:[^〕]*〕/.test(value);
export const writingReady = (value: string) =>
  value.trim().length >= 10 && !hasWritingBlanks(value);
