import { create } from 'zustand';
import type { TerminalTab } from '../lib/types';

interface TerminalStore {
  tabs: TerminalTab[];
  activeTabId: string | null;

  addTab: (tab: TerminalTab) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabTitle: (id: string, title: string) => void;
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  tabs: [],
  activeTabId: null,

  addTab: (tab) => set((s) => ({
    tabs: [...s.tabs, tab],
    activeTabId: tab.id,
  })),

  removeTab: (id) => set((s) => {
    const newTabs = s.tabs.filter((t) => t.id !== id);
    let newActive = s.activeTabId;
    if (s.activeTabId === id) {
      const idx = s.tabs.findIndex((t) => t.id === id);
      newActive = newTabs[Math.min(idx, newTabs.length - 1)]?.id || null;
    }
    return { tabs: newTabs, activeTabId: newActive };
  }),

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTabTitle: (id, title) => set((s) => ({
    tabs: s.tabs.map((t) => t.id === id ? { ...t, title } : t),
  })),
}));
