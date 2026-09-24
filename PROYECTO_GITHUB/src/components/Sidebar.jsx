import { ShoppingCart, BarChart3, Layers, HelpCircle, UserPlus, UserMinus, ClipboardList, Users, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import UserAvatar from './UserAvatar'

const NAV = [
    { id: 'pos', label: 'TERMINAL DE VENTA', Icon: ShoppingCart },
    { id: 'dashboard', label: 'ESTADÍSTICAS', Icon: BarChart3 },
    { id: 'inventory', label: 'INVENTARIO', Icon: Layers },
    { id: 'cuentas-por-cobrar', label: 'CUENTAS POR COBRAR', Icon: UserPlus },
    { id: 'cuentas-por-pagar', label: 'CUENTAS POR PAGAR', Icon: UserMinus },
    { id: 'reportes', label: 'REPORTES', Icon: ClipboardList },
]

const Sidebar = ({ activePage, setActivePage, onOpenUserManager }) => {
    const { canAccess, user, logout } = useAuth()
    const allowedNav = NAV.filter(item => canAccess(item.id))

    return (
        <aside className="s-sidebar no-print" style={{ width: 'var(--sidebar-w)', display: 'flex', flexDirection: 'column', gap: 'var(--gap-2)', flexShrink: 0, height: '100%', minHeight: 0 }}>
            <div className="s-panel" style={{ padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <span className="s-section-label" style={{ flexShrink: 0, marginBottom: '0.2rem', paddingLeft: '0.25rem' }}>Menú Principal</span>
                <div 
                    className="s-scroll"
                    style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '0.35rem', 
                        flex: 1, 
                        minHeight: 0, 
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        paddingRight: '4px'
                    }}
                >
                    {allowedNav.map(({ id, label, Icon }) => (
                        <button
                            key={id}
                            className={`s-nav-btn ${activePage === id ? 'active' : ''}`}
                            onClick={() => setActivePage(id)}
                            style={{ flexShrink: 0 }}
                        >
                            <Icon size={18} style={{ color: activePage === id ? '#000' : 'var(--s-neon)', flexShrink: 0 }} />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                        </button>
                    ))}

                    {canAccess('usuarios') && (
                        <button
                            className="s-nav-btn"
                            onClick={() => {
                                if (onOpenUserManager) onOpenUserManager()
                                else window.dispatchEvent(new CustomEvent('open-user-manager'))
                            }}
                            style={{
                                marginTop: '0.25rem',
                                border: '1px dashed rgba(0, 230, 118, 0.3)',
                                background: 'rgba(0, 230, 118, 0.04)',
                                flexShrink: 0
                            }}
                        >
                            <Users size={18} style={{ color: 'var(--s-neon)', flexShrink: 0 }} />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>USUARIOS Y ROLES</span>
                        </button>
                    )}
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', flexShrink: 0, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    {/* Tarjeta de usuario activo con acción para cambiar de usuario */}
                    {user && (
                        <div 
                            onClick={logout}
                            title="Clic para cambiar de usuario o cerrar sesión"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                padding: '0.65rem 0.85rem', borderRadius: '10px',
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid var(--s-glass-border)',
                                cursor: 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(255, 82, 82, 0.08)'
                                e.currentTarget.style.borderColor = 'rgba(255, 82, 82, 0.4)'
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
                                e.currentTarget.style.borderColor = 'var(--s-glass-border)'
                            }}
                        >
                            <UserAvatar
                                src={user.foto_url}
                                name={user.nombre_completo || user.nombre_vendedor || user.username}
                                role={user.rol}
                                size={36}
                                showOnlineDot
                            />
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {user.nombre_completo || user.nombre_vendedor || user.username}
                                </div>
                                <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--s-neon)', textTransform: 'uppercase' }}>
                                    {user.cargo || user.rol || 'PERSONAL'}
                                </div>
                            </div>
                            <LogOut size={14} style={{ color: '#ff5252', opacity: 0.6 }} />
                        </div>
                    )}

                    <button
                        className="s-nav-btn"
                        onClick={() => window.dispatchEvent(new CustomEvent('toggle-help'))}
                    >
                        <HelpCircle size={18} style={{ color: 'var(--s-neon)' }} />
                        AYUDA (F1)
                    </button>

                    {canAccess('configuracion') && (
                        <button
                            className={`s-nav-btn ${activePage === 'configuracion' ? 'active' : ''}`}
                            onClick={() => setActivePage('configuracion')}
                        >
                            <Settings size={18} style={{ color: activePage === 'configuracion' ? '#000' : 'var(--s-neon)' }} />
                            CONFIGURACIÓN
                        </button>
                    )}
                </div>
            </div>
        </aside>
    )
}

export default Sidebar