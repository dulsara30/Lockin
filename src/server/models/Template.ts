import mongoose, { Schema, Document, Model } from 'mongoose';
import { ParsedPlan } from '@/lib/templates/parser';

export interface ITemplate extends Document {
  userId: string;
  name: string;
  description?: string;
  structure: ParsedPlan;
  createdAt: Date;
  updatedAt: Date;
}

const TemplateSchema = new Schema<ITemplate>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    structure: { type: Schema.Types.Mixed, required: true },
  },
  {
    timestamps: true,
  }
);

TemplateSchema.index({ userId: 1, createdAt: -1 });

export const Template: Model<ITemplate> =
  mongoose.models.Template || mongoose.model<ITemplate>('Template', TemplateSchema);
