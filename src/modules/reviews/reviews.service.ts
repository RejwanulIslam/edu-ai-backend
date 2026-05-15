import prisma from "../../config/database";
import courseService from "../courses/courses.service";

const reviewService = {
  async createReview(userId: string, courseId: string, rating: number, comment: string) {
    const existing = await prisma.review.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) throw new Error("You already reviewed this course");

    const review = await prisma.review.create({
      data: { userId, courseId, rating, comment },
      include: { user: { select: { id: true, name: true, image: true } } },
    });

    await courseService.updateCourseRating(courseId);
    return review;
  },

  async updateReview(reviewId: string, rating: number, comment: string) {
    const review = await prisma.review.update({
      where: { id: reviewId },
      data: { rating, comment },
      include: { user: { select: { id: true, name: true, image: true } } },
    });
    await courseService.updateCourseRating(review.courseId);
    return review;
  },

  async deleteReview(reviewId: string) {
    const review = await prisma.review.delete({ where: { id: reviewId } });
    await courseService.updateCourseRating(review.courseId);
    return review;
  },

  async getCourseReviews(courseId: string) {
    return prisma.review.findMany({
      where: { courseId },
      include: { user: { select: { id: true, name: true, image: true } } },
      orderBy: { createdAt: "desc" },
    });
  },
};

export default reviewService;
