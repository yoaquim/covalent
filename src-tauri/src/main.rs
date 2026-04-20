#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use notify::{Watcher, RecursiveMode, Event, EventKind};

#[cfg(target_os = "macos")]
use core_foundation::base::TCFType;
#[cfg(target_os = "macos")]
use core_foundation::string::CFString;

#[cfg(target_os = "macos")]
extern "C" {
    fn LSSetDefaultRoleHandlerForContentType(
        inContentType: core_foundation::string::CFStringRef,
        inRole: u32,
        inHandlerBundleID: core_foundation::string::CFStringRef,
    ) -> i32;
}

struct OpenedFiles(Mutex<Vec<String>>);
struct FrontendReady(AtomicU32);
struct FileWatcher(Mutex<Option<notify::RecommendedWatcher>>);
static WINDOW_COUNTER: AtomicU32 = AtomicU32::new(1);

fn create_window(app: &AppHandle, file_path: Option<&str>) -> Result<(), String> {
    let id = WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed);
    let label = format!("window-{}", id);

    let mut builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::default())
        .title("")
        .inner_size(1000.0, 750.0)
        .disable_drag_drop_handler();

    #[cfg(target_os = "macos")]
    {
        builder = builder.title_bar_style(tauri::TitleBarStyle::Overlay);
    }

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
fn get_opened_files(state: State<OpenedFiles>, ready: State<FrontendReady>) -> Vec<String> {
    ready.0.store(1, Ordering::Relaxed);
    state.0.lock().unwrap().drain(..).collect()
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn set_default_md_viewer() -> Result<(), String> {
    const K_LS_ROLES_VIEWER: u32 = 0x00000002;
    let content_type = CFString::new("net.daringfireball.markdown");
    let bundle_id = CFString::new("com.yoaquim.mdviewer");

    let result = unsafe {
        LSSetDefaultRoleHandlerForContentType(
            content_type.as_concrete_TypeRef(),
            K_LS_ROLES_VIEWER,
            bundle_id.as_concrete_TypeRef(),
        )
    };

    if result == 0 {
        Ok(())
    } else {
        Err(format!("Failed to set default handler (error {})", result))
    }
}

#[tauri::command]
fn watch_file(app: AppHandle, path: String, watcher_state: State<FileWatcher>) -> Result<(), String> {
    let watch_path = PathBuf::from(&path);
    let app_handle = app.clone();

    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        if let Ok(event) = res {
            if matches!(event.kind, EventKind::Modify(_)) {
                let _ = app_handle.emit("file-changed", path.clone());
            }
        }
    }).map_err(|e| e.to_string())?;

    watcher.watch(watch_path.as_path(), RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;

    // Store watcher so it doesn't get dropped
    *watcher_state.0.lock().unwrap() = Some(watcher);
    Ok(())
}

#[tauri::command]
fn open_new_window(app: AppHandle, file_path: Option<String>) -> Result<(), String> {
    create_window(&app, file_path.as_deref())
}

#[cfg(target_os = "macos")]
fn handle_opened_files(app: &AppHandle, paths: Vec<PathBuf>) {
    let files: Vec<String> = paths
        .iter()
        .filter_map(|p| p.to_str().map(String::from))
        .collect();

    if files.is_empty() {
        return;
    }

    let is_ready = app
        .try_state::<FrontendReady>()
        .map(|r| r.0.load(Ordering::Relaxed) == 1)
        .unwrap_or(false);

    if is_ready {
        // Frontend is loaded — emit events
        if let Some(main_window) = app.get_webview_window("main") {
            for file in &files {
                let _ = main_window.emit("file-opened", file.clone());
            }
        }
    } else {
        // Frontend not ready — store for pickup via get_opened_files
        if let Some(state) = app.try_state::<OpenedFiles>() {
            state.0.lock().unwrap().extend(files);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn read_file_returns_contents() {
        let dir = std::env::temp_dir().join("covalent_test_read");
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("test.md");
        let mut f = std::fs::File::create(&path).unwrap();
        f.write_all(b"# Hello\nWorld").unwrap();

        let result = read_file(path.to_str().unwrap().to_string());
        assert_eq!(result.unwrap(), "# Hello\nWorld");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn read_file_returns_error_for_missing() {
        let result = read_file("/nonexistent/path/file.md".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to read"));
    }

    #[test]
    fn path_escape_backslashes() {
        let path = r"C:\Users\test\file.md";
        let escaped = path.replace('\\', "\\\\").replace('"', "\\\"");
        assert_eq!(escaped, r"C:\\Users\\test\\file.md");
    }

    #[test]
    fn path_escape_quotes() {
        let path = r#"/path/to/"quoted".md"#;
        let escaped = path.replace('\\', "\\\\").replace('"', "\\\"");
        assert_eq!(escaped, r#"/path/to/\"quoted\".md"#);
    }

    #[test]
    fn window_label_increments() {
        let a = WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed);
        let b = WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed);
        assert_eq!(b, a + 1);
    }
}

fn main() {
    let mut builder = tauri::Builder::default()
        .manage(OpenedFiles(Mutex::new(Vec::new())))
        .manage(FrontendReady(AtomicU32::new(0)))
        .manage(FileWatcher(Mutex::new(None)));

    #[cfg(target_os = "macos")]
    {
        builder = builder.invoke_handler(tauri::generate_handler![
            read_file,
            get_opened_files,
            open_new_window,
            set_default_md_viewer,
            watch_file
        ]);
    }

    #[cfg(not(target_os = "macos"))]
    {
        builder = builder.invoke_handler(tauri::generate_handler![
            read_file,
            get_opened_files,
            open_new_window,
            watch_file
        ]);
    }

    builder
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
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                let files: Vec<PathBuf> = urls
                    .into_iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .collect();
                handle_opened_files(_app, files);
            }
        });
}
