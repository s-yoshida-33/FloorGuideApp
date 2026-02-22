#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use chrono::Local;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize)]
struct FetchResponse {
    status: u16,
    body: String,
}

#[derive(Serialize, Deserialize)]
struct LogResponse {
    success: bool,
    message: String,
}

#[derive(Serialize, Deserialize)]
struct SaveImageResponse {
    success: bool,
    path: String,
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/// AppLocalData directory for Gido: %LOCALAPPDATA%/com.tti.gido
fn get_app_data_dir() -> Result<PathBuf, String> {
    dirs::data_local_dir()
        .ok_or_else(|| "Failed to get local data directory".to_string())
        .map(|d| d.join("com.tti.gido"))
}

fn get_log_dir() -> Result<PathBuf, String> {
    let dir = get_app_data_dir()?.join("logs");
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create log directory: {}", e))?;
    Ok(dir)
}

fn get_log_file_path() -> Result<PathBuf, String> {
    let log_dir = get_log_dir()?;
    let today = Local::now().format("%Y-%m-%d").to_string();
    Ok(log_dir.join(format!("gido-{}.log", today)))
}

fn get_images_dir() -> Result<PathBuf, String> {
    let dir = get_app_data_dir()?.join("images");
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create images directory: {}", e))?;
    Ok(dir)
}

fn get_settings_path() -> Result<PathBuf, String> {
    let dir = get_app_data_dir()?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    Ok(dir.join("settings.json"))
}

// ---------------------------------------------------------------------------
// Logging command
// ---------------------------------------------------------------------------

#[tauri::command]
fn write_log(
    level: String,
    tag: String,
    message: String,
    context: Option<String>,
) -> Result<LogResponse, String> {
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();

    let context_str = context.unwrap_or_default();
    let log_entry = if context_str.is_empty() {
        format!("[{}] [{}] [{}] {}\n", timestamp, level, tag, message)
    } else {
        format!(
            "[{}] [{}] [{}] {} | {}\n",
            timestamp, level, tag, message, context_str
        )
    };

    let log_file_path = get_log_file_path()?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file_path)
        .map_err(|e| format!("Failed to open log file: {}", e))?;

    file.write_all(log_entry.as_bytes())
        .map_err(|e| format!("Failed to write log: {}", e))?;

    Ok(LogResponse {
        success: true,
        message: format!("Logged to {}", log_file_path.display()),
    })
}

// ---------------------------------------------------------------------------
// HTTP proxy (CORS bypass for Bridge API)
// ---------------------------------------------------------------------------

#[tauri::command]
fn fetch_shops_proxy(url: String) -> Result<FetchResponse, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;

    let response = client
        .get(&url)
        .header("Cache-Control", "no-cache")
        .header("Pragma", "no-cache")
        .send()
        .map_err(|e| format!("HTTP error: {}", e))?;

    let status = response.status().as_u16();
    let body = response
        .text()
        .map_err(|e| format!("Body read error: {}", e))?;

    Ok(FetchResponse { status, body })
}

// ---------------------------------------------------------------------------
// Settings commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_settings() -> Result<String, String> {
    let path = get_settings_path()?;

    if !path.exists() {
        return Ok("{}".to_string());
    }

    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read settings: {}", e))
}

#[tauri::command]
fn save_settings(json: String) -> Result<String, String> {
    // Validate JSON before writing
    let _: serde_json::Value = serde_json::from_str(&json)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    let path = get_settings_path()?;

    fs::write(&path, &json)
        .map_err(|e| format!("Failed to write settings: {}", e))?;

    Ok(json)
}

// ---------------------------------------------------------------------------
// Image file commands (Base64-free: receives raw bytes from frontend)
// ---------------------------------------------------------------------------

#[tauri::command]
fn save_image_file(filename: String, data: Vec<u8>) -> Result<SaveImageResponse, String> {
    let images_dir = get_images_dir()?;

    // Sanitize filename to prevent path traversal
    let safe_name = std::path::Path::new(&filename)
        .file_name()
        .ok_or_else(|| "Invalid filename".to_string())?
        .to_string_lossy()
        .to_string();

    let file_path = images_dir.join(&safe_name);

    fs::write(&file_path, &data)
        .map_err(|e| format!("Failed to write image file: {}", e))?;

    let abs_path = file_path
        .canonicalize()
        .unwrap_or(file_path)
        .to_string_lossy()
        .to_string();

    Ok(SaveImageResponse {
        success: true,
        path: abs_path,
    })
}

#[tauri::command]
fn get_image_path(filename: String) -> Result<String, String> {
    let images_dir = get_images_dir()?;
    let file_path = images_dir.join(&filename);

    if file_path.exists() {
        Ok(file_path
            .canonicalize()
            .unwrap_or(file_path)
            .to_string_lossy()
            .to_string())
    } else {
        Ok(String::new())
    }
}

#[tauri::command]
fn delete_image_file(filename: String) -> Result<bool, String> {
    let images_dir = get_images_dir()?;
    let safe_name = std::path::Path::new(&filename)
        .file_name()
        .ok_or_else(|| "Invalid filename".to_string())?
        .to_string_lossy()
        .to_string();

    let file_path = images_dir.join(&safe_name);

    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to delete image: {}", e))?;
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Read image file as bytes (for local paths from Bridge/CMS)
#[tauri::command]
fn read_image_file(file_path: String) -> Result<Vec<u8>, String> {
    fs::read(&file_path)
        .map_err(|e| format!("Failed to read image file: {}", e))
}

// ---------------------------------------------------------------------------
// App entry point
// ---------------------------------------------------------------------------

fn main() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            write_log,
            fetch_shops_proxy,
            get_settings,
            save_settings,
            save_image_file,
            get_image_path,
            delete_image_file,
            read_image_file,
        ]);

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, _event| {});
}
