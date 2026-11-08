import { useEffect, useRef } from 'react'
import styles from './GeometryEvolution.module.css'
import { createScene, REST_T } from './scene'

const HOLD = 0.8 // seconds the final frame stays on screen before the loop restarts

// "Evolution of Geometry": plays to its final frame, holds 0.8 s, then loops. A Cartesian
// grid grows into a circle, square and golden rectangle, then a Fibonacci spiral
// built from the exact subdivisions; the grid itself is warped along the way (see
// grid.js / phases.js). Fills the card like the sibling DotNetwork thumbnail.
export default function GeometryEvolution({ className, label }) {
  const svgRef = useRef(null)

  useEffect(() => {
    const svg = svgRef.current
    const scene = createScene(svg, styles)
    const ro = new ResizeObserver(([e]) => scene.resize(e.contentRect.width))
    ro.observe(svg)
    scene.resize(svg.getBoundingClientRect().width || 600)

    // Reduced motion: no animation, just the final frame.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      scene.render(REST_T)
      return () => { ro.disconnect(); scene.destroy() }
    }

    // Deterministic clock: advances by frame time through the cycle (play, hold, restart). It
    // stands still while off-screen or hidden so playback never skips ahead.
    let raf = 0
    let last = 0
    let elapsed = 0
    let visible = true
    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      if (!last) last = now
      // Play to REST_T, hold that frame for HOLD seconds, then restart from 0.
      elapsed = (elapsed + Math.min(0.1, (now - last) / 1000)) % (REST_T + HOLD)
      last = now
      scene.render(Math.min(REST_T, elapsed))
    }
    const start = () => { if (!raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(frame) } }
    const stop = () => { cancelAnimationFrame(raf); raf = 0 }
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop() })
    io.observe(svg)
    const onVis = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVis)
    scene.render(0)
    start()
    return () => {
      stop(); io.disconnect(); ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      scene.destroy()
    }
  }, [])

  return (
    <svg
      ref={svgRef}
      className={`${styles.svg} ${className || ''}`}
      viewBox="0 0 1240 789"
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid slice"
    />
  )
}
