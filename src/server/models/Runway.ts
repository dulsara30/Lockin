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
  version: number;
  isOriginal: boolean;
  isActive: boolean;
  dayStartTimes: Map<string, Date>;
  dayFailedIndices: number[];
  hoursPerDay?: number;
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
    version: {
      type: Number,
      default: 1,
    },
    isOriginal: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    dayStartTimes: {
      type: Map,
      of: Date,
      default: {},
    },
    dayFailedIndices: {
      type: [Number],
      default: [],
    },
    // Daily capacity this runway was planned with; falls back to the user setting when absent
    hoursPerDay: {
      type: Number,
      min: 1,
      max: 24,
    },
  },
  {
    timestamps: true,
  }
);

RunwaySchema.index({ userId: 1, missionId: 1 });
RunwaySchema.index({ userId: 1, status: 1 });
RunwaySchema.index({ userId: 1, missionId: 1, isActive: 1 });

export const Runway: Model<IRunway> =
  mongoose.models.Runway || mongoose.model<IRunway>('Runway', RunwaySchema);
