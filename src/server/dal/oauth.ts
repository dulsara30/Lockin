import crypto from 'crypto';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { OAuthClient, OAuthCode, OAuthToken } from '@/server/models/OAuth';
import {
  ACCESS_TOKEN_TTL_SEC,
  AUTH_CODE_TTL_SEC,
  REFRESH_TOKEN_TTL_SEC,
  hashToken,
  randomToken,
} from '@/lib/oauth/core';

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scopes: string[];
}

const inSeconds = (s: number) => new Date(Date.now() + s * 1000);

// ----------------------------------------------------------------- clients
export async function registerClient(name: string, redirectUris: string[]) {
  await connectDB();
  const clientId = `lockin_${crypto.randomBytes(16).toString('hex')}`;
  await OAuthClient.create({ clientId, clientName: name, redirectUris });
  return { clientId, clientName: name, redirectUris };
}

export async function getClient(clientId: string) {
  if (!clientId || clientId.length > 100) return null;
  await connectDB();
  return await OAuthClient.findOne({ clientId }).lean().exec();
}

// ------------------------------------------------------------------- codes
export async function createAuthCode(data: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  resource: string;
}): Promise<string> {
  if (!data.userId) throw new Error('Security Error: userId is required');
  await connectDB();
  const code = randomToken('lc');
  await OAuthCode.create({
    ...data,
    codeHash: hashToken(code),
    expiresAt: inSeconds(AUTH_CODE_TTL_SEC),
  });
  return code;
}

/** Atomic single use: the first caller gets the code, anyone else gets null. */
export async function consumeAuthCode(code: string) {
  await connectDB();
  return await OAuthCode.findOneAndDelete({
    codeHash: hashToken(code),
    expiresAt: { $gt: new Date() },
  })
    .lean()
    .exec();
}

// ------------------------------------------------------------------ tokens
export async function issueTokens(data: {
  userId: string;
  clientId: string;
  scopes: string[];
  resource: string;
}): Promise<TokenResponse> {
  if (!data.userId) throw new Error('Security Error: userId is required');
  await connectDB();
  const accessToken = randomToken('lat');
  const refreshToken = randomToken('lrt');
  await OAuthToken.create({
    ...data,
    accessHash: hashToken(accessToken),
    accessExpiresAt: inSeconds(ACCESS_TOKEN_TTL_SEC),
    refreshHash: hashToken(refreshToken),
    refreshExpiresAt: inSeconds(REFRESH_TOKEN_TTL_SEC),
  });
  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SEC, scopes: data.scopes };
}

/**
 * Rotating refresh tokens with reuse detection: presenting an already-used refresh
 * token means it leaked, so the whole grant is revoked.
 */
export async function refreshTokens(
  refreshToken: string,
  clientId: string
): Promise<TokenResponse | null> {
  await connectDB();
  const hash = hashToken(refreshToken);

  const current = await OAuthToken.findOne({ refreshHash: hash }).lean().exec();
  if (!current) {
    const replay = await OAuthToken.findOne({ usedRefreshHashes: hash }).lean().exec();
    if (replay) {
      await OAuthToken.updateOne(
        { _id: replay._id, userId: replay.userId },
        { $set: { revokedAt: new Date() } }
      );
    }
    return null;
  }
  if (
    current.clientId !== clientId ||
    current.revokedAt ||
    current.refreshExpiresAt.getTime() < Date.now()
  ) {
    return null;
  }

  const accessToken = randomToken('lat');
  const newRefresh = randomToken('lrt');
  const rotated = await OAuthToken.findOneAndUpdate(
    { _id: current._id, userId: current.userId, refreshHash: hash, revokedAt: { $exists: false } },
    {
      $set: {
        accessHash: hashToken(accessToken),
        accessExpiresAt: inSeconds(ACCESS_TOKEN_TTL_SEC),
        refreshHash: hashToken(newRefresh),
        refreshExpiresAt: inSeconds(REFRESH_TOKEN_TTL_SEC),
      },
      $push: { usedRefreshHashes: { $each: [hash], $slice: -10 } },
    },
    { new: true }
  )
    .lean()
    .exec();
  if (!rotated) return null; // lost a race with another refresh

  return {
    accessToken,
    refreshToken: newRefresh,
    expiresIn: ACCESS_TOKEN_TTL_SEC,
    scopes: rotated.scopes,
  };
}

export interface VerifiedToken {
  grantId: string;
  userId: string;
  clientId: string;
  scopes: string[];
  resource: string;
}

export async function verifyAccessToken(token: string): Promise<VerifiedToken | null> {
  if (!token || token.length > 200) return null;
  await connectDB();
  const doc = await OAuthToken.findOne({
    accessHash: hashToken(token),
    revokedAt: { $exists: false },
    accessExpiresAt: { $gt: new Date() },
  })
    .lean()
    .exec();
  if (!doc) return null;

  // Best-effort "last used" for the Connected apps screen (at most every 5 minutes)
  if (!doc.lastUsedAt || Date.now() - doc.lastUsedAt.getTime() > 5 * 60 * 1000) {
    void OAuthToken.updateOne(
      { _id: doc._id, userId: doc.userId },
      { $set: { lastUsedAt: new Date() } }
    ).catch(() => undefined);
  }

  return {
    grantId: doc._id.toString(),
    userId: doc.userId,
    clientId: doc.clientId,
    scopes: doc.scopes,
    resource: doc.resource,
  };
}

/** RFC 7009: revokes the grant that owns this access or refresh token. */
export async function revokeByToken(token: string, clientId?: string) {
  await connectDB();
  const hash = hashToken(token);
  const filter: Record<string, unknown> = { $or: [{ accessHash: hash }, { refreshHash: hash }] };
  if (clientId) filter.clientId = clientId;
  await OAuthToken.updateMany(filter, { $set: { revokedAt: new Date() } });
}

// ----------------------------------------------------- connected apps (UI)
export interface ConnectedApp {
  id: string;
  clientName: string;
  scopes: string[];
  connectedAt: string;
  lastUsedAt?: string;
}

export async function listConnectedApps(userId: string): Promise<ConnectedApp[]> {
  if (!userId) throw new Error('Security Error: userId is required');
  await connectDB();
  const grants = await OAuthToken.find({
    userId,
    revokedAt: { $exists: false },
    refreshExpiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean()
    .exec();
  if (grants.length === 0) return [];

  const clients = await OAuthClient.find({ clientId: { $in: grants.map((g) => g.clientId) } })
    .lean()
    .exec();
  const names = new Map(clients.map((c) => [c.clientId, c.clientName]));

  return grants.map((g) => ({
    id: g._id.toString(),
    clientName: names.get(g.clientId) || 'Unknown app',
    scopes: g.scopes,
    connectedAt: g.createdAt.toISOString(),
    lastUsedAt: g.lastUsedAt?.toISOString(),
  }));
}

export async function revokeConnectedApp(userId: string, grantId: string): Promise<boolean> {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!mongoose.isValidObjectId(grantId)) return false;
  await connectDB();
  const res = await OAuthToken.updateOne(
    { _id: grantId, userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );
  return res.modifiedCount > 0;
}
