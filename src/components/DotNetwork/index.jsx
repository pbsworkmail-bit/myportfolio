import { useEffect, useRef } from 'react'

// Logical canvas — fills the whole case card (no inner inset), 1240 / 789.
const W = 1240
const H = 789
const ACCENT = '#E33E30'  // site brand accent
const POOL = 72
const smooth = (p) => p * p * (3 - 2 * p) // smoothstep: ease-in-out

// Static dot field: an evenly spaced square grid, centred in the canvas. All
// geometry is in viewBox units, so the SVG scales the whole composition
// (spacing, dot size, margins) proportionally with the thumbnail. 10 columns x
// 7 rows, spread edge to edge with even margins; GAP (the row pitch) is the
// unit the network radii below are measured in.
const COLS = 10
const ROWS = 7
const MARGIN_GX = 140
const MARGIN_GY = 115
const GAP_X = (W - 2 * MARGIN_GX) / (COLS - 1)
const GAP = (H - 2 * MARGIN_GY) / (ROWS - 1)
// Black dot radius follows connection strength: strongest in layer 1, moderate in
// layer 2, then shrinking to the resting size of the background field.
const HERO_R = 24                // orange dot: the reference (100%) for every other size
const R_STRONG = HERO_R * 0.36   // layer-1 dots: 36% of the orange dot's diameter
const R_REST = HERO_R * 0.144     // floor size for the weakest dots

// Three radial layers around the orange dot, measured as true (Euclidean)
// distance so they hold in every direction, diagonals included. Connection
// strength is 1 through layer 1 (the 8 neighbours), MODERATE at layer 2 and WEAK
// at layer 3. Past layer 3 everything is invisible, with only a short eased
// falloff (shorter than the gap to the next ring) to avoid a hard cutoff.
const LAYER1 = GAP * 1.75
const LAYER2 = GAP * 2.45
const LAYER3 = GAP * 3.2
const FALLOFF = GAP * 0.2
const MODERATE = 0.6
const WEAK = 0.3
const LINE_MAX = 0.4      // line opacity at full strength
const LINE_MAX_W = 2.4      // line width (viewBox units) at full strength
const LINE_MIN_W = 0.8      // ...and for the weakest, outermost links
// Two cascaded low-pass filters give every opacity change an S-shaped
// (ease-in-out) response. Time constants in seconds.
const LINE_TAU = 0.18
const DOT_TAU = 0.24
const SNAP = 0.003
function buildDots() {
  const dots = []
  const x0 = MARGIN_GX
  const y0 = MARGIN_GY
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) dots.push([x0 + c * GAP_X, y0 + r * GAP])
  }
  return dots
}

// ── The orange dot: a small fish exploring its tank ─────────────────────────
// A continuous steering simulation (no fixed path, no loop). Heading turns
// smoothly under a wandering curvature, speed drifts between glide / burst /
// inspect moods, a slow-moving point of "interest" draws it across the whole
// canvas, and the edges are soft walls it steers away from well before contact.
const MARGIN_X = 150
const MARGIN_Y = 125
const WALL_ZONE = 175
const rand = (a, b) => a + Math.random() * (b - a)
const randn = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random())
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))

