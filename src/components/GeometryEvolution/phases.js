// The six evolutionary phases. Each phase is `build(ctx) → update(t)`: it creates
// its own SVG nodes once, then `update` positions/reveals them as a pure function
// of the cycle time `t` (seconds). Geometry comes from geometry.js; this file only
// decides when things appear. Phases also drive the adaptive grid via `ctx.st`.
import {
  PHI, GOLDEN_ANGLE, S, HT, WD, X0, Y0, O, Q, R,
  lerp, clamp01, rot180, goldenDecompose, outwardArc, rotateArc, pole, poleConstruction,
  arcPath, circlePath, chainTools, bezPoint, f,
} from './geometry.js'
import { Path, Seg, Dot } from './dom.js'

export const CYCLE = 10 // seconds; the whole animation, reset included

const ease = (p) => 0.5 - 0.5 * Math.cos(Math.PI * p)
const win = (t, a, b) => ease(clamp01((t - a) / (b - a))) // eased 0→1 across [a, b]
const lin = (t, a, b) => clamp01((t - a) / (b - a))
const smooth = (p) => p * p * (3 - 2 * p)

// ── Scene geometry (computed once) ───────────────────────────────────────────
export const GD = goldenDecompose(9)
const POLE = poleConstruction(pole(GD)) // exact: foot of the perpendicular from corner B onto diagonal D–C
export const P = POLE.foot // the spiral's pole ("eye")
export const PT = rot180(P) // pole of the point-symmetric twin spiral
const TWIN = GD.arcs.map(rotateArc)
const OUT = outwardArc() // next arc outwards (radius φ·h): the spiral keeps growing beyond the rectangle
const OUT_T = rotateArc(OUT)
const CH = chainTools(GD.arcs)
const CH_T = chainTools(TWIN)

const TL = { x: X0, y: Y0 }, TR = { x: X0 + HT, y: Y0 }, BR = { x: X0 + HT, y: Y0 + HT }, BL = { x: X0, y: Y0 + HT }
const RB = { x: X0 + WD, y: Y0 } // golden-rectangle corner B
const E_ = { x: X0 + HT, y: O.y }, E_T = rot180(E_) // east anchor of the circle, and its 180° twin
const CARD = [{ x: O.x, y: Y0 }, { x: X0 + HT, y: O.y }, { x: O.x, y: Y0 + HT }, { x: X0, y: O.y }] // circle ∩ axes

// Distances from the pole to the spiral's arc end-points: each is the previous one / φ.
const ENDS = [GD.arcs[0].s, ...GD.arcs.map((a) => a.e)]
const RHO = ENDS.map((p) => Math.hypot(p.x - P.x, p.y - P.y))
const ENDS_T = ENDS.map(rot180)

// Vogel (sunflower) field: golden-angle phyllotaxis, n-th seed at r = c·√n, θ = n·137.5°.
function vogel(n, radius, centre) {
  const c = radius / Math.sqrt(n)
  return Array.from({ length: n }, (_, i) => {
    const r = c * Math.sqrt(i + 0.5)
    const th = i * GOLDEN_ANGLE
    return { x: centre.x + r * Math.cos(th), y: centre.y + r * Math.sin(th), rel: r / radius }
  })
}

const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v) }

