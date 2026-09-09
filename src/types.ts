export type PromptStatus = 'normal' | 'completed';

export interface Prompt {
  id: number;
  text: string;
  status: PromptStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface PeriodStats { created: number; completed: number }
export interface DailyStats { date: string; created: number; completed: number }
export interface Stats {
  today: PeriodStats;
  yesterday: PeriodStats;
  week: PeriodStats;
  month: PeriodStats;
  daily: DailyStats[];
}

export interface SettingsPublic { model: string; hasApiKey: boolean }
