import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMcpAudit extends Document {
  userId: string;
  tool: string;
  tier: 'read' | 'write' | 'critical';
  args: string; // redacted + truncated JSON
  status: 'ok' | 'error' | 'confirmation_required';
  error?: string;
  ip?: string;
  clientId?: string;
  durationMs: number;
  at: Date;
}

const McpAuditSchema = new Schema<IMcpAudit>({
  userId: { type: String, required: true },
  tool: { type: String, required: true },
  tier: { type: String, enum: ['read', 'write', 'critical'], required: true },
  args: { type: String, default: '' },
  status: { type: String, enum: ['ok', 'error', 'confirmation_required'], required: true },
  error: { type: String },
  ip: { type: String },
  clientId: { type: String },
  durationMs: { type: Number, default: 0 },
  at: { type: Date, default: () => new Date(), required: true },
});

McpAuditSchema.index({ userId: 1, at: -1 });
// Keep the audit trail for 90 days
McpAuditSchema.index({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const McpAudit: Model<IMcpAudit> =
  mongoose.models.McpAudit || mongoose.model<IMcpAudit>('McpAudit', McpAuditSchema);
