// The koi pond, played on the GPU: koi that steer for themselves, water that
// answers the pointer, and every frame drawn as letters on a fixed grid.
import {
  PI,
  abs,
  atan,
  buffer,
  clamp,
  composer,
  cos,
  dot,
  dt,
  exp,
  first,
  floor,
  fract,
  length,
  max,
  min,
  mix,
  mod,
  normalize,
  picture,
  pointers,
  pow,
  px,
  range,
  scene,
  shader,
  sin,
  size,
  smoothstep,
  sqrt,
  step,
  table,
  time,
  values,
  vec2,
  vec3,
  vec4,
} from 'claude-code/shader'
import type { Buffer } from 'claude-code/shader'

// busy: Claude is working. sends: how many messages have been sent.
const v = values({ busy: [0, 1], sends: [0, 1023] })

const TAU = PI * 2
const CW = 6 // a letter's cell, in points
const CH = 12
const NK = 6

// Each koi: length in points, cruising speed, depth (0 near, 1 deep), body color.
const KOI = table([
  [200, 26, 0.9, 6], // asagi
  [205, 30, 0.55, 4], // yamabuki
  [215, 28, 0.5, 1], // tancho
  [225, 27, 0.2, 1], // sanke
  [215, 24, 0.1, 5], // orenji
  [235, 25, 0, 1], // kohaku
])
// Fin color, kind (1 asagi), and where it starts across the window.
const KOI2 = table([
  [5, 1, 0.25, 0.35],
  [4, 0, 0.72, 0.7],
  [1, 0, 0.7, 0.32],
  [1, 0, 0.3, 0.66],
  [5, 0, 0.55, 0.5],
  [1, 0, 0.45, 0.22],
])
// Patches, four a koi: x (tail 0 to nose 1), y across in body lengths, radius, color.
const PATCH = table([
  [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
  [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
  [0.855, 0, 0.05, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
  [0.82, 0.01, 0.075, 2], [0.5, -0.02, 0.095, 2], [0.55, 0.04, 0.03, 3], [0.33, -0.03, 0.026, 3],
  [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
  [0.84, 0, 0.085, 2], [0.6, 0.01, 0.1, 2], [0.36, -0.01, 0.065, 2], [0, 0, 0, 0],
])
// Lily pads where the still scene has them, in its 1600 by 1000 box: x, y down, radius, notch.
const PADS = table([
  [1450, 110, 95, 2.3],
  [1300, 40, 55, 0.8],
  [1545, 265, 60, -2.4],
  [110, 880, 85, -0.9],
  [250, 960, 50, 2.9],
  [60, 90, 48, 1.2],
  [1520, 860, 70, -1.9],
])
// Colors: dark rows 0 to 16, light rows 17 to 33.
// foam, white, red, sumi, gold, orange, blue, platinum, eye, pad, vein, rim, petal, lotus, glint, wake, pellet
const PAL = table([
  [0.875, 0.91, 0.965], [0.965, 0.949, 0.925], [1, 0.353, 0.165], [0.29, 0.329, 0.408],
  [0.969, 0.769, 0.278], [1, 0.541, 0.169], [0.616, 0.718, 0.839], [0.925, 0.886, 0.8],
  [0.043, 0.063, 0.125], [0.247, 0.541, 0.341], [0.165, 0.392, 0.251], [0.392, 0.659, 0.455],
  [1, 0.761, 0.82], [1, 0.788, 0.302], [0.561, 0.69, 0.867], [0.718, 0.804, 0.937],
  [0.878, 0.643, 0.29],
  [1, 1, 1], [1, 1, 1], [0.894, 0.259, 0.102], [0.11, 0.118, 0.141],
  [0.914, 0.678, 0.118], [0.941, 0.478, 0.094], [0.333, 0.475, 0.627], [0.937, 0.902, 0.812],
  [0.11, 0.118, 0.141], [0.165, 0.396, 0.22], [0.106, 0.275, 0.149], [0.247, 0.478, 0.259],
  [0.957, 0.561, 0.694], [0.949, 0.698, 0.106], [1, 1, 1], [1, 1, 1],
  [0.71, 0.467, 0.165],
])
// Letter strokes in a cell, 0 to 1 across and up: x1 y1 x2 y2, or cx cy -1 r for a ring.
const SEG = table([
  [0.5, 0.2, 0.5, 0.2],
  [0.5, 0.28, 0.5, 0.28], [0.5, 0.62, 0.5, 0.62],
  [0.22, 0.45, 0.78, 0.45],
  [0.2, 0.35, 0.8, 0.35], [0.2, 0.57, 0.8, 0.57],
  [0.18, 0.45, 0.82, 0.45], [0.5, 0.25, 0.5, 0.65],
  [0.5, 0.24, 0.5, 0.68], [0.24, 0.34, 0.76, 0.58], [0.24, 0.58, 0.76, 0.34],
  [0.36, 0.18, 0.42, 0.76], [0.62, 0.18, 0.68, 0.76], [0.16, 0.36, 0.86, 0.36], [0.14, 0.58, 0.84, 0.58],
  [0.2, 0.16, 0.8, 0.8], [0.27, 0.7, -1, 0.13], [0.73, 0.27, -1, 0.13],
  [0.5, 0.47, -1, 0.36], [0.52, 0.47, -1, 0.14],
  [0.5, 0.4, -1, 0.22],
  [0.5, 0.12, 0.5, 0.84],
  [0.22, 0.14, 0.78, 0.82],
  [0.22, 0.82, 0.78, 0.14],
  [0.12, 0.42, 0.36, 0.56], [0.36, 0.56, 0.64, 0.4], [0.64, 0.4, 0.88, 0.54],
  [0.5, 0.66, 0.5, 0.86],
  [0.64, 0.86, 0.42, 0.5], [0.42, 0.5, 0.64, 0.14],
  [0.36, 0.86, 0.58, 0.5], [0.58, 0.5, 0.36, 0.14],
])
// Letter to its first stroke and stroke count.
// 1 .  2 :  3 -  4 =  5 +  6 *  7 #  8 %  9 @  10 o  11 |  12 /  13 back slash  14 ~  15 '  16 (  17 )
const GLYPH = table([
  [0, 0], [0, 1], [1, 2], [3, 1], [4, 2], [6, 2],
  [8, 3], [11, 4], [15, 3], [18, 2], [20, 1], [21, 1],
  [22, 1], [23, 1], [24, 3], [27, 1], [28, 2], [30, 2],
])

// ---------------------------------------------------------------- helpers

function hash(p: vec2): number {
  let q = vec2(fract(p * vec2(123.34, 456.21)))
  q = vec2(q + dot(q, q + 45.32))
  return fract(q.x * q.y)
}

function safeNorm(d: vec2): vec2 {
  return vec2(d / max(length(d), 0.0001))
}

function rot(d: vec2, a: number): vec2 {
  const c = cos(a)
  const s = sin(a)
  return vec2(d.x * c - d.y * s, d.x * s + d.y * c)
}

function wrapPi(a: number): number {
  return mod(a + PI, TAU) - PI
}

function segDist(p: vec2, a: vec2, b: vec2): number {
  const pa = vec2(p - a)
  const ba = vec2(b - a)
  const h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0, 1)
  return length(pa - ba * h)
}

// Half the koi's width at x, in body lengths: x runs 0 (tail tip) to 1 (nose).
function bodyW(x: number): number {
  const t = clamp((x - 0.2) / 0.8, 0, 1)
  const f = pow(t, 0.9) * pow(1 - t, 0.55)
  const w = 0.15 * (0.13 + (0.87 * f) / 0.462)
  return x < 0.2 || x > 1 ? 0 : w
}

// A stroke letter that lies along an angle: - / | or back slash.
function dirGlyph(a: number): number {
  const k = floor(mod(a + PI / 8, PI) / (PI / 4))
  return k < 0.5 ? 3 : k < 1.5 ? 12 : k < 2.5 ? 11 : 13
}

function pal(i: number): vec3 {
  const c = palb.at(vec2(floor(i + 0.5), 0))
  return vec3(c.x, c.y, c.z)
}

function padAt(i: number): vec4 {
  const p = PADS.at(i)
  const s = max(size.x / 1600, size.y / 1000)
  const off = vec2((size - vec2(1600, 1000) * s) * 0.5)
  return vec4(off.x + p.x * s, off.y + (1000 - p.y) * s, p.z * s, -p.w)
}

function evAt(i: number, row: number): vec4 {
  return ev.at(vec2(i, row))
}

function koiAt(i: number, row: number): vec4 {
  return koi.at(vec2(i, row))
}

function swimWave(s1: vec4, L: number, x: number): number {
  const tb = clamp(1 - x, 0, 1.2)
  return 0.05 * L * tb * tb * sin(s1.y - tb * 4.5)
}

function bend(s0: vec4, s1: vec4, L: number): number {
  return clamp(s1.x / max(s0.w, 6), -1.3 / L, 1.3 / L)
}

// Koi-local coordinates of P: x from tail (0) to nose (1), y across, in body lengths.
function koiLocal(P: vec2, s0: vec4, s1: vec4, L: number): vec2 {
  const d = vec2(cos(s0.z), sin(s0.z))
  const rel = vec2(P - vec2(s0.x, s0.y))
  const along = dot(rel, d)
  const x = 0.55 + along / L
  const lat = dot(rel, vec2(-d.y, d.x)) - 0.5 * bend(s0, s1, L) * along * along - swimWave(s1, L, x)
  return vec2(x, lat / L)
}

function koiPoint(s0: vec4, s1: vec4, L: number, x: number, y: number): vec2 {
  const d = vec2(cos(s0.z), sin(s0.z))
  const along = (x - 0.55) * L
  const lat = y * L + 0.5 * bend(s0, s1, L) * along * along + swimWave(s1, L, x)
  return vec2(vec2(s0.x, s0.y) + d * along + vec2(-d.y, d.x) * lat)
}

// The same, from the koi memory: heading, bend and phase are cached in row 3.
function wave(ph: number, L: number, x: number): number {
  const tb = clamp(1 - x, 0, 1.2)
  return 0.05 * L * tb * tb * sin(ph - tb * 4.5)
}

function koiNear(P: vec2, i: number, L: number): vec2 {
  const s0 = koiAt(i, 0)
  const r3 = koiAt(i, 3)
  const rel = vec2(P - vec2(s0.x, s0.y))
  const along = rel.x * r3.x + rel.y * r3.y
  const x = 0.55 + along / L
  const lat = rel.y * r3.x - rel.x * r3.y - 0.5 * r3.z * along * along - wave(r3.w, L, x)
  return vec2(x, lat / L)
}

function koiSpot(i: number, L: number, x: number, y: number): vec2 {
  const s0 = koiAt(i, 0)
  const r3 = koiAt(i, 3)
  const along = (x - 0.55) * L
  const lat = y * L + 0.5 * r3.z * along * along + wave(r3.w, L, x)
  return vec2(s0.x + r3.x * along - r3.y * lat, s0.y + r3.y * along + r3.x * lat)
}

function koiColor(i: number, x: number, y: number, w: number): number {
  let col = KOI.at(i).w
  if (KOI2.at(i).y > 0.5 && abs(y) > w * 0.68) {
    col = 5
  }
  for (const j of range(4)) {
    const p = PATCH.at(i * 4 + j)
    const dx = (x - p.x) / max(p.z, 0.001)
    const dy = (y - p.y) / max(p.z * 0.8, 0.001)
    const sd = dx * dx + dy * dy + 0.26 * sin(41 * x + 17 * y + j * 3 + i)
    if (p.z > 0 && sd <= 1) {
      col = p.w
    }
  }
  return col
}

function pelletPos(e: vec4, p: number): vec2 {
  const ang = p * 1.9 + e.x * 0.013 + e.y * 0.007
  const rr = 6 + 10 * fract(sin(p * 12.9 + e.x * 0.1) * 437.5)
  const a = time - e.z
  return vec2(vec2(e.x, e.y) + vec2(cos(ang), sin(ang)) * rr + vec2(sin(a * 0.35 + p), cos(a * 0.3 + p * 2)) * 3)
}

function dropPoint(): vec2 {
  const wide = composer.z - composer.x > 0.01
  return wide ? vec2(((composer.x + composer.z) * 0.5) * size.x, composer.w * size.y + 10) : vec2(size * vec2(0.5, 0.12))
}

// 1 in lane i, 0 in the others.
function onehot(i: number): vec4 {
  return vec4(i < 0.5 ? 1 : 0, i > 0.5 && i < 1.5 ? 1 : 0, i > 1.5 && i < 2.5 ? 1 : 0, i > 2.5 ? 1 : 0)
}

function lum(c: vec4): number {
  return dot(vec3(c.r, c.g, c.b), vec3(0.299, 0.587, 0.114))
}

// ---------------------------------------------------------------- events
// Slots 0 to 3 clicks (row 1: pellets eaten), 4 a sent message, 5 Claude done,
// 6 to 11 a koi rising, 14 counters, 15 light or dark.

const ev: Buffer = buffer({ size: [16, 2], float: 32, filter: 'nearest' }, p => {
  const i = p.cell.x
  const row = p.cell.y
  const cur = evAt(i, row)
  const cnt = evAt(14, 0)
  const init = first || cnt.w < 0.5
  let out = vec4(cur)

  let pressed = 0
  let pp = vec2(0)
  for (const q of pointers) {
    if (pressed < 0.5 && q.down > 0.5 && q.age == 0) {
      pressed = 1
      pp = vec2(q.at)
    }
  }
  const sendsNow = floor(v.sends + 0.5)

  if (i < 4) {
    const mine = pressed > 0.5 && i == cnt.x
    if (row < 0.5) {
      out = mine ? vec4(pp, time, 1) : cur
    } else {
      const e0 = evAt(i, 0)
      let eaten = vec4(cur)
      for (const pl of range(4)) {
        const pel = pelletPos(e0, pl)
        for (const k of range(NK)) {
          const head = vec2(koiAt(k, 2).z, koiAt(k, 2).w)
          const hit = e0.w > 0.5 && time - e0.z > 0.3 && length(head - pel) < 16 ? 1 : 0
          eaten = vec4(max(eaten, onehot(pl) * hit))
        }
      }
      out = mine ? vec4(0) : eaten
    }
  } else if (i < 5) {
    out = row < 0.5 && sendsNow != cnt.y ? vec4(dropPoint(), time, 2) : cur
  } else if (i < 6) {
    out = row < 0.5 && cnt.z > 0.5 && v.busy <= 0.5 ? vec4(size * 0.5, time, 3) : cur
  } else if (i < 12) {
    const kk = i - 6
    const per = 9 + kk * 2.3
    const n = floor((time + kk * 3.7) / per)
    const rise = !init && n != evAt(i, 1).x
    const head = koiPoint(koiAt(kk, 0), koiAt(kk, 1), KOI.at(kk).x, 0.99, 0)
    out = row > 0.5 ? vec4(n, 0, 0, 0) : rise ? vec4(head, time, 4) : cur
  } else if (i < 14.5 && i > 13.5) {
    out = row < 0.5 ? vec4(init ? 0 : mod(cnt.x + pressed, 4), sendsNow, v.busy, 1) : vec4(0)
  } else if (i > 14.5) {
    const lo = min(lum(scene.sample(vec2(0.012, 0.988))), min(lum(scene.sample(vec2(0.988, 0.012))), lum(scene.sample(vec2(0.988, 0.988)))))
    const dk = 1 - smoothstep(0.2, 0.45, lo)
    out = row < 0.5 ? vec4(init ? dk : mix(cur.x, dk, 1 - exp(-dt * 3)), 0, 0, 1) : vec4(0)
  }
  const keep = (i > 5.5 && i < 11.5) || i > 13.5
  return init && !keep ? vec4(0) : out
})

// ---------------------------------------------------------------- koi
// Row 0: x, y, heading, speed. Row 1: turn rate, swim phase, excitement.
// Row 2: where the tail tip and the mouth are, for the wake and the food.
// Row 3: heading as cos and sin, how far the body bends, swim phase.

const koi: Buffer = buffer({ size: [8, 4], float: 32, filter: 'nearest' }, p => {
  const i = min(p.cell.x, NK - 1)
  const k = KOI.at(i)
  const k2 = KOI2.at(i)
  let s0 = koiAt(i, 0)
  let s1 = koiAt(i, 1)
  if (first || s0.w <= 0) {
    s0 = vec4(vec2(k2.z, k2.w) * size, i * 1.7 + 0.4, k.y)
    s1 = vec4(0, i * 1.3, 0, 1)
  }
  let pos = vec2(clamp(vec2(s0.x, s0.y), vec2(-200), size + 200))
  let h = s0.z
  let spd = s0.w
  let turn = s1.x
  const t = time

  // Wander toward a slowly drifting point, with a lazy weave.
  const tgt = vec2(size * (vec2(0.5) + vec2(
    sin(t * 0.031 * (1 + i * 0.13) + i * 2.1) + 0.45 * sin(t * 0.071 + i * 4.3),
    sin(t * 0.027 * (1 + i * 0.11) + i * 3.7) + 0.45 * cos(t * 0.063 + i * 1.9)) * (0.36 / 1.45)))
  let steer = rot(safeNorm(vec2(tgt - pos)), 0.9 * sin(t * 0.23 * (1 + i * 0.07) + i * 5.1) + 0.5 * sin(t * 0.61 + i * 2.3))

  // Turn before reaching the edge.
  const ahead = vec2(pos + vec2(cos(h), sin(h)) * k.x * 1.3)
  const edge = vec2(
    smoothstep(60, -60, ahead.x) - smoothstep(size.x - 60, size.x + 60, ahead.x),
    smoothstep(60, -60, ahead.y) - smoothstep(size.y - 60, size.y + 60, ahead.y))

  // Give each other a little room.
  for (const j of range(NK)) {
    const d = vec2(pos - vec2(koiAt(j, 0).x, koiAt(j, 0).y))
    const dist = length(d)
    const reach = k.x * 0.8
    const push = j != i && dist < reach ? 1 - dist / reach : 0
    steer = vec2(steer + d / max(dist, 1) * push * 1.2)
  }

  // Swim to food that hasn't been eaten.
  let excite = 0
  for (const e of range(4)) {
    const f = evAt(e, 0)
    const a = time - f.z
    const eaten = evAt(e, 1)
    const left = 1 - (eaten.x + eaten.y + eaten.z + eaten.w) * 0.25
    const d = vec2(vec2(f.x, f.y) - pos)
    const live = f.w > 0.5 && a > 0.15 && a < 8 ? 1 : 0
    const w = (1 - smoothstep(150, 650, length(d))) * (1 - smoothstep(5, 8, a)) * left * live
    steer = vec2(steer + safeNorm(d) * 4 * w)
    excite = max(excite, w)
  }

  // Circle the conversation while Claude works.
  const C = vec2(size * 0.5)
  const toC = vec2(C - pos)
  const dc = max(length(toC), 1)
  const Ro = min(size.x, size.y) * 0.36 + i * 12
  const orbit = vec2(vec2(-toC.y, toC.x) / dc + (toC / dc) * clamp(((dc - Ro) / Ro) * 2.5, -1, 1))
  steer = vec2(mix(steer, orbit * 2, v.busy) + edge * 3)

  // Scatter when Claude finishes.
  const dn = evAt(5, 0)
  const ad = time - dn.z
  const sw = dn.w > 2.5 && ad < 3.5 ? 1 - smoothstep(1, 3.5, ad) : 0
  steer = vec2(steer + safeNorm(vec2(pos - C)) * 3 * sw)
  excite = max(excite, sw)

  // Turn no tighter than the body allows, faster when excited.
  const stp = min(dt, 0.1)
  const desired = atan(steer.y, steer.x)
  const maxTurn = spd / (k.x * mix(1.7, 0.75, excite))
  const want = clamp(wrapPi(desired - h) * 1.2, -maxTurn, maxTurn)
  turn = mix(turn, want, 1 - exp(-stp * 2))
  h = wrapPi(h + turn * stp)
  spd = mix(spd, k.y * (1 + excite * 1.4 + v.busy * 0.15), 1 - exp(-stp * 1.2))
  pos = vec2(pos + vec2(cos(h), sin(h)) * spd * stp)
  const beat = min(0.55 + (0.5 * spd) / k.y, 1.2)
  const ph = mod(s1.y + stp * TAU * beat, TAU)
  const live = p.cell.x < NK ? 1 : 0
  const n0 = vec4(pos, h, spd * live)
  const n1 = vec4(turn, ph, excite, 1)
  const tip = koiPoint(n0, n1, k.x, 0.02, 0)
  const mouth = koiPoint(n0, n1, k.x, 0.97, 0)
  const n3 = vec4(cos(h), sin(h), bend(n0, n1, k.x), ph)
  return p.cell.y < 0.5 ? n0 : p.cell.y < 1.5 ? n1 : p.cell.y < 2.5 ? vec4(tip, mouth) : n3
})

// ---------------------------------------------------------------- colors for this frame
// 0 to 16 the palette, 17 deep water, 18 shallow water, 19 sunlight, 20 strengths.

const palb = buffer({ size: [24, 1], float: 16, filter: 'nearest' }, p => {
  const i = p.cell.x
  const dark = evAt(15, 0).x
  const c = vec3(mix(PAL.at(17 + i), PAL.at(i), dark))
  const deep = vec3(mix(vec3(0.337, 0.596, 0.565), vec3(0.031, 0.075, 0.145), dark))
  const shallow = vec3(mix(vec3(0.612, 0.812, 0.769), vec3(0.078, 0.157, 0.29), dark))
  const sun = vec3(mix(vec3(1), vec3(0.56, 0.69, 0.87), dark))
  const k = vec3(mix(0.055, 0.04, dark), mix(0.32, 0.2, dark), 0)
  const out = i < 16.5 ? c : i < 17.5 ? deep : i < 18.5 ? shallow : i < 19.5 ? sun : k
  return vec4(out, 1)
})

// ---------------------------------------------------------------- wake and sunlight

const trail: Buffer = buffer({ scale: 0.25, float: 16, filter: 'linear' }, p => {
  const P = vec2(p.point)
  let tr = trail.at(p.cell).x * exp(-dt * 2.4)
  for (const q of pointers) {
    const moved = clamp(length(q.at - q.was) / 6, 0, 1)
    const amt = smoothstep(5, 1.5, segDist(P, vec2(q.was), vec2(q.at))) * moved * (q.over > 0.5 ? 0.6 : 1)
    tr = max(tr, q.gone > 0 ? 0 : amt)
  }
  for (const i of range(NK)) {
    const tail = vec2(koiAt(i, 2).x, koiAt(i, 2).y)
    tr = tr + smoothstep(7, 0, length(P - tail)) * dt * 1.6
  }
  let q = vec2(P * 0.0065)
  q = vec2(q + vec2(sin(q.y * 1.3 + time * 0.11), sin(q.x * 1.7 - time * 0.09)) * 0.55)
  q = vec2(q + vec2(sin(q.y * 2.3 - time * 0.13 + 1.7), sin(q.x * 2.1 + time * 0.12 + 2.3)) * 0.35)
  const c1 = 1 - abs(sin(q.x * 2.4 + q.y * 1.1))
  const c2 = 1 - abs(sin(q.y * 2.2 - q.x * 0.9 + 1.3))
  const spots = 0.55 + 0.45 * sin(P.x * 0.0021 + time * 0.05) * sin(P.y * 0.0027 - time * 0.04)
  const a2 = c1 * c1
  const a4 = a2 * a2
  const b2 = c2 * c2
  const b4 = b2 * b2
  return vec4(clamp(tr, 0, 1), (a4 * a4 * a4 * a2 + b4 * b4 * b4 * b2) * spots, 0, 1)
})

// ---------------------------------------------------------------- soft bodies under the letters

const soft = buffer({ scale: 1 / 6, float: 16, filter: 'linear' }, p => {
  const P = vec2(p.point)
  let acc = vec4(0)
  for (const i of range(NK)) {
    const L = KOI.at(i).x
    const q = koiNear(P, i, L)
    const x = q.x
    const y = q.y
    if (x > -0.05 && x < 1.05 && abs(y) < 0.3) {
    const edge = 3 / L
    const w = bodyW(x)
    let cov = x > 0.2 ? smoothstep(edge, -edge, abs(y) - w * 0.96) * smoothstep(0.2, 0.24, x) : 0
    const s = clamp((0.27 - x) / 0.27, 0, 1.2)
    const hw = 0.022 + 0.135 * pow(s, 1.05)
    const notch = 0.075 * (1 - (y / hw) * (y / hw))
    const tail = x < 0.3 ? smoothstep(edge, -edge, abs(y) - hw) * step(notch, x) * 0.4 : 0
    cov = max(cov, tail) * mix(1, 0.55, KOI.at(i).z)
    if (cov > 0) {
      const tint = pal(koiColor(i, x, y, w))
      acc = vec4(acc * (1 - cov) + vec4(tint * cov, cov))
    }
    }
  }
  return acc
})

// ---------------------------------------------------------------- the water under the letters

const ground = buffer({ scale: 0.25, float: 16, filter: 'linear' }, p => {
  const P = vec2(p.point)
  const f = clamp(length((P - size * vec2(0.5, 0.55)) / max(size.x, size.y)) * 1.5, 0, 1)
  const k = palb.at(vec2(20, 0))
  let col = vec3(mix(pal(18), pal(17), f))
  col = vec3(col + pal(19) * trail.sample(p.uv).y * k.x)
  col = vec3(col * (1 - soft.sample(vec2((P + vec2(-9, 13)) / size)).w * k.y))
  const u = soft.sample(p.uv)
  col = vec3(col * (1 - u.w * 0.4) + vec3(u.x, u.y, u.z) * 0.4)
  return vec4(col, 1)
})

// ---------------------------------------------------------------- letters

// One koi's letter in cell ci: glyph, color, alpha (glyph 0 for none).
function koiCell(i: number, P: vec2, ci: vec2): vec3 {
  const s0 = koiAt(i, 0)
  const ph = koiAt(i, 3).w
  const L = KOI.at(i).x
  const fin = KOI2.at(i).x
  const alpha = mix(1, 0.55, KOI.at(i).z)
  const q = koiNear(P, i, L)
  const x = q.x
  const y = q.y
  let g = vec3(0)
  if (x > -0.05 && x < 1.05 && abs(y) < 0.32) {
  // Tail fin: rays fanning back from the tail.
  const s = (0.27 - x) / 0.27
  const hw = 0.022 + 0.135 * pow(max(s, 0), 1.05)
  const notch = 0.075 * (1 - (y / hw) * (y / hw))
  const ra = atan(y, 0.27 - x)
  if (x < 0.27 && abs(y) <= hw && x >= notch && cos(ra * 15) > 0) {
    g = vec3(dirGlyph(s0.z + PI - ra), fin, alpha * 0.55)
  }

  // Pectoral and pelvic fins, flapping.
  const flap = 0.22 * sin(ph * 0.5)
  const front = rot(vec2(-0.8, 0.6), flap)
  const back = rot(vec2(-0.862, 0.507), flap * 0.5)
  for (const f of range(4)) {
    const side = f == 0 || f == 2 ? -1 : 1
    const pec = f < 2
    const ax = pec ? 0.68 : 0.4
    const root = pec ? 0.1273 : 0.0888
    const fd = pec ? front : back
    const dir = vec2(fd.x, fd.y * side)
    const a = pec ? 0.095 : 0.055
    const b = pec ? 0.052 : 0.03
    const r = vec2(vec2(x, y) - (vec2(ax, side * root * 0.8) + dir * a * 0.85))
    const u = dot(r, dir) / a
    const vv = (r.y * dir.x - r.x * dir.y) / b
    if (u * u + vv * vv <= 1) {
      g = vec3(dirGlyph(s0.z + atan(dir.y, dir.x)), fin, alpha * 0.5)
    }
  }

  // Body: denser letters along the spine so it looks rounded.
  const w = bodyW(x)
  if (w > 0 && abs(y) <= w) {
    const shade = sqrt(max(1 - (y / w) * (y / w), 0)) * min(1, (1 - x) * 14 + 0.25)
    g = vec3(1 + min(8, floor(shade * 9)), koiColor(i, x, y, w), alpha)
  }

  // Eyes.
  for (const e of range(2)) {
    const ep = koiSpot(i, L, 0.9, (e * 2 - 1) * 0.0993 * 0.62)
    const ec = vec2(floor(ep / vec2(CW, CH)))
    if (ec.x == ci.x && ec.y == ci.y) {
      g = vec3(10, 8, alpha)
    }
  }

  }
  return g
}

// A lily pad letter in cell ci, or glyph 0.
function padGlyph(ci: vec2): vec3 {
  const P = vec2((ci + 0.5) * vec2(CW, CH))
  let g = vec3(0)
  // Lily pads, with veins and a notch.
  for (const i of range(7)) {
    const pd = padAt(i)
    const rel = vec2(P - vec2(pd.x, pd.y))
    const d = length(rel)
    const R = pd.z
    if (d <= R) {
    const th = atan(rel.y, rel.x)
    const off = abs(wrapPi(th - pd.w))
    const gap = off < 0.2 + (0.05 * R) / max(d, 1) && d > R * 0.08
    const sp = PI / 4.5
    const va = (fract((th - pd.w) / sp + 0.5) - 0.5) * sp
    const vh = 0.5 * (abs(sin(th)) * CW + abs(cos(th)) * CH)
    if (!gap) {
      const rim = d > R * 0.88
      const vein = abs(va) * d < vh * 0.6 && d > R * 0.15
      g = rim ? vec3(d > R * 0.96 ? 1 : 2, 11, 0.95) : vein ? vec3(dirGlyph(th), 10, 0.95) : vec3(d < R * 0.12 ? 6 : 4, 9, 0.95)
    }
    }
  }

  // A lotus on the biggest pad.
  const p0 = padAt(0)
  const o = vec2(floor((P - vec2(p0.x, p0.y) - vec2(-0.15, -0.15) * p0.z) / vec2(CW, CH) + 0.5))
  if (o.y == 1 && abs(o.x) <= 1) {
    g = vec3(o.x == 0 ? 6 : 1, 12, 1)
  }
  if (o.y == 0 && abs(o.x) <= 2) {
    g = vec3(o.x == 0 ? 10 : o.x == -1 ? 16 : o.x == 1 ? 17 : 6, o.x == 0 ? 13 : 12, 1)
  }
  if (o.y == -1 && abs(o.x) <= 1) {
    g = vec3(o.x == 0 ? 6 : 15, 12, 1)
  }
  return g
}

// Two letters a texel, as the letters pass packs them.
const padMap = buffer({ scale: 1 / 12, float: 16, filter: 'nearest', once: true }, p => {
  const a = padGlyph(vec2(p.cell.x * 2, p.cell.y))
  const b = padGlyph(vec2(p.cell.x * 2 + 1, p.cell.y))
  return vec4(a.x * 20 + a.y, a.z, b.x * 20 + b.y, b.z)
})

// The letter in cell ci: glyph, color, alpha (glyph 0 for none).
function cellGlyph(ci: vec2): vec3 {
  const P = vec2((ci + 0.5) * vec2(CW, CH))
  const uv = vec2(P / size)
  let g = vec3(0)

  // Glints drifting on the surface, and the wake.
  const tr = trail.sample(uv)
  const wk = max(tr.x, max(trail.sample(vec2((P + vec2(0, 3.5)) / size)).x, trail.sample(vec2((P - vec2(0, 3.5)) / size)).x))
  const hs = hash(vec2(floor((P + vec2(time * 2.2, time * 0.6)) / vec2(CW, CH))))
  if (hs > 0.94) {
    g = vec3(hs > 0.988 ? 14 : hs > 0.965 ? 3 : 1, 14, 0.09 + tr.y * 0.25)
  }
  if (wk > 0.07) {
    g = vec3(wk > 0.4 ? 14 : 3, 15, clamp(wk * 1.3, 0, 0.85))
  }

  // Koi, deepest first.
  for (const i of range(NK)) {
    const kc = koiCell(i, P, ci)
    if (kc.x > 0) {
      g = kc
    }
  }

  // Rings and splashes: clicks (slots 0 to 3) and a sent message (4).
  for (const e of range(5)) {
    const f = evAt(e, 0)
    const a = time - f.z
    if (f.w > 0.5 && f.w < 2.5 && a >= 0 && a < 1) {
      const rel = vec2(P - vec2(f.x, f.y))
      const dist = length(rel)
      const dir = vec2(rel / max(dist, 0.001))
      const hb = 0.5 * (abs(dir.x) * CW + abs(dir.y) * CH)
      const big = f.w > 1.5
      const life = big ? 1 : 0.9
      const r = big ? 14 + 320 * a - 80 * a * a : 10 + 260 * a - 60 * a * a
      if (a < life && abs(dist - r) < hb) {
        g = vec3(dirGlyph(atan(dir.y, dir.x) + PI * 0.5), 0, 0.95 * pow(1 - a / life, 1.2))
      }
      const ang = atan(rel.y, rel.x) - f.x * 0.01
      const side = abs(fract(ang / (TAU / 6) + 0.5) - 0.5) * (TAU / 6) * dist
      if (a < 0.4 && abs(dist - (8 + 80 * a)) < hb && side < hb) {
        g = vec3(1, 0, 1 - a / 0.4)
      }
      if (a < 0.4 && dist < hb) {
        g = vec3(a < 0.15 ? 10 : 6, 0, 1 - a / 0.4)
      }
    }
  }

  // Food floating where a click landed, until the koi eat it.
  for (const e of range(4)) {
    const f = evAt(e, 0)
    const a = time - f.z
    if (f.w > 0.5 && f.w < 1.5 && a >= 0 && a < 8 && length(P - vec2(f.x, f.y)) < 32) {
      const eaten = evAt(e, 1)
      for (const pl of range(4)) {
        const pc = vec2(floor(pelletPos(f, pl) / vec2(CW, CH)))
        if (dot(eaten, onehot(pl)) < 0.5 && pc.x == ci.x && pc.y == ci.y) {
          g = vec3(10, 16, smoothstep(0.2, 0.45, a) * (1 - smoothstep(6.5, 8, a)))
        }
      }
    }
  }

  // A faint ring where a koi rises to the surface (slots 6 to 11).
  for (const k of range(6)) {
    const f = evAt(k + 6, 0)
    const a = time - f.z
    if (f.w > 3.5 && a >= 0 && a < 1.3) {
      const rel = vec2(P - vec2(f.x, f.y))
      const dist = length(rel)
      const dir = vec2(rel / max(dist, 0.001))
      const hb = 0.5 * (abs(dir.x) * CW + abs(dir.y) * CH)
      if (abs(dist - (5 + 50 * a)) < hb) {
        g = vec3(dirGlyph(atan(dir.y, dir.x) + PI * 0.5), 0, 0.35 * (1 - a / 1.3))
      }
    }
  }

  // Lily pads and the lotus, drawn once a size.
  const pm = padMap.at(vec2(floor(ci.x / 2), ci.y))
  const odd = mod(ci.x, 2) > 0.5
  const pcode = odd ? pm.z : pm.x
  const pg = floor(pcode / 20 + 0.01)
  if (pg > 0.5) {
    g = vec3(pg, pcode - pg * 20, odd ? pm.w : pm.y)
  }
  return g
}

// Two letters a texel, side by side: glyph * 20 + color, then alpha, for each.
const cells = buffer({ scale: 1 / 12, float: 16, filter: 'nearest' }, p => {
  const a = cellGlyph(vec2(p.cell.x * 2, p.cell.y))
  const b = cellGlyph(vec2(p.cell.x * 2 + 1, p.cell.y))
  return vec4(a.x * 20 + a.y, a.z, b.x * 20 + b.y, b.z)
})

// ---------------------------------------------------------------- the picture

// Every letter drawn once as a distance field, 4 texels a point, side by side.
const atlas = buffer({ size: [18 * 24, 48], float: 16, filter: 'linear', once: true }, p => {
  const gid = floor(p.cell.x / 24)
  const lp = vec2((p.cell.x - gid * 24 + 0.5) / 4, (p.cell.y + 0.5) / 4)
  return vec4(strokeDist(gid, lp), 0, 0, 1)
})

function strokeDist(gid: number, lp: vec2): number {
  const gi = GLYPH.at(gid)
  let d = 100
  for (const j of range(4)) {
    const s = SEG.at(gi.x + j)
    const ring = abs(length(lp - vec2(s.x, s.y) * vec2(CW, CH)) - s.w * CW)
    const dot0 = s.x == s.z && s.y == s.w ? 0.4 : 0
    const line = segDist(lp, vec2(vec2(s.x, s.y) * vec2(CW, CH)), vec2(vec2(s.z, s.w) * vec2(CW, CH))) - dot0
    const dd = s.z < 0 ? ring : line
    d = j < gi.y ? min(d, dd) : d
  }
  return gid < 0.5 ? 100 : d
}

function glyphCov(gid: number, lp: vec2): number {
  const q = vec2(clamp(lp, vec2(0.2), vec2(CW - 0.2, CH - 0.2)) * 4)
  const d = atlas.sample(vec2((gid * 24 + q.x) / (18 * 24), q.y / 48)).x
  return clamp((0.62 - d) / px + 0.5, 0, 1)
}

export default shader({
  fps: 60,
  passes: [
    atlas,
    padMap,
    ev,
    koi,
    palb,
    trail,
    soft,
    ground,
    cells,
    picture(p => {
      const P = vec2(p.point)
      const gr = ground.sample(p.uv)
      let col = vec3(gr.x, gr.y, gr.z)
      const ci = vec2(floor(P / vec2(CW, CH)))
      const pair = cells.at(vec2(floor(ci.x / 2), ci.y))
      const odd = mod(ci.x, 2) > 0.5
      const code = odd ? pair.z : pair.x
      const alpha = odd ? pair.w : pair.y
      const gid = floor(code / 20 + 0.01)
      const cov = gid > 0.5 ? glyphCov(gid, vec2(P - ci * vec2(CW, CH))) : 0
      col = vec3(mix(col, pal(code - gid * 20), cov * alpha))
      return vec4(col, 1)
    }),
  ],
})
