import prisma from "../../config/database";

const enrollmentService = {
  async enroll(userId: string, courseId: string) {
    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) throw new Error("Already enrolled");

    const [enrollment] = await prisma.$transaction([
      prisma.enrollment.create({ data: { userId, courseId }, include: { course: true } }),
      prisma.course.update({ where: { id: courseId }, data: { totalStudents: { increment: 1 } } }),
    ]);
    return enrollment;
  },

  async unenroll(userId: string, courseId: string) {
    return prisma.enrollment.delete({
      where: { userId_courseId: { userId, courseId } },
    });
  },

  async getMyEnrollments(userId: string) {
    return prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          include: {
            instructor: { select: { id: true, name: true, image: true } },
            _count: { select: { lessons: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async updateProgress(userId: string, courseId: string, progress: number) {
    return prisma.enrollment.update({
      where: { userId_courseId: { userId, courseId } },
      data: {
        progress,
        ...(progress >= 100 ? { status: "COMPLETED", completedAt: new Date() } : {}),
      },
    });
  },

  async isEnrolled(userId: string, courseId: string) {
    const e = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    return !!e;
  },

  async getAllEnrollments(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [enrollments, total] = await Promise.all([
      prisma.enrollment.findMany({
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
          course: { select: { id: true, title: true, thumbnail: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.enrollment.count(),
    ]);
    return { enrollments, total, totalPages: Math.ceil(total / limit) };
  },
};

export default enrollmentService;
