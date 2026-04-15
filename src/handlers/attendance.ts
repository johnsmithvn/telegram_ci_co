import { buildMainKeyboard } from "../bot/keyboard";
import { BotContext } from "../bot/context";
import { recordAttendance, getTodayWorkedMinutes, getWeeklySummary } from "../services/sessionService";
import {
  buildCheckInSuccessMessage,
  buildCheckOutMessage,
  buildUpdatedCheckoutMessage
} from "../services/reportService";

export async function handleAttendance(ctx: BotContext, timezoneName: string): Promise<void> {
  const user = ctx.state.trackedUser;
  if (!user) {
    return;
  }

  const now = new Date();
  const result = await recordAttendance(user.id, now, timezoneName);

  if (result.type === "checkedIn") {
    const message = buildCheckInSuccessMessage(result.session.startTime, timezoneName);
    await ctx.reply(message, { ...buildMainKeyboard() });
    return;
  }

  const [summary, todayWorkedMinutes] = await Promise.all([
    getWeeklySummary(user.id, now, timezoneName),
    getTodayWorkedMinutes(user.id, now, timezoneName)
  ]);

  const messageInput = {
    checkoutTime: now,
    sessionMinutes: result.workedMinutes,
    todayWorkedMinutes,
    summary,
    timezoneName
  };

  const message = result.type === "updatedCheckout"
    ? buildUpdatedCheckoutMessage(messageInput)
    : buildCheckOutMessage(messageInput);

  await ctx.reply(message, { ...buildMainKeyboard() });
}

