import { CHAT_MODEL, getOpenAIClient } from "./client";
import { formatYear, shuffledArtMedia, type ArtOrigin } from "@/lib/game/art-style";

// The image model can't place coordinates on a map, so a chat model turns the
// time and place into a style description the image model can follow.
// The description says how things are drawn, not what is in them: motifs like
// "bodhisattvas amid lotus blossoms" made the image model paint them next to
// every word.
export async function describeArtStyle(
  { coordinates, year }: ArtOrigin,
  media: string[] = shuffledArtMedia()
): Promise<string> {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      {
        role: "user",
        content: `What culture made art at the GPS coordinates ${coordinates} in the year ${formatYear(year)}? If almost no one lived there then, or no art from that time and place survives, use the closest culture that did make art. Choose that culture's medium by going through this list in order and taking the first one the culture really used: ${media.join("; ")}. Only choose plain pottery or rock art if it used none of them. Reply with one sentence an image generator can follow: the culture, the medium, and how things are drawn in it, with the brightest colors it used and its linework, shapes, patterns and borders. Describe only the style, not a scene: do not name gods, people, animals, plants or other things to depict. Do not mention the coordinates or year.`,
      },
    ],
    // Placing the coordinates needs some reasoning; the reply itself is short
    max_completion_tokens: 2000,
    reasoning_effort: "low",
  });

  const style = response.choices[0]?.message?.content?.trim();
  if (!style) {
    throw new Error("No art style in OpenAI response");
  }
  return style;
}
