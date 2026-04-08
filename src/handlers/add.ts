import {
  buildAddDayKeyboard,
  buildAddDirectTimeKeyboard,
  buildAddHourKeyboard,
  buildAddMinuteKeyboard,
  buildAddModeKeyboard,
  buildMainKeyboard
} from "../bot/keyboard";
import { BotContext } from "../bot/context";
import {
  buildAddAskDateMessage,
  buildAddAskDirectTimeMessage,
  buildAddAskEndHourMessage,
  buildAddAskEndMinuteMessage,
  buildAddAskModeMessage,
  buildAddAskStartHourMessage,
  buildAddAskStartMinuteMessage,
  buildInvalidDateMessage,
  buildInvalidHourMessage,
  buildInvalidMinuteMessage,
  buildInvalidTimeMessage,
  buildManualPastDayAddedByTimeMessage
} from "../services/reportService";
import {
  addManualSessionForDateByTimeRange,
  beginAddFlow,
  clearAddFlow,
  getUserState,
  setAddFlowDate,
  setAddFlowEndHour,
  setAddFlowModeDirect,
  setAddFlowModeStepwise,
  setAddFlowStartHour,
  setAddFlowStartTime
} from "../services/sessionService";
import {
  getAddFlowDayChoices,
  parseAddFlowDateFromChoice,
  parseClockTimeInput,
  parseDirectTimeRangeInput,
  parseHourInput,
  parseMinuteInput,
  parseDateInput
} from "../utils/time";

