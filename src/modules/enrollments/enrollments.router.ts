import { Router } from "express";
import enrollmentsController from "./enrollments.controller";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware";

const router = Router();

router.post("/:courseId", requireAuth, enrollmentsController.enroll);
router.delete("/:courseId", requireAuth, enrollmentsController.unenroll);
router.get("/my/all", requireAuth, enrollmentsController.getMyEnrollments);
router.patch("/:courseId/progress", requireAuth, enrollmentsController.updateProgress);
router.get("/admin/all", requireAuth, requireRole("ADMIN"), enrollmentsController.getAllEnrollments);

export default router;
