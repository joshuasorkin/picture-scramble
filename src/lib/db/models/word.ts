import mongoose, { type Document, Schema } from "mongoose";

export interface IWord extends Document {
  word: string;
  wordImageRef?: string;
  language: string;
  imageRef?: mongoose.Types.ObjectId;
  uploaded?: boolean;
}

const wordSchema = new Schema<IWord>({
  word: { type: String, required: true },
  wordImageRef: { type: String, required: false },
  language: { type: String, required: true },
  imageRef: { type: Schema.Types.ObjectId, ref: "Image" },
  uploaded: { type: Boolean },
});

export const Word =
  (mongoose.models["Word"] as mongoose.Model<IWord>) ??
  mongoose.model<IWord>("Word", wordSchema);
