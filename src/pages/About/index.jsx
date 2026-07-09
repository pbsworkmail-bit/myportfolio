import Navbar from '../../components/Navbar'
import styles from './About.module.css'

export default function About() {
  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.prose}>
          <p>
            I am a UX/UI designer focused on enterprise SaaS.
          </p>

          <p>
            Since 2023 I have designed Worktual's contact-centre and CRM
            platform — its AI Agent features, conversational interface, and
            atomic design system.
          </p>

          <p>
            I trained as a mechanical engineer, then spent a year in sales.
            Engineering taught me systems; sales taught me to listen. Design
            is where the two meet.
          </p>

          <p>
            I believe great design simplifies complexity — carrying the
            difficulty on the user's behalf.
          </p>

          <p>
            Beyond work: storytelling, science fiction, poetry, photography,
            and videography.
          </p>
        </div>
      </main>
    </div>
  )
}
