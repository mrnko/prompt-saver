import { useRef, useState } from 'react';
import { api } from '../lib/api';

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Не вдалося прочитати запис'));
    reader.readAsDataURL(blob);
  });
}

export function useVoiceRecorder(onText: (text: string) => void, onError: (message: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);

  const start = async () => {
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const instance = new MediaRecorder(stream.current);
      instance.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      instance.onstop = async () => {
        setIsRecording(false);
        stream.current?.getTracks().forEach((track) => track.stop());
        stream.current = null;
        const blob = new Blob(chunks, { type: instance.mimeType || 'audio/webm' });
        if (!blob.size) return;
        try {
          setIsTranscribing(true);
          onText(await api.transcribeAudio(await blobToBase64(blob), blob.type || 'audio/webm'));
        } catch (error) {
          onError(error instanceof Error ? error.message : 'Не вдалося розпізнати голос');
        } finally { setIsTranscribing(false); }
      };
      recorder.current = instance;
      instance.start();
      setIsRecording(true);
    } catch {
      onError('Надайте застосунку доступ до мікрофона у налаштуваннях Windows');
    }
  };

  const stop = () => recorder.current?.state === 'recording' && recorder.current.stop();
  return { isRecording, isTranscribing, start, stop };
}