function createFish() {
  const f = {
    x: W / 2, y: H / 2, heading: rand(0, Math.PI * 2), omega: 0,
    speed: 130, targetSpeed: 130, speedTau: 0.6,
    wander: 0, mood: 1, curl: 1, moodT: 0, curlT: 0,
    goalX: W / 2, goalY: H / 2, goalT: 0,
  }
  f.step = (dt) => {
    // Speed mood: mostly gliding, sometimes a quick dart, sometimes a slow look.
    f.moodT -= dt
    if (f.moodT <= 0) {
      const r = Math.random()
      if (r < 0.2) { f.targetSpeed = rand(320, 460); f.moodT = rand(0.5, 1.3); f.speedTau = 0.2 }
      else if (r < 0.45) { f.targetSpeed = rand(36, 70); f.moodT = rand(1.4, 3.6); f.speedTau = 0.7 }
      else { f.targetSpeed = rand(100, 190); f.moodT = rand(2, 6); f.speedTau = 0.55 }
    }
    f.speed += (f.targetSpeed - f.speed) * (1 - Math.exp(-dt / f.speedTau))

    // Curvature mood: wide sweeps most of the time, tighter curiosity turns now and then.
    f.curlT -= dt
    if (f.curlT <= 0) { f.curl = Math.random() < 0.22 ? rand(1.8, 2.6) : rand(0.5, 1.1); f.curlT = rand(1.5, 5) }

    // Wandering turn rate: smooth Ornstein–Uhlenbeck noise.
    f.wander += (-f.wander / 1.2) * dt + 0.9 * Math.sqrt(dt) * randn()
    let want = f.wander * 0.55 * f.curl

    // A slow-moving point of interest pulls it gently across the canvas.
    f.goalT -= dt
    if (f.goalT <= 0) {
      f.goalX = rand(MARGIN_X + 60, W - MARGIN_X - 60)
      f.goalY = rand(MARGIN_Y + 60, H - MARGIN_Y - 60)
      f.goalT = rand(5, 12)
    }
    const toGoal = wrap(Math.atan2(f.goalY - f.y, f.goalX - f.x) - f.heading)
    want += toGoal * 0.28

    // Soft walls: steer inward, more firmly the closer it gets.
    const px = Math.max(0, (WALL_ZONE - (f.x - MARGIN_X)) / WALL_ZONE) ** 2
      - Math.max(0, (WALL_ZONE - (W - MARGIN_X - f.x)) / WALL_ZONE) ** 2
    const py = Math.max(0, (WALL_ZONE - (f.y - MARGIN_Y)) / WALL_ZONE) ** 2
      - Math.max(0, (WALL_ZONE - (H - MARGIN_Y - f.y)) / WALL_ZONE) ** 2
    const push = Math.hypot(px, py)
    if (push > 0.001) want += wrap(Math.atan2(py, px) - f.heading) * 6 * Math.min(1, push * 1.8)

    const lim = 2.4 + 2.4 * Math.min(1, push * 2)
    want = Math.max(-lim, Math.min(lim, want))
    f.omega += (want - f.omega) * (1 - Math.exp(-dt / 0.35)) // heading keeps its momentum
    f.heading += f.omega * dt
    const v = f.speed * (1 - 0.55 * Math.min(1, push * 1.5)) // eases off near a wall
    f.x += Math.cos(f.heading) * v * dt
    f.y += Math.sin(f.heading) * v * dt
    // Safety net only; the steering above keeps it well clear of these.
    f.x = Math.min(W - 60, Math.max(60, f.x))
    f.y = Math.min(H - 60, Math.max(60, f.y))
  }
  return f
}

const DOTS = buildDots()

