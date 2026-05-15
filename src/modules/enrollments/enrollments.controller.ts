import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import enrollmentService from "./enrollments.service";
import { asyncHandler } from "../../utils/helpers";
import { sendSuccess, sendCreated, sendError } from "../../utils/response";

const enrollmentsController = {
  enroll: asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const enrollment = await enrollmentService.enroll(req.user!.id, req.params.courseId as string);
      return sendCreated(res, enrollment, "Enrolled successfully");
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  }),

  unenroll: asyncHandler(async (req: AuthRequest, res: Response) => {
    await enrollmentService.unenroll(req.user!.id, req.params.courseId as string);
    return sendSuccess(res, null, "Unenrolled successfully");
  }),

  getMyEnrollments: asyncHandler(async (req: AuthRequest, res: Response) => {
    const enrollments = await enrollmentService.getMyEnrollments(req.user!.id);
    return sendSuccess(res, enrollments, "Enrollments fetched");
  }),

  updateProgress: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { progress } = req.body;
    const enrollment = await enrollmentService.updateProgress(req.user!.id, req.params.courseId as string, progress);
    return sendSuccess(res, enrollment, "Progress updated");
  }),

  getAllEnrollments: asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const result = await enrollmentService.getAllEnrollments(page, limit);
    return sendSuccess(res, result.enrollments, "All enrollments fetched", 200, {
      page, limit, total: result.total, totalPages: result.totalPages,
    });
  }),
};

export default enrollmentsController;
