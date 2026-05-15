import { Router, Response } from "express";
import prisma from "../../config/database";
import { AuthRequest, requireAuth, requireRole } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../utils/helpers";
import { sendSuccess, sendCreated, sendNotFound, sendError } from "../../utils/response";

const quizService = {
  async createQuiz(courseId: string, data: { title: string; description?: string; timeLimit?: number; questions: any[] }) {
    const { questions, ...quizData } = data;
    return prisma.quiz.create({
      data: {
        ...quizData,
        courseId,
        questions: {
          create: questions.map((q, i) => ({ ...q, order: i })),
        },
      },
      include: { questions: true },
    });
  },

  async getQuizByCourse(courseId: string) {
    return prisma.quiz.findMany({
      where: { courseId },
      include: { questions: { orderBy: { order: "asc" } } },
    });
  },

  async submitAttempt(userId: string, quizId: string, answers: number[]) {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { orderBy: { order: "asc" } } },
    });
    if (!quiz) throw new Error("Quiz not found");

    const correct = quiz.questions.filter((q, i) => answers[i] === q.answer).length;
    const score = (correct / quiz.questions.length) * 100;

    const attempt = await prisma.quizAttempt.create({
      data: { userId, quizId, score, answers: JSON.stringify(answers) },
    });

    return {
      attempt,
      score,
      correct,
      total: quiz.questions.length,
      results: quiz.questions.map((q, i) => ({
        question: q.text,
        yourAnswer: q.options[answers[i]],
        correctAnswer: q.options[q.answer],
        explanation: q.explanation,
        isCorrect: answers[i] === q.answer,
      })),
    };
  },

  async getUserAttempts(userId: string, quizId: string) {
    return prisma.quizAttempt.findMany({
      where: { userId, quizId },
      orderBy: { completedAt: "desc" },
    });
  },
};

const router = Router();

router.get("/course/:courseId", requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const quizzes = await quizService.getQuizByCourse(req.params.courseId as string);
  return sendSuccess(res, quizzes, "Quizzes fetched");
}));

router.post("/course/:courseId", requireAuth, requireRole("INSTRUCTOR", "ADMIN"), asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const quiz = await quizService.createQuiz(req.params.courseId as string, req.body);
    return sendCreated(res, quiz, "Quiz created");
  } catch (err: any) {
    return sendError(res, err.message, 400);
  }
}));

router.post("/:quizId/attempt", requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const result = await quizService.submitAttempt(req.user!.id, req.params.quizId as string, req.body.answers);
    return sendSuccess(res, result, "Quiz submitted");
  } catch (err: any) {
    return sendError(res, err.message, 400);
  }
}));

router.get("/:quizId/my-attempts", requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const attempts = await quizService.getUserAttempts(req.user!.id, req.params.quizId as string);
  return sendSuccess(res, attempts, "Attempts fetched");
}));

export default router;
