import { SimplexNoise, mulberry32 } from './noise'
import { assignTargets } from './mapping'
import { COMPOSITIONS } from './compositions'
import { easeInOutCubic, lerp } from './easing'

const PHASE = { CHAOS: 'chaos', TRANSITION: 'transition', HOLD: 'hold' }

// Choreography timing (ms) — the single place to retune the sequence's
// pacing. `hold` is the pause once a pattern has finished forming, before
// the next transition begins; it is independent of `transition`, which is
// how long the formation/transition animation itself takes to settle.
export const TIMING = {
  // 0 by design: the scattered initial layout (see _initParticles) IS
  // the chaos state — it's a starting frame, not a phase to sit in. The
  // very first update() tick ends this phase immediately and moves into
  // `firstFormation`, whose own ease-in-out start (zero velocity at
  // t=0) is what reads as a natural launch rather than a frozen hold.
  chaos: 0,
  firstFormation: 1800,   // transition duration for the very first pattern — deliberately
                          // quicker/more decisive than `transition` to kick the sequence
                          // off with energy; same easing + wobble code path, just compressed
  transition: 3400,       // transition duration between all later patterns
  hold: 800,              // pause on a completed pattern before the next transition starts
}

// Chaos-phase wander only (unchanged) — a soft spring chasing a
// noise-jittered near-self target, which is what gives the initial
// disordered state its gentle, non-mechanical drift.
const SPRING_STIFFNESS = 0.052
const SPRING_DAMPING = 0.86

// Transition motion — deliberately NOT a spring. A spring chasing a
// moving/offset target is what produced the bounce/overshoot between
// patterns. Instead, transitions interpolate directly from a captured
// start position to the target using a non-overshooting ease (velocity
// is zero at both ends, so there is nothing to bounce).
const TRANSITION_EASE = easeInOutCubic

// Both the hold's "breathing" and the transition's flow wobble are the
// *same* continuous noise signal (see microOffset) — only its amplitude
// envelope differs. The envelope uses smoothBump, which is zero AND has
// zero slope at both ends of its 0..1 input: that means the amplitude
// itself never jumps or kinks at a hold↔transition boundary, so the
// micro-movement reads as one unbroken motion threading through the
// whole cycle rather than resetting each time the phase changes.
const FLOW_WOBBLE_FACTOR = 0.018 // fraction of min(width,height) — transition peak

// Hold micro-movement — intentionally NOT one global amplitude shared by
// every particle (that's what made the whole field swell and recede
// together, i.e. "breathe" in sync, which read as spring-like even
// though no spring was involved). Instead each particle gets its own
// amplitude and speed (assigned once in _initParticles), so at any given
// moment different particles are at different points in their own
// motion — independent, not synchronized.
const HOLD_AMP_MIN = 0.0035 // fraction of min(width,height)
const HOLD_AMP_RANGE = 0.0065
const HOLD_SPEED_MIN = 0.6
const HOLD_SPEED_RANGE = 0.8
const HOLD_RAMP_IN = 220 // ms — brief shared fade-in only, so the hand-off from the
                         // transition's wobble (which ends at zero) has no visible pop;
                         // there is deliberately no matching ramp-down at hold's end —
                         // position continuity into the next transition comes from
                         // capturing sx/sy off the live rendered position, not from
                         // forcing amplitude back to zero first.

// A smooth bump: 0 at progress 0 and 1, smoothstep-eased up to a peak of
// 1 at progress 0.5, with zero derivative at both ends. Used for the
// transition's flow wobble only.
function smoothBump(progress) {
  const x = progress < 0.5 ? progress * 2 : (1 - progress) * 2
  const c = Math.min(1, Math.max(0, x))
  return c * c * c * (c * (c * 6 - 15) + 10)
}

// Quintic smoothstep 0→1, zero derivative at both ends.
function smoothStep(x) {
  const c = Math.min(1, Math.max(0, x))
  return c * c * c * (c * (c * 6 - 15) + 10)
}

// Two blended noise octaves (a slower dominant wave plus a smaller,
// faster ripple) read as more organic than a single-frequency signal.
// Each particle's own speed multiplier (p.microSpeed) staggers which
// point in the cycle it's at, on top of the phase offset already given
// by its unique nx/ny — two particles essentially never move in lockstep.
function microOffset(noise, p, t) {
  const tt = t * p.microSpeed
  const ox = noise.noise2D(p.nx + tt, p.ny) * 0.72 + noise.noise2D(p.nx * 1.8 + tt * 1.9, p.ny * 1.8) * 0.28
  const oy = noise.noise2D(p.nx, p.ny + tt) * 0.72 + noise.noise2D(p.nx * 1.8, p.ny * 1.8 + tt * 1.9) * 0.28
  return [ox, oy]
}

