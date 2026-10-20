import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRateLimit extends Document {
  key: string;
  count: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RateLimitSchema = new Schema<IRateLimit>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    count: {
      type: Number,
      required: true,
      default: 1,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Mongo TTL index
    },
  },
  {
    timestamps: true,
  }
);

export const RateLimit: Model<IRateLimit> =
  mongoose.models.RateLimit || mongoose.model<IRateLimit>('RateLimit', RateLimitSchema);
