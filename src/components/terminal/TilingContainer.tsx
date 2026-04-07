import React, { useEffect, useCallback } from 'react';
import { useTerminalStore } from '../../stores/terminalStore';
import { TerminalPane } from './TerminalPane';
import { ptySpawn, ptyKill, ptyHasActiveProcess } from '../../lib/ipc';

export const TilingContainer: React.FC = () => {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab, reorderTabs, toggleFloating } = useTerminalStore();
  const [pendingClose, setPendingClose] = React.useState<{ tabId: string; ptyId: string } | null>(null);
  const [closingTabIds, setClosingTabIds] = React.useState<Set<string>>(new Set());
  const [dragState, setDragState] = React.useState<{ id: string; x: number; y: number; initialX: number; initialY: number; offsetX: number; offsetY: number } | null>(null);
  const tabsRef = React.useRef(tabs);
  const lastReorderTime = React.useRef(0);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

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

  // Calculate Grid Layout dynamically for non-floating tabs
  const tiledTabs = tabs.filter(t => !t.isFloating);
  const floatingTabs = tabs.filter(t => t.isFloating);
  const count = tiledTabs.length;
  
  // Master/Stack Layout Logic
  let gridStyle: React.CSSProperties = {
    display: 'grid',
    gap: '4px',
    padding: '4px',
    height: '100%',
    width: '100%',
    boxSizing: 'border-box',
    overflow: 'hidden',
  };
  
  // Calculate Grid Layout: Balanced Grid (tries to be square-ish)
  const cols = count > 0 ? Math.ceil(Math.sqrt(count)) : 1;
  const rows = count > 0 ? Math.ceil(count / cols) : 1;

  gridStyle = { 
    ...gridStyle, 
    gridTemplateColumns: `repeat(${cols}, 1fr)`, 
    gridTemplateRows: `repeat(${rows}, 1fr)` 
  };

  // Advanced Drag Logic (Pop-and-Float)
  const handleDragStart = (tabId: string, e: React.MouseEvent) => {
    if (e.altKey && e.button === 0) { // Alt + Left Click
      e.preventDefault();
      e.stopPropagation();
      setDragState({
        id: tabId,
        x: e.clientX,
        y: e.clientY,
        initialX: e.clientX,
        initialY: e.clientY,
        offsetX: 0,
        offsetY: 0,
      });
    }
  };

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      setDragState(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
      
      const now = Date.now();
      if (now - lastReorderTime.current < 100) return; // Smoothly throttle

      // Hit-test for reordering
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const targetTile = elements.find(el => el.classList.contains('tile') && !el.classList.contains('dragging'));
      
      if (targetTile) {
        const targetId = (targetTile as HTMLElement).getAttribute('data-id');
        if (targetId && targetId !== dragState.id) {
          const currentTabs = tabsRef.current;
          const srcIdx = currentTabs.findIndex(t => t.id === dragState.id);
          const targetIdx = currentTabs.findIndex(t => t.id === targetId);
          
          if (srcIdx !== -1 && targetIdx !== -1 && srcIdx !== targetIdx) {
            reorderTabs(srcIdx, targetIdx);
            lastReorderTime.current = now;
          }
        }
      }
    };

    const handleMouseUp = () => setDragState(null);

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, dragState?.id, dragState?.initialX, dragState?.initialY, reorderTabs]); // Stable dependency (ID only)

  const onExitDummy = useCallback(() => {}, []);

  // Stable DOM Order: Physical order stays same (by ID), visual order handled by CSS 'order'
  const stableTabs = React.useMemo(() => [...tabs].sort((a,b) => a.id.localeCompare(b.id)), [tabs]);

  if (count === 0 && floatingTabs.length === 0) {
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
    <div 
      className="tiling-container" 
      style={gridStyle}
    >
      {stableTabs.map((tab) => {
        const isFloating = tab.isFloating;
        const tiledIdx = tiledTabs.findIndex(t => t.id === tab.id);
        const isDragging = dragState?.id === tab.id;
        
        // Logical position in layout (0 = Master, 1+ = Stack)
        // Only active for non-floating tabs
        const visualIdx = tiledIdx !== -1 ? tiledIdx : tabs.findIndex(t => t.id === tab.id);
        
        let tileStyle: React.CSSProperties = {
          order: visualIdx
        };
        
        if (isDragging && dragState) {
          // Hardware-accelerated translate-based dragging (keeps it in DOM flow but visual offset)
          tileStyle = {
            ...tileStyle,
            position: 'relative',
            zIndex: 9999,
            transform: `translate(${dragState.x - dragState.initialX}px, ${dragState.y - dragState.initialY}px) scale(1.02)`,
            boxShadow: '0 50px 100px rgba(0,0,0,0.8), 0 0 50px rgba(255,255,255,0.2)',
            transition: 'none', // No transition for the one following the mouse
            cursor: 'grabbing',
            pointerEvents: 'none', // Critical: allow hit-testing through the window in your hand
          };
        } else if (isFloating) {
          tileStyle = {
            ...tileStyle,
            position: 'fixed',
            top: '10%',
            left: '10%',
            width: '80%',
            height: '80%',
            zIndex: 1000,
          };
        } else {
          // Balanced Grid placement relies on 'order' + CSS Grid auto-flow
          tileStyle = { ...tileStyle, width: '100%', height: '100%' };
        }

        return (
          <div 
            key={tab.id}
            data-id={tab.id}
            className={`tile ${activeTabId === tab.id ? 'active' : ''} ${isFloating ? 'floating' : ''} ${isDragging ? 'dragging' : ''} ${closingTabIds.has(tab.id) ? 'tile-closing' : ''}`}
            data-index={visualIdx + 1}
            style={tileStyle}
            onClick={() => setActiveTab(tab.id)}
            onMouseDownCapture={(e) => handleDragStart(tab.id, e)}
          >
            <div className="tile-controls">
               {isFloating && !isDragging && (
                 <button 
                    className="tile-btn"
                    onClick={(e) => { e.stopPropagation(); toggleFloating(tab.id, false); }}
                    title="Unfloat (Alt+F)"
                  >
                    ◱
                  </button>
               )}
              <button 
                className="tile-btn close" 
                onClick={(e) => { e.stopPropagation(); killTerminal(tab.id, tab.ptyId); }}
                title="Close (Alt+Q)"
              >
                ✕
              </button>
            </div>
            <TerminalPane 
              ptyId={tab.ptyId} 
              isVisible={true} 
              onExit={onExitDummy} 
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
