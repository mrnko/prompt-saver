use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::{Duration, Utc};
use keyring::Entry;
use reqwest::{multipart, Client};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{fs, path::PathBuf, sync::Mutex, time::Duration as StdDuration};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder,
};

const SERVICE_NAME: &str = "Prompt Saver";
const ACCOUNT_NAME: &str = "openai_api_key";
const DEFAULT_MODEL: &str = "gpt-4.1-mini";

struct AppState {
    db: Mutex<Connection>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Prompt {
    id: i64,
    text: String,
    status: String,
    project_id: Option<i64>,
    project_name: Option<String>,
    created_at: String,
    updated_at: String,
    completed_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Project {
    id: i64,
    name: String,
    created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SettingsPublic {
    model: String,
    has_api_key: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PeriodStats {
    created: i64,
    completed: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DailyStats {
    date: String,
    created: i64,
    completed: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectTaskStats {
    project_id: Option<i64>,
    name: String,
    total: i64,
    normal: i64,
    completed: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Stats {
    today: PeriodStats,
    yesterday: PeriodStats,
    week: PeriodStats,
    month: PeriodStats,
    daily: Vec<DailyStats>,
    project_tasks: Vec<ProjectTaskStats>,
}

fn now() -> String {
    Utc::now().to_rfc3339()
}

fn key_entry() -> Result<Entry, String> {
    Entry::new(SERVICE_NAME, ACCOUNT_NAME).map_err(|error| format!("Не вдалося відкрити безпечне сховище: {error}"))
}

fn has_api_key() -> bool {
    key_entry()
        .and_then(|entry| entry.get_password().map_err(|error| error.to_string()))
        .map(|key| !key.trim().is_empty())
        .unwrap_or(false)
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let executable = std::env::current_exe().map_err(|error| error.to_string())?;
    let executable_dir = executable.parent().ok_or("Не знайдено папку застосунку")?;
    let portable_marker = executable_dir.join("portable.marker");
    let portable = portable_marker.exists() || std::env::var("PROMPT_SAVER_PORTABLE").is_ok();
    let directory = if portable {
        executable_dir.join("data")
    } else {
        app.path()
            .app_local_data_dir()
            .map_err(|error| error.to_string())?
    };
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory)
}

fn initialize_database(path: PathBuf) -> Result<Connection, String> {
    let mut connection = Connection::open(path.join("prompt-saver.sqlite3")).map_err(|error| error.to_string())?;
    connection
        .execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;
            CREATE TABLE IF NOT EXISTS prompts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('normal', 'completed')),
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                completed_at TEXT
            );
            CREATE TABLE IF NOT EXISTS drafts (
                id INTEGER PRIMARY KEY CHECK(id = 1),
                text TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            INSERT OR IGNORE INTO settings(key, value) VALUES ('model', 'gpt-4.1-mini');
            CREATE INDEX IF NOT EXISTS prompts_status_created ON prompts(status, created_at DESC);
            ",
        )
        .map_err(|error| error.to_string())?;
    migrate_database(&mut connection)?;
    Ok(connection)
}

fn migrate_database(connection: &mut Connection) -> Result<(), String> {
    let transaction = connection.transaction().map_err(|error| error.to_string())?;
    transaction.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL COLLATE NOCASE UNIQUE,
            created_at TEXT NOT NULL
        );
        ",
    ).map_err(|error| error.to_string())?;
    let has_project_column = transaction
        .prepare("PRAGMA table_info(prompts)").map_err(|error| error.to_string())?
        .query_map([], |row| row.get::<_, String>(1)).map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())?
        .iter().any(|column| column == "project_id");
    if !has_project_column {
        transaction.execute("ALTER TABLE prompts ADD COLUMN project_id INTEGER REFERENCES projects(id)", [])
            .map_err(|error| format!("Не вдалося оновити локальне сховище: {error}"))?;
    }
    transaction.execute_batch("CREATE INDEX IF NOT EXISTS prompts_project_status_created ON prompts(project_id, status, created_at DESC);")
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())
}

fn map_prompt(row: &rusqlite::Row<'_>) -> rusqlite::Result<Prompt> {
    Ok(Prompt {
        id: row.get(0)?,
        text: row.get(1)?,
        status: row.get(2)?,
        project_id: row.get(3)?,
        project_name: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
        completed_at: row.get(7)?,
    })
}

