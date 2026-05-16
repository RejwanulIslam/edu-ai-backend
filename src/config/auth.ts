import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./database";

// Public URL where /api/auth is reached (frontend proxy in prod, local Next in dev)
const authBaseURL =
  process.env.BETTER_AUTH_URL ||
  process.env.FRONTEND_URL ||
  "http://localhost:3000";

const isHttps = authBaseURL.startsWith("https://");

// Auth is reached via the Next.js proxy on the frontend domain — use Lax cookies.
// SameSite=None is only needed for direct cross-origin browser → backend calls.
const cookieSameSite: "lax" | "none" =
  process.env.BETTER_AUTH_CROSS_ORIGIN === "true" ? "none" : "lax";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: authBaseURL,
  secret: process.env.BETTER_AUTH_SECRET || "fallback-secret-change-this",
  trustedOrigins: [
    "https://eduai-frontend-tan.vercel.app",
    "http://localhost:3000",
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  advanced: {
    crossSubDomainCookies: {
      enabled: false,
    },
    defaultCookieAttributes: {
      sameSite: cookieSameSite,
      secure: isHttps,
      path: "/",
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "STUDENT",
        input: false,
      },
      bio: {
        type: "string",
        required: false,
      },
      phone: {
        type: "string",
        required: false,
      },
      location: {
        type: "string",
        required: false,
      },
    },
  },
});

export type Auth = typeof auth;
