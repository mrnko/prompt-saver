import { describe, expect, it } from 'vitest';
import { promptComplexity, promptTitle, splitPrompts } from './prompt';

describe('prompt presentation', () => {
  it('uses the first non-empty line as a title', () => {
    expect(promptTitle('\n  Зробити форму авторизації\nдеталі')).toBe('Зробити форму авторизації');
  });

  it('splits ordinary and completed prompts', () => {
    const prompts = [
      { id: 1, text: 'A', status: 'normal' as const, projectId: null, projectName: null, createdAt: '', updatedAt: '', completedAt: null },
      { id: 2, text: 'B', status: 'completed' as const, projectId: null, projectName: null, createdAt: '', updatedAt: '', completedAt: '' }
    ];
    expect(splitPrompts(prompts)).toMatchObject({ active: [{ id: 1 }], completed: [{ id: 2 }] });
  });

  it('assigns a complexity level from the prompt volume', () => {
    expect(promptComplexity('Коротко').tone).toBe('easy');
    expect(promptComplexity('a'.repeat(400)).tone).toBe('medium');
    expect(promptComplexity('a'.repeat(1200)).tone).toBe('complex');
  });
});
