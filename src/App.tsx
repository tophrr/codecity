
import { Profiler, useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Scene } from './components/Scene';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { TimelinePanel } from './components/TimelinePanel';
import { SettingsPanel } from './components/SettingsPanel';
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
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [benchmarkTick, setBenchmarkTick] = useState(0);
  const [benchmarkStatus, setBenchmarkStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [benchmarkResults, setBenchmarkResults] = useState<RuntimePerformanceResults | null>(null);
  const [benchmarkStatusText, setBenchmarkStatusText] = useState('Not run yet');
  const collectProfilerRef = useRef(false);
  const profilerBufferRef = useRef(createEmptyRuntimeResults().reactProfiler);
  const [config, setConfig] = useState<CityConfig>({
    layout: { width: 100, height: 100, padding: 1 },
    verticalScale: 1,
    colorPalette: 'magma',
    district: { lotHeight: 0.04, lotDepthStep: 0.015 },
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

  const handleSelect = useCallback((node: LayoutNode) => {
    setSelectedBuilding(prev => (prev?.path === node.path ? null : node));
  }, []);

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
    <div className="app-container" onClick={() => setSelectedBuilding(null)}>
      {/* Analytics slide-in trigger */}
      <button className="ap-trigger" onClick={e => { e.stopPropagation(); setAnalyticsOpen(o => !o); }}>
        {analyticsOpen ? 'Close Analytics' : 'Analytics'}
      </button>

      {/* Settings trigger */}
      {!settingsOpen && (
        <button className="sp-trigger" onClick={e => { e.stopPropagation(); setSettingsOpen(true); }}>
          Settings
        </button>
      )}

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

      {/* Analytics panel */}
      {cityMetrics && (
        <AnalyticsPanel
          metrics={cityMetrics}
          isOpen={analyticsOpen}
          onClose={() => setAnalyticsOpen(false)}
        />
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
