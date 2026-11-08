// Assembles the scene and the animation controller: builds every phase once, then
// `render(t)` evaluates the whole drawing as a pure function of cycle time.
import {
  O, X0, Y0, WD, HT, buildAxisMap, boundaryNodes, goldenBoundaries,
} from './geometry.js'
import { el } from './dom.js'
import { createGrid } from './grid.js'
import { CYCLE, GD, P, PT, foundation, fundamental, golden, curvature, complexity, finale } from './phases.js'

export { CYCLE }
// The animation plays once and holds on this frame (the finished golden-ratio
// construction, just as the spiral begins to extend). Later phases are not shown.
export const REST_T = 4.7

export function createScene(svg, styles) {
  const layer = () => el('g', {}, svg)
  const L = { grid: layer(), guide: layer(), shape: layer(), dots: layer(), top: layer() }

  // Shared control state. The phases write it; the grid reads it.
  const st = { reveal: 0, axisDraw: 0, axisA: 1, sub: 0, golden: 0, swirl: 0, vogel: 0, dense: 0, hold: 1 }
  // Per-layer fade multipliers; only the final phase moves them (the reset).
  const fx = { guide: 1, field: 1, second: 1, primary: 1, anchor: 1, grid: 1 }

  // The origin row/column stays pinned (the circle's centre lies on both axes), so
  // O is added to the golden boundaries before lines are assigned to them.
  const bounds = (axis, lo, hi, origin) =>
    [...goldenBoundaries(GD, axis, lo, hi, 14), origin].sort((a, b) => a - b).filter((v, i, a) => !i || v - a[i - 1] > 1)
  const mapX = buildAxisMap(O.x, boundaryNodes(O.x, bounds('x', X0, X0 + WD, O.x)), -14, 22)
  const mapY = buildAxisMap(O.y, boundaryNodes(O.y, bounds('y', Y0, Y0 + HT, O.y)), -14, 14)
  const grid = createGrid({
    layer: L.grid, styles, mapX, mapY, state: st,
    swirls: [{ x: P.x, y: P.y, sign: 1, radius: 300 }, { x: PT.x, y: PT.y, sign: 1, radius: 260 }],
  })

  const ctx = {
    L, styles, st, fx, grid,
    dots: [], // everything sized in screen pixels
    relayout: [], // callbacks run when the density changes
    density: 1, // 1 = full; lower on small thumbnails
    dimG: 1, // guide dimming in the final composition
    guideScale: 1, // construction guides are quieter on small thumbnails
    vogelR: [0, 0],
  }
  const RHO2 = Math.hypot(GD.arcs[2].e.x - P.x, GD.arcs[2].e.y - P.y)
  ctx.vogelR = [RHO2 * 0.95, RHO2 * 0.72]

  const updates = [foundation(ctx), fundamental(ctx), golden(ctx), curvature(ctx), complexity(ctx)]
  const reset = finale(ctx)

  let last = 0
  const scene = {
    render(t) {
      last = t
      reset(t)
      for (const u of updates) u(t)
      grid.render(st)
    },
    // Called with the rendered width in CSS px. Stroke weights and dot sizes are
    // specified in screen pixels, so they stay crisp whatever the card size; dot
    // density is reduced on small thumbnails rather than just shrinking everything.
    resize(cssWidth) {
      const w = Math.max(160, cssWidth)
      const u = 1240 / w
      svg.style.setProperty('--u', u.toFixed(4))
      const density = w < 360 ? 0.5 : w < 560 ? 0.72 : 1
      for (const d of ctx.dots) d.resize(u)
      ctx.guideScale = 0.3 + 0.7 * density
      if (density !== ctx.density) { ctx.density = density; ctx.relayout.forEach((fn) => fn()) }
      scene.render(last)
    },
    destroy() { svg.replaceChildren() },
  }
  return scene
}
