import React, { useState, useEffect, useRef } from 'react'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import POS from './pages/POS'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import ProfileSelection from './pages/ProfileSelection'
import CuentasPorCobrar from './pages/CuentasPorCobrar'
import CuentasPorPagar from './pages/CuentasPorPagar'
import Reports from './pages/Reports'
import Configuration from './pages/Configuration'
import HelpModal from './components/HelpModal'
import { CajaProvider } from './context/CajaContext'
import { useAuth } from './context/AuthContext'
import { gsService } from './lib/googleSheetsService'
import { useToast } from './context/ToastContext'

function App() {
    const { isAuthenticated, canAccess, user } = useAuth()
    const [activePage, setActivePage] = useState('pos')
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
    const [showHelp, setShowHelp] = useState(false)
    const [tasaBcv, setTasaBcv] = useState(0)
    const { showToast } = useToast()
    const tasasInitRef = useRef(false)

    // Redirigir si el rol/permisos del usuario no le permiten ver la página activa
    useEffect(() => {
        if (!isAuthenticated) return
        if (!canAccess(activePage)) {
            const pages = ['pos', 'dashboard', 'inventory', 'cuentas-por-cobrar', 'cuentas-por-pagar', 'reportes', 'configuracion']
            const firstAllowed = pages.find(p => canAccess(p)) || 'pos'
            setActivePage(firstAllowed)
        }
    }, [isAuthenticated, user, canAccess, activePage])

    useEffect(() => {
        if (tasasInitRef.current) return
        tasasInitRef.current = true
        // 1. Inicializar conexión y cargar datos
        gsService.initWithTasa().then(result => {
            if (result.success && result.tasa) {
                setTasaBcv(result.tasa)
                localStorage.setItem('mme_tasa_bcv', result.tasa.toString())
            }
        }).catch(() => {})
        
        // 2. Sincronizar tasas BCV (Dólar y Euro) automáticamente en tiempo real al iniciar
        gsService.fetchAndUpdateTasas().then(tasaResult => {
            if (tasaResult?.success && tasaResult.data) {
                const usd = Number(tasaResult.data.tasa_bcv || 0)
                const eur = Number(tasaResult.data.tasa_euro || 0)
                if (usd > 0) {
                    setTasaBcv(usd)
                    localStorage.setItem('mme_tasa_bcv', String(usd))
                }
                if (eur > 0) {
                    localStorage.setItem('mme_tasa_bcv_euro', String(eur))
                }
                if (usd > 0 && eur > 0) {
                    showToast(`TASAS BCV EN TIEMPO REAL: $ Bs ${usd.toFixed(2)} | € Bs ${eur.toFixed(2)}`, 'success')
                }
            }
        }).catch(() => {})

        // 3. Monitoreo global continuo en tiempo real cada 60 segundos
        const tasaInterval = setInterval(() => {
            gsService.fetchAndUpdateTasas().then(res => {
                if (res?.cambio && res?.data) {
                    showToast(`¡TASA OFICIAL CAMBIÓ! $ Bs ${Number(res.data.tasa_bcv).toFixed(2)} | € Bs ${Number(res.data.tasa_euro).toFixed(2)}`, 'info')
                }
            }).catch(() => {})
        }, 60000)

        return () => clearInterval(tasaInterval)
    }, [])

    useEffect(() => {
        const up = async () => { 
            setIsOnline(true)
            showToast('CONEXIÓN RESTABLECIDA - SINCRONIZANDO...', 'info')
            await gsService.refresh()
            showToast('DATOS ACTUALIZADOS', 'success')
        }
        const down = () => { 
            setIsOnline(false)
            showToast('MODO OFFLINE ACTIVADO', 'warning')
        }
        
        window.addEventListener('online', up)
        window.addEventListener('offline', down)

        const handleKey = (e) => {
            if (e.key === 'F1') { e.preventDefault(); setShowHelp(p => !p) }
            if (e.key === 'F5') { e.preventDefault(); window.location.reload() }
        }
        window.addEventListener('keydown', handleKey)
        
        return () => {
            window.removeEventListener('online', up)
            window.removeEventListener('offline', down)
            window.removeEventListener('keydown', handleKey)
        }
    }, [showToast])

    if (!isAuthenticated) {
        return <ProfileSelection />
    }

    return (
        <CajaProvider>
            <div className="s-layout">
                <div className="s-ambient-blue" />
                <div className="s-ambient-green" />

                <Header isOnline={isOnline} />

                <div className="s-layout__body">
                    <Sidebar activePage={activePage} setActivePage={setActivePage} />
                    <main className="s-layout__main">
                        {activePage === 'pos' && canAccess('pos') && <POS />}
                        {activePage === 'dashboard' && canAccess('dashboard') && <Dashboard setActivePage={setActivePage} />}
                        {activePage === 'inventory' && canAccess('inventory') && <Inventory />}
                        {activePage === 'cuentas-por-cobrar' && canAccess('cuentas-por-cobrar') && <CuentasPorCobrar />}
                        {activePage === 'cuentas-por-pagar' && canAccess('cuentas-por-pagar') && <CuentasPorPagar />}
                        {activePage === 'reportes' && canAccess('reportes') && <Reports />}
                        {activePage === 'configuracion' && canAccess('configuracion') && <Configuration />}

                        {!canAccess(activePage) && (
                            <div className="s-panel" style={{ padding: '3.5rem 2rem', textAlign: 'center', margin: '3rem auto', maxWidth: '480px' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛡️</div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff', marginBottom: '0.6rem' }}>Módulo Restringido</h2>
                                <p style={{ fontSize: '0.85rem', color: 'var(--s-text-dim)', lineHeight: 1.5 }}>
                                    Tu perfil actual ({user?.cargo || user?.rol || 'personal'}) no cuenta con autorización para visualizar este módulo.
                                </p>
                            </div>
                        )}
                    </main>
                </div>

                <footer className="s-footer">
                    <div style={{ display: 'flex', gap: '1.5rem' }}>
                        {[['F1', 'AYUDA'], ['F5', 'REFRESCAR']].map(([key, label]) => (
                            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.6rem', fontWeight: 1000, background: 'rgba(0,230,118,0.1)', color: 'var(--s-neon)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(0,230,118,0.2)' }}>{key}</span>
                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#fff', letterSpacing: '0.1em' }}>{label}</span>
                            </div>
                        ))}
                    </div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#fff', letterSpacing: '0.2em' }}>
                        MICRO MARKET <span style={{ color: 'var(--s-neon)' }}>EXPRESS</span> — <span style={{ color: 'var(--s-text-primary)' }}>GS v8.0</span>
                    </div>
                </footer>

                {showHelp && <HelpModal onClose={() => setShowHelp(false)} activePage={activePage} />}
            </div>
        </CajaProvider>
    )
}

export default App
