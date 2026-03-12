import cron, { ScheduledTask } from "node-cron";
import { Telegraf } from "telegraf";
import { BotContext } from "../bot/context";
import { logger } from "../logger";
import { buildCheckOutMessage, buildTargetMetMessage } from "../services/reportService";
import {
  checkOut,
  getAllTrackedUsers,
  getTodayWorkedMinutes,
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

          // Auto checkout
          const checkoutResult = await checkOut(user.id, now);
          if (checkoutResult) {
            const [summary, todayWorkedMinutes] = await Promise.all([
              getWeeklySummary(user.id, now, timezoneName),
              getTodayWorkedMinutes(user.id, now, timezoneName)
            ]);

            const targetMsg = buildTargetMetMessage(summary.workedMinutes);
            const checkoutMsg = buildCheckOutMessage({
              checkoutTime: now,
              sessionMinutes: checkoutResult.workedMinutes,
              todayWorkedMinutes,
              summary,
              timezoneName
            });

            await bot.telegram.sendMessage(Number(user.chatId), `${targetMsg}\n\n${checkoutMsg}`);
          }

          await markTargetMetSent(user.id, now, timezoneName);
        }
      } catch (error) {
        logger.error({ error }, "Target-met scheduler failed");
      }
    },
    { timezone: timezoneName }
  );
}
