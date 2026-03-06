#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};
use std::sync::atomic::{AtomicI64, Ordering};
use chrono::Local;
use sysinfo::System;

// ---------------------------------------------------------------------------
// State management structure
// ---------------------------------------------------------------------------

#[derive(Default)]
struct AppState {
    // key: scope (tag), value: "alert" | "ok"
    last_alert_state: Mutex<HashMap<String, String>>,
}

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

/// Delete log files older than `max_age_days` from the log directory.
fn cleanup_old_logs(max_age_days: u64) {
    let log_dir = match get_log_dir() {
        Ok(d) => d,
        Err(_) => return,
    };
    let cutoff = std::time::SystemTime::now()
        .checked_sub(std::time::Duration::from_secs(max_age_days * 86400));
    let cutoff = match cutoff {
        Some(t) => t,
        None => return,
    };
    if let Ok(entries) = fs::read_dir(&log_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("log") {
                if let Ok(meta) = fs::metadata(&path) {
                    if let Ok(modified) = meta.modified() {
                        if modified < cutoff {
                            let _ = fs::remove_file(&path);
                        }
                    }
                }
            }
        }
    }
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

/// Resolve a named settings file path inside the app data directory.
/// Only alphanumeric, hyphen, underscore, and dot are allowed in the filename.
fn get_named_settings_path(filename: &str) -> Result<PathBuf, String> {
    // Validate filename to prevent path traversal
    if filename.is_empty() {
        return Err("Filename must not be empty".to_string());
    }
    if filename.contains("..") {
        return Err("Filename must not contain '..'".to_string());
    }
    let valid = filename.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.');
    if !valid {
        return Err(format!("Invalid filename: {}", filename));
    }
    let dir = get_app_data_dir()?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    Ok(dir.join(filename))
}

// ---------------------------------------------------------------------------
// Slack Webhook sender
// ---------------------------------------------------------------------------