// Restrained accent — a fixed share of particles carry this colour
// instead of the base grayscale. Assigned once per particle at init
// (see _initParticles) and never reassigned, so identity is preserved
// across every subsequent transition — a particle that's red stays red.
const ACCENT_COLOR = '227, 62, 48' // #E33E30
const ACCENT_RATIO = 0.3

// Applied to the base size range below (both colours share the same
// range/scale — accent particles are never sized differently). The size
// draw itself (see _initParticles) is skewed toward the small end via a
// power curve on rng(), rather than a flat 0..1 spread, so most dots stay
// light and a few naturally read as emphasis rather than every dot
// competing for the same visual weight.
const SIZE_SCALE = 0.95

export class ParticleSystem {
  constructor({ width, height, count, color = '13, 13, 13', seed = 1 }) {
    this.width = width
    this.height = height
    this.count = count
    this.color = color
    this.rng = mulberry32(seed)
    this.noise = new SimplexNoise(seed)

    this.phase = PHASE.CHAOS
    this.phaseElapsed = 0
    this.phaseDuration = TIMING.chaos
    this.compIndex = 0
    this.cycleIndex = 0
    this.hasOrganized = false

    this.particles = []
    this._initParticles()
  }

  _initParticles() {
    const { width, height, count, rng } = this
    const minDim = Math.min(width, height)
    this.particles = []
    for (let i = 0; i < count; i++) {
      const x = rng() * width
      const y = rng() * height
      this.particles.push({
        id: i,
        x, y,
        sx: x, sy: y,
        tx: x, ty: y,
        vx: 0, vy: 0,
        size: (0.9 + Math.pow(rng(), 1.7) * 2.6) * SIZE_SCALE,
        opacity: 0.3 + rng() * 0.5,
        nx: rng() * 1000,
        ny: rng() * 1000,
        // Independent hold-motion character — different radius and pace
        // per particle, so the hold never reads as one synchronized pulse.
        microAmp: (HOLD_AMP_MIN + rng() * HOLD_AMP_RANGE) * minDim,
        microSpeed: HOLD_SPEED_MIN + rng() * HOLD_SPEED_RANGE,
        // Finalized below as an exact count, not sampled per-particle.
        isAccent: false,
      })
    }

    // Exactly ACCENT_RATIO of the population, not a per-particle coin
    // flip (which drifts from the target ratio at this population size).
    // Shuffle indices and flag the first slice — selection is unrelated
    // to each particle's (already random) position, so accent particles
    // land scattered throughout any composition rather than clustering,
    // while the 30:70 split itself is exact.
    const accentCount = Math.round(count * ACCENT_RATIO)
    const indices = this.particles.map((_, i) => i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const tmp = indices[i]; indices[i] = indices[j]; indices[j] = tmp
    }
    for (let k = 0; k < accentCount; k++) {
      this.particles[indices[k]].isAccent = true
    }
  }

  // Proportionally remap positions on resize so particles don't jump —
  // the composition itself is regenerated relative to the new box on
  // the next scheduled transition.
  resize(width, height) {
    if (width === this.width && height === this.height) return
    const sx = width / this.width
    const sy = height / this.height
    for (const p of this.particles) {
      p.x *= sx; p.y *= sy
      p.sx *= sx; p.sy *= sy
      p.tx *= sx; p.ty *= sy
    }
    this.width = width
    this.height = height
  }

  // Breakpoint crossed → particle population changes. Reseed cleanly
  // and re-enter a short chaos beat rather than trying to splice
  // particles in/out of an existing composition.
  setCount(count) {
    if (count === this.count) return
    this.count = count
    this._initParticles()
    this.phase = PHASE.CHAOS
    this.phaseElapsed = 0
    this.phaseDuration = 900
  }

  _nextComposition() {
    const defs = COMPOSITIONS
    const def = defs[this.compIndex % defs.length]
    const lapSeed = 1000 + this.cycleIndex * 97 + this.compIndex * 13
    const localRng = mulberry32(lapSeed)
    const targets = def.generate(this.count, this.width, this.height, localRng, this.noise)
    assignTargets(this.particles, targets)
    // Snapshot each particle's current position as the interpolation
    // start — the upcoming transition eases from here to tx/ty.
    for (const p of this.particles) {
      p.sx = p.x
      p.sy = p.y
    }
    this.compIndex++
    if (this.compIndex % defs.length === 0) this.cycleIndex++
  }