// ── Phase 01 — Foundation (0–1.5 s) ──────────────────────────────────────────
// Axes draw outwards from the origin, the fine grid brightens in a wave, dots
// emerge at selected intersections and the anchor points of the first square and
// circle become prominent.
export function foundation(ctx) {
  const { L, styles: s, st, fx, grid } = ctx
  const field = []
  for (let kx = -10; kx <= 16; kx++) {
    for (let ky = -9; ky <= 9; ky++) {
      if ((((kx + 2 * ky) % 4) + 4) % 4 !== 0) continue
      const bx = O.x + S * kx, by = O.y + S * ky
      if (bx < 30 || bx > 1210 || by < 30 || by > 759) continue
      const d = new Dot(L.dots, s.dotSoft, 1.35, 0.55, bx, by)
      ctx.dots.push(d)
      field.push({ kx, ky, rank: hash(kx, ky), t0: 0.45 + 0.9 * clamp01(Math.hypot(bx - O.x, by - O.y) / 650), d })
    }
  }

  // Anchors: filled dot + hairline ring. Order of appearance = order in the construction.
  const anchors = [
    { p: O, t0: 0.85 },
    ...[TL, TR, BR, BL].map((p, i) => ({ p, t0: 1.0 + i * 0.07 })),
    ...CARD.map((p, i) => ({ p, t0: 1.2 + i * 0.07 })),
  ].map((a) => ({
    ...a,
    dot: new Dot(L.top, s.dot, 2.6, 1, a.p.x, a.p.y),
    ring: new Dot(L.top, s.ring, 5.5, 0.5, a.p.x, a.p.y),
  }))
  ctx.dots.push(...anchors.flatMap((a) => [a.dot, a.ring]))

  let lastKey = ''
  return (t) => {
    st.reveal = win(t, 0.05, 1.45)
    st.axisDraw = win(t, 0.15, 0.85)
    st.axisA = fx.grid * (1 - 0.55 * win(t, 3, 4))

    const key = `${st.golden.toFixed(4)}|${st.swirl.toFixed(4)}`
    const moved = key !== lastKey
    lastKey = key
    const vg = st.vogel
    for (const q of field) {
      const on = win(t, q.t0, q.t0 + 0.35) * fx.field * (q.rank <= ctx.density ? 1 : 0)
      if (on <= 0) { q.d.alpha(0); continue }
      if (moved || !q.placed) { const p = grid.warp(q.kx, q.ky); q.d.pos(p.x, p.y); q.x = p.x; q.y = p.y; q.placed = true }
      // Keep the poles and the Vogel fields clear of lattice dots.
      const near = Math.min(Math.hypot(q.x - P.x, q.y - P.y) / (ctx.vogelR[0] + 18), Math.hypot(q.x - PT.x, q.y - PT.y) / (ctx.vogelR[1] + 18))
      const clear = 1 - vg * (1 - smooth(clamp01((near - 0.9) / 0.1)))
      q.d.alpha(on * clear * (1 - 0.5 * st.dense))
    }
    for (const a of anchors) {
      const k = win(t, a.t0, a.t0 + 0.3) * fx.anchor
      a.dot.alpha(k)
      a.ring.alpha(k * (1 - 0.6 * win(t, a.t0 + 0.3, a.t0 + 0.9)))
    }
  }
}

