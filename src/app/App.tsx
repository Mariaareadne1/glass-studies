import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { resetAll } from '../state/controls';
import { Gallery } from '../components/gallery/Gallery';
import { FocusView } from '../components/gallery/FocusView';
import { LOADERS } from './loaders';
import { STUDIES } from './studies';

const ALL = [...STUDIES, ...LOADERS];
import { useTheme } from './theme';

const Inspector = lazy(() => import('../components/gallery/Inspector'));
const showInspector = import.meta.env.DEV || new URLSearchParams(window.location.search).has('inspect');

function readHash(): string | null {
  const m = window.location.hash.match(/^#\/study\/([a-z-]+)$/);
  return m && ALL.some((s) => s.id === m[1]) ? m[1] : null;
}

export function App() {
  const [theme, setTheme] = useTheme();
  const [focused, setFocused] = useState<string | null>(readHash);

  useEffect(() => {
    const onHash = () => setFocused(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const open = useCallback((id: string) => {
    window.location.hash = `/study/${id}`;
  }, []);
  const close = useCallback(() => {
    const id = focused;
    history.pushState('', document.title, window.location.pathname + window.location.search);
    setFocused(null);
    if (id) requestAnimationFrame(() => document.getElementById(`study-${id}`)?.querySelector<HTMLElement>('.caption__title button')?.focus());
  }, [focused]);

  const study = ALL.find((s) => s.id === focused) ?? null;

  return (
    <>
      <div className="page" aria-hidden={study ? true : undefined} inert={study ? true : undefined}>
        <header className="masthead">
          <div>
            <p className="masthead__eyebrow">Interactive exhibition · Ten instruments · Four loaders</p>
            <h1>Glass Studies</h1>
            <p className="masthead__lede">An exploration of light, material, and interaction. Small refracting instruments, each with its own way of moving.</p>
          </div>
          <div className="masthead__aside">
            <nav aria-label="Study index">
              <ol className="index">
                {STUDIES.map((s) => (
                  <li key={s.id}>
                    <a href={`#study-${s.id}`} onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(`study-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}>{s.num}</a>
                  </li>
                ))}
                <li>
                  <a href="#loaders" onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('loaders')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}>Loaders</a>
                </li>
              </ol>
            </nav>
            <div className="chip-row" role="radiogroup" aria-label="Viewing environment">
              <button type="button" role="radio" className="chip" aria-checked={theme === 'light'} onClick={() => setTheme('light')}>Light</button>
              <button type="button" role="radio" className="chip" aria-checked={theme === 'dark'} onClick={() => setTheme('dark')}>Dark</button>
            </div>
          </div>
        </header>
        <main>
          <Gallery studies={STUDIES} env={theme === 'dark' ? 'midnight' : 'pearl'} onOpen={open} />
          <section id="loaders" className="loaders" aria-labelledby="loaders-title">
            <header className="section-head">
              <p className="masthead__eyebrow">Glass loaders · Looping</p>
              <h2 id="loaders-title">Glass Loaders</h2>
              <p className="section-head__lede">Four small waiting pieces made from the same glass, springs and pixels. They loop seamlessly, rest when off screen and calm down when you prefer reduced motion.</p>
            </header>
            <Gallery studies={LOADERS} env={theme === 'dark' ? 'midnight' : 'pearl'} onOpen={open} variant="loaders" />
          </section>
        </main>
        <footer className="colophon">
          <span>Glass Studies — refraction rendered in WebGL2; all instruments are live.</span>
          <button type="button" className="text-button" onClick={resetAll}>Reset all studies</button>
        </footer>
      </div>
      {study && <FocusView study={study} theme={theme} onClose={close} />}
      {showInspector && (
        <Suspense fallback={null}>
          <Inspector />
        </Suspense>
      )}
    </>
  );
}
