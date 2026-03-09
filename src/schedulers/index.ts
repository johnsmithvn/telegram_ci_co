import { Telegraf } from "telegraf";
import { BotContext } from "../bot/context";
import { startBurnDownScheduler } from "./burnDownScheduler";
import { startForgotCheckoutScheduler } from "./forgotCheckoutScheduler";
import { startKpiScheduler } from "./kpiScheduler";

export function startSchedulers(bot: Telegraf<BotContext>, timezoneName: string): void {
  startBurnDownScheduler(bot, timezoneName);
  startForgotCheckoutScheduler(bot, timezoneName);
  startKpiScheduler(bot, timezoneName);
}

