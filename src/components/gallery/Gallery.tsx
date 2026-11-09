import type { StudyDef } from '../../app/studies';
import type { EnvironmentKind } from '../../glass/types';

interface GalleryProps {
  studies: StudyDef[];
  env: EnvironmentKind;
  onOpen: (id: string) => void;
  /** Later collections sit in a denser grid under their own section heading. */
  variant?: 'studies' | 'compact';
}

export function Gallery({ studies, env, onOpen, variant = 'studies' }: GalleryProps) {
  return (
    <div className={variant === 'compact' ? 'gallery gallery--compact' : 'gallery'}>
      {studies.map((s) => (
        <article key={s.id} id={`study-${s.id}`} className="study" aria-labelledby={`study-${s.id}-title`}>
          <div className="plinth">
            <s.Component env={env} />
            <button type="button" className="plinth__expand" aria-label={`Open ${s.title} in focused view`} onClick={() => onOpen(s.id)}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M8 1h5v5M13 1 7.5 6.5M6 13H1V8M1 13l5.5-5.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div className="caption">
            <span className="caption__num">{s.num}</span>
            <h3 className="caption__title" id={`study-${s.id}-title`}>
              <button type="button" onClick={() => onOpen(s.id)}>{s.title}</button>
            </h3>
            <p className="caption__desc">{s.description}</p>
            <p className="caption__hint">{s.hint}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
