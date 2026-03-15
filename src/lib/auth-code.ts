import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/db";

const CODE_LENGTH = 8;
const CODE_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MINUTES = 15;

/**
 * Generate an 8-character random uppercase alphabetic code.
 */
export function generateAuthCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Format a raw 8-char code as XXXX-XXXX.
 */
export function formatCode(code: string): string {
  const clean = code.replace(/[^A-Z]/g, "");
  if (clean.length !== CODE_LENGTH) return code;
  return `${clean.slice(0, 4)}-${clean.slice(4)}`;
}

/**
 * Strip dashes/spaces and uppercase the input.
 */
export function normalizeCode(input: string): string {
  return input.replace(/[-\s]/g, "").toUpperCase();
}

/**
 * SHA-256 hash a code string.
 */
export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/**
 * Delete existing verification tokens for the email, then store a new
 * hashed code with a 10-minute expiry.
 */
export async function storeAuthCode(
  email: string,
  code: string
): Promise<void> {
  const hashed = hashCode(code);
  const expires = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

  // Delete any existing tokens for this email
  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: hashed,
      expires,
    },
  });
}

/**
 * Validate an auth code for an email address.
 *
 * - Hashes the input and compares against stored token.
 * - Enforces rate limiting: max 5 attempts per 15 minutes per email.
 *   Exceeding the limit wipes all tokens for that email.
 * - On success, deletes the token.
 *
 * Returns true if valid, false otherwise.
 */
export async function validateAuthCode(
  email: string,
  inputCode: string
): Promise<boolean> {
  // --- Rate limiting using a simple approach with verification tokens ---
  // We track attempts by counting tokens with a special prefix
  const rateLimitIdentifier = `rate_limit:${email}`;
  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000
  );

  // Count recent attempts
  const recentAttempts = await prisma.verificationToken.count({
    where: {
      identifier: rateLimitIdentifier,
      expires: { gte: windowStart },
    },
  });

  if (recentAttempts >= MAX_ATTEMPTS) {
    // Wipe all tokens for this email (both auth and rate limit)
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: { in: [email, rateLimitIdentifier] },
      },
    });
    return false;
  }

  // Record this attempt
  await prisma.verificationToken.create({
    data: {
      identifier: rateLimitIdentifier,
      token: `attempt_${Date.now()}`,
      expires: new Date(Date.now() + RATE_LIMIT_WINDOW_MINUTES * 60 * 1000),
    },
  });

  // Look up the stored token
  const hashed = hashCode(normalizeCode(inputCode));
  const storedToken = await prisma.verificationToken.findFirst({
    where: {
      identifier: email,
      token: hashed,
      expires: { gte: new Date() },
    },
  });

  if (!storedToken) {
    return false;
  }

  // Valid — delete the token and rate limit records
  await prisma.verificationToken.deleteMany({
    where: {
      identifier: { in: [email, rateLimitIdentifier] },
    },
  });

  return true;
}
