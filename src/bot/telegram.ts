import { Telegraf } from "telegraf";
import { BotContext } from "./context";
import { CHECKIN_LABEL, CHECKOUT_LABEL } from "./keyboard";
import { attachTrackedUser } from "./middleware";
import { handleAddCommand, handleAddFlowMessage } from "../handlers/add";
import { handleCheckIn } from "../handlers/checkin";
import { handleCheckOut } from "../handlers/checkout";
import { handleManualHoursForOpenSession, replyNoManualTarget } from "../handlers/manualHours";
import { handleStart } from "../handlers/start";
import { logger } from "../logger";
import { parseHoursInput } from "../utils/time";

export function createTelegramBot(botToken: string, timezoneName: string): Telegraf<BotContext> {
  const bot = new Telegraf<BotContext>(botToken);

  bot.use(attachTrackedUser);

  bot.start(async (ctx) => {
    await handleStart(ctx);
  });

  bot.command("help", async (ctx) => {
    await handleStart(ctx);
  });

  bot.command("add", async (ctx) => {
    const text = "text" in ctx.message ? ctx.message.text : "/add";
    await handleAddCommand(ctx, text, timezoneName);
  });

  bot.hears(CHECKIN_LABEL, async (ctx) => {
    await handleCheckIn(ctx, timezoneName);
  });

  bot.hears(CHECKOUT_LABEL, async (ctx) => {
    await handleCheckOut(ctx, timezoneName);
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

