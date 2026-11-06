/**
 * Redis client utility for the Smart Parking Management System.
 * 
 * @author Principal Backend Engineer
 * @version 0.1.0
 */

import { createClient } from "redis";
import logger from "./logger";

let client: any = null;

/**
 * Initialize Redis client
 */
export const connectRedis = async () => {
  if (client) {
    return client;
  }

  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  try {
    client = createClient({ url: redisUrl });
    await client.connect();
    logger.info(`Redis connected at ${redisUrl}`);
    return client;
  } catch (error) {
    logger.warn(`Redis connection failed: ${error instanceof Error ? error.message : error}`);
    // Return a dummy client that won't crash the app
    client = {
      get: async () => null,
      set: async () => null,
      del: async () => null,
      expire: async () => false,
      keys: async () => [],
      quit: async () => {},
    };
    throw error;
  }
};

/**
 * Get Redis client instance
 */
export const getRedis = () => {
  if (!client) {
    throw new Error("Redis client not initialized");
  }
  return client;
};

/**
 * Short-lived cache for parking availability (TTL: 30 seconds)
 */
export const cacheAvailability = async (
  key: string,
  data: any,
  ttl: number = 30
) => {
  const redis = getRedis();
  await redis.set(key, JSON.stringify(data));
  await redis.expire(key, ttl);
};

/**
 * Get cached parking availability
 */
export const getCachedAvailability = async (key: string) => {
  const redis = getRedis();
  const data = await redis.get(key);
  if (data) {
    return JSON.parse(data);
  }
  return null;
};

/**
 * Invalidate cached availability for a specific key
 */
export const invalidateCache = async (key: string) => {
  const redis = getRedis();
  await redis.del(key);
};

/**
 * Rate limiting store using Redis
 */
export const rateLimitStore = async (
  key: string,
  limit: number,
  windowMs: number
) => {
  const redis = getRedis();
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.expire(key, windowMs / 1000);
  }
  
  return count <= limit;
};

/**
 * QR code token storage with short expiry
 */
export const storeQrToken = async (token: string, data: any, ttl: number = 300) => {
  const redis = getRedis();
  await redis.set(`qr:${token}`, JSON.stringify(data));
  await redis.expire(`qr:${token}`, ttl);
};

/**
 * Verify QR code token
 */
export const verifyQrToken = async (token: string) => {
  const redis = getRedis();
  const data = await redis.get(`qr:${token}`);
  if (data) {
    // Consume the token (one-time use)
    await redis.del(`qr:${token}`);
    return JSON.parse(data);
  }
  return null;
};

/**
 * Parking session tracking
 */
export const trackSession = async (sessionId: string, data: any) => {
  const redis = getRedis();
  await redis.set(`session:${sessionId}`, JSON.stringify(data));
  await redis.expire(`session:${sessionId}`, 86400); // 24 hours
};

/**
 * Get parking session data
 */
export const getSessionData = async (sessionId: string) => {
  const redis = getRedis();
  const data = await redis.get(`session:${sessionId}`);
  if (data) {
    return JSON.parse(data);
  }
  return null;
};