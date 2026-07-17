import { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import styles from './Adoption.module.css';

const Adoption = () => {
  const [boardLoaded, setBoardLoaded] = useState(false);

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
            <div className={styles.heroTitle} data-reveal data-delay="1">The Library Wasn't the Problem. Discoverability and Trust Were.</div>
            <div className={styles.bodyText} data-reveal data-delay="2">
              The original ask was "increase design system adoption." That framing pointed at training and
              documentation — fixes for an <em>awareness</em> problem, when the actual gap was trust in the
              library, discoverability inside the file, and a workflow where the sanctioned pattern took longer
              to find than it did to just build one from scratch. The board below is the live artifact — the
              FigJam space used to map the friction, cluster the failure points, and pressure-test the fix.
              Pan and zoom to explore it as it evolved.
            </div>
          </div>
        </div>

        <div className={styles.content}>
          {/* Hero visual: interactive FigJam board */}
          <div className={styles.sectionBlock}>
            <div className={styles.principlesContainer} data-reveal="scale">
              <div className={styles.figjamParent}>
                <div className={styles.figjamFrame}>
                  {!boardLoaded && (
                    <div className={styles.embedLoading} aria-hidden="true">
                      <span className={styles.embedSpinner} />
                      <span className={styles.embedLoadingText}>Loading FigJam board…</span>
                    </div>
                  )}
                  <iframe
                    className={styles.figjamEmbed}
                    src="https://embed.figma.com/board/nFgV09bahBlQCNv6k8Kg35/Untitled?node-id=0-1&embed-host=share"
                    allow="fullscreen"
                    allowFullScreen
                    loading="lazy"
                    title="Adoption case study — FigJam board"
                    onLoad={() => setBoardLoaded(true)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Adoption;
