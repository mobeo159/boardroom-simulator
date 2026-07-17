import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'

import App from './App.jsx'
import CaseStudio from './CaseStudio.jsx'

const isStudioPage =
  window.location.hash === '#studio'

createRoot(
  document.getElementById('root'),
).render(
  <StrictMode>
    {isStudioPage ? (
      <CaseStudio />
    ) : (
      <App />
    )}
  </StrictMode>,
)