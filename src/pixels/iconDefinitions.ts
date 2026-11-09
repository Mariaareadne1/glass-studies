import type { RGB } from '../glass/types';

/**
 * Original 12×12 pixel artwork for every study. Each icon is a grid of
 * palette keys; '.' is empty. Grids are the single source of truth – the
 * morph renderer turns them into coordinate sets.
 */

export interface Pixel {
  x: number;
  y: number;
  color: RGB;
}

export interface IconDef {
  name: string;
  grid: readonly string[];
  palette: Readonly<Record<string, string>>;
}

export const GRID = 12;

function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const SUN_PAL = { h: '#fff3c4', c: '#ffc23d', o: '#ff9f2a', r: '#ff8a3d' };
const CLOUD_PAL = { h: '#f3f6fc', c: '#cdd6ea', s: '#8e9cbd' };

export const ICONS = {
  moon: {
    name: 'moon',
    palette: { h: '#c3b8ff', c: '#8c7cf6', s: '#5b4cd8', w: '#9fb4ff' },
    grid: [
      '..........w.',
      '....hcs.....',
      '...hcs......',
      '..hcs....w..',
      '.hccs.......',
      '.hcc........',
      '.hcc.....w..',
      '.hccs.......',
      '.hcccs......',
      '..hcccss....',
      '...hccccs...',
      '.....ss.....',
    ],
  },
  sun: {
    name: 'sun',
    palette: SUN_PAL,
    grid: [
      '.....rr.....',
      '.....rr.....',
      '..r......r..',
      '...r.oo.r...',
      '....occo....',
      'rr.occhco.rr',
      'rr.occcco.rr',
      '....occo....',
      '...r.oo.r...',
      '..r......r..',
      '.....rr.....',
      '.....rr.....',
    ],
  },
  rain: {
    name: 'rain',
    palette: { ...CLOUD_PAL, b: '#4f8dff', d: '#86b4ff' },
    grid: [
      '............',
      '.....hhh....',
      '...hhcccc...',
      '..hccccccc..',
      '.hccccccccc.',
      '.ccccccccccs',
      '..sssssssss.',
      '............',
      '..b...d...b.',
      '.b...b...d..',
      '...d...b....',
      '..b...b.....',
    ],
  },
  wind: {
    name: 'wind',
    palette: { w: '#5fcdb8', k: '#8fe0cf', a: '#3fb3a0' },
    grid: [
      '............',
      '.......ww...',
      '......w..w..',
      '.........w..',
      'wwwwwwwww...',
      '............',
      'kkkkkkkkkkk.',
      '............',
      'aaaaaaa.....',
      '.......a....',
      '....a..a....',
      '.....aa.....',
    ],
  },
  snow: {
    name: 'snow',
    palette: { h: '#9db8ff', c: '#6f8ff0', w: '#c9d8ff' },
    grid: [
      '............',
      '......h.....',
      '....h.h.h...',
      '.....hch....',
      '..h...c...h.',
      '...h..c..h..',
      '.hhcccwccchh',
      '...h..c..h..',
      '..h...c...h.',
      '.....hch....',
      '....h.h.h...',
      '......h.....',
    ],
  },
  partly: {
    name: 'partly',
    palette: { ...SUN_PAL, ...CLOUD_PAL, h: '#ffffff' },
    grid: [
      '............',
      '............',
      '.r..r.......',
      '..oo........',
      '.occo.r.....',
      '.occhhh.....',
      '..ohcccch...',
      '..hccccccc..',
      '.hcccccccch.',
      '.cccccccccc.',
      '..ssssssss..',
      '............',
    ],
  },
  cloud: {
    name: 'cloud',
    palette: CLOUD_PAL,
    grid: [
      '............',
      '............',
      '............',
      '.....hhh....',
      '....hcccc...',
      '..hhcccccc..',
      '.hcccccccch.',
      '.ccccccccccc',
      '.ccccccccccc',
      '..sssssssss.',
      '............',
      '............',
    ],
  },
  leaf: {
    name: 'leaf',
    palette: { g: '#5dbf6e', h: '#a6e6a0', d: '#2f8a4c' },
    grid: [
      '............',
      '.........gg.',
      '.......gggg.',
      '.....ghggdg.',
      '....ghggdgg.',
      '...ghggdggg.',
      '...gggdggg..',
      '..ggdggggg..',
      '..gdgggg....',
      '..dggg......',
      '.d..........',
      'd...........',
    ],
  },
  bolt: {
    name: 'bolt',
    palette: { y: '#ffc928', h: '#fff2b8' },
    grid: [
      '.......yyy..',
      '......yyy...',
      '.....yhy....',
      '....yhy.....',
      '...yhyyyyy..',
      '..yhhhhhy...',
      '..yyyyhy....',
      '.....yhy....',
      '....yhy.....',
      '....yy......',
      '...yy.......',
      '...y........',
    ],
  },
  rest: {
    name: 'rest',
    palette: { h: '#c3b8ff', c: '#8c7cf6', s: '#5b4cd8', w: '#a9bcff' },
    grid: [
      '.......w....',
      '....hcs....w',
      '...hcs......',
      '..hcs...w...',
      '.hccs.......',
      '.hcc......w.',
      '.hcc..w.....',
      '.hccs.......',
      '.hcccs...w..',
      '..hcccss....',
      '...hccccs...',
      '.....ss.....',
    ],
  },
  bud: {
    name: 'bud',
    palette: { p: '#ff8fbd', q: '#e8649a', g: '#5dbf6e' },
    grid: [
      '............',
      '............',
      '............',
      '.....pp.....',
      '....pqqp....',
      '....pqqp....',
      '.....pp.....',
      '......g.....',
      '....g.g.....',
      '.....gg.....',
      '......g.....',
      '......g.....',
    ],
  },
  bloom: {
    name: 'bloom',
    palette: { p: '#ff8fbd', q: '#e8649a', c: '#ffb43d', y: '#ffe7a3', g: '#5dbf6e' },
    grid: [
      '............',
      '.....pp.....',
      '..pp.pp.pp..',
      '..pqppppqp..',
      '...ppccpp...',
      '.pppcyycppp.',
      '.pppcyycppp.',
      '...ppccpp...',
      '..pqppppqp..',
      '..pp.gg.pp..',
      '......g.....',
      '.....gg.....',
    ],
  },
  // ---- V3 additions: Droplet Press and the Glass Loaders
  drop: {
    name: 'drop',
    palette: { h: '#e6f3ff', c: '#8cc4ff', s: '#5a8fe0' },
    grid: [
      '.....hh.....',
      '.....cc.....',
      '....hccs....',
      '....cccs....',
      '...hcccss...',
      '...ccccss...',
      '..hcccccss..',
      '..ccccccss..',
      '..ccccccss..',
      '...cccsss...',
      '....ssss....',
      '............',
    ],
  },
  check: {
    name: 'check',
    palette: { c: '#7fdc9a' },
    grid: [
      '............',
      '............',
      '..........c.',
      '.........cc.',
      '........cc..',
      '.c.....cc...',
      '.cc...cc....',
      '..cc.cc.....',
      '...ccc......',
      '....c.......',
      '............',
      '............',
    ],
  },
  hourglass: {
    name: 'hourglass',
    palette: { c: '#c9c6e6', s: '#ffc23d' },
    grid: [
      '..cccccccc..',
      '...c....c...',
      '...c.ss.c...',
      '....cssc....',
      '.....cc.....',
      '.....cc.....',
      '....c..c....',
      '...c....c...',
      '...c.ss.c...',
      '...cssssc...',
      '..cccccccc..',
      '............',
    ],
  },
  dots: {
    name: 'dots',
    palette: { c: '#c9c6e6' },
    grid: [
      '............',
      '............',
      '............',
      '............',
      '............',
      '.cc..cc..cc.',
      '.cc..cc..cc.',
      '............',
      '............',
      '............',
      '............',
      '............',
    ],
  },
  diamond: {
    name: 'diamond',
    palette: { c: '#c9c6e6' },
    grid: [
      '.....cc.....',
      '....c..c....',
      '...c....c...',
      '..c......c..',
      '.c........c.',
      'c..........c',
      'c..........c',
      '.c........c.',
      '..c......c..',
      '...c....c...',
      '....c..c....',
      '.....cc.....',
    ],
  },
} as const satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;

