/**
 * Seed 10 test users with bikes and profiles.
 * Run with: npx tsx scripts/seed-test-users.ts
 * Delete later with: npx tsx scripts/seed-test-users.ts --delete
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter }) as InstanceType<typeof PrismaClient>;

const TEST_USERS = [
  { display: "Mike Chen", handle: "throttle_mike", email: "mike.test@inf3rno.dev", suburb: "Richmond", lat: -37.8183, lng: 145.0, bike: { make: "Yamaha", model: "MT-07", tank: 14.0, consumption: 6.0 }, level: "INTERMEDIATE" as const },
  { display: "Sarah Jones", handle: "corner_queen", email: "sarah.test@inf3rno.dev", suburb: "Brunswick", lat: -37.7667, lng: 144.96, bike: { make: "Kawasaki", model: "Ninja 400", tank: 14.0, consumption: 4.8 }, level: "BEGINNER" as const },
  { display: "Dave Wilson", handle: "spur_runner", email: "dave.test@inf3rno.dev", suburb: "Lilydale", lat: -37.757, lng: 145.354, bike: { make: "BMW", model: "S1000RR", tank: 16.5, consumption: 10.0 }, level: "ADVANCED" as const },
  { display: "Jess Patel", handle: "twisty_jess", email: "jess.test@inf3rno.dev", suburb: "Frankston", lat: -38.1437, lng: 145.123, bike: { make: "Honda", model: "CB500F", tank: 17.1, consumption: 5.8 }, level: "INTERMEDIATE" as const },
  { display: "Tom Hardy", handle: "iron_butt_tom", email: "tom.test@inf3rno.dev", suburb: "Geelong", lat: -38.1485, lng: 144.358, bike: { make: "BMW", model: "R1250GS", tank: 20.0, consumption: 7.0 }, level: "ADVANCED" as const },
  { display: "Liam Murphy", handle: "rebel_liam", email: "liam.test@inf3rno.dev", suburb: "Bayswater", lat: -37.8427, lng: 145.263, bike: { make: "Harley-Davidson", model: "Street Bob 114", tank: 13.2, consumption: 7.0 }, level: "INTERMEDIATE" as const },
  { display: "Nina Tran", handle: "apex_nina", email: "nina.test@inf3rno.dev", suburb: "Cranbourne", lat: -38.098, lng: 145.283, bike: { make: "Ducati", model: "Monster", tank: 14.0, consumption: 7.5 }, level: "INTERMEDIATE" as const },
  { display: "Chris Baker", handle: "gravel_chris", email: "chris.test@inf3rno.dev", suburb: "Bacchus Marsh", lat: -37.675, lng: 144.433, bike: { make: "KTM", model: "890 Adventure", tank: 20.0, consumption: 6.5 }, level: "ADVANCED" as const },
  { display: "Emma Clark", handle: "scenic_emma", email: "emma.test@inf3rno.dev", suburb: "Mornington", lat: -38.224, lng: 145.038, bike: { make: "Royal Enfield", model: "Himalayan", tank: 15.0, consumption: 4.5 }, level: "BEGINNER" as const },
  { display: "Jake Nguyen", handle: "redline_jake", email: "jake.test@inf3rno.dev", suburb: "Whittlesea", lat: -37.513, lng: 145.117, bike: { make: "Suzuki", model: "GSX-R1000R", tank: 16.0, consumption: 10.0 }, level: "ADVANCED" as const },
];

async function seed() {
  console.log("Seeding 10 test users...\n");

  for (const u of TEST_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        handle: u.handle,
        displayName: u.display,
        suburb: u.suburb,
        suburbLat: u.lat,
        suburbLng: u.lng,
        ridingLevel: u.level,
        onboardingCompleted: true,
      },
    });

    await prisma.bike.upsert({
      where: { id: `test-bike-${u.handle}` },
      update: {},
      create: {
        id: `test-bike-${u.handle}`,
        userId: user.id,
        make: u.bike.make,
        model: u.bike.model,
        tankLitres: u.bike.tank,
        consumptionPer100km: u.bike.consumption,
        isPrimary: true,
      },
    });

    console.log(`  ✓ @${u.handle} (${u.display}) — ${u.bike.make} ${u.bike.model} — ${u.suburb}`);
  }

  console.log("\nDone! 10 test users created.");
}

async function cleanup() {
  console.log("Deleting test users...\n");
  const emails = TEST_USERS.map((u) => u.email);

  // Delete bikes first (cascade should handle this, but be explicit)
  const users = await prisma.user.findMany({ where: { email: { in: emails } } });
  for (const user of users) {
    await prisma.bike.deleteMany({ where: { userId: user.id } });
  }

  const result = await prisma.user.deleteMany({ where: { email: { in: emails } } });
  console.log(`  Deleted ${result.count} test users.`);
}

const isDelete = process.argv.includes("--delete");

(isDelete ? cleanup() : seed())
  .catch(console.error)
  .finally(() => process.exit(0));
