import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import styles from './Landing.module.css'

const BASE = import.meta.env.BASE_URL
const HERO_TEXT = 'Praveen Babu'

const BLINK_CYCLES = 4
const BLINK_PERIOD = 550 // ms per cycle

export default function Landing() {
  const textRef   = useRef(null)
  const cursorRef = useRef(null)
  const bioRef    = useRef(null)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduced) {
      if (textRef.current)   textRef.current.textContent = HERO_TEXT
      if (bioRef.current)    bioRef.current.classList.add(styles.heroBioVisible)
      if (cursorRef.current) cursorRef.current.style.display = 'none'
      return
    }

    const timerIds = []
    const later = (fn, ms) => timerIds.push(setTimeout(fn, ms))

    // ── Phase 2b: cursor → dot morph ──────────────────────────
    const startMorph = () => {
      const c = cursorRef.current
      if (!c) return
      c.classList.remove(styles.cursorBlinking)
      // RAF ensures browser sees pre-transition state before dot class is added
      requestAnimationFrame(() => {
        c.classList.add(styles.cursorDot)
      })
    }

    // ── Phase 2a: cursor blink ────────────────────────────────
    const startBlink = () => {
      later(() => {
        if (bioRef.current) bioRef.current.classList.add(styles.heroBioVisible)
      }, 180)

      const c = cursorRef.current
      if (c) c.classList.add(styles.cursorBlinking)
      later(startMorph, BLINK_CYCLES * BLINK_PERIOD + 100)
    }

    // ── Phase 1: typewriter ───────────────────────────────────
    let charIndex = 0
    const typeNext = () => {
      if (!textRef.current) return
      textRef.current.textContent = HERO_TEXT.slice(0, charIndex + 1)
      charIndex++
      if (charIndex < HERO_TEXT.length) {
        const prev = HERO_TEXT[charIndex - 1]
        const delay = 58 + Math.random() * 58 + (prev === ' ' ? 80 : 0)
        later(typeNext, delay)
      } else {
        later(startBlink, 250)
      }
    }

    later(typeNext, 350)

    return () => timerIds.forEach(clearTimeout)
  }, [])

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>

        {/* ── Hero ── */}
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroName}>
              <span ref={textRef} />
              <span ref={cursorRef} className={styles.cursor} aria-hidden="true" />
            </h1>
            <p ref={bioRef} className={styles.heroBio}>
              a UI/UX Designer focused on creating intuitive, scalable interfaces for enterprise SaaS platforms.
              My work spans design systems, data dashboards, and Agentic AI experiences that blend clarity, function,
              and emotion. Skilled in Figma, interaction design, and motion, I believe great design simplifies
              complexity and helps users work smarter through thoughtful, consistent, and human-centered experiences.
            </p>
          </div>
        </section>

        {/* ── Case Studies Section ── */}
        <section className={styles.caseSection}>
          <div className={styles.caseInner}>

            <div className={styles.caseLeft}>
              <p className={styles.caseLabel}>Case Studies</p>
              <h2 className={styles.caseTitle}>
                The Problem Wasn't Data Quality. It Was Perception Architecture.
              </h2>
              <p className={styles.caseDesc}>
                I'm a UI/UX Designer focused on creating intuitive, scalable interfaces for enterprise SaaS
                platforms. My work spans design systems, data dashboards, and Agentic AI experiences that blend
                clarity, function, and emotion. Skilled in Figma, interaction design, and motion, I believe great
                design simplifies complexity and helps users work smarter through thoughtful, consistent, and
                human-centered experiences.
              </p>
              <Link to="/worktual" className={styles.caseBtn}>
                View Case study
              </Link>
            </div>

            <div className={styles.caseRight}>
              <div className={styles.caseCard}>
                <img
                  className={styles.caseCardImage}
                  src={`${BASE}ai-brief-03.png`}
                  alt="AI-generated deal brief — CRM interface showing deal health and recommended actions"
                />
              </div>
            </div>

          </div>
        </section>

      </main>
    </div>
  )
}
