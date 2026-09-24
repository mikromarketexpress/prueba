import React, { useState, useEffect, useMemo } from 'react'
import { Bell, Landmark, Unlock, Lock, LogOut, ShieldCheck, User, DollarSign, Euro, RefreshCw, Users } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useCaja } from '../context/CajaContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { gsService } from '../lib/googleSheetsService'
import CajaModal from './CajaModal'
import UserManagerModal from './UserManagerModal'
import UserAvatar from './UserAvatar'
import dayjs from 'dayjs'

const ROLE_COLORS = {
    admin_master: { bg: 'rgba(255, 215, 0, 0.18)', text: '#ffd700' },
    admin: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171' },
    supervisor: { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc' },
    cajero: { bg: 'rgba(0, 230, 118, 0.15)', text: 'var(--s-neon)' },
    vendedor: { bg: 'rgba(6, 182, 212, 0.15)', text: '#06b6d4' },
    inventario: { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8' },
    personalizado: { bg: 'rgba(251, 191, 36, 0.15)', text: '#fbbf24' }
}

const Header = ({ isOnline }) => {
    const [time, setTime] = useState(new Date())
    const [showCajaModal, setShowCajaModal] = useState(false)
    const [showUserManagerModal, setShowUserManagerModal] = useState(false)
    const [cajaModalType, setCajaModalType] = useState('abrir')
    const [syncingTasas, setSyncingTasas] = useState(false)
    const { sesionActiva, setSesionActiva, loadingCaja, tasaBCV, tasaBCVEuro, isCajaAbierta } = useCaja()
    const { user, logout, canAccess, usuarios } = useAuth()
    const { showToast } = useToast()

    const handleSyncTasas = async () => {
        if (syncingTasas) return
        setSyncingTasas(true)
        try {
            const res = await gsService.fetchAndUpdateTasas()
            if (res.success && res.data) {
                const usd = Number(res.data.tasa_bcv || 0).toFixed(2)
                const eur = Number(res.data.tasa_euro || 0).toFixed(2)
                showToast(`TASAS ACTUALIZADAS — USD: Bs ${usd} | EUR: Bs ${eur}`, 'success')
            } else {
                showToast('No se pudieron actualizar las tasas BCV', 'warning')
            }
        } catch (e) {
            showToast('Error al sincronizar tasas oficiales', 'error')
        } finally {
            setTimeout(() => setSyncingTasas(false), 800)
        }
    }

    useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000)
        return () => clearInterval(t)
    }, [])

    useEffect(() => {
        const handleOpenUserManager = () => setShowUserManagerModal(true)
        window.addEventListener('open-user-manager', handleOpenUserManager)
        return () => window.removeEventListener('open-user-manager', handleOpenUserManager)
    }, [])

    const handleCajaClick = () => {
        setCajaModalType(sesionActiva ? 'cerrar' : 'abrir')
        setShowCajaModal(true)
    }

    const hhmm = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
    const date = time.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

    const displayName = user?.nombre_completo || user?.nombre_vendedor || user?.username || 'Usuario'
    const displayRole = user?.cargo || (user?.rol === 'admin' ? 'Gerente de Tienda' : 'Personal')
    const roleStyle = ROLE_COLORS[user?.rol] || (String(user?.rol || '').includes('master') ? ROLE_COLORS.admin_master : (String(user?.rol || '').includes('vendedor') ? ROLE_COLORS.vendedor : ROLE_COLORS.cajero))

    // Identificar qué cajero abrió la caja actualmente activa
    const cajeroApertura = useMemo(() => {
        if (!sesionActiva) return null

        // 1. Por usuario_id registrado en la sesión
        if (sesionActiva.usuario_id && usuarios?.length) {
            const found = usuarios.find(u => String(u.id) === String(sesionActiva.usuario_id))
            if (found) return found
        }

        // 2. Por coincidencia de nombre o usuario
        if (sesionActiva.usuario_nombre && usuarios?.length) {
            const needle = String(sesionActiva.usuario_nombre).toLowerCase().trim()
            const found = usuarios.find(u => 
                (u.nombre_completo && u.nombre_completo.toLowerCase().trim() === needle) ||
                (u.nombre_vendedor && u.nombre_vendedor.toLowerCase().trim() === needle) ||
                (u.username && u.username.toLowerCase().trim() === needle)
            )
            if (found) return found
        }

        // 3. Tomar directamente de la sesión si tiene foto o nombre
        if (sesionActiva.usuario_nombre || sesionActiva.usuario_foto) {
            return {
                id: sesionActiva.usuario_id || '',
                nombre_completo: sesionActiva.usuario_nombre || 'Cajero',
                foto_url: sesionActiva.usuario_foto || '',
                cargo: sesionActiva.usuario_cargo || 'Cajero',
                rol: sesionActiva.usuario_rol || 'cajero'
            }
        }

        // 4. Si la caja ya estaba abierta previamente, fallback al usuario actual o Administrador Master
        return user || {
            nombre_completo: 'Edson Designer',
            foto_url: 'https://drive.google.com/thumbnail?id=1JLaEUIVJxwpE4q3D980RW41fYGzHTwJR&sz=w400',
            cargo: 'Administrador Master',
            rol: 'admin_master'
        }
    }, [sesionActiva, usuarios, user])

    return (
        <header className="s-header">
            {/* Logo */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--s-neon)', letterSpacing: '0.2em' }}>FILIPENSES 4:13</span>
                <h1 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
                    MIKRO MARKET <span style={{ color: 'var(--s-neon)', fontStyle: 'italic' }}>EXPRESS</span>
                </h1>
            </div>

            {/* Clock Overlay */}
            <div className="s-panel" style={{ padding: '0.4rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: 'none' }}>
                <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{hhmm}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', marginTop: '0.2rem' }}>{date}</span>
            </div>

            {/* Status & User */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.75rem', fontWeight: 900, background: 'rgba(255,255,255,0.03)', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid var(--s-glass-border)' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isOnline ? 'var(--s-neon)' : '#ff5252', boxShadow: isOnline ? '0 0 10px var(--s-neon)' : 'none' }} />
                    <span style={{ color: isOnline ? '#fff' : '#ff5252' }}>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                </div>

                {/* Contenedor Tasas BCV: Dólar y Euro lado a lado en tiempo real */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {/* Tasa BCV Dólar */}
                    <div
                        onClick={handleSyncTasas}
                        title="Tasa oficial BCV Dólar — Clic para sincronizar en tiempo real"
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.45rem',
                            padding: '0.35rem 0.75rem', borderRadius: '8px',
                            background: tasaBCV > 0 ? 'rgba(0,230,118,0.08)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${tasaBCV > 0 ? 'rgba(0,230,118,0.28)' : 'rgba(255,255,255,0.08)'}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            userSelect: 'none'
                        }}
                    >
                        <DollarSign size={15} style={{ color: tasaBCV > 0 ? 'var(--s-neon)' : '#666' }} />
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.55rem', fontWeight: 800, color: tasaBCV > 0 ? 'var(--s-neon)' : '#666', letterSpacing: '0.1em' }}>BCV USD</div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 900, color: tasaBCV > 0 ? '#fff' : '#888', fontFamily: 'monospace', lineHeight: 1.2 }}>
                                {tasaBCV > 0 ? `BS ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(tasaBCV)}` : '---'}
                            </div>
                        </div>
                    </div>

                    {/* Tasa BCV Euro (Al lado de la de Dólar) */}
                    <div
                        onClick={handleSyncTasas}
                        title="Tasa oficial BCV Euro — Clic para sincronizar en tiempo real"
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.45rem',
                            padding: '0.35rem 0.75rem', borderRadius: '8px',
                            background: tasaBCVEuro > 0 ? 'rgba(56,189,248,0.08)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${tasaBCVEuro > 0 ? 'rgba(56,189,248,0.32)' : 'rgba(255,255,255,0.08)'}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            userSelect: 'none'
                        }}
                    >
                        <Euro size={15} style={{ color: tasaBCVEuro > 0 ? '#38bdf8' : '#666' }} />
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.55rem', fontWeight: 800, color: tasaBCVEuro > 0 ? '#38bdf8' : '#666', letterSpacing: '0.1em' }}>BCV EUR</div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 900, color: tasaBCVEuro > 0 ? '#fff' : '#888', fontFamily: 'monospace', lineHeight: 1.2 }}>
                                {tasaBCVEuro > 0 ? `BS ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(tasaBCVEuro)}` : '---'}
                            </div>
                        </div>
                    </div>

                    {/* Indicador de actualización en progreso */}
                    {syncingTasas && (
                        <RefreshCw size={13} style={{ color: '#38bdf8', animation: 'spin 1s linear infinite' }} />
                    )}
                </div>

                {/* Caja Status Button con Foto y Nombre del Cajero que abrió la caja */}
                {!loadingCaja && (
                    <button
                        onClick={handleCajaClick}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.65rem',
                            padding: sesionActiva ? '0.3rem 0.85rem 0.3rem 0.45rem' : '0.45rem 1rem', 
                            borderRadius: '10px', cursor: 'pointer',
                            background: sesionActiva ? 'rgba(0,230,118,0.08)' : 'rgba(255,82,82,0.08)',
                            border: `1px solid ${sesionActiva ? 'rgba(0,230,118,0.35)' : 'rgba(255,82,82,0.3)'}`,
                            color: sesionActiva ? 'var(--s-neon)' : '#ff5252',
                            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                            boxShadow: sesionActiva ? '0 0 12px rgba(0,230,118,0.08)' : 'none'
                        }}
                        title={sesionActiva ? 'Caja abierta - Clic para ver arqueo o cerrar' : 'Caja cerrada - Clic para abrir'}
                    >
                        {sesionActiva ? (
                            <>
                                <UserAvatar
                                    src={cajeroApertura?.foto_url}
                                    name={cajeroApertura?.nombre_completo || sesionActiva?.usuario_nombre || 'Cajero'}
                                    role={cajeroApertura?.rol || sesionActiva?.usuario_cargo || 'cajero'}
                                    size={32}
                                    showOnlineDot
                                />
                                <div style={{ textAlign: 'left', lineHeight: 1.15 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <span style={{ 
                                            fontSize: '0.62rem', 
                                            fontWeight: 900, 
                                            color: 'var(--s-neon)', 
                                            letterSpacing: '0.06em',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.2rem'
                                        }}>
                                            <Unlock size={11} /> CAJA ABIERTA
                                        </span>
                                        <span style={{ fontSize: '0.52rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
                                            • {dayjs(sesionActiva.fecha_apertura).format('hh:mm A')}
                                        </span>
                                    </div>
                                    <div style={{ 
                                        fontSize: '0.78rem', 
                                        fontWeight: 800, 
                                        color: '#fff', 
                                        maxWidth: '130px', 
                                        overflow: 'hidden', 
                                        textOverflow: 'ellipsis', 
                                        whiteSpace: 'nowrap' 
                                    }}>
                                        {cajeroApertura?.nombre_completo || sesionActiva?.usuario_nombre || user?.nombre_completo || 'Edson Designer'}
                                    </div>
                                </div>
                                <Landmark size={14} style={{ color: 'var(--s-neon)', opacity: 0.6, marginLeft: '0.1rem' }} />
                            </>
                        ) : (
                            <>
                                <Lock size={15} />
                                <div style={{ textAlign: 'left', lineHeight: 1.15 }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#ff5252' }}>CAJA CERRADA</div>
                                    <div style={{ fontSize: '0.55rem', fontWeight: 700, color: 'rgba(255,82,82,0.7)' }}>CLIC PARA ABRIR</div>
                                </div>
                                <Landmark size={14} style={{ opacity: 0.6 }} />
                            </>
                        )}
                    </button>
                )}

                {/* Perfil de Usuario con Avatar, Cargo y Botón de Gestión */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', paddingLeft: '1.5rem', borderLeft: '1px solid var(--s-glass-border)' }}>
                    {/* Avatar circular */}
                    <UserAvatar
                        src={user?.foto_url}
                        name={displayName}
                        role={user?.rol}
                        size={38}
                        showOnlineDot
                    />

                    <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>
                            {displayName}
                        </div>
                        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: roleStyle.text, textTransform: 'uppercase' }}>
                            {displayRole}
                        </div>
                    </div>

                    {/* Botón Cerrar Sesión / Cambiar de Usuario */}
                    <button
                        onClick={logout}
                        title="Cerrar Sesión / Cambiar de Usuario"
                        style={{
                            background: 'rgba(255, 82, 82, 0.08)',
                            border: '1px solid rgba(255, 82, 82, 0.28)',
                            color: '#ff5252',
                            width: '2.4rem', height: '2.4rem',
                            borderRadius: '8px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', transition: 'all 0.2s',
                            marginLeft: '0.3rem'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(255, 82, 82, 0.2)'
                            e.currentTarget.style.borderColor = '#ff5252'
                            e.currentTarget.style.color = '#fff'
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(255, 82, 82, 0.08)'
                            e.currentTarget.style.borderColor = 'rgba(255, 82, 82, 0.28)'
                            e.currentTarget.style.color = '#ff5252'
                        }}
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </div>

            {/* Modal de Caja */}
            {showCajaModal && createPortal(
                <CajaModal
                    type={cajaModalType}
                    onClose={() => setShowCajaModal(false)}
                    onSessionUpdate={setSesionActiva}
                    sesionActiva={sesionActiva}
                />,
                document.body
            )}

            {/* Modal de Gestión de Usuarios y Roles */}
            {showUserManagerModal && createPortal(
                <UserManagerModal
                    onClose={() => setShowUserManagerModal(false)}
                />,
                document.body
            )}
        </header>
    )
}

export default Header
