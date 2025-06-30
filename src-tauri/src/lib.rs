mod pty;

use pty::PtyManager;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn spawn_pty(
    app_handle: AppHandle,
    pty_manager: State<Arc<PtyManager>>,
    shell: Option<String>,
    cwd: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<String, String> {
    pty_manager.spawn_pty(
        app_handle,
        shell,
        cwd,
        cols.unwrap_or(80),
        rows.unwrap_or(24),
    )
}

#[tauri::command]
fn write_to_pty(
    pty_manager: State<Arc<PtyManager>>,
    id: String,
    data: String,
) -> Result<(), String> {
    pty_manager.write_to_pty(&id, &data)
}

#[tauri::command]
fn resize_pty(
    pty_manager: State<Arc<PtyManager>>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    pty_manager.resize_pty(&id, cols, rows)
}

#[tauri::command]
fn kill_pty(
    pty_manager: State<Arc<PtyManager>>,
    id: String,
) -> Result<(), String> {
    pty_manager.kill_pty(&id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .manage(Arc::new(PtyManager::new()))
        .invoke_handler(tauri::generate_handler![
            greet,
            spawn_pty,
            write_to_pty,
            resize_pty,
            kill_pty
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
