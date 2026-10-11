import mongoose, { type Document, Schema } from "mongoose";
import type { Contact } from "@/lib/game/contact-info";

export interface ImageObject {
  key: string;
  uploaded: boolean;
  contact?: Contact | null;
  createdAt: Date;
}

export interface IImage extends Document {
  objects: ImageObject[];
  wordImageRef?: string;
  wordRef: mongoose.Types.ObjectId;
}

const imageObjectSchema = new Schema<ImageObject>(
  {
    key: { type: String, required: true },
    uploaded: { type: Boolean, default: false },
    contact: { type: Schema.Types.Mixed },
    createdAt: { type: Date, required: true },
  },
  { _id: false }
);

const imageSchema = new Schema(
  {
    objects: { type: [imageObjectSchema], default: [] },
    wordImageRef: { type: String, required: false },
    wordRef: { type: Schema.Types.ObjectId, ref: "Word" },
  },
  { strict: false }
);

export const Image =
  (mongoose.models["Image"] as mongoose.Model<IImage>) ??
  mongoose.model<IImage>("Image", imageSchema);
