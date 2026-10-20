import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAiUsage extends Document {
  userId: string;
  date: string; // YYYY-MM-DD
  calls: number;
  createdAt: Date;
  updatedAt: Date;
}

const AiUsageSchema = new Schema<IAiUsage>(
  {
    userId: { type: String, required: true, index: true },
    date: { type: String, required: true },
    calls: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast per-user per-day lookup
AiUsageSchema.index({ userId: 1, date: 1 }, { unique: true });

export const AiUsage: Model<IAiUsage> =
  mongoose.models.AiUsage || mongoose.model<IAiUsage>('AiUsage', AiUsageSchema);
