import { getCurrentWindow } from '@tauri-apps/api/window';
import { openUrl } from '@tauri-apps/plugin-opener';
import { CheckCircle2, ClipboardList, FolderKanban, LoaderCircle, Plus, Settings2, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Analytics } from './components/Analytics';
import { PromptCard } from './components/PromptCard';
import { PromptComposer } from './components/PromptComposer';
import { Projects } from './components/Projects';
import { Settings } from './components/Settings';
import { api } from './lib/api';
import { splitPrompts } from './lib/prompt';
import type { Project, Prompt, SettingsPublic, Stats } from './types';
import './project-styles.css';

const emptyStats: Stats = { today: { created: 0, completed: 0 }, yesterday: { created: 0, completed: 0 }, week: { created: 0, completed: 0 }, month: { created: 0, completed: 0 }, daily: [], projectTasks: [] };
const defaultSettings: SettingsPublic = { model: 'gpt-4.1-mini', hasApiKey: false };
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
const APP_VERSION = '0.2.5';
const RELEASE_DATE = '9 вересня 2026';
const CHANGELOG_URL = 'https://github.com/mrnko/prompt-saver/blob/main/CHANGELOG.md';

export default function App() {
  const quick = new URLSearchParams(window.location.search).has('quick');
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [settings, setSettings] = useState<SettingsPublic>(defaultSettings);
  const [tab, setTab] = useState<'prompts' | 'projects' | 'settings'>('prompts');
  const [text, setText] = useState('');
  const textRef = useRef('');
  const [projectId, setProjectId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [improved, setImproved] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Prompt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = async () => {
    const [nextPrompts, nextStats, nextProjects] = await Promise.all([api.listPrompts(), api.getStats(), api.listProjects()]);
    setPrompts(nextPrompts); setStats(nextStats); setProjects(nextProjects);
  };
  useEffect(() => {
    let active = true;
    Promise.all([api.getSettings(), api.getDraft(), api.listProjects(), quick ? Promise.resolve([] as Prompt[]) : api.listPrompts(), quick ? Promise.resolve(emptyStats) : api.getStats()])
      .then(([nextSettings, draft, nextProjects, nextPrompts, nextStats]) => { if (active) { setSettings(nextSettings); setProjects(nextProjects); setText(draft); textRef.current = draft; setPrompts(nextPrompts); setStats(nextStats); } })
      .catch((failure) => active && setError(errorText(failure)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [quick]);
  useEffect(() => {
    const save = () => { if (textRef.current.trim()) void api.saveDraft(textRef.current); };
    const interval = window.setInterval(save, 10_000);
    window.addEventListener('beforeunload', save);
    return () => { window.clearInterval(interval); window.removeEventListener('beforeunload', save); };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const updateText = (next: string) => { setText(next); textRef.current = next; };
  const { active, completed } = useMemo(() => splitPrompts(prompts), [prompts]);
  const resetComposer = () => { updateText(''); setProjectId(null); setEditing(null); setImproved(null); };
  const savePrompt = async () => {
    try {
      setSaving(true); setError(null);
      if (editing) await api.updatePrompt(editing.id, text, projectId); else await api.createPrompt(text, projectId);
      await api.clearDraft(); resetComposer();
      if (quick) await getCurrentWindow().hide(); else await refresh();
    } catch (failure) { setError(errorText(failure)); } finally { setSaving(false); }
  };
  const startEdit = (prompt: Prompt) => { setTab('prompts'); setEditing(prompt); setProjectId(prompt.projectId); updateText(prompt.text); setImproved(null); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const toggle = async (prompt: Prompt) => { try { setError(null); const updated = await api.togglePrompt(prompt.id); setPrompts((items) => items.map((item) => item.id === updated.id ? updated : item)); setStats(await api.getStats()); } catch (failure) { setError(errorText(failure)); } };
  const confirmDelete = async () => { if (!deleteTarget) return; try { await api.deletePrompt(deleteTarget.id); setPrompts((items) => items.filter((item) => item.id !== deleteTarget.id)); setStats(await api.getStats()); setDeleteTarget(null); } catch (failure) { setError(errorText(failure)); } };
  const improve = async () => { try { setSaving(true); setError(null); setImproved(await api.improvePrompt(text)); } catch (failure) { setError(errorText(failure)); } finally { setSaving(false); } };
  const copyPrompt = async (prompt: Prompt) => { try { await api.copyPrompt(prompt.text); setToast('Промпт скопійовано у буфер обміну'); } catch (failure) { setError(errorText(failure)); } };
  const createProject = async (name: string) => { try { setError(null); await api.createProject(name); await refresh(); } catch (failure) { setError(errorText(failure)); throw failure; } };
  const saveSettings = async (model: string, key: string) => { try { setError(null); setSettings(await api.saveSettings(model, key)); } catch (failure) { setError(errorText(failure)); throw failure; } };
  const clearKey = async () => { try { await api.clearApiKey(); setSettings((current) => ({ ...current, hasApiKey: false })); } catch (failure) { setError(errorText(failure)); } };
  const openExternal = (url: string) => { void openUrl(url).catch((failure) => setError(errorText(failure))); };

  if (loading) return <main className="loading"><LoaderCircle className="spin" size={28}/> Завантажуємо ваші промпти…</main>;
  const composer = <PromptComposer value={text} editing={Boolean(editing)} hasApiKey={settings.hasApiKey} projects={projects} projectId={projectId} busy={saving} onChange={updateText} onProjectChange={setProjectId} onSave={savePrompt} onImprove={improve} onCancelEdit={resetComposer} onError={setError}/>;
  const preview = improved && <section className="ai-preview card"><div className="section-heading"><div><p className="eyebrow">AI-ПОКРАЩЕННЯ</p><h2>Перегляньте результат</h2></div><Sparkles size={21}/></div><pre>{improved}</pre><div className="preview-actions"><button className="soft-button" onClick={() => setImproved(null)}>Залишити оригінал</button><button className="primary-button" onClick={() => { updateText(improved); setImproved(null); }}>Замінити текст</button></div></section>;
  const promptList = <><Analytics stats={stats}/><section className="list-section"><div className="list-heading"><h2>Активні</h2><span>{active.length}</span></div>{active.length ? active.map((prompt) => <PromptCard key={prompt.id} prompt={prompt} onToggle={toggle} onEdit={startEdit} onDelete={setDeleteTarget} onCopy={copyPrompt}/>) : <div className="empty-state">Тут з’являться ваші нові промпти.</div>}</section><section className="list-section completed-section"><div className="list-heading"><h2>Виконані</h2><span>{completed.length}</span></div>{completed.length ? completed.map((prompt) => <PromptCard key={prompt.id} prompt={prompt} onToggle={toggle} onEdit={startEdit} onDelete={setDeleteTarget} onCopy={copyPrompt}/>) : <div className="empty-state">Ще немає виконаних промптів.</div>}</section></>;

  return <main className={quick ? 'app quick-app' : 'app'}>
    {!quick && <header className="topbar"><div className="brand"><div className="brand-mark"><CheckCircle2 size={20}/></div><div><h1>Prompt Saver</h1><p>Простір для ваших наступних кроків</p></div></div><nav><button className={tab === 'prompts' ? 'nav-active' : ''} onClick={() => setTab('prompts')}><ClipboardList size={18}/> Промпти</button><button className={tab === 'projects' ? 'nav-active' : ''} onClick={() => setTab('projects')}><FolderKanban size={18}/> Проєкти</button><button className={tab === 'settings' ? 'nav-active' : ''} onClick={() => setTab('settings')}><Settings2 size={18}/> Налаштування</button></nav></header>}
    {error && <div className="notice error"><span>{error}</span><button onClick={() => setError(null)} aria-label="Закрити"><X size={16}/></button></div>}
    {toast && <div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
    {quick ? <><div className="quick-title"><p className="eyebrow">ШВИДКЕ ДОДАВАННЯ</p><h1>Новий промпт</h1></div>{composer}{preview}</> : tab === 'prompts' ? <><div className="page-intro"><div><p className="eyebrow">ВАШ СПИСОК</p><h2>Зберігайте думки, поки вони свіжі</h2></div><span className="count-badge"><Plus size={15}/>{active.length} активних</span></div>{composer}{preview}{promptList}</> : tab === 'projects' ? <Projects projects={projects} prompts={prompts} onCreate={createProject} onToggle={toggle} onEdit={startEdit} onDelete={setDeleteTarget} onCopy={copyPrompt}/> : <Settings settings={settings} onSave={saveSettings} onClearKey={clearKey}/>}
    <footer className="app-footer">
      <span>© 2026 Prompt Saver</span>
      <div className="footer-links">
        <button type="button" className="footer-link" onClick={() => openExternal(CHANGELOG_URL)}>Що нового</button>
      </div>
      <span>{`v${APP_VERSION} · ${RELEASE_DATE}`}</span>
    </footer>
    {deleteTarget && <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><div className="modal-icon"><X size={22}/></div><h2 id="delete-title">Видалити промпт?</h2><p>Цю дію неможливо скасувати. Промпт буде видалено назавжди.</p><div className="modal-actions"><button className="soft-button" onClick={() => setDeleteTarget(null)}>Скасувати</button><button className="danger-button" onClick={confirmDelete}>Видалити</button></div></section></div>}
  </main>;
}
