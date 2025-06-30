use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

pub struct PtyProcess {
    id: String,
    writer: Box<dyn Write + Send>,
}

pub struct PtyManager {
    processes: Arc<Mutex<HashMap<String, PtyProcess>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn spawn_pty(
        &self,
        app_handle: AppHandle,
        shell: Option<String>,
        cwd: Option<String>,
        cols: u16,
        rows: u16,
    ) -> Result<String, String> {
        let pty_system = native_pty_system();
        
        // Create a new pty
        let pty_pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open PTY: {}", e))?;

        // Configure the command
        let shell = shell.unwrap_or_else(|| {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
        });
        
        let mut cmd = CommandBuilder::new(&shell);
        
        if let Some(cwd) = cwd {
            cmd.cwd(cwd);
        }

        // Spawn the child process
        let child = pty_pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell: {}", e))?;

        let pty_id = Uuid::new_v4().to_string();
        let pty_id_clone = pty_id.clone();

        // Get the reader and writer
        let mut reader = pty_pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone reader: {}", e))?;
        
        let writer = pty_pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to take writer: {}", e))?;

        // Store the pty process
        {
            let mut processes = self.processes.lock().unwrap();
            processes.insert(
                pty_id.clone(),
                PtyProcess {
                    id: pty_id.clone(),
                    writer,
                },
            );
        }

        // Start reading output in a separate thread
        thread::spawn(move || {
            let mut buffer = [0u8; 4096];
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => {
                        // EOF - process has exited
                        app_handle
                            .emit("pty-exit", &pty_id_clone)
                            .unwrap_or_else(|e| eprintln!("Failed to emit pty-exit: {}", e));
                        break;
                    }
                    Ok(n) => {
                        let data = &buffer[..n];
                        let output = String::from_utf8_lossy(data).to_string();
                        
                        app_handle
                            .emit(
                                "pty-output",
                                serde_json::json!({
                                    "id": &pty_id_clone,
                                    "data": output
                                }),
                            )
                            .unwrap_or_else(|e| eprintln!("Failed to emit pty-output: {}", e));
                    }
                    Err(e) => {
                        eprintln!("Error reading from PTY: {}", e);
                        break;
                    }
                }
            }
        });

        Ok(pty_id)
    }

    pub fn write_to_pty(&self, id: &str, data: &str) -> Result<(), String> {
        let mut processes = self.processes.lock().unwrap();
        
        if let Some(process) = processes.get_mut(id) {
            process
                .writer
                .write_all(data.as_bytes())
                .map_err(|e| format!("Failed to write to PTY: {}", e))?;
            
            process
                .writer
                .flush()
                .map_err(|e| format!("Failed to flush PTY: {}", e))?;
            
            Ok(())
        } else {
            Err(format!("PTY with id {} not found", id))
        }
    }

    pub fn resize_pty(&self, id: &str, cols: u16, rows: u16) -> Result<(), String> {
        // Note: portable-pty doesn't provide a direct resize method
        // You might need to implement this differently or skip it
        Ok(())
    }

    pub fn kill_pty(&self, id: &str) -> Result<(), String> {
        let mut processes = self.processes.lock().unwrap();
        
        if processes.remove(id).is_some() {
            Ok(())
        } else {
            Err(format!("PTY with id {} not found", id))
        }
    }
}