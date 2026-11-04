import { useEffect, useRef } from 'react'
import { ParticleSystem } from './engine'
import styles from './ParticleField.module.css'

// Thresholds are keyed to the particle field's own container width (capped
// at 460px on desktop by .heroArt, down to 280px/less on the hero's mobile
// breakpoint) — not the viewport width — since that's the box actually
// being populated. 770 is the desktop ceiling because it's below every
// illustration's own blue-noise (minimum-distance) pool size — the
// smallest is bird's 783 points (see illustrations.js) — so the count
// never exceeds what a given illustration can supply at its tuned,
// edge-aware spacing. Going higher would force the thin fallback padding
// in fitIllustration to kick in for some illustrations and reintroduce
// exactly the clustering that spacing was tuned to avoid.
function getParticleCount(width) {
  const lowPower = typeof navigator !== 'undefined' && navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4
  let base
  if (width <= 220) base = 210
  else if (width <= 340) base = 335
  else base = 770
  return lowPower ? Math.round(base * 0.75) : base
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
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

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

    const system = new ParticleSystem({ width: w, height: h, count: getParticleCount(w), seed: 11 })

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
        const nextCount = getParticleCount(next.w)
        if (nextCount !== system.count) system.setCount(nextCount)
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
