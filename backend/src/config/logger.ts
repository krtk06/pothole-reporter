import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-api-key']",
      "body.password",
      "body.current_password",
      "body.new_password",
      "body.refreshToken",
      "body.token",
      "body.api_key",
    ],
    censor: "[REDACTED]",
  },
});

export default logger;
