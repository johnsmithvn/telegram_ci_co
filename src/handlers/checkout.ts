import { buildMainKeyboard } from "../bot/keyboard";
import { BotContext } from "../bot/context";
import { buildCheckOutMessage, buildNoOpenSessionMessage } from "../services/reportService";
import { checkOut, getTodayWorkedMinutes, getWeeklySummary } from "../services/sessionService";

export async function handleCheckOut(ctx: BotContext, timezoneName: string): Promise<void> {
  const user = ctx.state.trackedUser;
  if (!user) {
    return;
  }

  const now = new Date();
  const result = await checkOut(user.id, now);
  if (!result) {
    await ctx.reply(buildNoOpenSessionMessage(), {
      ...buildMainKeyboard()
    });
    return;
  }

  const [summary, todayWorkedMinutes] = await Promise.all([
    getWeeklySummary(user.id, now, timezoneName),
    getTodayWorkedMinutes(user.id, now, timezoneName)
  ]);

  const message = buildCheckOutMessage({
    checkoutTime: now,
    sessionMinutes: result.workedMinutes,
    todayWorkedMinutes,
    summary,
    timezoneName
  });

  await ctx.reply(message, {
    ...buildMainKeyboard()
  });
}

