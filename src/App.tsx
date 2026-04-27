
import { Profiler, useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Scene } from './components/Scene';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { TimelinePanel } from './components/TimelinePanel';
import { SettingsPanel } from './components/SettingsPanel';
import { StatsPanel } from './components/StatsPanel';
import { buildCityAtCommit, getCommitChangedPaths } from './utils/cityBuilder';
import { computeLayout } from './utils/layout';
import { computeCityMetrics } from './analytics';
import CommitsData from './data/commits.json';
import DepsData from './data/deps.json';
import type { Commit, LayoutNode, CityConfig } from './types';
import './App.css';

const deps = DepsData as Record<string, string[]>;

const PLAY_SPEEDS: Record<string, number> = { '0.5×': 2000, '1×': 1000, '2×': 500, '4×': 250 };

type RuntimePerformanceResults = {
  renderTime: number[];
  webVitals: {
    cls: number[];
    lcp: number[];
    inp: number[];
    fid: number[];
    ttfb: number[];
  };
  reactProfiler: {
    id: string[];
    phase: string[];
    actualDuration: number[];
    baseDuration: number[];
    startTime: number[];
    commitTime: number[];
  };
  error: string | null;
};

type FileCommitDetail = {
  commitIndex: number;
  hash: string;
  date: string;
  author: string;
  message: string;
  status: 'A' | 'M' | 'D' | 'R';
  added: number;
  deleted: number;
};

type SelectedFileDetails = {
  path: string;
  extension: string;
  directory: string;
  breadcrumbs: string[];
  changeCount: number;
  firstSeen: string | null;
  lastTouched: FileCommitDetail | null;
  recentHistory: FileCommitDetail[];
  totalAddedAtSnapshot: number;
  totalDeletedAtSnapshot: number;
  isChangedInSnapshotCommit: boolean;
  statusAtSnapshot: 'A' | 'M' | 'D' | 'R' | null;
  outgoingDeps: string[];
  incomingDeps: string[];
};

