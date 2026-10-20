import mongoose, { Schema, Document, Model } from 'mongoose';

export type RunwayStatus = 'active' | 'completed' | 'archived';

export interface IRunway extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  missionId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  dayCount: number;
  startDate: Date;
  deadline: Date;
  status: RunwayStatus;
  createdAt: Date;
  updatedAt: Date;
}

const RunwaySchema = new Schema<IRunway>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    missionId: {
      type: Schema.Types.ObjectId,
      ref: 'Mission',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      default: 'Main Runway',
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    dayCount: {
      type: Number,
      required: true,
      min: 1,
      max: 30,
      default: 5,
    },
    startDate: {
      type: Date,
      default: () => new Date(),
    },
    deadline: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'archived'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

RunwaySchema.index({ userId: 1, missionId: 1 });
RunwaySchema.index({ userId: 1, status: 1 });

export const Runway: Model<IRunway> =
  mongoose.models.Runway || mongoose.model<IRunway>('Runway', RunwaySchema);
