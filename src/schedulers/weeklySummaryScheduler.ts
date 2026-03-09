import cron, { ScheduledTask } from "node-cron";
import { Telegraf } from "telegraf";
import { BotContext } from "../bot/context";
import { logger } from "../logger";
import { buildWeeklySchedulerMessage } from "../services/reportService";
import { getAllTrackedUsers, getWeeklyReportData } from "../services/sessionService";

export function startWeeklySummaryScheduler(bot: Telegraf<BotContext>, timezoneName: string): ScheduledTask {
  return cron.schedule(
    "0 21 * * 0",
    async () => {
      try {
        const now = new Date();
        const users = await getAllTrackedUsers();

        for (const user of users) {
          const week = await getWeeklyReportData(user.id, now, timezoneName);
          const message = buildWeeklySchedulerMessage({
            days: week.days,
            workedMinutes: week.workedMinutes,
            targetMinutes: week.targetMinutes,
            remainingMinutes: week.remainingMinutes
          });
          await bot.telegram.sendMessage(Number(user.chatId), message);
        }
      } catch (error) {
        logger.error({ error }, "Weekly summary scheduler failed");
      }
    },
    { timezone: timezoneName }
  );
}

