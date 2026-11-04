// Reference-driven composition library — each generator returns a fixed
// set of target coordinates reconstructing one of five supplied reference
// illustrations (Turtle, Flower, Bird, Whale, Milky Way Galaxy) from
// precomputed, density-weighted point data (see illustrations.js and the
// offline sampling pipeline that produced it). Density in the source
// artwork — a bird's solid body vs its fading wingtip, a turtle's shell
// scutes vs the gaps between them — is preserved by WHERE points were
// sampled, not by varying each point's weight at render time.
import {
  TURTLE_ASPECT, TURTLE_POINTS,
  FLOWER_ASPECT, FLOWER_POINTS,
  BIRD_ASPECT, BIRD_POINTS,
  WHALE_ASPECT, WHALE_POINTS,
  GALAXY_ASPECT, GALAXY_POINTS,
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

  return { cx: sumX / n, cy: sumY / n, coreW, coreH, aspect }
}

const STATS = {
  turtle: computeVisualStats(TURTLE_POINTS, TURTLE_ASPECT),
  flower: computeVisualStats(FLOWER_POINTS, FLOWER_ASPECT),
  bird: computeVisualStats(BIRD_POINTS, BIRD_ASPECT),
  whale: computeVisualStats(WHALE_POINTS, WHALE_ASPECT),
  galaxy: computeVisualStats(GALAXY_POINTS, GALAXY_ASPECT),
}

function fitIllustration(points, stats, count, w, h) {
  const fillFrac = 1 - 2 * SAFE_MARGIN
  const canvasAspect = w / h
  const coreAspect = stats.coreW / stats.coreH

  const scale = coreAspect >= canvasAspect
    ? (w * fillFrac) / stats.coreW
    : (h * fillFrac) / stats.coreH

  const cxPx = w / 2
  const cyPx = h / 2

  const total = points.length / 2
  const n = Math.min(count, total)
  const pts = new Array(count)
  for (let i = 0; i < n; i++) {
    const x = points[i * 2] * stats.aspect
    const y = points[i * 2 + 1]
    pts[i] = {
      x: cxPx + (x - stats.cx) * scale,
      y: cyPx + (y - stats.cy) * scale,
    }
  }
  // Only reached if the particle count ever exceeds the precomputed pool
  // size — thicken rather than scatter randomly, so an edge case still
  // reads as part of the illustration rather than as stray noise.
  for (let i = n; i < count; i++) {
    const src = pts[i % n]
    pts[i] = { x: src.x + (((i * 37) % 9) - 4), y: src.y + (((i * 53) % 9) - 4) }
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

export const COMPOSITIONS = [
  { name: 'turtle', generate: (count, w, h) => fitIllustration(TURTLE_POINTS, STATS.turtle, count, w, h) },
  { name: 'flower', generate: (count, w, h) => fitIllustration(FLOWER_POINTS, STATS.flower, count, w, h) },
  { name: 'bird', generate: (count, w, h) => fitIllustration(BIRD_POINTS, STATS.bird, count, w, h) },
  { name: 'whale', generate: (count, w, h) => fitIllustration(WHALE_POINTS, STATS.whale, count, w, h) },
  { name: 'galaxy', generate: (count, w, h) => fitIllustration(GALAXY_POINTS, STATS.galaxy, count, w, h) },
]
