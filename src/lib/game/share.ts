export function shareMessage(seconds: number): string {
  const unit = seconds === 1 ? "second" : "seconds";
  return `I solved this Utu's Wild Words puzzle in ${seconds} ${unit}, how about you?`;
}

/**
 * Link that opens a copy of the puzzle. The sharer's language and topic are
 * carried along so the receiver's later games use them too.
 */
export function shareUrl(
  origin: string,
  gameId: string,
  lang?: string,
  topic?: string
): string {
  const params = new URLSearchParams({ puzzle: gameId });
  if (lang) params.set("lang", lang);
  if (topic) params.set("topic", topic);
  params.set("utm_source", "share");
  return `${origin}/?${params.toString()}`;
}

/** Format elapsed seconds as m:ss for the on-screen timer. */
export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
