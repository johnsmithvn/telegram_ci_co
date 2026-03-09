import { Telegraf } from "telegraf";
import { BotContext } from "../bot/context";
import { startBurnDownScheduler } from "./burnDownScheduler";
import { startForgotCheckoutScheduler } from "./forgotCheckoutScheduler";
import { startKeepAwakeScheduler } from "./keepAwakeScheduler";
import { startKpiScheduler } from "./kpiScheduler";
import { startMonthlySummaryScheduler } from "./monthlySummaryScheduler";
import { startWeeklySummaryScheduler } from "./weeklySummaryScheduler";

export function startSchedulers(
  bot: Telegraf<BotContext>,
  timezoneName: string,
  keepAwakeUrl?: string
): void {
  startBurnDownScheduler(bot, timezoneName);
  startForgotCheckoutScheduler(bot, timezoneName);
  startKpiScheduler(bot, timezoneName);
  startWeeklySummaryScheduler(bot, timezoneName);
  startMonthlySummaryScheduler(bot, timezoneName);
  if (keepAwakeUrl) {
    startKeepAwakeScheduler(keepAwakeUrl, timezoneName);
  }
}
