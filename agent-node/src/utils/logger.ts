/**
 * Logger utility for VaultMind Agent
 * Uses winston for structured logging with timestamps
 */

import winston from "winston";

export function createLogger(module: string): winston.Logger {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length > 0
          ? ` ${JSON.stringify(meta)}`
          : "";
        return `[${timestamp}] [${level.toUpperCase()}] [${module}] ${message}${metaStr}`;
      })
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length > 0
              ? `\n  ${JSON.stringify(meta, null, 2)}`
              : "";
            return `[${timestamp}] [${level}] [${module}] ${message}${metaStr}`;
          })
        ),
      }),
      new winston.transports.File({
        filename: "logs/vaultmind-agent.log",
        maxsize: 10_000_000, // 10MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: "logs/vaultmind-errors.log",
        level: "error",
        maxsize: 10_000_000,
        maxFiles: 5,
      }),
    ],
  });
}
