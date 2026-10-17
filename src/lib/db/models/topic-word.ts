import mongoose, { type Document, Schema } from "mongoose";

// Seconds a topic word stays claimed, i.e. avoided by later games on the topic
export const TOPIC_WORD_TTL_SECONDS = 24 * 60 * 60;

// A word picked for a game on a topic, recorded when it is picked (before the
// slow image step) so requests running at the same time don't pick it too
export interface ITopicWord extends Document {
  topic: string;
  language: string;
  word: string;
  createdAt: Date;
}

const topicWordSchema = new Schema<ITopicWord>({
  topic: { type: String, required: true },
  language: { type: String, required: true },
  word: { type: String, required: true },
  createdAt: { type: Date, required: true, default: () => new Date() },
});

// One claim per word, so two requests can't both claim it
topicWordSchema.index({ topic: 1, language: 1, word: 1 }, { unique: true });
topicWordSchema.index({ createdAt: 1 }, { expireAfterSeconds: TOPIC_WORD_TTL_SECONDS });

export const TopicWord =
  (mongoose.models["TopicWord"] as mongoose.Model<ITopicWord>) ??
  mongoose.model<ITopicWord>("TopicWord", topicWordSchema);
