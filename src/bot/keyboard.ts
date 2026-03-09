import { Markup } from "telegraf";

export const CHECKIN_LABEL = "🟢 Check-in";
export const CHECKOUT_LABEL = "🔴 Check-out";

export function buildMainKeyboard() {
  return Markup.keyboard([[CHECKIN_LABEL, CHECKOUT_LABEL]])
    .resize(true)
    .oneTime(false)
    .persistent();
}

