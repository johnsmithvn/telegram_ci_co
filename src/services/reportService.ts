import { WeeklySummary } from "../types/domain";
import { formatClock, formatDateShort, formatMinutes, getWeekdayNameVi } from "../utils/time";

export function buildCheckInSuccessMessage(startTime: Date, timezoneName: string): string {
  return [
    "Lên đồ!",
    `Đã ghi nhận bắt đầu làm việc lúc ${formatClock(startTime, timezoneName)} nhé.`,
    "Chúc một ngày năng suất!"
  ].join("\n");
}

export function buildAlreadyCheckedInMessage(startTime: Date, timezoneName: string): string {
  return `Bạn đang check-in rồi nha (từ ${formatClock(startTime, timezoneName)}).`;
}

export function buildNoOpenSessionMessage(): string {
  return "Bạn chưa check-in nên chưa check-out được.";
}

export function buildCheckOutMessage(input: {
  checkoutTime: Date;
  sessionMinutes: number;
  todayWorkedMinutes: number;
  summary: WeeklySummary;
  timezoneName: string;
}): string {
  const remaining = input.summary.remainingMinutes;
  const debtLine =
    remaining > 0
      ? `Cố lên, còn nợ: ${formatMinutes(remaining)} nữa là tự do!`
      : `Quá dữ! Bạn đã vượt KPI ${formatMinutes(Math.abs(remaining))}.`;

  return [
    "Xong phim!",
    "",
    `Ca này bác cày được ${formatMinutes(input.sessionMinutes)}.`,
    "",
    `📊 Tổng kết ngày hôm nay (${formatDateShort(input.checkoutTime, input.timezoneName)}):`,
    `- Đã cày được: ${formatMinutes(input.todayWorkedMinutes)} / 44h.`,
    `- Tuần này: ${formatMinutes(input.summary.workedMinutes)} / 44h.`,
    `- ${debtLine}`
  ].join("\n");
}

export function buildBurnDownReport(input: {
  now: Date;
  remainingMinutes: number;
  daysLeft: number;
  requiredMinutesPerDay: number;
  timezoneName: string;
}): string {
  const dayName = getWeekdayNameVi(input.now, input.timezoneName);
  const remaining = formatMinutes(Math.max(0, input.remainingMinutes));
  const required = formatMinutes(Math.max(0, input.requiredMinutesPerDay));
  const daysLeftText = input.daysLeft === 1 ? "1 ngày làm việc" : `${input.daysLeft} ngày làm việc`;

  return [
    "Báo cáo tình hình lúc 17:30!",
    `Hôm nay là ${dayName}, bạn hiện đang nợ KPI ${remaining}.`,
    `💡 Chiến thuật cày bù: từ giờ đến hết tuần còn ${daysLeftText}, mỗi ngày cần ${required}.`,
    "Đừng để dồn cuối tuần rồi cày hộc máu."
  ].join("\n");
}

export function buildKpiWarningMessage(workedMinutes: number): string {
  return [
    "🚨 Ê báo động!",
    `Sắp đủ 44 tiếng rồi (hiện tại ${formatMinutes(workedMinutes)}).`,
    "Tắt máy, dọn đồ, chuẩn bị đi về thôi."
  ].join("\n");
}

export function buildForgotCheckoutPrompt(): string {
  return [
    "Ê, quên check-out hay đang OT xuyên đêm đấy?",
    "Reply số giờ thực tế (ví dụ: 8 hoặc 8.5) để mình cộng vào."
  ].join("\n");
}

export function buildManualHoursClosedMessage(hours: number): string {
  return `Đã ghi nhận ${hours} tiếng cho phiên đang mở và đóng ca giúp bạn.`;
}

export function buildManualPastDayAddedMessage(workDate: string, hours: number): string {
  return `Đã ghi nhận ${hours} tiếng cho ngày ${workDate}.`;
}

export function buildAddAskDateMessage(): string {
  return "Ngày nào? Gửi theo dạng `DD-MM` hoặc `YYYY-MM-DD`.";
}

export function buildAddAskHoursMessage(workDate: string): string {
  return `Ok, ngày ${workDate}. Làm bao nhiêu tiếng? (ví dụ 8 hoặc 7.5)`;
}

export function buildInvalidDateMessage(): string {
  return "Mình chưa hiểu ngày này. Dùng `DD-MM` hoặc `YYYY-MM-DD` nhé.";
}

export function buildInvalidHoursMessage(): string {
  return "Giờ chưa hợp lệ. Nhập số từ 0 đến 24, ví dụ `8` hoặc `8.5`.";
}

export function buildManualNoPendingMessage(): string {
  return "Hiện không có phiên mở nào để nhập giờ thủ công.";
}

export function buildHelpMessage(): string {
  return [
    "Bạn chỉ cần bấm nút bên dưới:",
    "🟢 Check-in",
    "🔴 Check-out",
    "",
    "Lệnh thêm giờ thủ công:",
    "`/add` (nhập từng bước) hoặc `/add YYYY-MM-DD 8.5`"
  ].join("\n");
}

