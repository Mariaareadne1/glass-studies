import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { GlassStage } from '../../../glass/GlassStage';
import type { EnvironmentKind } from '../../../glass/types';
import { usePointerDrag } from '../../../motion/usePointerDrag';
import { DAYS, forecastDayStore, forecastDetailStore } from '../../../state/controls';
import type { Day } from '../../../state/controls';
import { FORECAST, SAMPLE_LOCATION } from '../../../state/forecastData';
import { useStore } from '../../../state/persistence';
import { useReducedMotion } from '../../../state/reducedMotion';
import { RadioSlots } from '../shared/RadioSlots';
import { FC, FC_DAY_Y_BASE, FC_TOGGLE_X, FC_TOGGLE_Y, ForecastController } from './forecastController';

const DAY_LABELS = Object.fromEntries(DAYS.map((d) => [d, FORECAST[d].label])) as Record<Day, string>;

export function ForecastCard({ env }: { env: EnvironmentKind }) {
  const day = useStore(forecastDayStore);
  const detailed = useStore(forecastDetailStore);
  const [ctrl] = useState(() => new ForecastController(forecastDayStore.get(), forecastDetailStore.get()));
  const overlayRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const reducedMotion = useReducedMotion();
  const press = useRef(false);

  useEffect(() => ctrl.setReducedMotion(reducedMotion), [ctrl, reducedMotion]);
  useEffect(() => ctrl.selectDay(day), [ctrl, day]);
  useEffect(() => ctrl.setDetailed(detailed), [ctrl, detailed]);
  useEffect(() => {
    ctrl.bindOverlay(overlayRef.current);
    return () => ctrl.bindOverlay(null);
  }, [ctrl]);

  // the quick toggle has its own press handling; it never competes with the day selector
  usePointerDrag(overlayRef, scaleRef, {
    onStart(p) {
      if (!ctrl.hitToggle(p.x, p.y)) return false;
      press.current = true;
      return true;
    },
    onMove() {},
    onEnd(p, cancelled) {
      if (press.current && !cancelled && ctrl.hitToggle(p.x, p.y)) forecastDetailStore.set(!forecastDetailStore.get());
      press.current = false;
    },
  });

  const onToggleKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') forecastDetailStore.set(false);
    else if (e.key === 'ArrowRight') forecastDetailStore.set(true);
    else return;
    e.preventDefault();
  };
  const onToggleClick = (e: MouseEvent) => {
    if (e.detail === 0) forecastDetailStore.set(!forecastDetailStore.get());
  };

  const f = FORECAST[day];
  const left = FC.cx - FC.hw + 30;
  return (
    <GlassStage controller={ctrl} width={FC.W} height={FC.H} env={env} label="Forecast weather card" scaleRef={scaleRef} overlayRef={overlayRef}>
      <div className="fc on-glass" data-detailed={detailed} data-testid="forecast" data-day={day}>
        <p className="fc__place" style={{ left, top: FC.top + 24 }}>
          {SAMPLE_LOCATION}
          <span>Sample forecast · not live</span>
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={detailed}
          aria-label="Detailed view"
          className="hit"
          data-testid="forecast-detail"
          style={{ left: FC_TOGGLE_X - FC.toggleHW - 6, top: FC_TOGGLE_Y - FC.toggleHH - 6, width: FC.toggleHW * 2 + 12, height: FC.toggleHH * 2 + 12, borderRadius: 30 }}
          onKeyDown={onToggleKey}
          onClick={onToggleClick}
        />
        <div className="fc__now" style={{ left: left + 112, top: FC.top + 64 }} aria-live="polite">
          <span className="fc__temp" data-testid="forecast-temp">
            {f.temp}
            <small>°</small>
          </span>
          <span className="fc__cond">
            {f.label} · {f.condition}
          </span>
        </div>
        <dl className="fc__details" style={{ left, top: FC.top + 178, width: FC.hw * 2 - 60 }} aria-hidden={!detailed} data-testid="forecast-details">
          <div>
            <dt>High / Low</dt>
            <dd>
              {f.high}° / {f.low}°
            </dd>
          </div>
          <div>
            <dt>Humidity</dt>
            <dd>{f.humidity}%</dd>
          </div>
          <div>
            <dt>Wind</dt>
            <dd>{f.windKmh} km/h</dd>
          </div>
        </dl>
        <div className="fc__days">
          <RadioSlots
            options={DAYS}
            labels={DAY_LABELS}
            value={day}
            onChange={(d) => forecastDayStore.set(d)}
            core={ctrl.core}
            slotHW={FC.spacing / 2 - 3}
            slotHH={FC.dayHH - 2}
            name="Forecast day"
            testid="forecast-days"
            overlayRef={overlayRef}
            scaleRef={scaleRef}
            invalidate={() => ctrl.wake()}
            yBase={FC_DAY_Y_BASE}
            renderSlot={(d, _i, checked) => <span className={`fc__day ${checked ? 'is-active' : ''}`}>{DAY_LABELS[d]}</span>}
          />
        </div>
      </div>
    </GlassStage>
  );
}
