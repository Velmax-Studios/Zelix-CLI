import React from 'react';
import { TopBar } from './components/layout/TopBar';
import { TilingContainer } from './components/terminal/TilingContainer';

const App: React.FC = () => {
  return (
    <>
      <TopBar />
      <TilingContainer />
    </>
  );
};

export default App;
