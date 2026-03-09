import { buildMainKeyboard } from "../bot/keyboard";
import { BotContext } from "../bot/context";
import {
  buildMonthReportMessage,
  buildResetConfirmMessage,
  buildResetDeniedMessage,
  buildResetSuccessMessage,
  buildTodayReportMessage,
  buildWeekReportMessage
} from "../services/reportService";
import {
  clearAllData,
  getMonthlyReportData,
  getTodayWorkedMinutes,
  getWeeklyReportData
} from "../services/sessionService";

export async function handleTodayCommand(ctx: BotContext, timezoneName: string): Promise<void> {
  const user = ctx.state.trackedUser;
  if (!user) {
    return;
  }

  const todayMinutes = await getTodayWorkedMinutes(user.id, new Date(), timezoneName);
  await ctx.reply(buildTodayReportMessage(todayMinutes), { ...buildMainKeyboard() });
}

export async function handleWeekCommand(ctx: BotContext, timezoneName: string): Promise<void> {
  const user = ctx.state.trackedUser;
  if (!user) {
    return;
  }

  const week = await getWeeklyReportData(user.id, new Date(), timezoneName);
  await ctx.reply(
    buildWeekReportMessage({
      days: week.days,
      workedMinutes: week.workedMinutes,
      targetMinutes: week.targetMinutes,
      remainingMinutes: week.remainingMinutes
    }),
    { ...buildMainKeyboard() }
  );
}

export async function handleMonthCommand(ctx: BotContext, timezoneName: string): Promise<void> {
  const user = ctx.state.trackedUser;
  if (!user) {
    return;
  }

  const month = await getMonthlyReportData(user.id, new Date(), timezoneName);
  await ctx.reply(
    buildMonthReportMessage({
      monthLabel: month.monthLabel,
      totalMinutes: month.totalMinutes,
      averageMinutesPerWorkedDay: month.averageMinutesPerWorkedDay,
      workedDays: month.workedDays,
      weeks: month.weeks
    }),
    { ...buildMainKeyboard() }
  );
}

export async function handleResetAllCommand(
  ctx: BotContext,
  text: string,
  adminTelegramIds: string[]
): Promise<void> {
  const telegramId = ctx.from?.id ? String(ctx.from.id) : null;
  if (!telegramId || !adminTelegramIds.includes(telegramId)) {
    await ctx.reply(buildResetDeniedMessage(), { ...buildMainKeyboard() });
    return;
  }

  const parts = text.trim().split(/\s+/);
  const confirmToken = parts[1];
  if (!confirmToken || confirmToken.toUpperCase() !== "CONFIRM") {
    await ctx.reply(buildResetConfirmMessage(), { ...buildMainKeyboard() });
    return;
  }

  await clearAllData();
  await ctx.reply(buildResetSuccessMessage(), { ...buildMainKeyboard() });
}
