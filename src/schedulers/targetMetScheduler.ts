import cron, { ScheduledTask } from "node-cron";
import { Telegraf } from "telegraf";
import { BotContext } from "../bot/context";
import { logger } from "../logger";
import { buildTargetMetMessage } from "../services/reportService";
import {
  getAllTrackedUsers,
  getActiveSessionMinutes,
  getWeeklySummary,
  markTargetMetSent,
  shouldSendTargetMetNotification
} from "../services/sessionService";

export function startTargetMetScheduler(bot: Telegraf<BotContext>, timezoneName: string): ScheduledTask {
  return cron.schedule(
    "*/5 * * * 1-6",
    async () => {
      try {
        const now = new Date();
        const users = await getAllTrackedUsers();

        for (const user of users) {
          const shouldNotify = await shouldSendTargetMetNotification(user.id, now, timezoneName);
          if (!shouldNotify) {
            continue;
          }

          const summary = await getWeeklySummary(user.id, now, timezoneName);
          const activeMinutes = await getActiveSessionMinutes(user.id, now);
          const totalWorked = summary.workedMinutes + activeMinutes;

          await bot.telegram.sendMessage(Number(user.chatId), buildTargetMetMessage(totalWorked));
          await markTargetMetSent(user.id, now, timezoneName);
        }
      } catch (error) {
        logger.error({ error }, "Target-met scheduler failed");
      }
    },
    { timezone: timezoneName }
  );
}
