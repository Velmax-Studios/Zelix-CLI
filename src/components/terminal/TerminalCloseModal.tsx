import React from 'react';

interface Props {
  onCancel: () => void;
  onConfirm: () => void;
}

export const TerminalCloseModal: React.FC<Props> = ({ onCancel, onConfirm }) => {
  return (
    <div className="confirm-overlay">
      <div className="confirm-modal">
        <h3>Active Process</h3>
        <p>This terminal has a running activity. Kill it and close?</p>
        <div className="confirm-actions">
          <button 
            className="confirm-btn secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button 
            className="confirm-btn danger"
            onClick={onConfirm}
          >
            Terminate
          </button>
        </div>
      </div>
    </div>
  );
};