export default function DotNetwork({ className, label }) {
  const dots = DOTS
  const svgRef = useRef(null)
  const heroRef = useRef(null)
  const dotRefs = useRef([])
  const lineRefs = useRef([])

  useEffect(() => {
    const svg = svgRef.current
    const hero = heroRef.current
    const lines = lineRefs.current
    const dotEls = dotRefs.current
    const n = dots.length
    // Per dot: target (from distance) -> two cascaded filters -> displayed value.
    const lineT = new Float32Array(n)
    const l1 = new Float32Array(n)
    const l2 = new Float32Array(n)
    const dotT = new Float32Array(n)
    const sizeT = new Float32Array(n)
    const z1 = new Float32Array(n)
    const z2 = new Float32Array(n)
    const radius = new Float32Array(n).fill(-1)
    const d1 = new Float32Array(n)
    const d2 = new Float32Array(n)
    const shown = new Float32Array(n).fill(-1)
    const slot = new Int16Array(n).fill(-1)
    const slotOwner = new Int16Array(POOL).fill(-1)

    const band = (d, a, b) => 1 - smooth(Math.min(1, Math.max(0, (d - a) / (b - a))))
    // Connection strength 0..1 from distance: strong -> moderate -> weak.
    const strength = (d) => {
      if (d <= LAYER1) return 1
      if (d <= LAYER2) return 1 - (1 - MODERATE) * smooth((d - LAYER1) / (LAYER2 - LAYER1))
      if (d <= LAYER3) return MODERATE - (MODERATE - WEAK) * smooth((d - LAYER2) / (LAYER3 - LAYER2))
      return WEAK
    }

    // Targets depend only on distance to the orange dot. Dot size, dot opacity,
    // line width and line opacity all follow the strength; nothing is shown
    // beyond layer 3.
    const aim = (px, py) => {
      for (let i = 0; i < n; i++) {
        const d = Math.hypot(dots[i][0] - px, dots[i][1] - py)
        const g = strength(d)
        const v = band(d, LAYER3, LAYER3 + FALLOFF)
        lineT[i] = g * v
        sizeT[i] = g
        dotT[i] = v * (0.45 + 0.55 * g)
      }
    }

    const assign = () => {
      for (let i = 0; i < n; i++) {
        if (lineT[i] > 0 && slot[i] < 0) {
          const s = slotOwner.indexOf(-1)
          if (s >= 0) { slotOwner[s] = i; slot[i] = s }
        }
      }
    }

    const draw = (px, py) => {
      hero.setAttribute('cx', px.toFixed(1))
      hero.setAttribute('cy', py.toFixed(1))
      for (let i = 0; i < n; i++) {
        const v = d2[i]
        if (Math.abs(v - shown[i]) > 0.002) {
          shown[i] = v
          dotEls[i].setAttribute('opacity', v.toFixed(3))
        }
        const r = R_REST + (R_STRONG - R_REST) * z2[i]
        if (Math.abs(r - radius[i]) > 0.01) {
          radius[i] = r
          dotEls[i].setAttribute('r', r.toFixed(2))
        }
      }
      for (let s = 0; s < POOL; s++) {
        const i = slotOwner[s]
        if (i < 0) continue
        const l = lines[s]
        if (l2[i] < SNAP && lineT[i] === 0) {
          slotOwner[s] = -1
          slot[i] = -1
          l.setAttribute('opacity', 0)
          continue
        }
        // Outgoing lines stay attached to the orange dot until invisible. Each
        // line runs edge to edge: it starts on the orange dot's rim and ends on
        // the rim of its (currently sized) black dot, never through a centre.
        const dx = dots[i][0] - px
        const dy = dots[i][1] - py
        const len = Math.hypot(dx, dy) || 1
        const ux = dx / len
        const uy = dy / len
        const rDot = R_REST + (R_STRONG - R_REST) * z2[i]
        if (len <= HERO_R + rDot + 1) { l.setAttribute('opacity', 0); continue }
        l.setAttribute('x1', (px + ux * HERO_R).toFixed(1))
        l.setAttribute('y1', (py + uy * HERO_R).toFixed(1))
        l.setAttribute('x2', (dots[i][0] - ux * rDot).toFixed(1))
        l.setAttribute('y2', (dots[i][1] - uy * rDot).toFixed(1))
        // Thickness and opacity both follow the connection strength.
        l.setAttribute('stroke-width', (LINE_MIN_W + (LINE_MAX_W - LINE_MIN_W) * l2[i]).toFixed(2))
        l.setAttribute('opacity', (l2[i] * LINE_MAX).toFixed(3))
      }
    }

    // First frame: everything already at its settled state.
    const fish = createFish()
    aim(fish.x, fish.y)
    for (let i = 0; i < n; i++) { l1[i] = l2[i] = lineT[i]; d1[i] = d2[i] = dotT[i]; z1[i] = z2[i] = sizeT[i] }
    assign()
    draw(fish.x, fish.y)

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    let last = 0
    let visible = true
    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      if (!last) last = now
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      // Movement first, in fixed sub-steps, independent of the network below.
      for (let r = dt; r > 0; r -= 1 / 120) fish.step(Math.min(r, 1 / 120))
      aim(fish.x, fish.y)
      assign()
      const kl = 1 - Math.exp(-dt / LINE_TAU)
      const kd = 1 - Math.exp(-dt / DOT_TAU)
      for (let i = 0; i < n; i++) {
        l1[i] += (lineT[i] - l1[i]) * kl
        l2[i] += (l1[i] - l2[i]) * kl
        d1[i] += (dotT[i] - d1[i]) * kd
        d2[i] += (d1[i] - d2[i]) * kd
        z1[i] += (sizeT[i] - z1[i]) * kd
        z2[i] += (z1[i] - z2[i]) * kd
      }
      draw(fish.x, fish.y)
    }
    const start = () => { if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame) } }
    const stop = () => { cancelAnimationFrame(raf); raf = 0 }
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop() })
    io.observe(svg)
    start()
    return () => { stop(); io.disconnect() }
  }, [dots])

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid slice"
    >
      {dots.map(([x, y], i) => (
        <circle
          key={i}
          ref={(el) => (dotRefs.current[i] = el)}
          cx={x.toFixed(1)}
          cy={y.toFixed(1)}
          r={R_REST}
          fill="#000"
          opacity="0"
        />
      ))}
      {Array.from({ length: POOL }, (_, s) => (
        <line
          key={s}
          ref={(el) => (lineRefs.current[s] = el)}
          stroke="#8a8a85"
          strokeWidth={LINE_MAX_W}
          opacity="0"
        />
      ))}
      <circle ref={heroRef} r={HERO_R} fill={ACCENT} />
    </svg>
  )
}
