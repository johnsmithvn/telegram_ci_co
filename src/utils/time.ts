import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import isoWeek from "dayjs/plugin/isoWeek";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);
dayjs.extend(customParseFormat);

export const WEEKLY_TARGET_MINUTES = 44 * 60;
export const KPI_WARNING_THRESHOLD_MINUTES = 43 * 60 + 50;

export function getNowInTimezone(timezoneName: string): dayjs.Dayjs {
  return dayjs().tz(timezoneName);
}

export function getLocalDateString(date: Date, timezoneName: string): string {
  return dayjs(date).tz(timezoneName).format("YYYY-MM-DD");
}

export function getWeekBounds(date: Date, timezoneName: string): { start: Date; end: Date } {
  const local = dayjs(date).tz(timezoneName);
  const start = local.startOf("isoWeek");
  const end = local.endOf("isoWeek");
  return { start: start.toDate(), end: end.toDate() };
}

export function getWeekStartDateString(date: Date, timezoneName: string): string {
  return dayjs(date).tz(timezoneName).startOf("isoWeek").format("YYYY-MM-DD");
}

export function getMonthBounds(date: Date, timezoneName: string): { start: Date; end: Date } {
  const local = dayjs(date).tz(timezoneName);
  return {
    start: local.startOf("month").toDate(),
    end: local.endOf("month").toDate()
  };
}

export function formatClock(date: Date, timezoneName: string): string {
  return dayjs(date).tz(timezoneName).format("HH:mm");
}

export function formatDateShort(date: Date, timezoneName: string): string {
  return dayjs(date).tz(timezoneName).format("DD/MM");
}

export function formatMonthLabel(date: Date, timezoneName: string): string {
  return dayjs(date).tz(timezoneName).format("MMMM YYYY");
}

export function formatMinutes(totalMinutes: number): string {
  const isNegative = totalMinutes < 0;
  const absMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  const formatted = `${hours}h${minutes.toString().padStart(2, "0")}m`;
  return isNegative ? `-${formatted}` : formatted;
}

export function parseHoursInput(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0 || value > 24) {
    return null;
  }
  return value;
}

export function parseDateInput(raw: string, timezoneName: string, referenceDate: Date = new Date()): string | null {
  const value = raw.trim();
  const formats = ["YYYY-MM-DD", "DD-MM-YYYY", "DD/MM/YYYY", "DD-MM", "DD/MM"];

  for (const format of formats) {
    const parsed = dayjs(value, format, true);
    if (!parsed.isValid()) {
      continue;
    }
    const zoned = parsed.tz(timezoneName, true);

    if (format === "DD-MM" || format === "DD/MM") {
      const now = dayjs(referenceDate).tz(timezoneName);
      let dated = zoned.year(now.year());
      if (dated.isAfter(now.add(1, "day"))) {
        dated = dated.subtract(1, "year");
      }
      return dated.format("YYYY-MM-DD");
    }

    return zoned.format("YYYY-MM-DD");
  }

  return null;
}

export function getWeekdayNameVi(date: Date, timezoneName: string): string {
  const weekday = dayjs(date).tz(timezoneName).isoWeekday();
  const map: Record<number, string> = {
    1: "Thu Hai",
    2: "Thu Ba",
    3: "Thu Tu",
    4: "Thu Nam",
    5: "Thu Sau",
    6: "Thu Bay",
    7: "Chu Nhat"
  };
  return map[weekday] ?? "Hom nay";
}

export function getWeekdaysLeftForBurndown(date: Date, timezoneName: string): number {
  const weekday = dayjs(date).tz(timezoneName).isoWeekday();
  if (weekday >= 5) {
    return 1;
  }
  return 5 - weekday;
}

export function isMonthEnd(date: Date, timezoneName: string): boolean {
  const local = dayjs(date).tz(timezoneName);
  return local.isSame(local.endOf("month"), "day");
}

export function buildProgressBar(workedMinutes: number, targetMinutes: number, width = 16): string {
  if (targetMinutes <= 0) {
    return "[----------------]";
  }
  const ratio = Math.max(0, Math.min(1, workedMinutes / targetMinutes));
  const done = Math.round(ratio * width);
  return `[${"#".repeat(done)}${"-".repeat(Math.max(0, width - done))}]`;
}

export function getWeekdayKey(date: Date, timezoneName: string): string {
  return dayjs(date).tz(timezoneName).format("ddd");
}

export function toDateOnly(date: Date, timezoneName: string): string {
  return dayjs(date).tz(timezoneName).format("YYYY-MM-DD");
}

export interface AddFlowDayChoice {
  key: "T2" | "T3" | "T4" | "T5" | "T6" | "T7";
  date: string;
  label: string;
}

export function getAddFlowDayChoices(
  timezoneName: string,
  referenceDate: Date = new Date()
): AddFlowDayChoice[] {
  const keys: AddFlowDayChoice["key"][] = ["T2", "T3", "T4", "T5", "T6", "T7"];
  const weekStart = dayjs(referenceDate).tz(timezoneName).startOf("isoWeek");

  return keys.map((key, index) => {
    const day = weekStart.add(index, "day");
    const date = day.format("YYYY-MM-DD");
    return {
      key,
      date,
      label: `${key} ${day.format("DD-MM")} (${date})`
    };
  });
}

export function parseAddFlowDateFromChoice(text: string): string | null {
  const match = text.trim().match(/(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}
