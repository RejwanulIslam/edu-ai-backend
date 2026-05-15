import { Router, Response } from "express";
import { AuthRequest, requireAuth } from "../../middlewares/auth.middleware";
import reviewService from "./reviews.service";
import { asyncHandler } from "../../utils/helpers";
import { sendSuccess, sendCreated, sendError } from "../../utils/response";
import { z } from "zod";

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(5).max(1000),
});

const reviewsController = {
  create: asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { rating, comment } = reviewSchema.parse(req.body);
      const review = await reviewService.createReview(req.user!.id, req.params.courseId as string, rating, comment);
      return sendCreated(res, review, "Review added");
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  }),

  update: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { rating, comment } = reviewSchema.parse(req.body);
    const review = await reviewService.updateReview(req.params.reviewId as string, rating, comment);
    return sendSuccess(res, review, "Review updated");
  }),

  delete: asyncHandler(async (req: AuthRequest, res: Response) => {
    await reviewService.deleteReview(req.params.reviewId as string);
    return sendSuccess(res, null, "Review deleted");
  }),

  getCourseReviews: asyncHandler(async (req: AuthRequest, res: Response) => {
    const reviews = await reviewService.getCourseReviews(req.params.courseId as string);
    return sendSuccess(res, reviews, "Reviews fetched");
  }),
};

const router = Router();
router.get("/:courseId", reviewsController.getCourseReviews);
router.post("/:courseId", requireAuth, reviewsController.create);
router.put("/:reviewId", requireAuth, reviewsController.update);
router.delete("/:reviewId", requireAuth, reviewsController.delete);

export default router;
