import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - manifest.json / manifest.ts
     * - Public assets (images, icons, etc.)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|manifest\\.ts|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$).*)",
  ],
};
