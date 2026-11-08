import { useRef } from 'react';
import type { KeyboardEvent, ReactNode, RefObject } from 'react';
import { usePointerDrag } from '../../../motion/usePointerDrag';
import type { SelectorCore } from './selectorCore';

interface RadioSlotsProps<T extends string> {
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
  core: SelectorCore;
  slotHW: number;
  slotHH: number;
  name: string;
  testid: string;
  overlayRef: RefObject<HTMLDivElement | null>;
  scaleRef: RefObject<number>;
  /** Called whenever the core needs a redraw. */
  invalidate: () => void;
  renderSlot?: (o: T, i: number, checked: boolean) => ReactNode;
  /** Fixed layout y for the buttons when a parent moves the group with a transform. */
  yBase?: number;
}

const TAP_SLOP = 6;

/**
 * Semantic layer for a sliding-tile selector: a radiogroup with roving
 * tabindex and arrow-key navigation, plus pointer handling – drag the glass
 * tile between slots, or tap any slot.
 */
export function RadioSlots<T extends string>(props: RadioSlotsProps<T>) {
  const { options, labels, value, onChange, core, slotHW, slotHH, name, testid, overlayRef, scaleRef, invalidate, renderSlot } = props;
  const press = useRef<{ x: number; mode: 'tile' | 'slot'; moved: boolean } | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const slots = core.geo.slots;
  const y = props.yBase ?? core.geo.y;

  const slotAt = (x: number, yy: number): number => {
    // read y live: a parent (the Forecast card) may move the selector while it animates
    if (Math.abs(yy - core.geo.y) > slotHH + 4) return -1;
    return slots.findIndex((sx) => Math.abs(x - sx) <= slotHW + 4);
  };

  usePointerDrag(overlayRef, scaleRef, {
    onStart(p) {
      if (core.hitTile(p.x, p.y)) {
        press.current = { x: p.x, mode: 'tile', moved: false };
        core.beginDrag(p.x);
        invalidate();
        return true;
      }
      if (slotAt(p.x, p.y) >= 0) {
        press.current = { x: p.x, mode: 'slot', moved: false };
        return true;
      }
      return false;
    },
    onMove(p) {
      const pr = press.current;
      if (!pr) return;
      if (Math.abs(p.x - pr.x) > TAP_SLOP) pr.moved = true;
      if (pr.mode === 'slot' && pr.moved) {
        // pressing the track and sliding grabs the tile under the finger
        pr.mode = 'tile';
        core.beginDrag(core.pos.x);
      }
      if (pr.mode === 'tile' && pr.moved) {
        core.drag(p.x, p.vx);
        invalidate();
      }
    },
    onEnd(p, cancelled) {
      const pr = press.current;
      press.current = null;
      if (!pr) return;
      if (pr.mode === 'tile') {
        const i = pr.moved && !cancelled ? core.endDrag(p.vx) : (core.endDrag(0), core.index);
        const tapped = !pr.moved && !cancelled ? slotAt(p.x, p.y) : -1;
        onChange(options[tapped >= 0 ? tapped : i]);
        invalidate();
        return;
      }
      const i = slotAt(p.x, p.y);
      if (!cancelled && !pr.moved && i >= 0) onChange(options[i]);
    },
  });

  const onKey = (e: KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + options.length) % options.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next]);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={name} data-testid={testid} data-value={value}>
      {options.map((o, i) => {
        const checked = o === value;
        return (
          <button
            key={o}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={labels[o]}
            tabIndex={checked ? 0 : -1}
            className="hit hit--slot"
            data-option={o}
            style={{ left: slots[i] - slotHW, top: y - slotHH, width: slotHW * 2, height: slotHH * 2 }}
            onKeyDown={(e) => onKey(e, i)}
            onClick={(e) => {
              if (e.detail === 0) onChange(o);
            }}
          >
            {renderSlot?.(o, i, checked)}
          </button>
        );
      })}
    </div>
  );
}
