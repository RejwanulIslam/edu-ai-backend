import { Router, Response } from "express";
import prisma from "../../config/database";
import { AuthRequest, requireAuth, requireRole } from "../../middlewares/auth.middleware";
import { asyncHandler, paginate, getPaginationMeta } from "../../utils/helpers";
import { sendSuccess, sendNotFound, sendError } from "../../utils/response";

// Service
const userService = {
  async getUserProfile(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, image: true, role: true,
        bio: true, phone: true, location: true, website: true,
        createdAt: true, isActive: true,
        _count: { select: { enrollments: true, courses: true, reviews: true } },
      },
    });
  },

  async updateProfile(userId: string, data: {
    name?: string; bio?: string; phone?: string; location?: string; website?: string; image?: string;
  }) {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true, name: true, email: true, image: true, role: true,
        bio: true, phone: true, location: true, website: true,
      },
    });
  },

  async getAllUsers(page: number, limit: number, search?: string, role?: string) {
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    if (role) where.role = role;

    const { skip, take } = paginate(page, limit);
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take,
        select: {
          id: true, name: true, email: true, image: true, role: true,
          createdAt: true, isActive: true,
          _count: { select: { enrollments: true, courses: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);
    return { users, pagination: getPaginationMeta(total, page, limit) };
  },

  async updateUserRole(userId: string, role: string) {
    return prisma.user.update({ where: { id: userId }, data: { role: role as any } });
  },

  async toggleUserStatus(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");
    return prisma.user.update({ where: { id: userId }, data: { isActive: !user.isActive } });
  },

  async getDashboardStats(userId: string) {
    const [enrollments, completedCourses] = await Promise.all([
      prisma.enrollment.findMany({
        where: { userId },
        include: { course: { select: { title: true, thumbnail: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.enrollment.count({ where: { userId, status: "COMPLETED" } }),
    ]);
    return { recentEnrollments: enrollments, completedCourses };
  },

  async getAdminDashboardStats() {
    const [totalUsers, totalCourses, totalEnrollments, recentUsers] = await Promise.all([
      prisma.user.count(),
      prisma.course.count(),
      prisma.enrollment.count(),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true, image: true, role: true, createdAt: true },
      }),
    ]);

    const monthlyEnrollments = await prisma.$queryRaw<{ month: string; count: bigint }[]>`
      SELECT TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon') as month,
             COUNT(*) as count
      FROM enrollments
      WHERE "createdAt" > NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY DATE_TRUNC('month', "createdAt")
    `;

    return {
      totalUsers,
      totalCourses,
      totalEnrollments,
      recentUsers,
      monthlyEnrollments: monthlyEnrollments.map(m => ({ month: m.month, count: Number(m.count) })),
    };
  },
};

// Controller
const usersController = {
  getProfile: asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await userService.getUserProfile(req.user!.id);
    if (!user) return sendNotFound(res, "User not found");
    return sendSuccess(res, user, "Profile fetched");
  }),

  updateProfile: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, bio, phone, location, website, image } = req.body;
    const user = await userService.updateProfile(req.user!.id, { name, bio, phone, location, website, image });
    return sendSuccess(res, user, "Profile updated");
  }),

  getUserById: asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await userService.getUserProfile(req.params.id as string);
    if (!user) return sendNotFound(res, "User not found");
    return sendSuccess(res, user, "User fetched");
  }),

  getAllUsers: asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const result = await userService.getAllUsers(page, limit, req.query.search as string, req.query.role as string);
    return sendSuccess(res, result.users, "Users fetched", 200, result.pagination);
  }),

  updateUserRole: asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const user = await userService.updateUserRole(req.params.id as string, req.body.role);
      return sendSuccess(res, user, "Role updated");
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  }),

  toggleUserStatus: asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const user = await userService.toggleUserStatus(req.params.id as string);
      return sendSuccess(res, user, "User status updated");
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  }),

  getDashboardStats: asyncHandler(async (req: AuthRequest, res: Response) => {
    const stats = await userService.getDashboardStats(req.user!.id);
    return sendSuccess(res, stats, "Dashboard stats fetched");
  }),

  getAdminDashboardStats: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const stats = await userService.getAdminDashboardStats();
    return sendSuccess(res, stats, "Admin stats fetched");
  }),
};

// Router
const router = Router();
router.get("/profile", requireAuth, usersController.getProfile);
router.put("/profile", requireAuth, usersController.updateProfile);
router.get("/dashboard-stats", requireAuth, usersController.getDashboardStats);
router.get("/admin/stats", requireAuth, requireRole("ADMIN"), usersController.getAdminDashboardStats);
router.get("/admin/all", requireAuth, requireRole("ADMIN"), usersController.getAllUsers);
router.put("/admin/:id/role", requireAuth, requireRole("ADMIN"), usersController.updateUserRole);
router.patch("/admin/:id/toggle", requireAuth, requireRole("ADMIN"), usersController.toggleUserStatus);
router.get("/:id", usersController.getUserById);

export default router;
