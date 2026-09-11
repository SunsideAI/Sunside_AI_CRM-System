import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { sitzungEinrichten } from './utils/sitzung'
import './index.css'

// Muss vor dem ersten Render laufen: ab hier traegt jeder Function-Aufruf
// das Sitzungs-Token.
sitzungEinrichten()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
