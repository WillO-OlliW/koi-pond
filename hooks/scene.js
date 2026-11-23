// The Koi Pond backdrop: looking down into a pond as ASCII koi circle through it.
// Each koi is a shape rasterized into characters: denser glyphs where the body is
// thicker, so it reads as rounded, and each cell colored by its variety's pattern.
// Dark mode is a deep indigo pond at night; light mode is a sunlit jade pond.
// Everything is plain SVG text and shapes animated with CSS, so it stays pure vector.

const W = 1600
const H = 1000
const FONT = 12
const CW = 7.2 // one character's advance at font-size 12, pinned with textLength
const CH = 12 // line height

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const n = v => Math.round(v * 100) / 100


// ---------------------------------------------------------------------------
// The koi shape, seen from above, in body lengths: x runs 0 (tail tip) to 1 (nose).

const bodyW = x => {
  if (x < 0.2 || x > 1) return 0
  const t = (x - 0.2) / 0.8
  const f = Math.pow(t, 0.9) * Math.pow(1 - t, 0.55)
  return 0.15 * (0.13 + 0.87 * (f / 0.462))
}

const inEllipse = (x, y, cx, cy, dx, dy, a, b) => {
  const px = x - cx
  const py = y - cy
  return ((px * dx + py * dy) / a) ** 2 + ((-px * dy + py * dx) / b) ** 2 <= 1
}

const fin = (x, y, ax, side, dirx, diry, a, b) => {
  const ay = side * bodyW(ax) * 0.8
  const len = Math.hypot(dirx, diry)
  const dx = dirx / len
  const dy = (side * diry) / len
  return inEllipse(x, y, ax + dx * a * 0.85, ay + dy * a * 0.85, dx, dy, a, b)
}

const RAMP = '.:-=+*#%@'

// A grid of { ch, cls } cells, rows from -half to +half around the spine.
const rasterKoi = (cols, pattern) => {
  const L = cols * CW
  const half = Math.ceil((0.25 * L) / CH)
  const grid = []
  for (let r = -half; r <= half; r++) {
    const row = []
    for (let c = 0; c < cols; c++) {
      const x = ((c + 0.5) * CW) / L
      const y = (r * CH) / L
      let cell = null
      const w = bodyW(x)
      if (w > 0 && Math.abs(y) <= w) {
        const lum = Math.sqrt(1 - (y / w) ** 2) * Math.min(1, (1 - x) * 14 + 0.25)
        cell = { ch: RAMP[Math.min(8, Math.floor(lum * 9))], cls: pattern(x, y, 'body') }
      } else if (x < 0.27) {
        const s = (0.27 - x) / 0.27
        const hw = 0.022 + 0.135 * Math.pow(s, 1.05)
        const notch = 0.075 * (1 - (y / hw) ** 2)
        if (Math.abs(y) <= hw && x >= notch) {
          const ray = Math.cos(Math.atan2(y, 0.27 - x) * 15)
          if (ray > 0.35) cell = { ch: '-', cls: pattern(x, y, 'fin') }
        }
      }
      if (!cell) {
        for (const side of [-1, 1]) {
          if (fin(x, y, 0.68, side, -0.8, 0.6, 0.085, 0.048) || fin(x, y, 0.4, side, -0.85, 0.5, 0.05, 0.028)) {
            const ray = Math.cos(Math.atan2(y, x - 0.72) * 22)
            if (ray > 0.2) cell = { ch: ':', cls: pattern(x, y, 'fin') }
          }
        }
      }
      row.push(cell)
    }
    grid.push(row)
  }
  for (const side of [-1, 1]) {
    const x = 0.905
    const r = Math.round((side * bodyW(x) * 0.72 * L) / CH) + half
    const c = Math.round((x * L) / CW - 0.5)
    if (grid[r]?.[c]) grid[r][c] = { ch: 'o', cls: 'e' }
  }
  return { grid, half, L }
}

// ---------------------------------------------------------------------------
// Varieties: which color each cell of the body and fins takes.
// w white, r hi (red-orange), k sumi (black), g gold, o orange, b asagi blue,
// p platinum, e eye; f* are the same colors on the see-through fins.

