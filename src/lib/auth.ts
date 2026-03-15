import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { validateAuthCode } from "@/lib/auth-code";
import { authConfig } from "@/lib/auth.config";

// How often to refresh user data from DB (in milliseconds)
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // PrismaAdapter works with Prisma 7 — it uses duck-typed prisma client methods
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      id: "email-code",
      name: "Email Code",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const code = credentials?.code;

        if (typeof email !== "string" || typeof code !== "string") {
          return null;
        }

        const isValid = await validateAuthCode(email, code);
        if (!isValid) {
          return null;
        }

        // Find or create the user
        let user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              emailVerified: new Date(),
            },
          });
        } else if (!user.emailVerified) {
          // Mark email as verified on successful code auth
          user = await prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: new Date() },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      // On initial sign-in, user object is available
      if (user) {
        token.id = user.id;
        token.lastRefreshed = Date.now();

        // Fetch full user data from DB
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
        });
        if (dbUser) {
          token.handle = dbUser.handle;
          token.displayName = dbUser.displayName;
          token.onboardingCompleted = dbUser.onboardingCompleted;
        }
      }

      // Refresh from DB periodically
      const lastRefreshed = (token.lastRefreshed as number) ?? 0;
      if (Date.now() - lastRefreshed > REFRESH_INTERVAL_MS) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
        });
        if (dbUser) {
          token.handle = dbUser.handle;
          token.displayName = dbUser.displayName;
          token.onboardingCompleted = dbUser.onboardingCompleted;
          token.lastRefreshed = Date.now();
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        const user = session.user as unknown as Record<string, unknown>;
        user.handle = (token.handle as string | null) ?? null;
        user.displayName = (token.displayName as string | null) ?? null;
        user.onboardingCompleted =
          (token.onboardingCompleted as boolean) ?? false;
      }
      return session;
    },
  },
});
