import cron, { ScheduledTask } from "node-cron";
import { Telegraf } from "telegraf";
import { BotContext } from "../bot/context";
import { logger } from "../logger";
import { buildBurnDownReport } from "../services/reportService";
import { getAllTrackedUsers, getBurnDown } from "../services/sessionService";

export function startBurnDownScheduler(bot: Telegraf<BotContext>, timezoneName: string): ScheduledTask {
  return cron.schedule(
    "30 17 * * 1-5",
    async () => {
      try {
        const now = new Date();
        const users = await getAllTrackedUsers();
        for (const user of users) {
          const burnDown = await getBurnDown(user.id, now, timezoneName);
          const message = buildBurnDownReport({
            now,
            workedMinutes: burnDown.workedMinutes,
            targetMinutes: burnDown.targetMinutes,
            remainingMinutes: burnDown.remainingMinutes,
            daysLeft: burnDown.daysLeft,
            requiredMinutesPerDay: burnDown.requiredMinutesPerDay,
            timezoneName
          });
          await bot.telegram.sendMessage(Number(user.chatId), message);
        }
      } catch (error) {
        logger.error({ error }, "Burn-down scheduler failed");
      }
    },
    { timezone: timezoneName }
  );
}
