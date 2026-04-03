import mongoose, { type Document, Schema } from "mongoose";
import type { Contact } from "@/lib/game/contact-info";

export interface UploadedIndex {
  imageIndex: number;
  contact: Contact | null;
}

export interface IImage extends Document {
  images: Buffer[];
  wordImageRef?: string;
  uploadedIndexes: UploadedIndex[];
  wordRef: mongoose.Types.ObjectId;
}

const imageSchema = new Schema(
  {
    images: { type: [Buffer], default: [] },
    wordImageRef: { type: String, required: false },
    uploadedIndexes: { type: [], default: [] },
    wordRef: { type: Schema.Types.ObjectId, ref: "Word" },
  },
  { strict: false }
);

export const Image =
  (mongoose.models["Image"] as mongoose.Model<IImage>) ??
  mongoose.model<IImage>("Image", imageSchema);
