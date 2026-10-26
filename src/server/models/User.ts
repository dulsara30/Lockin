import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash?: string; // absent for Google-only accounts
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
    },
    name: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure model isn't recompiled in hot-reload
export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