const cache = new Map<string, Pixel[]>();

export function iconPixels(name: IconName): Pixel[] {
  const hit = cache.get(name);
  if (hit) return hit;
  const def: IconDef = ICONS[name];
  const out: Pixel[] = [];
  def.grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const k = row[x];
      if (k === '.') continue;
      const c = def.palette[k];
      if (!c) throw new Error(`icon ${name}: unknown palette key '${k}'`);
      out.push({ x, y, color: hex(c) });
    }
  });
  cache.set(name, out);
  return out;
}

/** Halo's sun: a fixed core plus rays that grow with brightness (0..1). */
export function haloSun(level: number): Pixel[] {
  const core = iconPixels('sun').filter((p) => Math.hypot(p.x - 5.5, p.y - 5.5) < 3.2);
  const rays: Pixel[] = [];
  // 8 directions × 2 segments, revealed in a fixed clockwise order
  const dirs = [
    [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1],
  ];
  const segs: Pixel[][] = [];
  const ray = hex('#ff9a3a');
  const tip = hex('#ffc95e');
  for (let seg = 0; seg < 2; seg++) {
    for (const [dx, dy] of dirs) {
      const r0 = 3.9 + seg * 1.25;
      const cx = 5.5 + dx * r0 * (dx && dy ? 0.82 : 1);
      const cy = 5.5 + dy * r0 * (dx && dy ? 0.82 : 1);
      segs.push([{ x: Math.round(cx - 0.5), y: Math.round(cy - 0.5), color: seg ? tip : ray }]);
    }
  }
  const count = Math.round(Math.max(0, Math.min(1, level)) * segs.length);
  for (let i = 0; i < count; i++) rays.push(...segs[i]);
  return [...core, ...rays];
}

/**
 * V2 LED variant: cloud bodies become outlines (the reference draws clouds as
 * dotted contours), everything else keeps its silhouette.
 */
const CLOUD_BODY = hex(CLOUD_PAL.c);
/** Body colours hollowed out per icon in the LED variant (line-art look). */
const HOLLOW: Partial<Record<IconName, RGB[]>> = {
  rain: [CLOUD_BODY],
  partly: [CLOUD_BODY],
  leaf: [hex('#5dbf6e'), hex('#a6e6a0')],
  bloom: [hex('#ff8fbd')],
  drop: [hex('#8cc4ff')],
};
const ledCache = new Map<string, Pixel[]>();
const same = (a: RGB, b: RGB) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 0.01;

export function ledPixels(name: IconName): Pixel[] {
  const hit = ledCache.get(name);
  if (hit) return hit;
  const px = iconPixels(name);
  const filled = new Set(px.map((p) => `${p.x},${p.y}`));
  const hollow = HOLLOW[name] ?? [];
  const out = px.filter((p) => {
    if (!hollow.some((c) => same(p.color, c))) return true;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => filled.has(`${p.x + dx},${p.y + dy}`));
    return !n;
  });
  ledCache.set(name, out);
  return out;
}
