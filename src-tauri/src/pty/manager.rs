use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use parking_lot::Mutex;
use sysinfo::{System, Pid};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtyInfo {
    pub id: String,
    pub cols: u16,
    pub rows: u16,
    pub cwd: String,
    pub is_alive: bool,
}

struct PtyInstance {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    shell_pid: u32,
    info: PtyInfo,
}

pub struct PtyManager {
    instances: Arc<Mutex<HashMap<String, PtyInstance>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            instances: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn spawn(
        &self,
        app_handle: &AppHandle,
        cols: u16,
        rows: u16,
        cwd: Option<String>,
        command: Option<String>,
        args: Option<Vec<String>>,
        env: Option<HashMap<String, String>>,
    ) -> Result<String, String> {
        let pty_system = native_pty_system();
        let id = Uuid::new_v4().to_string();

        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pair = pty_system
            .openpty(size)
            .map_err(|e| format!("Failed to open PTY: {}", e))?;

        let shell = if cfg!(target_os = "windows") {
            "powershell.exe".to_string()
        } else {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
        };

        let cmd_str = command.unwrap_or(shell);
        let mut cmd = CommandBuilder::new(&cmd_str);

        if let Some(a) = args {
            for arg in a {
                cmd.arg(arg);
            }
        }

        if let Some(dir) = &cwd {
            cmd.cwd(dir);
        }

        if let Some(env_vars) = env {
            for (key, value) in env_vars {
                cmd.env(key, value);
            }
        }

        // Set TERM for proper xterm.js rendering
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn command: {}", e))?;

        let shell_pid = child.process_id();

        // Drop slave — we only interact via the master
        drop(pair.slave);

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone reader: {}", e))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to take writer: {}", e))?;

        let info = PtyInfo {
            id: id.clone(),
            cols,
            rows,
            cwd: cwd.unwrap_or_default(),
            is_alive: true,
        };

        let instance = PtyInstance {
            master: pair.master,
            writer,
            shell_pid: shell_pid.unwrap_or(0),
            info,
        };

        self.instances.lock().insert(id.clone(), instance);

        // Spawn reader thread that emits data events to the frontend
        let read_id = id.clone();
        let handle = app_handle.clone();
        let instances = self.instances.clone();

        thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        // PTY closed
                        let mut locked = instances.lock();
                        if let Some(inst) = locked.get_mut(&read_id) {
                            inst.info.is_alive = false;
                        }
                        let _ = handle.emit(
                            &format!("pty-exit-{}", read_id),
                            read_id.clone(),
                        );
                        break;
                    }
                    Ok(n) => {
                        // Send raw bytes as base64 to avoid UTF-8 issues
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = handle.emit(
                            &format!("pty-data-{}", read_id),
                            data,
                        );
                    }
                    Err(_) => {
                        let mut locked = instances.lock();
                        if let Some(inst) = locked.get_mut(&read_id) {
                            inst.info.is_alive = false;
                        }
                        let _ = handle.emit(
                            &format!("pty-exit-{}", read_id),
                            read_id.clone(),
                        );
                        break;
                    }
                }
            }
        });

        Ok(id)
    }

    pub fn write(&self, id: &str, data: &str) -> Result<(), String> {
        let mut instances = self.instances.lock();
        let instance = instances
            .get_mut(id)
            .ok_or_else(|| format!("PTY {} not found", id))?;

        instance
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("Failed to write to PTY: {}", e))?;

        instance
            .writer
            .flush()
            .map_err(|e| format!("Failed to flush PTY: {}", e))?;

        Ok(())
    }

    pub fn resize(&self, id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let mut instances = self.instances.lock();
        let instance = instances
            .get_mut(id)
            .ok_or_else(|| format!("PTY {} not found", id))?;

        instance
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize PTY: {}", e))?;

        instance.info.cols = cols;
        instance.info.rows = rows;

        Ok(())
    }

    pub fn kill(&self, id: &str) -> Result<(), String> {
        let mut instances = self.instances.lock();
        instances
            .remove(id)
            .ok_or_else(|| format!("PTY {} not found", id))?;
        // Dropping the instance closes the master PTY, which signals the child
        Ok(())
    }

    pub fn has_active_process(&self, id: &str) -> bool {
        let instances = self.instances.lock();
        let Some(instance) = instances.get(id) else {
            return false;
        };

        let shell_pid = instance.shell_pid;
        
        // Refresh only what we need to minimize overhead
        let mut sys = System::new_all();
        sys.refresh_all();

        // A terminal is "active" if its shell has any child processes
        let target_pid = Pid::from(shell_pid as usize);
        sys.processes().values().any(|p| {
            if let Some(parent_pid) = p.parent() {
                parent_pid == target_pid
            } else {
                false
            }
        })
    }

    pub fn list(&self) -> Vec<PtyInfo> {
        let instances = self.instances.lock();
        instances.values().map(|i| i.info.clone()).collect()
    }
}
