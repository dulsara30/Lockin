import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITimeLog extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  stepId: mongoose.Types.ObjectId;
  missionId?: mongoose.Types.ObjectId;
  startedAt: Date;
  endedAt?: Date;
  durationSec: number;
  createdAt: Date;
  updatedAt: Date;
}

const TimeLogSchema = new Schema<ITimeLog>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    stepId: {
      type: Schema.Types.ObjectId,
      ref: 'Step',
      required: true,
      index: true,
    },
    missionId: {
      type: Schema.Types.ObjectId,
      ref: 'Mission',
      index: true,
    },
    startedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    endedAt: {
      type: Date,
    },
    durationSec: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

TimeLogSchema.index({ userId: 1, stepId: 1, startedAt: -1 });

export const TimeLog: Model<ITimeLog> =
  mongoose.models.TimeLog || mongoose.model<ITimeLog>('TimeLog', TimeLogSchema);
