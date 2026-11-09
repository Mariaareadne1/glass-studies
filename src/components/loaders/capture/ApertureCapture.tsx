import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { GlassStage } from '../../../glass/GlassStage';
import type { EnvironmentKind } from '../../../glass/types';
import { useReducedMotion } from '../../../state/reducedMotion';
import { CAP, CaptureController } from './captureController';
import type { CapturePhase } from './captureController';
import { FILTERS, fitWithin, processPixels } from './imagePipeline';
import type { CaptureFilter } from './imagePipeline';

const MAX_EDGE = 1600;

/** User-facing explanation for getUserMedia failures. */
function cameraError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera permission was denied. You can still upload a photo.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found. You can still upload a photo.';
  if (name === 'NotReadableError') return 'The camera is in use by another app.';
  return 'The camera could not be started. You can still upload a photo.';
}

export function ApertureCapture({ env }: { env: EnvironmentKind }) {
  const [ctrl] = useState(() => new CaptureController());
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [phase, setPhaseState] = useState<CapturePhase>('idle');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [filter, setFilter] = useState<CaptureFilter>('pearl');
  const [output, setOutput] = useState<{ url: string; w: number; h: number; source: 'camera' | 'upload' } | null>(null);
  const reducedMotion = useReducedMotion();

  const setPhase = useCallback(
    (p: CapturePhase) => {
      ctrl.setPhase(p);
      setPhaseState(p);
    },
    [ctrl],
  );

  useEffect(() => ctrl.setReducedMotion(reducedMotion), [ctrl, reducedMotion]);
  useEffect(() => {
    ctrl.setVideo(videoRef.current);
  }, [ctrl]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // never keep the camera running in the background or after leaving the study
  useEffect(() => {
    const onHidden = () => {
      if (document.hidden && streamRef.current) {
        stopCamera();
        setPhase('idle');
        setMessage('Camera stopped while the page was hidden.');
      }
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      abortRef.current?.abort();
      stopCamera();
    };
  }, [setPhase, stopCamera]);

  // revoke the previous output URL whenever it changes or on unmount
  useEffect(() => () => {
    if (output) URL.revokeObjectURL(output.url);
  }, [output]);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('error');
      setMessage('This browser has no camera access. You can still upload a photo.');
      return;
    }
    setPhase('requesting');
    setMessage('Waiting for camera permission…');
    try {
      // explicit user action only: this runs from the Start camera button
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      await v.play();
      setOutput(null);
      setPhase('live');
      setMessage('Live preview · nothing leaves this device');
    } catch (err) {
      stopCamera();
      setPhase('error');
      setMessage(cameraError(err));
    }
  };

  /** The shared pipeline: pixels in, a processed PNG out. */
  const runPipeline = async (draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, w0: number, h0: number, source: 'camera' | 'upload') => {
    const { w, h } = fitWithin(w0, h0, MAX_EDGE);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    if (!g) throw new Error('2D canvas unavailable');
    draw(g, w, h);
    const img = g.getImageData(0, 0, w, h);
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setPhase('processing');
    setMessage('Processing on this device…');
    setProgress(0);
    ctrl.setProgress(0);
    await processPixels(img.data, w, h, {
      filter,
      signal: abort.signal,
      onProgress: (p) => {
        setProgress(p);
        ctrl.setProgress(p);
      },
    });
    g.putImageData(img, 0, 0);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) throw new Error('Could not encode the image');
    if (abort.signal.aborted) return;
    ctrl.setResult(canvas);
    setOutput({ url: URL.createObjectURL(blob), w, h, source });
    setPhase('result');
    setMessage(`${w} × ${h} · ${FILTERS.find((f) => f.id === filter)?.label} · processed on this device`);
  };

  const capture = () => {
    const v = videoRef.current;
    if (!v || phase !== 'live' || v.videoWidth === 0) return;
    // grab the real frame now, then let the shutter close over it
    const w0 = v.videoWidth;
    const h0 = v.videoHeight;
    const frame = document.createElement('canvas');
    frame.width = w0;
    frame.height = h0;
    // un-mirror nothing: the capture is the camera's real frame, shown as taken
    frame.getContext('2d')?.drawImage(v, 0, 0, w0, h0);
    ctrl.setResult(frame);
    stopCamera();
    ctrl.closeThen(() => {
      runPipeline((g, w, h) => g.drawImage(frame, 0, 0, w, h), w0, h0, 'camera').catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setPhase('error');
        setMessage(err instanceof Error ? err.message : 'Processing failed');
      });
    });
    setPhaseState('closing');
    setMessage('Capturing…');
  };

  const onUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhase('error');
      setMessage(`“${file.name}” is not an image.`);
      return;
    }
    stopCamera();
    try {
      // honours EXIF orientation where the browser supports it
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      ctrl.closeThen(() => {
        runPipeline((g, w, h) => g.drawImage(bmp, 0, 0, w, h), bmp.width, bmp.height, 'upload')
          .catch((err: unknown) => {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            setPhase('error');
            setMessage(err instanceof Error ? err.message : 'Processing failed');
          })
          .finally(() => bmp.close());
      });
      setPhaseState('closing');
      setMessage('Processing your photo…');
    } catch {
      setPhase('error');
      setMessage(`“${file.name}” could not be decoded.`);
    }
  };

  const retake = () => {
    abortRef.current?.abort();
    ctrl.setResult(null);
    setOutput(null);
    setProgress(0);
    if (output?.source === 'camera') startCamera();
    else {
      setPhase('idle');
      setMessage('');
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setPhase('idle');
    setMessage('Cancelled.');
  };

  const busy = phase === 'requesting' || phase === 'closing' || phase === 'processing';
  const pct = Math.round(progress * 100);
  return (
    <div className="instrument">
      <GlassStage controller={ctrl} width={CAP.W} height={CAP.H} env={env} label="Aperture Capture">
        <div className="capture-panel" style={{ left: 404, top: 64, width: 212 }}>
          <p className="readout__eyebrow">Aperture capture</p>
          <p className="capture-phase" data-testid="capture-phase" data-phase={phase}>
            {phase === 'idle' ? 'Ready' : phase === 'requesting' ? 'Asking…' : phase === 'live' ? 'Live' : phase === 'closing' ? 'Shutter' : phase === 'processing' ? `Processing ${pct}%` : phase === 'result' ? 'Captured' : 'Unavailable'}
          </p>
          {phase === 'processing' && (
            <div role="progressbar" aria-label="Processing" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="sr-only" data-testid="capture-progress">
              {pct}%
            </div>
          )}
          <div className="capture-actions">
            {phase !== 'live' && phase !== 'result' && (
              <button type="button" className="chip" onClick={startCamera} disabled={busy} data-testid="capture-start">
                Start camera
              </button>
            )}
            {phase === 'live' && (
              <>
                <button type="button" className="chip chip--primary" onClick={capture} data-testid="capture-shoot">
                  Capture
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() => {
                    stopCamera();
                    setPhase('idle');
                    setMessage('Camera stopped.');
                  }}
                  data-testid="capture-stop"
                >
                  Stop
                </button>
              </>
            )}
            {phase === 'processing' && (
              <button type="button" className="chip" onClick={cancel}>
                Cancel
              </button>
            )}
            {phase === 'result' && output && (
              <>
                <a className="chip chip--primary" href={output.url} download="glass-capture.png" data-testid="capture-download">
                  Download PNG
                </a>
                <button type="button" className="chip" onClick={retake} data-testid="capture-retake">
                  Retake
                </button>
              </>
            )}
            {!busy && (
              <label className="chip file-button">
                Upload photo
                <input type="file" accept="image/*" onChange={onUpload} data-testid="capture-upload" />
              </label>
            )}
          </div>
          <div className="chip-row" role="radiogroup" aria-label="Filter">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" role="radio" className="chip" aria-checked={filter === f.id} disabled={busy} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <p className="study-status" role="status" data-testid="capture-status" data-tone={phase === 'error' ? 'error' : undefined}>
            {message || 'Your camera starts only when you press Start camera. Images never leave this device.'}
          </p>
        </div>
      </GlassStage>
      <div className="scrubber-decoders" aria-hidden="true">
        <video ref={videoRef} muted playsInline data-testid="capture-video" />
      </div>
    </div>
  );
}
