import { CHAT_MODEL, getOpenAIClient } from "./client";
import { formatYear, type ArtOrigin } from "@/lib/game/art-style";

// The image model can't place coordinates on a map, so a chat model turns the
// time and place into a style description the image model can follow
export async function describeArtStyle({ coordinates, year }: ArtOrigin): Promise<string> {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      {
        role: "user",
        content: `What art style would typically be employed at the GPS coordinates ${coordinates} in the year ${formatYear(year)}? If almost no one lived there then, or no art from that time and place survives, use the closest culture that did make art. Choose the most colorful, visually striking medium that culture used, such as painting, murals, textiles, beadwork, featherwork, lacquer, tilework, enamel or painted carving; only choose pottery if the culture made no more colorful art. Reply with one sentence an image generator can follow: the culture, the medium, and the characteristic colors, forms and motifs. Do not mention the coordinates or year.`,
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
