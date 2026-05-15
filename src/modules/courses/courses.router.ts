import { Router } from "express";
import coursesController from "./courses.controller";
import { requireAuth, requireRole, optionalAuth } from "../../middlewares/auth.middleware";

const router = Router();

// Public routes
router.get("/", optionalAuth, coursesController.getAll);
router.get("/featured", coursesController.getFeatured);
router.get("/categories", coursesController.getCategories);
router.get("/stats", coursesController.getStats);
router.get("/slug/:slug", optionalAuth, coursesController.getBySlug);
router.get("/:id", optionalAuth, coursesController.getById);

// Instructor routes
router.post("/", requireAuth, requireRole("INSTRUCTOR", "ADMIN"), coursesController.create);
router.put("/:id", requireAuth, requireRole("INSTRUCTOR", "ADMIN"), coursesController.update);
router.delete("/:id", requireAuth, requireRole("INSTRUCTOR", "ADMIN"), coursesController.delete);
router.get("/my/instructor", requireAuth, requireRole("INSTRUCTOR", "ADMIN"), coursesController.getMyCoursesAsInstructor);

// Lessons
router.post("/:courseId/lessons", requireAuth, requireRole("INSTRUCTOR", "ADMIN"), coursesController.addLesson);
router.put("/:courseId/lessons/:lessonId", requireAuth, requireRole("INSTRUCTOR", "ADMIN"), coursesController.updateLesson);
router.delete("/:courseId/lessons/:lessonId", requireAuth, requireRole("INSTRUCTOR", "ADMIN"), coursesController.deleteLesson);

export default router;
