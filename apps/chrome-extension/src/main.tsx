import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from '@marksync/app'
import '@marksync/app/src/styles/index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
