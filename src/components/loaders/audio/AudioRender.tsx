import { useCallback, useEffect, useRef, useState } from 'react';
import { GlassStage } from '../../../glass/GlassStage';
import type { EnvironmentKind } from '../../../glass/types';
import { useReducedMotion } from '../../../state/reducedMotion';
import { formatTime } from '../../controls/GlassScrubber/scrubberMath';
import { AUD, AudioController } from './audioController';
import type { AudioPhase } from './audioController';
import { DURATIONS, PRESETS, renderPreset, SAMPLE_RATE } from './synth';
import type { SoundPreset } from './synth';
import { encodeWav, envelope, normalize, peakOf } from './wav';

interface Output {
  url: string;
  bytes: number;
  peak: number;
  preset: SoundPreset;
  duration: number;
}

export function AudioRender({ env }: { env: EnvironmentKind }) {
  const [ctrl] = useState(() => new AudioController());
  const audioRef = useRef<HTMLAudioElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [preset, setPreset] = useState<SoundPreset>('bell');
  const [duration, setDuration] = useState<number>(4);
  const [phase, setPhaseState] = useState<AudioPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [output, setOutput] = useState<Output | null>(null);
  const [message, setMessage] = useState('');
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const reducedMotion = useReducedMotion();

  const setPhase = useCallback(
    (p: AudioPhase) => {
      ctrl.setPhase(p);
      setPhaseState(p);
    },
    [ctrl],
  );

  useEffect(() => ctrl.setReducedMotion(reducedMotion), [ctrl, reducedMotion]);
  // revoke the old WAV URL whenever the output changes, and on unmount
  useEffect(() => () => {
    if (output) URL.revokeObjectURL(output.url);
  }, [output]);
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const tick = () => {
      setTime(a.currentTime);
      ctrl.setPlayhead(a.duration > 0 ? a.currentTime / a.duration : -1);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      tick();
    };
    const onEnded = () => {
      setPlaying(false);
      ctrl.setPlayhead(1);
    };
    let raf = 0;
    const loop = () => {
      tick();
      if (!a.paused) raf = requestAnimationFrame(loop);
    };
    const start = () => {
      onPlay();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    };
    a.addEventListener('play', start);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnded);
    a.addEventListener('seeked', tick);
    return () => {
      cancelAnimationFrame(raf);
      a.removeEventListener('play', start);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('seeked', tick);
      a.pause();
    };
  }, [ctrl]);

  /** Changing the preset or duration invalidates the old render. */
  const invalidate = () => {
    abortRef.current?.abort();
    audioRef.current?.pause();
    audioRef.current?.removeAttribute('src');
    setOutput(null);
    setTime(0);
    ctrl.setPlayhead(-1);
    if (phase !== 'idle') setPhase('idle');
    setMessage('');
  };

  const render = async () => {
    invalidate();
    if (typeof OfflineAudioContext === 'undefined') {
      setPhase('error');
      setMessage('This browser cannot render audio offline.');
      return;
    }
    const abort = new AbortController();
    abortRef.current = abort;
    setPhase('rendering');
    setProgress(0);
    setMessage('Rendering…');
    const t0 = performance.now();
    try {
      const buf = await renderPreset({
        preset,
        duration,
        signal: abort.signal,
        onProgress: (p) => {
          setProgress(p);
          ctrl.setProgress(p);
        },
      });
      const samples = normalize(new Float32Array(buf.getChannelData(0)));
      const peak = peakOf(samples);
      const wav = encodeWav([samples], SAMPLE_RATE);
      const url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
      ctrl.setBins(envelope(samples, AUD.bins));
      setPhase('ready');
      ctrl.setBins(envelope(samples, AUD.bins));
      setOutput({ url, bytes: wav.byteLength, peak, preset, duration });
      if (audioRef.current) audioRef.current.src = url;
      const ms = Math.round(performance.now() - t0);
      setMessage(`Rendered ${duration} s at ${SAMPLE_RATE / 1000} kHz in ${ms} ms · peak ${(20 * Math.log10(peak)).toFixed(1)} dBFS`);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setPhase('error');
      setMessage(err instanceof Error ? err.message : 'The render failed');
    }
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a || !output) return;
    if (a.paused) {
      if (a.ended) a.currentTime = 0;
      a.play().catch(() => setMessage('Playback was blocked by the browser; press play again'));
    } else a.pause();
  };

  const ready = phase === 'ready' && output;
  const pct = Math.round(progress * 100);
  return (
    <div className="instrument">
      <GlassStage controller={ctrl} width={AUD.W} height={AUD.H} env={env} label="Audio Render">
        {phase === 'rendering' && (
          <div role="progressbar" aria-label="Rendering audio" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="sr-only" data-testid="audio-progress">
            {pct}%
          </div>
        )}
        <div className="capture-panel audio-panel" style={{ left: 56, top: 248, width: 528 }}>
          <div className="audio-row">
            <div className="chip-row" role="radiogroup" aria-label="Sound">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  className="chip"
                  aria-checked={preset === p.id}
                  disabled={phase === 'rendering'}
                  onClick={() => {
                    setPreset(p.id);
                    invalidate();
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="chip-row" role="radiogroup" aria-label="Duration">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  className="chip"
                  aria-checked={duration === d}
                  disabled={phase === 'rendering'}
                  onClick={() => {
                    setDuration(d);
                    invalidate();
                  }}
                >
                  {d} s
                </button>
              ))}
            </div>
          </div>
          <div className="audio-row">
            {!ready ? (
              <button type="button" className="chip chip--primary" onClick={render} disabled={phase === 'rendering'} data-testid="audio-render">
                {phase === 'rendering' ? `Rendering… ${pct}%` : 'Render audio'}
              </button>
            ) : (
              <>
                <button type="button" className="chip chip--primary" onClick={togglePlay} data-testid="audio-play">
                  {playing ? 'Pause' : 'Play'}
                </button>
                <label className="audio-seek">
                  <span className="sr-only">Position</span>
                  <input
                    type="range"
                    min={0}
                    max={Math.round(output.duration * 100)}
                    step={1}
                    value={Math.round(time * 100)}
                    aria-valuetext={`${formatTime(time)} of ${formatTime(output.duration)}`}
                    onChange={(e) => {
                      const a = audioRef.current;
                      if (a) a.currentTime = Number(e.target.value) / 100;
                    }}
                    data-testid="audio-seek"
                  />
                </label>
                <span className="scrubber-time">{formatTime(time)}</span>
                <a className="chip" href={output.url} download={`glass-${output.preset}-${output.duration}s.wav`} data-testid="audio-download">
                  Download WAV
                </a>
                <button type="button" className="chip" onClick={invalidate} data-testid="audio-reset">
                  Reset
                </button>
              </>
            )}
          </div>
          <p className="study-status" role="status" data-testid="audio-status" data-phase={phase} data-tone={phase === 'error' ? 'error' : undefined}>
            {message || 'Choose a sound and render it in your browser. Nothing is uploaded.'}
          </p>
        </div>
      </GlassStage>
      <div className="scrubber-decoders" aria-hidden="true">
        <audio ref={audioRef} preload="auto" data-testid="audio-element" />
      </div>
    </div>
  );
}
