import express from "express";
import { createTelegramBot } from "./bot/telegram";
import { env } from "./config/env";
import { pool } from "./db/postgres";
import { logger } from "./logger";
import { startSchedulers } from "./schedulers";

async function bootstrap(): Promise<void> {
  const bot = createTelegramBot(env.BOT_TOKEN, env.TIMEZONE);
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.get("/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "telegram-work-bot",
      now: new Date().toISOString()
    });
  });

  if (env.WEBHOOK_URL) {
    const webhookPath = "/telegram/webhook";
    app.use(bot.webhookCallback(webhookPath));
    await bot.telegram.setWebhook(`${env.WEBHOOK_URL.replace(/\/$/, "")}${webhookPath}`);
    logger.info({ webhook: `${env.WEBHOOK_URL}${webhookPath}` }, "Telegram webhook configured");
  } else {
    await bot.launch({ dropPendingUpdates: true });
    logger.info("Telegram bot started in polling mode");
  }

  startSchedulers(bot, env.TIMEZONE);
  logger.info("Schedulers started");

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "HTTP server started");
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.warn({ signal }, "Shutting down...");
    server.close();
    bot.stop(signal);
    await pool.end();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

bootstrap().catch(async (error) => {
  logger.error({ error }, "Application failed to start");
  await pool.end();
  process.exit(1);
});

