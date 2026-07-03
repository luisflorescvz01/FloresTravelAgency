import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import FloresTravel from './FloresTravel.jsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FloresTravel />
  </StrictMode>,
)
