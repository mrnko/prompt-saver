import { CheckCircle2, KeyRound, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { SettingsPublic } from '../types';

const MODELS = ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'Власна модель'];
export function Settings({ settings, onSave, onClearKey }: { settings: SettingsPublic; onSave: (model: string, key: string) => Promise<void>; onClearKey: () => Promise<void> }) {
  const [model, setModel] = useState(settings.model);
  const [custom, setCustom] = useState(!MODELS.includes(settings.model));
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => { setSaving(true); try { await onSave(custom ? model : model, key); setKey(''); } finally { setSaving(false); } };
  return <section className="settings card"><div className="section-heading"><div><p className="eyebrow">НАЛАШТУВАННЯ</p><h2>OpenAI</h2><p className="muted">Ключ зберігається лише у Windows Credential Manager.</p></div><KeyRound size={21}/></div>
    <label>Модель<select value={custom ? 'Власна модель' : model} onChange={(event) => { const own = event.target.value === 'Власна модель'; setCustom(own); if (!own) setModel(event.target.value); }}><>{MODELS.map((item) => <option key={item}>{item}</option>)}</></select></label>
    {custom && <label>Model ID<input value={model} onChange={(event) => setModel(event.target.value)} placeholder="Наприклад, gpt-4.1-mini" /></label>}
    <label>OpenAI API key<input type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder={settings.hasApiKey ? 'Ключ уже збережено' : 'sk-…'} autoComplete="off" /></label>
    <div className="settings-status">{settings.hasApiKey ? <><CheckCircle2 size={18}/><span>Ключ підключено</span><button className="text-danger" onClick={onClearKey}><Trash2 size={15}/> Видалити ключ</button></> : <span>AI-функції вимкнені до додавання ключа.</span>}</div>
    <button className="primary-button" disabled={saving || (custom && !model.trim())} onClick={submit}><Save size={17}/>{saving ? 'Зберігаємо…' : 'Зберегти налаштування'}</button>
    <section className="update-info"><h3>Оновлення</h3><p>Версія 0.2.2. Закрийте застосунок і запустіть новий installer поверх поточної версії. Ваші промпти та налаштування збережуться.</p></section>
  </section>;
}
