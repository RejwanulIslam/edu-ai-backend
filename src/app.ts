import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./config/auth";
import { generalLimiter } from "./middlewares/rateLimit.middleware";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import logger from "./config/logger";

// Route imports
import authRouter from "./modules/auth/auth.router";
import coursesRouter from "./modules/courses/courses.router";
import enrollmentsRouter from "./modules/enrollments/enrollments.router";
import reviewsRouter from "./modules/reviews/reviews.router";
import usersRouter from "./modules/users/users.router";
import aiRouter from "./modules/ai/ai.router";
import quizRouter from "./modules/quiz/quiz.router";

const app = express();

if (process.env.VERCEL) {
  app.set("trust proxy", 1);
}

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
}));

// Better Auth handler (must be before JSON body parser for auth routes)
app.all("/api/auth/*", toNodeHandler(auth));
// Body parsing
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging
app.use(morgan("combined", {
  stream: { write: (message) => logger.info(message.trim()) },
}));

// Rate limiting
app.use("/api/", generalLimiter);

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "EduAI Backend",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// API Routes
app.use("/api/auth-extra", authRouter); // custom auth endpoints (me, session, demo)
app.use("/api/courses", coursesRouter);
app.use("/api/enrollments", enrollmentsRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/users", usersRouter);
app.use("/api/ai", aiRouter);
app.use("/api/quiz", quizRouter);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
