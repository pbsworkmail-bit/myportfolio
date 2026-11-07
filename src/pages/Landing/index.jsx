import { useEffect, useLayoutEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import ParticleField from '../../components/ParticleField'
import styles from './Landing.module.css'

const BASE = import.meta.env.BASE_URL
const HERO_HEADLINE = 'Making things simpler is rarely simple'
const HERO_BODY =
  "I'm Praveen Babu, a Product Designer who works on complex B2B software, from contact centres to CRM. " +
  "Complicated doesn't always mean unnecessary. Some of it is the problem itself, so I understand it first, " +
  "then separate what's essential from what only gets in the way."

// Cinematic editorial reveal — four phases:
//   1. Headline: line-by-line masked upward reveal, overlapping stagger
//   2. Brief pause once the headline has settled
//   3. Body: the same masked reveal, line-by-line, starting after the pause
//   4. Final resting state: plain static text, no animation machinery left behind
//
// Timing is slower than a typical UI transition on purpose: Material
// Design's own guidance caps interactive transitions at ~375-400ms
// specifically because those block a pending user action — a one-time
// hero entrance isn't that, so editorial/luxury sites run noticeably
// slower. Line-level references back this up directly: a documented
// motion-design reference for paragraph reveals cites ~200-300ms stagger
// between lines, and a production SplitText-based reveal component
// defaults to 600ms per line with a 100ms stagger. The previous values
// here (700ms duration, 90-120ms stagger) sat at or below the fast end of
// that range. LINE_DURATION_MS must stay in sync with .lineInner's
// transition-duration in Landing.module.css (currently 0.95s).
const LINE_DURATION_MS = 950
const LINE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)' // reused from this site's existing fade curve
const HEADLINE_START_DELAY_MS = 400
const HEADLINE_LINE_STAGGER_MS = 200
const PHASE_PAUSE_MS = 350
const BODY_LINE_STAGGER_MS = 160

// Splits an element's text into per-line <span> wrappers so each visual line
// can be masked and animated independently, then returns the line elements.
// Line grouping is measured from actual layout, so it stays correct across
// however the text happens to wrap at the current viewport width.
// `text` is always the known-clean source string rather than el.textContent,
// so this stays correct even if the effect runs twice (React StrictMode
// double-invokes effects in development) — a second pass never reads back
// its own previous output.
function splitIntoLines(el, text, lineClass, innerClass) {
  const words = text.split(' ')
  el.textContent = ''
  const wordEls = words.map((word, i) => {
    const span = document.createElement('span')
    span.textContent = word
    span.style.display = 'inline-block'
    el.appendChild(span)
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '))
    return span
  })

  const lines = []
  let lastTop = null
  wordEls.forEach((span) => {
    if (span.offsetTop !== lastTop) {
      lines.push([])
      lastTop = span.offsetTop
    }
    lines[lines.length - 1].push(span)
  })

  el.textContent = ''
  return lines.map((group, lineIndex) => {
    const mask = document.createElement('span')
    mask.className = lineClass
    const inner = document.createElement('span')
    inner.className = innerClass
    group.forEach((span, i) => {
      inner.appendChild(span)
      if (i < group.length - 1) inner.appendChild(document.createTextNode(' '))
    })
    mask.appendChild(inner)
    el.appendChild(mask)
    // A word-separating space between line masks, same as within a line —
    // masks are display:block, so this is invisible (whitespace between
    // block boxes doesn't render as a gap), but without it el.textContent
    // runs words from adjacent lines together with no separator at all
    // (e.g. "I'm" + "Praveen Babu," reads as "I'mPraveen Babu,") for the
    // whole time this split structure exists — every page load, for
    // however long the reveal animation runs. Breaks copy/paste, Ctrl+F,
    // and anything else reading the element's text during that window.
    if (lineIndex < lines.length - 1) el.appendChild(document.createTextNode(' '))
    return inner
  })
}

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
    desc: "Teams default to custom patterns because the design system is run as a shipped artifact, not a product. Success means voluntary adoption rises and integration time drops.",
    cta: { to: '/adoption', label: 'View Case study' },
    image: 'ds-adoption-cover.png',
    alt: 'Design system case study cover — "Trust Doesn\'t Translate Into Adoption"',
  },
]

const CTA_FADE_DISTANCE = 240 // px of scroll over which the scroll CTA fades out

