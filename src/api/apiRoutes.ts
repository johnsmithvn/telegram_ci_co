import { Router, Request, Response } from "express";
import { Telegraf } from "telegraf";
import { BotContext } from "../bot/context";
import { findUserByTelegramId } from "../db/repositories/userRepository";
import { findOpenSession } from "../db/repositories/sessionRepository";
import {
  recordAttendance,
  checkIn,
  checkOut,
  getTodayWorkedMinutes,
  getWeeklySummary
} from "../services/sessionService";
import {
  buildCheckInSuccessMessage,
  buildAlreadyCheckedInMessage,
  buildCheckOutMessage,
  buildNoOpenSessionMessage
} from "../services/reportService";
import { logger } from "../logger";

interface ApiEnv {
  API_SECRET: string | undefined;
  TIMEZONE: string;
}

export function createApiRouter(bot: Telegraf<BotContext>, apiEnv: ApiEnv): Router {
  const router = Router();

  router.use((req: Request, res: Response, next) => {
    if (!apiEnv.API_SECRET) {
      res.status(503).json({ ok: false, error: "API_SECRET not configured" });
      return;
    }

    const key = req.headers["x-api-key"];
    if (key !== apiEnv.API_SECRET) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    next();
  });

  router.post("/api/attendance", async (req: Request, res: Response) => {
    try {
      const telegramId = Number(req.body?.telegram_id);
      if (!telegramId) {
        res.status(400).json({ ok: false, error: "telegram_id required" });
        return;
      }

      const user = await findUserByTelegramId(telegramId);
      if (!user || !user.isActive) {
        res.status(404).json({ ok: false, error: "User not found or inactive" });
        return;
      }

      const now = new Date();
      const result = await recordAttendance(user.id, now, apiEnv.TIMEZONE);

      if (result.type === "checkedIn") {
        const message = `🤖 Auto chấm công!\n${buildCheckInSuccessMessage(result.session.startTime, apiEnv.TIMEZONE)}`;
        await bot.telegram.sendMessage(Number(user.chatId), message);

        res.json({
          ok: true,
          action: "checkin",
          start_time: result.session.startTime.toISOString()
        });
        return;
      }

      const [summary, todayWorkedMinutes] = await Promise.all([
        getWeeklySummary(user.id, now, apiEnv.TIMEZONE),
        getTodayWorkedMinutes(user.id, now, apiEnv.TIMEZONE)
      ]);

      const message = `🤖 Auto chấm công!\n${buildCheckOutMessage({
        checkoutTime: now,
        sessionMinutes: result.workedMinutes,
        todayWorkedMinutes,
        summary,
        timezoneName: apiEnv.TIMEZONE
      })}`;

      await bot.telegram.sendMessage(Number(user.chatId), message);

      res.json({
        ok: true,
        action: "checkout",
        worked_minutes: result.workedMinutes
      });
    } catch (error) {
      logger.error({ error }, "API attendance failed");
      res.status(500).json({ ok: false, error: "Internal server error" });
    }
  });

  router.post("/api/checkin", async (req: Request, res: Response) => {
    try {
      const telegramId = Number(req.body?.telegram_id);
      if (!telegramId) {
        res.status(400).json({ ok: false, error: "telegram_id required" });
        return;
      }

      const user = await findUserByTelegramId(telegramId);
      if (!user || !user.isActive) {
        res.status(404).json({ ok: false, error: "User not found or inactive" });
        return;
      }

      const now = new Date();
      const result = await checkIn(user.id, now, apiEnv.TIMEZONE);

      const message = result.alreadyWorking
        ? buildAlreadyCheckedInMessage(result.session.startTime, apiEnv.TIMEZONE)
        : `🤖 Auto check-in!\n${buildCheckInSuccessMessage(result.session.startTime, apiEnv.TIMEZONE)}`;

      await bot.telegram.sendMessage(Number(user.chatId), message);

      res.json({
        ok: true,
        action: "checkin",
        already_working: result.alreadyWorking,
        start_time: result.session.startTime.toISOString()
      });
    } catch (error) {
      logger.error({ error }, "API checkin failed");
      res.status(500).json({ ok: false, error: "Internal server error" });
    }
  });

  router.post("/api/checkout", async (req: Request, res: Response) => {
    try {
      const telegramId = Number(req.body?.telegram_id);
      if (!telegramId) {
        res.status(400).json({ ok: false, error: "telegram_id required" });
        return;
      }

      const user = await findUserByTelegramId(telegramId);
      if (!user || !user.isActive) {
        res.status(404).json({ ok: false, error: "User not found or inactive" });
        return;
      }

      const now = new Date();
      const result = await checkOut(user.id, now);
      if (!result) {
        const msg = buildNoOpenSessionMessage();
        await bot.telegram.sendMessage(Number(user.chatId), msg);
        res.status(409).json({ ok: false, error: "No open session" });
        return;
      }

      const [summary, todayWorkedMinutes] = await Promise.all([
        getWeeklySummary(user.id, now, apiEnv.TIMEZONE),
        getTodayWorkedMinutes(user.id, now, apiEnv.TIMEZONE)
      ]);

      const message = `🤖 Auto check-out!\n${buildCheckOutMessage({
        checkoutTime: now,
        sessionMinutes: result.workedMinutes,
        todayWorkedMinutes,
        summary,
        timezoneName: apiEnv.TIMEZONE
      })}`;

      await bot.telegram.sendMessage(Number(user.chatId), message);

      res.json({
        ok: true,
        action: "checkout",
        worked_minutes: result.workedMinutes
      });
    } catch (error) {
      logger.error({ error }, "API checkout failed");
      res.status(500).json({ ok: false, error: "Internal server error" });
    }
  });

  router.post("/api/status", async (req: Request, res: Response) => {
    try {
      const telegramId = Number(req.body?.telegram_id);
      if (!telegramId) {
        res.status(400).json({ ok: false, error: "telegram_id required" });
        return;
      }

      const user = await findUserByTelegramId(telegramId);
      if (!user || !user.isActive) {
        res.status(404).json({ ok: false, error: "User not found or inactive" });
        return;
      }

      const openSession = await findOpenSession(user.id);
      res.json({
        ok: true,
        status: openSession ? "working" : "idle",
        session_start: openSession ? openSession.startTime.toISOString() : null
      });
    } catch (error) {
      logger.error({ error }, "API status failed");
      res.status(500).json({ ok: false, error: "Internal server error" });
    }
  });

  return router;
}
