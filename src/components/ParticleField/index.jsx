import { useEffect, useRef } from 'react'
import { ParticleSystem } from './engine'
import styles from './ParticleField.module.css'

// Thresholds are keyed to the particle field's own container width (capped
// at 460px on desktop by .heroArt, down to 280px/less on the hero's mobile
// breakpoint) — not the viewport width — since that's the box actually
// being populated. 800 is the desktop ceiling because it's below every
// illustration's own pool size — the smallest is the dandelion's 2000-point pool (see
// illustrations.js: contour-traced structure points + density-weighted
// fill) — so the count never exceeds what a given illustration can
// supply. Going higher would force the thin fallback padding in
// fitIllustration to kick in for some illustrations and reintroduce
// exactly the clustering that spacing was tuned to avoid. The other four
// illustrations' pools are now substantially larger (995–2076) thanks to
// particle-size-calibrated spacing, so even at this same shared count
// their actually-rendered subset is drawn from a far less overlap-prone
// distribution than before.
function getBaseParticleCount(width) {
  const lowPower = typeof navigator !== 'undefined' && navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4
  let base
  if (width <= 220) base = 215
  else if (width <= 340) base = 345
  else base = 800
  return lowPower ? Math.round(base * 0.75) : base
}

// The Monstera leaf, the dandelion and the dotwork flower are dense stipples (tone, splits and midrib are all
// expressed through density), and measured against the reference drawing
// its fidelity climbs steeply up to ~2x the base population before
// flattening. So the shared pool is enlarged by this factor; every other
// composition keeps using exactly the base population (see `active` in
// compositions.js) and the surplus particles stay invisible during them.
const LEAF_POOL_FACTOR = 2.25

function getParticleCounts(width) {
  const baseCount = getBaseParticleCount(width)
  return { baseCount, count: Math.round(baseCount * LEAF_POOL_FACTOR) }
}

export default function ParticleField() {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = canvas.getContext('2d')
    // Capped at 2 previously — raised to 3 since the particle count here
    // (a few hundred to ~2000 small circles) is cheap enough that the
    // extra canvas resolution costs negligible frame time, and fine dot
    // edges were measurably softer at 2x on 3x-DPR phones.
    const dpr = Math.min(window.devicePixelRatio || 1, 3)

    const measure = () => {
      const rect = wrap.getBoundingClientRect()
      return { w: Math.max(1, Math.round(rect.width)), h: Math.max(1, Math.round(rect.height)) }
    }

    const applyCanvasSize = (w, h) => {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const { w, h } = measure()
    applyCanvasSize(w, h)

    const initial = getParticleCounts(w)
    const system = new ParticleSystem({ width: w, height: h, count: initial.count, baseCount: initial.baseCount, seed: 11 })

    let rafId = null
    let visible = true
    let last = performance.now()

    if (reduced) {
      system.showStatic()
      system.draw(ctx)
    } else {
      const loop = (now) => {
        rafId = requestAnimationFrame(loop)
        if (!visible || document.hidden) { last = now; return }
        const dt = Math.min(now - last, 48)
        last = now
        system.update(dt)
        system.draw(ctx)
      }
      rafId = requestAnimationFrame(loop)
    }

    const io = new IntersectionObserver(
      ([entry]) => { visible = entry.isIntersecting },
      { threshold: 0.05 }
    )
    io.observe(wrap)

    let resizeTimer = null
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        const next = measure()
        applyCanvasSize(next.w, next.h)
        system.resize(next.w, next.h)
        const nextCounts = getParticleCounts(next.w)
        if (nextCounts.count !== system.count || nextCounts.baseCount !== system.baseCount) system.setCount(nextCounts.count, nextCounts.baseCount)
        if (reduced) system.draw(ctx)
      }, 180)
    })
    ro.observe(wrap)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      io.disconnect()
      ro.disconnect()
      clearTimeout(resizeTimer)
    }
  }, [])

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
    </div>
  )
}
