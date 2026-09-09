# Нагадування про зміни та реліз

Перед кожним комітом, який змінює поведінку Prompt Saver, обов’язково:

1. Додайте короткий запис у [CHANGELOG.md](CHANGELOG.md) у секцію нової або поточної версії.
2. Опишіть зміни українською: що додано, змінено, виправлено або видалено.
3. Збільшіть версію в `package.json`, `src-tauri/Cargo.toml` і `src-tauri/tauri.conf.json`, якщо зміна потрапляє до installer або portable-збірки.
4. Запустіть `npm run lint`, `npm test` і `npm run build`.
5. Для релізу зберіть installer через `npm run tauri build` та portable через `npm run package:portable`.

Не створюйте пустий запис у changelog: фіксуйте лише готові, перевірені зміни.