#[tauri::command]
fn list_prompts(state: State<'_, AppState>) -> Result<Vec<Prompt>, String> {
    let connection = state.db.lock().map_err(|_| "Сховище зайняте".to_string())?;
    let mut statement = connection
        .prepare("SELECT prompts.id, prompts.text, prompts.status, prompts.project_id, projects.name, prompts.created_at, prompts.updated_at, prompts.completed_at FROM prompts LEFT JOIN projects ON projects.id = prompts.project_id ORDER BY CASE prompts.status WHEN 'normal' THEN 0 ELSE 1 END, prompts.created_at DESC")
        .map_err(|error| error.to_string())?;
    let prompts = statement
        .query_map([], map_prompt)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(prompts)
}

fn validate_project(connection: &Connection, project_id: Option<i64>) -> Result<(), String> {
    if let Some(id) = project_id {
        let exists: i64 = connection.query_row("SELECT COUNT(*) FROM projects WHERE id = ?1", [id], |row| row.get(0)).map_err(|error| error.to_string())?;
        if exists == 0 { return Err("Проєкт не знайдено".into()); }
    }
    Ok(())
}

#[tauri::command]
fn list_projects(state: State<'_, AppState>) -> Result<Vec<Project>, String> {
    let connection = state.db.lock().map_err(|_| "Сховище зайняте".to_string())?;
    let mut statement = connection.prepare("SELECT id, name, created_at FROM projects ORDER BY name COLLATE NOCASE").map_err(|error| error.to_string())?;
    let projects = statement.query_map([], |row| Ok(Project { id: row.get(0)?, name: row.get(1)?, created_at: row.get(2)? }))
        .map_err(|error| error.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())?;
    Ok(projects)
}

#[tauri::command]
fn create_project(name: String, state: State<'_, AppState>) -> Result<Project, String> {
    let name = name.trim().to_string();
    if name.is_empty() { return Err("Введіть назву проєкту".into()); }
    let connection = state.db.lock().map_err(|_| "Сховище зайняте".to_string())?;
    let created_at = now();
    match connection.execute("INSERT INTO projects(name, created_at) VALUES (?1, ?2)", params![name, created_at]) {
        Ok(_) => {},
        Err(rusqlite::Error::SqliteFailure(_, _)) => return Err("Проєкт із такою назвою вже існує".into()),
        Err(error) => return Err(error.to_string()),
    }
    let id = connection.last_insert_rowid();
    connection.query_row("SELECT id, name, created_at FROM projects WHERE id = ?1", [id], |row| Ok(Project { id: row.get(0)?, name: row.get(1)?, created_at: row.get(2)? })).map_err(|error| error.to_string())
}

