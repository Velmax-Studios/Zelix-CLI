import React, { useCallback, useState, useMemo } from 'react';
import { useTerminalStore } from '../../stores/terminalStore';
import { ptySpawn, ptyKill, ptyHasActiveProcess } from '../../lib/ipc';
import { useTerminalLayout } from '../../hooks/useTerminalLayout';
import { useTerminalDrag } from '../../hooks/useTerminalDrag';
import { useTerminalShortcuts } from '../../hooks/useTerminalShortcuts';
import { TerminalTile } from './TerminalTile';
import type { TerminalTab } from '../../lib/types';
import { EmptyWorkspace } from './EmptyWorkspace';
import { TerminalCloseModal } from './TerminalCloseModal';

export const TilingContainer: React.FC = () => {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab, reorderTabs, toggleFloating } = useTerminalStore();
  const [pendingClose, setPendingClose] = useState<{ tabId: string; ptyId: string } | null>(null);
  const [closingTabIds, setClosingTabIds] = useState<Set<string>>(new Set());

  // --- Terminal Lifecycle ---
  const spawnTerminal = useCallback(async () => {
    try {
      const ptyId = await ptySpawn({ cols: 120, rows: 30 });
      addTab({ id: `term-${ptyId}`, ptyId, title: 'Terminal' });
    } catch (err) {
      console.error('Failed to spawn terminal:', err);
    }
  }, [addTab]);

  const killTerminal = useCallback(async (tabId: string, ptyId: string, force = false) => {
    if (!force) {
      const hasProcess = await ptyHasActiveProcess(ptyId);
      if (hasProcess) {
        setPendingClose({ tabId, ptyId });
        return;
      }
    }

    try {
      await ptyKill(ptyId);
    } catch {
      // ignore
    }

    setClosingTabIds(prev => new Set(prev).add(tabId));
    
    setTimeout(() => {
      removeTab(tabId);
      setClosingTabIds(prev => {
        const next = new Set(prev);
        next.delete(tabId);
        return next;
      });
    }, 400);

    setPendingClose(null);
  }, [removeTab]);

  // --- Custom Hooks ---
  const { tiledTabs, count, gridStyle, getTileStyle } = useTerminalLayout(tabs);
  const { dragState, handleDragStart } = useTerminalDrag(tabs, reorderTabs);
  
  useTerminalShortcuts({
    tabs,
    activeTabId,
    spawnTerminal,
    killTerminal,
    setActiveTab,
    toggleFloating,
  });

  // --- Stable Rendering ---
  const stableTabs = useMemo(() => [...tabs].sort((a, b) => a.id.localeCompare(b.id)), [tabs]);

  if (count === 0 && tabs.filter(t => t.isFloating).length === 0) {
    return <EmptyWorkspace />;
  }

  return (
    <div className="tiling-container" style={gridStyle}>
      {stableTabs.map((tab: TerminalTab) => {
        const tiledIdx = tiledTabs.findIndex(t => t.id === tab.id);
        const visualIdx = tiledIdx !== -1 ? tiledIdx : tabs.findIndex(t => t.id === tab.id);
        const isDragging = dragState?.id === tab.id;
        
        return (
          <TerminalTile
            key={tab.id}
            tab={tab}
            style={getTileStyle(tab, visualIdx, isDragging, dragState)}
            isActive={activeTabId === tab.id}
            isDragging={isDragging}
            isClosing={closingTabIds.has(tab.id)}
            onSelect={() => setActiveTab(tab.id)}
            onDragStart={(e) => handleDragStart(tab.id, e)}
            onClose={() => killTerminal(tab.id, tab.ptyId)}
            onUnfloat={() => toggleFloating(tab.id, false)}
          />
        );
      })}

      {pendingClose && (
        <TerminalCloseModal
          onCancel={() => setPendingClose(null)}
          onConfirm={() => killTerminal(pendingClose.tabId, pendingClose.ptyId, true)}
        />
      )}
    </div>
  );
};