const blob = (x, y, cx, cy, rx, ry, s = 0) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + 0.22 * Math.sin(41 * x + 17 * y + s) + 0.14 * Math.sin(29 * y - 23 * x + 2 * s) <= 1

const VARIETIES = {
  kohaku: (x, y, part) =>
    part === 'fin' ? 'fw' : blob(x, y, 0.84, 0, 0.09, 0.07, 1) || blob(x, y, 0.6, 0.01, 0.11, 0.09, 2) || blob(x, y, 0.36, -0.01, 0.07, 0.06, 3) ? 'r' : 'w',
  kohaku2: (x, y, part) =>
    part === 'fin' ? 'fw' : blob(x, y, 0.8, 0.02, 0.1, 0.08, 21) || blob(x, y, 0.48, -0.02, 0.13, 0.09, 22) ? 'r' : 'w',
  sanke: (x, y, part) =>
    part === 'fin'
      ? x < 0.3 ? 'fw' : 'fk'
      : blob(x, y, 0.55, 0.03, 0.03, 0.025, 4) || blob(x, y, 0.33, -0.03, 0.025, 0.02, 5) || blob(x, y, 0.72, -0.05, 0.022, 0.02, 6)
        ? 'k'
        : blob(x, y, 0.82, 0.01, 0.08, 0.07, 7) || blob(x, y, 0.5, -0.02, 0.1, 0.08, 8)
          ? 'r'
          : 'w',
  showa: (x, y, part) =>
    part === 'fin'
      ? x > 0.55 ? 'fk' : 'fw'
      : blob(x, y, 0.8, 0.02, 0.08, 0.07, 9) || blob(x, y, 0.45, 0.02, 0.09, 0.07, 10)
        ? 'r'
        : blob(x, y, 0.62, -0.02, 0.06, 0.05, 11) || blob(x, y, 0.3, 0, 0.05, 0.04, 12)
          ? 'w'
          : 'k',
  tancho: (x, y, part) => (part === 'fin' ? 'fw' : ((x - 0.85) / 0.055) ** 2 + (y / 0.05) ** 2 <= 1 ? 'r' : 'w'),
  yamabuki: (_x, _y, part) => (part === 'fin' ? 'fg' : 'g'),
  orenji: (_x, _y, part) => (part === 'fin' ? 'fo' : 'o'),
  asagi: (x, y, part) => (part === 'fin' ? 'fo' : Math.abs(y) > bodyW(x) * 0.72 || x > 0.9 ? 'o' : 'b'),
  hariwake: (x, y, part) => (part === 'fin' ? 'fg' : blob(x, y, 0.7, 0, 0.13, 0.08, 13) || blob(x, y, 0.38, 0, 0.08, 0.06, 14) ? 'o' : 'p'),
}

// ---------------------------------------------------------------------------
// One koi as SVG: front, body and tail in nested groups so the body can flex.

const runs = (cells, from, to) => {
  let first = -1
  let last = -1
  for (let c = from; c < to; c++) {
    if (cells[c]) {
      if (first < 0) first = c
      last = c
    }
  }
  if (first < 0) return null
  let out = ''
  let cls = null
  let buf = ''
  const flush = () => {
    if (buf) out += `<tspan class="${cls}">${esc(buf)}</tspan>`
    buf = ''
  }
  for (let c = first; c <= last; c++) {
    const cell = cells[c]
    if (cell && cell.cls !== cls) {
      flush()
      cls = cell.cls
    }
    buf += cell ? cell.ch : ' '
  }
  flush()
  return { first, len: last - first + 1, out }
}

const TINT = { kohaku: 'w', sanke: 'w', tancho: 'w', yamabuki: 'g', orenji: 'o', asagi: 'b', kohaku2: 'w', showa: 'k', hariwake: 'p' }

const silhouette = (fromX, toX, L, cx, tint) => {
  const a = Math.max(fromX, 0.2)
  const b = Math.min(toX, 1)
  if (b <= a) return ''
  const steps = 10
  const top = []
  const bottom = []
  for (let i = 0; i <= steps; i++) {
    const x = a + ((b - a) * i) / steps
    const w = bodyW(x) * 0.9 * L
    top.push(`${n(x * L - cx)} ${n(-w)}`)
    bottom.unshift(`${n(x * L - cx)} ${n(w)}`)
  }
  return `<path class="sil ${tint}" d="M${top.join('L')}L${bottom.join('L')}Z"/>`
}

