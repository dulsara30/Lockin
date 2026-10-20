import mongoose, { Schema, Document, Model } from 'mongoose';

export type ActivityEventType = 'created' | 'moved' | 'completed' | 'rolled_over';

export interface IActivity extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  type: ActivityEventType;
  missionId?: mongoose.Types.ObjectId;
  stepId?: mongoose.Types.ObjectId;
  metadata?: Record<string, unknown>;
  at: Date;
  createdAt: Date;
}

const ActivitySchema = new Schema<IActivity>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['created', 'moved', 'completed', 'rolled_over'],
      required: true,
    },
    missionId: {
      type: Schema.Types.ObjectId,
      ref: 'Mission',
    },
    stepId: {
      type: Schema.Types.ObjectId,
      ref: 'Step',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    at: {
      type: Date,
      default: () => new Date(),
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // append-only
  }
);

// Compound index specified in brief: activity(userId, at)
ActivitySchema.index({ userId: 1, at: -1 });

export const Activity: Model<IActivity> =
  mongoose.models.Activity || mongoose.model<IActivity>('Activity', ActivitySchema);
