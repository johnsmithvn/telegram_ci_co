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
    `Đã ghi nhận checkout lúc ${formatClock(input.checkoutTime, input.timezoneName)}.`,
    "",
    `Ca này làm được ${formatMinutes(input.sessionMinutes)} (đã trừ 1h nghỉ trưa).`,
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
  const daysLeftText = input.daysLeft === 1 ? "1 ngày làm việc" : `${input.daysLeft} ngày làm việc`;
  const progressBar = buildProgressBar(input.workedMinutes, input.targetMinutes);

  let strategyText = "";
  let closingText = "";

  if (input.remainingMinutes <= 0) {
    return [
      "Báo cáo tình hình lúc 17:30!",
      `Hôm nay là ${dayName}, bạn đã hoàn thành đủ KPI tuần này!`,
      `${progressBar} ${formatMinutes(input.workedMinutes)} / ${formatMinutes(input.targetMinutes)}`,
      "Quy định là không cần làm nữa, về nghỉ ngơi thôi nghen 🎉"
    ].join("\n");
  } else if (input.requiredMinutesPerDay <= 480) {
    strategyText = `Chúc mừng bạn không cần phải OT triền miên! Từ giờ đến cuối tuần còn ${daysLeftText}, chỉ cần làm mỗi ngày ${required} (dưới 8 tiếng) để đủ chỉ tiêu.`;
    closingText = "Chill chill về nhà đúng giờ nào 😎";
  } else {
    strategyText = `Chiến thuật cày bù: từ giờ đến hết tuần còn ${daysLeftText}, mỗi ngày cần cày ${required} để kịp đội.`;
    closingText = "Đừng để dồn cuối tuần rồi cày hộc máu. 🥲";
  }

  return [
    "Báo cáo tình hình lúc 17:30!",
    `Hôm nay là ${dayName}, bạn hiện đang nợ KPI ${remaining}.`,
    `${progressBar} ${formatMinutes(input.workedMinutes)} / ${formatMinutes(input.targetMinutes)}`,
    strategyText,
    closingText
  ].join("\n");
}

export function buildKpiWarningMessage(workedMinutes: number): string {
  return [
    "🚨 Ê báo động!",
    `Sắp đủ 44 tiếng rồi (hiện tại ${formatMinutes(workedMinutes)}).`,
    "Tắt máy, dọn đồ, chuẩn bị đi về thôi."
  ].join("\n");
}

export function buildTargetMetMessage(workedMinutes: number): string {
  return [
    "🎉 Chúc mừng! Đã đủ 44 tiếng rồi!",
    `Tổng tuần này: ${formatMinutes(workedMinutes)}.`,
    "Tắt máy, về nhà, nghỉ ngơi thôi nào!"
  ].join("\n");
}

export function buildForgotCheckoutPrompt(): string {
  return [
    "Ê, quên check-out hay đang OT xuyên đêm đấy?",
    "Reply số giờ thực tế (ví dụ: 8 hoặc 8.5) để mình cộng vào."
  ].join("\n");
}

export function buildAutoCheckoutAtEndOfDayMessage(workDate: string, workedMinutes: number): string {
  return [
    `Đến 23:59 ngày ${workDate} nên mình tự check-out giúp bạn.`,
    `Tổng ca được tính: ${formatMinutes(workedMinutes)}.`
  ].join("\n");
}

export function buildManualHoursClosedMessage(hours: number): string {
  return `Đã ghi nhận ${hours} tiếng cho phiên đang mở và đóng ca giúp bạn.`;
}

export function buildManualPastDayAddedMessage(workDate: string, hours: number): string {
  return `Đã ghi nhận ${hours} tiếng cho ngày ${workDate}. Dùng \`/week ${workDate}\` để xem đúng tuần.`;
}

export function buildAddAskDateMessage(): string {
  return "Chọn ngày cần add bằng nút T2 -> T7 bên dưới (hoặc nhập YYYY-MM-DD).";
}

export function buildAddAskModeMessage(workDate: string): string {
  return [
    `Ok, ngày ${workDate}.`,
    "Chọn 1 trong 2 mode:",
    "1. Nhập liền 2 mốc giờ",
    "2. Nhập tách giờ/phút vào rồi giờ/phút ra"
  ].join("\n");
}

export function buildAddAskDirectTimeMessage(workDate: string): string {
  return [
    `Nhập liền cho ngày ${workDate}.`,
    "Ví dụ: 08:30 17:45",
    "Hoặc: 830 1745"
  ].join("\n");
}

export function buildAddAskStartHourMessage(workDate: string): string {
  return `Ngày ${workDate}. Nhập giờ vào trước (0-23), ví dụ 8 hoặc bấm số.`;
}

export function buildAddAskStartMinuteMessage(workDate: string, startHour: number): string {
  return `Ngày ${workDate}, đã nhận giờ vào ${startHour}. Giờ vào phút nào? (0-59, ví dụ 30)`;
}

export function buildAddAskEndHourMessage(workDate: string, startTime: string): string {
  return `Đã nhận giờ vào ${startTime} cho ngày ${workDate}. Nhập giờ ra trước (0-23).`;
}

export function buildAddAskEndMinuteMessage(workDate: string, endHour: number): string {
  return `Ngày ${workDate}, đã nhận giờ ra ${endHour}. Giờ ra phút nào? (0-59, ví dụ 45)`;
}

export function buildInvalidDateMessage(): string {
  return "Ngày chưa hợp lệ. Bấm nút T2 -> T7 hoặc nhập YYYY-MM-DD.";
}

