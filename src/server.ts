import "dotenv/config";
import app from "./app";
import logger from "./config/logger";
import prisma from "./config/database";
import fs from "fs";

const PORT = process.env.PORT || 5000;

// Ensure logs directory exists (skip on Vercel — filesystem is not for persistent logs)
if (!process.env.VERCEL && !fs.existsSync("logs")) fs.mkdirSync("logs");

async function main() {
  try {
    // Test DB connection
    await prisma.$connect();
    logger.info("✅ Database connected successfully");

    const server = app.listen(PORT, () => {
      logger.info(`🚀 EduAI Backend running on http://localhost:${PORT}`);
      logger.info(`📚 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🔐 Auth URL: ${process.env.BETTER_AUTH_URL}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info("Server closed");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

  } catch (error) {
    logger.error("Failed to start server:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();




