// Particle-to-target assignment — a true Hungarian algorithm is O(n^3),
// too costly to re-run on every composition change for this particle
// count. Instead this uses a spatially-bucketed greedy nearest-neighbour
// match: each particle claims the closest still-unclaimed target to its
// *current* position, searched outward ring-by-ring through a uniform
// grid. This keeps total displacement low (particles mostly hand off to
// nearby destinations) in roughly O(n) time, which is what preserves
// particle identity/continuity across a transition without a per-frame
// cost.
export function assignTargets(particles, targets) {
  const n = Math.min(particles.length, targets.length)
  if (n === 0) return

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const t of targets) {
    if (t.x < minX) minX = t.x
    if (t.x > maxX) maxX = t.x
    if (t.y < minY) minY = t.y
    if (t.y > maxY) maxY = t.y
  }
  const boxW = Math.max(1, maxX - minX)
  const boxH = Math.max(1, maxY - minY)
  const cellSize = Math.max(8, Math.sqrt((boxW * boxH) / Math.max(1, targets.length)) * 1.4)
  const cols = Math.max(1, Math.ceil(boxW / cellSize) + 1)
  const rows = Math.max(1, Math.ceil(boxH / cellSize) + 1)

  const cellOf = (x, y) => {
    const cx = Math.min(cols - 1, Math.max(0, Math.floor((x - minX) / cellSize)))
    const cy = Math.min(rows - 1, Math.max(0, Math.floor((y - minY) / cellSize)))
    return [cx, cy]
  }
  const key = (cx, cy) => cy * cols + cx

  const grid = new Map()
  for (let i = 0; i < targets.length; i++) {
    const [cx, cy] = cellOf(targets[i].x, targets[i].y)
    const k = key(cx, cy)
    let bucket = grid.get(k)
    if (!bucket) { bucket = []; grid.set(k, bucket) }
    bucket.push(i)
  }

  const claimed = new Uint8Array(targets.length)
  const maxRadius = cols + rows

  for (let pi = 0; pi < particles.length; pi++) {
    const p = particles[pi]
    const [pcx, pcy] = cellOf(clamp(p.x, minX, maxX), clamp(p.y, minY, maxY))

    let best = -1
    let bestDist = Infinity

    for (let radius = 0; radius <= maxRadius; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue
          const cx = pcx + dx
          const cy = pcy + dy
          if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue
          const bucket = grid.get(key(cx, cy))
          if (!bucket) continue
          for (const ti of bucket) {
            if (claimed[ti]) continue
            const ddx = targets[ti].x - p.x
            const ddy = targets[ti].y - p.y
            const d = ddx * ddx + ddy * ddy
            if (d < bestDist) { bestDist = d; best = ti }
          }
        }
      }
      // Found a candidate this ring — one more ring guards against a
      // nearer point just across a cell boundary, then stop expanding.
      if (best !== -1) {
        radius++
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dy = -radius; dy <= radius; dy++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue
            const cx = pcx + dx
            const cy = pcy + dy
            if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue
            const bucket = grid.get(key(cx, cy))
            if (!bucket) continue
            for (const ti of bucket) {
              if (claimed[ti]) continue
              const ddx = targets[ti].x - p.x
              const ddy = targets[ti].y - p.y
              const d = ddx * ddx + ddy * ddy
              if (d < bestDist) { bestDist = d; best = ti }
            }
          }
        }
        break
      }
    }

    if (best !== -1) {
      claimed[best] = 1
      p.tx = targets[best].x
      p.ty = targets[best].y
    }
  }

  if (particles.length > targets.length) {
    for (let i = targets.length; i < particles.length; i++) {
      const t = targets[i % targets.length]
      particles[i].tx = t.x
      particles[i].ty = t.y
    }
  }
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}
