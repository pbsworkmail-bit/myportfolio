import { HashRouter, Routes, Route } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop'
import Landing from './pages/Landing'
import CaseStudy from './pages/Home'
import Adoption from './pages/Adoption'
import About from './pages/About'

export default function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/worktual" element={<CaseStudy />} />
        <Route path="/adoption" element={<Adoption />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </HashRouter>
  )
}
