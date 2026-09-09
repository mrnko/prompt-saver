export type PromptStatus = 'normal' | 'completed';

export interface Prompt {
  id: number;
  text: string;
  status: PromptStatus;
  projectId: number | null;
  projectName: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface Project { id: number; name: string; createdAt: string }

export interface PeriodStats { created: number; completed: number }
export interface DailyStats { date: string; created: number; completed: number }
export interface ProjectTaskStats { projectId: number | null; name: string; total: number; normal: number; completed: number }
export interface Stats {
  today: PeriodStats;
  yesterday: PeriodStats;
  week: PeriodStats;
  month: PeriodStats;
  daily: DailyStats[];
  projectTasks: ProjectTaskStats[];
}

export interface SettingsPublic { model: string; hasApiKey: boolean }
