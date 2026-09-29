import { useRef, useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import styles from './Home.module.css';

const LAYERS = [
  {
    title: 'Silent deterioration.',
    body: `Stage, amount, and close date — the three fields reps and managers relied on — **carry no signal for decay**. A deal can sit in "Proposal" with a close date three weeks out and zero buyer activity for a month. The fields don't lie. They just don't update when nothing is happening. *Change blindness* means reps scanning the same pipeline weekly stop perceiving the **gradual deterioration** of deals they've been watching for months.`,
  },
  {
    title: 'Structural attention bias.',
    body: 'With 15–30 open opportunities, reps ran on *recency*. The deal touched most recently got the most attention. **The deal that needed intervention was invisible precisely because it had gone quiet** — the silence that should have triggered action was instead the mechanism hiding the problem.',
  },
  {
    title: 'An incentive structure that punished accuracy.',
    body: "Moving a deal backward in stage was *socially penalised*. Closing deals as \"lost\" before management asked felt like announcing failure. The CRM didn't just fail to surface decay — **it actively discouraged honest reporting**. **37% of reps admitted fabricating CRM data** because manual entry burden conflicted with quota pressure (AskElephant, 2025). Any intervention requiring accurate records before delivering value was dead before it launched.",
  },
];

const CONSTRAINTS = [
  {
    index: '01',
    title: 'No greenfield build permitted.',
    body: "The Daily Brief had to layer onto the existing Deals module without touching the pipeline model, record structure, or data schema. A full architectural redesign was out of scope and out of budget. **The brief had to be valuable within the system reps already lived in** — not dependent on a better one.",
  },
  {
    index: '02',
    title: 'No behaviour change during an active quota period.',
    body: "Any feature requiring reps to act differently during a live quarter faced near-certain non-adoption. The brief had to be *additive first and transformative second* — delivering value before asking anything in return. Reps needed to receive, not adjust. **Transformation follows trust; it cannot precede it.**",
  },
  {
    index: '03',
    title: 'Signal quality was uneven and not within our control.',
    body: "Behavioural signal quality depended entirely on email and calendar capture completeness. Full-integration orgs had rich engagement signals; manual-logging orgs had sparse, unreliable ones. **A brief that misfired was worse than no brief** — one false positive at launch could trigger *algorithm aversion* that killed adoption permanently (Dietvorst et al., 2015). Confidence had to be surfaced **per-deal**, not assumed globally.",
  },
  {
    index: '04',
    title: 'CRM field data was too corrupted to anchor a decay model.',
    body: "**Only 35% of sales professionals trust their organisation's CRM data** (Salesforce State of Sales, 5th Ed.). Any model built primarily on stage and close-date fields would *inherit the fictions those fields contained*. This was not a constraint to design around — it was evidence that **the model had to run on behavioural signals the rep couldn't manipulate**.",
  },
  {
    index: '05',
    title: 'The data quality assumption itself was a hypothesis, not a guarantee.',
    body: "No peer-reviewed evidence independently validates that AI auto-capture improves CRM logging behaviour. The assumption was *directionally supported but not proven*. This gap was flagged explicitly: any design decision contingent on high data quality had to be treated as **a testable hypothesis** and surfaced as such — **not embedded silently as a dependency**.",
  },
];

const DECISIONS = [
  {
    title: 'Push brief, not dashboard.',
    body: "The Deals module's inspection model failed because it required *deliberate intent*. Push delivery met reps in their existing morning behaviour. *Trade-off accepted:* A brief is less flexible than a dashboard. Reps who prefer to investigate on their own terms get a worse experience. That population was not the primary use case — **the target was the rep who was not going to investigate at all**.",
    image: 'wireframe-01.png',
    alt: 'Push brief wireframe',
  },
  {
    title: 'Behavioural signals, not record fields.',
    body: "Stage and close date are *lagging* and *socially gamed*. Interaction gaps, single-threading, and meeting cancellations are *leading* and harder to fabricate. *Trade-off accepted:* Signal quality degrades in low-capture environments. This created a tiered value proposition — the brief performs better for organisations with better activity capture — and required **per-deal confidence indicators** to avoid misleading reps in low-data conditions.",
    image: 'wireframe-02.png',
    alt: 'Behavioural signals interface',
  },
  {
    title: 'Every flag paired with a specific executable action.',
    body: "Every competing platform studied flagged risk and left recovery to the rep. The JOLT framework (Dixon & McKenna) and Rateb et al. (2025) identified specific stage-appropriate recovery actions: multi-threading, mutual action plan reactivation, executive sponsor engagement, decision-forcing communication. ***A flag without a next step generates anxiety. A flag with a next step generates direction.*** *Trade-off accepted:* Recommended actions make assumptions about deal context that will sometimes be wrong. Override had to be frictionless — one tap — and the brief had to frame itself explicitly as a starting point, not a directive.",
    image: 'wireframe-03.png',
    alt: 'Every flag paired with a specific executable action.',
  },
  {
    title: 'Factor-level explanations, not aggregate scores.',
    body: '"Last buyer reply: 18 days ago. Close date pushed twice in 30 days. One contact engaged." A rep can evaluate, disagree, or act on that. **They cannot evaluate a score of 34.** HubSpot\'s AI Deal Score — the most explainable feature in the competitive analysis — showed top-five key factors with ± direction. Every other platform showed a score with "top factors" at best. *Trade-off accepted:* Factor-level explanations require more space and cognitive investment per deal. The information hierarchy had to be enforced strictly: *action first, reason second, supporting signals on demand*.',
    image: 'wireframe-04.png',
    alt: 'Factor-level deal explanation wireframe',
  },
  {
    title: 'No auto-close, no auto-update.',
    body: "Qualification and disqualification judgment, forecast commits, and deal strategy stayed **fully human-controlled**. Automated actions on high-stakes decisions triggered the most severe aversion responses when wrong (PSAA framework, Habel et al., 2023; Rangarajan et al., 2026). *Trade-off accepted:* The brief could not autonomously close the loop. A rep who received a flag and did nothing would see the deal continue to decay. **This was a known, acceptable failure mode.** The brief improved the odds of intervention. *It couldn't guarantee it.*",
    image: 'wireframe-05.png',
    alt: 'No auto-close, no auto-update wireframe',
  },
];

const REFLECTIONS = [
  [
    {
      title: 'No primary user research.',
      body: "This case study is built on secondary research synthesis — academic literature, industry benchmarks, competitive analysis. It does not include interviews, usability testing, or workflow observation of actual reps. The design assumptions (reps will act on a push brief; they'll trust factor-level explanations; the intervention window is operationally reachable at Worktual's customer base) are well-supported by the evidence but *unvalidated in context*. **This is a high-fidelity hypothesis, not a validated design.**",
    },
    {
      title: 'The confidence-tiering mechanism was under-specified.',
      body: 'I identified that the brief needed to communicate signal quality per deal in low-capture environments. I did not fully elaborate what that looked like — how a rep distinguishes "this flag is based on 8 weeks of email data" from "this flag is based on manual activity logs." That design work was deferred to the next phase and *shouldn\'t have been*. **A brief that fires confidently on weak data will cause algorithm aversion at the worst possible moment.**',
    },
  ],
  [
    {
      title: 'The trust calibration loop should have been a first-phase deliverable, not a follow-on.',
      body: "The research on algorithm aversion predicts that **the brief's first visible false positive will do more adoption damage than a month of correct flags creates**. I didn't design the error experience — how the brief explains a flag that turns out to be wrong, how dismissal feedback enters the model, how accuracy expectations are set in onboarding — until after the core design was framed. In retrospect, ***the failure mode was more important than the success case***, and it should have been designed first.",
    },
    {
      title: "What I'd change:",
      body: "Two to three days shadowing reps during their actual morning workflow before framing the intervention. How do they start their day? What's already competing for the first ten minutes of attention? Where does the Deals module fit relative to email and calendar today? **The brief concept is well-founded.** Its form factor decisions — Slack vs. in-app vs. email; morning delivery vs. event-triggered; cards vs. list — would have been *sharper and less assumed* with that context.",
    },
  ],
];

const USERFLOW = [
  {
    title: 'Trial Experience',
    rows: [
      ['User goal', 'Spot at-risk deals before they slip'],
      ['Entry', 'Workday start · no prompts shown'],
      ['Depends on', 'Rep self-motivation + dashboard data'],
    ],
    image: 'userflow-01.png',
    alt: 'Trial experience user flow: rep must proactively open CRM, search for deals, interpret data manually, and form their own risk assessment — action is inconsistent and rarely reached',
  },
  {
    title: 'Final Experience',
    rows: [
      ['User goal', 'Same — act on at-risk deals, effortlessly'],
      ['Entry', 'Workday start · brief already waiting'],
      ['Depends on', 'AI monitoring deals continuously'],
    ],
    image: 'userflow-02.png',
    alt: 'Final experience user flow: AI brief is generated and delivered automatically at workday start, rep reads risk and next step in-context, then acts immediately — no drop-off',
  },
];

const OUTCOMES = [
  '*These are research-projected outcomes. No post-ship metrics exist at this stage. Success indicators were defined before launch as proxies.*',
  '**For reps:** The brief was designed to change the *locus of awareness* — moving deal risk from something reps discovered (if they investigated) to something that found them. The measurable proxy was brief engagement rate and action-taken rate per flag, not adoption per se. Research established ~38% adherence to AI recommendations in enterprise copilot contexts (Brynjolfsson, Li & Raymond, QJE 2025) as a healthy baseline — not a failure state. 100% adherence would be automation bias.',
  '**For pipeline health:** Deals flagged inside the intervention window and acted upon could be recovered or disqualified before distorting the forecast. Deals disqualified earlier freed pipeline capacity for higher-quality opportunities. Forecast fidelity — Gartner median 70–79%, only 7% of teams at ≥90% — was the business metric this was designed to move. The leading indicator was brief-triggered close-lost actions before end-of-quarter pressure.',
  "**For the product:** The Deals module shifted from destination (you go to it when asked) to orientation (it comes to you before you make decisions). This repositioned Worktual against Salesforce's Agentforce — gated behind $165+/user/month — for mid-market buyers where the gap between SMB simplicity (Pipedrive's Rotting flag) and enterprise sophistication (Salesforce Pipeline Inspection) was widest and most commercially underserved.",
];

const REFERENCE_GROUPS = [
  {
    heading: 'Peer-reviewed / Academic',
    caveat: null,
    tone: 'primary',
    items: [
      { authors: 'Thiess, Müller & Tonelli', year: '2020', venue: 'Wirtschaftsinformatik', finding: 'explainable win-propensity prediction design principles' },
      { authors: 'Habel, Alavi & Heinitz', year: '2023', venue: 'AMS Review', finding: 'PSAA adoption model' },
      { authors: 'Habel, Alavi & Heinitz', year: '2024', venue: 'JMR', finding: 'predictive analytics field experiment, 9.7M transactions' },
      { authors: 'Rateb, Keating & Wang', year: '2025', venue: 'Industrial Marketing Management', finding: 'micro-level B2B deal tactics' },
      { authors: 'Dietvorst, Simmons & Massey', year: '2015', venue: 'J. Exp. Psych: General', finding: 'algorithm aversion' },
      { authors: 'Dietvorst, Simmons & Massey', year: '2018', venue: 'Management Science', finding: 'editability and aversion mitigation' },
      { authors: 'Brynjolfsson, Li & Raymond', year: '2023/2025', venue: 'QJE', finding: 'generative AI at work, 5,179 agents' },
      { authors: 'Bansal et al.', year: '2021', venue: 'CHI', finding: 'AI explanations and complementary team performance' },
      { authors: 'Buçinca, Malaya & Gajos', year: '2021', venue: 'CSCW', finding: 'cognitive forcing and over-reliance' },
      { authors: 'Rangarajan et al.', year: '2026', venue: 'JPSSM', finding: 'AI trust in sales organisations' },
    ],
  },
  {
    heading: 'Industry Benchmarks',
    caveat: 'Directionally useful; not peer-reviewed',
    tone: 'secondary',
    items: [
      { authors: 'Dixon & McKenna', year: '2022', venue: 'The JOLT Effect', finding: '2.5M+ conversations' },
      { authors: 'Ebsta & Pavilion', year: '2024/2025', venue: null, finding: '4.2M opportunities, $54B revenue' },
      // TODO: confirm year/finding — source only gives report scope (Buying Journey,
      // forecast accuracy, SFA Magic Quadrant), no publication year or headline figure
      { authors: 'Gartner', year: null, venue: 'Buying Journey, forecast accuracy, SFA Magic Quadrant', finding: null },
      { authors: 'Salesforce', year: null, venue: 'State of Sales 5th Ed.', finding: '5,500 respondents' },
      // TODO: confirm year/finding — source only names the vendor, no finding given
      { authors: 'AskElephant', year: '2025', venue: null, finding: null },
      // TODO: confirm year/finding — source only names the vendor, no finding given
      { authors: 'Kluster', year: '2024', venue: null, finding: null },
    ],
  },
];

const BYLINE = 'Praveen — UX Designer, Worktual AI · June 2026';
const METHOD_NOTE = "Evidence labelling: peer-reviewed sources cited author–year–journal; industry benchmarks noted with a quality caveat; vendor-claimed ROI not used as primary design justification.";

const renderText = (text) => {
  const parts = text.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (/^\*\*\*[^*]+\*\*\*$/.test(part)) return <strong key={i}><em>{part.slice(3, -3)}</em></strong>;
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
};

const BASE = import.meta.env.BASE_URL;

const SectionHeader = ({ eyebrow, title, sub }) => (
  <>
    <div className={styles.sectionLabel}>{eyebrow}</div>
    <div className={styles.sectionTitle}>{title}</div>
    {sub && <div className={styles.subHeader}>{sub}</div>}
  </>
);

// Authors (Year) — Venue — finding, with graceful omission of any missing piece.
const ReferenceItem = ({ authors, year, venue, finding }) => (
  <li className={styles.referenceItem}>
    {authors}{year ? ` (${year})` : ''}
    {venue && <> — <em>{venue}</em></>}
    {finding && <> — {finding}</>}
  </li>
);

const Home = () => {
  const constraintsRef = useRef(null);
  const [activeLayer, setActiveLayer] = useState(0);
  const [designLoaded, setDesignLoaded] = useState(false);

  // Wheel + drag horizontal scrolling for the constraints card track
  useEffect(() => {
    const el = constraintsRef.current;
    if (!el) return;

    let drag = null;
    const stopDrag = () => { drag = null; el.style.cursor = 'grab'; };
    const handlers = {
      wheel: (e) => {
        if (e.deltaY === 0) return;
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      },
      mousedown: (e) => {
        drag = { startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft };
        el.style.cursor = 'grabbing';
      },
      mouseup: stopDrag,
      mouseleave: stopDrag,
      mousemove: (e) => {
        if (!drag) return;
        e.preventDefault();
        el.scrollLeft = drag.scrollLeft - (e.pageX - el.offsetLeft - drag.startX) * 1.5;
      },
    };

    Object.entries(handlers).forEach(([type, fn]) =>
      el.addEventListener(type, fn, type === 'wheel' ? { passive: false } : undefined)
    );
    return () => Object.entries(handlers).forEach(([type, fn]) => el.removeEventListener(type, fn));
  }, []);

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
          <div className={styles.heroTag} data-reveal>A seller-activation layer for a B2B CRM Deals module</div>
          <div className={styles.heroTitle} data-reveal data-delay="1">The Problem Wasn't Data Quality. It Was Perception Architecture.</div>
          <div className={styles.bodyText} data-reveal data-delay="2">{renderText('The original brief was "improve deal health visibility." That framing would have produced a dashboard — which would have failed for the same reason every CRM dashboard fails: it requires *deliberate intent* to open it, from *the people least likely to open it voluntarily*.')}</div>
        </div>
      </div>

      <div className={styles.content}>

        {/* Block 1b: Image */}
        <div className={styles.sectionBlock}>
          <div className={styles.principlesContainer} data-reveal="scale">
            <div className={styles.image8Parent}>
              <img className={styles.image8Icon} src={`${BASE}ai-brief-03.png`} alt="Deal header" />
            </div>
          </div>
        </div>

        {/* Block 2b: Quote */}
        <div className={styles.sectionBlock}>
          <div className={styles.quoteBlock} data-reveal>
            <div className={styles.dealDecayIs}>"Deal decay is a perception and behavioural problem before it is a data problem. The signals are often already in the system. The failure is in how — and whether — they're surfaced."</div>
            <div className={styles.quoteLabel}>The reframe</div>
          </div>
        </div>

        {/* Block 2: Three compounding layers */}
        <div className={styles.sectionBlock}>
          <div className={styles.principlesContainer} data-reveal="scale">
            <div className={styles.image6Parent}>
              <img className={styles.image6Icon} src={`${BASE}cluster.png`} alt="Deal decay cluster diagram" />
              <div className={styles.theActualProblemHadThreeCParent}>
                <div className={styles.theActualProblem}>The actual problem had three compounding layers:</div>
                <div className={styles.frameParent}>
                  {LAYERS.map((layer, i) => (
                    <div key={i} className={styles.silentDeteriorationParent}>
                      <div
                        className={styles.accordionHeader}
                        onClick={() => setActiveLayer(prev => prev === i ? null : i)}
                      >
                        <div className={styles.silentDeterioration}>{layer.title}</div>
                        <span className={styles.accordionToggle}>{activeLayer === i ? '−' : '+'}</span>
                      </div>
                      <div className={`${styles.accordionBody}${activeLayer === i ? ` ${styles.accordionBodyOpen}` : ''}`}>
                        <div className={styles.accordionInner}>
                          <div className={styles.stageAmountAnd}>{renderText(layer.body)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Block 3: Research */}
        <div className={styles.sectionBlock}>
          <div className={styles.section} data-reveal>
            <SectionHeader eyebrow="Research" title="What the Research Established" />
            <div className={styles.bodyText}>Five research bodies were synthesised: B2B sales pipeline management (academic + practitioner), CRM competitive capabilities, deal decay mechanisms, SaaS executive AI briefing patterns, and human-AI interaction in enterprise software. Evidence was labelled by quality tier throughout: peer-reviewed, large-n industry benchmark, or vendor-reported.</div>
            <div className={styles.readLink}>READ SYNTHESIS</div>
          </div>
          <div className={styles.imageWrapper} data-reveal data-delay="1">
            <img className={styles.image} alt="" />
          </div>
        </div>

        {/* Block 3b: User Flow */}
        <div className={styles.sectionBlock}>
          <div className={styles.principlesContainer} data-reveal="scale">
            <div className={styles.userflowImages}>
              <div className={styles.userflowDesc}>
                Trial vs. Final experience for AI-generated deal briefs — mapping goals, user actions, system responses, decision points, edge cases & outcomes.
              </div>
              <div className={styles.userflowCols}>
                {USERFLOW.map((col) => (
                  <div key={col.title} className={styles.userflowCol}>
                    <div className={styles.userflowColMeta}>
                      <div className={styles.userflowColTitle}>{col.title}</div>
                      {col.rows.map(([key, val]) => (
                        <div key={key} className={styles.userflowRow}>
                          <span className={styles.userflowKey}>{key}</span>
                          <span className={styles.userflowVal}>{val}</span>
                        </div>
                      ))}
                    </div>
                    <img className={styles.userflowImg} src={`${BASE}${col.image}`} alt={col.alt} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Block 4: Constraints */}
        <div className={styles.sectionBlock}>
          <div className={styles.section} data-reveal>
            <SectionHeader eyebrow="Constraints" title="Constraints That Shaped the Design" />
          </div>
          <div className={styles.cardsTrack} ref={constraintsRef} data-reveal data-delay="1">
            {CONSTRAINTS.map((c) => (
              <div key={c.index} className={styles.card}>
                <span className={styles.cardIndex}>{c.index}</span>
                <div className={styles.cardTitle}>{c.title}</div>
                <div className={styles.cardBody}>{renderText(c.body)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Block 5: Decisions */}
        <div className={styles.sectionBlock}>
          <div className={styles.section} data-reveal>
            <SectionHeader eyebrow="Decisions" title="Five Decisions, With Their Trade-offs" />
          </div>
          <div className={styles.principlesContainer}>
            <div className={styles.principlesList}>
              {DECISIONS.map((d, i) => (
                <div
                  key={i}
                  className={`${styles.principleRow}${i % 2 === 0 ? ` ${styles.principleRowReversed}` : ''}`}
                  data-reveal
                >
                  <div className={styles.principleText}>
                    <div className={styles.decisionTitle}>{d.title}</div>
                    <div className={styles.decisionBody}>{renderText(d.body)}</div>
                  </div>
                  <div className={styles.principleVisual}>
                    <img className={styles.principleImage} src={`${BASE}${d.image}`} alt={d.alt} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Block 6: Outcomes */}
        <div className={styles.sectionBlock}>
          <div className={styles.section} data-reveal>
            <SectionHeader eyebrow="Outcomes" title="What the Brief Was Designed to Change" sub="What success would look like for reps, pipeline health, and the product — defined as proxies, not confirmed outcomes." />
            <div className={styles.bodyText}>
              {OUTCOMES.map((p, i) => (
                <p key={i} className={i === OUTCOMES.length - 1 ? styles.outcomeText : styles.paragraph}>{renderText(p)}</p>
              ))}
            </div>
          </div>
        </div>

        {/* Block 6b: Image */}
        <div className={styles.sectionBlock}>
          <div className={styles.principlesContainer} data-reveal="scale">
            <div className={styles.image8Parent}>
              <div className={styles.embedFrame}>
                {!designLoaded && (
                  <div className={styles.embedLoading} aria-hidden="true">
                    <span className={styles.embedSpinner} />
                    <span className={styles.embedLoadingText}>Loading Figma design…</span>
                  </div>
                )}
                <iframe
                  className={styles.embedIframe}
                  src="https://embed.figma.com/design/pdLbDfuhaSt4FYsYfRcpVx/Hifi-Screens?node-id=9-248&embed-host=share"
                  allowFullScreen
                  loading="lazy"
                  title="Seller activation case study — Figma design"
                  onLoad={() => setDesignLoaded(true)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Block 7: Reflection */}
        <div className={styles.sectionBlock}>
          <div className={styles.section} data-reveal>
            <SectionHeader eyebrow="Reflection" title="What Failed and What I'd Do Differently" />
          </div>
          <div className={styles.principlesContainer}>
            <div className={styles.reflectionGrid}>
              {REFLECTIONS.map((row, ri) => (
                <div key={ri} className={styles.reflectionRow} data-reveal>
                  {row.map((item, ii) => (
                    <div key={ii} className={styles.reflectionItem}>
                      <div className={styles.vectorWrapper}>
                        <img className={styles.vectorIcon} alt="" />
                      </div>
                      <div className={styles.reflectionContent}>
                        <div className={styles.reflectionTitle}>{item.title}</div>
                        <div className={styles.reflectionBody}>{renderText(item.body)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Block 8: References */}
        <div className={styles.sectionBlock}>
          <div className={styles.section} data-reveal>
            <SectionHeader
              eyebrow="Sources"
              title="Research Evidence Base"
              sub="What the design decisions in this case study rest on, and how much weight each source carries."
            />
            {REFERENCE_GROUPS.map((group) => (
              <div key={group.heading} className={styles.referenceGroup}>
                <h3 className={styles.decisionTitle}>{group.heading}</h3>
                {group.caveat && <p className={styles.outcomeText}>{group.caveat}</p>}
                <ul
                  className={`${styles.referenceList}${group.tone === 'secondary' ? ` ${styles.referenceListSecondary}` : ''}`}
                >
                  {group.items.map((item, i) => (
                    <ReferenceItem key={`${item.authors}-${i}`} {...item} />
                  ))}
                </ul>
              </div>
            ))}
            <div className={styles.referenceByline}>
              <p className={styles.outcomeText}>{BYLINE}</p>
              <p className={styles.outcomeText}>{METHOD_NOTE}</p>
            </div>
          </div>
        </div>

      </div>
      </div>
      <Footer />
    </div>
  );
};

export default Home;
