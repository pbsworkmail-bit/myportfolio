// Reference-driven composition library — each generator returns a fixed
// set of target coordinates reconstructing one of five supplied reference
// illustrations (Halftone Shell, Monstera Leaf, Dandelion, Galaxy, Dotwork Flower) from
// precomputed, density-weighted point data (see illustrations.js and the
// offline sampling pipeline that produced it). Density in the source
// artwork — a dandelion's dense head vs its thin stem, a leaf's split
// scutes vs the gaps between them — is preserved by WHERE points were
// sampled, not by varying each point's weight at render time.
import {
  FEATHER_ASPECT, FEATHER_POINTS, FEATHER_WEIGHTS,
  LEAF_ASPECT, LEAF_POINTS, LEAF_WEIGHTS,
  DANDELION_ASPECT, DANDELION_POINTS, DANDELION_WEIGHTS,
  GALAXY_ASPECT, GALAXY_POINTS, GALAXY_WEIGHTS,
  BLOOM_ASPECT, BLOOM_POINTS, BLOOM_WEIGHTS,
} from './illustrations'

const SAFE_MARGIN = 0.06 // ~6% per side, within the requested 5–8% range
const CORE_TRIM = 0.03   // ignore the outer 3% of points per axis when sizing
const EDGE_PAD = 2       // px — hard clamp pad so nothing touches the canvas edge

// Each illustration's raw content bounding box (what the Python sampler
// cropped to) is a poor basis for sizing on its own: the whale's bbox is
// tall mostly because of its thin, sparse trailing dot-tail, and the
// bird's bbox is large mostly because of empty corners around its
// diagonal silhouette — fitting those raw boxes to the canvas makes the
// whale read far larger and the bird far smaller than they actually are,
// even though both fill the canvas "fully" in a bounding-box sense.
//
// This computes each illustration's *visual mass* instead: its centroid
// (center of gravity, for optical centering) and a trimmed-percentile
// core extent per axis (robust to a handful of outlying points, like the
// last few dots of that same whale tail, so they don't skew the scale).
//
// Points are stored normalized to their own content bbox (x: 0..1 across
// bboxW, y: 0..1 across bboxH) — those two 0..1 ranges are in DIFFERENT
// absolute units whenever bboxW≠bboxH, so x and y are only directly
// comparable after re-expressing x in units of bboxH too (x * aspect).
// Skipping that correction (an earlier version of this function did)
// silently treats a wide/flat illustration as square. Every stat and
// every rendered point below is computed in that aspect-corrected space.
function computeVisualStats(points, aspect) {
  const n = points.length / 2
  let sumX = 0, sumY = 0
  const xs = new Array(n)
  const ys = new Array(n)
  for (let i = 0; i < n; i++) {
    const x = points[i * 2] * aspect
    const y = points[i * 2 + 1]
    xs[i] = x; ys[i] = y
    sumX += x; sumY += y
  }
  xs.sort((a, b) => a - b)
  ys.sort((a, b) => a - b)

  const pct = (arr, p) => {
    const idx = Math.min(arr.length - 1, Math.max(0, Math.round(p * (arr.length - 1))))
    return arr[idx]
  }

  const coreW = Math.max(0.02, pct(xs, 1 - CORE_TRIM) - pct(xs, CORE_TRIM))
  const coreH = Math.max(0.02, pct(ys, 1 - CORE_TRIM) - pct(ys, CORE_TRIM))

  // Midpoint of the trimmed core extent — the geometric centre, as opposed
  // to the mass centroid (cx, cy). They differ a lot for lopsided drawings
  // like a flower on a long stem, whose mass sits at the petals.
  const mx = (pct(xs, 1 - CORE_TRIM) + pct(xs, CORE_TRIM)) / 2
  const my = (pct(ys, 1 - CORE_TRIM) + pct(ys, CORE_TRIM)) / 2
  // Midpoint of the FULL extent, sparse outliers included — for drawings
  // whose far-reaching thin threads are part of the silhouette.
  const fx = (xs[0] + xs[n - 1]) / 2
  const fy = (ys[0] + ys[n - 1]) / 2
  return { cx: sumX / n, cy: sumY / n, mx, my, fx, fy, coreW, coreH, aspect }
}

const STATS = {
  feather: computeVisualStats(FEATHER_POINTS, FEATHER_ASPECT),
  leaf: computeVisualStats(LEAF_POINTS, LEAF_ASPECT),
  dandelion: computeVisualStats(DANDELION_POINTS, DANDELION_ASPECT),
  galaxy: computeVisualStats(GALAXY_POINTS, GALAXY_ASPECT),
  bloom: computeVisualStats(BLOOM_POINTS, BLOOM_ASPECT),
}

