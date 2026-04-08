import { buildAddDayKeyboard, buildMainKeyboard } from "../bot/keyboard";
import { BotContext } from "../bot/context";
import {
  buildDeleteAskDateMessage,
  buildDeleteNothingMessage,
  buildDeleteSuccessMessage,
  buildInvalidDateMessage
} from "../services/reportService";
import { beginDeleteFlow, clearDeleteFlow, deleteSessionsForDate, getUserState } from "../services/sessionService";
import { getAddFlowDayChoices, parseAddFlowDateFromChoice, parseDateInput } from "../utils/time";

function resolveDeleteDateInput(rawText: string, timezoneName: string): string | null {
  const trimmed = rawText.trim();
  const choices = getAddFlowDayChoices(timezoneName);

  const byShortcut = choices.find((item) => item.key === trimmed.toUpperCase());
  if (byShortcut) {
    return byShortcut.date;
  }

  const byLabel = choices.find((item) => item.label === trimmed);
  if (byLabel) {
    return byLabel.date;
  }

  return parseAddFlowDateFromChoice(trimmed) ?? parseDateInput(trimmed, timezoneName);
}

export async function handleDeleteDayCommand(ctx: BotContext, text: string, timezoneName: string): Promise<void> {
  const user = ctx.state.trackedUser;
  if (!user) {
    return;
  }

  const args = text.trim().split(/\s+/).slice(1);

  if (args.length === 0) {
    await beginDeleteFlow(user.id);
    await ctx.reply(buildDeleteAskDateMessage(), { ...buildAddDayKeyboard(getAddFlowDayChoices(timezoneName)) });
    return;
  }

  const rawDate = args[0];
  if (!rawDate) {
    await ctx.reply(buildInvalidDateMessage(), { ...buildAddDayKeyboard(getAddFlowDayChoices(timezoneName)) });
    return;
  }

  const parsedDate = resolveDeleteDateInput(rawDate, timezoneName);
  if (!parsedDate) {
    await ctx.reply(buildInvalidDateMessage(), { ...buildAddDayKeyboard(getAddFlowDayChoices(timezoneName)) });
    return;
  }

  const deletedSessions = await deleteSessionsForDate(user.id, parsedDate);
  if (deletedSessions === 0) {
    await ctx.reply(buildDeleteNothingMessage(parsedDate), { ...buildMainKeyboard() });
    return;
  }

  await clearDeleteFlow(user.id);
  await ctx.reply(buildDeleteSuccessMessage(parsedDate, deletedSessions), { ...buildMainKeyboard() });
}

export async function handleDeleteDayFlowMessage(
  ctx: BotContext,
  text: string,
  timezoneName: string
): Promise<boolean> {
  const user = ctx.state.trackedUser;
  if (!user) {
    return false;
  }

  const state = await getUserState(user.id);
  if (state.deleteFlowStep !== "WAITING_DATE") {
    return false;
  }

  const parsedDate = resolveDeleteDateInput(text, timezoneName);
  if (!parsedDate) {
    await ctx.reply(buildInvalidDateMessage(), { ...buildAddDayKeyboard(getAddFlowDayChoices(timezoneName)) });
    return true;
  }

  const deletedSessions = await deleteSessionsForDate(user.id, parsedDate);
  await clearDeleteFlow(user.id);

  if (deletedSessions === 0) {
    await ctx.reply(buildDeleteNothingMessage(parsedDate), { ...buildMainKeyboard() });
    return true;
  }

  await ctx.reply(buildDeleteSuccessMessage(parsedDate, deletedSessions), { ...buildMainKeyboard() });
  return true;
}