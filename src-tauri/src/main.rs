#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use chrono::Local;
use sysinfo::System;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager, RunEvent, WindowEvent};

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

fn get_mall_id_from_settings() -> String {
    let path = match get_settings_path() {
        Ok(p) => p,
        Err(_) => return "unknown".to_string(),
    };
    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return "unknown".to_string(),
    };
    let json: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return "unknown".to_string(),
    };
    json.get("mallId")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string()
}

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

    let app_version = env!("CARGO_PKG_VERSION");
    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().into_owned())
        .unwrap_or_else(|_| "unknown".to_string());
    let mall_id = get_mall_id_from_settings();

    let payload = serde_json::json!({
        "text": format!(
            "*{title}*\n*Level*: {level}\n*Scope*: {tag}\n*App*: Gido\n*Version*: {app_version}\n*Mall*: {mall_id}\n*Host*: {hostname}\n*Message*: {message}\n*Context*: {context_str}"
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
        "MAP", "SHOPLIST", "VIDEO",
        "DATA_SYNC", "CMS_DELIVERY", "SSE",
        "ASSET_CHECK",
        "SYSTEM", "RENDERER_ERROR", "APP", "UPDATER", "CONFIG",
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
/// Atomic write: writes to a temporary file then renames to the target path.
/// Prevents data corruption if the app crashes mid-write.
fn atomic_write(path: &std::path::Path, data: &str) -> Result<(), String> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, data)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;
    fs::rename(&tmp, path)
        .map_err(|e| format!("Failed to rename temp file: {}", e))?;
    Ok(())
}

#[tauri::command]
fn save_settings(json: String) -> Result<String, String> {
    // Validate JSON before writing
    let _: serde_json::Value = serde_json::from_str(&json)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    let path = get_settings_path()?;
    atomic_write(&path, &json)?;

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
    atomic_write(&path, &json)?;

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
// S3 map sync commands
// ---------------------------------------------------------------------------

/// Validate a path component (mall_id or hostname) to prevent traversal.
fn validate_path_component(s: &str, label: &str) -> Result<String, String> {
    if s.is_empty() {
        return Err(format!("{} must not be empty", label));
    }
    // Allow alphanumeric, hyphen, underscore, dot (no slashes, no spaces, no ..)
    if !s.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.') {
        return Err(format!("{} contains invalid characters: {}", label, s));
    }
    if s == ".." || s.contains("..") {
        return Err(format!("{} must not contain '..': {}", label, s));
    }
    Ok(s.to_string())
}

/// Returns and creates the local medias/maps directory for a given mall + hostname.
fn get_maps_dir_inner(mall_id: &str, hostname: &str) -> Result<PathBuf, String> {
    let safe_mall = validate_path_component(mall_id, "mall_id")?;
    let safe_host = validate_path_component(hostname, "hostname")?;
    let dir = get_app_data_dir()?
        .join("medias").join("maps")
        .join(&safe_mall).join(&safe_host);
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create maps dir: {}", e))?;
    Ok(dir)
}

#[derive(Serialize)]
struct LocalMapEntry {
    /// Filename only (e.g. "1F-map-2026-03-24-14-07-21.webp")
    filename: String,
    /// Absolute path on disk
    abs_path: String,
}

/// Download a single .webp map image from S3 and save it locally.
/// Emits "map-download-progress" events: { phase, percent, message }
/// Old .webp files in the same directory are removed on success.
/// Returns the absolute path of the saved file.
#[tauri::command]
async fn sync_map_from_s3(
    app: tauri::AppHandle,
    mall_id: String,
    hostname: String,
    file_url: String,
    filename: String,
) -> Result<String, String> {
    // Validate filename – only simple webp files allowed
    let safe_name = std::path::Path::new(&filename)
        .file_name()
        .ok_or_else(|| "Invalid filename".to_string())?
        .to_string_lossy()
        .to_string();

    if !safe_name.ends_with(".webp") {
        return Err(format!("Only .webp files are supported, got: {}", safe_name));
    }

    let maps_dir = get_maps_dir_inner(&mall_id, &hostname)?;

    let _ = app.emit("map-download-progress", serde_json::json!({
        "phase": "started", "percent": 0,
        "message": format!("マップ画像をダウンロード中: {}", safe_name)
    }));

    // Download in a blocking thread so we don't block the async executor
    let url = file_url.clone();
    let bytes = tokio::task::spawn_blocking(move || -> Result<Vec<u8>, String> {
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .user_agent("Gido-MediaUpdater/1.0")
            .build()
            .map_err(|e| format!("HTTP client error: {}", e))?;

        let response = client.get(&url).send()
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("HTTP {}: {}", response.status(), url));
        }

        response.bytes()
            .map(|b| b.to_vec())
            .map_err(|e| format!("Failed to read response body: {}", e))
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    // Remove old .webp files in this directory before saving the new one
    if let Ok(entries) = fs::read_dir(&maps_dir) {
        for entry in entries.flatten() {
            if entry.path().extension().and_then(|e| e.to_str()) == Some("webp") {
                let _ = fs::remove_file(entry.path());
            }
        }
    }

    let target_path = maps_dir.join(&safe_name);
    fs::write(&target_path, &bytes)
        .map_err(|e| format!("Failed to write map file: {}", e))?;

    let abs_path = target_path
        .canonicalize()
        .unwrap_or(target_path)
        .to_string_lossy()
        .to_string();

    let _ = app.emit("map-download-progress", serde_json::json!({
        "phase": "finished", "percent": 100,
        "message": "ダウンロード完了"
    }));

    Ok(abs_path)
}

/// Return all .webp files present in the local medias/maps/{mall_id}/{hostname}/ directory.
/// Used after `sync_map_from_s3` to get the asset path for rendering.
#[tauri::command]
fn list_local_maps(mall_id: String, hostname: String) -> Result<Vec<LocalMapEntry>, String> {
    let maps_dir = match get_maps_dir_inner(&mall_id, &hostname) {
        Ok(d) => d,
        Err(_) => return Ok(vec![]),
    };

    let mut entries: Vec<LocalMapEntry> = vec![];

    if let Ok(read_dir) = fs::read_dir(&maps_dir) {
        for entry in read_dir.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("webp") {
                let filename = path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                let abs_path = path
                    .canonicalize()
                    .unwrap_or(path)
                    .to_string_lossy()
                    .to_string();
                entries.push(LocalMapEntry { filename, abs_path });
            }
        }
    }

    Ok(entries)
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
        // Run wmic in a background thread with a 10-second timeout to avoid
        // hanging the caller if the wmic process stalls.
        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let result = Command::new("wmic")
                .args(["path", "win32_VideoController", "get", "name"])
                .output();
            let _ = tx.send(result);
        });
        match rx.recv_timeout(std::time::Duration::from_secs(10)) {
            Ok(Ok(out)) if out.status.success() => {
                let text = String::from_utf8_lossy(&out.stdout);
                let name = text.lines()
                    .skip(1)
                    .find(|l| !l.trim().is_empty())
                    .map(|l| l.trim().to_string())
                    .unwrap_or_default();
                if !name.is_empty() {
                    return name;
                }
            }
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                eprintln!("[SYSTEM_INFO] wmic timed out after 10s");
            }
            _ => {}
        }
    }
    "Unknown".to_string()
}