function resolveAddDateInput(rawText: string, timezoneName: string): string | null {
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

function resolveAddModeInput(rawText: string): "direct" | "stepwise" | null {
  const normalized = rawText.trim().toLowerCase();
  if (normalized === "1" || normalized.startsWith("1.") || normalized.includes("nhap lien")) {
    return "direct";
  }
  if (normalized === "2" || normalized.startsWith("2.") || normalized.includes("tach gio")) {
    return "stepwise";
  }
  return null;
}

function isExplicitDateSelection(rawText: string): boolean {
  const trimmed = rawText.trim();
  return /^T[2-7]$/i.test(trimmed) || /\d{4}-\d{2}-\d{2}/.test(trimmed) || /\d{2}[/-]\d{2}([/-]\d{4})?/.test(trimmed);
}

function formatClock(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

async function sendDirectRangePrompt(ctx: BotContext, workDate: string): Promise<void> {
  await ctx.reply(buildAddAskDirectTimeMessage(workDate), { ...buildAddDirectTimeKeyboard() });
}

async function saveDirectRange(
  ctx: BotContext,
  userId: string,
  workDate: string,
  startTime: string,
  endTime: string,
  timezoneName: string
): Promise<void> {
  try {
    const result = await addManualSessionForDateByTimeRange(userId, workDate, startTime, endTime, timezoneName);
    await clearAddFlow(userId);
    await ctx.reply(buildManualPastDayAddedByTimeMessage(workDate, startTime, endTime, result.durationMinutes), {
      ...buildMainKeyboard()
    });
  } catch {
    await ctx.reply("Giờ ra phải lớn hơn giờ vào (cùng ngày).", { ...buildAddDirectTimeKeyboard() });
  }
}

async function saveStepwiseRange(
  ctx: BotContext,
  userId: string,
  workDate: string,
  startTime: string,
  endTime: string,
  timezoneName: string,
  retryWithStart: boolean
): Promise<void> {
  try {
    const result = await addManualSessionForDateByTimeRange(userId, workDate, startTime, endTime, timezoneName);
    await clearAddFlow(userId);
    await ctx.reply(buildManualPastDayAddedByTimeMessage(workDate, startTime, endTime, result.durationMinutes), {
      ...buildMainKeyboard()
    });
  } catch {
    if (retryWithStart) {
      await setAddFlowStartTime(userId, workDate, startTime);
      await ctx.reply("Giờ ra phải lớn hơn giờ vào. Nhập lại giờ ra trước.", {
        ...buildAddHourKeyboard()
      });
      return;
    }
    await ctx.reply("Giờ ra phải lớn hơn giờ vào (cùng ngày).", { ...buildAddMinuteKeyboard() });
  }
}

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
    const choices = getAddFlowDayChoices(timezoneName);
    await ctx.reply(buildAddAskDateMessage(), { ...buildAddDayKeyboard(choices) });
    return;
  }

  const rawDate = args[0];
  if (!rawDate) {
    const choices = getAddFlowDayChoices(timezoneName);
    await ctx.reply(buildInvalidDateMessage(), { ...buildAddDayKeyboard(choices) });
    return;
  }

  const parsedDate = resolveAddDateInput(rawDate, timezoneName);
  if (!parsedDate) {
    const choices = getAddFlowDayChoices(timezoneName);
    await ctx.reply(buildInvalidDateMessage(), { ...buildAddDayKeyboard(choices) });
    return;
  }

  if (args.length === 1) {
    await setAddFlowDate(user.id, parsedDate);
    await ctx.reply(buildAddAskModeMessage(parsedDate), { ...buildAddModeKeyboard() });
    return;
  }

  const directRange = parseDirectTimeRangeInput(args.slice(1).join(" "));
  if (!directRange) {
    await ctx.reply(buildInvalidTimeMessage(), { ...buildAddDirectTimeKeyboard() });
    return;
  }

  await saveDirectRange(ctx, user.id, parsedDate, directRange.startTime, directRange.endTime, timezoneName);
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

  const reselectedDate = resolveAddDateInput(text, timezoneName);
  if (reselectedDate && isExplicitDateSelection(text)) {
    await setAddFlowDate(user.id, reselectedDate);
    await ctx.reply(buildAddAskModeMessage(reselectedDate), { ...buildAddModeKeyboard() });
    return true;
  }

  if (state.addFlowStep === "WAITING_DATE") {
    const parsedDate = resolveAddDateInput(text, timezoneName);
    if (!parsedDate) {
      const choices = getAddFlowDayChoices(timezoneName);
      await ctx.reply(buildInvalidDateMessage(), { ...buildAddDayKeyboard(choices) });
      return true;
    }
    await setAddFlowDate(user.id, parsedDate);
    await ctx.reply(buildAddAskModeMessage(parsedDate), { ...buildAddModeKeyboard() });
    return true;
  }

  if (state.addFlowStep === "WAITING_MODE") {
    const mode = resolveAddModeInput(text);
    if (!mode || !state.addFlowDate) {
      await ctx.reply("Chọn 1 hoặc 2 để tiếp tục.", { ...buildAddModeKeyboard() });
      return true;
    }

    if (mode === "direct") {
      await setAddFlowModeDirect(user.id, state.addFlowDate);
      await sendDirectRangePrompt(ctx, state.addFlowDate);
      return true;
    }

    await setAddFlowModeStepwise(user.id, state.addFlowDate);
    await ctx.reply(buildAddAskStartHourMessage(state.addFlowDate), { ...buildAddHourKeyboard() });
    return true;
  }

  if (state.addFlowStep === "WAITING_DIRECT_RANGE") {
    const directRange = parseDirectTimeRangeInput(text);
    if (!directRange || !state.addFlowDate) {
      await ctx.reply(buildInvalidTimeMessage(), { ...buildAddDirectTimeKeyboard() });
      return true;
    }

    await saveDirectRange(ctx, user.id, state.addFlowDate, directRange.startTime, directRange.endTime, timezoneName);
    return true;
  }

  if (state.addFlowStep === "WAITING_START_HOUR" || state.addFlowStep === "WAITING_HOURS" || state.addFlowStep === "WAITING_START_TIME") {
    const startHour = parseHourInput(text);
    if (startHour === null || !state.addFlowDate) {
      await ctx.reply(buildInvalidHourMessage(), { ...buildAddHourKeyboard() });
      return true;
    }

    await setAddFlowStartHour(user.id, state.addFlowDate, startHour);
    await ctx.reply(buildAddAskStartMinuteMessage(state.addFlowDate, startHour), { ...buildAddMinuteKeyboard() });
    return true;
  }

  if (state.addFlowStep === "WAITING_START_MINUTE") {
    const startMinute = parseMinuteInput(text);
    if (startMinute === null || !state.addFlowDate || state.addFlowStartHour === null) {
      await ctx.reply(buildInvalidMinuteMessage(), { ...buildAddMinuteKeyboard() });
      return true;
    }

    const startTime = formatClock(state.addFlowStartHour, startMinute);
    await setAddFlowStartTime(user.id, state.addFlowDate, startTime);
    await ctx.reply(buildAddAskEndHourMessage(state.addFlowDate, startTime), { ...buildAddHourKeyboard() });
    return true;
  }

  if (state.addFlowStep === "WAITING_END_HOUR" || state.addFlowStep === "WAITING_END_TIME") {
    const endHour = parseHourInput(text);
    if (endHour === null || !state.addFlowDate || !state.addFlowStartTime) {
      await ctx.reply(buildInvalidHourMessage(), { ...buildAddHourKeyboard() });
      return true;
    }

    await setAddFlowEndHour(user.id, state.addFlowDate, state.addFlowStartTime, endHour);
    await ctx.reply(buildAddAskEndMinuteMessage(state.addFlowDate, endHour), { ...buildAddMinuteKeyboard() });
    return true;
  }

  if (state.addFlowStep === "WAITING_END_MINUTE") {
    const endMinute = parseMinuteInput(text);
    if (endMinute === null || !state.addFlowDate || !state.addFlowStartTime || state.addFlowEndHour === null) {
      await ctx.reply(buildInvalidMinuteMessage(), { ...buildAddMinuteKeyboard() });
      return true;
    }

    const endTime = formatClock(state.addFlowEndHour, endMinute);

    await saveStepwiseRange(
      ctx,
      user.id,
      state.addFlowDate,
      state.addFlowStartTime,
      endTime,
      timezoneName,
      true
    );
    return true;
  }

  if (state.addFlowStep === "WAITING_END_TIME") {
    const endTime = parseClockTimeInput(text);
    if (!endTime || !state.addFlowDate || !state.addFlowStartTime) {
      await ctx.reply(buildInvalidTimeMessage(), { ...buildAddDirectTimeKeyboard() });
      return true;
    }

    await saveStepwiseRange(
      ctx,
      user.id,
      state.addFlowDate,
      state.addFlowStartTime,
      endTime,
      timezoneName,
      false
    );
    return true;
  }

  return false;
}
