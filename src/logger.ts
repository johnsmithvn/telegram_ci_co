import pino from "pino";
import { env } from "./config/env";

const loggerConfig: pino.LoggerOptions = {
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV === "production"
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
            ignore: "pid,hostname"
          }
        }
      })
};

export const logger = pino(loggerConfig);