// ---------------------------------------------------------------------------
// WebView Watchdog: frontend pings Rust periodically; if no ping arrives
// within the timeout the WebView is assumed dead and the app restarts.
// ---------------------------------------------------------------------------

static LAST_PING: OnceLock<AtomicI64> = OnceLock::new();
static FORCE_QUIT: AtomicBool = AtomicBool::new(false);
/// Set to true after the first successful webview_ping, so the restart
/// counter file is only reset once per process lifetime.
static WATCHDOG_COUNTER_RESET: AtomicBool = AtomicBool::new(false);
/// When true, the watchdog skips timeout checks. Used during app updates
/// where downloadAndInstall blocks the WebView and prevents ping responses.
static WATCHDOG_PAUSED: AtomicBool = AtomicBool::new(false);

/// Maximum consecutive watchdog-triggered restarts before giving up.
/// Prevents infinite restart loops when the WebView cannot recover.
const MAX_WATCHDOG_RESTARTS: i32 = 5;

fn now_epoch_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

fn get_watchdog_counter_path() -> Result<PathBuf, String> {
    get_app_data_dir().map(|d| d.join("watchdog_restart_count"))
}

fn read_watchdog_counter() -> i32 {
    get_watchdog_counter_path()
        .ok()
        .and_then(|p| fs::read_to_string(&p).ok())
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(0)
}

fn write_watchdog_counter(count: i32) {
    if let Ok(path) = get_watchdog_counter_path() {
        let _ = fs::write(&path, count.to_string());
    }
}

