import { useEffect, useRef, useState } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import styles from './Adoption.module.css';

const FRICTION_POINTS = [
  { index: '01', title: 'Finding', body: 'the right component without switching contexts.' },
  { index: '02', title: 'Deciding', body: 'whether it was appropriate for the use case.' },
  { index: '03', title: 'Implementing', body: 'it without unnecessary adaptation cost.' },
  { index: '04', title: 'Validating', body: 'the result without introducing a late governance hurdle.' },
];

const DESIGN_MOVES = [
  { index: '01', title: 'Make discovery effortless.', body: "Reduce the distance between a team's need and the component, pattern, or guidance that can solve it." },
  { index: '02', title: 'Make decisions easier.', body: 'Replace ambiguity with clearer recommendations, stronger defaults, and guidance at the point of choice.' },
  { index: '03', title: 'Make implementation faster.', body: 'Reduce the effort required to adapt system components and minimize unnecessary context switching.' },
  { index: '04', title: 'Make feedback part of the workflow.', body: 'Catch inconsistencies earlier and create a feedback loop that helps the system respond to how teams actually use it.' },
];

const PRODUCT_DIMENSIONS = [
  { role: 'Discovery', values: 'had to happen where teams already worked.' },
  { role: 'Guidance', values: 'had to appear when decisions were being made.' },
  { role: 'Implementation', values: 'had to compete with the speed of custom work.' },
  { role: 'Feedback', values: 'had to flow back into the system.' },
];

const renderText = (text) => {
  const parts = text.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (/^\*\*\*[^*]+\*\*\*$/.test(part)) return <strong key={i}><em>{part.slice(3, -3)}</em></strong>;
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
};

const SectionHeader = ({ eyebrow, title, sub }) => (
  <>
    <div className={styles.sectionLabel}>{eyebrow}</div>
    <div className={styles.sectionTitle}>{title}</div>
    {sub && <div className={styles.subHeader}>{sub}</div>}
  </>
);

const QuoteShift = ({ from, to }) => (
  <div className={styles.quoteShift}>
    <div className={styles.quoteShiftOld}>&ldquo;{from}&rdquo;</div>
    <div className={styles.quoteShiftArrow}>↓</div>
    <div className={styles.quoteShiftNew}>&ldquo;{to}&rdquo;</div>
  </div>
);

// Investigated before settling on this — not assumed:
//
// 1. Figma's documented Embed API "ready" event (INITIAL_LOAD, NEW_STATE,
//    etc.) only fires for embedded *prototypes* (/proto/), gated behind an
//    OAuth client-id. Docs are explicit this is prototype-only.
// 2. Fetched and decompiled the actual JS bundle our /design/ embed loads
//    upfront (embed_interstitial). It posts exactly four messages via
//    window.parent.postMessage(msg, "*"): LOGIN_SCREEN_SHOWN,
//    PASSWORD_SCREEN_SHOWN, ALLOW_COOKIES_SCREEN_SHOWN,
//    SECURITY_VERIFICATION_SCREEN_SHOWN — all undocumented, all auth/bot-
//    check gate screens that likely never fire on the happy path for a
//    public embed-host=share link, and none of them mean "canvas ready"
//    even when they do fire. A separate "trackEvent" message exists but is
//    targeted at window.self.origin (Figma's own origin), so the browser
//    won't even deliver it to us.
// 3. The real file/board-rendering app is a second bundle loaded
//    dynamically after that pre-flight passes — it isn't statically
//    fetchable, only observable via live navigation inside the iframe, so
//    its behavior is unverified (see the dev-only listener below).
// 4. Nothing reachable ties client-id to unlocking readiness events for
//    /design/ or /board/ — only /proto/ per docs. Converting this embed to
//    /proto/ would work, but a prototype embed is a click-through player,
//    not a browsable canvas — a different product, requiring an OAuth app
//    and an actual prototype flow in the file. Not applied here.
//
// Conclusion: no reliable readiness signal exists for this embed type.
// iframe `load` + a short explicit settle buffer for Figma's post-load
// canvas paint is the most honest signal available. The progress bar keeps
// animating through the buffer so it reads as one continuous load, not a
// second discrete phase. TIMEOUT_MS exists so a genuinely broken load
// (network failure, blocked embed) resolves to an error state instead of
// loading forever.
const EMBED_SETTLE_MS = 1100;
const EMBED_TIMEOUT_MS = 15000;

