import React, { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      hasError: true,
      error: error,
      errorInfo: errorInfo
    });
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px',
          background: '#0d0d0d',
          color: '#ff4d4f',
          fontFamily: 'monospace',
          height: '100vh',
          width: '100vw',
          boxSizing: 'border-box',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center'
        }}>
          <div style={{ maxWidth: '600px', background: '#141414', padding: '32px', borderRadius: '12px', border: '1px solid rgba(255, 77, 79, 0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '1.5rem', fontWeight: 'bold' }}>🚨 Algo salió mal (Yoru Reader Crash)</h2>
            <p style={{ color: '#fff', fontSize: '0.95rem', margin: '0 0 20px 0', wordBreak: 'break-all' }}>
              <strong>Error:</strong> {this.state.error && this.state.error.toString()}
            </p>
            <div style={{ textAlign: 'left', background: '#050505', padding: '16px', borderRadius: '8px', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', maxHeight: '200px', overflow: 'auto', marginBottom: '24px' }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </div>
            <button 
              onClick={() => {
                localStorage.removeItem('migaku_reader_active_profile_id');
                window.location.reload();
              }}
              style={{
                padding: '10px 20px',
                background: '#ff4d4f',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                marginRight: '12px'
              }}
            >
              Forzar Reinicio Limpio
            </button>
            <button 
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                background: 'rgba(255,255,255,0.06)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

