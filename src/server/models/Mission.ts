import mongoose, { Schema, Document, Model } from 'mongoose';

export type MissionPriority = 'low' | 'medium' | 'high' | 'urgent';
export type MissionStatus = 'active' | 'completed' | 'archived';

export interface IMission extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  title: string;
  description?: string;
  color: string;
  priority: MissionPriority;
  tags: string[];
  startDate: Date;
  deadline: Date;
  dayCount: number;
  status: MissionStatus;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MissionSchema = new Schema<IMission>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    color: {
      type: String,
      default: '#7C5CFF', // Signature violet default
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    tags: {
      type: [String],
      default: [],
    },
    startDate: {
      type: Date,
      default: () => new Date(),
    },
    deadline: {
      type: Date,
      required: true,
    },
    dayCount: {
      type: Number,
      required: true,
      min: 1,
      max: 30,
      default: 5,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'archived'],
      default: 'active',
      index: true,
    },
    archived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes specified in brief: missions(userId, archived, deadline)
MissionSchema.index({ userId: 1, archived: 1, deadline: 1 });
MissionSchema.index({ userId: 1, status: 1 });

export const Mission: Model<IMission> =
  mongoose.models.Mission || mongoose.model<IMission>('Mission', MissionSchema);
