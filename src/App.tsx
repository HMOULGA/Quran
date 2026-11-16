import { useEffect } from 'react'
import { useRoute, href, type Route } from './router'
import { useStore } from './lib/store'
import { Icon } from './components/Icon'
import { PlayerBar } from './components/PlayerBar'
import { Home } from './screens/Home'
import { SurahList } from './screens/SurahList'
import { Reader } from './screens/Reader'
import { Review } from './screens/Review'
import { Progress } from './screens/Progress'
import { Settings } from './screens/Settings'

const NAV: { route: Route; label: string; icon: string; match: Route['name'][] }[] = [
  { route: { name: 'home' }, label: 'Accueil', icon: 'home', match: ['home'] },
  { route: { name: 'surahs' }, label: 'Sourates', icon: 'book', match: ['surahs', 'reader'] },
  { route: { name: 'review' }, label: 'Révision', icon: 'review', match: ['review'] },
  { route: { name: 'progress' }, label: 'Progrès', icon: 'chart', match: ['progress'] },
  { route: { name: 'settings' }, label: 'Réglages', icon: 'settings', match: ['settings'] },
]

export default function App() {
  const route = useRoute()
  const theme = useStore((s) => s.settings.theme)
  const fontSize = useStore((s) => s.settings.fontSize)

  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
      root.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  useEffect(() => {
    document.documentElement.style.setProperty('--quran-size', `${fontSize}px`)
  }, [fontSize])

  const pageKey = route.name === 'reader' ? `r${route.surah}` : route.name
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pageKey])

  return (
    <div className="app">
      <main className="main">
        {route.name === 'home' && <Home />}
        {route.name === 'surahs' && <SurahList />}
        {route.name === 'reader' && <Reader key={route.surah} route={route} />}
        {route.name === 'review' && <Review />}
        {route.name === 'progress' && <Progress />}
        {route.name === 'settings' && <Settings />}
      </main>
      <PlayerBar />
      <nav className="tabbar" aria-label="Navigation principale">
        {NAV.map((n) => (
          <a key={n.label} href={href(n.route)} className={n.match.includes(route.name) ? 'active' : ''}>
            <Icon name={n.icon} size={22} />
            <span>{n.label}</span>
          </a>
        ))}
      </nav>
    </div>
  )
}