#[tauri::command]
fn webview_ping() -> Result<String, String> {
    LAST_PING
        .get_or_init(|| AtomicI64::new(now_epoch_secs()))
        .store(now_epoch_secs(), Ordering::Relaxed);
    // Reset restart counter once on first successful ping (WebView is healthy)
    if !WATCHDOG_COUNTER_RESET.swap(true, Ordering::Relaxed) {
        write_watchdog_counter(0);
    }
    Ok("pong".to_string())
}

/// Pause the watchdog during operations that block the WebView (e.g., app updates).
/// While paused, the watchdog refreshes the last-ping timestamp on each check cycle
/// so it won't trigger a restart when resumed.
#[tauri::command]
fn pause_watchdog() -> Result<String, String> {
    WATCHDOG_PAUSED.store(true, Ordering::Relaxed);
    LAST_PING
        .get_or_init(|| AtomicI64::new(now_epoch_secs()))
        .store(now_epoch_secs(), Ordering::Relaxed);
    Ok("paused".to_string())
}

/// Resume the watchdog after the blocking operation completes.
#[tauri::command]
fn resume_watchdog() -> Result<String, String> {
    LAST_PING
        .get_or_init(|| AtomicI64::new(now_epoch_secs()))
        .store(now_epoch_secs(), Ordering::Relaxed);
    WATCHDOG_PAUSED.store(false, Ordering::Relaxed);
    Ok("resumed".to_string())
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

            // Skip timeout check while paused (e.g., during app update download).
            // Keep refreshing the timestamp so we don't see stale elapsed time on resume.
            if WATCHDOG_PAUSED.load(Ordering::Relaxed) {
                LAST_PING
                    .get()
                    .map(|a| a.store(now_epoch_secs(), Ordering::Relaxed));
                continue;
            }

            if elapsed > timeout_secs {
                let count = read_watchdog_counter();
                if count >= MAX_WATCHDOG_RESTARTS {
                    let msg = format!(
                        "Watchdog reached max restarts ({}). Stopping auto-restart. Manual intervention required.",
                        MAX_WATCHDOG_RESTARTS
                    );
                    eprintln!("[WATCHDOG] {}", msg);
                    write_to_log_file_direct("WATCHDOG", &msg);
                    send_slack_notification("FATAL", "WATCHDOG", &msg, false, "");
                    return; // Stop the watchdog thread
                }
                write_watchdog_counter(count + 1);

                let msg = format!(
                    "No WebView ping for {}s (timeout={}s). Restarting app. (attempt {}/{})",
                    elapsed, timeout_secs, count + 1, MAX_WATCHDOG_RESTARTS
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
// Focus guard: EVENT_SYSTEM_FOREGROUND hook + periodic TOPMOST enforcement
// (Windows only)
//
// Three-layer protection against other windows appearing above Gido:
// 1. Event hook — catches windows that steal keyboard focus (immediate)
// 2. Timer     — periodic enforcement every 5 seconds:
//    2a. Demote foreign visible TOPMOST windows to NOTOPMOST (EnumWindows)
//    2b. Re-assert our own TOPMOST position
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
mod focus_guard {
    use std::sync::atomic::{AtomicIsize, AtomicBool, Ordering};

    // Win32 type aliases
    type HWND = isize;
    type HWINEVENTHOOK = isize;
    type DWORD = u32;
    type UINT = u32;
    type LONG = i32;
    type BOOL = i32;
    type WPARAM = usize;
    type LPARAM = isize;
    type UINT_PTR = usize;
    type WNDENUMPROC = unsafe extern "system" fn(HWND, LPARAM) -> BOOL;

    // Win32 constants
    const EVENT_SYSTEM_FOREGROUND: DWORD = 0x0003;
    const WINEVENT_OUTOFCONTEXT: DWORD = 0x0000;
    const HWND_TOPMOST: HWND = -1;
    const HWND_NOTOPMOST: HWND = -2;
    const SWP_NOMOVE: UINT = 0x0002;
    const SWP_NOSIZE: UINT = 0x0001;
    const SWP_NOACTIVATE: UINT = 0x0010;
    const SWP_SHOWWINDOW: UINT = 0x0040;
    const WM_TIMER: UINT = 0x0113;
    const GWL_EXSTYLE: i32 = -20;
    const WS_EX_TOPMOST: LONG = 0x0008;
    const TOPMOST_TIMER_ID: UINT_PTR = 1;
    /// Enforce TOPMOST every 5 seconds: demote foreign TOPMOST windows and
    /// re-assert our own position.
    const TOPMOST_INTERVAL_MS: u32 = 5_000;

    #[repr(C)]
    #[allow(non_snake_case)]
    struct MSG {
        hwnd: HWND,
        message: UINT,
        wParam: WPARAM,
        lParam: LPARAM,
        time: DWORD,
        pt_x: LONG,
        pt_y: LONG,
    }

    type WINEVENTPROC = unsafe extern "system" fn(
        HWINEVENTHOOK, DWORD, HWND, LONG, LONG, DWORD, DWORD,
    );

    #[link(name = "user32")]
    extern "system" {
        fn SetWinEventHook(
            event_min: DWORD,
            event_max: DWORD,
            hmod_win_event_proc: isize,
            pfn_win_event_proc: WINEVENTPROC,
            id_process: DWORD,
            id_thread: DWORD,
            dw_flags: DWORD,
        ) -> HWINEVENTHOOK;
        fn GetForegroundWindow() -> HWND;
        fn SetForegroundWindow(hwnd: HWND) -> BOOL;
        fn SetWindowPos(
            hwnd: HWND,
            hwnd_insert_after: HWND,
            x: i32, y: i32, cx: i32, cy: i32,
            u_flags: UINT,
        ) -> BOOL;
        fn GetMessageW(
            msg: *mut MSG,
            hwnd: HWND,
            msg_filter_min: UINT,
            msg_filter_max: UINT,
        ) -> BOOL;
        fn DispatchMessageW(msg: *const MSG) -> isize;
        fn SetTimer(
            hwnd: HWND,
            id_event: UINT_PTR,
            elapse: UINT,
            lp_timer_func: LPARAM,
        ) -> UINT_PTR;
        fn EnumWindows(
            lp_enum_func: WNDENUMPROC,
            l_param: LPARAM,
        ) -> BOOL;
        fn GetWindowLongW(hwnd: HWND, n_index: i32) -> LONG;
        fn IsWindowVisible(hwnd: HWND) -> BOOL;
    }

    /// HWND of the Gido main window (set once at startup).
    static OWN_HWND: AtomicIsize = AtomicIsize::new(0);
    /// Guards against spawning multiple restore threads concurrently.
    static RESTORE_PENDING: AtomicBool = AtomicBool::new(false);

    /// Seconds to wait before restoring focus.
    /// Short-lived popups (e.g. RustDesk connection toast) will have
    /// disappeared by this time, so we only act on persistent windows.
    const RESTORE_DELAY_SECS: u64 = 3;

    /// EnumWindows callback: demote any visible foreign TOPMOST window to
    /// NOTOPMOST so it drops below our window in the Z-order.
    /// lParam carries our own HWND to skip.
    unsafe extern "system" fn enum_demote_topmost(hwnd: HWND, l_param: LPARAM) -> BOOL {
        let own = l_param as HWND;
        if hwnd == own || IsWindowVisible(hwnd) == 0 {
            return 1;
        }
        let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
        if (ex_style & WS_EX_TOPMOST) != 0 {
            SetWindowPos(
                hwnd, HWND_NOTOPMOST,
                0, 0, 0, 0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
            );
        }
        1
    }

    /// Layer 1: EVENT_SYSTEM_FOREGROUND callback.
    /// Fires when another process takes keyboard focus.
    unsafe extern "system" fn hook_proc(
        _hook: HWINEVENTHOOK,
        _event: DWORD,
        hwnd: HWND,
        _id_object: LONG,
        _id_child: LONG,
        _event_thread: DWORD,
        _event_time: DWORD,
    ) {
        let own = OWN_HWND.load(Ordering::Relaxed);
        // Ignore if we haven't initialised yet, or it's our own window
        if own == 0 || hwnd == own {
            return;
        }

        // Only one pending restore at a time
        if RESTORE_PENDING.swap(true, Ordering::Relaxed) {
            return;
        }

        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_secs(RESTORE_DELAY_SECS));

            unsafe {
                let fg = GetForegroundWindow();
                if fg != own {
                    SetWindowPos(
                        own, HWND_TOPMOST,
                        0, 0, 0, 0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW,
                    );
                    SetForegroundWindow(own);
                    super::write_to_log_file_direct(
                        "FOCUS_GUARD",
                        "Restored foreground focus (another window stole focus)",
                    );
                }
            }

            RESTORE_PENDING.store(false, Ordering::Relaxed);
        });
    }

    /// Start the focus guard on a dedicated thread with its own message pump.
    ///
    /// Layer 1: `SetWinEventHook(EVENT_SYSTEM_FOREGROUND)` — immediate
    ///          response when another window steals keyboard focus.
    /// Layer 2: `SetTimer` — periodic TOPMOST enforcement that demotes
    ///          foreign TOPMOST windows (e.g. RustDesk overlays) and
    ///          re-asserts our own TOPMOST position.
    pub fn start(hwnd: isize) {
        OWN_HWND.store(hwnd, Ordering::Relaxed);

        std::thread::spawn(move || {
            unsafe {
                // Layer 1: foreground event hook
                let hook = SetWinEventHook(
                    EVENT_SYSTEM_FOREGROUND,
                    EVENT_SYSTEM_FOREGROUND,
                    0,
                    hook_proc,
                    0, 0,
                    WINEVENT_OUTOFCONTEXT,
                );

                if hook == 0 {
                    eprintln!("[FOCUS_GUARD] Failed to set foreground event hook");
                    super::write_to_log_file_direct(
                        "FOCUS_GUARD",
                        "Failed to set SetWinEventHook for EVENT_SYSTEM_FOREGROUND",
                    );
                    return;
                }

                // Layer 2: periodic TOPMOST enforcement timer
                SetTimer(0, TOPMOST_TIMER_ID, TOPMOST_INTERVAL_MS, 0);

                // Message pump — required for both the event hook and WM_TIMER
                let mut msg: MSG = std::mem::zeroed();
                while GetMessageW(&mut msg, 0, 0, 0) > 0 {
                    if msg.message == WM_TIMER && msg.wParam == TOPMOST_TIMER_ID {
                        // Demote all foreign visible TOPMOST windows first
                        EnumWindows(enum_demote_topmost, hwnd as LPARAM);
                        // Then re-assert our own TOPMOST
                        SetWindowPos(
                            hwnd, HWND_TOPMOST,
                            0, 0, 0, 0,
                            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                        );
                        continue;
                    }
                    DispatchMessageW(&msg);
                }
            }
        });
    }
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

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    FORCE_QUIT.store(true, Ordering::Relaxed);
    app.exit(0);
}

