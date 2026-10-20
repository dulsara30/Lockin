import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISettings extends Document {
  userId: string;
  theme: 'dark' | 'light' | 'system';
  accent: string;
  density: 'compact' | 'comfortable';
  timezone: string;
  weekStart: 0 | 1 | 6; // Sunday(0), Monday(1), Saturday(6)
  workHoursPerDay: number;
  capacityByWeekday: Record<string, number>; // { '0': 0, '1': 4, ... }
  customStatuses: string[];
  customFields: Array<{ id: string; name: string; type: string }>;
  shortcutOverrides: Record<string, string>;
  encryptedGeminiKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    theme: { type: String, default: 'dark', enum: ['dark', 'light', 'system'] },
    accent: { type: String, default: '#7C5CFF' },
    density: { type: String, default: 'comfortable', enum: ['compact', 'comfortable'] },
    timezone: { type: String, default: 'Asia/Colombo' },
    weekStart: { type: Number, default: 1, enum: [0, 1, 6] },
    workHoursPerDay: { type: Number, default: 4, min: 1, max: 24 },
    capacityByWeekday: {
      type: Map,
      of: Number,
      default: {
        '0': 0, // Sun
        '1': 4, // Mon
        '2': 4, // Tue
        '3': 4, // Wed
        '4': 4, // Thu
        '5': 4, // Fri
        '6': 0, // Sat
      },
    },
    customStatuses: { type: [String], default: [] },
    customFields: { type: [{ id: String, name: String, type: { type: String } }], default: [] },
    shortcutOverrides: { type: Map, of: String, default: {} },
    encryptedGeminiKey: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

export const Settings: Model<ISettings> =
  mongoose.models.Settings || mongoose.model<ISettings>('Settings', SettingsSchema);
