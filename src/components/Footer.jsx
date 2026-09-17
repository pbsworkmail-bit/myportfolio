import { Link, NavLink } from 'react-router-dom'
import styles from './Footer.module.css'

// TODO: replace with the real LinkedIn profile URL and email address
const LINKEDIN_URL = '#'
const EMAIL = '#'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p className={styles.tagline}>
          Still thinking about systems,<br />
          products, and the people who use them.
        </p>

        <div className={styles.row}>
          <Link to="/" className={styles.brand}>
            <span className={styles.monogram}>Pb</span>
            <span className={styles.role}>Product Designer</span>
          </Link>

          <nav className={styles.links}>
            <NavLink to="/" end className={({ isActive }) => isActive ? `${styles.link} ${styles.active}` : styles.link}>
              Work
            </NavLink>
            <NavLink to="/about" className={({ isActive }) => isActive ? `${styles.link} ${styles.active}` : styles.link}>
              About
            </NavLink>
            <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className={styles.link}>LinkedIn</a>
            <a href={EMAIL} className={styles.link}>Email</a>
          </nav>
        </div>

        <div className={styles.meta}>© {new Date().getFullYear()}</div>
      </div>
    </footer>
  )
}
