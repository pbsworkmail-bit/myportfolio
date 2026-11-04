// Seeded PRNG (mulberry32) — deterministic randomness for composition generation.
export function mulberry32(seed) {
  let a = seed >>> 0
  return function rand() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
]

function dot(g, x, y) {
  return g[0] * x + g[1] * y
}

const F2 = 0.5 * (Math.sqrt(3) - 1)
const G2 = (3 - Math.sqrt(3)) / 6

// Classic 2D simplex noise (Stefan Gustavson's public-domain algorithm),
// seeded via mulberry32 so each ParticleField instance gets an
// independent, reproducible permutation table without a dependency.
export class SimplexNoise {
  constructor(seed = 1) {
    const rand = mulberry32(seed)
    const p = new Uint8Array(256)
    for (let i = 0; i < 256; i++) p[i] = i
    for (let i = 255; i > 0; i--) {
      const n = Math.floor(rand() * (i + 1))
      const tmp = p[i]; p[i] = p[n]; p[n] = tmp
    }
    this.perm = new Uint8Array(512)
    this.permMod8 = new Uint8Array(512)
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255]
      this.permMod8[i] = this.perm[i] % 8
    }
  }

  noise2D(xin, yin) {
    const { perm, permMod8 } = this
    const s = (xin + yin) * F2
    const i = Math.floor(xin + s)
    const j = Math.floor(yin + s)
    const t = (i + j) * G2
    const X0 = i - t
    const Y0 = j - t
    const x0 = xin - X0
    const y0 = yin - Y0

    let i1, j1
    if (x0 > y0) { i1 = 1; j1 = 0 } else { i1 = 0; j1 = 1 }

    const x1 = x0 - i1 + G2
    const y1 = y0 - j1 + G2
    const x2 = x0 - 1 + 2 * G2
    const y2 = y0 - 1 + 2 * G2

    const ii = i & 255
    const jj = j & 255
    const gi0 = permMod8[ii + perm[jj]]
    const gi1 = permMod8[ii + i1 + perm[jj + j1]]
    const gi2 = permMod8[ii + 1 + perm[jj + 1]]

    let n0 = 0, n1 = 0, n2 = 0

    let t0 = 0.5 - x0 * x0 - y0 * y0
    if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * dot(GRAD2[gi0], x0, y0) }

    let t1 = 0.5 - x1 * x1 - y1 * y1
    if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * dot(GRAD2[gi1], x1, y1) }

    let t2 = 0.5 - x2 * x2 - y2 * y2
    if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * dot(GRAD2[gi2], x2, y2) }

    return 70 * (n0 + n1 + n2)
  }
}
