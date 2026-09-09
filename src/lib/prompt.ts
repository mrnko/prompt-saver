import type { Prompt } from '../types';

export function promptTitle(text: string) {
  return text.split('\n').find((line) => line.trim())?.trim() || 'Без назви';
}

export function promptPreview(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function splitPrompts(prompts: Prompt[]) {
  return {
    active: prompts.filter((prompt) => prompt.status === 'normal'),
    completed: prompts.filter((prompt) => prompt.status === 'completed')
  };
}
