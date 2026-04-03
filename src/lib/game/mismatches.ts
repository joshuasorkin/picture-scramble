export function findMismatches(
  solution: string,
  playerSolution: string
): number[] {
  const mismatches: number[] = [];
  const minLength = Math.min(solution.length, playerSolution.length);

  for (let i = 0; i < minLength; i++) {
    if (solution[i] !== playerSolution[i]) {
      mismatches.push(i);
    }
  }

  // Extra characters in playerSolution are all mismatches
  for (let i = minLength; i < playerSolution.length; i++) {
    mismatches.push(i);
  }

  return mismatches;
}
