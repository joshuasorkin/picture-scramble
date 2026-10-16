import mongoose, { type Document, Schema } from "mongoose";

export interface IVisit extends Document {
  visitorId: string;
  startedAt: Date;
  lastSeenAt: Date;
  referrer?: string;
  utmSource?: string;
}

const visitSchema = new Schema<IVisit>({
  visitorId: { type: String, required: true },
  startedAt: { type: Date, required: true },
  lastSeenAt: { type: Date, required: true },
  referrer: { type: String },
  utmSource: { type: String },
});

visitSchema.index({ visitorId: 1, lastSeenAt: -1 });
visitSchema.index({ startedAt: 1 });

export const Visit =
  (mongoose.models["Visit"] as mongoose.Model<IVisit>) ??
  mongoose.model<IVisit>("Visit", visitSchema);
