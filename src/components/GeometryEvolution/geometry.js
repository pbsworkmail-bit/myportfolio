// Pure geometry for "Evolution of Geometry". No DOM, no timing: everything here
// is a deterministic function of the layout constants, so the animation layer
// only decides *when* things appear, never *where* they are.

export const W = 1240
export const H = 789 // same aspect as the case-card frame (1240 / 789)

export const PHI = (1 + Math.sqrt(5)) / 2 // 1.6180339887…
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)) // 137.5077…°, in radians
export const KAPPA = 0.5522847498307936 // cubic-Bézier handle length / radius for a quarter circle

// ── Layout ───────────────────────────────────────────────────────────────────
// One lattice unit S. The first square is 10 x 10 units, so the golden rectangle
// is 10 x 10φ units, centred in the frame. The origin O is the centre of that
// first square (and of the circle inscribed in it), so the square, its circle
// and their anchor points all sit exactly on lattice intersections.
export const S = 52
export const HT = 10 * S
export const WD = HT * PHI
export const X0 = (W - WD) / 2
export const Y0 = (H - HT) / 2
export const O = { x: X0 + HT / 2, y: Y0 + HT / 2 }
export const Q = { x: X0 + WD / 2, y: Y0 + HT / 2 } // centre of the golden rectangle
export const R = HT / 2 // circle radius (= 5 lattice units)

export const lerp = (a, b, t) => a + (b - a) * t
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const rot180 = (p) => ({ x: 2 * Q.x - p.x, y: 2 * Q.y - p.y })
export const f = (v) => (Math.round(v * 10) / 10).toString()

