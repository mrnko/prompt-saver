import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PromptCard } from './PromptCard';

const prompt = { id: 1, text: 'Створити форму\nз валідацією', status: 'normal' as const, createdAt: '2026-01-01T12:00:00Z', updatedAt: '2026-01-01T12:00:00Z', completedAt: null };
describe('PromptCard', () => {
  it('calls status handler when the check button is clicked', () => {
    const onToggle = vi.fn();
    render(<PromptCard prompt={prompt} onToggle={onToggle} onEdit={vi.fn()} onDelete={vi.fn()}/>);
    fireEvent.click(screen.getByTitle('Позначити як виконаний'));
    expect(onToggle).toHaveBeenCalledWith(prompt);
  });
});
