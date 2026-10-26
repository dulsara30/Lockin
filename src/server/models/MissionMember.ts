import mongoose, { Schema, Document, Model } from 'mongoose';
import type { MemberRole } from '@/lib/access';

export interface IMissionMember extends Document {
  _id: mongoose.Types.ObjectId;
  missionId: mongoose.Types.ObjectId;
  ownerId: string; // tenant that owns the mission (and all its steps/runways)
  userId: string; // the member
  email: string; // denormalized, lowercase
  role: MemberRole;
  invitedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const MissionMemberSchema = new Schema<IMissionMember>(
  {
    missionId: { type: Schema.Types.ObjectId, ref: 'Mission', required: true },
    ownerId: { type: String, required: true },
    userId: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ['viewer', 'editor'], required: true },
    invitedBy: { type: String, required: true },
  },
  { timestamps: true }
);

// One membership per user per mission
MissionMemberSchema.index({ missionId: 1, userId: 1 }, { unique: true });
// "Shared with me" lookups
MissionMemberSchema.index({ userId: 1, missionId: 1 });
// Owner-side listing / cascade delete
MissionMemberSchema.index({ ownerId: 1, missionId: 1 });

export const MissionMember: Model<IMissionMember> =
  mongoose.models.MissionMember ||
  mongoose.model<IMissionMember>('MissionMember', MissionMemberSchema);
