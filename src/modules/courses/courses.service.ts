import prisma from "../../config/database";
import { slugify, paginate, getPaginationMeta } from "../../utils/helpers";

export interface CreateCourseDto {
  title: string;
  description: string;
  shortDesc: string;
  thumbnail: string;
  price: number;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  category: string;
  tags: string[];
  language?: string;
  duration?: number;
}

export interface UpdateCourseDto extends Partial<CreateCourseDto> {
  isPublished?: boolean;
  isFeatured?: boolean;
}

export interface CourseFilters {
  search?: string;
  category?: string;
  level?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "newest" | "popular" | "rating" | "price_asc" | "price_desc";
  page?: number;
  limit?: number;
}

const courseService = {
  async createCourse(instructorId: string, dto: CreateCourseDto) {
    const slug = slugify(dto.title) + "-" + Date.now();
    return prisma.course.create({
      data: { ...dto, slug, instructorId },
      include: { instructor: { select: { id: true, name: true, image: true } } },
    });
  },

  async updateCourse(courseId: string, dto: UpdateCourseDto) {
    return prisma.course.update({
      where: { id: courseId },
      data: dto,
      include: { instructor: { select: { id: true, name: true, image: true } } },
    });
  },

  async deleteCourse(courseId: string) {
    return prisma.course.delete({ where: { id: courseId } });
  },

  async getCourseById(courseId: string, userId?: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        instructor: { select: { id: true, name: true, image: true, bio: true } },
        lessons: { orderBy: { order: "asc" } },
        reviews: {
          include: { user: { select: { id: true, name: true, image: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        quizzes: { include: { questions: true } },
        _count: { select: { enrollments: true, lessons: true, reviews: true } },
      },
    });

    if (!course) return null;

    let isEnrolled = false;
    if (userId) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
      });
      isEnrolled = !!enrollment;
    }

    return { ...course, isEnrolled };
  },

  async getCourseBySlug(slug: string, userId?: string) {
    const course = await prisma.course.findUnique({
      where: { slug },
      include: {
        instructor: { select: { id: true, name: true, image: true, bio: true } },
        lessons: { orderBy: { order: "asc" } },
        reviews: {
          include: { user: { select: { id: true, name: true, image: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        _count: { select: { enrollments: true, lessons: true, reviews: true } },
      },
    });

    if (!course) return null;

    let isEnrolled = false;
    if (userId) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: course.id } },
      });
      isEnrolled = !!enrollment;
    }

    return { ...course, isEnrolled };
  },

  async getAllCourses(filters: CourseFilters) {
    const { search, category, level, minPrice, maxPrice, sortBy = "newest", page = 1, limit = 12 } = filters;

    const where: any = { isPublished: true };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { tags: { has: search } },
      ];
    }
    if (category) where.category = { equals: category, mode: "insensitive" };
    if (level) where.level = level;
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    const orderBy: any = {
      newest: { createdAt: "desc" },
      popular: { totalStudents: "desc" },
      rating: { rating: "desc" },
      price_asc: { price: "asc" },
      price_desc: { price: "desc" },
    }[sortBy] || { createdAt: "desc" };

    const { skip, take } = paginate(page, limit);

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          instructor: { select: { id: true, name: true, image: true } },
          _count: { select: { enrollments: true, lessons: true } },
        },
      }),
      prisma.course.count({ where }),
    ]);

    return { courses, pagination: getPaginationMeta(total, page, limit) };
  },

  async getFeaturedCourses() {
    return prisma.course.findMany({
      where: { isPublished: true, isFeatured: true },
      take: 8,
      include: {
        instructor: { select: { id: true, name: true, image: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { rating: "desc" },
    });
  },

  async getInstructorCourses(instructorId: string) {
    return prisma.course.findMany({
      where: { instructorId },
      include: {
        _count: { select: { enrollments: true, reviews: true, lessons: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async getCategories() {
    const courses = await prisma.course.findMany({
      where: { isPublished: true },
      select: { category: true },
    });
    const categoryMap = new Map<string, number>();
    courses.forEach((c) => {
      categoryMap.set(c.category, (categoryMap.get(c.category) || 0) + 1);
    });
    return Array.from(categoryMap.entries()).map(([name, count]) => ({ name, count }));
  },

  async getStats() {
    const [totalCourses, totalStudents, totalInstructors] = await Promise.all([
      prisma.course.count({ where: { isPublished: true } }),
      prisma.enrollment.count(),
      prisma.user.count({ where: { role: "INSTRUCTOR" } }),
    ]);
    return { totalCourses, totalStudents, totalInstructors };
  },

  async addLesson(courseId: string, lessonData: {
    title: string; content: string; videoUrl?: string; duration?: number; order: number; isPreview?: boolean;
  }) {
    return prisma.lesson.create({ data: { ...lessonData, courseId } });
  },

  async updateLesson(lessonId: string, data: Partial<{ title: string; content: string; videoUrl: string; duration: number; isPreview: boolean }>) {
    return prisma.lesson.update({ where: { id: lessonId }, data });
  },

  async deleteLesson(lessonId: string) {
    return prisma.lesson.delete({ where: { id: lessonId } });
  },

  async updateCourseRating(courseId: string) {
    const reviews = await prisma.review.findMany({ where: { courseId } });
    if (reviews.length === 0) return;
    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await prisma.course.update({
      where: { id: courseId },
      data: { rating: Math.round(avg * 10) / 10, totalRatings: reviews.length },
    });
  },
};

export default courseService;
