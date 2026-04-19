#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

struct OpenedFiles(Mutex<Vec<String>>);
static WINDOW_COUNTER: AtomicU32 = AtomicU32::new(1);

fn create_window(app: &AppHandle, file_path: Option<&str>) -> Result<(), String> {
    let id = WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed);
    let label = format!("window-{}", id);

    let mut builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::default())
        .title("")
        .inner_size(1000.0, 750.0)
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .disable_drag_drop_handler();

    if let Some(path) = file_path {
        let escaped = path.replace('\\', "\\\\").replace('"', "\\\"");
        builder = builder.initialization_script(&format!(
            "window.__INITIAL_FILE__ = \"{}\";",
            escaped
        ));
    }

    builder.build().map_err(|e: tauri::Error| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path, e))
}

#[tauri::command]
fn get_opened_files(state: State<OpenedFiles>) -> Vec<String> {
    state.0.lock().unwrap().drain(..).collect()
}

#[tauri::command]
fn open_new_window(app: AppHandle, file_path: Option<String>) -> Result<(), String> {
    create_window(&app, file_path.as_deref())
}

fn handle_opened_files(app: &AppHandle, paths: Vec<PathBuf>) {
    // Check if the main window has a file loaded by checking if any windows exist beyond "main"
    let files: Vec<String> = paths
        .iter()
        .filter_map(|p| p.to_str().map(String::from))
        .collect();

    for file in &files {
        // If the main window exists and is showing the drop zone, send to it
        // Otherwise create a new window
        if let Some(main_window) = app.get_webview_window("main") {
            // Try emitting to main first — the frontend will decide
            // whether to use it or request a new window
            let _ = main_window.emit("file-opened", file.clone());
        } else {
            let _ = create_window(app, Some(file));
        }
    }
}

fn main() {
    tauri::Builder::default()
        .manage(OpenedFiles(Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![
            read_file,
            get_opened_files,
            open_new_window
        ])
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
                    let state = _app.state::<OpenedFiles>();
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
