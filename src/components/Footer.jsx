import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import styles from './Footer.module.css'

const LINKEDIN_URL = 'https://www.linkedin.com/in/praveenbabubs'

export default function Footer() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  // HashRouter owns the URL hash, so anchor links won't work — scroll by id,
  // or navigate home and let the Landing page scroll on arrival.
  const goToWork = (e) => {
    e.preventDefault()
    if (pathname === '/') {
      document.getElementById('case-studies')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      navigate('/', { state: { scrollTo: 'case-studies' } })
    }
  }

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
            <NavLink to="/" end onClick={goToWork} className={({ isActive }) => isActive ? `${styles.link} ${styles.active}` : styles.link}>
              Work
            </NavLink>
            <NavLink to="/about" className={({ isActive }) => isActive ? `${styles.link} ${styles.active}` : styles.link}>
              About
            </NavLink>
            <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className={styles.link}>LinkedIn</a>
          </nav>
        </div>

        <div className={styles.meta}>© {new Date().getFullYear()}</div>
      </div>
    </footer>
  )
}