export function buildWeekInvalidDateMessage(): string {
  return "Ngày không hợp lệ. Dùng `/week` hoặc `/week YYYY-MM-DD`.";
}

export function buildInvalidHoursMessage(): string {
  return "Giờ chưa hợp lệ. Nhập số từ 0 đến 24, ví dụ `8` hoặc `8.5`.";
}

export function buildInvalidTimeMessage(): string {
  return "Giờ chưa hợp lệ. Dùng 8, 8h, 830 hoặc 08:30.";
}

export function buildInvalidHourMessage(): string {
  return "Giờ chưa hợp lệ. Nhập số từ 0 đến 23, ví dụ 8.";
}

export function buildInvalidMinuteMessage(): string {
  return "Phút chưa hợp lệ. Nhập số từ 0 đến 59, ví dụ 30.";
}

export function buildManualNoPendingMessage(): string {
  return "Hiện không có phiên mở nào để nhập giờ thủ công.";
}

export function buildDeleteAskDateMessage(): string {
  return [
    "Chọn ngày muốn xóa bằng nút T2 -> T7 bên dưới (hoặc nhập YYYY-MM-DD).",
    "Hành động này sẽ xóa toàn bộ log của riêng ngày đó."
  ].join("\n");
}

export function buildDeleteSuccessMessage(workDate: string, deletedSessions: number): string {
  return `Đã xóa ${deletedSessions} session của ngày ${workDate}.`;
}

export function buildDeleteNothingMessage(workDate: string): string {
  return `Không có dữ liệu nào để xóa cho ngày ${workDate}.`;
}

export function buildManualPastDayAddedByTimeMessage(
  workDate: string,
  startTime: string,
  endTime: string,
  totalMinutes: number
): string {
  return `Đã ghi nhận ngày ${workDate}: ${startTime} -> ${endTime} (${formatMinutes(totalMinutes)}).`;
}

export function buildUnknownTextMessage(): string {
  return "Mình chưa hiểu tin nhắn này. Bấm nút Chấm công hoặc gõ `/help`.";
}

export function buildHelpMessage(): string {
  return [
    "Bạn chỉ cần bấm nút bên dưới:",
    "📋 Chấm công (lần đầu = Check-in, các lần sau = cập nhật Check-out)",
    "",
    "Báo cáo nhanh:",
    "`/today` | `/week` | `/week YYYY-MM-DD` | `/month`",
    "",
    "Lệnh thêm giờ thủ công:",
    "`/add` (chọn T2-T7 rồi chọn mode) hoặc `/add YYYY-MM-DD 8 1730`",
    "Xóa riêng 1 ngày:",
    "`/del` hoặc `/delete` (chọn T2-T7 rồi xóa toàn bộ log ngày đó)",
    "",
    "Dừng bot cho chính bạn:",
    "`/stop` (bot sẽ hỏi Yes/No)",
    "",
    "Admin reset toàn bộ dữ liệu:",
    "`/resetall CONFIRM`"
  ].join("\n");
}

export function buildTodayReportMessage(todayMinutes: number): string {
  const lines = [`Hôm nay: ${formatMinutes(todayMinutes)}.`];
  if (todayMinutes >= 10 * 60) {
    lines.push("Cảnh báo: hôm nay bạn đã làm > 10h. Nghỉ một chút nhé.");
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
      ? `Còn thiếu: ${formatMinutes(input.remainingMinutes)}`
      : `Đã vượt: ${formatMinutes(Math.abs(input.remainingMinutes))}`;
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
      : ["Chưa có dữ liệu tháng này."];

  return [
    `Monthly Report - ${input.monthLabel}`,
    "",
    `Total hours: ${formatMinutes(input.totalMinutes)}`,
    `Average/day: ${
      input.workedDays > 0 ? formatMinutes(input.averageMinutesPerWorkedDay) : "0h00m"
    } (trên ${input.workedDays} ngày có log)`,
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
  return ["Tổng kết cuối tuần:", buildWeekReportMessage(input)].join("\n\n");
}

export function buildMonthlySchedulerMessage(input: {
  monthLabel: string;
  totalMinutes: number;
  averageMinutesPerWorkedDay: number;
  workedDays: number;
  weeks: Array<{ weekStartDate: string; totalMinutes: number }>;
}): string {
  return ["Tổng kết cuối tháng:", buildMonthReportMessage(input)].join("\n\n");
}

export function buildResetDeniedMessage(): string {
  return "Bạn không có quyền chạy lệnh reset.";
}

export function buildResetConfirmMessage(): string {
  return "Lệnh này rất nguy hiểm. Dùng `/resetall CONFIRM` để xóa toàn bộ dữ liệu.";
}

export function buildResetSuccessMessage(): string {
  return "Đã xóa toàn bộ dữ liệu tracking. Bot reset về trạng thái mới.";
}

export function buildStopConfirmMessage(): string {
  return "Bạn chắc chắn muốn stop? Dữ liệu của bạn sẽ bị xóa. Bấm Yes/No bên dưới.";
}

export function buildStopCancelledMessage(): string {
  return "Đã hủy stop. Bạn tiếp tục dùng bot bình thường.";
}

export function buildStopSuccessMessage(deletedSessions: number): string {
  return [
    "Đã dừng bot cho tài khoản này.",
    `Đã xóa ${deletedSessions} session của bạn.`,
    "Nếu muốn dùng lại, gửi `/start`."
  ].join("\n");
}

export function buildAlreadyStoppedMessage(): string {
  return "Tài khoản này đang ở trạng thái đã stop. Gửi `/start` để bật lại.";
}
