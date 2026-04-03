/**
 * Fisher-Yates shuffle a single word.
 */
export function scrambleWord(word: string): string {
  const characters = word.split("");

  for (let i = characters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [characters[i], characters[j]] = [characters[j]!, characters[i]!];
  }

  return characters.join("");
}

/**
 * Scramble each word in a phrase independently, preserving spaces.
 */
export function scramblePhrase(phrase: string): string {
  return phrase
    .split(" ")
    .map((w) => scrambleWord(w))
    .join(" ");
}