const koiSvg = (cols, variety) => {
  const { grid, half, L } = rasterKoi(cols, VARIETIES[variety])
  const cx = 0.55 * L
  const segment = (fromX, toX) => {
    const from = Math.max(0, Math.ceil((fromX * L) / CW - 0.5))
    const to = Math.min(cols, Math.ceil((toX * L) / CW - 0.5))
    return grid
      .map((cells, i) => {
        const run = runs(cells, from, to)
        if (!run) return ''
        const y = (i - half) * CH + CH * 0.35
        return `<text x="${n(run.first * CW - cx)}" y="${n(y)}" textLength="${n(run.len * CW)}" lengthAdjust="spacing">${run.out}</text>`
      })
      .join('')
  }
  const tint = TINT[variety] ?? 'w'
  const sil = (a, b) => silhouette(a, b, L, cx, tint)
  const p1 = n(0.5 * L - cx)
  const p2 = n(0.27 * L - cx)
  return {
    L,
    svg:
      sil(0.494, 1) +
      segment(0.5, 1.01) +
      `<g transform="translate(${p1} 0)"><g class="flex1"><g transform="translate(${-p1} 0)">` +
      sil(0.264, 0.506) +
      segment(0.27, 0.5) +
      `<g transform="translate(${p2} 0)"><g class="flex2"><g transform="translate(${-p2} 0)">` +
      sil(0.2, 0.276) +
      segment(0, 0.27) +
      `</g></g></g></g></g></g>`,
  }
}

// ---------------------------------------------------------------------------
// Swim paths: gentle closed loops, smoothed into curves.

const loop = ({ cx, cy, rx, ry, wob = 0, ph = 0, dir = 1, start = 0 }) => {
  const N = 16
  const pts = Array.from({ length: N }, (_, i) => {
    const t = start + (dir * i * 2 * Math.PI) / N
    return [cx + rx * Math.cos(t) + wob * Math.cos(2 * t + ph), cy + ry * Math.sin(t) + wob * 0.6 * Math.sin(3 * t + ph)]
  })
  const P = i => pts[(i + N) % N]
  let d = `M${n(P(0)[0])} ${n(P(0)[1])}`
  for (let i = 0; i < N; i++) {
    const [a, b, c, e] = [P(i - 1), P(i), P(i + 1), P(i + 2)]
    d += `C${n(b[0] + (c[0] - a[0]) / 6)} ${n(b[1] + (c[1] - a[1]) / 6)} ${n(c[0] - (e[0] - b[0]) / 6)} ${n(c[1] - (e[1] - b[1]) / 6)} ${n(c[0])} ${n(c[1])}`
  }
  return `${d}Z`
}

// Deep koi first, so the near ones swim over them.
const SCHOOL = [
  { v: 'asagi', cols: 32, depth: 'deep', dur: 150, at: 0.2, path: { cx: 520, cy: 640, rx: 400, ry: 230, wob: 50, dir: 1, start: 2.4 } },
  { v: 'yamabuki', cols: 33, depth: 'mid', dur: 120, at: 0.6, path: { cx: 1120, cy: 330, rx: 360, ry: 210, wob: 40, dir: -1, start: 5.5 } },
  { v: 'tancho', cols: 35, depth: 'mid', dur: 115, at: 0.3, path: { cx: 1100, cy: 610, rx: 410, ry: 260, wob: 50, dir: 1, start: 5 } },
  { v: 'sanke', cols: 37, depth: 'near', dur: 125, at: 0.8, path: { cx: 520, cy: 380, rx: 430, ry: 250, wob: 60, ph: 0.5, dir: -1, start: 2 } },
  { v: 'orenji', cols: 35, depth: 'near', dur: 160, at: 0.05, path: { cx: 800, cy: 500, rx: 640, ry: 330, wob: 60, dir: 1, start: 4.04 } },
  { v: 'kohaku', cols: 38, depth: 'near', dur: 160, at: 0.05, path: { cx: 800, cy: 500, rx: 640, ry: 330, wob: 60, dir: 1, start: 0.9 } },
]

