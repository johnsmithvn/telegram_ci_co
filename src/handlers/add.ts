import { buildMainKeyboard } from "../bot/keyboard";
import { BotContext } from "../bot/context";
import {
  buildAddAskDateMessage,
  buildAddAskHoursMessage,
  buildInvalidDateMessage,
  buildInvalidHoursMessage,
  buildManualPastDayAddedMessage
} from "../services/reportService";
import {
  addManualSessionForDate,
  beginAddFlow,
  clearAddFlow,
  getUserState,
  setAddFlowDate
} from "../services/sessionService";
import { parseDateInput, parseHoursInput } from "../utils/time";

export async function handleAddCommand(ctx: BotContext, text: string, timezoneName: string): Promise<void> {
  const user = ctx.state.trackedUser;
  if (!user) {
    return;
  }

  const args = text
    .trim()
    .split(/\s+/)
    .slice(1);

  if (args.length === 0) {
    await beginAddFlow(user.id);
    await ctx.reply(buildAddAskDateMessage(), { ...buildMainKeyboard() });
    return;
  }

  const rawDate = args[0];
  if (!rawDate) {
    await ctx.reply(buildInvalidDateMessage(), { ...buildMainKeyboard() });
    return;
  }

  const parsedDate = parseDateInput(rawDate, timezoneName);
  if (!parsedDate) {
    await ctx.reply(buildInvalidDateMessage(), { ...buildMainKeyboard() });
    return;
  }

  if (args.length === 1) {
    await setAddFlowDate(user.id, parsedDate);
    await ctx.reply(buildAddAskHoursMessage(parsedDate), { ...buildMainKeyboard() });
    return;
  }

  const rawHours = args[1];
  if (!rawHours) {
    await ctx.reply(buildInvalidHoursMessage(), { ...buildMainKeyboard() });
    return;
  }

  const parsedHours = parseHoursInput(rawHours);
  if (!parsedHours) {
    await ctx.reply(buildInvalidHoursMessage(), { ...buildMainKeyboard() });
    return;
  }

  await addManualSessionForDate(user.id, parsedDate, parsedHours, timezoneName);
  await clearAddFlow(user.id);
  await ctx.reply(buildManualPastDayAddedMessage(parsedDate, parsedHours), {
    ...buildMainKeyboard()
  });
}

export async function handleAddFlowMessage(
  ctx: BotContext,
  text: string,
  timezoneName: string
): Promise<boolean> {
  const user = ctx.state.trackedUser;
  if (!user) {
    return false;
  }

  const state = await getUserState(user.id);
  if (state.addFlowStep === "NONE") {
    return false;
  }

  if (state.addFlowStep === "WAITING_DATE") {
    const parsedDate = parseDateInput(text, timezoneName);
    if (!parsedDate) {
      await ctx.reply(buildInvalidDateMessage(), { ...buildMainKeyboard() });
      return true;
    }
    await setAddFlowDate(user.id, parsedDate);
    await ctx.reply(buildAddAskHoursMessage(parsedDate), { ...buildMainKeyboard() });
    return true;
  }

  const parsedHours = parseHoursInput(text);
  if (!parsedHours || !state.addFlowDate) {
    await ctx.reply(buildInvalidHoursMessage(), { ...buildMainKeyboard() });
    return true;
  }

  await addManualSessionForDate(user.id, state.addFlowDate, parsedHours, timezoneName);
  await clearAddFlow(user.id);
  await ctx.reply(buildManualPastDayAddedMessage(state.addFlowDate, parsedHours), {
    ...buildMainKeyboard()
  });
  return true;
}
