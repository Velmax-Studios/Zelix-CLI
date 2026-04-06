import React, { useEffect, useCallback } from 'react';
import { useTerminalStore } from '../../stores/terminalStore';
import { TerminalPane } from './TerminalPane';
import { ptySpawn, ptyKill, ptyHasActiveProcess } from '../../lib/ipc';

export const TilingContainer: React.FC = () => {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab } = useTerminalStore();
  const [pendingClose, setPendingClose] = React.useState<{ tabId: string; ptyId: string } | null>(null);
  const [closingTabIds, setClosingTabIds] = React.useState<Set<string>>(new Set());

  const spawnTerminal = useCallback(async () => {
    try {
      const ptyId = await ptySpawn({
        cols: 120,
        rows: 30,
      });

      const tabId = `term-${ptyId}`;
      addTab({
        id: tabId,
        ptyId,
        title: `Terminal`,
      });
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
      // Ignore if already dead
    }

    // Start exit animation
    setClosingTabIds(prev => new Set(prev).add(tabId));
    
    // Wait for the animation (0.2s duration from index.css)
    setTimeout(() => {
      removeTab(tabId);
      setClosingTabIds(prev => {
        const next = new Set(prev);
        next.delete(tabId);
        return next;
      });
    }, 200);

    setPendingClose(null);
  }, [removeTab]);

  // Global Keybindings for Hyprland feel
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

      // Super/Alt + ArrowKeys to navigate
      if ((e.metaKey || e.altKey) && tabs.length > 1) {
        const idx = tabs.findIndex(t => t.id === activeTabId);
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveTab(tabs[(idx + 1) % tabs.length].id);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveTab(tabs[(idx - 1 + tabs.length) % tabs.length].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, tabs, spawnTerminal, killTerminal, setActiveTab]);

  // Calculate Grid Layout dynamically
  const count = tabs.length;
  let gridStyle: React.CSSProperties = {};
  
  if (count === 1) {
    gridStyle = { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
  } else if (count === 2) {
    gridStyle = { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' };
  } else if (count === 3) {
    gridStyle = { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' };
  } else if (count > 0) {
    const cols = Math.ceil(Math.sqrt(count));
    gridStyle = { 
      gridTemplateColumns: `repeat(${cols}, 1fr)`, 
      gridTemplateRows: `repeat(${Math.ceil(count / cols)}, 1fr)` 
    };
  }

  if (count === 0) {
    return (
      <div className="tiling-container">
        <div className="empty-state">
          <h1>ZELIX SHELL</h1>
          <p>A minimalist tiling workspace for high-performance terminal workflows.</p>
          <div>
            <kbd>Alt</kbd> + <kbd>Enter</kbd> to spawn
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tiling-container" style={gridStyle}>
      {tabs.map((tab, idx) => {
        // For 3 items, make the first one span full height
        let tileStyle: React.CSSProperties = {};
        if (count === 3 && idx === 0) {
          tileStyle = { gridRow: '1 / span 2' };
        }

        return (
          <div 
            key={tab.id}
            className={`tile ${activeTabId === tab.id ? 'active' : ''} ${closingTabIds.has(tab.id) ? 'tile-closing' : ''}`}
            data-index={idx + 1}
            style={tileStyle}
            onClick={() => setActiveTab(tab.id)}
          >
            <div className="tile-controls">
              <button 
                className="tile-btn close" 
                onClick={(e) => { e.stopPropagation(); killTerminal(tab.id, tab.ptyId); }}
                title="Close (Alt+Q)"
              >
                ✕
              </button>
            </div>
            {/* TerminalPane needs to know it's visible to trigger refit */}
            <TerminalPane 
              ptyId={tab.ptyId} 
              isVisible={true} 
              onExit={() => {}} // Stable dummy
            />
          </div>
        );
      })}

      {/* CONFIRMATION MODAL */}
      {pendingClose && (
        <div className="confirm-overlay">
          <div className="confirm-modal">
            <h3>Active Process</h3>
            <p>This terminal has a running activity. Kill it and close?</p>
            <div className="confirm-actions">
              <button 
                className="confirm-btn secondary"
                onClick={() => setPendingClose(null)}
              >
                Cancel
              </button>
              <button 
                className="confirm-btn danger"
                onClick={() => killTerminal(pendingClose.tabId, pendingClose.ptyId, true)}
              >
                Terminate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
