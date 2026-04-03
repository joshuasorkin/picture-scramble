import mongoose, { type Document, Schema } from "mongoose";

export interface IWordImage extends Document {
  word: string;
  images: Buffer[];
}

const wordImageSchema = new Schema<IWordImage>(
  {
    word: { type: String },
    images: { type: [Buffer], default: [] },
  },
  {
    strict: false,
    collection: "word_image",
  }
);

export const WordImage =
  (mongoose.models["WordImage"] as mongoose.Model<IWordImage>) ??
  mongoose.model<IWordImage>("WordImage", wordImageSchema);
