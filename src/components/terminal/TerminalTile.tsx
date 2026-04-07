import React from 'react';
import type { TerminalTab } from '../../lib/types';
import { TerminalPane } from './TerminalPane';

interface Props {
  tab: TerminalTab;
  isActive: boolean;
  isDragging: boolean;
  isClosing: boolean;
  style: React.CSSProperties;
  onSelect: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onClose: () => void;
  onUnfloat: () => void;
}

export const TerminalTile: React.FC<Props> = ({
  tab,
  isActive,
  isDragging,
  isClosing,
  style,
  onSelect,
  onDragStart,
  onClose,
  onUnfloat
}) => {
  return (
    <div 
      className={`tile ${isActive ? 'active' : ''} ${tab.isFloating ? 'floating' : ''} ${isDragging ? 'dragging' : ''} ${isClosing ? 'tile-closing' : ''}`}
      data-id={tab.id}
      style={style}
      onClick={onSelect}
      onMouseDownCapture={onDragStart}
    >
      <div className="tile-controls">
        {tab.isFloating && !isDragging && (
          <button 
            className="tile-btn"
            onClick={(e) => { e.stopPropagation(); onUnfloat(); }}
            title="Unfloat (Alt+F)"
          >
            ◱
          </button>
        )}
        <button 
          className="tile-btn close" 
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          title="Close (Alt+Q)"
        >
          ✕
        </button>
      </div>
      <TerminalPane 
        ptyId={tab.ptyId} 
        isVisible={true} 
        onExit={() => {}} 
      />
    </div>
  );
};