  // Render a settled composition immediately with no motion — used for
  // prefers-reduced-motion.
  showStatic() {
    this.hasOrganized = true
    this.phase = PHASE.HOLD
    this.phaseElapsed = 0
    this.phaseDuration = TIMING.hold
    this._nextComposition()
    for (const p of this.particles) {
      p.x = p.tx
      p.y = p.ty
      p.vx = 0
      p.vy = 0
    }
  }

  update(dt) {
    this.phaseElapsed += dt
    const t = performance.now() * 0.00015

    if (this.phase === PHASE.CHAOS && this.phaseElapsed >= this.phaseDuration) {
      this.hasOrganized = true
      this._nextComposition()
      this.phase = PHASE.TRANSITION
      this.phaseElapsed = 0
      this.phaseDuration = TIMING.firstFormation
    } else if (this.phase === PHASE.TRANSITION && this.phaseElapsed >= this.phaseDuration) {
      this.phase = PHASE.HOLD
      this.phaseElapsed = 0
      this.phaseDuration = TIMING.hold
    } else if (this.phase === PHASE.HOLD && this.phaseElapsed >= this.phaseDuration) {
      this._nextComposition()
      this.phase = PHASE.TRANSITION
      this.phaseElapsed = 0
      this.phaseDuration = TIMING.transition
    }

    if (this.phase === PHASE.CHAOS) {
      // Unchanged: a soft spring chasing a noise-jittered near-self
      // target — the initial disordered wander.
      const jitter = 7
      for (const p of this.particles) {
        const tx = p.x + this.noise.noise2D(p.nx + t, p.ny) * jitter
        const ty = p.y + this.noise.noise2D(p.nx, p.ny + t) * jitter
        p.vx = (p.vx + (tx - p.x) * SPRING_STIFFNESS) * SPRING_DAMPING
        p.vy = (p.vy + (ty - p.y) * SPRING_STIFFNESS) * SPRING_DAMPING
        p.x += p.vx
        p.y += p.vy
      }
    } else if (this.phase === PHASE.TRANSITION) {
      // Direct eased interpolation from the captured start position to
      // the target — monotonic, zero velocity at both ends, so there is
      // nothing to overshoot or spring back from. The same microOffset
      // signal used during the hold rides on top, its envelope ramped up
      // via smoothBump so it grows out of (and back into) the hold's
      // breathing amplitude rather than switching on abruptly.
      const progress = Math.min(1, this.phaseElapsed / this.phaseDuration)
      const eased = TRANSITION_EASE(progress)
      const wobbleAmp = Math.min(this.width, this.height) * FLOW_WOBBLE_FACTOR * smoothBump(progress)
      for (const p of this.particles) {
        const [ox, oy] = microOffset(this.noise, p, t)
        p.x = lerp(p.sx, p.tx, eased) + ox * wobbleAmp
        p.y = lerp(p.sy, p.ty, eased) + oy * wobbleAmp
        p.vx = 0
        p.vy = 0
      }
    } else {
      // HOLD — the composition stays put, but every particle keeps its
      // own continuous, independently-amplituded and independently-paced
      // micro-movement around its target (see microOffset/microAmp) —
      // there is no shared amplitude envelope tied to phaseElapsed, so
      // the field never swells and recedes as one synchronized pulse.
      // A brief shared ramp-in (not a ramp-down) only smooths the
      // hand-off from the transition's wobble, which itself ends at zero.
      const rampIn = smoothStep(this.phaseElapsed / HOLD_RAMP_IN)
      for (const p of this.particles) {
        const [ox, oy] = microOffset(this.noise, p, t)
        const amp = p.microAmp * rampIn
        p.x = p.tx + ox * amp
        p.y = p.ty + oy * amp
        p.vx = 0
        p.vy = 0
      }
    }
  }

  draw(ctx) {
    ctx.clearRect(0, 0, this.width, this.height)
    const baseFill = `rgba(${this.color}, 1)`
    const accentFill = `rgba(${ACCENT_COLOR}, 1)`
    for (const p of this.particles) {
      ctx.globalAlpha = p.opacity
      ctx.fillStyle = p.isAccent ? accentFill : baseFill
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}
