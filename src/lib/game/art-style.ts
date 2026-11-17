// Picks a time and place for an image's art style. Asked for "a random art
// style", image models always pick the same one, so the choice is made here.

/** [latitude, longitude, population] */
export type Place = [number, number, number];

export interface ArtOrigin {
  coordinates: string;
  year: number;
}

// The style an image was drawn in, with the time and place it was described
// for. Fallback styles have no time and place.
export interface ImageStyle extends Partial<ArtOrigin> {
  style: string;
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

// Asked for a culture's "most colorful" medium, the chat model picks the same
// one for most of a region's history (Chinese art almost always became a
// Buddhist temple mural), so each description gets these in a random order
// and takes the first one the culture used
export const ART_MEDIA = [
  "painting on silk or paper",
  "wall painting",
  "textiles or embroidery",
  "beadwork",
  "featherwork",
  "lacquerware",
  "tilework",
  "enamel",
  "painted carving",
  "woodblock prints",
  "mosaic",
  "stained glass",
  "illuminated manuscripts",
  "posters or printed graphics",
  "painted ceramics",
  "metalwork with inlay",
  "paper cutting",
  "carpets and rugs",
];

export function shuffledArtMedia(random: () => number = Math.random): string[] {
  const media = [...ART_MEDIA];
  for (let i = media.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [media[i], media[j]] = [media[j]!, media[i]!];
  }
  return media;
}
