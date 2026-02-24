
import { useState, useMemo, useEffect, useCallback } from 'react';
import { Scene } from './components/Scene';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { buildCityAtCommit, getCommitChangedPaths } from './utils/cityBuilder';
import { computeLayout } from './utils/layout';
import { computeCityMetrics } from './analytics';
import CommitsData from './data/commits.json';
import DepsData from './data/deps.json';
import type { Commit, LayoutNode } from './types';
import './App.css';

const deps = DepsData as Record<string, string[]>;

const commits = CommitsData as unknown as Commit[];

const PLAY_SPEEDS: Record<string, number> = { '0.5×': 2000, '1×': 1000, '2×': 500, '4×': 250 };

// Compute global date range from all commits (used for recency color)
const minDate = commits.length ? new Date(commits[0].date).getTime() : 0;
const maxDate = commits.length ? new Date(commits[commits.length - 1].date).getTime() : 1;

function App() {
  const [timeIndex, setTimeIndex] = useState(commits.length - 1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState('1×');
  const [selectedBuilding, setSelectedBuilding] = useState<LayoutNode | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  // Advance time while playing
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setTimeIndex(prev => {
        if (prev >= commits.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, PLAY_SPEEDS[playSpeed]);
    return () => clearInterval(interval);
  }, [isPlaying, playSpeed]);

  const cityLayout = useMemo(() => {
    if (commits.length === 0) return null;
    const city = buildCityAtCommit(commits, timeIndex);
    return computeLayout(city, { width: 100, height: 100, padding: 1 });
  }, [timeIndex]);

  const changedPaths = useMemo(
    () => getCommitChangedPaths(commits, timeIndex),
    [timeIndex]
  );

  const cityMetrics = useMemo(
    () => cityLayout ? computeCityMetrics(cityLayout, deps) : null,
    [cityLayout]
  );

  const currentCommit = commits[timeIndex];

  const handleSelect = useCallback((node: LayoutNode) => {
    setSelectedBuilding(prev => (prev?.path === node.path ? null : node));
  }, []);

  return (
    <div className="app-container" onClick={() => setSelectedBuilding(null)}>
      {/* Analytics slide-in trigger */}
      <button className="ap-trigger" onClick={e => { e.stopPropagation(); setAnalyticsOpen(o => !o); }}>
        {analyticsOpen ? 'Close' : 'Analytics'}
      </button>

      {/* Analytics panel */}
      {cityMetrics && (
        <AnalyticsPanel
          metrics={cityMetrics}
          isOpen={analyticsOpen}
          onClose={() => setAnalyticsOpen(false)}
        />
      )}
      {/* 3D Scene */}
      <div className="scene-container">
        {cityLayout && (
          <Scene
            data={cityLayout}
            changedPaths={changedPaths}
            onSelect={handleSelect}
            minDate={minDate}
            maxDate={maxDate}
            deps={deps}
          />
        )}
      </div>

      {/* Left overlay: commit info + time travel */}
      <div className="ui-overlay" onClick={e => e.stopPropagation()}>
        <h1>Temporal Code City</h1>

        {currentCommit && (
          <div className="info-panel">
            <p><strong>Commit:</strong> <span className="mono">{currentCommit.hash.substring(0, 7)}</span></p>
            <p><strong>Date:</strong> {new Date(currentCommit.date).toLocaleString()}</p>
            <p><strong>Author:</strong> {currentCommit.author_name}</p>
            <p className="commit-msg"><strong>Message:</strong> {currentCommit.message}</p>
            {changedPaths.size > 0 && (
              <p className="changed-badge">{changedPaths.size} file{changedPaths.size > 1 ? 's' : ''} changed</p>
            )}
          </div>
        )}

        <div className="controls">
          <label>Time Travel:</label>
          <input
            type="range"
            min="0"
            max={commits.length - 1}
            value={timeIndex}
            onChange={(e) => { setIsPlaying(false); setTimeIndex(Number(e.target.value)); }}
            className="time-slider"
          />
          <div className="slider-meta">
            <span className="mono">{timeIndex + 1} / {commits.length}</span>
          </div>

          <div className="play-controls">
            <button
              className={`play-btn ${isPlaying ? 'playing' : ''}`}
              onClick={() => setIsPlaying(p => !p)}
              disabled={timeIndex === commits.length - 1 && !isPlaying}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <button
              className="reset-btn"
              onClick={() => { setIsPlaying(false); setTimeIndex(0); }}
            >
              ↺
            </button>
            <div className="speed-btns">
              {Object.keys(PLAY_SPEEDS).map(s => (
                <button
                  key={s}
                  className={`speed-btn ${playSpeed === s ? 'active' : ''}`}
                  onClick={() => setPlaySpeed(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="legend">
          <div className="legend-item"><span className="swatch hot" /> Hot (recent)</div>
          <div className="legend-item"><span className="swatch cold" /> Cold (old)</div>
          <div className="legend-item"><span className="swatch changed" /> Changed this commit</div>
        </div>
      </div>

      {/* Right panel: selected building info */}
      {selectedBuilding && (
        <div className="building-panel" onClick={e => e.stopPropagation()}>
          <button className="panel-close" onClick={() => setSelectedBuilding(null)}>✕</button>
          <h2 className="panel-title">{selectedBuilding.name}</h2>
          <p className="panel-path">{selectedBuilding.path}</p>
          <div className="panel-stats">
            <div className="stat">
              <span className="stat-label">Lines of Code</span>
              <span className="stat-value">{selectedBuilding.size.toLocaleString()}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Last Modified</span>
              <span className="stat-value">
                {selectedBuilding.lastModified
                  ? new Date(selectedBuilding.lastModified).toLocaleDateString()
                  : '—'}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Total Additions</span>
              <span className="stat-value additions">+{(selectedBuilding.totalAdded ?? 0).toLocaleString()}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Total Deletions</span>
              <span className="stat-value deletions">-{(selectedBuilding.totalDeleted ?? 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
