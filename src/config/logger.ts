import winston from "winston";

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const baseFormat = combine(
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  json()
);

const transports: winston.transport[] = [];

if (process.env.VERCEL) {
  transports.push(
    new winston.transports.Console({
      format: baseFormat,
    })
  );
} else {
  transports.push(
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" })
  );
}

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: baseFormat,
  defaultMeta: { service: "eduai-backend" },
  transports,
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: combine(colorize(), simple()),
    })
  );
}

export default logger;
