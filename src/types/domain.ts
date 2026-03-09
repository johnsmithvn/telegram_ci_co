export type UserStatus = "idle" | "working";
export type WorkSessionStatus = "OPEN" | "CLOSED";
export type WorkSessionSource = "normal" | "manual" | "auto";
export type AddFlowStep = "NONE" | "WAITING_DATE" | "WAITING_HOURS";

export interface User {
  id: string;
  telegramId: string;
  chatId: string;
  name: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface WorkSession {
  id: string;
  userId: string;
  startTime: Date;
  endTime: Date | null;
  durationMinutes: number | null;
  workDate: string;
  source: WorkSessionSource;
  status: WorkSessionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserState {
  userId: string;
  status: UserStatus;
  lastKpiWarningWeekStart: string | null;
  lastForgotCheckoutPromptDate: string | null;
  manualEntryPendingSessionId: string | null;
  manualEntryPendingDate: string | null;
  addFlowStep: AddFlowStep;
  addFlowDate: string | null;
  updatedAt: Date;
}

export interface WeeklySummary {
  workedMinutes: number;
  remainingMinutes: number;
  targetMinutes: number;
}