/// Create system tray icon with context menu.
/// The tray keeps the process alive even when all windows are closed,
/// allowing the watchdog to recreate the window after a crash.
fn setup_system_tray(app: &tauri::App) -> Result<tauri::tray::TrayIcon, Box<dyn std::error::Error>> {
    let show_item = MenuItem::with_id(app, "show", "表示", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "終了", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    let tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().cloned().unwrap())
        .tooltip(app.config().product_name.as_deref().unwrap_or("Gido"))
        .menu(&menu)
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "quit" => {
                    FORCE_QUIT.store(true, Ordering::Relaxed);
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(tray)
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
        .on_window_event(|_window, event| {
            // Prevent window from closing — kiosk mode.
            // The app can only be exited via the system tray "終了" menu.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
            }
        })
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
            quit_app,
            webview_ping,
            pause_watchdog,
            resume_watchdog,
            sync_map_from_s3,
            list_local_maps,
        ]);

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // Setup system tray — keeps process alive when window is closed/crashed
    let _tray = match setup_system_tray(&app) {
        Ok(tray) => Some(tray),
        Err(e) => {
            eprintln!("[TRAY] Failed to setup system tray: {}", e);
            write_to_log_file_direct("TRAY", &format!("Failed to setup: {}", e));
            None
        }
    };

    start_webview_watchdog(app.handle().clone());

    // Start foreground focus guard (Windows only).
    // Detects when another window steals focus and restores the Gido window
    // after a short delay. Prevents stale RustDesk overlays from persisting.
    #[cfg(target_os = "windows")]
    {
        if let Some(window) = app.get_webview_window("main") {
            match window.hwnd() {
                Ok(hwnd) => {
                    focus_guard::start(hwnd.0 as isize);
                    write_to_log_file_direct("FOCUS_GUARD", "Foreground event hook started");
                }
                Err(e) => {
                    let msg = format!("Failed to get main window HWND: {}", e);
                    eprintln!("[FOCUS_GUARD] {}", msg);
                    write_to_log_file_direct("FOCUS_GUARD", &msg);
                }
            }
        }
    }

    app.run(|_app_handle, event| {
        // Prevent the app from exiting when the last window closes.
        // Only FORCE_QUIT (set by tray "終了" or quit_app command) allows exit.
        if let RunEvent::ExitRequested { api, .. } = &event {
            if !FORCE_QUIT.load(Ordering::Relaxed) {
                api.prevent_exit();
            }
        }
    });
}