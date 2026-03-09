import cron, { ScheduledTask } from "node-cron";
import { Telegraf } from "telegraf";
import { BotContext } from "../bot/context";
import { logger } from "../logger";
import { buildMonthlySchedulerMessage } from "../services/reportService";
import { getAllTrackedUsers, getMonthlyReportData } from "../services/sessionService";
import { isMonthEnd } from "../utils/time";

export function startMonthlySummaryScheduler(bot: Telegraf<BotContext>, timezoneName: string): ScheduledTask {
  return cron.schedule(
    "5 21 * * *",
    async () => {
      try {
        const now = new Date();
        if (!isMonthEnd(now, timezoneName)) {
          return;
        }

        const users = await getAllTrackedUsers();
        for (const user of users) {
          const month = await getMonthlyReportData(user.id, now, timezoneName);
          const message = buildMonthlySchedulerMessage({
            monthLabel: month.monthLabel,
            totalMinutes: month.totalMinutes,
            averageMinutesPerWorkedDay: month.averageMinutesPerWorkedDay,
            workedDays: month.workedDays,
            weeks: month.weeks
          });
          await bot.telegram.sendMessage(Number(user.chatId), message);
        }
      } catch (error) {
        logger.error({ error }, "Monthly summary scheduler failed");
      }
    },
    { timezone: timezoneName }
  );
}

