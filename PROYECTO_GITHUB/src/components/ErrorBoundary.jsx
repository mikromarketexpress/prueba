import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    height: '100vh',
                    width: '100vw',
                    backgroundColor: '#080d18',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontFamily: 'Manrope, sans-serif',
                    padding: '2rem',
                    textAlign: 'center'
                }}>
                    <div style={{
                        background: 'rgba(255, 82, 82, 0.1)',
                        border: '1px solid rgba(255, 82, 82, 0.3)',
                        borderRadius: '20px',
                        padding: '3rem',
                        maxWidth: '600px',
                        backdropFilter: 'blur(20px)'
                    }}>
                        <h1 style={{ color: '#ff5252', fontSize: '2rem', fontWeight: 900, marginBottom: '1rem' }}>SISTEMA INTERRUMPIDO</h1>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, marginBottom: '2rem' }}>
                            Se ha detectado un error crítico en el renderizado. Por favor, contacta a soporte técnico.
                        </p>
                        <div style={{
                            background: 'rgba(0,0,0,0.3)',
                            padding: '1rem',
                            borderRadius: '10px',
                            textAlign: 'left',
                            overflow: 'auto',
                            maxHeight: '200px',
                            fontSize: '0.8rem',
                            fontFamily: 'monospace',
                            color: '#ff5252'
                        }}>
                            {this.state.error && this.state.error.toString()}
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                marginTop: '2rem',
                                background: '#00e676',
                                color: '#000',
                                border: 'none',
                                padding: '1rem 2rem',
                                borderRadius: '10px',
                                fontWeight: 900,
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                marginRight: '1rem'
                            }}
                        >
                            Reiniciar Aplicación
                        </button>
                        <button
                            onClick={() => {
                                localStorage.clear();
                                window.location.reload();
                            }}
                            style={{
                                marginTop: '1rem',
                                background: 'rgba(255,255,255,0.05)',
                                color: '#fff',
                                border: '1px solid rgba(255,255,255,0.2)',
                                padding: '1rem 2rem',
                                borderRadius: '10px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                textTransform: 'uppercase'
                            }}
                        >
                            Limpiar Datos y Forzar Reinicio
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