// Each koi rests at its own place along its loop: this is the still pond that shows
// where the GPU pond can't play (phones, Reduce Motion, a GPU that can't keep up).
const school = SCHOOL.map((k, i) => {
  const { L, svg } = koiSvg(k.cols, k.v)
  const css = `#k${i}{offset-path:path('${loop(k.path)}');offset-rotate:auto;offset-distance:${n(k.at * 100)}%}`
  const shade = `<ellipse class="shade" rx="${n(L * 0.5)}" ry="${n(L * 0.17)}" fill="url(#shade)"/>`
  return { css, svg: `<g id="k${i}" class="koi ${k.depth}">${shade}${svg}</g>` }
})

// ---------------------------------------------------------------------------
// Lily pads from above: discs with a notch and veins, and one lotus.

const padSvg = (R, notch) => {
  const cols = Math.ceil((2 * R) / CW)
  const rows = Math.ceil((2 * R) / CH)
  let out = ''
  for (let r = 0; r < rows; r++) {
    const cells = []
    for (let c = 0; c < cols; c++) {
      const dx = (c + 0.5) * CW - R
      const dy = (r + 0.5) * CH - R
      const d = Math.hypot(dx, dy)
      if (d > R) {
        cells.push(null)
        continue
      }
      const th = Math.atan2(dy, dx)
      const off = Math.abs(((th - notch + 3 * Math.PI) % (2 * Math.PI)) - Math.PI)
      if (off < 0.2 + (0.05 * R) / Math.max(d, 1) && d > R * 0.08) {
        cells.push(null)
        continue
      }
      const vein = Math.abs(Math.sin((th - notch) * 4.5)) < 0.12 && d > R * 0.15
      cells.push(
        d > R * 0.88 ? { ch: d > R * 0.96 ? '.' : ':', cls: 'pr' } : vein ? { ch: ':', cls: 'pv' } : { ch: d < R * 0.12 ? '*' : '=', cls: 'pd' },
      )
    }
    const run = runs(cells, 0, cols)
    if (run) {
      out += `<text x="${n(run.first * CW - R)}" y="${n(r * CH + CH * 0.85 - R)}" textLength="${n(run.len * CW)}" lengthAdjust="spacing">${run.out}</text>`
    }
  }
  return out
}

const LOTUS = ['  .*.', ' *(o)*', "  '*'"]
const lotusSvg = LOTUS.map((text, i) => {
  const t = text.replace(/^\s+/, '')
  const lead = text.length - t.length
  const body = [...t].map(ch => `<tspan class="${ch === 'o' ? 'lc' : 'lp'}">${esc(ch)}</tspan>`).join('')
  return `<text x="${n(lead * CW * 1.4 - 18)}" y="${n(i * 13 - 10)}" textLength="${n(t.length * CW * 1.4)}" lengthAdjust="spacing" class="big">${body}</text>`
}).join('')

const PADS = [
  { x: 1450, y: 110, R: 95, notch: 2.3, lotus: true },
  { x: 1300, y: 40, R: 55, notch: 0.8 },
  { x: 1545, y: 265, R: 60, notch: -2.4 },
  { x: 110, y: 880, R: 85, notch: -0.9 },
  { x: 250, y: 960, R: 50, notch: 2.9 },
  { x: 60, y: 90, R: 48, notch: 1.2 },
  { x: 1520, y: 860, R: 70, notch: -1.9 },
]

const pads = PADS.map(
  p =>
    `<g transform="translate(${p.x} ${p.y})"><g>` +
    `<g class="pad">${padSvg(p.R, p.notch)}</g>` +
    (p.lotus ? `<g class="lotus" transform="translate(${n(-p.R * 0.15)} ${n(p.R * 0.2)})">${lotusSvg}</g>` : '') +
    `</g></g>`,
).join('')

// ---------------------------------------------------------------------------
// Ripples: dotted rings resting wide and faint.

const STILL = [
  { x: 1180, y: 250, rs: [120, 190, 260, 330] },
  { x: 260, y: 700, rs: [90, 150, 210] },
]
const stillRings = STILL.map(s => s.rs.map(r => `<circle cx="${s.x}" cy="${s.y}" r="${r}"/>`).join('')).join('')

// ---------------------------------------------------------------------------
// Water: faint glints on the surface.

