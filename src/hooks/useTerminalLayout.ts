import { useMemo } from 'react';
import type { TerminalTab } from '../lib/types';
import type { DragState } from './useTerminalDrag';

export const useTerminalLayout = (tabs: TerminalTab[]) => {
  const tiledTabs = useMemo(() => tabs.filter(t => !t.isFloating), [tabs]);
  const floatingTabs = useMemo(() => tabs.filter(t => t.isFloating), [tabs]);
  const count = tiledTabs.length;

  const { cols, rows } = useMemo(() => {
    const cols = count > 0 ? Math.ceil(Math.sqrt(count)) : 1;
    const rows = count > 0 ? Math.ceil(count / cols) : 1;
    return { cols, rows };
  }, [count]);

  const gridStyle: React.CSSProperties = useMemo(() => ({
    display: 'grid',
    gap: '8px',
    padding: '8px',
    height: '100%',
    width: '100%',
    boxSizing: 'border-box',
    overflow: 'hidden',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, 1fr)`,
  }), [cols, rows]);

  const getTileStyle = (tab: TerminalTab, visualIdx: number, isDragging: boolean, dragState: DragState | null): React.CSSProperties => {
    let style: React.CSSProperties = {
      order: visualIdx,
    };

    if (isDragging && dragState) {
      style = {
        ...style,
        position: 'relative',
        zIndex: 9999,
        transform: `translate(${dragState.x - dragState.initialX}px, ${dragState.y - dragState.initialY}px) scale(1.02)`,
        boxShadow: '0 50px 100px rgba(0,0,0,0.8), 0 0 50px rgba(255,255,255,0.2)',
        transition: 'none',
        cursor: 'grabbing',
        pointerEvents: 'none',
      };
    } else if (tab.isFloating) {
      style = {
        ...style,
        position: 'fixed',
        top: '10%',
        left: '10%',
        width: '80%',
        height: '80%',
        zIndex: 1000,
      };
    } else {
      style = { ...style, width: '100%', height: '100%' };

      // Special Case: 3 Terminals (Refining the 2x2 grid to eliminate empty space)
      if (count === 3) {
        if (visualIdx === 0) style = { ...style, gridColumn: '1', gridRow: '1' };
        else if (visualIdx === 1) style = { ...style, gridColumn: '2', gridRow: '1 / span 2' };
        else if (visualIdx === 2) style = { ...style, gridColumn: '1', gridRow: '2' };
      }
    }

    return style;
  };

  return {
    tiledTabs,
    floatingTabs,
    count,
    gridStyle,
    getTileStyle
  };
};
