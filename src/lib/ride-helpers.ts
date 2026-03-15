import crypto from "crypto";
import { prisma } from "./db";
import routesData from "@/data/routes.json";
import type { Route } from "./routeMatcher";

export function generateInviteCode(): string {
  return crypto.randomBytes(6).toString("hex");
}

export function findRouteById(routeId: string): Route | undefined {
  return (routesData as Route[]).find((r) => r.id === routeId);
}

export function validateRouteId(routeId: string): boolean {
  return (routesData as Route[]).some((r) => r.id === routeId);
}

export function validateDestinationName(
  routeId: string,
  destinationName: string
): boolean {
  const route = findRouteById(routeId);
  if (!route) return false;
  return route.destinations.some((d) => d.name === destinationName);
}

export async function isRideMember(
  rideId: string,
  userId: string
): Promise<boolean> {
  const member = await prisma.rideMember.findUnique({
    where: { rideId_userId: { rideId, userId } },
  });
  return !!member;
}

export async function isRideLeader(
  rideId: string,
  userId: string
): Promise<boolean> {
  const member = await prisma.rideMember.findUnique({
    where: { rideId_userId: { rideId, userId } },
  });
  return member?.role === "LEADER";
}