// Dev-only: watch for ANY postMessage from Figma's embed origin so we can
// empirically confirm (or catch a future change to) the findings above,
// without shipping an unverified listener as a production source of truth.
// Lives in an effect (not module scope) so it mounts/unmounts cleanly with
// the page, including across Vite HMR reloads.
const useFigmaEmbedDevLogger = () => {
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    const onMessage = (event) => {
      let hostname;
      try { hostname = new URL(event.origin).hostname; } catch { return; }
      if (!/(^|\.)figma\.com$/.test(hostname)) return;
      console.debug('[figma-embed message]', event.origin, event.data);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
};

const useEmbedLoadState = () => {
  const [status, setStatus] = useState('loading'); // 'loading' | 'settling' | 'ready' | 'error'

  useEffect(() => {
    if (status !== 'loading') return undefined;
    const id = setTimeout(() => setStatus('error'), EMBED_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [status]);

  useEffect(() => {
    if (status !== 'settling') return undefined;
    const id = setTimeout(() => setStatus('ready'), EMBED_SETTLE_MS);
    return () => clearTimeout(id);
  }, [status]);

  return {
    status,
    // A late onLoad still recovers a timed-out embed rather than leaving it stuck.
    onLoad: () => setStatus((s) => (s === 'ready' ? s : 'settling')),
    onError: () => setStatus('error'),
  };
};

// Stays mounted so the opacity transition can actually animate on load,
// instead of the overlay popping away the instant the iframe fires onLoad.
const EmbedLoader = ({ status, label, fallbackHref }) => {
  const visible = status !== 'ready';
  const isError = status === 'error';
  return (
    <div
      className={`${styles.embedLoading}${visible ? '' : ` ${styles.embedLoadingHidden}`}${isError ? ` ${styles.embedLoadingInteractive}` : ''}`}
      aria-hidden={!visible}
    >
      {isError ? (
        <>
          <span className={styles.embedErrorText}>This is taking longer than expected.</span>
          <a href={fallbackHref} target="_blank" rel="noopener noreferrer" className={styles.embedFallbackLink}>Open in Figma ↗</a>
        </>
      ) : (
        <>
          <span className={styles.embedSpinner} />
          <span className={styles.embedProgressTrack}>
            <span className={styles.embedProgressFill} />
          </span>
          <span className={styles.embedLoadingText}>{label}</span>
        </>
      )}
    </div>
  );
};

// Tracks fullscreen state for one specific element (via ref) rather than
// document-wide, so multiple embeds on the same page don't interfere with
// each other's button state.
const useFullscreenToggle = () => {
  const ref = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      setIsFullscreen(!!fsEl && fsEl === ref.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl === el) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    } else if (el.requestFullscreen) {
      el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    }
  };

  return { ref, isFullscreen, toggle };
};

const FullscreenToggleButton = ({ isFullscreen, onToggle }) => (
  <button
    type="button"
    className={styles.fullscreenButton}
    onClick={onToggle}
    aria-label={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
    title={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
  >
    {isFullscreen ? (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M8 3v3.5A1.5 1.5 0 0 1 6.5 8H3M12 3v3.5A1.5 1.5 0 0 0 13.5 8H17M8 17v-3.5A1.5 1.5 0 0 0 6.5 12H3M12 17v-3.5a1.5 1.5 0 0 1 1.5-1.5H17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ) : (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M3 7V4.5A1.5 1.5 0 0 1 4.5 3H7M13 3h2.5A1.5 1.5 0 0 1 17 4.5V7M17 13v2.5a1.5 1.5 0 0 1-1.5 1.5H13M7 17H4.5A1.5 1.5 0 0 1 3 15.5V13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )}
  </button>
);

// Exact paths from the Figma file's exported icon assets (node 70:127 / 70:140).
const IconKnow = () => (
  <svg className={styles.evidenceStepperIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 21C9 21.55 9.45 22 10 22H14C14.55 22 15 21.55 15 21V20H9V21ZM12 2C8.14 2 5 5.14 5 9C5 11.38 6.19 13.47 8 14.74V17C8 17.55 8.45 18 9 18H15C15.55 18 16 17.55 16 17V14.74C17.81 13.47 19 11.38 19 9C19 5.14 15.86 2 12 2ZM14 13.7V16H10V13.7C8.48 12.63 7 11.53 7 9C7 6.24 9.24 4 12 4C14.76 4 17 6.24 17 9C17 11.49 15.49 12.65 14 13.7Z" fill="#707068" />
  </svg>
);

const IconTrust = () => (
  <svg className={styles.evidenceStepperIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M16.4766 10.4138C16.0869 10.8035 15.4374 10.8035 15.0477 10.4138L10.5811 5.95716L3.53635 12.9919L2.87684 12.3624C1.70772 11.1932 1.70772 9.29466 2.87684 8.12554L7.11367 3.88872C8.28279 2.71959 10.1814 2.71959 11.3505 3.88872L16.4766 9.00488C16.8663 9.39459 16.8663 10.0241 16.4766 10.4138ZM17.1761 8.29541C17.9555 9.07483 17.9555 10.3439 17.1761 11.1233C15.9071 12.3923 14.5681 11.3431 14.3482 11.1233L10.5911 7.36611L5.02523 12.9319C4.63552 13.3216 4.63552 13.9512 5.02523 14.3409C5.41494 14.7306 6.04447 14.7306 6.44417 14.3409L11.0607 9.72434L11.7702 10.4338L7.15364 15.0503C6.76393 15.4401 6.76393 16.0696 7.15364 16.4593C7.54334 16.849 8.17287 16.849 8.57257 16.4593L13.1891 11.8428L13.8986 12.5522L9.28204 17.1688C8.89233 17.5585 8.89233 18.188 9.28204 18.5777C9.67175 18.9674 10.3013 18.9674 10.691 18.5777L15.3075 13.9612L16.017 14.6706L11.4004 19.2872C11.0107 19.6769 11.0107 20.3064 11.4004 20.6961C11.7902 21.0858 12.4197 21.0858 12.8094 20.6961L21.1232 12.3624C22.2923 11.1932 22.2923 9.29466 21.1232 8.12554L16.8863 3.88872C15.7372 2.73958 13.8786 2.71959 12.7095 3.82876L17.1761 8.29541Z" fill="#707068" />
  </svg>
);

const STEPPER_ITEMS = [
  { key: 'know', label: 'Know', icon: IconKnow },
  { key: 'trust', label: 'Trust', icon: IconTrust },
  { key: 'intent', label: 'Intent' },
  { key: 'gap', label: 'Adoption gap', highlighted: true },
  { key: 'use', label: 'Use' },
  { key: 'repeat', label: 'Repeat' },
];

const AdoptionGapStepper = () => (
  <div className={styles.evidenceStepper}>
    {STEPPER_ITEMS.map((item) => {
      const Icon = item.icon;
      return (
        <div
          key={item.key}
          className={`${styles.evidenceStepperCol}${item.highlighted ? ` ${styles.evidenceStepperColGap}` : ''}`}
        >
          {Icon && <Icon />}
          <span className={item.highlighted ? styles.evidenceStepperGapLabel : styles.evidenceStepperLabel}>{item.label}</span>
        </div>
      );
    })}
    <span className={styles.evidenceStepperDividerEnd} />
  </div>
);

// Fixed palette: green = adopt/good path, red = custom/legacy path, white =
// every neutral process node, blue = every decision diamond (shape already
// says "decision" — the color reinforces it as its own consistent category).
// Strokes are simply darkened tints of the same fill, not separate colors,
// so edges stay legible against the #E6E4E0 card background without adding
// new hues.
const FLOW_COLORS = {
  neutral: { fill: '#ffffff', stroke: '#d8d6d0', text: '#0d0d0d' },
  decision: { fill: '#E4EEF2', stroke: '#bcd4dd', text: '#0d0d0d' },
  good: { fill: '#EDF1E3', stroke: '#cddab8', text: '#0d0d0d' },
  bad: { fill: '#F2EBE4', stroke: '#ddccbc', text: '#0d0d0d' },
};

// ── Unified flowchart geometry system ──────────────────────────────────
// Every shape, gap, and stroke is derived from one base unit (the diagram's
// body font size) so rectangles, diamonds, and circles carry the same
// optical weight instead of being hand-tuned per node.
const FONT = 14;            // base unit — the diagram's body text size
const LINE_H = 20;           // ≈ FONT × 1.45
const SUB_FONT = 11.5;       // secondary/tool-label text
const LABEL_FONT = 12;       // arrow condition labels (No / Yes / Adapt / Exit)
const RADIUS = 24;  // shared corner radius for every rounded rectangle
const STROKE = +(FONT / 10).toFixed(1); // 1.4 — shared stroke weight for every shape
const STROKE_DASH = `0.1 ${STROKE * 2.6}`; // round-capped dots, spaced from the stroke weight
const PAD_X = FONT * 2;      // 28 — horizontal text padding inside a node
const PAD_Y = 32;            // vertical text padding: makes a 1-line rect resolve to exactly 6×FONT
const MIN_NODE_W = FONT * 12; // 168 — floor so short labels stay optically balanced with siblings
const DIAMOND_PAD_X = FONT * 0.85; // ≈12 — horizontal breathing room around diamond text
const DIAMOND_PAD_Y = FONT * 0.7;  // ≈10 — vertical breathing room around diamond text

// Spacing scale — every gap in the diagram is one of these five steps
const SP = { xs: FONT, sm: FONT * 2, md: FONT * 3, lg: FONT * 4, xl: FONT * 6 };

const CHAR_W = { bold: 0.6, mono: 0.6 }; // average glyph width as a fraction of font size
const textWidth = (text, size, style = 'bold') => text.length * size * CHAR_W[style];

// Rectangle: height ≈ 6× font size (1 line); width adapts to content.
const rectDims = (title, sub) => {
  const w = Math.max(textWidth(title, FONT, 'bold'), sub ? textWidth(sub, SUB_FONT, 'mono') : 0) + PAD_X * 2;
  return { w: Math.max(Math.round(w), MIN_NODE_W), h: (sub ? 2 : 1) * LINE_H + PAD_Y * 2 };
};

// Diamond: a true 45° rhombus (halfW === halfH) that tightly inscribes its
// own text. For a symmetric diamond with half-diagonal `a`, the largest
// axis-aligned box it can inscribe has half-width p and half-height q where
// p + q ≤ a (the box corner (p,q) must sit on or inside the edge
// x/a + y/a = 1). So `a` is the text's own half-width + half-height, each
// with a small dedicated padding — not the rectangle's already-padded
// dimensions, which compounds into an oversized diamond.
const diamondDims = (title) => {
  const halfTextW = textWidth(title, FONT, 'bold') / 2 + DIAMOND_PAD_X;
  const halfTextH = LINE_H / 2 + DIAMOND_PAD_Y;
  const half = Math.round(halfTextW + halfTextH);
  return { halfW: half, halfH: half };
};

// Circle: sized off an adjacent node's footprint rather than the plain 6×
// rule, so a terminator reads at the same visual weight as its neighbor.
// (Defined for system completeness — this diagram's terminator labels are
// wide enough that a true circle would either crowd the text or dwarf its
// neighbors, so they render as rounded rectangles below.)
// eslint-disable-next-line no-unused-vars
const circleRadius = (adjacentW, adjacentH) => Math.round(Math.max(adjacentH / 2, Math.sqrt((adjacentW * adjacentH) / Math.PI)));

const FlowRect = ({ x, y, title, sub, tone = 'neutral' }) => {
  const { w, h } = rectDims(title, sub);
  const c = FLOW_COLORS[tone];
  const titleY = sub ? y - LINE_H / 2 : y;
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={RADIUS} fill={c.fill} stroke={c.stroke} strokeWidth={STROKE} strokeDasharray={STROKE_DASH} strokeLinecap="round" />
      <text x={x} y={titleY} textAnchor="middle" dominantBaseline="middle" fontFamily="Inter, sans-serif" fontSize={FONT} fontWeight="500" fill={c.text}>{title}</text>
      {sub && (
        <text x={x} y={y + LINE_H / 2} textAnchor="middle" dominantBaseline="middle" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={SUB_FONT} fill="#6b6b66">{sub}</text>
      )}
    </g>
  );
};

const FlowDiamond = ({ x, y, title }) => {
  const { halfW, halfH } = diamondDims(title);
  return (
    <g>
      <polygon
        points={`${x},${y - halfH} ${x + halfW},${y} ${x},${y + halfH} ${x - halfW},${y}`}
        fill={FLOW_COLORS.decision.fill}
        stroke={FLOW_COLORS.decision.stroke}
        strokeWidth={STROKE}
        strokeDasharray={STROKE_DASH}
        strokeLinecap="round"
      />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontFamily="Inter, sans-serif" fontSize={FONT} fontWeight="500" fill={FLOW_COLORS.decision.text}>{title}</text>
    </g>
  );
};

const FlowLabel = ({ x, y, text }) => {
  const w = textWidth(text, LABEL_FONT, 'bold') + SP.xs;
  return (
    <g>
      <rect x={x - w / 2} y={y - LINE_H * 0.42} width={w} height={LINE_H * 0.85} fill="#faf9f5" />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontFamily="Inter, sans-serif" fontSize={LABEL_FONT} fontWeight="500" fill="#6b6b66">{text}</text>
    </g>
  );
};

const FrictionFlowDiagram = () => {
  // ── Layout: cumulative positions computed from the geometry system above ──
  const a = rectDims('Feature Request');
  const b = rectDims('Design & discovery', 'Figma, Storybook, docs');
  const d1 = diamondDims('Found & fits?');
  const e1 = rectDims('Escalate to DS team', 'Slack, async wait');
  const d2 = diamondDims('Adapt or Exit?');
  const g1 = rectDims('Implement with DS', 'IDE, AI assistant');
  const r1 = rectDims('Build custom/legacy', 'Copy existing pattern');
  const n3 = rectDims('Design review & QA', 'May flag for rework');
  const n4 = rectDims('Release');

  const cx = 620; // main spine
  const tabY = SP.sm, tabH = FONT * 2.3;

  const yA = tabY + tabH + SP.lg + a.h / 2;
  const yB = yA + a.h / 2 + SP.lg + b.h / 2;
  const yD1 = yB + b.h / 2 + SP.lg + d1.halfH;
  const yMerge1 = yD1 + d1.halfH + SP.md;
  const yD2 = yMerge1 + SP.sm + d2.halfH;
  const yMerge2 = yD2 + d2.halfH + SP.md;
  const yN3 = yMerge2 + SP.sm + n3.h / 2;
  const yN4 = yN3 + n3.h / 2 + SP.xl + SP.lg + n4.h / 2;
  const yCaption = yN4 + n4.h / 2 + SP.lg;

  const xE1 = cx + d1.halfW + SP.xl + e1.w / 2;
  const xG1 = cx - d2.halfW - SP.xl - g1.w / 2;
  const xR1 = cx + d2.halfW + SP.xl + r1.w / 2;

  const leftEdge = xG1 - g1.w / 2;
  const rightEdge = xR1 + r1.w / 2;
  const viewW = Math.round(rightEdge - leftEdge + SP.xl * 2);
  const viewH = Math.round(yCaption + SP.lg);
  const shiftX = Math.round(SP.xl - leftEdge);

  const sx = (x) => x + shiftX;
  const stroke = { stroke: '#9c9c96', strokeWidth: STROKE };

  // The card's background stays full-bleed (matching the Figma embed
  // sections), but the SVG itself is capped at its own natural pixel
  // dimensions (same viewW/viewH driving the viewBox) and centered within
  // that background — so it can never be stretched wider than its content,
  // which is what silently doubles the perceived font size whenever the
  // content's natural width drifts from the breakout's width (as it did
  // here after the diamonds were resized smaller). It can still shrink on
  // narrow viewports via the existing width:100%.
  return (
      <div className={styles.diagramCard}>
      <div className={styles.frictionStatement}>
        <span className={styles.frictionLead}>Each step introduced friction</span>
        <span className={styles.frictionTerm}>search</span>
        <span className={styles.frictionTerm}>uncertainty</span>
        <span className={styles.frictionTerm}>waiting</span>
        <span className={styles.frictionTerm}>extra effort.</span>
      </div>
      <svg
        className={styles.diagramSvg}
        style={{ maxWidth: viewW }}
        viewBox={`0 0 ${viewW} ${viewH}`}
        role="img"
        aria-label="As-is journey map: a feature request goes through design and discovery, then a decision on whether a matching component was found and fits. If not, it escalates to the design-system team over Slack before rejoining the flow. Next, teams decide to adapt the system component or exit to build something custom or legacy. Both paths lead to design review and QA, which may flag rework that re-enters the decision, before release — and that rework often becomes the precedent the next team copies."
      >
        <FlowRect x={sx(cx)} y={yA} title="Feature Request" tone="neutral" />
        <line x1={sx(cx)} y1={yA + a.h / 2} x2={sx(cx)} y2={yB - b.h / 2} markerEnd="url(#arrow)" {...stroke} />

        <FlowRect x={sx(cx)} y={yB} title="Design & discovery" sub="Figma, Storybook, docs" tone="neutral" />
        <line x1={sx(cx)} y1={yB + b.h / 2} x2={sx(cx)} y2={yD1 - d1.halfH} markerEnd="url(#arrow)" {...stroke} />

        <FlowDiamond x={sx(cx)} y={yD1} title="Found & fits?" />

        <line x1={sx(cx) + d1.halfW} y1={yD1} x2={sx(xE1) - e1.w / 2} y2={yD1} markerEnd="url(#arrow)" {...stroke} />
        <FlowLabel x={sx(cx) + d1.halfW + SP.xl / 2} y={yD1 - SP.sm} text="No" />
        <FlowRect x={sx(xE1)} y={yD1} title="Escalate to DS team" sub="Slack, async wait" tone="neutral" />

        <path d={`M ${sx(xE1)} ${yD1 + e1.h / 2} L ${sx(xE1)} ${yMerge1} L ${sx(cx) + 4} ${yMerge1}`} fill="none" {...stroke} />
        <FlowLabel x={sx(cx) + (sx(xE1) - sx(cx)) * 0.7} y={yMerge1 - SP.sm} text="Yes" />

        <line x1={sx(cx)} y1={yD1 + d1.halfH} x2={sx(cx)} y2={yD2 - d2.halfH} markerEnd="url(#arrow)" {...stroke} />
        <FlowLabel x={sx(cx) + SP.md} y={yMerge1 - SP.sm} text="Yes" />

        <FlowDiamond x={sx(cx)} y={yD2} title="Adapt or Exit?" />

        <line x1={sx(cx) - d2.halfW} y1={yD2} x2={sx(xG1) + g1.w / 2} y2={yD2} markerEnd="url(#arrow)" {...stroke} />
        <FlowLabel x={sx(cx) - d2.halfW - SP.xl / 2} y={yD2 - SP.sm} text="Adapt" />
        <FlowRect x={sx(xG1)} y={yD2} title="Implement with DS" sub="IDE, AI assistant" tone="good" />

        <line x1={sx(cx) + d2.halfW} y1={yD2} x2={sx(xR1) - r1.w / 2} y2={yD2} markerEnd="url(#arrow)" {...stroke} />
        <FlowLabel x={sx(cx) + d2.halfW + SP.xl / 2} y={yD2 - SP.sm} text="Exit" />
        <FlowRect x={sx(xR1)} y={yD2} title="Build custom/legacy" sub="Copy existing pattern" tone="bad" />

        <path d={`M ${sx(xG1)} ${yD2 + g1.h / 2} L ${sx(xG1)} ${yMerge2} L ${sx(cx) - 4} ${yMerge2}`} fill="none" {...stroke} />
        <path d={`M ${sx(xR1)} ${yD2 + r1.h / 2} L ${sx(xR1)} ${yMerge2} L ${sx(cx) + 4} ${yMerge2}`} fill="none" {...stroke} />
        <line x1={sx(cx)} y1={yMerge2} x2={sx(cx)} y2={yN3 - n3.h / 2} markerEnd="url(#arrow)" {...stroke} />

        <FlowRect x={sx(cx)} y={yN3} title="Design review & QA" sub="May flag for rework" tone="neutral" />

        <line x1={sx(cx)} y1={yN3 + n3.h / 2} x2={sx(cx)} y2={yN4 - n4.h / 2} markerEnd="url(#arrow)" {...stroke} />
        <text x={sx(cx) - SP.xl * 2} y={(yN3 + n3.h / 2 + yN4 - n4.h / 2) / 2} fontFamily="Inter, sans-serif" fontStyle="italic" fontSize={LABEL_FONT} fill="#888">rework re-enters the decision</text>

        <FlowRect x={sx(cx)} y={yN4} title="Release" tone="neutral" />

        <text x={sx(cx)} y={yCaption} textAnchor="middle" fontFamily="Merriweather, serif" fontStyle="italic" fontSize={FONT} fill="#404040">
          Rework often becomes the precedent copied by the next team
        </text>

        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#9c9c96" />
          </marker>
        </defs>
      </svg>
      </div>
  );
};

const Adoption = () => {
  const systemDesignEmbed = useEmbedLoadState();
  const boardEmbed = useEmbedLoadState();
  const outcomeBoardEmbed = useEmbedLoadState();
  const { ref: systemDesignFrameRef, isFullscreen: systemDesignIsFullscreen, toggle: toggleSystemDesignFullscreen } = useFullscreenToggle();
  const { ref: boardFrameRef, isFullscreen: boardIsFullscreen, toggle: toggleBoardFullscreen } = useFullscreenToggle();
  const { ref: outcomeBoardFrameRef, isFullscreen: outcomeBoardIsFullscreen, toggle: toggleOutcomeBoardFullscreen } = useFullscreenToggle();
  useFigmaEmbedDevLogger();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -48px 0px' }
    );
    document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div>
      <Navbar />
      <div className={styles.container}>

        {/* Hero */}
        <div className={styles.hero}>
          <div className={styles.heroContent}>
            <div className={styles.heroTag} data-reveal>Adoption is the perennial #1 challenge, but it's a symptom.</div>
            <div className={styles.heroTitle} data-reveal data-delay="1">Trust Doesn't Translate Into Adoption</div>
            <div className={styles.bodyText} data-reveal data-delay="2">
              <p className={styles.paragraph}>
                Product teams trying to ship features on schedule experience high effort, workflow
                interruption, poor discoverability, weak defaults, and switching costs when adopting the
                design system, because the system is governed and resourced as an engineering artifact — a
                set of shipped components — rather than as a product whose adoption behavior, UX, and
                outcomes are continuously designed, measured, and optimized against teams' actual local goal
                of shipping fast.
              </p>
              <p className={styles.paragraph}>
                This results in teams defaulting to custom or legacy patterns despite trusting the system,
                and the business fails to realize the consistency and velocity gains the system was funded
                to deliver — while mandates convert the gap into forced compliance rather than resolving the
                underlying inconvenience.
              </p>
              <p className={styles.paragraph}>
                <strong>We'll know we've solved it when</strong> voluntary (non-mandated) adoption rate
                rises and holds above baseline, and time-to-first-successful-integration for a new component
                drops below target.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.content}>

          {/* Figma design system, right under the hero */}
          <div className={styles.sectionBlock}>
            <div className={styles.principlesContainer} data-reveal="scale">
              <div className={styles.figjamParent}>
                <div className={styles.figjamFrame} ref={systemDesignFrameRef}>
                  <FullscreenToggleButton isFullscreen={systemDesignIsFullscreen} onToggle={toggleSystemDesignFullscreen} />
                  <EmbedLoader
                    status={systemDesignEmbed.status}
                    label="Loading Figma design…"
                    fallbackHref="https://www.figma.com/design/jhuJ9i0xmzTnLM2BW1oiNu/Design-System?node-id=0-1"
                  />
                  <iframe
                    className={styles.figjamEmbed}
                    src="https://embed.figma.com/design/jhuJ9i0xmzTnLM2BW1oiNu/Design-System?node-id=0-1&embed-host=share"
                    allow="fullscreen"
                    allowFullScreen
                    loading="lazy"
                    title="Design System — Figma file"
                    onLoad={systemDesignEmbed.onLoad}
                    onError={systemDesignEmbed.onError}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* The evidence */}
          <div className={styles.sectionBlock}>
            <div className={styles.section} data-reveal>
              <SectionHeader eyebrow="Discovery" title="The Evidence Challenged Our Assumption" />
              <div className={styles.bodyText}>
                <p className={styles.paragraph}>
                  We initially suspected that teams weren't adopting the design system because they lacked
                  awareness, guidance, or confidence in what was available.
                </p>
                <p className={styles.paragraph}>So we looked beyond adoption numbers and into the workflow itself.</p>
              </div>
            </div>
            <div className={styles.principlesContainer} data-reveal="scale">
              <div className={styles.figjamParent}>
                <div className={styles.figjamFrame} ref={boardFrameRef}>
                  <FullscreenToggleButton isFullscreen={boardIsFullscreen} onToggle={toggleBoardFullscreen} />
                  <EmbedLoader
                    status={boardEmbed.status}
                    label="Loading Figma board…"
                    fallbackHref="https://www.figma.com/board/LrllGKtTw8UGi93D5DIprI/Key-Findings?node-id=0-1"
                  />
                  <iframe
                    className={styles.figjamEmbed}
                    src="https://embed.figma.com/board/LrllGKtTw8UGi93D5DIprI/Key-Findings?node-id=0-1&embed-host=share"
                    allow="fullscreen"
                    allowFullScreen
                    loading="lazy"
                    title="Adoption case study — Key Findings board"
                    onLoad={boardEmbed.onLoad}
                    onError={boardEmbed.onError}
                  />
                </div>
              </div>
            </div>
            <div className={styles.bodyText} data-reveal>
              <p className={styles.paragraph}>The evidence told a different story.</p>
              <p className={styles.paragraph}>
                {renderText('Teams generally **knew the system existed. They trusted it. They wanted to use it.** But usage still broke down.')}
              </p>
            </div>
            <div className={styles.principlesContainer} data-reveal="scale">
              <div className={styles.evidenceFrame}>
                <div className={styles.evidenceIntroGroup}>
                  <div className={styles.evidenceIntro}>
                    Teams knew the system.<br />
                    They trusted it.<br />
                    They intended to use it.
                  </div>
                  <AdoptionGapStepper />
                </div>
                <div className={styles.evidenceGapGroup}>
                  <div className={styles.evidenceEyebrow}>So we looked at the Gap</div>
                  <div className={styles.evidenceHighlightWrap}>
                    <span className={styles.evidenceHighlight}>
                      What happens between intending<br />
                      to use the system and actually using it?
                    </span>
                  </div>
                  <div className={styles.evidenceClosing}>
                    We stopped looking at adoption as a communication problem and started looking at the
                    workflow.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* The friction */}
          <div className={styles.sectionBlock}>
            <div className={styles.section} data-reveal>
              <SectionHeader eyebrow="Mapping the workflow" title="The Friction Was in the Workflow" />
              <div className={styles.bodyText}>
                <p className={styles.paragraph}>
                  Mapping the end-to-end workflow made the pattern visible.
                </p>
              </div>
            </div>
            <div className={styles.principlesContainer} data-reveal="scale">
              <FrictionFlowDiagram />
            </div>
            <div className={styles.insightBlock} data-reveal>
              <div className={styles.insightLine}>The problem wasn&rsquo;t that teams rejected the system.</div>
              <div className={styles.insightLine}>The system was losing at the moment of choice.</div>
            </div>
          </div>

          {/* The reframe */}
          <div className={styles.sectionBlock}>
            <div className={styles.section} data-reveal>
              <SectionHeader eyebrow="Reframe" title="We Changed What We Were Designing For" />
              <div className={styles.bodyText}>This changed the problem we were trying to solve.</div>
            </div>
            <div data-reveal>
              <QuoteShift from="How do we get teams to adopt the design system?" to="Why should a team choose the design system when they're under pressure to ship?" />
            </div>
            <div className={styles.bodyText} data-reveal>
              <p className={styles.paragraph}>That distinction mattered.</p>
              <p className={styles.paragraph}>
                {renderText("Teams weren't optimizing for organizational consistency in that moment. They were optimizing for **shipping their feature with the least perceived risk and effort.**")}
              </p>
              <p className={styles.paragraph}>
                If using the system made that harder, asking teams to adopt it more strongly wouldn't solve
                the underlying problem.
              </p>
              <p className={styles.paragraph}>We needed to make the system competitive with the alternative.</p>
            </div>
            <div className={styles.quoteBlock} data-reveal>
              <div className={styles.quoteText}>Adoption had to become a consequence of a better workflow—not a behavior we had to enforce.</div>
            </div>
          </div>

          {/* The strategy */}
          <div className={styles.sectionBlock}>
            <div className={styles.section} data-reveal>
              <SectionHeader eyebrow="Strategy" title="Designing for the Path of Least Resistance" />
              <div className={styles.bodyText}>The research pointed to a simple principle:</div>
            </div>
            <div className={styles.quoteBlock} data-reveal>
              <div className={styles.quoteText}>If the design system is the better choice, it should also be the easier choice.</div>
            </div>
            <div className={styles.bodyText} data-reveal>That meant designing around the moments where teams were most likely to leave the system:</div>
            <ul className={styles.bodyText} data-reveal style={{ margin: 0, paddingLeft: '20px' }}>
              {FRICTION_POINTS.map((f) => (
                <li key={f.index} style={{ marginBottom: '8px' }}>{renderText(`**${f.title}** ${f.body}`)}</li>
              ))}
            </ul>
            <div className={styles.bodyText} data-reveal>
              <p className={styles.paragraph}>
                Rather than adding more communication around the system, we focused on reducing the effort
                required to use it.
              </p>
              <p className={styles.paragraph}>The strategy became:</p>
            </div>
            <div className={styles.quoteBlock} data-reveal>
              <div className={styles.quoteText}>Bring the system closer to the work. Reduce decision effort. Shorten the path from intent to implementation.</div>
            </div>
            <div className={styles.bodyText} data-reveal>The goal wasn't to make teams choose the design system.</div>
            <div className={styles.quoteBlock} data-reveal>
              <div className={styles.quoteText}>It was to make choosing it the path of least resistance.</div>
            </div>
          </div>

          {/* Design moves */}
          <div className={styles.sectionBlock}>
            <div className={styles.section} data-reveal>
              <SectionHeader eyebrow="Design moves" title="From Friction to Design Moves" />
              <div className={styles.bodyText}>
                <p className={styles.paragraph}>With the problem reframed, the workflow became our design brief.</p>
                <p className={styles.paragraph}>Each major friction point translated into a specific design move.</p>
              </div>
            </div>
            <div className={styles.defList} data-reveal>
              {DESIGN_MOVES.map((m) => (
                <div key={m.index} className={styles.defTerm}>
                  <span className={styles.defIndex}>{m.index}</span>
                  <div className={styles.defTermTitle}>{m.title}</div>
                  <div className={styles.defTermBody}>{m.body}</div>
                </div>
              ))}
            </div>
            <div className={styles.bodyText} data-reveal>
              <p className={styles.paragraph}>These weren't independent improvements.</p>
              <p className={styles.paragraph}>They were designed to close the gaps that caused teams to leave the system in the first place.</p>
            </div>
            <div className={styles.quoteBlock} data-reveal>
              <div className={styles.quoteText}>From finding → deciding → building → validating, the objective was the same: remove the reasons to exit.</div>
            </div>
          </div>

          {/* Turning the design system into a product */}
          <div className={styles.sectionBlock}>
            <div className={styles.section} data-reveal>
              <SectionHeader eyebrow="Outcome" title="Turning the Design System Into a Product" />
              <div className={styles.bodyText}>
                <p className={styles.paragraph}>The research had changed how we understood adoption.</p>
                <p className={styles.paragraph}>So the solution wasn't another component library, documentation refresh, or adoption campaign.</p>
                <p className={styles.paragraph}>
                  {renderText('We started treating the design system as a **product with users, workflows, friction, and measurable outcomes.**')}
                </p>
                <p className={styles.paragraph}>That meant designing beyond the components themselves:</p>
              </div>
            </div>
            <div className={styles.vocabList} data-reveal>
              {PRODUCT_DIMENSIONS.map((d) => (
                <div key={d.role} className={styles.vocabRow}>
                  <span className={styles.vocabRole}>{d.role}</span>
                  <span className={styles.vocabValues}>{d.values}</span>
                </div>
              ))}
            </div>
            <div className={styles.bodyText} data-reveal>The work that followed focused on those four moments.</div>
            <div className={styles.principlesContainer} data-reveal="scale">
              <div className={styles.figjamParent}>
                <div className={styles.figjamFrame} ref={outcomeBoardFrameRef}>
                  <FullscreenToggleButton isFullscreen={outcomeBoardIsFullscreen} onToggle={toggleOutcomeBoardFullscreen} />
                  <EmbedLoader
                    status={outcomeBoardEmbed.status}
                    label="Loading Figma board…"
                    fallbackHref="https://www.figma.com/board/6h9Xxl19x8gsZCcyMgXFCO/Case-Study-Outcome-%E2%80%94-Design-System-Adoption---the-2026-Tooling-Landscape?node-id=0-1"
                  />
                  <iframe
                    className={styles.figjamEmbed}
                    src="https://embed.figma.com/board/6h9Xxl19x8gsZCcyMgXFCO/Case-Study-Outcome-%E2%80%94-Design-System-Adoption---the-2026-Tooling-Landscape?node-id=0-1&embed-host=share"
                    allow="fullscreen"
                    allowFullScreen
                    loading="lazy"
                    title="Case Study Outcome — Design System Adoption in the 2026 Tooling Landscape"
                    onLoad={outcomeBoardEmbed.onLoad}
                    onError={outcomeBoardEmbed.onError}
                  />
                </div>
              </div>
            </div>
            <div className={styles.quoteBlock} data-reveal>
              <div className={styles.quoteText}>
                Not more things for teams to learn.<br />
                <strong>A better system for teams to use.</strong>
              </div>
            </div>
          </div>

        </div>

      </div>
      <Footer />
    </div>
  );
};

export default Adoption;
