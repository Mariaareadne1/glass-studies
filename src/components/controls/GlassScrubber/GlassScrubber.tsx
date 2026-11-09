import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useIsFocused } from '../../../app/presentation';
import { GlassStage } from '../../../glass/GlassStage';
import type { EnvironmentKind } from '../../../glass/types';
import { usePointerDrag } from '../../../motion/usePointerDrag';
import { useReducedMotion } from '../../../state/reducedMotion';
import { ScrubberController } from './scrubberController';
import { formatTime, SCRUB, thumbTimes } from './scrubberMath';
import { SeekQueue } from './seekQueue';

export const SAMPLE_URL = `${import.meta.env.BASE_URL}media/glass-sample.mp4`;
const SEEK_STEP = 5;

interface Source {
  url: string;
  name: string;
  /** Object URL we created (revoked on replace / unmount). */
  owned: boolean;
}

const MEDIA_ERRORS: Record<number, string> = {
  1: 'Loading was aborted',
  2: 'A network error stopped the video',
  3: 'This video could not be decoded',
  4: 'This browser cannot play this video format',
};

/** Seek an element and resolve once the frame at that time is decoded. */
function seekTo(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(v.currentTime - t) < 1e-3 && v.readyState >= 2) return resolve();
    const done = () => {
      v.removeEventListener('seeked', done);
      resolve();
    };
    v.addEventListener('seeked', done);
    v.currentTime = t;
  });
}