// ── Phase 02 — Fundamental geometry (1.5–3 s) ────────────────────────────────
// Circle from radial points on the anchors, its radius/diameters, the square
// around it, the square stretching into the φ-rectangle, and the triangle that
// the diagonal cuts from it. Grid: half-step subdivisions + polar guides.
export function fundamental(ctx) {
  const { L, styles: s, st, fx } = ctx
  const circle = new Path(L.shape, s.shape, 0.85, circlePath(O.x, O.y, R))
  const half = new Path(L.guide, s.guide, 0.4, circlePath(O.x, O.y, R / 2))
  const square = new Path(L.shape, s.shape, 0.85, `M${f(TL.x)} ${f(TL.y)}H${f(TR.x)}V${f(BR.y)}H${f(BL.x)}Z`)
  const ext = new Path(L.shape, s.shape, 0.85)
  const tri = new Path(L.guide, s.fill, 0.035)
  const diag = new Seg(L.shape, s.shape, 0.85)
  const radius = new Seg(L.shape, s.shape, 0.9)
  const dia = [new Seg(L.guide, s.dashed, 0.5), new Seg(L.guide, s.dashed, 0.5)]
  // 12 radial points; the 4 at the axes are already anchors, the other 8 are new.
  const rays = []
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2
    const p = { x: O.x + R * Math.cos(a), y: O.y + R * Math.sin(a) }
    rays.push({ k, p, ray: k % 3 ? new Seg(L.guide, s.guide, 0.3) : null, dot: k % 3 ? new Dot(L.dots, s.dot, 1.9, 0.9, p.x, p.y) : null })
  }
  const cornerB = new Dot(L.top, s.dot, 2.6, 1)
  const cornerC = new Dot(L.top, s.dot, 2.6, 1)
  ctx.dots.push(cornerB, cornerC, ...rays.filter((r) => r.dot).map((r) => r.dot))

  return (t) => {
    st.sub = win(t, 1.7, 2.5) * (1 - 0.65 * win(t, 6.5, 7.5))
    const g = fx.guide * ctx.dimG

    // Circle: radial points claim the circle in order, then the stroke draws through them.
    const pc = win(t, 1.55, 2.2)
    circle.show(pc, fx.primary)
    for (const r of rays) {
      const on = clamp01((pc - r.k / 12) * 12)
      if (r.dot) r.dot.alpha(on * fx.anchor)
      if (r.ray) r.ray.show(O.x, O.y, r.p.x, r.p.y, win(t, 1.75 + r.k * 0.02, 2.3 + r.k * 0.02), on * g)
    }
    radius.show(O.x, O.y, O.x + R, O.y, win(t, 1.9, 2.3), fx.second)
    dia[0].show(O.x - R, O.y, O.x + R, O.y, win(t, 2.0, 2.45), g)
    dia[1].show(O.x, O.y - R, O.x, O.y + R, win(t, 2.05, 2.5), g)
    half.show(win(t, 2.1, 2.6), g)

    // Square around the circle, then stretched to the golden rectangle.
    square.show(win(t, 2.0, 2.5), fx.primary)
    const grow = win(t, 2.6, 3.05) // 0 → 1: width goes from h to φ·h
    const w = lerp(HT, WD, grow)
    if (grow > 0.001) ext.d(`M${f(TR.x)} ${f(Y0)}H${f(X0 + w)}V${f(Y0 + HT)}H${f(TR.x)}`)
    ext.show(grow > 0.001 ? 1 : 0, fx.primary)
    // Triangle: the diagonal cuts the (stretching) rectangle; its far corner tracks the growth.
    const cx = X0 + w
    diag.show(TL.x, TL.y, cx, Y0 + HT, win(t, 2.35, 2.7), fx.second)
    if (t > 2.35) tri.d(`M${f(TL.x)} ${f(TL.y)}L${f(cx)} ${f(Y0 + HT)}L${f(cx)} ${f(Y0)}Z`)
    tri.show(1, win(t, 2.55, 3.1) * fx.second)
    cornerB.pos(cx, Y0)
    cornerC.pos(cx, Y0 + HT)
    const kc = win(t, 2.6, 2.9) * fx.anchor
    cornerB.alpha(kc)
    cornerC.alpha(kc)
  }
}

// ── Phase 03 — Golden-ratio geometry (3–4.5 s) ───────────────────────────────
// The rectangle is subdivided into squares, each remainder a golden rectangle;
// the grid lines migrate onto those exact boundaries; the Fibonacci spiral is the
// chain of quarter-circles drawn in the squares. The pole is the foot of the
// perpendicular from corner B onto the diagonal.
export function golden(ctx) {
  const { L, styles: s, st, fx } = ctx
  const cuts = GD.squares.slice(1).map((sq, i) => {
    const n = i + 1
    // The edge a square shares with the remainder it was cut from.
    const e = sq.dir === 0 ? [[sq.x + sq.s, sq.y], [sq.x + sq.s, sq.y + sq.s]]
      : sq.dir === 1 ? [[sq.x, sq.y + sq.s], [sq.x + sq.s, sq.y + sq.s]]
        : sq.dir === 2 ? [[sq.x, sq.y], [sq.x, sq.y + sq.s]]
          : [[sq.x, sq.y], [sq.x + sq.s, sq.y]]
    return { n, e, seg: new Seg(L.shape, s.cut, 0.6) }
  })
  const alt = new Seg(L.guide, s.dashed, 0.55)
  const spiral = new Path(L.shape, s.spiral, 1, arcPath(GD.arcs))
  const eye = new Dot(L.top, s.accentDot, 5.5, 1, P.x, P.y)
  const eyeRing = new Dot(L.top, s.accentRing, 10, 0.7, P.x, P.y)
  ctx.dots.push(eye, eyeRing)

  return (t) => {
    st.golden = win(t, 3.0, 3.9) * fx.grid
    const g = fx.guide * ctx.dimG
    alt.show(RB.x, RB.y, P.x, P.y, win(t, 3.05, 3.5), g)
    for (const c of cuts) {
      const a = 3.2 + (c.n - 1) * 0.1
      c.seg.show(c.e[0][0], c.e[0][1], c.e[1][0], c.e[1][1], win(t, a, a + 0.25), fx.second)
    }
    const sp = win(t, 3.5, 4.5)
    spiral.show(CH.lengthFraction(sp), fx.primary)
    const k = win(t, 3.45, 3.75) * fx.anchor
    eye.alpha(k)
    eyeRing.alpha(k * (1 - 0.5 * win(t, 3.8, 4.4)))
  }
}

