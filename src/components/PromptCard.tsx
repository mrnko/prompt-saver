import { Check, Copy, Folder, Pencil, Trash2, Undo2 } from 'lucide-react';
import type { Prompt } from '../types';
import { formatDate, promptPreview, promptTitle } from '../lib/prompt';

interface Props { prompt: Prompt; onToggle: (prompt: Prompt) => void; onEdit: (prompt: Prompt) => void; onDelete: (prompt: Prompt) => void; onCopy: (prompt: Prompt) => void }
export function PromptCard({ prompt, onToggle, onEdit, onDelete, onCopy }: Props) {
  const completed = prompt.status === 'completed';
  return <article className={`prompt-card ${completed ? 'completed' : ''}`}>
    <button className="status-button" onClick={() => onToggle(prompt)} title={completed ? 'Позначити як звичайний' : 'Позначити як виконаний'}>{completed ? <Undo2 size={16}/> : <Check size={18}/>}</button>
    <div className="prompt-copy"><h3>{promptTitle(prompt.text)}</h3><p>{promptPreview(prompt.text)}</p><div className="prompt-meta">{prompt.projectName && <span className="project-chip"><Folder size={11}/>{prompt.projectName}</span>}<time>{completed ? `Виконано ${formatDate(prompt.completedAt!)}` : `Створено ${formatDate(prompt.createdAt)}`}</time></div></div>
    <div className="card-actions"><button className="icon-button" title="Скопіювати промпт" onClick={() => onCopy(prompt)}><Copy size={17}/></button><button className="icon-button" title="Редагувати" onClick={() => onEdit(prompt)}><Pencil size={17}/></button><button className="icon-button destructive" title="Видалити" onClick={() => onDelete(prompt)}><Trash2 size={17}/></button></div>
  </article>;
}
