import React from 'react';
import './StatsPanel.css';

interface StatsPanelProps {
  stats: {
    buildings: number;
    districts: number;
    arcs: number;
    totalSize: number;
    instances: number;
  };
  onClose: () => void;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats, onClose }) => {
  return (
    <div className="city-stats-panel" onClick={e => e.stopPropagation()}>
      <div className="stats-header">
        <h2>City Statistics</h2>
        <button onClick={onClose} className="close-btn">×</button>
      </div>

      <div className="stats-content">
        <div className="stat-item">
          <span className="stat-label">Buildings (Files)</span>
          <span className="stat-value">{stats.buildings.toLocaleString()}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Districts (Folders)</span>
          <span className="stat-value">{stats.districts.toLocaleString()}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Dependency Arcs</span>
          <span className="stat-value">{stats.arcs.toLocaleString()}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Total Code Size (LOC)</span>
          <span className="stat-value">{stats.totalSize.toLocaleString()}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Rendered Instances</span>
          <span className="stat-value">{stats.instances.toLocaleString()}</span>
        </div>
      </div>
      
      <div className="stats-footer">
        <p>Live snapshot of currently visible elements in the 3D scene.</p>
      </div>
    </div>
  );
};