function createEmptyRuntimeResults(): RuntimePerformanceResults {
  return {
    renderTime: [],
    webVitals: {
      cls: [],
      lcp: [],
      inp: [],
      fid: [],
      ttfb: [],
    },
    reactProfiler: {
      id: [],
      phase: [],
      actualDuration: [],
      baseDuration: [],
      startTime: [],
      commitTime: [],
    },
    error: null,
  };
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[]): number {
  const m = mean(arr);
  const variance = arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

interface BenchmarkStats {
  count: number;
  mean: number;
  median: number;
  p95: number;
  stddev: number;
  min: number;
  max: number;
}

function computeStats(arr: number[]): BenchmarkStats | null {
  if (arr.length === 0) return null;
  return {
    count: arr.length,
    mean: mean(arr),
    median: percentile(arr, 50),
    p95: percentile(arr, 95),
    stddev: stddev(arr),
    min: Math.min(...arr),
    max: Math.max(...arr),
  };
}

function exportRuntimePerformanceAsJson(
  results: RuntimePerformanceResults,
  statsData?: { renderStats: BenchmarkStats | null; lcpStats: BenchmarkStats | null; inpStats: BenchmarkStats | null; profilerStats: BenchmarkStats | null },
) {
  const payload: any = {
    runtimePerformance: results,
    metadata: {
      generatedAt: new Date().toISOString(),
      source: 'codecity-ui-runtime-benchmark',
      iterations: results.renderTime.length,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    },
  };

  if (statsData) {
    payload.statistics = {
      renderTime: statsData.renderStats,
      webVitals: {
        lcp: statsData.lcpStats,
        inp: statsData.inpStats,
      },
      reactProfiler: {
        actualDuration: statsData.profilerStats,
      },
    };
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `runtime_performance_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

function getFileExtension(path: string): string {
  const base = path.split('/').pop() ?? path;
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return 'none';
  return base.slice(dot + 1).toLowerCase();
}

function getFileDirectory(path: string): string {
  const idx = path.lastIndexOf('/');
  if (idx <= 0) return '/';
  return path.slice(0, idx);
}

function formatRelativeTime(dateIso: string): string {
  const date = new Date(dateIso).getTime();
  if (Number.isNaN(date)) return 'unknown';

  const seconds = Math.round((date - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  if (abs < 60) return rtf.format(seconds, 'second');
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(seconds / (86400 * 30)), 'month');
  return rtf.format(Math.round(seconds / (86400 * 365)), 'year');
}

function App() {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load commits 
  useEffect(() => {
    async function loadCommits() {
      const data: any = CommitsData;
      if (data.isChunked) {
        let allCommits: Commit[] = [];
        for (const chunkMeta of data.chunks) {
          // Dynamic import chunk via Vite URL or fetch
          const res = await fetch(`/src/data/${chunkMeta.file}`);
          const chunkData = await res.json();
          allCommits = allCommits.concat(chunkData);
        }
        setCommits(allCommits);
      } else {
        setCommits(data as Commit[]);
      }
      setIsLoading(false);
    }
    loadCommits();
  }, []);

  const minDate = useMemo(() => commits.length ? new Date(commits[0].date).getTime() : 0, [commits]);
  
  const [timeIndex, setTimeIndex] = useState(0);
  const currentCommit = commits[timeIndex];
  const maxDate = currentCommit ? new Date(currentCommit.date).getTime() : 1;

  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState('1×');
  const [selectedBuilding, setSelectedBuilding] = useState<LayoutNode | null>(null);
  const [buildingTab, setBuildingTab] = useState<'overview' | 'history' | 'deps'>('overview');
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [benchmarkTick, setBenchmarkTick] = useState(0);
  const [benchmarkStatus, setBenchmarkStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [benchmarkResults, setBenchmarkResults] = useState<RuntimePerformanceResults | null>(null);
  const [benchmarkStatusText, setBenchmarkStatusText] = useState('Not run yet');
  const collectProfilerRef = useRef(false);
  const profilerBufferRef = useRef(createEmptyRuntimeResults().reactProfiler);
  const [config, setConfig] = useState<CityConfig>({
    layout: { width: 200, height: 200, padding: 1 },
    verticalScale: 1,
    colorPalette: 'magma',
    district: { lotHeight: 0.22, lotDepthStep: 0.09 },
    scene: { bloomIntensity: 0.8, bloomThreshold: 0.6 },
    analytics: { abandonedPercentile: 0.25 }
  });

  // Advance time while playing
  useEffect(() => {
    if (!isPlaying || commits.length === 0) return;
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
  }, [isPlaying, playSpeed, commits.length]);

  const cityLayout = useMemo(() => {
    if (commits.length === 0) return null;
    const city = buildCityAtCommit(commits, timeIndex);
    return computeLayout(city, config.layout);
  }, [commits, timeIndex, config.layout]);

  const changedPaths = useMemo(
    () => commits.length ? getCommitChangedPaths(commits, timeIndex) : new Set<string>(),
    [commits, timeIndex]
  );

  const cityMetrics = useMemo(
    () => cityLayout ? computeCityMetrics(cityLayout, deps, config.analytics) : null,
    [cityLayout, config.analytics]
  );

  const sceneStats = useMemo(() => {
    if (!cityLayout) return null;
    let buildings = 0;
    let districts = 0;
    let totalSize = 0;
    const traverse = (node: LayoutNode) => {
      if (node.type === 'file') {
        buildings++;
        totalSize += node.size;
      } else {
        districts++;
        if (node.children) node.children.forEach(traverse);
      }
    };
    traverse(cityLayout);

    let arcs = 0;
    Object.values(deps).forEach(targets => {
      arcs += targets.length;
    });

    return {
      buildings,
      districts,
      arcs,
      totalSize,
      instances: buildings // Currently 1:1 for building instances
    };
  }, [cityLayout]);

  const handleSelect = useCallback((node: LayoutNode) => {
    setBuildingTab('overview');
    setSelectedBuilding(prev => (prev?.path === node.path ? null : node));
  }, []);

  const copyTimeoutRef = useRef<number | null>(null);

  const handleCopy = useCallback(async (label: string, value: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }

      setCopiedLabel(label);
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => setCopiedLabel(null), 1200);
    } catch {
      setCopiedLabel(null);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!aboutOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAboutOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [aboutOpen]);

  const selectedFileDetails = useMemo<SelectedFileDetails | null>(() => {
    if (!selectedBuilding) return null;

    const history: FileCommitDetail[] = [];

    for (let i = 0; i <= timeIndex; i++) {
      const commit = commits[i];
      if (!commit) continue;
      for (const file of commit.files) {
        if (file.path !== selectedBuilding.path) continue;
        history.push({
          commitIndex: i,
          hash: commit.hash,
          date: commit.date,
          author: commit.author_name,
          message: commit.message,
          status: file.status,
          added: file.added,
          deleted: file.deleted,
        });
      }
    }

    const firstSeen = history.length > 0 ? history[0].date : null;
    const lastTouched = history.length > 0 ? history[history.length - 1] : null;
    const recentHistory = [...history].reverse().slice(0, 8);

    const totalAddedAtSnapshot = history.reduce((sum, h) => sum + h.added, 0);
    const totalDeletedAtSnapshot = history.reduce((sum, h) => sum + h.deleted, 0);

    const outgoingDeps = deps[selectedBuilding.path] ?? [];
    const incomingDeps = Object.entries(deps)
      .filter(([, targets]) => targets.includes(selectedBuilding.path))
      .map(([source]) => source);

    return {
      path: selectedBuilding.path,
      extension: getFileExtension(selectedBuilding.path),
      directory: getFileDirectory(selectedBuilding.path),
      breadcrumbs: selectedBuilding.path.split('/').filter(Boolean),
      changeCount: history.length,
      firstSeen,
      lastTouched,
      recentHistory,
      totalAddedAtSnapshot,
      totalDeletedAtSnapshot,
      isChangedInSnapshotCommit: changedPaths.has(selectedBuilding.path),
      statusAtSnapshot: lastTouched?.status ?? null,
      outgoingDeps,
      incomingDeps,
    };
  }, [selectedBuilding, timeIndex, commits, changedPaths]);

  const handleProfilerRender = useCallback(
    (
      id: string,
      phase: 'mount' | 'update' | 'nested-update',
      actualDuration: number,
      baseDuration: number,
      startTime: number,
      commitTime: number,
    ) => {
      if (!collectProfilerRef.current) return;
      const profiler = profilerBufferRef.current;
      profiler.id.push(id);
      profiler.phase.push(phase);
      profiler.actualDuration.push(actualDuration);
      profiler.baseDuration.push(baseDuration);
      profiler.startTime.push(startTime);
      profiler.commitTime.push(commitTime);
    },
    [],
  );

  const runRuntimeBenchmark = useCallback(async () => {
    const WARMUP_ITERATIONS = 2;
    const MAIN_ITERATIONS = 12;

    setBenchmarkStatus('running');
    setBenchmarkStatusText(`Starting: ${WARMUP_ITERATIONS} warmup + ${MAIN_ITERATIONS} main...`);
    collectProfilerRef.current = true;
    profilerBufferRef.current = createEmptyRuntimeResults().reactProfiler;

    const allRenderTime: number[] = [];
    const allCls: number[] = [];
    const allLcp: number[] = [];
    const allInp: number[] = [];
    const allFid: number[] = [];
    const allTtfb: number[] = [];
    const allActualDuration: number[] = [];
    const results = createEmptyRuntimeResults();

    try {
      // Warm-up phase (silent)
      for (let ww = 0; ww < WARMUP_ITERATIONS; ww++) {
        const tempProfiler = createEmptyRuntimeResults().reactProfiler;
        profilerBufferRef.current = tempProfiler;
        setBenchmarkTick(prev => prev + 1);
        await new Promise<void>(resolve => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
          });
        });
      }

      // Main phase with collection
      for (let ii = 0; ii < MAIN_ITERATIONS; ii++) {
        profilerBufferRef.current = createEmptyRuntimeResults().reactProfiler;

        let clsValue = 0;
        let lcpValue: number | null = null;
        let inpValue: number | null = null;
        let fidValue: number | null = null;
        let ttfbValue: number | null = null;
        const observers: PerformanceObserver[] = [];

        try {
          if (ii === 0) {
            const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
            if (navEntry) {
              ttfbValue = navEntry.responseStart - navEntry.requestStart;
            }
          }

          if (typeof PerformanceObserver !== 'undefined') {
            const clsObserver = new PerformanceObserver(list => {
              for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput?: boolean; value?: number }>) {
                if (!entry.hadRecentInput) {
                  clsValue += entry.value ?? 0;
                }
              }
            });
            clsObserver.observe({ type: 'layout-shift', buffered: true });
            observers.push(clsObserver);

            const lcpObserver = new PerformanceObserver(list => {
              const entries = list.getEntries();
              if (entries.length > 0) {
                lcpValue = entries[entries.length - 1].startTime;
              }
            });
            lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
            observers.push(lcpObserver);

            const inpObserver = new PerformanceObserver(list => {
              const entries = list.getEntries() as Array<PerformanceEntry & { interactionId?: number; duration?: number }>;
              for (const entry of entries) {
                if ((entry.interactionId ?? 0) > 0) {
                  const duration = entry.duration ?? 0;
                  inpValue = inpValue == null ? duration : Math.max(inpValue, duration);
                }
              }
            });
            inpObserver.observe({ type: 'event', buffered: true } as PerformanceObserverInit);
            observers.push(inpObserver);
          }

          const start = performance.now();
          setBenchmarkTick(prev => prev + 1);
          await new Promise<void>(resolve => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => resolve());
            });
          });
          const duration = performance.now() - start;
          allRenderTime.push(duration);

          if (clsValue > 0) allCls.push(clsValue);
          if (lcpValue != null) allLcp.push(lcpValue);
          if (inpValue != null) allInp.push(inpValue);
          if (fidValue != null) allFid.push(fidValue);
          if (ttfbValue != null) allTtfb.push(ttfbValue);

          allActualDuration.push(...profilerBufferRef.current.actualDuration);

          observers.forEach(observer => observer.disconnect());
        } catch (err) {
          console.error(`Error in iteration ${ii}:`, err);
        }

        setBenchmarkStatusText(`Running: ${ii + 1}/${MAIN_ITERATIONS}`);
      }

      collectProfilerRef.current = false;

      results.renderTime = allRenderTime;
      results.webVitals.cls = allCls;
      results.webVitals.lcp = allLcp;
      results.webVitals.inp = allInp;
      results.webVitals.fid = allFid;
      results.webVitals.ttfb = allTtfb;
      results.reactProfiler.actualDuration = allActualDuration;

      const renderStats = computeStats(allRenderTime);
      const lcpStats = computeStats(allLcp);
      const inpStats = computeStats(allInp);
      const profilerStats = computeStats(allActualDuration);

      setBenchmarkResults(results);
      (results as any)._stats = { renderStats, lcpStats, inpStats, profilerStats };
      setBenchmarkStatus('done');
      setBenchmarkStatusText(
        `✓ ${MAIN_ITERATIONS} iterations. Render: ${renderStats?.median.toFixed(1)}ms (p95: ${renderStats?.p95.toFixed(1)}ms)`
      );
    } catch (error) {
      collectProfilerRef.current = false;
      const message = error instanceof Error ? error.message : String(error);
      results.error = message;
      setBenchmarkResults(results);
      setBenchmarkStatus('error');
      setBenchmarkStatusText(`✗ Failed: ${message}`);
    }
  }, []);

  const exportRuntimeBenchmark = useCallback(() => {
    if (!benchmarkResults) return;
    const stats = (benchmarkResults as any)._stats;
    exportRuntimePerformanceAsJson(benchmarkResults, stats);
  }, [benchmarkResults]);

  // Set initial time index once commits load
  useEffect(() => {
    if (commits.length > 0 && timeIndex === 0 && !isPlaying) {
      setTimeIndex(commits.length - 1);
    }
  }, [commits.length]);

  if (isLoading) {
    return <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Loading Git History...</div>;
  }

  return (
    <div
      className="app-container"
      onClick={(e) => {
        if (e.target === e.currentTarget) setSelectedBuilding(null);
      }}
    >
      {/* Analytics slide-in trigger */}
      <button className="ap-trigger" onClick={e => { e.stopPropagation(); setAnalyticsOpen(o => !o); }}>
        {analyticsOpen ? 'Close Analytics' : 'Analytics'}
      </button>

      {/* Top action triggers */}
      <div className="top-action-buttons">
        <button className="about-trigger" onClick={e => { e.stopPropagation(); setAboutOpen(true); }}>
          About Us
        </button>

        <button 
          className={`stats-trigger ${statsOpen ? 'active' : ''}`} 
          onClick={e => { e.stopPropagation(); setStatsOpen(o => !o); }}
        >
          {statsOpen ? 'Hide Stats' : 'Stats'}
        </button>

        {!settingsOpen && (
          <button className="sp-trigger" onClick={e => { e.stopPropagation(); setSettingsOpen(true); }}>
            Settings
          </button>
        )}
      </div>

      {/* Settings panel */}
      {settingsOpen && (
        <SettingsPanel
          config={config}
          onChange={setConfig}
          onClose={() => setSettingsOpen(false)}
          onRunRuntimeBenchmark={runRuntimeBenchmark}
          onExportRuntimeBenchmark={exportRuntimeBenchmark}
          benchmarkRunning={benchmarkStatus === 'running'}
          benchmarkReady={benchmarkResults !== null}
          benchmarkStatusText={benchmarkStatusText}
        />
      )}

      {/* Stats panel */}
      {statsOpen && sceneStats && (
        <StatsPanel 
          stats={sceneStats} 
          onClose={() => setStatsOpen(false)} 
        />
      )}

      {/* Analytics panel */}
      {cityMetrics && (
        <AnalyticsPanel
          metrics={cityMetrics}
          isOpen={analyticsOpen}
          onClose={() => setAnalyticsOpen(false)}
        />
      )}

      {aboutOpen && (
        <div className="about-modal-backdrop" onClick={() => setAboutOpen(false)}>
          <div
            className="about-modal"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
          >
            <button className="about-close" onClick={() => setAboutOpen(false)} aria-label="Close about modal">✕</button>
            <h2 id="about-title">About Temporal Code City</h2>

            <p>
              Temporal Code City is a 3D software visualization tool that shows repository evolution over time using a city metaphor.
              Buildings represent files, districts represent folders/packages, and curved arcs represent dependencies.
            </p>

            <p>
              The project is designed for large Git histories, combining stable treemap layout, instanced WebGL rendering,
              and analytics metrics such as modularity index, coupling radius, hub detection, abandoned zones,
              and skyline roughness.
            </p>

            <div className="about-section">
              <h3>Authors</h3>
              <ul>
                <li>Christopher Gijoh</li>
                <li>Evan Laluan</li>
                <li>Christian Oroh</li>
              </ul>
              <p>S1 Informatika, Universitas Pelita Harapan. Developed to fulfill the final project of Computer Graphics course.</p>
            </div>

            <div className="about-section">
              <h3>Tech Stack</h3>
              <p>React, Three.js, @react-three/fiber, @react-three/drei, TypeScript, Node.js, d3-hierarchy.</p>
            </div>
          </div>
        </div>
      )}
      {/* 3D Scene */}
      <Profiler id="Scene" onRender={handleProfilerRender}>
        <div className="scene-container">
          {cityLayout && (
            <Scene
              key={benchmarkTick}
              data={cityLayout}
              changedPaths={changedPaths}
              onSelect={handleSelect}
              minDate={minDate}
              maxDate={maxDate}
              deps={deps}
              config={config}
            />
          )}
        </div>
      </Profiler>

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

        <div className="controls" style={{ display: 'none' }}>
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
          <div className="legend-item"><span className="swatch hot" /> Cold to Hot (Recency)</div>
          <div className="legend-item"><span className="swatch changed" /> Changed this commit</div>
        </div>
      </div>

      {/* Right panel: selected building info */}
      {selectedBuilding && (
        <div className="building-panel" onClick={e => e.stopPropagation()}>
          <button className="panel-close" onClick={() => setSelectedBuilding(null)}>✕</button>
          <h2 className="panel-title">{selectedBuilding.name}</h2>
          <div className="panel-path-row">
            <p className="panel-path">{selectedBuilding.path}</p>
            <button
              className="copy-btn"
              onClick={() => handleCopy('path', selectedBuilding.path)}
              title="Copy file path"
            >
              {copiedLabel === 'path' ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div className="panel-meta-row">
            <span className="meta-pill">.{selectedFileDetails?.extension ?? 'none'}</span>
            <span className="meta-pill">{selectedFileDetails?.statusAtSnapshot ?? '—'}</span>
            <span className={`meta-pill ${selectedFileDetails?.isChangedInSnapshotCommit ? 'meta-hot' : ''}`}>
              {selectedFileDetails?.isChangedInSnapshotCommit ? 'changed now' : 'unchanged now'}
            </span>
          </div>

          <div className="panel-tabs" role="tablist" aria-label="Building details tabs">
            <button
              className={`tab-btn ${buildingTab === 'overview' ? 'active' : ''}`}
              onClick={() => setBuildingTab('overview')}
            >
              Overview
            </button>
            <button
              className={`tab-btn ${buildingTab === 'history' ? 'active' : ''}`}
              onClick={() => setBuildingTab('history')}
            >
              History
            </button>
            <button
              className={`tab-btn ${buildingTab === 'deps' ? 'active' : ''}`}
              onClick={() => setBuildingTab('deps')}
            >
              Dependencies
            </button>
          </div>

          {buildingTab === 'overview' && (
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
              <div className="stat">
                <span className="stat-label">Changed up to Snapshot</span>
                <span className="stat-value">{selectedFileDetails?.changeCount.toLocaleString() ?? '0'}x</span>
              </div>
              <div className="stat">
                <span className="stat-label">Snapshot Additions</span>
                <span className="stat-value additions">+{(selectedFileDetails?.totalAddedAtSnapshot ?? 0).toLocaleString()}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Snapshot Deletions</span>
                <span className="stat-value deletions">-{(selectedFileDetails?.totalDeletedAtSnapshot ?? 0).toLocaleString()}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Directory</span>
                <span className="stat-value directory-value" title={selectedFileDetails?.directory}>{selectedFileDetails?.directory ?? '/'}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Breadcrumbs</span>
                <span className="stat-value breadcrumb-value" title={selectedFileDetails?.breadcrumbs.join(' / ')}>
                  {selectedFileDetails?.breadcrumbs.join(' / ') || '—'}
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">First Seen</span>
                <span className="stat-value">
                  {selectedFileDetails?.firstSeen
                    ? `${new Date(selectedFileDetails.firstSeen).toLocaleDateString()} (${formatRelativeTime(selectedFileDetails.firstSeen)})`
                    : '—'}
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Last Commit</span>
                <span className="stat-value">
                  {selectedFileDetails?.lastTouched
                    ? new Date(selectedFileDetails.lastTouched.date).toLocaleDateString()
                    : '—'}
                </span>
              </div>
              {selectedFileDetails?.lastTouched && (
                <>
                  <div className="stat">
                    <span className="stat-label">Last Author</span>
                    <span className="stat-value">{selectedFileDetails.lastTouched.author}</span>
                  </div>
                  <div className="stat stat-col">
                    <span className="stat-label">Last Message</span>
                    <span className="stat-value wrapped">{selectedFileDetails.lastTouched.message}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {buildingTab === 'history' && (
            <div className="history-list">
              {selectedFileDetails?.recentHistory.length ? selectedFileDetails.recentHistory.map(item => (
                <div className="history-item" key={`${item.hash}-${item.commitIndex}`}>
                  <div className="history-head">
                    <span className="history-hash mono">{item.hash.slice(0, 7)}</span>
                    <button
                      className="copy-btn compact"
                      onClick={() => handleCopy(`hash-${item.hash}`, item.hash)}
                      title="Copy commit hash"
                    >
                      {copiedLabel === `hash-${item.hash}` ? 'Copied' : 'Copy'}
                    </button>
                    <span className="history-status">{item.status}</span>
                  </div>
                  <div className="history-meta">
                    {new Date(item.date).toLocaleString()} · {item.author}
                  </div>
                  <div className="history-message">{item.message}</div>
                  <div className="history-delta">
                    <span className="additions">+{item.added.toLocaleString()}</span>
                    <span className="deletions">-{item.deleted.toLocaleString()}</span>
                  </div>
                </div>
              )) : (
                <div className="empty-state">No commits found for this file at current snapshot.</div>
              )}
            </div>
          )}

          {buildingTab === 'deps' && (
            <div className="deps-section">
              <div className="stat">
                <span className="stat-label">Outgoing</span>
                <span className="stat-value">{selectedFileDetails?.outgoingDeps.length ?? 0}</span>
              </div>
              <div className="deps-list">
                {(selectedFileDetails?.outgoingDeps.length ?? 0) > 0 ? (
                  selectedFileDetails?.outgoingDeps.slice(0, 20).map(depPath => (
                    <div className="dep-item" key={`out-${depPath}`}>
                      <span className="dep-path mono" title={depPath}>{depPath}</span>
                      <button className="copy-btn compact" onClick={() => handleCopy(`dep-${depPath}`, depPath)}>
                        {copiedLabel === `dep-${depPath}` ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No outgoing dependencies mapped.</div>
                )}
              </div>

              <div className="stat">
                <span className="stat-label">Incoming</span>
                <span className="stat-value">{selectedFileDetails?.incomingDeps.length ?? 0}</span>
              </div>
              <div className="deps-list">
                {(selectedFileDetails?.incomingDeps.length ?? 0) > 0 ? (
                  selectedFileDetails?.incomingDeps.slice(0, 20).map(depPath => (
                    <div className="dep-item" key={`in-${depPath}`}>
                      <span className="dep-path mono" title={depPath}>{depPath}</span>
                      <button className="copy-btn compact" onClick={() => handleCopy(`dep-${depPath}`, depPath)}>
                        {copiedLabel === `dep-${depPath}` ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No incoming dependencies mapped.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timeline Panel */}
      <TimelinePanel 
        commits={commits}
        timeIndex={timeIndex}
        setTimeIndex={setTimeIndex}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        playSpeed={playSpeed}
        setPlaySpeed={setPlaySpeed}
        playSpeeds={PLAY_SPEEDS}
      />
    </div>
  );
}

export default App;
