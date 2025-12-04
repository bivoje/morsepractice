use std::fs;

#[tauri::command]
fn load_wordserver_from_path(path: Option<String>) -> Result<Vec<String>, String> {
    // path is None, use ./wordserver.txt
    let path = path.unwrap_or("./wordserver.txt".to_string());
    let txt = fs::read_to_string(&path).map_err(|e| format!("failed to read {}: {}", path, e))?;
    let mut vec = Vec::new();
    for line in txt.lines() {
        let t = line.trim();
        if !t.is_empty() {
            vec.push(t.to_string());
        }
    }

    Ok(vec)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_wordserver_from_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
