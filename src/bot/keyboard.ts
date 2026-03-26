import { Markup } from "telegraf";
import { AddFlowDayChoice } from "../utils/time";

export const ATTENDANCE_LABEL = "📋 Chấm công";
export const STOP_CONFIRM_YES_CALLBACK = "stop_yes";
export const STOP_CONFIRM_NO_CALLBACK = "stop_no";

export function buildMainKeyboard() {
  return Markup.keyboard([[ATTENDANCE_LABEL]])
    .resize(true)
    .oneTime(false)
    .persistent();
}

export function buildAddDayKeyboard(choices: AddFlowDayChoice[]) {
  const dayRows: string[][] = [];
  const labels = choices.map((item) => item.label);

  for (let index = 0; index < labels.length; index += 2) {
    dayRows.push(labels.slice(index, index + 2));
  }

  return Markup.keyboard([[ATTENDANCE_LABEL], ...dayRows])
    .resize(true)
    .oneTime(false)
    .persistent();
}

export function buildStopConfirmInlineKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Yes", STOP_CONFIRM_YES_CALLBACK),
      Markup.button.callback("No", STOP_CONFIRM_NO_CALLBACK)
    ]
  ]);
}
