import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { GlassStage } from '../../../glass/GlassStage';
import type { EnvironmentKind } from '../../../glass/types';
import { TAB_NAMES, tabsStore } from '../../../state/controls';
import { useStore } from '../../../state/persistence';
import { useReducedMotion } from '../../../state/reducedMotion';
import { TABS, TabsController } from './tabsController';

/** Real panel content: a short guide to this very collection. */
const PANELS: Record<(typeof TAB_NAMES)[number], { lead: string; body: string }> = {
  Overview: {
    lead: 'Small instruments in pearl glass.',
    body: 'Every study renders its glass with the same WebGL2 optical pass: a rounded slab that refracts, frosts and reflects the scene beneath it. Controls set values you can read back; loaders follow real state.',
  },
  Motion: {
    lead: 'Springs, not timelines.',
    body: 'Motion is a damped spring integrated in fixed sub-steps. Retargeting keeps position and velocity, so an interrupted move flows on instead of restarting. Reduced motion swaps in critically damped springs.',
  },
  Optics: {
    lead: 'One surface, one set of normals.',
    body: 'This selector is three shapes fused by a smooth minimum of their distance fields. Refraction, highlights and shadow follow the fused field, so the neck between tabs bends light like the tiles do.',
  },
  Source: {
    lead: 'Built from first principles.',
    body: 'React, TypeScript and Vite with a hand-written renderer: no glass library, no copied assets. The inspiration repositories were read for ideas only; see docs/CASE_STUDY.md for licensing notes.',
  },
};

export function LiquidTabs({ env }: { env: EnvironmentKind }) {
  const selected = useStore(tabsStore);
  const [ctrl] = useState(() => new TabsController());
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [id] = useState(() => `tabs-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => ctrl.setReducedMotion(reducedMotion), [ctrl, reducedMotion]);

  // the membrane is derived from the real tab boxes (design units: the overlay is unscaled)
  const rectOf = (i: number) => {
    const el = tabRefs.current[i];
    if (!el) return null;
    const left = (listRef.current?.offsetLeft ?? 0) + el.offsetLeft;
    return { x: left + el.offsetWidth / 2, w: el.offsetWidth };
  };
  useLayoutEffect(() => {
    const r = rectOf(selected);
    if (r) ctrl.select(r);
  }, [ctrl, selected]);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const remeasure = () => {
      const r = rectOf(tabsStore.get());
      if (r) ctrl.remeasure(r);
    };
    const ro = new ResizeObserver(remeasure);
    ro.observe(list);
    document.fonts?.ready.then(remeasure).catch(() => undefined);
    return () => ro.disconnect();
  }, [ctrl]);

  const onKey = (e: KeyboardEvent) => {
    const n = TAB_NAMES.length;
    const cur = tabsStore.get();
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (cur + 1) % n;
    else if (e.key === 'ArrowLeft') next = (cur - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next === null) return;
    e.preventDefault();
    // automatic activation: focus and selection move together
    tabsStore.set(next);
    tabRefs.current[next]?.focus();
  };

  const name = TAB_NAMES[selected];
  const panel = PANELS[name];
  return (
    <GlassStage controller={ctrl} width={TABS.W} height={TABS.H} env={env} label="Liquid Tabs selector">
      <div
        ref={listRef}
        role="tablist"
        aria-label="Glass Studies guide"
        className="liquid-tabs"
        style={{ left: TABS.trayX - TABS.trayHW + 12, top: TABS.trayY - TABS.lobeHH, width: (TABS.trayHW - 12) * 2, height: TABS.lobeHH * 2 }}
        onKeyDown={onKey}
      >
        {TAB_NAMES.map((t, i) => (
          <button
            key={t}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${i}`}
            aria-selected={i === selected}
            aria-controls={`${id}-panel`}
            tabIndex={i === selected ? 0 : -1}
            className="liquid-tabs__tab on-glass"
            data-testid={`tab-${t.toLowerCase()}`}
            onClick={() => tabsStore.set(i)}
          >
            {t}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${selected}`} tabIndex={0} className="liquid-tabs__panel" data-testid="tab-panel" data-tab={name}>
        <p className="liquid-tabs__lead">{panel.lead}</p>
        <p className="liquid-tabs__body">{panel.body}</p>
      </div>
    </GlassStage>
  );
}
