import { WeeklySummary } from "../types/domain";
import { buildProgressBar, formatClock, formatDateShort, formatMinutes, getWeekdayNameVi } from "../utils/time";

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
  workedMinutes: number;
  targetMinutes: number;
  remainingMinutes: number;
  daysLeft: number;
  requiredMinutesPerDay: number;
  timezoneName: string;
}): string {
  const dayName = getWeekdayNameVi(input.now, input.timezoneName);
  const remaining = formatMinutes(Math.max(0, input.remainingMinutes));
  const required = formatMinutes(Math.max(0, input.requiredMinutesPerDay));
  const daysLeftText = input.daysLeft === 1 ? "1 ngay lam viec" : `${input.daysLeft} ngay lam viec`;
  const progressBar = buildProgressBar(input.workedMinutes, input.targetMinutes);

  return [
    "Bao cao tinh hinh luc 17:30!",
    `Hom nay la ${dayName}, ban hien dang no KPI ${remaining}.`,
    `${progressBar} ${formatMinutes(input.workedMinutes)} / ${formatMinutes(input.targetMinutes)}`,
    `Chien thuat cay bu: tu gio den het tuan con ${daysLeftText}, moi ngay can ${required}.`,
    "Dung de don cuoi tuan roi cay hoc mau."
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
  return `Đã ghi nhận ${hours} tiếng cho ngày ${workDate}. Dùng \`/week ${workDate}\` để xem đúng tuần.`;
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

export function buildWeekInvalidDateMessage(): string {
  return "Ngay khong hop le. Dung `/week` hoac `/week YYYY-MM-DD`.";
}

export function buildInvalidHoursMessage(): string {
  return "Giờ chưa hợp lệ. Nhập số từ 0 đến 24, ví dụ `8` hoặc `8.5`.";
}

export function buildManualNoPendingMessage(): string {
  return "Hiện không có phiên mở nào để nhập giờ thủ công.";
}

export function buildUnknownTextMessage(): string {
  return "Minh chua hieu tin nhan nay. Bam nut Check-in/Check-out hoac go `/help`.";
}

export function buildHelpMessage(): string {
  return [
    "Bạn chỉ cần bấm nút bên dưới:",
    "🟢 Check-in",
    "🔴 Check-out",
    "",
    "Bao cao nhanh:",
    "`/today` | `/week` | `/week YYYY-MM-DD` | `/month`",
    "",
    "Lenh them gio thu cong:",
    "`/add` (nhap tung buoc) hoac `/add YYYY-MM-DD 8.5`",
    "",
    "Dung bot cho chinh ban:",
    "`/stop CONFIRM`",
    "",
    "Admin reset toan bo du lieu:",
    "`/resetall CONFIRM`"
  ].join("\n");
}

export function buildTodayReportMessage(todayMinutes: number): string {
  const lines = [`Hom nay: ${formatMinutes(todayMinutes)}.`];
  if (todayMinutes >= 10 * 60) {
    lines.push("Canh bao: hom nay ban da lam > 10h. Nghi mot chut nhe.");
  }
  return lines.join("\n");
}

export function buildWeekReportMessage(input: {
  days: Array<{ label: string; totalMinutes: number }>;
  workedMinutes: number;
  targetMinutes: number;
  remainingMinutes: number;
  weekStartDate?: string;
  weekEndDate?: string;
}): string {
  const progressBar = buildProgressBar(input.workedMinutes, input.targetMinutes);
  const dayLines = input.days.map((item) => `${item.label}: ${formatMinutes(item.totalMinutes)}`);
  const remaining =
    input.remainingMinutes > 0
      ? `Con thieu: ${formatMinutes(input.remainingMinutes)}`
      : `Da vuot: ${formatMinutes(Math.abs(input.remainingMinutes))}`;
  const title =
    input.weekStartDate && input.weekEndDate
      ? `Weekly Report (${input.weekStartDate} -> ${input.weekEndDate})`
      : "Weekly Report";

  return [
    title,
    "",
    ...dayLines,
    "",
    `${progressBar} ${formatMinutes(input.workedMinutes)} / ${formatMinutes(input.targetMinutes)}`,
    remaining
  ].join("\n");
}

export function buildMonthReportMessage(input: {
  monthLabel: string;
  totalMinutes: number;
  averageMinutesPerWorkedDay: number;
  workedDays: number;
  weeks: Array<{ weekStartDate: string; totalMinutes: number }>;
}): string {
  const weekLines =
    input.weeks.length > 0
      ? input.weeks.map(
          (item, index) =>
            `Week ${index + 1} (${item.weekStartDate}): ${formatMinutes(item.totalMinutes)}`
        )
      : ["Chua co du lieu thang nay."];

  return [
    `Monthly Report - ${input.monthLabel}`,
    "",
    `Total hours: ${formatMinutes(input.totalMinutes)}`,
    `Average/day: ${
      input.workedDays > 0 ? formatMinutes(input.averageMinutesPerWorkedDay) : "0h00m"
    } (tren ${input.workedDays} ngay co log)`,
    "",
    ...weekLines
  ].join("\n");
}

export function buildWeeklySchedulerMessage(input: {
  days: Array<{ label: string; totalMinutes: number }>;
  workedMinutes: number;
  targetMinutes: number;
  remainingMinutes: number;
}): string {
  return ["Weekly summary cuoi tuan:", buildWeekReportMessage(input)].join("\n\n");
}

export function buildMonthlySchedulerMessage(input: {
  monthLabel: string;
  totalMinutes: number;
  averageMinutesPerWorkedDay: number;
  workedDays: number;
  weeks: Array<{ weekStartDate: string; totalMinutes: number }>;
}): string {
  return ["Tong ket cuoi thang:", buildMonthReportMessage(input)].join("\n\n");
}

export function buildResetDeniedMessage(): string {
  return "Ban khong co quyen chay lenh reset.";
}

export function buildResetConfirmMessage(): string {
  return "Lenh nay rat nguy hiem. Dung `/resetall CONFIRM` de xoa toan bo du lieu.";
}

export function buildResetSuccessMessage(): string {
  return "Da xoa toan bo du lieu tracking. Bot reset ve trang thai moi.";
}

export function buildStopConfirmMessage(): string {
  return "Lenh nay se xoa toan bo du lieu cua ban va dung bot cho tai khoan nay. Dung `/stop CONFIRM` de tiep tuc.";
}

export function buildStopSuccessMessage(deletedSessions: number): string {
  return [
    "Da dung bot cho tai khoan nay.",
    `Da xoa ${deletedSessions} session cua ban.`,
    "Neu muon dung lai, gui `/start`."
  ].join("\n");
}

export function buildAlreadyStoppedMessage(): string {
  return "Tai khoan nay dang o trang thai da stop. Gui `/start` de bat lai.";
}
