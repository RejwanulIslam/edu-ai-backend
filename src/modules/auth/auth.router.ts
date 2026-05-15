import { Router, Request, Response } from "express";
import { auth } from "../../config/auth";
import { toNodeHandler } from "better-auth/node";
import { requireAuth } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../utils/helpers";
import { sendSuccess, sendError } from "../../utils/response";
import prisma from "../../config/database";

const router = Router();

// ─── Better Auth handles all /api/auth/* routes in app.ts ───────────────────
// This module provides EXTRA auth-related endpoints on top of Better Auth

// GET /api/auth/me — get current session user with DB role
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: any, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        bio: true,
        phone: true,
        location: true,
        website: true,
        createdAt: true,
        isActive: true,
        _count: {
          select: {
            enrollments: true,
            courses: true,
            reviews: true,
          },
        },
      },
    });

    if (!user) return sendError(res, "User not found", 404);
    return sendSuccess(res, user, "Current user fetched");
  })
);

// GET /api/auth/session — check if session is valid
router.get(
  "/session",
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const session = await auth.api.getSession({
        headers: req.headers as any,
      });

      if (!session) {
        return sendSuccess(res, { authenticated: false, user: null }, "No active session");
      }

      // Fetch role from DB (Better Auth doesn't always return custom fields)
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, isActive: true },
      });

      return sendSuccess(
        res,
        {
          authenticated: true,
          user: {
            ...session.user,
            role: dbUser?.role || "STUDENT",
            isActive: dbUser?.isActive ?? true,
          },
        },
        "Session valid"
      );
    } catch {
      return sendSuccess(res, { authenticated: false, user: null }, "No active session");
    }
  })
);

// POST /api/auth/demo — auto-fill demo credentials info (no real login, just returns creds)
router.get(
  "/demo-credentials",
  asyncHandler(async (_req: Request, res: Response) => {
    return sendSuccess(
      res,
      {
        student: {
          email: "student@eduai.dev",
          password: "student123",
          role: "STUDENT",
        },
        admin: {
          email: "admin@eduai.dev",
          password: "admin123",
          role: "ADMIN",
        },
      },
      "Demo credentials"
    );
  })
);

// POST /api/auth/seed-demo — create demo users if they don't exist
router.post(
  "/seed-demo",
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      const bcrypt = await import("bcryptjs");

      // Check if demo users already exist
      const existingStudent = await prisma.user.findUnique({
        where: { email: "student@eduai.dev" },
      });

      const existingAdmin = await prisma.user.findUnique({
        where: { email: "admin@eduai.dev" },
      });

      const created: string[] = [];

      if (!existingStudent) {
        const hashedPassword = await bcrypt.hash("student123", 10);
        const student = await prisma.user.create({
          data: {
            name: "Demo Student",
            email: "student@eduai.dev",
            emailVerified: true,
            role: "STUDENT",
            bio: "A demo student account for testing EduAI.",
          },
        });

        // Create account record for Better Auth
        await prisma.account.create({
          data: {
            accountId: student.id,
            providerId: "credential",
            userId: student.id,
            password: hashedPassword,
          },
        });

        created.push("student@eduai.dev");
      }

      if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash("admin123", 10);
        const admin = await prisma.user.create({
          data: {
            name: "Demo Admin",
            email: "admin@eduai.dev",
            emailVerified: true,
            role: "ADMIN",
            bio: "Platform administrator account.",
          },
        });

        await prisma.account.create({
          data: {
            accountId: admin.id,
            providerId: "credential",
            userId: admin.id,
            password: hashedPassword,
          },
        });

        // Also create instructor demo user
        const hashedInstructorPass = await bcrypt.hash("instructor123", 10);
        const instructor = await prisma.user.create({
          data: {
            name: "Demo Instructor",
            email: "instructor@eduai.dev",
            emailVerified: true,
            role: "INSTRUCTOR",
            bio: "Senior instructor with 5+ years of teaching experience.",
          },
        });

        await prisma.account.create({
          data: {
            accountId: instructor.id,
            providerId: "credential",
            userId: instructor.id,
            password: hashedInstructorPass,
          },
        });

        created.push("admin@eduai.dev", "instructor@eduai.dev");
      }

      if (created.length === 0) {
        return sendSuccess(res, { created: [] }, "Demo users already exist");
      }

      return sendSuccess(
        res,
        {
          created,
          credentials: {
            student: { email: "student@eduai.dev", password: "student123" },
            admin: { email: "admin@eduai.dev", password: "admin123" },
            instructor: { email: "instructor@eduai.dev", password: "instructor123" },
          },
        },
        `Demo users created: ${created.join(", ")}`
      );
    } catch (err: any) {
      return sendError(res, "Failed to seed demo users: " + err.message, 500);
    }
  })
);

// PATCH /api/auth/update-role — update own role (for demo/testing purposes, admin only in prod)
router.patch(
  "/update-role",
  requireAuth,
  asyncHandler(async (req: any, res: Response) => {
    const { role } = req.body;
    const validRoles = ["STUDENT", "INSTRUCTOR", "ADMIN"];

    if (!role || !validRoles.includes(role)) {
      return sendError(res, `Role must be one of: ${validRoles.join(", ")}`, 400);
    }

    // Only ADMIN can assign ADMIN role
    if (role === "ADMIN" && req.user.role !== "ADMIN") {
      return sendError(res, "Only admins can assign admin role", 403);
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });

    return sendSuccess(res, updated, "Role updated successfully");
  })
);

export default router;
