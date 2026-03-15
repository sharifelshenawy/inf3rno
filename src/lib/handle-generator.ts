import { prisma } from "./db";

const ADJECTIVES = [
  "chrome", "iron", "steel", "midnight", "thunder", "ghost", "shadow",
  "rebel", "rogue", "wild", "twisted", "burnout", "nitro", "turbo",
  "asphalt", "gravel", "dusty", "rusty", "copper", "neon", "dark",
  "swift", "silent", "rumble", "apex", "drift", "slide", "lean",
  "corner", "spur", "ridge", "cruiser", "throttle", "torque", "rev",
  "piston", "clutch", "redline", "lowside", "highside", "twisty",
];

const NOUNS = [
  "rider", "rebel", "racer", "nomad", "bandit", "drifter", "ranger",
  "wolf", "hawk", "viper", "phantom", "maverick", "outlaw", "renegade",
  "pilot", "captain", "knight", "hunter", "prowler", "tracker",
  "wheelie", "stoppie", "burnout", "sendIt", "monsoon", "cyclone",
  "blaze", "spark", "flare", "bolt", "streak", "surge", "rush",
];

// Words that should never appear in handles
const BLOCKED_WORDS = [
  "rape", "rapist", "pedo", "pedophile", "molest", "nazi", "n1gger",
  "nigger", "nigga", "faggot", "fag", "retard", "kill", "murder",
  "terrorist", "jihad", "school_shoot", "child_abuse", "cp_", "csam",
  "kys", "suicide_", "bomb_threat",
];

/**
 * Check if a handle contains blocked content.
 * Allows edgy/risky but blocks genuinely harmful content.
 */
export function isHandleBlocked(handle: string): boolean {
  const lower = handle.toLowerCase().replace(/[0-9_]/g, "");
  return BLOCKED_WORDS.some((word) => lower.includes(word.replace(/_/g, "")));
}

/**
 * Generate a motorcycle-themed handle like "chrome_rebel77" or "throttle_hawk42"
 */
export function generateRandomHandle(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 99) + 1;
  return `${adj}_${noun}${num}`;
}

/**
 * Generate a unique handle that doesn't exist in the DB or retired handles.
 * Tries up to 10 times before giving up.
 */
export async function generateUniqueHandle(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const handle = generateRandomHandle();
    const [existingUser, retiredHandle] = await Promise.all([
      prisma.user.findUnique({ where: { handle } }),
      prisma.retiredHandle.findUnique({ where: { handle } }),
    ]);
    if (!existingUser && !retiredHandle) {
      return handle;
    }
  }
  // Fallback with timestamp to guarantee uniqueness
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}_${noun}${Date.now() % 10000}`;
}

/**
 * Check if a handle is available (not taken and not retired).
 */
export async function isHandleAvailable(handle: string): Promise<boolean> {
  const lower = handle.toLowerCase();
  const [existingUser, retiredHandle] = await Promise.all([
    prisma.user.findUnique({ where: { handle: lower } }),
    prisma.retiredHandle.findUnique({ where: { handle: lower } }),
  ]);
  return !existingUser && !retiredHandle;
}

/**
 * Check if a user can change their handle (3-month cooldown).
 */
export function canChangeHandle(handleLastChangedAt: Date | null): boolean {
  if (!handleLastChangedAt) return true;
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  return handleLastChangedAt < threeMonthsAgo;
}

/**
 * Days until handle can be changed again.
 */
export function daysUntilHandleChange(handleLastChangedAt: Date | null): number {
  if (!handleLastChangedAt) return 0;
  const nextChangeDate = new Date(handleLastChangedAt);
  nextChangeDate.setMonth(nextChangeDate.getMonth() + 3);
  const diff = nextChangeDate.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
