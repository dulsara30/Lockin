import mongoose, { Schema, Document, Model } from 'mongoose';
import { StepStatus } from '@/lib/planning';

export interface IChecklistItem {
  text: string;
  done: boolean;
}

export interface IStep extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  missionId: mongoose.Types.ObjectId;
  runwayId?: mongoose.Types.ObjectId;
  dayIndex: number;
  order: string;
  title: string;
  notes: string;
  estimateMin: number;
  actualMin: number;
  status: StepStatus;
  checklist: IChecklistItem[];
  customFields: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ChecklistItemSchema = new Schema<IChecklistItem>(
  {
    text: { type: String, required: true, trim: true },
    done: { type: Boolean, default: false },
  },
  { _id: false }
);

const StepSchema = new Schema<IStep>(
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
    runwayId: {
      type: Schema.Types.ObjectId,
      ref: 'Runway',
      index: true,
    },
    dayIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    order: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    notes: {
      type: String,
      default: '',
      maxlength: 10000,
    },
    estimateMin: {
      type: Number,
      default: 30,
      min: 0,
      max: 1440,
    },
    actualMin: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['todo', 'doing', 'done', 'blocked', 'skipped'],
      default: 'todo',
    },
    checklist: {
      type: [ChecklistItemSchema],
      default: [],
    },
    customFields: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
StepSchema.index({ userId: 1, missionId: 1, dayIndex: 1, order: 1 });
StepSchema.index({ userId: 1, runwayId: 1, dayIndex: 1, order: 1 });
StepSchema.index({ userId: 1, status: 1, dayIndex: 1 });

export const Step: Model<IStep> = mongoose.models.Step || mongoose.model<IStep>('Step', StepSchema);
