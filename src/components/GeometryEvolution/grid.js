// The adaptive background grid.
//
// Every grid line is a polyline sampled from the lattice and pushed through one
// warp, so the grid is a living part of the drawing rather than a backdrop:
//
//   lattice (kx, ky)
//     → golden remap  : lines migrate onto the golden-ratio square boundaries
//     → swirl(s)      : straight lines bend into curves around the spiral poles
//
// The warp is controlled by a handful of scalars in `state` that the animation
// phases drive. With every scalar at 0 the grid is the plain Cartesian lattice,
// which is exactly the state at the start and end of each cycle.
import { S, O, lerp, clamp01, f, swirl } from './geometry.js'
import { Item, Path, el } from './dom.js'

const KX0 = -10, KX1 = 16 // lattice index range that covers the frame (plus a margin)
const KY0 = -9, KY1 = 9
const STEP = 0.5 // sampling step along a line, in lattice units
const REST = 0.5 // resting brightness of the grid between cycles (fraction of full)
const smooth = (p) => p * p * (3 - 2 * p)

export function createGrid({ layer, styles, mapX, mapY, swirls, state }) {
  const lines = []
  const add = (vertical, k, a, b, sub) => {
    const node = el('path', { class: sub ? styles.minor : styles.grid }, layer)
    lines.push({ vertical, k, a, b, sub, dist: Math.abs(k) * S, item: new Item(node, 0.14) })
  }
  for (let k = KX0; k <= KX1; k++) add(true, k, KY0, KY1, false)
  for (let k = KY0; k <= KY1; k++) add(false, k, KX0, KX1, false)
  // Half-step subdivision lines, local to the first square (and its circle).
  for (let i = -5; i < 5; i++) { add(true, i + 0.5, -5, 5, true); add(false, i + 0.5, -5, 5, true) }

  // Emphasised axes: the two lattice lines through the origin, drawn outwards
  // from O in both directions (so they can "grow" and still follow the warp).
  const axes = [0, 1, 2, 3].map(() => new Path(layer, styles.axis, 0.5))

  const warp = (kx, ky) => {
    let p = {
      x: lerp(O.x + S * kx, mapX(kx), state.golden),
      y: lerp(O.y + S * ky, mapY(ky), state.golden),
    }
    for (const sw of swirls) p = swirl(p, sw.x, sw.y, state.swirl * sw.sign, sw.radius)
    return p
  }

  const polyline = (vertical, k, a, b, bent) => {
    if (!bent) {
      const p0 = vertical ? warp(k, a) : warp(a, k)
      const p1 = vertical ? warp(k, b) : warp(b, k)
      return `M${f(p0.x)} ${f(p0.y)}L${f(p1.x)} ${f(p1.y)}`
    }
    let d = ''
    for (let s = a; s <= b + 1e-9; s += STEP) {
      const p = vertical ? warp(k, s) : warp(s, k)
      d += `${d ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`
    }
    return d
  }

  // Samples of one axis line split at the origin: [outwards-positive, outwards-negative].
  const halves = (vertical, bent) => {
    const k0 = vertical ? KY0 : KX0, k1 = vertical ? KY1 : KX1
    let pos = '', neg = ''
    if (!bent) {
      const o = warp(0, 0)
      const e1 = vertical ? warp(0, k1) : warp(k1, 0)
      const e0 = vertical ? warp(0, k0) : warp(k0, 0)
      return [`M${f(o.x)} ${f(o.y)}L${f(e1.x)} ${f(e1.y)}`, `M${f(o.x)} ${f(o.y)}L${f(e0.x)} ${f(e0.y)}`]
    }
    for (let s = 0; s <= k1 + 1e-9; s += STEP) { const p = vertical ? warp(0, s) : warp(s, 0); pos += `${pos ? 'L' : 'M'}${f(p.x)} ${f(p.y)}` }
    for (let s = 0; s >= k0 - 1e-9; s -= STEP) { const p = vertical ? warp(0, s) : warp(s, 0); neg += `${neg ? 'L' : 'M'}${f(p.x)} ${f(p.y)}` }
    return [pos, neg]
  }

  const maxDist = Math.max(KX1 * S, -KX0 * S, KY1 * S) + 4 * S

  return {
    // Position of a lattice point under the current warp (for dots that ride the grid).
    warp: (kx, ky) => warp(kx, ky),

    render(st) {
      const bent = Math.abs(st.swirl) > 1e-4
      const key = `${st.golden.toFixed(4)}|${st.swirl.toFixed(4)}`
      const reach = st.reveal * (maxDist + 3 * S)

      for (const L of lines) {
        const it = L.item
        let a
        if (L.sub) {
          // Half-step lines appear outwards from the origin, with the circle.
          a = clamp01(st.sub * 1.7 - (L.dist / (5 * S)) * 0.7) * st.hold * (1 - 0.6 * st.dense)
        } else {
          const wave = smooth(clamp01((reach - L.dist) / (3 * S)))
          a = (REST + (1 - REST) * wave * st.hold) * (1 - 0.35 * st.dense)
        }
        it.alpha(a)
        if (a > 0 && L.sig !== key) { it.attr('d', polyline(L.vertical, L.k, L.a, L.b, bent)); L.sig = key }
      }

      // Axes
      const [xp, xn] = halves(false, bent)
      const [yp, yn] = halves(true, bent)
      const dr = st.axisDraw
      const aa = st.axisA
      axes[0].d(xp); axes[1].d(xn); axes[2].d(yp); axes[3].d(yn)
      for (const ax of axes) ax.show(dr, aa)
    },
  }
}
