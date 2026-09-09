import { invoke } from '@tauri-apps/api/core';
import type { Prompt, SettingsPublic, Stats } from '../types';

export const api = {
  listPrompts: () => invoke<Prompt[]>('list_prompts'),
  createPrompt: (text: string) => invoke<Prompt>('create_prompt', { text }),
  updatePrompt: (id: number, text: string) => invoke<Prompt>('update_prompt', { id, text }),
  togglePrompt: (id: number) => invoke<Prompt>('toggle_prompt', { id }),
  deletePrompt: (id: number) => invoke<void>('delete_prompt', { id }),
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