// ── Golden-ratio subdivision ─────────────────────────────────────────────────
// Repeatedly cut the largest possible square off a golden rectangle; what is left
// is again a golden rectangle, smaller by a factor of φ. The cuts go left, top,
// right, bottom, …, so the squares wind clockwise. Each square gets a quarter-
// circle arc (centre = one of its corners, radius = its side); chained together
// the arcs form the Fibonacci / golden spiral.
export function goldenDecompose(count) {
  const squares = []
  const rects = [{ x: X0, y: Y0, w: WD, h: HT }]
  let r = rects[0]
  for (let i = 0; i < count; i++) {
    const dir = i % 4
    let sq
    let next
    if (dir === 0) { const s = r.h; sq = { x: r.x, y: r.y, s }; next = { x: r.x + s, y: r.y, w: r.w - s, h: r.h } }
    else if (dir === 1) { const s = r.w; sq = { x: r.x, y: r.y, s }; next = { x: r.x, y: r.y + s, w: r.w, h: r.h - s } }
    else if (dir === 2) { const s = r.h; sq = { x: r.x + r.w - s, y: r.y, s }; next = { x: r.x, y: r.y, w: r.w - s, h: r.h } }
    else { const s = r.w; sq = { x: r.x, y: r.y + r.h - s, s }; next = { x: r.x, y: r.y, w: r.w, h: r.h - s } }
    sq.dir = dir
    squares.push(sq)
    rects.push(next)
    r = next
  }

  // Arcs: start where the previous arc ended; end on the diagonally opposite
  // corner of the square; the centre is the remaining corner that makes the turn
  // clockwise on screen (SVG sweep-flag 1).
  const arcs = []
  let start = { x: squares[0].x, y: squares[0].y + squares[0].s }
  for (const sq of squares) {
    const corners = [
      { x: sq.x, y: sq.y }, { x: sq.x + sq.s, y: sq.y },
      { x: sq.x + sq.s, y: sq.y + sq.s }, { x: sq.x, y: sq.y + sq.s },
    ]
    const end = { x: 2 * sq.x + sq.s - start.x, y: 2 * sq.y + sq.s - start.y } // opposite corner
    let centre = null
    for (const c of corners) {
      const isEnd = Math.abs(c.x - end.x) + Math.abs(c.y - end.y) < 1e-6
      const isStart = Math.abs(c.x - start.x) + Math.abs(c.y - start.y) < 1e-6
      if (isEnd || isStart) continue
      const a0 = Math.atan2(start.y - c.y, start.x - c.x)
      const a1 = Math.atan2(end.y - c.y, end.x - c.x)
      const d = (((a1 - a0) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
      if (Math.abs(d - Math.PI / 2) < 1e-6) { centre = c; break }
    }
    arcs.push(arcFrom(centre, sq.s, start, end))
    start = end
  }
  return { squares, rects, arcs }
}

// A quarter arc plus the exact cubic Bézier that represents it.
function arcFrom(c, r, s, e) {
  const a0 = Math.atan2(s.y - c.y, s.x - c.x)
  const a1 = a0 + Math.PI / 2
  const ts = { x: -Math.sin(a0), y: Math.cos(a0) } // tangent at start (clockwise)
  const te = { x: -Math.sin(a1), y: Math.cos(a1) } // tangent at end
  return {
    cx: c.x, cy: c.y, r, a0, a1, s, e,
    bez: [s, { x: s.x + KAPPA * r * ts.x, y: s.y + KAPPA * r * ts.y },
      { x: e.x - KAPPA * r * te.x, y: e.y - KAPPA * r * te.y }, e],
  }
}

// The next arc *outwards*: the square of side φ·h that would sit below the
// rectangle. Its arc ends exactly where the spiral begins, so the spiral simply
// keeps growing by φ per quarter turn beyond the golden rectangle.
export function outwardArc() {
  const s = { x: X0 + WD, y: Y0 + HT + WD }
  const e = { x: X0, y: Y0 + HT }
  return arcFrom({ x: X0 + WD, y: Y0 + HT }, WD, s, e)
}

export const rotateArc = (a) => {
  const c = rot180({ x: a.cx, y: a.cy })
  return { ...a, cx: c.x, cy: c.y, a0: a.a0 + Math.PI, a1: a.a1 + Math.PI, s: rot180(a.s), e: rot180(a.e), bez: a.bez.map(rot180) }
}

// Pole ("eye") of the spiral: the limit point of the nested golden rectangles.
export function pole(decomp) {
  const r = decomp.rects[decomp.rects.length - 1]
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

// Exact pole: in a golden rectangle, the foot of the perpendicular dropped from a
// corner onto the diagonal. Returns the corner, the diagonal ends and the foot.
export function poleConstruction(target) {
  const A = { x: X0, y: Y0 + HT }, B = { x: X0 + WD, y: Y0 }
  const D = { x: X0, y: Y0 }, C = { x: X0 + WD, y: Y0 + HT }
  const foot = (p, u, v) => {
    const dx = v.x - u.x, dy = v.y - u.y
    const t = ((p.x - u.x) * dx + (p.y - u.y) * dy) / (dx * dx + dy * dy)
    return { x: u.x + t * dx, y: u.y + t * dy }
  }
  const cands = [
    { corner: D, u: A, v: B }, { corner: C, u: A, v: B },
    { corner: A, u: D, v: C }, { corner: B, u: D, v: C },
  ]
  let best = null
  let bd = Infinity
  for (const c of cands) {
    const ft = foot(c.corner, c.u, c.v)
    const d = Math.hypot(ft.x - target.x, ft.y - target.y)
    if (d < bd) { bd = d; best = { ...c, foot: ft, err: d } }
  }
  return best
}

// ── Sampling helpers ─────────────────────────────────────────────────────────
export const arcPoint = (a, u) => {
  const ang = lerp(a.a0, a.a1, u)
  return { x: a.cx + a.r * Math.cos(ang), y: a.cy + a.r * Math.sin(ang) }
}
export const bezPoint = (b, u) => {
  const v = 1 - u
  const k0 = v * v * v, k1 = 3 * v * v * u, k2 = 3 * v * u * u, k3 = u * u * u
  return { x: k0 * b[0].x + k1 * b[1].x + k2 * b[2].x + k3 * b[3].x, y: k0 * b[0].y + k1 * b[1].y + k2 * b[2].y + k3 * b[3].y }
}
export const arcPath = (arcs) =>
  arcs.map((a, i) => `${i === 0 ? `M${f(a.s.x)} ${f(a.s.y)}` : ''}A${f(a.r)} ${f(a.r)} 0 0 1 ${f(a.e.x)} ${f(a.e.y)}`).join('')
export const circlePath = (cx, cy, r) =>
  `M${f(cx + r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 1 ${f(cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 1 ${f(cx + r)} ${f(cy)}`

// Progress along a chain of arcs where every arc takes the same share of time
// (so the small inner turns are not a blink). `lengthFraction` converts that
// time progress into the fraction of total arc length drawn.
export function chainTools(arcs) {
  const len = arcs.map((a) => (a.r * Math.PI) / 2)
  const total = len.reduce((x, y) => x + y, 0)
  const cum = [0]
  for (const l of len) cum.push(cum[cum.length - 1] + l / total)
  const n = arcs.length
  const seg = (p) => {
    const q = clamp01(p) * n
    const i = Math.min(n - 1, Math.floor(q))
    return [i, q - i]
  }
  return {
    lengthFraction: (p) => { const [i, u] = seg(p); return lerp(cum[i], cum[i + 1], u) },
    pointAt: (p) => { const [i, u] = seg(p); return arcPoint(arcs[i], u) },
  }
}

// ── Grid warps ───────────────────────────────────────────────────────────────
// Rotate a point about (cx, cy) by an angle that fades out with distance.
export function swirl(p, cx, cy, amp, radius) {
  if (!amp) return p
  const dx = p.x - cx, dy = p.y - cy
  const th = amp * Math.exp(-(dx * dx + dy * dy) / (radius * radius))
  const c = Math.cos(th), s = Math.sin(th)
  return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c }
}

// Turn golden-ratio boundaries into remap nodes: each boundary is claimed by the
// nearest free lattice line (in order), and the shift of the last one decays back
// to the plain lattice over the next few lines so nothing bunches up.
export function boundaryNodes(origin, bounds) {
  const nodes = []
  let prevK = -Infinity
  for (const b of bounds) {
    const k = Math.max(prevK + 1, Math.round((b - origin) / S))
    nodes.push([k, b])
    prevK = k
  }
  const [kL, vL] = nodes[nodes.length - 1]
  const shift = vL - (origin + S * kL)
  const TAIL = 6
  for (let i = 1; i <= TAIL; i++) nodes.push([kL + i, origin + S * (kL + i) + shift * (1 - i / TAIL)])
  return nodes
}

// Piecewise-linear remap of lattice index → coordinate, used to pull ordinary
// grid lines onto the golden-ratio boundaries. `nodes` = [[index, coordinate], …]
// ascending in both; outside the nodes the lattice is left untouched. A forward
// pass keeps a minimum gap so lines never cross.
export function buildAxisMap(origin, nodes, kMin, kMax) {
  const base = (k) => origin + S * k
  const tgt = new Map()
  for (let k = kMin; k <= kMax; k++) {
    let v = base(k)
    for (let i = 0; i < nodes.length - 1; i++) {
      const [k0, v0] = nodes[i], [k1, v1] = nodes[i + 1]
      if (k >= k0 && k <= k1) { v = lerp(v0, v1, (k - k0) / (k1 - k0)); break }
    }
    tgt.set(k, v)
  }
  for (let k = kMin + 1; k <= kMax; k++) if (tgt.get(k) < tgt.get(k - 1) + 5) tgt.set(k, tgt.get(k - 1) + 5)
  return (kf) => {
    const k0 = Math.floor(kf)
    const a = tgt.get(k0) ?? base(k0)
    const b = tgt.get(k0 + 1) ?? base(k0 + 1)
    return lerp(a, b, kf - k0)
  }
}

// Boundaries (sorted, ≥ minGap apart) contributed by the golden squares.
export function goldenBoundaries(decomp, axis, lo, hi, minGap) {
  const vals = []
  for (const sq of decomp.squares) {
    const a = axis === 'x' ? sq.x : sq.y
    vals.push(a, a + sq.s)
  }
  vals.sort((p, q) => p - q)
  const out = []
  for (const v of vals) {
    if (v < lo - 1e-6 || v > hi + 1e-6) continue
    if (!out.length || v - out[out.length - 1] >= minGap) out.push(v)
  }
  return out
}
