/**
 * Refresh-token lifecycle.
 *
 * Refresh tokens are stored as SHA-256 hashes in the `RefreshToken` table. Only
 * a token present there (and not revoked/expired) can mint new credentials, so
 * logout and rotation actually invalidate the previous token.
 */

import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "./db";
import { generateAccessToken, generateRefreshToken, TokenUser } from "./jwt";

export const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

const DEFAULT_MS = 30 * 24 * 60 * 60 * 1000;

const expiryOf = (token: string): Date => {
  const decoded = jwt.decode(token) as jwt.JwtPayload | null;
  return decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + DEFAULT_MS);
};

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const buildPair = async (userId: string, user: TokenUser): Promise<TokenPair> => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(userId, crypto.randomUUID());
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: expiryOf(refreshToken),
    },
  });
  return { accessToken, refreshToken };
};

/**
 * Issue a new token pair and register the refresh token for revocation.
 */
export const issueTokens = async (user: TokenUser): Promise<TokenPair> => {
  const pair = await buildPair(user.id, user);

  // Housekeeping: drop this user's already expired tokens.
  await prisma.refreshToken
    .deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } })
    .catch(() => undefined);

  return pair;
};

/**
 * Exchange a stored, non-revoked refresh token for a new pair.
 * The presented token is revoked in the same transaction (rotation), so a
 * replayed refresh token fails.
 */
export const rotateRefreshToken = async (
  rawToken: string,
  user: TokenUser
): Promise<TokenPair | null> => {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.refreshToken.findFirst({
    where: { userId: user.id, tokenHash, revoked: false },
  });

  if (!record) return null;

  if (record.expiresAt.getTime() <= Date.now()) {
    await prisma.refreshToken.update({
      where: { id: record.id },
      data: { revoked: true, revokedAt: new Date() },
    });
    return null;
  }

  return prisma.$transaction(async (tx) => {
    const revoked = await tx.refreshToken.updateMany({
      where: { id: record.id, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });

    // Another request already rotated this token.
    if (revoked.count !== 1) return null;

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user.id, crypto.randomUUID());

    await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: expiryOf(refreshToken),
      },
    });

    return { accessToken, refreshToken };
  });
};

/**
 * Revoke one specific refresh token (single-device logout).
 */
export const revokeRefreshToken = async (userId: string, rawToken: string) => {
  const result = await prisma.refreshToken.updateMany({
    where: { userId, tokenHash: hashToken(rawToken), revoked: false },
    data: { revoked: true, revokedAt: new Date() },
  });
  return result.count;
};

/**
 * Revoke every active refresh token of a user (all devices).
 */
export const revokeAllRefreshTokens = async (userId: string) => {
  const result = await prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data: { revoked: true, revokedAt: new Date() },
  });
  return result.count;
};
