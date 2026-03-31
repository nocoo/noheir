import NextAuth, { type DefaultSession } from "next-auth";
import type { JWT } from "@auth/core/jwt";
import Google from "next-auth/providers/google";
import { WorkerDbClient } from "./lib/worker-db-client";

// ---------------------------------------------------------------------------
// NextAuth type extensions
// ---------------------------------------------------------------------------

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    /** users.id (UUID) from the database */
    userId?: string;
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const useSecureCookies =
  process.env.NODE_ENV === "production" ||
  process.env.NEXTAUTH_URL?.startsWith("https://") ||
  process.env.USE_SECURE_COOKIES === "true";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  cookies: {
    pkceCodeVerifier: {
      name: useSecureCookies
        ? "__Secure-authjs.pkce.code_verifier"
        : "authjs.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    state: {
      name: useSecureCookies ? "__Secure-authjs.state" : "authjs.state",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    callbackUrl: {
      name: useSecureCookies
        ? "__Secure-authjs.callback-url"
        : "authjs.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    sessionToken: {
      name: useSecureCookies
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    csrfToken: {
      name: useSecureCookies ? "__Host-authjs.csrf-token" : "authjs.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Only allow specific emails
      const email = user.email?.toLowerCase();
      if (!email || !allowedEmails.includes(email)) {
        return false;
      }

      if (account) {
        // Use Google sub (providerAccountId) as the userId throughout the system
        user.id = account.providerAccountId;

        // Upsert user into D1 so FK constraints are satisfied on INSERT operations.
        // Wrapped in try/catch — a Worker outage must not block sign-in.
        try {
          const workerUrl = process.env.WORKER_URL;
          const workerToken = process.env.WORKER_TOKEN;
          if (workerUrl && workerToken) {
            const client = new WorkerDbClient(workerUrl, workerToken);
            await client.syncUser(account.providerAccountId, {
              email,
              name: (profile?.name ?? user.name) || null,
              image: ((profile?.picture as string | undefined) ?? user.image) || null,
              providerAccountId: account.providerAccountId,
            });
          }
        } catch (err) {
          console.error("[auth] Failed to upsert user into D1:", err);
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      // On first sign-in, persist the userId into the JWT
      if (user?.id) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: DefaultSession & { user: DefaultSession["user"] & { id: string } }; token: JWT }) {
      // Expose userId to client session
      if (token.userId) {
        session.user.id = token.userId;
      }
      return session;
    },
  },
});
