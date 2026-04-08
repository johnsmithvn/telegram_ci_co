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

export function buildAddModeKeyboard() {
  return Markup.keyboard([
    ["1. Nhap lien"],
    ["2. Tach gio/phut"]
  ])
    .resize(true)
    .oneTime(false)
    .persistent();
}

export function buildAddDirectTimeKeyboard() {
  return Markup.keyboard([
    [ATTENDANCE_LABEL],
    ["08:00", "08:30", "09:00", "09:30"],
    ["12:00", "13:00", "17:00", "17:30", "18:00"]
  ])
    .resize(true)
    .oneTime(false)
    .persistent();
}

export function buildAddHourKeyboard() {
  const rows: string[][] = [];
  const hours = Array.from({ length: 24 }, (_, index) => index.toString());

  for (let index = 0; index < hours.length; index += 6) {
    rows.push(hours.slice(index, index + 6));
  }

  return Markup.keyboard([[ATTENDANCE_LABEL], ...rows])
    .resize(true)
    .oneTime(false)
    .persistent();
}

export function buildAddMinuteKeyboard() {
  return Markup.keyboard([
    [ATTENDANCE_LABEL],
    ["00", "05", "10", "15"],
    ["20", "25", "30", "35"],
    ["40", "45", "50", "55"]
  ])
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