#[tauri::command]
fn create_prompt(text: String, project_id: Option<i64>, state: State<'_, AppState>) -> Result<Prompt, String> {
    let text = text.trim().to_owned();
    if text.is_empty() {
        return Err("Введіть текст промпту".into());
    }
    let timestamp = now();
    let connection = state.db.lock().map_err(|_| "Сховище зайняте".to_string())?;
    validate_project(&connection, project_id)?;
    connection
        .execute(
            "INSERT INTO prompts(text, status, project_id, created_at, updated_at) VALUES (?1, 'normal', ?2, ?3, ?3)",
            params![text, project_id, timestamp],
        )
        .map_err(|error| error.to_string())?;
    let id = connection.last_insert_rowid();
    connection
        .query_row(
            "SELECT prompts.id, prompts.text, prompts.status, prompts.project_id, projects.name, prompts.created_at, prompts.updated_at, prompts.completed_at FROM prompts LEFT JOIN projects ON projects.id = prompts.project_id WHERE prompts.id = ?1",
            [id],
            map_prompt,
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn update_prompt(id: i64, text: String, project_id: Option<i64>, state: State<'_, AppState>) -> Result<Prompt, String> {
    let text = text.trim().to_owned();
    if text.is_empty() {
        return Err("Текст промпту не може бути порожнім".into());
    }
    let connection = state.db.lock().map_err(|_| "Сховище зайняте".to_string())?;
    validate_project(&connection, project_id)?;
    if connection
        .execute("UPDATE prompts SET text = ?1, project_id = ?2, updated_at = ?3 WHERE id = ?4", params![text, project_id, now(), id])
        .map_err(|error| error.to_string())?
        == 0
    {
        return Err("Промпт не знайдено".into());
    }
    connection
        .query_row(
            "SELECT prompts.id, prompts.text, prompts.status, prompts.project_id, projects.name, prompts.created_at, prompts.updated_at, prompts.completed_at FROM prompts LEFT JOIN projects ON projects.id = prompts.project_id WHERE prompts.id = ?1",
            [id],
            map_prompt,
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn toggle_prompt(id: i64, state: State<'_, AppState>) -> Result<Prompt, String> {
    let connection = state.db.lock().map_err(|_| "Сховище зайняте".to_string())?;
    let status: String = connection
        .query_row("SELECT status FROM prompts WHERE id = ?1", [id], |row| row.get(0))
        .map_err(|_| "Промпт не знайдено".to_string())?;
    let timestamp = now();
    if status == "normal" {
        connection
            .execute("UPDATE prompts SET status = 'completed', completed_at = ?1, updated_at = ?1 WHERE id = ?2", params![timestamp, id])
    } else {
        connection
            .execute("UPDATE prompts SET status = 'normal', completed_at = NULL, updated_at = ?1 WHERE id = ?2", params![timestamp, id])
    }
    .map_err(|error| error.to_string())?;
    connection
        .query_row(
            "SELECT prompts.id, prompts.text, prompts.status, prompts.project_id, projects.name, prompts.created_at, prompts.updated_at, prompts.completed_at FROM prompts LEFT JOIN projects ON projects.id = prompts.project_id WHERE prompts.id = ?1",
            [id],
            map_prompt,
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_prompt(id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let connection = state.db.lock().map_err(|_| "Сховище зайняте".to_string())?;
    if connection.execute("DELETE FROM prompts WHERE id = ?1", [id]).map_err(|error| error.to_string())? == 0 {
        return Err("Промпт не знайдено".into());
    }
    Ok(())
}

#[tauri::command]
fn copy_prompt_to_clipboard(text: String) -> Result<(), String> {
    if text.is_empty() { return Err("Немає тексту для копіювання".into()); }
    let mut clipboard = arboard::Clipboard::new().map_err(|error| format!("Не вдалося відкрити буфер обміну: {error}"))?;
    clipboard.set_text(text).map_err(|error| format!("Не вдалося скопіювати промпт: {error}"))
}

#[tauri::command]
fn get_draft(state: State<'_, AppState>) -> Result<String, String> {
    let connection = state.db.lock().map_err(|_| "Сховище зайняте".to_string())?;
    connection
        .query_row("SELECT text FROM drafts WHERE id = 1", [], |row| row.get(0))
        .or_else(|error| if matches!(error, rusqlite::Error::QueryReturnedNoRows) { Ok(String::new()) } else { Err(error) })
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_draft(text: String, state: State<'_, AppState>) -> Result<(), String> {
    let connection = state.db.lock().map_err(|_| "Сховище зайняте".to_string())?;
    connection
        .execute(
            "INSERT INTO drafts(id, text, updated_at) VALUES (1, ?1, ?2) ON CONFLICT(id) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at",
            params![text, now()],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn clear_draft(state: State<'_, AppState>) -> Result<(), String> {
    state.db.lock().map_err(|_| "Сховище зайняте".to_string())?.execute("DELETE FROM drafts WHERE id = 1", []).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> Result<SettingsPublic, String> {
    let connection = state.db.lock().map_err(|_| "Сховище зайняте".to_string())?;
    let model = connection
        .query_row("SELECT value FROM settings WHERE key = 'model'", [], |row| row.get(0))
        .unwrap_or_else(|_| DEFAULT_MODEL.to_string());
    Ok(SettingsPublic { model, has_api_key: has_api_key() })
}

#[tauri::command]
fn save_settings(model: String, api_key: Option<String>, state: State<'_, AppState>) -> Result<SettingsPublic, String> {
    let model = if model.trim().is_empty() { DEFAULT_MODEL.to_string() } else { model.trim().to_string() };
    if let Some(key) = api_key {
        if !key.trim().is_empty() {
            key_entry()?.set_password(key.trim()).map_err(|error| format!("Не вдалося зберегти ключ: {error}"))?;
        }
    }
    let connection = state.db.lock().map_err(|_| "Сховище зайняте".to_string())?;
    connection
        .execute("INSERT INTO settings(key, value) VALUES ('model', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [model.clone()])
        .map_err(|error| error.to_string())?;
    Ok(SettingsPublic { model, has_api_key: has_api_key() })
}

#[tauri::command]
fn clear_api_key() -> Result<(), String> {
    match key_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Не вдалося видалити ключ: {error}")),
    }
}

fn configured_model(connection: &Connection) -> String {
    connection
        .query_row("SELECT value FROM settings WHERE key = 'model'", [], |row| row.get(0))
        .unwrap_or_else(|_| DEFAULT_MODEL.to_string())
}

fn response_text(value: &Value) -> Option<String> {
    if let Some(text) = value.get("output_text").and_then(Value::as_str) {
        return Some(text.to_string());
    }
    if value.get("type").and_then(Value::as_str) == Some("output_text") {
        if let Some(text) = value.get("text").and_then(Value::as_str) {
            return Some(text.to_string());
        }
    }
    match value {
        Value::Array(items) => items.iter().find_map(response_text),
        Value::Object(values) => values.values().find_map(response_text),
        _ => None,
    }
}

async fn openai_client() -> Result<(Client, String), String> {
    let key = key_entry()?
        .get_password()
        .map_err(|_| "Додайте OpenAI API key у налаштуваннях".to_string())?;
    if key.trim().is_empty() {
        return Err("Додайте OpenAI API key у налаштуваннях".into());
    }
    let client = Client::builder().timeout(StdDuration::from_secs(90)).build().map_err(|error| error.to_string())?;
    Ok((client, key))
}

#[tauri::command]
async fn improve_prompt(text: String, state: State<'_, AppState>) -> Result<String, String> {
    if text.trim().is_empty() {
        return Err("Введіть текст перед покращенням".into());
    }
    let model = {
        let connection = state.db.lock().map_err(|_| "Сховище зайняте".to_string())?;
        configured_model(&connection)
    };
    let (client, key) = openai_client().await?;
    let payload = serde_json::json!({
        "model": model,
        "instructions": "You improve rough software-development prompts for coding agents such as Codex and Claude Code. Preserve the original language and intent. Do not invent requirements. Return only a polished, structured prompt with clear context, goal, requirements, constraints, acceptance criteria, and useful implementation details when present.",
        "input": text
    });
    let response = client
        .post("https://api.openai.com/v1/responses")
        .bearer_auth(key)
        .json(&payload)
        .send()
        .await
        .map_err(|error| format!("Помилка з’єднання з OpenAI: {error}"))?;
    let status = response.status();
    let body: Value = response.json().await.map_err(|error| error.to_string())?;
    if !status.is_success() {
        let message = body.pointer("/error/message").and_then(Value::as_str).unwrap_or("невідома помилка OpenAI");
        return Err(format!("OpenAI: {message}"));
    }
    response_text(&body).filter(|result| !result.trim().is_empty()).ok_or("OpenAI не повернув текст".into())
}

#[tauri::command]
async fn transcribe_audio(audio_base64: String, mime_type: String) -> Result<String, String> {
    let (client, key) = openai_client().await?;
    let bytes = BASE64.decode(audio_base64).map_err(|_| "Не вдалося прочитати аудіо".to_string())?;
    if bytes.len() > 24 * 1024 * 1024 {
        return Err("Аудіо завелике — максимальний розмір 24 МБ".into());
    }
    let extension = if mime_type.contains("ogg") { "ogg" } else if mime_type.contains("mp4") { "mp4" } else { "webm" };
    let part = multipart::Part::bytes(bytes)
        .file_name(format!("recording.{extension}"))
        .mime_str(&mime_type)
        .map_err(|error| error.to_string())?;
    let form = multipart::Form::new().text("model", "gpt-4o-mini-transcribe").part("file", part);
    let response = client
        .post("https://api.openai.com/v1/audio/transcriptions")
        .bearer_auth(key)
        .multipart(form)
        .send()
        .await
        .map_err(|error| format!("Помилка з’єднання з OpenAI: {error}"))?;
    let status = response.status();
    let body: Value = response.json().await.map_err(|error| error.to_string())?;
    if !status.is_success() {
        let message = body.pointer("/error/message").and_then(Value::as_str).unwrap_or("невідома помилка OpenAI");
        return Err(format!("OpenAI: {message}"));
    }
    body.get("text").and_then(Value::as_str).map(str::to_owned).filter(|text| !text.trim().is_empty()).ok_or("OpenAI не повернув розпізнаний текст".into())
}

#[tauri::command]
fn get_stats(state: State<'_, AppState>) -> Result<Stats, String> {
    let connection = state.db.lock().map_err(|_| "Сховище зайняте".to_string())?;
    let today = Utc::now().date_naive();
    let count = |column: &str, start: chrono::NaiveDate, end: chrono::NaiveDate| -> Result<i64, String> {
        let sql = format!("SELECT COUNT(*) FROM prompts WHERE {column} >= ?1 AND {column} < ?2");
        connection.query_row(&sql, params![start.to_string(), end.to_string()], |row| row.get(0)).map_err(|error| error.to_string())
    };
    let period = |start: chrono::NaiveDate, end: chrono::NaiveDate| -> Result<PeriodStats, String> {
        Ok(PeriodStats { created: count("created_at", start, end)?, completed: count("completed_at", start, end)? })
    };
    let mut daily = Vec::with_capacity(30);
    for offset in (0..30).rev() {
        let date = today - Duration::days(offset);
        let next = date + Duration::days(1);
        daily.push(DailyStats { date: date.format("%d.%m").to_string(), created: count("created_at", date, next)?, completed: count("completed_at", date, next)? });
    }
    let unassigned = connection.query_row(
        "SELECT COUNT(*), COALESCE(SUM(CASE WHEN status = 'normal' THEN 1 ELSE 0 END), 0), COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) FROM prompts WHERE project_id IS NULL",
        [],
        |row| Ok(ProjectTaskStats { project_id: None, name: "Загальний список".into(), total: row.get(0)?, normal: row.get(1)?, completed: row.get(2)? }),
    ).map_err(|error| error.to_string())?;
    let mut project_tasks = vec![unassigned];
    let mut statement = connection.prepare(
        "SELECT projects.id, projects.name, COUNT(prompts.id), COALESCE(SUM(CASE WHEN prompts.status = 'normal' THEN 1 ELSE 0 END), 0), COALESCE(SUM(CASE WHEN prompts.status = 'completed' THEN 1 ELSE 0 END), 0) FROM projects LEFT JOIN prompts ON prompts.project_id = projects.id GROUP BY projects.id, projects.name ORDER BY projects.name COLLATE NOCASE",
    ).map_err(|error| error.to_string())?;
    let project_rows = statement.query_map([], |row| Ok(ProjectTaskStats { project_id: Some(row.get(0)?), name: row.get(1)?, total: row.get(2)?, normal: row.get(3)?, completed: row.get(4)? }))
        .map_err(|error| error.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())?;
    project_tasks.extend(project_rows);
    Ok(Stats {
        today: period(today, today + Duration::days(1))?,
        yesterday: period(today - Duration::days(1), today)?,
        week: period(today - Duration::days(6), today + Duration::days(1))?,
        month: period(today - Duration::days(29), today + Duration::days(1))?,
        daily,
        project_tasks,
    })
}

fn open_quick_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("quick") {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }
    let _ = WebviewWindowBuilder::new(app, "quick", WebviewUrl::App("index.html?quick=1".into()))
        .title("Новий промпт")
        .inner_size(560.0, 390.0)
        .min_inner_size(460.0, 320.0)
        .resizable(false)
        .always_on_top(true)
        .build();
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let database = initialize_database(app_data_dir(&app.handle())?)?;
            app.manage(AppState { db: Mutex::new(database) });
            let new_prompt = MenuItem::with_id(app, "new_prompt", "Новий промпт", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Відкрити Prompt Saver", true, None::<&str>)?;
            let hide = MenuItem::with_id(app, "hide", "Сховати", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Вийти", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&new_prompt, &show, &hide, &quit])?;
            let icon = app.default_window_icon().ok_or("Не знайдено іконку застосунку")?.clone();
            TrayIconBuilder::with_id("prompt-saver-tray")
                .icon(icon)
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "new_prompt" => open_quick_window(app),
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") { let _ = window.show(); let _ = window.set_focus(); }
                    }
                    "hide" => { if let Some(window) = app.get_webview_window("main") { let _ = window.hide(); } }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            list_prompts, create_prompt, update_prompt, toggle_prompt, delete_prompt, copy_prompt_to_clipboard,
            list_projects, create_project,
            get_draft, save_draft, clear_draft, get_settings, save_settings, clear_api_key,
            improve_prompt, transcribe_audio, get_stats
        ])
        .run(tauri::generate_context!())
        .expect("Помилка запуску Prompt Saver");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrates_existing_prompts_without_losing_them() {
        let mut connection = Connection::open_in_memory().expect("in-memory database");
        connection.execute_batch(
            "
            CREATE TABLE prompts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                completed_at TEXT
            );
            INSERT INTO prompts(text, status, created_at, updated_at) VALUES ('Наявний промпт', 'normal', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
            ",
        ).expect("legacy schema");

        migrate_database(&mut connection).expect("migration succeeds");

        let remaining: i64 = connection.query_row("SELECT COUNT(*) FROM prompts WHERE text = 'Наявний промпт' AND project_id IS NULL", [], |row| row.get(0)).expect("prompt survives");
        let projects_table: i64 = connection.query_row("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'projects'", [], |row| row.get(0)).expect("projects table check");
        assert_eq!(remaining, 1);
        assert_eq!(projects_table, 1);
    }
}
