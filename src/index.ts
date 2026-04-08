import express from "express";
import { createTelegramBot } from "./bot/telegram";
import { createApiRouter } from "./api/apiRoutes";
import { env } from "./config/env";
import { pool } from "./db/postgres";
import { logger } from "./logger";
import { startSchedulers } from "./schedulers";

async function configureBotMenu(bot: ReturnType<typeof createTelegramBot>): Promise<void> {
  const commands = [
    { command: "help", description: "Xem huong dan su dung" },
    { command: "today", description: "Xem tong gio hom nay" },
    { command: "week", description: "Xem bao cao tuan" },
    { command: "month", description: "Xem tong ket thang" },
    { command: "add", description: "Them gio thu cong" },
    { command: "del", description: "Xoa log cua 1 ngay" },
    { command: "stop", description: "Dung bot cho tai khoan nay" }
  ];

  await bot.telegram.setMyCommands(commands);
  await bot.telegram.setChatMenuButton({ menuButton: { type: "commands" } });
}

async function bootstrap(): Promise<void> {
  const bot = createTelegramBot(env.BOT_TOKEN, env.TIMEZONE);
  const app = express();

  try {
    await configureBotMenu(bot);
    logger.info("Telegram command menu configured");
  } catch (error) {
    logger.warn({ error }, "Failed to configure Telegram command menu");
  }

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

  app.use(createApiRouter(bot, { API_SECRET: env.API_SECRET, TIMEZONE: env.TIMEZONE }));

  startSchedulers(bot, env.TIMEZONE, env.KEEP_AWAKE_URL);
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
