import React from 'react';

export const EmptyWorkspace: React.FC = () => {
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
};
