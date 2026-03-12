import cron, { ScheduledTask } from "node-cron";
import { Telegraf } from "telegraf";
import { BotContext } from "../bot/context";
import { logger } from "../logger";
import { buildKpiWarningMessage } from "../services/reportService";
import {
  getAllTrackedUsers,
  markKpiWarningSent,
  safeUserSummary,
  shouldSendKpiWarning
} from "../services/sessionService";

export function startKpiScheduler(bot: Telegraf<BotContext>, timezoneName: string): ScheduledTask {
  return cron.schedule(
    "*/5 * * * 1-6",
    async () => {
      try {
        const now = new Date();
        const users = await getAllTrackedUsers();

        for (const user of users) {
          const shouldNotify = await shouldSendKpiWarning(user.id, now, timezoneName);
          if (!shouldNotify) {
            continue;
          }

          const summary = await safeUserSummary(user.id, now, timezoneName);
          await bot.telegram.sendMessage(Number(user.chatId), buildKpiWarningMessage(summary.workedMinutes));
          await markKpiWarningSent(user.id, now, timezoneName);
        }
      } catch (error) {
        logger.error({ error }, "KPI scheduler failed");
      }
    },
    { timezone: timezoneName }
  );
}

