import { useEffect } from 'react';
import type { TerminalTab } from '../lib/types';

interface ShortcutsProps {
  tabs: TerminalTab[];
  activeTabId: string | null;
  spawnTerminal: () => void;
  killTerminal: (tabId: string, ptyId: string) => void;
  setActiveTab: (id: string) => void;
  toggleFloating: (id: string, force?: boolean) => void;
}

export const useTerminalShortcuts = ({
  tabs,
  activeTabId,
  spawnTerminal,
  killTerminal,
  setActiveTab,
  toggleFloating,
}: ShortcutsProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Super+Enter or Alt+Enter to spawn
      if ((e.metaKey || e.altKey) && e.key === 'Enter') {
        e.preventDefault();
        spawnTerminal();
      }
      
      // Super+Q or Alt+Q to close active
      if ((e.metaKey || e.altKey) && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        if (activeTabId) {
          const activeTab = tabs.find(t => t.id === activeTabId);
          if (activeTab) {
            killTerminal(activeTab.id, activeTab.ptyId);
          }
        }
      }

      // Alt+F to toggle floating
      if (e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (activeTabId) toggleFloating(activeTabId);
      }

      // Esc to unfloat active
      if (e.key === 'Escape') {
        if (activeTabId) toggleFloating(activeTabId, false);
      }

      // Super/Alt + ArrowKeys to navigate
      if ((e.metaKey || e.altKey) && tabs.length > 1) {
        const tiledTabs = tabs.filter(t => !t.isFloating);
        const idx = tiledTabs.findIndex(t => t.id === activeTabId);
        if (idx !== -1) {
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveTab(tiledTabs[(idx + 1) % tiledTabs.length].id);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveTab(tiledTabs[(idx - 1 + tiledTabs.length) % tiledTabs.length].id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, tabs, spawnTerminal, killTerminal, setActiveTab, toggleFloating]);
};
