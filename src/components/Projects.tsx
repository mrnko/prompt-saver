import { FolderPlus, Plus } from 'lucide-react';
import { useState } from 'react';
import type { Project, Prompt } from '../types';
import { PromptCard } from './PromptCard';

interface Props {
  projects: Project[];
  prompts: Prompt[];
  onCreate: (name: string) => Promise<void>;
  onToggle: (prompt: Prompt) => void;
  onEdit: (prompt: Prompt) => void;
  onDelete: (prompt: Prompt) => void;
  onCopy: (prompt: Prompt) => void;
}

function PromptGroup({ name, prompts, onToggle, onEdit, onDelete, onCopy }: Omit<Props, 'projects' | 'onCreate'> & { name: string }) {
  const active = prompts.filter((prompt) => prompt.status === 'normal');
  const completed = prompts.filter((prompt) => prompt.status === 'completed');
  return <section className="project-group"><div className="project-group-heading"><div><h2>{name}</h2><span>{prompts.length} тасків</span></div></div><div className="project-columns"><div><h3>Активні <span>{active.length}</span></h3>{active.length ? active.map((prompt) => <PromptCard key={prompt.id} prompt={prompt} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} onCopy={onCopy}/>) : <p className="group-empty">Немає активних промптів</p>}</div><div><h3>Виконані <span>{completed.length}</span></h3>{completed.length ? completed.map((prompt) => <PromptCard key={prompt.id} prompt={prompt} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} onCopy={onCopy}/>) : <p className="group-empty">Немає виконаних промптів</p>}</div></div></section>;
}

export function Projects({ projects, prompts, onCreate, onToggle, onEdit, onDelete, onCopy }: Props) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const create = async () => { if (!name.trim()) return; setSaving(true); try { await onCreate(name); setName(''); } finally { setSaving(false); } };
  const general = prompts.filter((prompt) => prompt.projectId === null);
  return <><section className="project-creator card"><div><p className="eyebrow">НОВИЙ ПРОЄКТ</p><h2>Створити проєкт</h2><p>Об’єднайте пов’язані промпти в одному місці.</p></div><div className="project-create-form"><input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void create()} placeholder="Наприклад, Landing page" maxLength={120}/><button className="primary-button" disabled={!name.trim() || saving} onClick={create}><Plus size={17}/>{saving ? 'Створюємо…' : 'Створити'}</button></div></section><div className="project-page-heading"><FolderPlus size={21}/><div><p className="eyebrow">СТРУКТУРА</p><h1>Проєкти та промпти</h1></div></div><PromptGroup name="Загальний список" prompts={general} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} onCopy={onCopy}/>{projects.map((project) => <PromptGroup key={project.id} name={project.name} prompts={prompts.filter((prompt) => prompt.projectId === project.id)} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} onCopy={onCopy}/>)}</>;
}
