import { invoke } from '@tauri-apps/api/core';
import type { Project, Prompt, SettingsPublic, Stats } from '../types';

export const api = {
  listPrompts: () => invoke<Prompt[]>('list_prompts'),
  createPrompt: (text: string, projectId: number | null) => invoke<Prompt>('create_prompt', { text, projectId }),
  updatePrompt: (id: number, text: string, projectId: number | null) => invoke<Prompt>('update_prompt', { id, text, projectId }),
  togglePrompt: (id: number) => invoke<Prompt>('toggle_prompt', { id }),
  deletePrompt: (id: number) => invoke<void>('delete_prompt', { id }),
  copyPrompt: (text: string) => invoke<void>('copy_prompt_to_clipboard', { text }),
  listProjects: () => invoke<Project[]>('list_projects'),
  createProject: (name: string) => invoke<Project>('create_project', { name }),
  getDraft: () => invoke<string>('get_draft'),
  saveDraft: (text: string) => invoke<void>('save_draft', { text }),
  clearDraft: () => invoke<void>('clear_draft'),
  getSettings: () => invoke<SettingsPublic>('get_settings'),
  saveSettings: (model: string, apiKey?: string) => invoke<SettingsPublic>('save_settings', { model, apiKey: apiKey || null }),
  clearApiKey: () => invoke<void>('clear_api_key'),
  improvePrompt: (text: string) => invoke<string>('improve_prompt', { text }),
  transcribeAudio: (audioBase64: string, mimeType: string) => invoke<string>('transcribe_audio', { audioBase64, mimeType }),
  getStats: () => invoke<Stats>('get_stats')
};
