import cron, { ScheduledTask } from "node-cron";
import { Telegraf } from "telegraf";
import { BotContext } from "../bot/context";
import { logger } from "../logger";
import { buildAutoCheckoutAtEndOfDayMessage } from "../services/reportService";
import {
  autoCloseOpenSessionAtEndOfWorkDate,
  getOpenSessionsForReminder,
  getUserState,
  markForgotPrompt
} from "../services/sessionService";
import { getLocalDateString } from "../utils/time";

export function startForgotCheckoutScheduler(
  bot: Telegraf<BotContext>,
  timezoneName: string
): ScheduledTask {
  return cron.schedule(
    "59 23 * * 1-6",
    async () => {
      try {
        const now = new Date();
        const today = getLocalDateString(now, timezoneName);
        const openSessions = await getOpenSessionsForReminder();

        for (const row of openSessions) {
          const state = await getUserState(row.user.id);
          if (state.lastForgotCheckoutPromptDate === today) {
            continue;
          }

          const closed = await autoCloseOpenSessionAtEndOfWorkDate(
            row.user.id,
            row.session.workDate,
            timezoneName
          );

          if (!closed) {
            continue;
          }

          await bot.telegram.sendMessage(
            Number(row.user.chatId),
            buildAutoCheckoutAtEndOfDayMessage(row.session.workDate, closed.workedMinutes)
          );
          await markForgotPrompt(row.user.id, today);
        }
      } catch (error) {
        logger.error({ error }, "Forgot-checkout scheduler failed");
      }
    },
    { timezone: timezoneName }
  );
}

