// Picks a time and place for an image's art style. Asked for "a random art
// style", image models always pick the same one, so the choice is made here.

/** [latitude, longitude, population] */
export type Place = [number, number, number];

export interface ArtOrigin {
  coordinates: string;
  year: number;
}

// Picked uniformly by year, 5000 BCE to now is ~70% BCE, where little art
// survives beyond rock art and pottery. Eras are weighted towards recent ones.
// Negative years are BCE; there is no year 0.
export const ERAS: { from: number; to: number; weight: number }[] = [
  { from: -5000, to: -1, weight: 0.15 },
  { from: 1, to: 999, weight: 0.2 },
  { from: 1000, to: 1499, weight: 0.2 },
  { from: 1500, to: 1799, weight: 0.2 },
  { from: 1800, to: 2026, weight: 0.25 },
];

// Places are offset by up to this many degrees (~55 km) so the same city
// doesn't always give the same coordinates
const JITTER_DEGREES = 0.5;

export function randomYear(random: () => number = Math.random): number {
  const total = ERAS.reduce((sum, era) => sum + era.weight, 0);
  let r = random() * total;
  const era = ERAS.find((e) => (r -= e.weight) < 0) ?? ERAS[ERAS.length - 1]!;
  return era.from + Math.floor(random() * (era.to - era.from + 1));
}

export function formatYear(year: number): string {
  if (year < 0) return `${-year} BCE`;
  return year < 1000 ? `${year} CE` : `${year}`;
}

/**
 * Pick a place weighted by the square root of its population, so populated
 * regions are favoured without a few megacities taking every pick.
 */
export function pickPlace(places: Place[], random: () => number = Math.random): Place {
  const total = places.reduce((sum, [, , pop]) => sum + Math.sqrt(pop), 0);
  let r = random() * total;
  return places.find(([, , pop]) => (r -= Math.sqrt(pop)) < 0) ?? places[places.length - 1]!;
}

export function randomArtOrigin(
  places: Place[],
  random: () => number = Math.random
): ArtOrigin {
  const [lat, lon] = pickPlace(places, random);
  const jitter = () => (random() * 2 - 1) * JITTER_DEGREES;
  const clampedLat = Math.max(-90, Math.min(90, lat + jitter()));
  const wrappedLon = ((lon + jitter() + 540) % 360) - 180;
  return {
    coordinates: `${clampedLat.toFixed(4)}, ${wrappedLon.toFixed(4)}`,
    year: randomYear(random),
  };
}