let seed = 11
const rand = () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}
const waterRow = len => {
  let s = ''
  while (s.length < len) {
    const r = rand()
    s += r < 0.05 ? '~' : r < 0.075 ? '-~' : r < 0.09 ? '.' : r < 0.097 ? '~-~' : ' '
  }
  return s.slice(0, len)
}
const WATER_COLS = 234 // 234 * 7.2 = 1685px, a little wider than the pond
const water = Array.from({ length: 16 }, (_, i) => {
  const text = waterRow(WATER_COLS)
  const y = 30 + i * 62 + Math.round(rand() * 14)
  return `<text x="${n(-rand() * 60)}" y="${y}" textLength="${n(text.length * CW)}" lengthAdjust="spacing">${esc(text)}</text>`
}).join('')

// ---------------------------------------------------------------------------

const STYLE = `
svg{
  --deep:#5f9d93;--shallow:#a9d4ca;--tex:#ffffff;--ring:#ffffff;--shade:#0d3f3a;
  --w:#ffffff;--r:#e4421a;--k:#1c1e24;--g:#e9ad1e;--o:#f07a18;--b:#5579a0;--p:#efe6cf;--e:#1c1e24;
  --pd:#2a6538;--pv:#1b4626;--pr:#3f7a42;--lp:#fff4ec;--lc:#f2b21b;
}
@media (prefers-color-scheme: dark){
  svg{
    --deep:#081325;--shallow:#14284a;--tex:#8fb0dd;--ring:#dfe8f6;--shade:#000000;
    --w:#f6f2ec;--r:#ff5a2a;--k:#3a4354;--g:#f7c447;--o:#ff8a2b;--b:#9db7d6;--p:#ece2cc;--e:#0b1020;
    --pd:#3f8a57;--pv:#2a6440;--pr:#64a874;--lp:#fff1e6;--lc:#ffc94d;
  }
}
.d0{stop-color:var(--shallow)}
.d1{stop-color:var(--deep)}
.s0{stop-color:var(--shade);stop-opacity:.42}
.s1{stop-color:var(--shade);stop-opacity:0}
text{font-family:ui-monospace,Menlo,Consolas,'DejaVu Sans Mono','Liberation Mono',monospace;font-size:${FONT}px;white-space:pre;text-rendering:optimizeSpeed}
text.big{font-size:16px;font-weight:bold}
.water text{fill:var(--tex);opacity:.1}
.sil{opacity:.3}.sil.w{fill:var(--w)}.sil.g{fill:var(--g)}.sil.o{fill:var(--o)}.sil.b{fill:var(--b)}.sil.k{fill:var(--k)}.sil.p{fill:var(--p)}
.w{fill:var(--w)}.r{fill:var(--r)}.k{fill:var(--k)}.g{fill:var(--g)}.o{fill:var(--o)}.b{fill:var(--b)}.p{fill:var(--p)}.e{fill:var(--e)}
.fw{fill:var(--w);opacity:.38}.fk{fill:var(--k);opacity:.6}.fg{fill:var(--g);opacity:.42}.fo{fill:var(--o);opacity:.42}
.pd{fill:var(--pd)}.pv{fill:var(--pv)}.pr{fill:var(--pr)}.lp{fill:var(--lp)}.lc{fill:var(--lc)}
.near{opacity:.95}
.mid{opacity:.78}
.deep{opacity:.5}
.still circle{fill:none;stroke:var(--ring);stroke-width:1.6;stroke-linecap:round;stroke-dasharray:.1 7;opacity:.26}
${school.map(k => k.css).join('\n')}
`

export const SCENE =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xml:space="preserve">` +
  `<style>${STYLE}</style>` +
  `<defs>` +
  `<radialGradient id="pond" cx="50%" cy="45%" r="75%"><stop offset="0" class="d0"/><stop offset="1" class="d1"/></radialGradient>` +
  `<radialGradient id="shade"><stop offset="0" class="s0"/><stop offset="1" class="s1"/></radialGradient>` +
  `</defs>` +
  `<rect width="${W}" height="${H}" fill="url(#pond)"/>` +
  `<g class="water">${water}</g>` +
  `<g class="still">${stillRings}</g>` +
  school.map(k => k.svg).join('') +
  `<g class="pads">${pads}</g>` +
  `</svg>`
