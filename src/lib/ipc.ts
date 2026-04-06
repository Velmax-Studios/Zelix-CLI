import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { PtyInfo } from './types';

// ==================== PTY COMMANDS ====================

export async function ptySpawn(args: {
  cwd?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cols: number;
  rows: number;
}): Promise<string> {
  return await invoke('pty_spawn', args);
}

export async function ptyWrite(id: string, data: string): Promise<void> {
  return await invoke('pty_write', { id, data });
}

export async function ptyResize(id: string, cols: number, rows: number): Promise<void> {
  return await invoke('pty_resize', { id, cols, rows });
}

export async function ptyKill(id: string): Promise<void> {
  return await invoke('pty_kill', { id });
}

export async function ptyHasActiveProcess(id: string): Promise<boolean> {
  return await invoke('pty_has_active_process', { id });
}

export async function ptyList(): Promise<PtyInfo[]> {
  return await invoke('pty_list');
}

// ==================== PTY EVENTS ====================

export async function onPtyData(id: string, callback: (data: string) => void): Promise<UnlistenFn> {
  return await listen<string>(`pty-data-${id}`, (event) => {
    callback(event.payload);
  });
}

export async function onPtyExit(id: string, callback: () => void): Promise<UnlistenFn> {
  return await listen(`pty-exit-${id}`, () => {
    callback();
  });
}
