# Prompt Saver

Легкий Windows-застосунок для підготовки промптів до роботи з Codex, Claude Code та іншими AI-агентами. Інтерфейс — українською, дані — локально.

## Можливості

- активні й виконані промпти, швидке завершення та підтверджене видалення;
- автозбереження чернетки кожні 10 секунд без втрати фокусу;
- статистика створених/виконаних промптів і 30-денний графік;
- швидке створення із системного трея;
- голосовий ввід через OpenAI Transcription;
- AI-покращення з обов’язковим переглядом перед заміною тексту;
- OpenAI API key зберігається лише у Windows Credential Manager.

## Розробка

Потрібні Node.js 20+ і актуальний Rust toolchain з Microsoft C++ Build Tools.

```powershell
npm install
npm run tauri dev
```

Перевірки:

```powershell
npm run lint
npm test
npm run tauri build
```

## Збірки

`npm run tauri build` створює x64 NSIS installer у `src-tauri/target/release/bundle/nsis`.

`npm run package:portable` створює `dist/Prompt-Saver-portable-x64.zip`. Розпакуйте архів і запускайте `Prompt Saver.exe`; файл `portable.marker` вмикає зберігання даних у сусідній папці `data`.

Installer зберігає базу даних у `%LOCALAPPDATA%/ua.promptsaver.desktop`. Portable-версія — поруч із застосунком. API key не потрапляє до жодної з цих баз: він зберігається у Windows Credential Manager.

## Конфіденційність

Промпти й чернетки нікуди не надсилаються без вашої дії. Лише голосове розпізнавання та кнопка «Покращити AI» надсилають вибраний вміст до OpenAI API через ваш власний ключ.

## Ліцензія

[MIT](LICENSE)
