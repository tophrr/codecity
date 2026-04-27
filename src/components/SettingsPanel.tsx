import React from 'react';
import type { CityConfig } from '../types';
import './SettingsPanel.css';

interface SettingsPanelProps {
  config: CityConfig;
  onChange: (config: CityConfig) => void;
  onClose: () => void;
  onRunRuntimeBenchmark: () => void;
  onExportRuntimeBenchmark: () => void;
  benchmarkRunning: boolean;
  benchmarkReady: boolean;
  benchmarkStatusText: string;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  config,
  onChange,
  onClose,
  onRunRuntimeBenchmark,
  onExportRuntimeBenchmark,
  benchmarkRunning,
  benchmarkReady,
  benchmarkStatusText,
}) => {
  return (
    <div className="settings-panel" onClick={e => e.stopPropagation()}>
      <div className="settings-header">
        <h2>Appearance config</h2>
        <button onClick={onClose} className="close-btn">×</button>
      </div>

      <div className="settings-content">
        <label>
          <span>Vertical scale</span>
          <input
            type="range"
            min="0.5"
            max="10"
            step="0.1"
            value={config.verticalScale}
            onChange={e => onChange({ ...config, verticalScale: parseFloat(e.target.value) })}
          />
        </label>

        <label>
          <span>Color palette</span>
          <select
            value={config.colorPalette}
            onChange={e => onChange({ ...config, colorPalette: e.target.value })}
          >
            <option value="magma">Magma</option>
            <option value="plasma">Plasma</option>
            <option value="viridis">Viridis</option>
            <option value="inferno">Inferno</option>
          </select>
        </label>

        <hr />
        
        <label>
          <span>Layout width</span>
          <input
            type="number"
            value={config.layout.width}
            onChange={e => onChange({ ...config, layout: { ...config.layout, width: parseInt(e.target.value, 10) } })}
          />
        </label>

        <label>
          <span>Layout height</span>
          <input
            type="number"
            value={config.layout.height}
            onChange={e => onChange({ ...config, layout: { ...config.layout, height: parseInt(e.target.value, 10) } })}
          />
        </label>

        <label>
          <span>Layout padding</span>
          <input
            type="number"
            value={config.layout.padding}
            onChange={e => onChange({ ...config, layout: { ...config.layout, padding: parseInt(e.target.value, 10) } })}
          />
        </label>

        <hr />

        <label>
          <span>District lot height</span>
          <input
            type="range"
            min="0.02"
            max="1.2"
            step="0.02"
            value={config.district.lotHeight}
            onChange={e => onChange({ ...config, district: { ...config.district, lotHeight: parseFloat(e.target.value) } })}
          />
        </label>

        <label>
          <span>District depth step</span>
          <input
            type="range"
            min="0.01"
            max="0.4"
            step="0.01"
            value={config.district.lotDepthStep}
            onChange={e => onChange({ ...config, district: { ...config.district, lotDepthStep: parseFloat(e.target.value) } })}
          />
        </label>

        <hr />

        <label>
          <span>Bloom intensity</span>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={config.scene.bloomIntensity}
            onChange={e => onChange({ ...config, scene: { ...config.scene, bloomIntensity: parseFloat(e.target.value) } })}
          />
        </label>

        <label>
          <span>Bloom threshold</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={config.scene.bloomThreshold}
            onChange={e => onChange({ ...config, scene: { ...config.scene, bloomThreshold: parseFloat(e.target.value) } })}
          />
        </label>

        <hr />

        <label>
          <span>Abandoned percentile</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={config.analytics.abandonedPercentile}
            onChange={e => onChange({ ...config, analytics: { ...config.analytics, abandonedPercentile: parseFloat(e.target.value) } })}
          />
        </label>

        <hr />

        <div className="runtime-benchmark-section">
          <span className="runtime-benchmark-title">Runtime benchmark</span>
          <div className="runtime-benchmark-actions">
            <button
              type="button"
              className="runtime-benchmark-btn"
              onClick={onRunRuntimeBenchmark}
              disabled={benchmarkRunning}
            >
              {benchmarkRunning ? 'Running...' : 'Run benchmark'}
            </button>
            <button
              type="button"
              className="runtime-benchmark-btn runtime-benchmark-btn--secondary"
              onClick={onExportRuntimeBenchmark}
              disabled={!benchmarkReady || benchmarkRunning}
            >
              Export JSON
            </button>
          </div>
          <p className="runtime-benchmark-status">{benchmarkStatusText}</p>
        </div>

      </div>
    </div>
  );
};
