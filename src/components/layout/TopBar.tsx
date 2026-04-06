import React from 'react';

export const TopBar: React.FC = () => {
  const [time, setTime] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="top-bar">
      <div style={{ display: 'flex', gap: '16px' }}>
        <span>Zelix Orchestrator</span>
        <span style={{ color: 'var(--text-secondary)' }}>Terminals mode</span>
      </div>
      <div style={{ display: 'flex', gap: '16px' }}>
        <span>{time.toLocaleTimeString()}</span>
      </div>
    </div>
  );
};
