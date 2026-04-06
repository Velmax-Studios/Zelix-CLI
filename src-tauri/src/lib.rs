mod pty;

use pty::PtyManager;
use std::collections::HashMap;
use tauri::{AppHandle, State};

struct AppState {
    pty_manager: PtyManager,
}

// ==================== PTY ====================

#[tauri::command]
fn pty_spawn(
    app: AppHandle,
    state: State<'_, AppState>,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    command: Option<String>,
    args: Option<Vec<String>>,
    env: Option<HashMap<String, String>>,
) -> Result<String, String> {
    state.pty_manager.spawn(&app, cols, rows, cwd, command, args, env)
}

#[tauri::command]
fn pty_write(state: State<'_, AppState>, id: String, data: String) -> Result<(), String> {
    state.pty_manager.write(&id, &data)
}

#[tauri::command]
fn pty_resize(state: State<'_, AppState>, id: String, cols: u16, rows: u16) -> Result<(), String> {
    state.pty_manager.resize(&id, cols, rows)
}

#[tauri::command]
fn pty_kill(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.pty_manager.kill(&id)
}

#[tauri::command]
fn pty_has_active_process(state: State<'_, AppState>, id: String) -> bool {
    state.pty_manager.has_active_process(&id)
}

#[tauri::command]
fn pty_list(state: State<'_, AppState>) -> Vec<pty::manager::PtyInfo> {
    state.pty_manager.list()
}

// ==================== APP SETUP ====================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            pty_manager: PtyManager::new(),
        })
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            pty_spawn,
            pty_write,
            pty_resize,
            pty_kill,
            pty_has_active_process,
            pty_list,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
