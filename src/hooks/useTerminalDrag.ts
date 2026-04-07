import React, { useState, useRef, useEffect } from 'react';
import type { TerminalTab } from '../lib/types';

export interface DragState {
  id: string;
  x: number;
  y: number;
  initialX: number;
  initialY: number;
  offsetX: number;
  offsetY: number;
}

export const useTerminalDrag = (tabs: TerminalTab[], reorderTabs: (src: number, target: number) => void) => {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const lastReorderTime = useRef(0);
  const tabsRef = useRef(tabs);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  const handleDragStart = (tabId: string, e: React.MouseEvent) => {
    if (e.altKey && e.button === 0) {
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
      if (now - lastReorderTime.current < 100) return;

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
  }, [dragState, reorderTabs]);

  return {
    dragState,
    handleDragStart
  };
};