fn send_slack_notification(level: &str, tag: &str, message: &str, is_recovery: bool, context_str: &str) {
    let webhook_url = match std::env::var("SLACK_WEBHOOK_URL") {
        Ok(url) if !url.is_empty() => url,
        _ => return, // If no URL is set, do nothing
    };

    let title = if is_recovery {
        format!("RECOVERY: {}", tag)
    } else {
        format!("ALERT: {}", tag)
    };

    let payload = serde_json::json!({
        "text": format!(
            "*{title}*\n*Level*: {level}\n*Scope*: {tag}\n*Message*: {message}\n*Context*: {context_str}"
        )
    });

    // Send HTTP requests asynchronously in a separate thread to avoid blocking log writes
    std::thread::spawn(move || {
        let client = reqwest::blocking::Client::new();
        let _ = client.post(&webhook_url).json(&payload).send();
    });
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
    state: tauri::State<'_, AppState>,
) -> Result<LogResponse, String> {
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();
    let context_str = context.unwrap_or_default();
    
    // Slack notification target scopes
    let alert_scopes = [
        "map", "shopList", "video", "SYSTEM", 
        "DATA_SYNC", "CMS_DELIVERY", "ASSET_CHECK", "RENDERER_ERROR"
    ];

    let upper_level = level.to_uppercase();

    // State transition-based Slack alert management
    if alert_scopes.contains(&tag.as_str()) {
        let mut alert_states = match state.last_alert_state.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        let current_state = alert_states.get(&tag).cloned().unwrap_or_else(|| "ok".to_string());
        
        let is_error_level = upper_level == "WARN" || upper_level == "ERROR" || upper_level == "FATAL";
        
        if is_error_level && current_state == "ok" {
            // "ok" -> "alert" (New Alert Issued)
            alert_states.insert(tag.clone(), "alert".to_string());
            send_slack_notification(&upper_level, &tag, &message, false, &context_str);
        } else if upper_level == "INFO" && current_state == "alert" {
            // "alert" -> "ok" (Recovery Notification)
            alert_states.insert(tag.clone(), "ok".to_string());
            send_slack_notification(&upper_level, &tag, &message, true, &context_str);
        }
    }

    // Log String Construction
    let log_entry = if context_str.is_empty() {
        format!("[{}] [{}] [{}] {}\n", timestamp, upper_level, tag, message)
    } else {
        format!(
            "[{}] [{}] [{}] {} | {}\n",
            timestamp, upper_level, tag, message, context_str
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
// Named settings commands (per-mall settings files)
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_named_settings(filename: String) -> Result<String, String> {
    let path = get_named_settings_path(&filename)?;

    if !path.exists() {
        return Ok("{}".to_string());
    }

    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read named settings '{}': {}", filename, e))
}

#[tauri::command]
fn save_named_settings(filename: String, json: String) -> Result<String, String> {
    // Validate JSON before writing
    let _: serde_json::Value = serde_json::from_str(&json)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    let path = get_named_settings_path(&filename)?;

    fs::write(&path, &json)
        .map_err(|e| format!("Failed to write named settings '{}': {}", filename, e))?;

    Ok(json)
}

#[tauri::command]
fn settings_file_exists(filename: String) -> Result<bool, String> {
    let path = get_named_settings_path(&filename)?;
    Ok(path.exists())
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
// System info command (CPU, memory, GPU, OS)
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct SystemInfoResponse {
    cpu_name: String,
    cpu_cores: usize,
    cpu_usage: f32,
    memory_total_mb: u64,
    memory_used_mb: u64,
    memory_usage_percent: f64,
    gpu_name: String,
    os_name: String,
    os_version: String,
}

#[tauri::command]
fn get_system_info() -> SystemInfoResponse {
    let mut sys = System::new();
    // First CPU sample (populates CPU list for brand/core count)
    sys.refresh_cpu_all();
    // Wait 200ms between samples for accurate CPU usage measurement
    std::thread::sleep(std::time::Duration::from_millis(200));
    // Second CPU sample (now global_cpu_usage() returns meaningful value)
    sys.refresh_cpu_usage();
    // Memory only (skip processes, disks, networks, components)
    sys.refresh_memory();

    // CPU info
    let cpu_name = sys.cpus().first()
        .map(|c| c.brand().to_string())
        .unwrap_or_else(|| "Unknown".to_string());
    let cpu_cores = sys.cpus().len();
    let cpu_usage = sys.global_cpu_usage();

    // Memory info
    let memory_total_mb = sys.total_memory() / (1024 * 1024);
    let memory_used_mb = sys.used_memory() / (1024 * 1024);
    let memory_usage_percent = if sys.total_memory() > 0 {
        (sys.used_memory() as f64 / sys.total_memory() as f64) * 100.0
    } else {
        0.0
    };

    // GPU info via Windows wmic (cached after first call)
    let gpu_name = get_gpu_name_cached();

    // OS info
    let os_name = System::name().unwrap_or_else(|| "Unknown".to_string());
    let os_version = System::os_version().unwrap_or_else(|| "Unknown".to_string());

    SystemInfoResponse {
        cpu_name,
        cpu_cores,
        cpu_usage,
        memory_total_mb,
        memory_used_mb,
        memory_usage_percent,
        gpu_name,
        os_name,
        os_version,
    }
}

static GPU_NAME_CACHE: OnceLock<String> = OnceLock::new();

fn get_gpu_name_cached() -> String {
    GPU_NAME_CACHE.get_or_init(|| get_gpu_name()).clone()
}

fn get_gpu_name() -> String {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("wmic")
            .args(["path", "win32_VideoController", "get", "name"])
            .output();
        if let Ok(out) = output {
            let text = String::from_utf8_lossy(&out.stdout);
            let name = text.lines()
                .skip(1) // skip header "Name"
                .find(|l| !l.trim().is_empty())
                .map(|l| l.trim().to_string())
                .unwrap_or_default();
            if !name.is_empty() {
                return name;
            }
        }
    }
    "Unknown".to_string()
}

// ---------------------------------------------------------------------------
// WebView Watchdog: frontend pings Rust periodically; if no ping arrives
// within the timeout the WebView is assumed dead and the app restarts.
// ---------------------------------------------------------------------------

static LAST_PING: OnceLock<AtomicI64> = OnceLock::new();

fn now_epoch_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

#[tauri::command]
fn webview_ping() -> Result<String, String> {
    LAST_PING
        .get_or_init(|| AtomicI64::new(now_epoch_secs()))
        .store(now_epoch_secs(), Ordering::Relaxed);
    Ok("pong".to_string())
}

fn start_webview_watchdog(app_handle: tauri::AppHandle) {
    let handle = Arc::new(app_handle);
    let timeout_secs: i64 = 60;

    // Initialise the ping timestamp
    LAST_PING.get_or_init(|| AtomicI64::new(now_epoch_secs()));

    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(15));
            let last = LAST_PING
                .get()
                .map(|a| a.load(Ordering::Relaxed))
                .unwrap_or(now_epoch_secs());
            let elapsed = now_epoch_secs() - last;

            if elapsed > timeout_secs {
                let msg = format!(
                    "No WebView ping for {}s (timeout={}s). Restarting app.",
                    elapsed, timeout_secs
                );
                eprintln!("[WATCHDOG] {}", msg);
                write_to_log_file_direct("WATCHDOG", &msg);
                send_slack_notification("FATAL", "WATCHDOG", &msg, false, "");
                handle.restart();
            }
        }
    });
}

// ---------------------------------------------------------------------------
// App entry point
// ---------------------------------------------------------------------------

/// Write a critical message directly to the log file (bypasses frontend IPC).
/// Used by panic hook and watchdog where the frontend may be unavailable.
fn write_to_log_file_direct(tag: &str, message: &str) {
    if let Ok(path) = get_log_file_path() {
        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();
        let entry = format!("[{}] [FATAL] [{}] {}\n", timestamp, tag, message);
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&path) {
            let _ = file.write_all(entry.as_bytes());
        }
    }
}

/// Install a custom panic hook that logs the panic to the log file and stderr
/// before the process terminates.
fn install_panic_hook() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let payload = if let Some(s) = info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown panic payload".to_string()
        };

        let location = info.location().map_or_else(
            || "unknown location".to_string(),
            |loc| format!("{}:{}:{}", loc.file(), loc.line(), loc.column()),
        );

        let message = format!("PANIC at {}: {}", location, payload);
        eprintln!("[PANIC_HOOK] {}", message);
        write_to_log_file_direct("PANIC", &message);

        send_slack_notification("FATAL", "PANIC", &message, false, &location);

        default_hook(info);
    }));
}

fn main() {
    install_panic_hook();

    // Clean up log files older than 30 days on startup
    cleanup_old_logs(30);

    let builder = tauri::Builder::default()
        .manage(AppState::default())
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
            get_named_settings,
            save_named_settings,
            settings_file_exists,
            save_image_file,
            get_image_path,
            delete_image_file,
            read_image_file,
            get_system_info,
            webview_ping,
        ]);

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    start_webview_watchdog(app.handle().clone());

    app.run(|_app_handle, _event| {});
}