// ── Phase 04 — Curvature & fluidity (4.5–6.5 s) ──────────────────────────────
// The grid swirls around the spiral's poles, bending straight lines into curves.
// The quarter-arcs are shown as the cubic Béziers they are (κ = 0.5523 handles),
// the spiral keeps growing outwards by φ per turn, a point-symmetric twin spiral
// intersects the first, and dots stream along the paths.
export function curvature(ctx) {
  const { L, styles: s, st, fx } = ctx

  // Bézier anatomy of arcs 1–4: anchors S/E, handles to P1/P2, control points.
  const bez = GD.arcs.slice(1, 5).map((a, i) => ({
    i, b: a.bez,
    h1: new Seg(L.guide, s.handle, 0.55), h2: new Seg(L.guide, s.handle, 0.55),
    c1: new Dot(L.top, s.ring, 2.3, 0.8, a.bez[1].x, a.bez[1].y), c2: new Dot(L.top, s.ring, 2.3, 0.8, a.bez[2].x, a.bez[2].y),
    a0: new Dot(L.top, s.dot, 1.8, 0.9, a.bez[0].x, a.bez[0].y), a1: new Dot(L.top, s.dot, 1.8, 0.9, a.bez[3].x, a.bez[3].y),
  }))
  ctx.dots.push(...bez.flatMap((b) => [b.c1, b.c2, b.a0, b.a1]))

  // Outward arcs: from the spiral's start, along the same circle, until they leave the frame.
  const outPath = (a, twin) => {
    const sinT = clamp01((789 + 60 - a.cy) / a.r)
    const edge = Math.PI - Math.asin(sinT) // angle where the original arc crosses y = H + 60
    const th = twin ? edge + Math.PI : edge
    const ex = a.cx + a.r * Math.cos(th), ey = a.cy + a.r * Math.sin(th)
    return `M${f(a.e.x)} ${f(a.e.y)}A${f(a.r)} ${f(a.r)} 0 0 0 ${f(ex)} ${f(ey)}`
  }
  const outA = new Path(L.shape, s.spiral, 0.95, outPath(OUT, false))
  const outB = new Path(L.shape, s.twin, 0.6, outPath(OUT_T, true))
  const twin = new Path(L.shape, s.twin, 0.65, arcPath(TWIN))

  // Circles completing arcs 1–4 (intersecting circular relationships).
  const full = GD.arcs.slice(1, 5).map((a) => new Path(L.guide, s.guide, 0.3, circlePath(a.cx, a.cy, a.r)))

  // Symmetric Bézier between the two poles. Its handles run to the circle's east
  // anchor E and that anchor's 180° twin E′, so B(½) = (P′ + P)/8 + 3(E + E′)/8
  // lands exactly on Q, the centre of the rectangle.
  const sCurve = new Path(L.shape, s.twin, 0.6, `M${f(PT.x)} ${f(PT.y)}C${f(E_.x)} ${f(E_.y)} ${f(E_T.x)} ${f(E_T.y)} ${f(P.x)} ${f(P.y)}`)
  const sh = [new Seg(L.guide, s.handle, 0.55), new Seg(L.guide, s.handle, 0.55)]
  const sc = [new Dot(L.top, s.ring, 2.3, 0.8, E_.x, E_.y), new Dot(L.top, s.ring, 2.3, 0.8, E_T.x, E_T.y)]
  const node = new Dot(L.top, s.dot, 2.2, 0.9, Q.x, Q.y)
  const poleT = new Dot(L.top, s.dot, 2.6, 1, PT.x, PT.y)
  const poleTRing = new Dot(L.top, s.ring, 5.5, 0.5, PT.x, PT.y)
  ctx.dots.push(...sc, node, poleT, poleTRing)

  // Particle streams (arrive and dissolve into the poles).
  const stream = (n, start, len, gap) => Array.from({ length: n }, (_, i) => ({ t0: start + i * gap, len, dot: new Dot(L.dots, s.dot, 2.1, 1) }))
  const sMain = stream(6, 4.7, 1.5, 0.11)
  const sTwin = stream(5, 4.95, 1.4, 0.11)
  const sMid = stream(4, 5.4, 1.1, 0.12)
  const sOut = stream(3, 4.8, 0.8, 0.14)
  ctx.dots.push(...[...sMain, ...sTwin, ...sMid, ...sOut].map((q) => q.dot))
  const ride = (q, t, pos) => {
    const p = lin(t, q.t0, q.t0 + q.len)
    const k = Math.sin(Math.PI * Math.min(1, p * 1.0)) // fade in/out at the ends of the path
    if (p <= 0 || p >= 1 || k <= 0) { q.dot.alpha(0); return }
    const x = pos(ease(p))
    q.dot.pos(x.x, x.y)
    q.dot.alpha(Math.min(1, k * 2.2) * fx.second)
  }

  return (t) => {
    st.swirl = 0.85 * win(t, 4.6, 6.2) * fx.grid
    const g = fx.guide * ctx.dimG

    bez.forEach((b, i) => {
      const a = 4.55 + i * 0.2
      const on = win(t, a, a + 0.3) * (1 - win(t, 5.9 + i * 0.1, 6.4 + i * 0.1)) * g
      b.h1.show(b.b[0].x, b.b[0].y, b.b[1].x, b.b[1].y, win(t, a, a + 0.3), on)
      b.h2.show(b.b[3].x, b.b[3].y, b.b[2].x, b.b[2].y, win(t, a + 0.1, a + 0.4), on)
      for (const d of [b.c1, b.c2, b.a0, b.a1]) d.alpha(on)
    })

    outA.show(win(t, 4.6, 5.4), fx.primary)
    outB.show(win(t, 4.9, 5.7), fx.second)
    twin.show(CH_T.lengthFraction(win(t, 4.8, 5.9)), fx.second)
    full.forEach((c, i) => c.show(win(t, 5.2 + i * 0.15, 5.9 + i * 0.15), fx.guide * ctx.dimG))

    const sp = win(t, 5.5, 6.4)
    sCurve.show(sp, fx.second)
    const hs = win(t, 5.45, 5.9) * (1 - 0.5 * win(t, 6.4, 6.8)) * g
    sh[0].show(PT.x, PT.y, E_.x, E_.y, win(t, 5.45, 5.8), hs)
    sh[1].show(P.x, P.y, E_T.x, E_T.y, win(t, 5.45, 5.8), hs)
    sc[0].alpha(hs); sc[1].alpha(hs)
    node.alpha(win(t, 6.0, 6.3) * fx.anchor)
    const kt = win(t, 5.7, 6.0) * fx.anchor
    poleT.alpha(kt)
    poleTRing.alpha(kt * (1 - 0.5 * win(t, 6.1, 6.6)))

    for (const q of sMain) ride(q, t, (u) => CH.pointAt(u))
    for (const q of sTwin) ride(q, t, (u) => CH_T.pointAt(u))
    for (const q of sMid) ride(q, t, (u) => bezPoint([PT, E_, E_T, P], u))
    for (const q of sOut) ride(q, t, (u) => {
      const th = lerp(OUT.a1, OUT.a1 - 0.14, u) // out along the outward arc, towards the frame edge
      return { x: OUT.cx + OUT.r * Math.cos(th), y: OUT.cy + OUT.r * Math.sin(th) }
    })
  }
}

