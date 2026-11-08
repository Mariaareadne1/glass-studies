import { useEffect, useRef, useState } from 'react';
import type { StudyDef } from '../../app/studies';
import type { Theme } from '../../app/theme';
import type { EnvironmentKind } from '../../glass/types';

const ENVS: { id: EnvironmentKind; label: string }[] = [
  { id: 'pearl', label: 'Pearl' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'atmosphere', label: 'Atmosphere' },
  { id: 'optics', label: 'Optics test' },
];

interface FocusViewProps {
  study: StudyDef;
  theme: Theme;
  onClose: () => void;
}

export function FocusView({ study, theme, onClose }: FocusViewProps) {
  const [env, setEnv] = useState<EnvironmentKind>(() => {
    const q = new URLSearchParams(window.location.search).get('env');
    return ENVS.some((e) => e.id === q) ? (q as EnvironmentKind) : theme === 'dark' ? 'midnight' : 'pearl';
  });
  const backRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    backRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="focus" role="dialog" aria-modal="true" aria-labelledby="focus-title" data-env={env}>
      <div className="focus__bar">
        <button ref={backRef} type="button" className="back" onClick={onClose}>
          <span aria-hidden="true">←</span> Collection
        </button>
        <h2 className="focus__title" id="focus-title">
          <span>{study.num}</span>
          {study.title}
        </h2>
        <div className="chip-row" role="radiogroup" aria-label="Backdrop">
          {ENVS.map((e) => (
            <button key={e.id} type="button" role="radio" className="chip" aria-checked={env === e.id} onClick={() => setEnv(e.id)}>
              {e.label}
            </button>
          ))}
        </div>
      </div>
      <div className="focus__stage">
        <div className="focus__frame">
          <study.Component env={env} />
        </div>
      </div>
      <div className="focus__foot">
        <p>{study.detail}</p>
        <button type="button" className="text-button" onClick={() => study.stores.forEach((s) => s.reset())}>
          Reset study
        </button>
      </div>
    </div>
  );
}
