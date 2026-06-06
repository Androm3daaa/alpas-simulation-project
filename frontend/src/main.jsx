import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { preloadSchoolBuilding } from './hooks/useSchoolBuilding'
import './index.css'

// Default building model for 3D tab + landing hero (failure must not block the UI)
try {
  preloadSchoolBuilding()
} catch (e) {
  console.warn('[ALPAS] Building preload skipped:', e)
}

class RootErrorBoundary extends React.Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui', color: '#fca5a5', background: '#0a0c0f', minHeight: '100vh' }}>
          <h1 style={{ color: '#fff', fontSize: 20 }}>ALPAS failed to start</h1>
          <pre style={{ marginTop: 16, whiteSpace: 'pre-wrap', fontSize: 13 }}>{this.state.error?.toString()}</pre>
          <p style={{ marginTop: 16, color: '#94a3b8', fontSize: 13 }}>Try a hard refresh (Ctrl+Shift+R). If this persists, check the browser console.</p>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </RootErrorBoundary>
  </React.StrictMode>,
)