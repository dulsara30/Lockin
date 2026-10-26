import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOAuthClient extends Document {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  createdAt: Date;
}

const OAuthClientSchema = new Schema<IOAuthClient>(
  {
    clientId: { type: String, required: true, unique: true },
    clientName: { type: String, required: true, maxlength: 100 },
    redirectUris: { type: [String], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const OAuthClient: Model<IOAuthClient> =
  mongoose.models.OAuthClient || mongoose.model<IOAuthClient>('OAuthClient', OAuthClientSchema);

export interface IOAuthCode extends Document {
  codeHash: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  resource: string;
  expiresAt: Date;
}

const OAuthCodeSchema = new Schema<IOAuthCode>({
  codeHash: { type: String, required: true, unique: true },
  clientId: { type: String, required: true },
  userId: { type: String, required: true },
  redirectUri: { type: String, required: true },
  codeChallenge: { type: String, required: true },
  scopes: { type: [String], required: true },
  resource: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export const OAuthCode: Model<IOAuthCode> =
  mongoose.models.OAuthCode || mongoose.model<IOAuthCode>('OAuthCode', OAuthCodeSchema);

/** One document per authorized client session ("grant"); tokens rotate inside it. */
export interface IOAuthToken extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  clientId: string;
  scopes: string[];
  resource: string;
  accessHash: string;
  accessExpiresAt: Date;
  refreshHash: string;
  refreshExpiresAt: Date;
  usedRefreshHashes: string[];
  lastUsedAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
}

const OAuthTokenSchema = new Schema<IOAuthToken>(
  {
    userId: { type: String, required: true },
    clientId: { type: String, required: true },
    scopes: { type: [String], required: true },
    resource: { type: String, required: true },
    accessHash: { type: String, required: true, unique: true },
    accessExpiresAt: { type: Date, required: true },
    refreshHash: { type: String, required: true, unique: true },
    refreshExpiresAt: { type: Date, required: true, index: { expires: 0 } },
    usedRefreshHashes: { type: [String], default: [] },
    lastUsedAt: { type: Date },
    revokedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

OAuthTokenSchema.index({ userId: 1, revokedAt: 1, createdAt: -1 });
OAuthTokenSchema.index({ usedRefreshHashes: 1 });

export const OAuthToken: Model<IOAuthToken> =
  mongoose.models.OAuthToken || mongoose.model<IOAuthToken>('OAuthToken', OAuthTokenSchema);
