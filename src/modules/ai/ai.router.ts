import { Router, Response } from "express";
import { AuthRequest, requireAuth, requireRole } from "../../middlewares/auth.middleware";
import aiService from "./ai.service";
import { asyncHandler } from "../../utils/helpers";
import { sendSuccess, sendError } from "../../utils/response";
import { aiLimiter } from "../../middlewares/rateLimit.middleware";
import { v4 as uuidv4 } from "uuid";

const aiController = {
  generateDescription: asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { title, category, level, topics } = req.body;
      if (!title || !category || !level) return sendError(res, "title, category, level required", 400);
      const result = await aiService.generateCourseDescription(title, category, level, topics || []);
      return sendSuccess(res, result, "Description generated");
    } catch (err: any) {
      return sendError(res, "AI generation failed: " + err.message, 500);
    }
  }),

  generateQuiz: asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { courseTitle, lessonContent, numQuestions = 5 } = req.body;
      if (!courseTitle || !lessonContent) return sendError(res, "courseTitle and lessonContent required", 400);
      const result = await aiService.generateQuiz(courseTitle, lessonContent, numQuestions);
      return sendSuccess(res, result, "Quiz generated");
    } catch (err: any) {
      return sendError(res, "Quiz generation failed: " + err.message, 500);
    }
  }),

  getRecommendations: asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const recommendations = await aiService.getSmartRecommendations(req.user!.id);
      return sendSuccess(res, recommendations, "Recommendations generated");
    } catch (err: any) {
      return sendError(res, "Recommendations failed: " + err.message, 500);
    }
  }),

  chat: asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { message, sessionId = uuidv4() } = req.body;
      if (!message) return sendError(res, "message required", 400);
      const result = await aiService.chatWithAssistant(req.user!.id, sessionId, message);
      return sendSuccess(res, result, "Chat response");
    } catch (err: any) {
      console.error("❌ chatWithAssistant error:", err);
      return sendError(res, "Chat failed: " + err.message, 500);
    }
  }),

  classifyContent: asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { title, description } = req.body;
      if (!title || !description) return sendError(res, "title and description required", 400);
      const result = await aiService.classifyContent(title, description);
      return sendSuccess(res, result, "Content classified");
    } catch (err: any) {
      return sendError(res, "Classification failed: " + err.message, 500);
    }
  }),

  getChatHistory: asyncHandler(async (req: AuthRequest, res: Response) => {
    const history = await aiService.getChatHistory(req.user!.id, req.params.sessionId as string);
    return sendSuccess(res, history, "Chat history fetched");
  }),

  getChatSessions: asyncHandler(async (req: AuthRequest, res: Response) => {
    const sessions = await aiService.getChatSessions(req.user!.id);
    return sendSuccess(res, sessions, "Chat sessions fetched");
  }),
};

const router = Router();
router.use(requireAuth);
router.use(aiLimiter);

router.post("/generate-description", requireRole("INSTRUCTOR", "ADMIN"), aiController.generateDescription);
router.post("/generate-quiz", requireRole("INSTRUCTOR", "ADMIN"), aiController.generateQuiz);
router.post("/classify", requireRole("INSTRUCTOR", "ADMIN"), aiController.classifyContent);
router.get("/recommendations", aiController.getRecommendations);
router.post("/chat", aiController.chat);
router.get("/chat/sessions", aiController.getChatSessions);
router.get("/chat/:sessionId", aiController.getChatHistory);

export default router;