export function GlassScrubber({ env }: { env: EnvironmentKind }) {
  const [ctrl] = useState(() => new ScrubberController());
  const overlayRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const mainRef = useRef<HTMLVideoElement>(null);
  const thumbRef = useRef<HTMLVideoElement>(null);
  const hoverRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const mainSeek = useRef<SeekQueue | null>(null);
  const hoverSeek = useRef<SeekQueue | null>(null);
  const reducedMotion = useReducedMotion();
  const focused = useIsFocused();
  const [source, setSource] = useState<Source | null>({ url: SAMPLE_URL, name: 'Sample · Glass loaders (10 s)', owned: false });
  const [status, setStatus] = useState<'empty' | 'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [thumbsReady, setThumbsReady] = useState(false);

  useEffect(() => ctrl.setReducedMotion(reducedMotion), [ctrl, reducedMotion]);
  useEffect(() => ctrl.updateMedia({ status, message }), [ctrl, status, message]);

  // revoke object URLs we created when the source changes or the study unmounts
  useEffect(() => {
    return () => {
      if (source?.owned) URL.revokeObjectURL(source.url);
    };
  }, [source]);

  // wire the main element: events → state, seek queue
  useEffect(() => {
    const v = mainRef.current;
    const hv = hoverRef.current;
    if (!v || !hv) return;
    ctrl.updateMedia({ video: v });
    mainSeek.current = new SeekQueue(v);
    hoverSeek.current = new SeekQueue(hv);
    const sync = () => {
      setTime(v.currentTime);
      ctrl.refresh();
    };
    const onMeta = () => {
      setDuration(v.duration);
      setStatus('ready');
      setTime(v.currentTime);
    };
    const onPlay = () => {
      setPlaying(true);
      ctrl.setPlaying(true);
    };
    const onPause = () => {
      setPlaying(false);
      ctrl.setPlaying(false);
      sync();
    };
    const onError = () => {
      const code = v.error?.code ?? 0;
      if (!v.getAttribute('src')) return;
      setStatus('error');
      setMessage(MEDIA_ERRORS[code] ?? 'The video could not be loaded');
    };
    const onVolume = () => setMuted(v.muted);
    // the hover sampler: snapshot the decoded frame at the hover time
    const preview = document.createElement('canvas');
    preview.width = 192;
    preview.height = 108;
    const onHoverSeeked = () => {
      const g = preview.getContext('2d');
      if (!g || hv.videoWidth === 0) return;
      g.drawImage(hv, 0, 0, preview.width, preview.height);
      ctrl.updateMedia({ preview, previewTime: hv.currentTime });
    };
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('loadeddata', sync);
    v.addEventListener('timeupdate', sync);
    v.addEventListener('seeked', sync);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('ended', onPause);
    v.addEventListener('error', onError);
    v.addEventListener('volumechange', onVolume);
    hv.addEventListener('seeked', onHoverSeeked);
    return () => {
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('loadeddata', sync);
      v.removeEventListener('timeupdate', sync);
      v.removeEventListener('seeked', sync);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('ended', onPause);
      v.removeEventListener('error', onError);
      v.removeEventListener('volumechange', onVolume);
      hv.removeEventListener('seeked', onHoverSeeked);
      mainSeek.current?.dispose();
      hoverSeek.current?.dispose();
      v.pause();
    };
  }, [ctrl]);

  // load a source into all three elements; sample the strip from real frames
  useEffect(() => {
    const els = [mainRef.current, thumbRef.current, hoverRef.current];
    if (els.some((e) => !e)) return;
    const [v, tv, hv] = els as HTMLVideoElement[];
    let cancelled = false;
    ctrl.updateMedia({ strip: null, preview: null, previewTime: null });
    if (!source) {
      for (const e of els as HTMLVideoElement[]) {
        e.pause();
        e.removeAttribute('src');
        e.load();
      }
      return;
    }
    for (const e of [v, tv, hv]) {
      e.src = source.url;
      e.load();
    }
    const sample = async () => {
      await new Promise<void>((res, rej) => {
        if (tv.readyState >= 1) return res();
        tv.addEventListener('loadedmetadata', () => res(), { once: true });
        tv.addEventListener('error', () => rej(new Error('metadata')), { once: true });
      });
      const times = thumbTimes(tv.duration);
      const strip = document.createElement('canvas');
      const cellW = Math.round((SCRUB.strip.w * 2) / times.length);
      strip.width = cellW * times.length;
      strip.height = SCRUB.strip.h * 2;
      const g = strip.getContext('2d');
      if (!g) return;
      for (let i = 0; i < times.length; i++) {
        if (cancelled) return;
        await seekTo(tv, times[i]);
        if (cancelled) return;
        // cover each cell with the real frame decoded at that time
        const k = Math.max(cellW / tv.videoWidth, strip.height / tv.videoHeight);
        const w = tv.videoWidth * k;
        const h = tv.videoHeight * k;
        g.save();
        g.beginPath();
        g.rect(i * cellW, 0, cellW, strip.height);
        g.clip();
        g.drawImage(tv, i * cellW + (cellW - w) / 2, (strip.height - h) / 2, w, h);
        g.restore();
        ctrl.updateMedia({ strip });
      }
      if (!cancelled) setThumbsReady(true);
    };
    sample().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ctrl, source]);

  /**
   * Switch source. UI state resets here, in the event that causes it; the
   * effect above only drives the media elements.
   */
  const changeSource = (next: Source | null, errorMessage?: string) => {
    setThumbsReady(false);
    setDuration(0);
    setTime(0);
    if (errorMessage) {
      setStatus('error');
      setMessage(errorMessage);
    } else {
      setStatus(next ? 'loading' : 'empty');
      setMessage('');
    }
    setSource(next);
  };

  const seek = useCallback((t: number) => {
    mainSeek.current?.request(t);
    ctrl.refresh();
  }, [ctrl]);

  usePointerDrag(overlayRef, scaleRef, {
    onStart(p) {
      if (status !== 'ready' || !ctrl.hitStrip(p.x, p.y)) return false;
      ctrl.setDragging(true);
      ctrl.setHover(p.x);
      timelineRef.current?.focus({ preventScroll: true });
      seek(ctrl.timeAt(p.x));
      return true;
    },
    onMove(p) {
      ctrl.setHover(p.x);
      seek(ctrl.timeAt(p.x));
    },
    onEnd(p, cancelled) {
      ctrl.setDragging(false);
      // release commits the final position
      if (!cancelled) seek(ctrl.timeAt(p.x));
      ctrl.setHover(null);
    },
  });

  // hover preview (mouse/pen only): a real frame sampled at the hover time
  const onHover = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || status !== 'ready') return;
    const host = overlayRef.current;
    if (!host) return;
    const r = host.getBoundingClientRect();
    const s = scaleRef.current || 1;
    const x = (e.clientX - r.left) / s;
    const y = (e.clientY - r.top) / s;
    if (!ctrl.hitStrip(x, y)) {
      ctrl.setHover(null);
      return;
    }
    ctrl.setHover(x);
    hoverSeek.current?.request(ctrl.timeAt(x));
  };

  const togglePlay = () => {
    const v = mainRef.current;
    if (!v || status !== 'ready') return;
    if (v.paused) {
      if (v.ended) v.currentTime = 0;
      v.play().catch(() => {
        setMessage('Playback was blocked by the browser; press play again');
      });
    } else v.pause();
  };

  const onKey = (e: KeyboardEvent) => {
    const v = mainRef.current;
    if (!v || status !== 'ready') return;
    let t: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') t = v.currentTime + SEEK_STEP;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') t = v.currentTime - SEEK_STEP;
    else if (e.key === 'Home') t = 0;
    else if (e.key === 'End') t = v.duration;
    else if (e.key === ' ' || e.key === 'k') {
      e.preventDefault();
      togglePlay();
      return;
    }
    if (t === null) return;
    e.preventDefault();
    seek(t);
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const probe = mainRef.current;
    if (!file.type.startsWith('video/') || (probe && probe.canPlayType(file.type) === '')) {
      changeSource(null, `This browser cannot play “${file.name}” (${file.type || 'unknown type'})`);
      return;
    }
    // stays local: an object URL, never uploaded
    changeSource({ url: URL.createObjectURL(file), name: file.name, owned: true });
  };

  const ready = status === 'ready';
  return (
    <div className="instrument">
      <GlassStage controller={ctrl} width={SCRUB.W} height={SCRUB.H} env={env} label="Glass Scrubber video timeline" scaleRef={scaleRef} overlayRef={overlayRef}>
        <div
          ref={timelineRef}
          role="slider"
          tabIndex={0}
          aria-label="Video position"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration * 10) / 10}
          aria-valuenow={Math.round(time * 10) / 10}
          aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
          aria-disabled={!ready}
          aria-describedby="scrubber-hint"
          data-testid="scrubber-timeline"
          data-time={time.toFixed(3)}
          data-duration={duration.toFixed(3)}
          data-thumbs={thumbsReady}
          className="hit"
          style={{ left: SCRUB.strip.x - 8, top: SCRUB.strip.y - 10, width: SCRUB.strip.w + 16, height: SCRUB.strip.h + 20, borderRadius: 16, touchAction: 'none' }}
          onKeyDown={onKey}
          onPointerMove={onHover}
          onPointerLeave={() => ctrl.setHover(null)}
        />
        <span id="scrubber-hint" className="sr-only">Arrow keys seek five seconds, Home and End jump to the ends, Space plays or pauses.</span>
        <div className="scrubber-bar" style={{ left: 36, top: 370, width: SCRUB.W - 72 }}>
          <button type="button" className="chip" onClick={togglePlay} disabled={!ready} data-testid="scrubber-play">
            {playing ? 'Pause' : 'Play'}
          </button>
          {focused && (
            <button type="button" className="chip" onClick={() => seek(0)} disabled={!ready}>
              Restart
            </button>
          )}
          {focused && (
          <button
            type="button"
            className="chip"
            aria-pressed={muted}
            onClick={() => {
              const v = mainRef.current;
              if (v) v.muted = !v.muted;
            }}
            disabled={!ready}
            data-testid="scrubber-mute"
          >
            {muted ? 'Unmute' : 'Mute'}
          </button>
          )}
          <span className="scrubber-time" data-testid="scrubber-time">
            {formatTime(time)} / {formatTime(duration)}
          </span>
          {focused && (
            <>
          <label className="chip file-button">
            Open…
            <input type="file" accept="video/*" onChange={onFile} data-testid="scrubber-file" />
          </label>
          <button type="button" className="chip" onClick={() => changeSource({ url: SAMPLE_URL, name: 'Sample · Glass loaders (10 s)', owned: false })} disabled={source?.url === SAMPLE_URL && status !== 'error'}>
            Sample
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => changeSource(null)}
            disabled={!source}
            data-testid="scrubber-eject"
          >
            Eject
          </button>
            </>
          )}
        </div>
        {focused && <p className="study-status scrubber-status" style={{ left: 40, top: 412, width: SCRUB.W - 80 }} role="status" data-testid="scrubber-status" data-status={status} data-tone={status === 'error' ? 'error' : undefined}>
          {status === 'error' ? message : status === 'empty' ? 'No video loaded' : status === 'loading' ? 'Loading…' : `${source?.name ?? ''}${message ? ` · ${message}` : ''}`}
        </p>}
      </GlassStage>
      {/* decoders: drawn into the glass stage, never shown directly */}
      <div className="scrubber-decoders" aria-hidden="true">
        <video ref={mainRef} muted playsInline preload="auto" data-testid="scrubber-video" />
        <video ref={thumbRef} muted playsInline preload="auto" />
        <video ref={hoverRef} muted playsInline preload="auto" />
      </div>
    </div>
  );
}