// centerMix: 0 centres the drawing's mass centroid on the canvas (default),
// 1 centres its geometric extent instead — the trimmed core extent by
// default, or the full extent (centerOn: 'full') when sparse far-reaching
// threads are part of the silhouette.
function fitIllustration(points, stats, count, w, h, sizeFactor = 1, weights = null, centerMix = 0, centerOn = 'core') {
  const fillFrac = 1 - 2 * SAFE_MARGIN
  const canvasAspect = w / h
  const coreAspect = stats.coreW / stats.coreH

  const scale = (coreAspect >= canvasAspect
    ? (w * fillFrac) / stats.coreW
    : (h * fillFrac) / stats.coreH) * sizeFactor

  const cxPx = w / 2
  const cyPx = h / 2

  const midX = centerOn === 'full' ? stats.fx : stats.mx
  const midY = centerOn === 'full' ? stats.fy : stats.my
  const ccx = stats.cx + (midX - stats.cx) * centerMix
  const ccy = stats.cy + (midY - stats.cy) * centerMix
  const total = points.length / 2
  const n = Math.min(count, total)
  const pts = new Array(count)
  for (let i = 0; i < n; i++) {
    const x = points[i * 2] * stats.aspect
    const y = points[i * 2 + 1]
    pts[i] = {
      x: cxPx + (x - ccx) * scale,
      y: cyPx + (y - ccy) * scale,
    }
    // Optional per-target ink weight (see LEAF_WEIGHTS); absent = 1.
    if (weights) pts[i].w = weights[i]
  }
  // Only reached if the particle count ever exceeds the precomputed pool
  // size — thicken rather than scatter randomly, so an edge case still
  // reads as part of the illustration rather than as stray noise.
  for (let i = n; i < count; i++) {
    const src = pts[i % n]
    pts[i] = { x: src.x + (((i * 37) % 9) - 4), y: src.y + (((i * 53) % 9) - 4), w: src.w }
  }

  // Safety clamp: shrink (around the same centre) just enough that even
  // the trimmed-out outliers stay on-canvas — the core-mass fit above is
  // deliberately generous and can occasionally push a sparse straggler
  // past the edge.
  const halfW = w / 2 - EDGE_PAD
  const halfH = h / 2 - EDGE_PAD
  let factor = 1
  for (let i = 0; i < count; i++) {
    const dx = pts[i].x - cxPx
    const dy = pts[i].y - cyPx
    if (Math.abs(dx) > 1e-6) factor = Math.min(factor, halfW / Math.abs(dx))
    if (Math.abs(dy) > 1e-6) factor = Math.min(factor, halfH / Math.abs(dy))
  }
  if (factor < 1) {
    for (let i = 0; i < count; i++) {
      pts[i].x = cxPx + (pts[i].x - cxPx) * factor
      pts[i].y = cyPx + (pts[i].y - cyPx) * factor
    }
  }

  return pts
}

// How many particles a composition uses, given the shared pool size
// (`count`) and the long-standing per-breakpoint population (`baseCount`).
// The one original illustration (the whale) was sampled for baseCount particles —
// their point pools are too small to take more without thickening — so they
// keep exactly that many and the rest of the pool sits invisible during
// them (see engine.js). The leaf's, dandelion's and flower's stipples are dense enough to use the
// whole pool: that's where its tonal range and crisp splits come from.
const usesAll = (count) => count

export const COMPOSITIONS = [
  { name: 'feather', active: usesAll, generate: (count, w, h) => fitIllustration(FEATHER_POINTS, STATS.feather, count, w, h, 0.92, FEATHER_WEIGHTS, 1) },
  { name: 'leaf', active: usesAll, generate: (count, w, h) => fitIllustration(LEAF_POINTS, STATS.leaf, count, w, h, 1, LEAF_WEIGHTS) },
  // Smaller and extent-centred: the drifting seeds sit outside the trimmed core
  // extent, and the tall stem would otherwise run into the canvas edge.
  { name: 'dandelion', active: usesAll, generate: (count, w, h) => fitIllustration(DANDELION_POINTS, STATS.dandelion, count, w, h, 0.86, DANDELION_WEIGHTS, 1) },
  // Smaller and extent-centred: the long stem tip sits outside the trimmed
  // core extent (it would ride the canvas edge) and the petal-heavy mass
  // centroid sits low, which left the drawing top-heavy.
  { name: 'bloom', active: usesAll, generate: (count, w, h) => fitIllustration(BLOOM_POINTS, STATS.bloom, count, w, h, 0.64, BLOOM_WEIGHTS, 1) },
  // Extent-centred and slightly reduced: the far stars at the arm tips sit outside
  // the trimmed core extent.
  { name: 'galaxy', active: usesAll, generate: (count, w, h) => fitIllustration(GALAXY_POINTS, STATS.galaxy, count, w, h, 0.9, GALAXY_WEIGHTS, 1) },
]
