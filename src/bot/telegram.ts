import { Telegraf } from "telegraf";
import { BotContext } from "./context";
import {
  buildMainKeyboard,
  ATTENDANCE_LABEL,
  STOP_CONFIRM_NO_CALLBACK,
  STOP_CONFIRM_YES_CALLBACK
} from "./keyboard";
import { attachTrackedUser } from "./middleware";
import { env } from "../config/env";
import { handleAddCommand, handleAddFlowMessage } from "../handlers/add";
import { handleAttendance } from "../handlers/attendance";
import { handleManualHoursForOpenSession, replyNoManualTarget } from "../handlers/manualHours";
import {
  handleMonthCommand,
  handleResetAllCommand,
  handleTodayCommand,
  handleWeekCommand
} from "../handlers/reportCommands";
import { handleStart } from "../handlers/start";
import { handleStopCommand, handleStopConfirmNo, handleStopConfirmYes } from "../handlers/stop";
import { logger } from "../logger";
import { buildUnknownTextMessage } from "../services/reportService";
import { reactivateUserForBot } from "../services/sessionService";
import { parseHoursInput } from "../utils/time";

export function createTelegramBot(botToken: string, timezoneName: string): Telegraf<BotContext> {
  const bot = new Telegraf<BotContext>(botToken);

  bot.use(attachTrackedUser);

  bot.start(async (ctx) => {
    if (ctx.from && ctx.chat && ctx.chat.type === "private") {
      const user = await reactivateUserForBot({
        telegramId: ctx.from.id,
        chatId: ctx.chat.id,
        name: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ").trim() || ctx.from.username || null
      });
      ctx.state.trackedUser = user;
      ctx.state.inactiveUser = false;
    }
    await handleStart(ctx);
  });

  bot.command("help", async (ctx) => {
    await handleStart(ctx);
  });

  bot.command("add", async (ctx) => {
    const text = "text" in ctx.message ? ctx.message.text : "/add";
    await handleAddCommand(ctx, text, timezoneName);
  });

  bot.command("today", async (ctx) => {
    await handleTodayCommand(ctx, timezoneName);
  });

  bot.command("week", async (ctx) => {
    const text = "text" in ctx.message ? ctx.message.text : "/week";
    await handleWeekCommand(ctx, text, timezoneName);
  });

  bot.command("month", async (ctx) => {
    await handleMonthCommand(ctx, timezoneName);
  });

  bot.command("resetall", async (ctx) => {
    const text = "text" in ctx.message ? ctx.message.text : "/resetall";
    await handleResetAllCommand(ctx, text, env.ADMIN_TELEGRAM_IDS);
  });

  bot.command("stop", async (ctx) => {
    await handleStopCommand(ctx);
  });

  bot.command("stopme", async (ctx) => {
    await handleStopCommand(ctx);
  });

  bot.action(STOP_CONFIRM_YES_CALLBACK, async (ctx) => {
    await handleStopConfirmYes(ctx);
  });

  bot.action(STOP_CONFIRM_NO_CALLBACK, async (ctx) => {
    await handleStopConfirmNo(ctx);
  });

  bot.hears(ATTENDANCE_LABEL, async (ctx) => {
    await handleAttendance(ctx, timezoneName);
  });

  bot.on("text", async (ctx) => {
    const text = ctx.message.text.trim();

    if (text.startsWith("/add")) {
      await handleAddCommand(ctx, text, timezoneName);
      return;
    }

    const addFlowProcessed = await handleAddFlowMessage(ctx, text, timezoneName);
    if (addFlowProcessed) {
      return;
    }

    const hours = parseHoursInput(text);
    if (hours === null) {
      await ctx.reply(buildUnknownTextMessage(), { ...buildMainKeyboard() });
      return;
    }

    const handled = await handleManualHoursForOpenSession(ctx, hours, timezoneName);
    if (!handled) {
      await replyNoManualTarget(ctx);
    }
  });

  bot.catch((error, ctx) => {
    logger.error({ error, updateId: ctx.update.update_id }, "Telegram bot handler failed");
  });

  return bot;
}
