import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import { playback } from './lib/playback.js'

if (location.hostname === 'localhost') window.__pb = playback

createRoot(document.getElementById('root')).render(<App />)

requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById('boot')?.remove()))
