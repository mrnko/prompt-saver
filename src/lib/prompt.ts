import type { Prompt } from '../types';

export function promptTitle(text: string) {
  return text.split('\n').find((line) => line.trim())?.trim() || 'Без назви';
}

export function promptPreview(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

export function promptComplexity(text: string) {
  const length = text.trim().length;
  if (length <= 260) return { label: 'Короткий промпт', tone: 'easy', percent: Math.max(12, Math.round((length / 260) * 33)) };
  if (length <= 800) return { label: 'Середній промпт', tone: 'medium', percent: 34 + Math.round(((length - 260) / 540) * 32) };
  return { label: 'Детальний промпт', tone: 'complex', percent: Math.min(100, 67 + Math.round(((length - 800) / 1200) * 33)) };
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
