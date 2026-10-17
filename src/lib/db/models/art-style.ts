import mongoose, { type Document, Schema } from "mongoose";

// A style description generated for a random time and place, kept so later
// images can reuse it without waiting for a new description
export interface IArtStyle extends Document {
  style: string;
  coordinates: string;
  // Negative years are BCE
  year: number;
  createdAt: Date;
}

const artStyleSchema = new Schema<IArtStyle>({
  style: { type: String, required: true },
  coordinates: { type: String, required: true },
  year: { type: Number, required: true },
  createdAt: { type: Date, required: true, default: () => new Date() },
});

export const ArtStyle =
  (mongoose.models["ArtStyle"] as mongoose.Model<IArtStyle>) ??
  mongoose.model<IArtStyle>("ArtStyle", artStyleSchema);
