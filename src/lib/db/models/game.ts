import mongoose, { type Document, Schema } from "mongoose";
import type { Contact } from "@/lib/game/contact-info";

export interface IGame extends Document {
  language: string;
  solution: string;
  solutionHash: string;
  scramble: string;
  picture: string;
  compliment: string;
  date_create: Date;
  date_solve?: Date;
  date_start?: Date;
  visitorId?: string;
  visitId?: string;
  topic?: string;
  contact?: Contact;
}

const gameSchema = new Schema<IGame>({
  language: { type: String, required: true },
  solution: { type: String, required: true },
  solutionHash: { type: String, required: true },
  scramble: { type: String, required: true },
  picture: { type: String, required: true },
  compliment: { type: String },
  date_create: { type: Date, required: true },
  date_solve: { type: Date },
  date_start: { type: Date },
  visitorId: { type: String },
  visitId: { type: String },
  topic: { type: String },
  contact: { type: Schema.Types.Mixed },
});

gameSchema.index({ date_start: 1 }, { sparse: true });

export const Game =
  (mongoose.models["Game"] as mongoose.Model<IGame>) ??
  mongoose.model<IGame>("Game", gameSchema);
