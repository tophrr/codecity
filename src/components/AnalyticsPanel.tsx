import React, { useState } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import type { CityMetrics, DistrictMetrics } from '../analytics';
import 'katex/dist/katex.min.css';
import './AnalyticsPanel.css';

interface AnalyticsPanelProps {
  metrics: CityMetrics;
  isOpen: boolean;
  onClose: () => void;
}

function ScoreGauge({ value, label }: { value: number; label: string }) {
  const color = value >= 70 ? '#4af07a' : value >= 40 ? '#f0c94a' : '#f04a4a';
  return (
    <div className="ap-gauge">
      <svg viewBox="0 0 80 44" width="80" height="44">
        {/* Track */}
        <path d="M8,40 A32,32 0 0,1 72,40" fill="none" stroke="#2a2a44" strokeWidth="7" strokeLinecap="round" />
        {/* Fill */}
        <path
          d="M8,40 A32,32 0 0,1 72,40"
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * 100.5} 100.5`}
        />
        <text x="40" y="38" textAnchor="middle" fill={color} fontSize="13" fontWeight="bold">{value}</text>
      </svg>
      <div className="ap-gauge-label">{label}</div>
    </div>
  );
}

function FormulaBlock({ latex, description }: { latex: string; description: string }) {
  return (
    <div className="ap-formula">
      <div className="ap-formula-eq">
        <BlockMath math={latex} />
      </div>
      <p className="ap-formula-desc">{description}</p>
    </div>
  );
}

function HealthBadge({ score }: { score: number }) {
  const cls = score >= 70 ? 'good' : score >= 40 ? 'warn' : 'bad';
  return <span className={`ap-badge ap-badge--${cls}`}>{score}</span>;
}

function DistrictRow({ d }: { d: DistrictMetrics }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ap-district-row">
      <button className="ap-district-header" onClick={() => setOpen(o => !o)}>
        <span className="ap-district-name" title={d.path}>{d.name || d.path}</span>
        <HealthBadge score={d.healthScore} />
        <span className="ap-chevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="ap-district-detail">
          <div className="ap-kv"><span>Files</span><span>{d.fileCount}</span></div>
          <div className="ap-kv"><span>Avg height</span><span>{d.avgHeight.toFixed(1)}</span></div>
          <div className="ap-kv">
            <span>Skyline roughness <em>(CV)</em></span>
            <span className={d.skylineRoughness > 1 ? 'ap-warn' : ''}>{d.skylineRoughness.toFixed(2)}</span>
          </div>
          <div className="ap-kv">
            <span>Modularity index</span>
            <span className={d.modularityIndex < 0.5 ? 'ap-warn' : 'ap-good'}>{(d.modularityIndex * 100).toFixed(0)}%</span>
          </div>
          <div className="ap-kv">
            <span>Avg coupling radius</span>
            <span>{d.avgCouplingRadius.toFixed(1)} u</span>
          </div>
          <div className="ap-kv">
            <span>Avg instability</span>
            <span className={d.avgInstability > 0.6 ? 'ap-warn' : ''}>{d.avgInstability.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

type Tab = 'overview' | 'districts' | 'hubs' | 'abandoned';

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ metrics, isOpen, onClose }) => {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className={`ap-panel ${isOpen ? 'ap-panel--open' : ''}`}>
      <div className="ap-header">
        <span className="ap-title">Codebase Analytics</span>
        <button className="ap-close" onClick={onClose}>✕</button>
      </div>

      <div className="ap-tabs">
        {(['overview', 'districts', 'hubs', 'abandoned'] as Tab[]).map(t => (
          <button key={t} className={`ap-tab ${tab === t ? 'ap-tab--active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="ap-body">

        {/* ── OVERVIEW ───────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="ap-section">
            <div className="ap-gauges-row">
              <ScoreGauge value={metrics.modularityScore} label="Modularity" />
              <ScoreGauge value={metrics.scalabilityScore} label="Scalability" />
            </div>

            <div className="ap-stat-row">
              <div className="ap-stat">
                <span className="ap-stat-label">Avg Coupling Radius</span>
                <span className="ap-stat-value">{metrics.avgCouplingRadius.toFixed(1)} u</span>
              </div>
              <div className="ap-stat">
                <span className="ap-stat-label">Avg Instability</span>
                <span className="ap-stat-value">{metrics.avgInstability.toFixed(2)}</span>
              </div>
              <div className="ap-stat">
                <span className="ap-stat-label">Hub Files</span>
                <span className="ap-stat-value">{metrics.hubFiles.length}</span>
              </div>
              <div className="ap-stat">
                <span className="ap-stat-label">Abandoned Files</span>
                <span className="ap-stat-value">{metrics.abandonedFiles.length}</span>
              </div>
            </div>

            <div className="ap-formulas-section">
              <div className="ap-formulas-title">How it's calculated</div>

              <div className="ap-metric-block">
                <div className="ap-metric-name">Modularity Score</div>
                <FormulaBlock
                  latex="Q = \sum_c \left[ \frac{e^c}{W} - \left(\frac{a^c}{2W}\right)^2 \right]"
                  description="Newman-Girvan Q: actual intra-district edge weight minus random-graph expectation"
                />
                <FormulaBlock
                  latex="w_{ij} = \log(1 + \text{size}_i) \quad \Rightarrow \quad \text{score} = \frac{Q + 0.5}{1.5} \times 100"
                  description="Edges weighted by importer LoC — large files matter more than glue files"
                />
              </div>

              <div className="ap-metric-block">
                <div className="ap-metric-name">Scalability Score</div>
                <FormulaBlock
                  latex="S_s = 100 \cdot (1 - 0.4\,H_c) \cdot (1 - 0.4\,D_r) \cdot (1 - 0.2\,\bar{I})"
                  description="Hub concentration × dead-code ratio × mean instability penalties"
                />
                <FormulaBlock
                  latex="H_c = \frac{\displaystyle\sum_{\text{top }10\%} \text{in}_i}{\displaystyle\sum_{\text{all}} \text{in}_i}"
                  description="Pareto concentration: fraction of all imports flowing to the top-10% most-imported files"
                />
                <FormulaBlock
                  latex="I_i = \frac{\text{out}_i}{\text{in}_i + \text{out}_i}"
                  description="Martin instability: 0 = stable, 1 = unstable"
                />
              </div>

              <div className="ap-metric-block">
                <div className="ap-metric-name">Coupling Radius</div>
                <FormulaBlock
                  latex="C_r = \frac{1}{|E|} \sum_{(u,v)\in E} \sqrt{(x_u - x_v)^2 + (z_u - z_v)^2}"
                  description="Mean Euclidean XZ arc length across the city"
                />
              </div>

              <div className="ap-metric-block">
                <div className="ap-metric-name">Skyline Roughness</div>
                <FormulaBlock
                  latex="R = \frac{\sigma_h}{\bar{h}}, \qquad \sigma_h = \sqrt{\frac{1}{n}\sum_{i=1}^{n}(h_i - \bar{h})^2}"
                  description="Coefficient of variation of building heights within a district"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── DISTRICTS ──────────────────────────────────────────────── */}
        {tab === 'districts' && (
          <div className="ap-section">
            <div className="ap-section-hint">
              <InlineMath math="\text{Health} = 100 \cdot (1-R) \cdot M^d \cdot (1-\bar{I})" />
            </div>
            {metrics.districts
              .sort((a, b) => a.healthScore - b.healthScore)
              .map(d => <DistrictRow key={d.path} d={d} />)}
          </div>
        )}

        {/* ── HUBS ────────────────────────────────────────────────────── */}
        {tab === 'hubs' && (
          <div className="ap-section">
            <div className="ap-section-hint">
              <InlineMath math="H_i = \dfrac{\text{in}_i}{n-1} \qquad I_i = \dfrac{\text{out}_i}{\text{in}_i + \text{out}_i}" />
            </div>
            {metrics.hubFiles.length === 0 && <div className="ap-empty">No significant hubs detected.</div>}
            {metrics.hubFiles.map(f => (
              <div key={f.path} className="ap-file-row">
                <div className="ap-file-name" title={f.path}>{f.path.split('/').pop()}</div>
                <div className="ap-file-path">{f.path}</div>
                <div className="ap-file-stats">
                  <span>in: <strong>{f.inDegree}</strong></span>
                  <span>out: <strong>{f.outDegree}</strong></span>
                  <span>hub: <strong>{(f.hubScore * 100).toFixed(1)}%</strong></span>
                  <span className={f.instability > 0.6 ? 'ap-warn' : ''}>
                    I: <strong>{f.instability.toFixed(2)}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── ABANDONED ───────────────────────────────────────────────── */}
        {tab === 'abandoned' && (
          <div className="ap-section">
            <div className="ap-section-hint">
              <InlineMath math="\text{in}_i = 0 \;\wedge\; \text{age} \leq p_{25} \;\wedge\; \text{size} > 10" />
            </div>
            {metrics.abandonedFiles.length === 0 && <div className="ap-empty">No abandoned files detected.</div>}
            {metrics.abandonedFiles.map(f => (
              <div key={f.path} className="ap-file-row">
                <div className="ap-file-name" title={f.path}>{f.path.split('/').pop()}</div>
                <div className="ap-file-path">{f.path}</div>
                <div className="ap-file-stats">
                  <span>in: <strong>{f.inDegree}</strong></span>
                  <span>churn: <strong>{f.churnRate.toFixed(1)}×</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};
