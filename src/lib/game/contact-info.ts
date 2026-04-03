import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
}).catchall(z.string());

export type Contact = z.infer<typeof contactSchema>;

/**
 * Build a contact object, omitting blank/null/undefined fields.
 * The `platform` param becomes a dynamic key (e.g. "instagram": "handle").
 */
export function createContact(
  name?: string | null,
  phone?: string | null,
  email?: string | null,
  platform?: string | null,
  handle?: string | null
): Contact {
  const contact: Record<string, string> = {};

  const addProperty = (key: string | null | undefined, value: string | null | undefined) => {
    if (key && value !== null && value !== undefined && value.trim() !== "") {
      contact[key] = value.trim();
    }
  };

  addProperty("name", name);
  addProperty("phone", phone);
  addProperty("email", email);
  addProperty(platform, handle);

  return contact;
}

export function getDefaultContact(): Contact {
  const contact: Record<string, string> = {};

  const addProperty = (key: string, value: string | undefined) => {
    if (value && value.trim() !== "") {
      contact[key] = value.trim();
    }
  };

  addProperty("name", process.env.DEFAULT_NAME);
  addProperty("phone", process.env.DEFAULT_PHONE);
  addProperty("instagram", process.env.DEFAULT_INSTAGRAM);

  return contact;
}
