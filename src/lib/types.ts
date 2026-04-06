// ========== TERMINAL ==========
export interface PtyInfo {
  id: string;
  cols: number;
  rows: number;
  cwd: string;
  is_alive: boolean;
}

export interface TerminalTab {
  id: string;
  ptyId: string;
  title: string;
}

// ========== PROJECT/SETTINGS ==========
// Reserved for future global settings if needed
export interface AppSettings {
  defaultTheme: string;
}
