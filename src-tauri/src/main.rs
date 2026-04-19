#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

struct OpenedFiles(Mutex<Vec<String>>);

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path, e))
}

#[tauri::command]
fn get_opened_files(state: State<OpenedFiles>) -> Vec<String> {
    state.0.lock().unwrap().drain(..).collect()
}

fn handle_opened_files(app: &AppHandle, paths: Vec<PathBuf>) {
    let files: Vec<String> = paths
        .iter()
        .filter_map(|p| p.to_str().map(String::from))
        .collect();

    if let Some(state) = app.try_state::<OpenedFiles>() {
        state.0.lock().unwrap().extend(files.clone());
    }

    for file in &files {
        let _ = app.emit("file-opened", file.clone());
    }
}

fn main() {
    tauri::Builder::default()
        .manage(OpenedFiles(Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![read_file, get_opened_files])
        .setup(|_app| {
            #[cfg(not(target_os = "macos"))]
            {
                let files: Vec<PathBuf> = std::env::args()
                    .skip(1)
                    .filter(|a| !a.starts_with('-'))
                    .map(PathBuf::from)
                    .filter(|p| p.exists())
                    .collect();
                if !files.is_empty() {
                    let state = app.state::<OpenedFiles>();
                    state.0.lock().unwrap().extend(
                        files
                            .iter()
                            .filter_map(|p| p.to_str().map(String::from)),
                    );
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Opened { urls } = event {
                let files: Vec<PathBuf> = urls
                    .into_iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .collect();
                handle_opened_files(app, files);
            }
        });
}