export default function Landing() {
  const headlineRef = useRef(null)
  const bodyRef   = useRef(null)
  const caseRef   = useRef(null)
  const pageRef   = useRef(null)
  const ctaRef    = useRef(null)
  const artRef    = useRef(null)

  const location = useLocation()

  // Arriving from another page via the footer "Work" link
  useEffect(() => {
    if (location.state?.scrollTo !== 'case-studies') return
    const t = setTimeout(() => {
      caseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
    return () => clearTimeout(t)
  }, [location.key, location.state])

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

  // Particle field fade-in — unrelated to the headline/body text reveal,
  // left exactly as it was: a simple timed opacity fade.
  useEffect(() => {
    const id = setTimeout(() => {
      if (artRef.current) artRef.current.classList.add(styles.heroArtVisible)
    }, 350)
    return () => clearTimeout(id)
  }, [])

  // Headline + body entrance — the only thing this effect controls.
  // One coordinated sequence, triggered once on mount, never replayed.
  useLayoutEffect(() => {
    const headlineEl = headlineRef.current
    const bodyEl = bodyRef.current
    if (!headlineEl || !bodyEl) return

    const restoreFinal = () => {
      headlineEl.textContent = HERO_HEADLINE
      bodyEl.textContent = HERO_BODY
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return // leave the plain static text as rendered, no animation

    // Line grouping is measured from rendered glyph widths, so it has to
    // wait for Merriweather/Inter to actually finish loading — splitting
    // against the fallback font's metrics bakes in the wrong line breaks
    // once the real font swaps in. Hide immediately (no flash of unsplit
    // text) and split only once fonts are ready, with a bounded timeout so
    // a slow/failed font load can never leave the hero permanently hidden.
    headlineEl.style.opacity = '0'
    bodyEl.style.opacity = '0'

    const timerIds = []
    const later = (fn, ms) => timerIds.push(setTimeout(fn, ms))
    let cancelled = false

    const reveal = () => {
      if (cancelled) return
      headlineEl.style.opacity = ''
      bodyEl.style.opacity = ''

      try {
        const headlineLines = splitIntoLines(headlineEl, HERO_HEADLINE, styles.lineMask, styles.lineInner)
        const bodyLines = splitIntoLines(bodyEl, HERO_BODY, styles.lineMask, styles.lineInner)

        const revealLines = (lines, startDelay, stagger) => {
          lines.forEach((line, i) => {
            later(() => line.classList.add(styles.lineInnerVisible), startDelay + i * stagger)
          })
          return startDelay + Math.max(0, lines.length - 1) * stagger + LINE_DURATION_MS
        }

        // Phase 1: headline reveals line by line, overlapping.
        const headlineDoneAt = revealLines(headlineLines, HEADLINE_START_DELAY_MS, HEADLINE_LINE_STAGGER_MS)

        // Phase 2: brief pause once the headline has settled, then —
        // Phase 3: body reveals line by line.
        const bodyStartAt = headlineDoneAt + PHASE_PAUSE_MS
        const bodyDoneAt = revealLines(bodyLines, bodyStartAt, BODY_LINE_STAGGER_MS)

        // Phase 4: final resting state — drop the split-line scaffolding and
        // restore plain static text, so the finished layout is identical to
        // the original markup and immune to any resize/reflow afterwards.
        later(restoreFinal, bodyDoneAt + 50)
      } catch {
        // Any failure while splitting/animating must never leave the hero
        // blank — fall back straight to the final static text.
        restoreFinal()
      }
    }

    if (document.fonts && document.fonts.ready) {
      const timeout = new Promise((resolve) => later(resolve, 600))
      Promise.race([document.fonts.ready, timeout]).then(reveal)
    } else {
      reveal()
    }

    return () => {
      cancelled = true
      timerIds.forEach(clearTimeout)
      // Restore plain, fully-visible text on cleanup so a second
      // invocation (React StrictMode double-invokes effects in
      // development) always starts from clean source text rather than
      // mid-animation DOM, and so an interrupted sequence never leaves
      // the hero hidden.
      headlineEl.style.opacity = ''
      bodyEl.style.opacity = ''
      restoreFinal()
    }
  }, [])

  return (
    <div ref={pageRef} className={styles.page}>
      <Navbar />
      <main className={styles.main}>

        {/* ── Hero ── */}
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <h1 ref={headlineRef} className={styles.heroName}>{HERO_HEADLINE}</h1>
            <p ref={bodyRef} className={styles.heroBio}>{HERO_BODY}</p>
          </div>

          <div className={styles.heroVisual}>
            <div ref={artRef} className={styles.heroArt} role="img" aria-label="Generative particle animation">
              <ParticleField />
            </div>
          </div>

          <button ref={ctaRef} type="button" className={styles.scrollCta} onClick={scrollToCases} aria-label="Scroll to case studies">
            <span>Scroll</span>
            <svg width="14" height="8" viewBox="0 0 14 8" fill="none" aria-hidden="true">
              <path d="M1 1L7 7L13 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </section>

        {/* ── Philosophy / Design Approach ── */}
        <section className={styles.philosophy}>
          <div className={styles.philosophyContent}>
            <h2 className={styles.philosophyHeadline}>
              Good design doesn't make everything simple.{' '}
              <span className={styles.philosophyHighlight}>It makes everything as simple as it should be.</span>
            </h2>
            <p className={styles.philosophyBody}>
              That's why I don't stop at solving the problem in front of me. I also question whether it's the
              right problem, and the right way to solve it.
            </p>
          </div>
          <div className={styles.philosophyVisual}>
            <span className={styles.philosophyHalo} aria-hidden="true" />
            <span className={styles.philosophyGlow} aria-hidden="true" />
            <img
              src={`${BASE}portfolio-image.png`}
              alt="Illustrated collage of a person sitting in a chair, reading"
              className={styles.philosophyImage}
              width={622}
              height={566}
            />
          </div>
        </section>

        {/* ── Case Studies Section ── */}
        <div ref={caseRef} id="case-studies" className={styles.caseSectionLabel}>
          <h2 className={styles.caseHeadline}>
            A few problems where the <em>right question</em> mattered more than the <em>obvious answer</em>.
          </h2>
        </div>
        {CASE_STUDIES.map((cs, i) => (
          <section key={i} className={styles.caseSection}>
            <div className={styles.caseInner}>

              <div className={styles.caseLeft}>
                <p className={styles.caseLabel}>Case Study {i + 1}</p>
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
      <Footer />
    </div>
  )
}
