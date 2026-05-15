import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import courseService from "./courses.service";
import { asyncHandler } from "../../utils/helpers";
import { sendSuccess, sendCreated, sendNotFound, sendForbidden, sendBadRequest } from "../../utils/response";
import { z } from "zod";

const createCourseSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20),
  shortDesc: z.string().min(10).max(300),
  thumbnail: z.string().url(),
  price: z.number().min(0),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  category: z.string().min(2),
  tags: z.array(z.string()).min(1).max(10),
  language: z.string().optional(),
  duration: z.number().optional(),
});

const lessonSchema = z.object({
  title: z.string().min(3),
  content: z.string().min(10),
  videoUrl: z.string().url().optional(),
  duration: z.number().optional(),
  order: z.number(),
  isPreview: z.boolean().optional(),
});

const coursesController = {
  getAll: asyncHandler(async (req: AuthRequest, res: Response) => {
    const filters = {
      search: req.query.search as string,
      category: req.query.category as string,
      level: req.query.level as string,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      sortBy: req.query.sortBy as any,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 12,
    };
    const result = await courseService.getAllCourses(filters);
    return sendSuccess(res, result.courses, "Courses fetched", 200, result.pagination);
  }),

  getFeatured: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const courses = await courseService.getFeaturedCourses();
    return sendSuccess(res, courses, "Featured courses fetched");
  }),

  getCategories: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const categories = await courseService.getCategories();
    return sendSuccess(res, categories, "Categories fetched");
  }),

  getStats: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const stats = await courseService.getStats();
    return sendSuccess(res, stats, "Stats fetched");
  }),

  getBySlug: asyncHandler(async (req: AuthRequest, res: Response) => {
    const course = await courseService.getCourseBySlug(req.params.slug as string, req.user?.id);
    if (!course) return sendNotFound(res, "Course not found");
    return sendSuccess(res, course, "Course fetched");
  }),

  getById: asyncHandler(async (req: AuthRequest, res: Response) => {
    const course = await courseService.getCourseById(req.params.id as string, req.user?.id);
    if (!course) return sendNotFound(res, "Course not found");
    return sendSuccess(res, course, "Course fetched");
  }),

  create: asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = createCourseSchema.parse(req.body);
    const course = await courseService.createCourse(req.user!.id, data);
    return sendCreated(res, course, "Course created successfully");
  }),

  update: asyncHandler(async (req: AuthRequest, res: Response) => {
    const course = await courseService.getCourseById(req.params.id as string);
    if (!course) return sendNotFound(res, "Course not found");
    if (course.instructorId !== req.user!.id && req.user!.role !== "ADMIN") {
      return sendForbidden(res, "You cannot edit this course");
    }
    const updated = await courseService.updateCourse(req.params.id as string, req.body);
    return sendSuccess(res, updated, "Course updated successfully");
  }),

  delete: asyncHandler(async (req: AuthRequest, res: Response) => {
    const course = await courseService.getCourseById(req.params.id as string);
    if (!course) return sendNotFound(res, "Course not found");
    if (course.instructorId !== req.user!.id && req.user!.role !== "ADMIN") {
      return sendForbidden(res, "You cannot delete this course");
    }
    await courseService.deleteCourse(req.params.id as string);
    return sendSuccess(res, null, "Course deleted successfully");
  }),

  getMyCoursesAsInstructor: asyncHandler(async (req: AuthRequest, res: Response) => {
    const courses = await courseService.getInstructorCourses(req.user!.id);
    return sendSuccess(res, courses, "Instructor courses fetched");
  }),

  addLesson: asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = lessonSchema.parse(req.body);
    const course = await courseService.getCourseById(req.params.courseId as string);
    if (!course) return sendNotFound(res, "Course not found");
    if (course.instructorId !== req.user!.id && req.user!.role !== "ADMIN") {
      return sendForbidden(res);
    }
    const lesson = await courseService.addLesson(req.params.courseId as string, data);
    return sendCreated(res, lesson, "Lesson added");
  }),

  updateLesson: asyncHandler(async (req: AuthRequest, res: Response) => {
    const lesson = await courseService.updateLesson(req.params.lessonId as string, req.body);
    return sendSuccess(res, lesson, "Lesson updated");
  }),

  deleteLesson: asyncHandler(async (req: AuthRequest, res: Response) => {
    await courseService.deleteLesson(req.params.lessonId as string);
    return sendSuccess(res, null, "Lesson deleted");
  }),
};

export default coursesController;
