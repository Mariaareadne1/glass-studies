import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { SolarToggle } from '../components/controls/SolarToggle/SolarToggle';
import { HaloDial } from '../components/controls/HaloDial/HaloDial';
import { AtmosphereSelector } from '../components/controls/AtmosphereSelector/AtmosphereSelector';
import { atmosphereStore, haloStore, solarStore } from '../state/controls';

class Observer {
  observe() {}
  disconnect() {}
  unobserve() {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', Observer);
  vi.stubGlobal('IntersectionObserver', Observer);
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  // jsdom has no canvas: the stage must degrade without throwing
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  solarStore.reset();
  haloStore.reset();
  atmosphereStore.reset();
});

const loop = () => (window as unknown as { __glassLoop: () => { registered: number; running: boolean } }).__glassLoop();

describe('control semantics without a GPU', () => {
  test('Solar exposes a switch that keyboard operates', () => {
    render(<SolarToggle env="pearl" />);
    const sw = screen.getByRole('switch', { name: 'Daylight' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    act(() => {
      fireEvent.keyDown(sw, { key: 'ArrowRight' });
    });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    act(() => {
      fireEvent.click(sw, { detail: 0 });
    });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/Rendering unavailable/)).toBeInTheDocument();
  });

  test('Halo slider reports value and clamps with Home/End', () => {
    render(<HaloDial env="pearl" />);
    const slider = screen.getByRole('slider', { name: 'Brightness' });
    expect(slider).toHaveAttribute('aria-valuenow', '72');
    act(() => {
      fireEvent.keyDown(slider, { key: 'End' });
      fireEvent.keyDown(slider, { key: 'ArrowRight' });
    });
    expect(slider).toHaveAttribute('aria-valuenow', '100');
    act(() => {
      fireEvent.keyDown(slider, { key: 'Home' });
    });
    expect(slider).toHaveAttribute('aria-valuetext', '0 percent');
  });

  test('Atmosphere radiogroup uses roving tabindex', () => {
    render(<AtmosphereSelector env="pearl" />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1, -1]);
    act(() => {
      fireEvent.keyDown(radios[0], { key: 'ArrowLeft' });
    });
    expect(screen.getByRole('radio', { name: 'Snow' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByRole('radio').map((r) => r.tabIndex)).toEqual([-1, -1, -1, 0]);
  });
});

describe('lifecycle', () => {
  test('unmounting stages releases their scheduler ticks and leaves no loop running', () => {
    const before = loop().registered;
    const { unmount } = render(
      <>
        <SolarToggle env="pearl" />
        <HaloDial env="midnight" />
      </>,
    );
    unmount();
    expect(loop().registered).toBe(before);
    expect(loop().running).toBe(false);
  });
});
