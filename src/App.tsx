
import { useState, useMemo } from 'react';
import { Scene } from './components/Scene';
import { buildCityAtCommit } from './utils/cityBuilder';
import { computeLayout } from './utils/layout';
import CommitsData from './data/commits.json';
import type { Commit } from './types';
import './App.css';

// Cast imported JSON to typed array
const commits = CommitsData as unknown as Commit[];

function App() {
  const [timeIndex, setTimeIndex] = useState(commits.length - 1);

  // Compute city state only when time changes
  const cityLayout = useMemo(() => {
    if (commits.length === 0) return null;
    const city = buildCityAtCommit(commits, timeIndex);
    return computeLayout(city, { width: 100, height: 100, padding: 1 });
  }, [timeIndex]);

  const currentCommit = commits[timeIndex];

  return (
    <div className="app-container">
      {/* 3D Scene */}
      <div className="scene-container">
        {cityLayout && <Scene data={cityLayout} />}
      </div>

      {/* UI Overlay */}
      <div className="ui-overlay">
        <h1>Temporal Code City</h1>
        
        {currentCommit && (
          <div className="info-panel">
            <p><strong>Commit:</strong> {currentCommit.hash.substring(0, 7)}</p>
            <p><strong>Date:</strong> {new Date(currentCommit.date).toLocaleString()}</p>
            <p><strong>Author:</strong> {currentCommit.author_name}</p>
            <p><strong>Message:</strong> {currentCommit.message}</p>
          </div>
        )}

        <div className="controls">
          <label>Time Travel:</label>
          <input 
            type="range" 
            min="0" 
            max={commits.length - 1} 
            value={timeIndex} 
            onChange={(e) => setTimeIndex(Number(e.target.value))} 
            className="time-slider"
          />
          <span>{timeIndex + 1} / {commits.length}</span>
        </div>
      </div>
    </div>
  );
}

export default App;
