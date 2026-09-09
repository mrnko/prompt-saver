import { Check, Mic, Pause, Sparkles, X } from 'lucide-react';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';

interface Props {
  value: string;
  editing: boolean;
  hasApiKey: boolean;
  busy?: boolean;
  onChange: (text: string) => void;
  onSave: () => void;
  onImprove: () => void;
  onCancelEdit: () => void;
  onError: (message: string) => void;
}

export function PromptComposer({ value, editing, hasApiKey, busy, onChange, onSave, onImprove, onCancelEdit, onError }: Props) {
  const voice = useVoiceRecorder((text) => onChange(value ? `${value}${value.endsWith('\n') ? '' : '\n'}${text}` : text), onError);
  return <section className="composer card">
    <div className="composer-heading"><div><p className="eyebrow">{editing ? 'РЕДАГУВАННЯ' : 'НОВИЙ ПРОМПТ'}</p><h2>{editing ? 'Уточніть завдання' : 'Що потрібно підготувати?'}</h2></div>{editing && <button className="icon-button" title="Скасувати редагування" onClick={onCancelEdit}><X size={18}/></button>}</div>
    <textarea autoFocus value={value} onChange={(event) => onChange(event.target.value)} placeholder="Опишіть задачу, ідею або вимоги…" aria-label="Текст промпту" />
    <div className="composer-actions">
      <div className="left-actions">
        <button className={`soft-button ${voice.isRecording ? 'recording' : ''}`} disabled={!hasApiKey || voice.isTranscribing} onClick={voice.isRecording ? voice.stop : voice.start} title={hasApiKey ? 'Голосовий ввід' : 'Додайте API key у налаштуваннях'}>
          {voice.isRecording ? <Pause size={17}/> : <Mic size={17}/>} {voice.isTranscribing ? 'Розпізнавання…' : voice.isRecording ? 'Зупинити' : 'Голос'}
        </button>
        <button className="soft-button" disabled={!hasApiKey || !value.trim() || busy} onClick={onImprove} title={hasApiKey ? 'Покращити через AI' : 'Додайте API key у налаштуваннях'}><Sparkles size={17}/> {busy ? 'Покращуємо…' : 'Покращити AI'}</button>
      </div>
      <button className="primary-button" disabled={!value.trim() || busy} onClick={onSave}><Check size={18}/>{editing ? 'Зберегти зміни' : 'Зберегти промпт'}</button>
    </div>
  </section>;
}
