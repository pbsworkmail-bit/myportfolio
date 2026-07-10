import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import styles from './Landing.module.css'

const BASE = import.meta.env.BASE_URL
const HERO_TEXT = 'Praveen Babu'

const CASE_STUDIES = [
  {
    title: "A seller-activation layer for a B2B CRM Deals module",
    desc: "Deal decay is a perception and behavioural problem before it is a data problem — the signals are often already sitting in the CRM, unread. Reps scanning the same pipeline every week stop noticing the deal that's gone quiet for a month; the silence that should trigger action instead hides it. The brief surfaces what the system already knew, before the deal is gone rather than after.",
    cta: { to: '/worktual', label: 'View Case study' },
    image: 'ai-brief-03.png',
    alt: 'AI-generated deal brief — CRM interface showing deal health and recommended actions',
  },
  {
    title: "Adoption is the perennial #1 challenge, but it's a symptom.",
    desc: "The tools and components exist—getting people to use them consistently is another matter entirely. Teams ship a fully documented design system and still watch product surfaces drift back into one-off patterns within a quarter, because the gap was never awareness or access. It was trust in the library, discoverability inside the file, and a workflow where the sanctioned pattern took longer to find than it did to just build one from scratch.",
    cta: null,
    image: null,
    alt: '',
  },
]

const BLINK_CYCLES = 4
const BLINK_PERIOD = 550 // ms per cycle
const CTA_FADE_DISTANCE = 240 // px of scroll over which the scroll CTA fades out

export default function Landing() {
  const textRef   = useRef(null)
  const cursorRef = useRef(null)
  const bioRef    = useRef(null)
  const caseRef   = useRef(null)
  const pageRef   = useRef(null)
  const ctaRef    = useRef(null)

  const scrollToCases = () => {
    caseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    const page = pageRef.current
    if (!page) return

    let ticking = false
    const applyFade = () => {
      ticking = false
      const cta = ctaRef.current
      if (!cta) return
      const opacity = Math.max(0, 1 - page.scrollTop / CTA_FADE_DISTANCE)
      cta.style.opacity = opacity
      cta.style.pointerEvents = opacity < 0.05 ? 'none' : 'auto'
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(applyFade)
    }

    applyFade()
    page.addEventListener('scroll', onScroll, { passive: true })
    return () => page.removeEventListener('scroll', onScroll)
  }, [])

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
    <div ref={pageRef} className={styles.page}>
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

          <button ref={ctaRef} type="button" className={styles.scrollCta} onClick={scrollToCases} aria-label="Scroll to case studies">
            <span>Scroll</span>
            <svg width="14" height="8" viewBox="0 0 14 8" fill="none" aria-hidden="true">
              <path d="M1 1L7 7L13 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </section>

        {/* ── Case Studies Section ── */}
        <div ref={caseRef} className={styles.caseSectionLabel}>
          <p className={styles.caseLabel}>Case Studies</p>
        </div>
        {CASE_STUDIES.map((cs, i) => (
          <section key={i} className={styles.caseSection}>
            <div className={styles.caseInner}>

              <div className={styles.caseLeft}>
                <h2 className={styles.caseTitle}>{cs.title}</h2>
                <p className={styles.caseDesc}>{cs.desc}</p>
                {cs.cta && (
                  <Link to={cs.cta.to} className={styles.caseBtn}>
                    {cs.cta.label}
                  </Link>
                )}
              </div>

              <div className={styles.caseRight}>
                <div className={styles.caseCard}>
                  <img
                    className={styles.caseCardImage}
                    src={cs.image ? `${BASE}${cs.image}` : undefined}
                    alt={cs.alt}
                  />
                </div>
              </div>

            </div>
          </section>
        ))}

      </main>
    </div>
  )
}
