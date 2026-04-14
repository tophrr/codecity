import React, { useRef, useEffect } from 'react';
import type { Commit } from '../types';
import './TimelinePanel.css';

interface TimelinePanelProps {
  commits: Commit[];
  timeIndex: number;
  setTimeIndex: (index: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  playSpeed: string;
  setPlaySpeed: (speed: string) => void;
  playSpeeds: Record<string, number>;
}

export const TimelinePanel: React.FC<TimelinePanelProps> = ({
  commits,
  timeIndex,
  setTimeIndex,
  isPlaying,
  setIsPlaying,
  playSpeed,
  setPlaySpeed,
  playSpeeds
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to center the active item
  useEffect(() => {
    if (scrollRef.current && commits.length > 0) {
      const container = scrollRef.current;
      const elementHtml = container.children[timeIndex] as HTMLElement;
      if (elementHtml) {
        const offset = elementHtml.offsetLeft;
        const containerCenter = container.clientWidth / 2;
        const targetScroll = offset - containerCenter + elementHtml.clientWidth / 2;
        container.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
      }
    }
  }, [timeIndex, commits.length]);

  if (!commits || commits.length === 0) return null;
  const currentCommit = commits[timeIndex];

  return (
    <div className="timeline-wrapper" onClick={(e) => e.stopPropagation()}>
      <div className="timeline-panel">
        
        {/* Controls Area */}
        <div className="timeline-controls">
          <div className="timeline-playback">
            <button
              className={`timeline-play-btn ${isPlaying ? 'playing' : ''}`}
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={timeIndex === commits.length - 1 && !isPlaying}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <button
              className="timeline-reset-btn"
              onClick={() => { setIsPlaying(false); setTimeIndex(0); }}
              title="Restart"
            >
              ↺
            </button>
            
            <div className="timeline-speed">
              {Object.keys(playSpeeds).map(s => (
                <button
                  key={s}
                  className={`timeline-speed-btn ${playSpeed === s ? 'active' : ''}`}
                  onClick={() => setPlaySpeed(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="timeline-current-meta">
             <strong>{currentCommit.hash.substring(0, 7)}</strong>
             <span>{new Date(currentCommit.date).toLocaleDateString()}</span>
             <span>({timeIndex + 1} / {commits.length})</span>
          </div>
        </div>

        {/* Tracks Area */}
        <div className="timeline-track-container" ref={scrollRef}>
          {commits.map((commit, idx) => {
            const isActive = idx === timeIndex;
            const isPast = idx < timeIndex;
            
            let added = 0;
            let deleted = 0;
            let modified = 0;
            
            commit.files.forEach(f => {
              added += f.added || 0;
              deleted += f.deleted || 0;
              if (f.status === 'M') modified++;
            });

            // Make the height proportional to changes, but clamped.
            const totalChanges = added + deleted;
            const logValue = Math.log(totalChanges + 1) * 6; // visual scaling
            const height = Math.min(50, Math.max(4, logValue));

            return (
              <div 
                key={commit.hash} 
                className={`timeline-item ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
                onClick={() => { setIsPlaying(false); setTimeIndex(idx); }}
                title={`${commit.hash.substring(0,7)} - ${commit.message}\n+${added} -${deleted} in ${commit.files.length} files`}
              >
                <div className="timeline-bar-wrapper">
                  <div className="timeline-bar" style={{ height: `${height}px` }}>
                     <div className="timeline-bar-added" style={{ flexGrow: added }} />
                     <div className="timeline-bar-deleted" style={{ flexGrow: deleted }} />
                     {totalChanges === 0 && <div className="timeline-bar-neutral" />}
                  </div>
                </div>
                <div className="timeline-dot" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