// ── Phase 05 — Structural complexity (6.5–8.5 s) ─────────────────────────────
// Log-polar coordinate systems around both poles (radii shrink by φ per ring, rays
// every 15°/30°), golden concentric rings in the first circle, golden-angle seed
// fields of variable density, and the polygons inscribed in the spirals — all built
// from anchors that already exist. The Cartesian grid keeps bending underneath.
export function complexity(ctx) {
  const { L, styles: s, st, fx } = ctx

  const ringsP = RHO.slice(1, 8).map((r, i) => new Path(L.guide, s.guide, i ? 0.32 : 0.22, circlePath(P.x, P.y, r)))
  const ringsT = RHO.slice(2, 7).map((r) => new Path(L.guide, s.guide, 0.2, circlePath(PT.x, PT.y, r)))
  const raysP = Array.from({ length: 24 }, (_, i) => ({ a: (i / 24) * Math.PI * 2, seg: new Seg(L.guide, s.guide, i % 6 ? 0.2 : 0.34) }))
  const raysT = Array.from({ length: 12 }, (_, i) => ({ a: (i / 12) * Math.PI * 2 + Math.PI / 12, seg: new Seg(L.guide, s.guide, 0.18) }))
  const golden = [1, 2, 3, 4].map((k) => new Path(L.guide, s.guide, 0.3, circlePath(O.x, O.y, R / Math.pow(PHI, k))))
  const polyP = new Path(L.guide, s.guide, 0.38, `M${ENDS.map((p) => `${f(p.x)} ${f(p.y)}`).join('L')}`)
  const polyT = new Path(L.guide, s.guide, 0.3, `M${ENDS_T.map((p) => `${f(p.x)} ${f(p.y)}`).join('L')}`)

  // Seed fields (sizes grow outwards; density falls outwards).
  const MAXN = [150, 96]
  const fields = [
    { c: P, n: MAXN[0], seeds: Array.from({ length: MAXN[0] }, () => new Dot(L.dots, s.dot, 1, 0.85)), pts: [] },
    { c: PT, n: MAXN[1], seeds: Array.from({ length: MAXN[1] }, () => new Dot(L.dots, s.dot, 1, 0.7)), pts: [] },
  ]
  ctx.dots.push(...fields.flatMap((fl) => fl.seeds))
  const layout = () => {
    fields.forEach((fl, k) => {
      const n = Math.max(24, Math.round(fl.n * ctx.density))
      fl.active = n
      fl.pts = vogel(n, ctx.vogelR[k], fl.c)
      fl.pts.forEach((p, i) => { fl.seeds[i].pos(p.x, p.y); fl.seeds[i].size(0.8 + 1.5 * p.rel) })
    })
  }
  ctx.relayout.push(layout)
  layout()

  const rays = (t, set, c, len, t0, g) => set.forEach((r, i) => {
    r.seg.show(c.x, c.y, c.x + len * Math.cos(r.a), c.y + len * Math.sin(r.a), win(t, t0 + i * 0.012, t0 + 0.5 + i * 0.012), g)
  })
  return (t) => {
    st.vogel = win(t, 6.7, 7.6) * fx.field
    st.dense = win(t, 6.5, 8.5) * (1 - win(t, 9.0, 9.9))
    const g = fx.guide * ctx.dimG

    ringsP.forEach((c, i) => c.show(win(t, 6.55 + i * 0.1, 7.2 + i * 0.1), g))
    ringsT.forEach((c, i) => c.show(win(t, 6.8 + i * 0.1, 7.45 + i * 0.1), g))
    rays(t, raysP, P, RHO[2], 6.7, g)
    rays(t, raysT, PT, RHO[3], 7.0, g)
    golden.forEach((c, i) => c.show(win(t, 6.6 + i * 0.13, 7.25 + i * 0.13), g))
    polyP.show(win(t, 7.1, 7.9), g)
    polyT.show(win(t, 7.3, 8.1), g)

    fields.forEach((fl, k) => {
      const t0 = k ? 6.95 : 6.75
      for (let i = 0; i < fl.seeds.length; i++) {
        if (i >= fl.active) { fl.seeds[i].alpha(0); continue }
        const u = i / fl.active
        fl.seeds[i].alpha(win(t, t0 + u * 1.0, t0 + u * 1.0 + 0.3) * fx.field)
      }
    })
  }
}

// ── Phase 06 — Final composition & reset (8.5–10 s) ──────────────────────────
// Settle (guides recede to faint traces, the curves stay), then dissolve layer by
// layer — guides, seeds, secondary curves, primary curves, anchors — while the
// grid relaxes to the plain Cartesian lattice. Nothing is morphed backwards: the
// composition simply fades out, and by t = 10 the state equals t = 0.
export function finale(ctx) {
  const { fx, st } = ctx
  return (t) => {
    fx.guide = 1 - win(t, 9.0, 9.45)
    fx.field = 1 - win(t, 9.1, 9.7)
    fx.second = 1 - win(t, 9.3, 9.75)
    fx.primary = 1 - win(t, 9.45, 9.9)
    fx.anchor = 1 - win(t, 9.55, 9.92)
    fx.grid = 1 - win(t, 9.2, 9.95)
    ctx.dimG = lerp(1, 0.6, win(t, 8.5, 9.0)) * ctx.guideScale // construction guides recede, leaving traces
    st.hold = fx.grid
  }
}
