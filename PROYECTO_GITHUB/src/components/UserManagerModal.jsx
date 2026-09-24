import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
    Users, UserPlus, UserCheck, Shield, KeyRound, Lock, Eye, EyeOff, 
    Upload, Trash2, Edit3, X, Check, Search, ShieldAlert, Award,
    ShoppingCart, BarChart3, Layers, UserMinus, ClipboardList, RefreshCw, Camera, Settings
} from 'lucide-react'
import { useAuth, SYSTEM_MODULES, ROLE_DEFAULT_PERMISSIONS } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import UserAvatar from './UserAvatar'

// Avatares rápidos predeterminados
const PRESET_AVATARS = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'
]

const CARGO_SUGGESTIONS = [
    'Administrador Master',
    'Gerente de Tienda',
    'Administrador General',
    'Supervisor de Turno',
    'Cajero Principal',
    'Vendedor de Mostrador',
    'Cajero de Turno',
    'Encargado de Inventario',
    'Auditor / Finanzas'
]

const MODULE_ICONS = {
    'pos': ShoppingCart,
    'dashboard': BarChart3,
    'inventory': Layers,
    'cuentas-por-cobrar': UserPlus,
    'cuentas-por-pagar': UserMinus,
    'reportes': ClipboardList,
    'usuarios': Users,
    'configuracion': Settings
}

const ROLE_COLORS = {
    admin_master: { bg: 'rgba(255, 215, 0, 0.18)', text: '#ffd700', border: 'rgba(255, 215, 0, 0.5)' },
    admin: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' },
    supervisor: { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.3)' },
    cajero: { bg: 'rgba(0, 230, 118, 0.15)', text: 'var(--s-neon)', border: 'rgba(0, 230, 118, 0.3)' },
    vendedor: { bg: 'rgba(6, 182, 212, 0.15)', text: '#06b6d4', border: 'rgba(6, 182, 212, 0.3)' },
    inventario: { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)' },
    personalizado: { bg: 'rgba(251, 191, 36, 0.15)', text: '#fbbf24', border: 'rgba(251, 191, 36, 0.3)' }
}

const UserManagerModal = ({ onClose }) => {
    const { user: currentUser, usuarios, saveUsuario, removeUsuario, loadingUsuarios } = useAuth()
    const { showToast } = useToast()

    const [searchTerm, setSearchTerm] = useState('')
    const [editingUserId, setEditingUserId] = useState(null)
    const [saving, setSaving] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    // Formulario de usuario
    const [formData, setFormData] = useState({
        id: '',
        username: '',
        password: '',
        nombre_completo: '',
        cargo: 'Cajero de Turno',
        rol: 'cajero',
        foto_url: '',
        foto_base64: '',
        permisos: [...ROLE_DEFAULT_PERMISSIONS.cajero],
        estado: 'activo'
    })

    const fileInputRef = useRef(null)

    // Al cambiar el rol en el formulario, sugerir permisos por defecto
    const handleRoleChange = (newRole) => {
        let defaultPerms = ROLE_DEFAULT_PERMISSIONS[newRole]
        if (!defaultPerms) {
            if (newRole === 'admin_master') defaultPerms = SYSTEM_MODULES.map(m => m.id)
            else if (newRole === 'vendedor') defaultPerms = ['pos']
            else defaultPerms = ['pos']
        }
        setFormData(prev => ({
            ...prev,
            rol: newRole,
            permisos: [...defaultPerms]
        }))
    }

    // Toggle módulo en permisos (marcado individual de checkboxes por el Administrador Master)
    const togglePermiso = (moduleId) => {
        setFormData(prev => {
            const has = prev.permisos.includes(moduleId)
            const updated = has 
                ? prev.permisos.filter(p => p !== moduleId)
                : [...prev.permisos, moduleId]
            return {
                ...prev,
                permisos: updated
            }
        })
    }

    // Seleccionar o desmarcar todos los permisos
    const handleSelectAllPermisos = (all) => {
        setFormData(prev => ({
            ...prev,
            permisos: all ? SYSTEM_MODULES.map(m => m.id) : []
        }))
    }

    // Iniciar edición de un usuario
    const handleEditUser = (userItem) => {
        setEditingUserId(userItem.id)
        let perms = userItem.permisos
        if (typeof perms === 'string') {
            try { perms = JSON.parse(perms); } catch(e) { perms = []; }
        }
        if (!Array.isArray(perms) || perms.length === 0) {
            perms = ROLE_DEFAULT_PERMISSIONS[userItem.rol] || ['pos']
        }

        setFormData({
            id: userItem.id,
            username: userItem.username || '',
            password: userItem.password || '',
            nombre_completo: userItem.nombre_completo || userItem.nombre_vendedor || '',
            cargo: userItem.cargo || 'Cajero de Turno',
            rol: userItem.rol || 'cajero',
            foto_url: userItem.foto_url || '',
            foto_base64: '',
            permisos: [...perms],
            estado: userItem.estado || 'activo'
        })
    }

    // Nuevo usuario (limpiar formulario)
    const handleNewUser = () => {
        setEditingUserId('new')
        setFormData({
            id: 'usr_' + Date.now(),
            username: '',
            password: '',
            nombre_completo: '',
            cargo: 'Cajero de Turno',
            rol: 'cajero',
            foto_url: '',
            foto_base64: '',
            permisos: [...ROLE_DEFAULT_PERMISSIONS.cajero],
            estado: 'activo'
        })
    }

    // Procesar carga de foto desde disco con optimización ultra-rápida (256x256 max, compresión óptima)
    const handlePhotoUpload = (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            showToast('Por favor selecciona un archivo de imagen válido', 'error')
            return
        }

        const reader = new FileReader()
        reader.onload = (event) => {
            const rawBase64 = event.target.result
            const img = new Image()
            img.onload = () => {
                const canvas = document.createElement('canvas')
                // 256px es perfecto para fotos de perfil y minimiza el tiempo de red a < 0.2s
                const maxDim = 256
                let width = img.width
                let height = img.height
                if (width > height) {
                    if (width > maxDim) {
                        height = Math.round((height * maxDim) / width)
                        width = maxDim
                    }
                } else {
                    if (height > maxDim) {
                        width = Math.round((width * maxDim) / height)
                        height = maxDim
                    }
                }
                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')
                ctx.drawImage(img, 0, 0, width, height)
                // Comprimir con calidad 0.72 (reduce payload a ~12-16KB sin perder nitidez)
                const compressed = canvas.toDataURL('image/jpeg', 0.72)
                setFormData(prev => ({
                    ...prev,
                    foto_url: compressed,
                    foto_base64: compressed
                }))
                showToast('⚡ Foto optimizada y lista para guardar de inmediato', 'info')
            }
            img.onerror = () => {
                setFormData(prev => ({
                    ...prev,
                    foto_url: rawBase64,
                    foto_base64: rawBase64
                }))
            }
            img.src = rawBase64
        }
        reader.readAsDataURL(file)
    }

    // Guardar usuario con respuesta instantánea (Optimistic UI)
    const handleSave = async (e) => {
        e.preventDefault()

        if (!formData.nombre_completo.trim()) {
            showToast('Ingresa el nombre completo del usuario', 'warning')
            return
        }
        if (!formData.username.trim()) {
            showToast('Ingresa un nombre de usuario válido', 'warning')
            return
        }
        if (!formData.password.trim()) {
            showToast('Ingresa una contraseña para el usuario', 'warning')
            return
        }
        if (formData.permisos.length === 0) {
            showToast('Asigna al menos un módulo de acceso al usuario', 'warning')
            return
        }

        // Validar username duplicado
        const cleanUsername = formData.username.trim().toLowerCase()
        const duplicate = usuarios.find(u => u.username?.toLowerCase() === cleanUsername && u.id !== formData.id)
        if (duplicate) {
            showToast(`El nombre de usuario "${cleanUsername}" ya está en uso`, 'error')
            return
        }

        const payload = {
            ...formData,
            username: cleanUsername,
            nombre_completo: formData.nombre_completo.trim()
        }

        // Actualización y cierre/limpieza instantánea (0 ms de espera para el usuario)
        showToast(`⚡ Guardando usuario "${payload.nombre_completo}"...`, 'info')
        handleNewUser()

        // Ejecutar guardado en segundo plano
        saveUsuario(payload).then((res) => {
            if (res && res.success === false) {
                showToast('Error en la base de datos: ' + (res.error || 'No se pudo sincronizar'), 'error')
            } else {
                showToast(`✅ Usuario "${payload.nombre_completo}" guardado y sincronizado`, 'success')
            }
        }).catch((err) => {
            showToast('Error al sincronizar con Google Sheets: ' + (err.message || 'Error de red'), 'error')
        })
    }

    // Eliminar usuario con respuesta instantánea
    const handleDeleteUser = async (userToDelete) => {
        if (userToDelete.id === currentUser?.id) {
            showToast('No puedes eliminar tu propio usuario en sesión activa', 'warning')
            return
        }
        if (userToDelete.id === 'usr_admin_1' || ((userToDelete.rol === 'admin' || userToDelete.rol === 'admin_master') && usuarios.filter(u => u.rol === 'admin' || u.rol === 'admin_master').length <= 1)) {
            showToast('No se puede eliminar el único administrador del sistema', 'error')
            return
        }

        const confirm = window.confirm(`¿Estás seguro de eliminar permanentemente al usuario "${userToDelete.nombre_completo || userToDelete.username}" de la base de datos?`)
        if (!confirm) return

        if (editingUserId === userToDelete.id) {
            handleNewUser()
        }
        showToast(`⚡ Eliminando usuario "${userToDelete.nombre_completo || userToDelete.username}"...`, 'info')

        removeUsuario(userToDelete.id).then((res) => {
            if (res && res.success === false) {
                showToast('Error al eliminar en Google Sheets: ' + (res.error || 'No se pudo eliminar'), 'error')
            } else {
                showToast('✅ Usuario eliminado correctamente', 'success')
            }
        }).catch((err) => {
            showToast('Error al eliminar usuario en Google Sheets: ' + err.message, 'error')
        })
    }

    // Filtrar lista de usuarios
    const filteredUsuarios = usuarios.filter(u => {
        const q = searchTerm.toLowerCase().trim()
        if (!q) return true
        return (
            (u.nombre_completo || '').toLowerCase().includes(q) ||
            (u.username || '').toLowerCase().includes(q) ||
            (u.cargo || '').toLowerCase().includes(q) ||
            (u.rol || '').toLowerCase().includes(q)
        )
    })

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 999999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(10px)',
            padding: '1.5rem'
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="s-panel"
                style={{
                    width: '100%', maxWidth: '1150px', maxHeight: '92vh',
                    display: 'flex', flexDirection: 'column',
                    background: '#0d1117', border: '1px solid rgba(0, 230, 118, 0.25)',
                    boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 35px rgba(0, 230, 118, 0.1)',
                    borderRadius: '16px', overflow: 'hidden'
                }}
            >
                {/* Header del Modal */}
                <div style={{
                    padding: '1.25rem 1.75rem',
                    borderBottom: '1px solid var(--s-glass-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(255, 255, 255, 0.02)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{
                            padding: '0.6rem', borderRadius: '10px',
                            background: 'rgba(0, 230, 118, 0.12)', border: '1px solid rgba(0, 230, 118, 0.3)'
                        }}>
                            <Users size={22} style={{ color: 'var(--s-neon)' }} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff', letterSpacing: '0.05em' }}>
                                    GESTIÓN DE USUARIOS Y ROLES
                                </h2>
                                <span style={{
                                    fontSize: '0.65rem', fontWeight: 800, padding: '0.2rem 0.6rem',
                                    borderRadius: '12px', background: 'rgba(0,230,118,0.15)',
                                    color: 'var(--s-neon)', border: '1px solid rgba(0,230,118,0.3)'
                                }}>
                                    {usuarios.length} {usuarios.length === 1 ? 'USUARIO' : 'USUARIOS'}
                                </span>
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--s-text-dim)', marginTop: '0.15rem' }}>
                                Administra las credenciales, foto, cargo y permisos de acceso para cada colaborador
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--s-glass-border)',
                            color: '#fff', width: '2.4rem', height: '2.4rem', borderRadius: '8px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = '#ff5252'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--s-glass-border)'}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Contenido en dos columnas */}
                <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    
                    {/* COLUMNA IZQUIERDA: Lista de Usuarios */}
                    <div style={{
                        borderRight: '1px solid var(--s-glass-border)',
                        display: 'flex', flexDirection: 'column', background: 'rgba(0, 0, 0, 0.25)',
                        overflow: 'hidden'
                    }}>
                        {/* Barra de Búsqueda y Botón Nuevo */}
                        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderBottom: '1px solid var(--s-glass-border)' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--s-text-dim)' }} />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre, usuario o cargo..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    style={{
                                        width: '100%', padding: '0.65rem 0.85rem 0.65rem 2.4rem',
                                        background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--s-glass-border)',
                                        borderRadius: '8px', color: '#fff', fontSize: '0.8rem', outline: 'none'
                                    }}
                                />
                            </div>

                            <button
                                onClick={handleNewUser}
                                className="s-btn s-btn-primary"
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                    fontSize: '0.8rem', fontWeight: 800, padding: '0.65rem', borderRadius: '8px'
                                }}
                            >
                                <UserPlus size={16} />
                                AGREGAR NUEVO USUARIO
                            </button>
                        </div>

                        {/* Lista Scrollable */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {filteredUsuarios.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--s-text-dim)' }}>
                                    <Users size={36} style={{ opacity: 0.3, margin: '0 auto 0.75rem' }} />
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>No se encontraron usuarios</div>
                                    <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Prueba con otro término de búsqueda</div>
                                </div>
                            ) : (
                                filteredUsuarios.map(u => {
                                    const isSelected = editingUserId === u.id
                                    const normalizedRole = String(u.rol || 'cajero').toLowerCase().trim().replace(/\s+/g, '_')
                                    const roleStyle = ROLE_COLORS[normalizedRole] || (normalizedRole.includes('master') ? ROLE_COLORS.admin_master : (normalizedRole.includes('vendedor') ? ROLE_COLORS.vendedor : ROLE_COLORS.cajero))
                                    const roleLabel = normalizedRole.includes('master') ? 'ADMIN MASTER' : (normalizedRole.includes('vendedor') ? 'VENDEDOR' : (u.rol || 'cajero'))
                                    const isSelf = currentUser?.id === u.id

                                    return (
                                        <div
                                            key={u.id}
                                            onClick={() => handleEditUser(u)}
                                            style={{
                                                padding: '0.85rem', borderRadius: '10px',
                                                background: isSelected ? 'rgba(0, 230, 118, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                                                border: `1px solid ${isSelected ? 'var(--s-neon)' : 'var(--s-glass-border)'}`,
                                                cursor: 'pointer', transition: 'all 0.15s ease',
                                                display: 'flex', alignItems: 'center', gap: '0.85rem'
                                            }}
                                        >
                                            {/* Avatar del usuario */}
                                            <UserAvatar
                                                src={u.foto_url}
                                                name={u.nombre_completo || u.username}
                                                role={u.rol}
                                                size={44}
                                                showOnlineDot
                                            />

                                            {/* Info */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {u.nombre_completo || u.username}
                                                    </span>
                                                    {isSelf && (
                                                        <span style={{ fontSize: '0.55rem', fontWeight: 800, padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(56,189,248,0.2)', color: '#38bdf8' }}>
                                                             TÚ
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--s-text-dim)', marginTop: '0.15rem' }}>
                                                    @{u.username} • <span style={{ color: '#fff', fontWeight: 600 }}>{u.cargo || 'Personal'}</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                                                    <span style={{
                                                        fontSize: '0.6rem', fontWeight: 800, padding: '0.15rem 0.5rem',
                                                        borderRadius: '6px', background: roleStyle.bg, color: roleStyle.text,
                                                        border: `1px solid ${roleStyle.border}`, textTransform: 'uppercase'
                                                    }}>
                                                        {roleLabel}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Acciones */}
                                            <div style={{ display: 'flex', gap: '0.3rem' }} onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => handleEditUser(u)}
                                                    title="Editar usuario"
                                                    style={{
                                                        background: 'rgba(255,255,255,0.05)', border: '1px solid var(--s-glass-border)',
                                                        color: '#fff', width: '2rem', height: '2rem', borderRadius: '6px',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <Edit3 size={13} />
                                                </button>
                                                {!isSelf && (
                                                    <button
                                                        onClick={() => handleDeleteUser(u)}
                                                        title="Eliminar usuario"
                                                        style={{
                                                            background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)',
                                                            color: '#f87171', width: '2rem', height: '2rem', borderRadius: '6px',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* COLUMNA DERECHA: Formulario de Usuario */}
                    <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '1.5rem 2rem' }}>
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--s-glass-border)', paddingBottom: '0.85rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', letterSpacing: '0.05em' }}>
                                        {editingUserId && editingUserId !== 'new' ? 'EDITAR INFORMACIÓN DE USUARIO' : 'CREAR NUEVO COLABORADOR'}
                                    </h3>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--s-text-dim)', marginTop: '0.2rem' }}>
                                        Configura los datos personales, cargo laboral y accesos asignados
                                    </p>
                                </div>
                                <span style={{
                                    fontSize: '0.65rem', fontWeight: 800, color: 'var(--s-neon)',
                                    background: 'rgba(0, 230, 118, 0.08)', padding: '0.3rem 0.7rem',
                                    borderRadius: '6px', border: '1px solid rgba(0, 230, 118, 0.2)'
                                }}>
                                    ID: {formData.id || 'NUEVO'}
                                </span>
                            </div>

                            {/* Sección 1: Foto de Perfil */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '1.5rem',
                                background: 'rgba(255, 255, 255, 0.02)', padding: '1rem',
                                borderRadius: '12px', border: '1px solid var(--s-glass-border)'
                            }}>
                                <UserAvatar
                                    src={formData.foto_url}
                                    name={formData.nombre_completo || 'Nuevo'}
                                    role={formData.rol}
                                    size={74}
                                />

                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>Foto de Perfil</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--s-text-dim)', marginTop: '0.15rem' }}>
                                        Sube una foto personalizada o selecciona un avatar predeterminado
                                    </div>
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            accept="image/*"
                                            onChange={handlePhotoUpload}
                                            style={{ display: 'none' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                                background: 'rgba(0, 230, 118, 0.12)', border: '1px solid rgba(0, 230, 118, 0.3)',
                                                color: 'var(--s-neon)', padding: '0.4rem 0.75rem', borderRadius: '6px',
                                                fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer'
                                            }}
                                        >
                                            <Upload size={14} /> Subir Foto
                                        </button>

                                        {formData.foto_url && (
                                            <button
                                                type="button"
                                                onClick={() => setFormData(p => ({ ...p, foto_url: '', foto_base64: '' }))}
                                                style={{
                                                    background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--s-glass-border)',
                                                    color: '#ff5252', padding: '0.4rem 0.75rem', borderRadius: '6px',
                                                    fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer'
                                                }}
                                            >
                                                Quitar Foto
                                            </button>
                                        )}

                                        {/* Avatares predefinidos */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.5rem' }}>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--s-text-dim)' }}>Predefinidos:</span>
                                            {PRESET_AVATARS.map((avUrl, i) => (
                                                <img
                                                    key={i}
                                                    src={avUrl}
                                                    alt="Avatar preset"
                                                    onClick={() => setFormData(p => ({ ...p, foto_url: avUrl, foto_base64: '' }))}
                                                    style={{
                                                        width: '26px', height: '26px', borderRadius: '50%',
                                                        objectFit: 'cover', cursor: 'pointer',
                                                        border: formData.foto_url === avUrl ? '2px solid var(--s-neon)' : '1px solid rgba(255,255,255,0.2)',
                                                        transition: 'transform 0.15s'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sección 2: Campos de Texto (Nombre Completo, Username, Password, Cargo) */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#fff', marginBottom: '0.4rem' }}>
                                        NOMBRE COMPLETO *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: Edson Gómez"
                                        value={formData.nombre_completo}
                                        onChange={e => setFormData({ ...formData, nombre_completo: e.target.value })}
                                        style={{
                                            width: '100%', padding: '0.7rem 0.85rem',
                                            background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--s-glass-border)',
                                            borderRadius: '8px', color: '#fff', fontSize: '0.85rem', outline: 'none'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#fff', marginBottom: '0.4rem' }}>
                                        NOMBRE DE USUARIO (LOGIN) *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: egomez"
                                        value={formData.username}
                                        onChange={e => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                                        style={{
                                            width: '100%', padding: '0.7rem 0.85rem',
                                            background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--s-glass-border)',
                                            borderRadius: '8px', color: '#fff', fontSize: '0.85rem', outline: 'none'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#fff', marginBottom: '0.4rem' }}>
                                        CONTRASEÑA DE ACCESO *
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            placeholder="Contraseña del usuario"
                                            value={formData.password}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                            style={{
                                                width: '100%', padding: '0.7rem 2.5rem 0.7rem 0.85rem',
                                                background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--s-glass-border)',
                                                borderRadius: '8px', color: '#fff', fontSize: '0.85rem', outline: 'none'
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(p => !p)}
                                            style={{
                                                position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                                                background: 'transparent', border: 'none', color: 'var(--s-text-dim)',
                                                cursor: 'pointer', display: 'flex', alignItems: 'center'
                                            }}
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#fff', marginBottom: '0.4rem' }}>
                                        CARGO / PUESTO LABORAL *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: Cajero Principal"
                                        value={formData.cargo}
                                        onChange={e => setFormData({ ...formData, cargo: e.target.value })}
                                        style={{
                                            width: '100%', padding: '0.7rem 0.85rem',
                                            background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--s-glass-border)',
                                            borderRadius: '8px', color: '#fff', fontSize: '0.85rem', outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Sugerencias rápidas de cargo */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--s-text-dim)' }}>Sugerir cargo:</span>
                                {CARGO_SUGGESTIONS.map(sug => (
                                    <button
                                        key={sug}
                                        type="button"
                                        onClick={() => {
                                            let autoRole = 'cajero'
                                            const lowerSug = sug.toLowerCase()
                                            if (lowerSug.includes('master')) autoRole = 'admin_master'
                                            else if (lowerSug.includes('gerente') || lowerSug.includes('admin')) autoRole = 'admin'
                                            else if (lowerSug.includes('supervisor')) autoRole = 'supervisor'
                                            else if (lowerSug.includes('vendedor')) autoRole = 'vendedor'
                                            else if (lowerSug.includes('inventario') || lowerSug.includes('almacen')) autoRole = 'inventario'
                                            
                                            setFormData(p => ({
                                                ...p,
                                                cargo: sug,
                                                rol: autoRole,
                                                permisos: [...(ROLE_DEFAULT_PERMISSIONS[autoRole] || ['pos'])]
                                            }))
                                        }}
                                        style={{
                                            fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.55rem',
                                            borderRadius: '6px', background: formData.cargo === sug ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255,255,255,0.03)',
                                            color: formData.cargo === sug ? 'var(--s-neon)' : 'var(--s-text-dim)',
                                            border: `1px solid ${formData.cargo === sug ? 'var(--s-neon)' : 'var(--s-glass-border)'}`,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {sug}
                                    </button>
                                ))}
                            </div>

                            {/* Sección 3: Rol del Sistema */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>
                                    NIVEL DE ROL EN EL SISTEMA
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem' }}>
                                    {[
                                        { id: 'admin_master', label: 'Administrador Master', desc: 'Acceso total A la aplicación' },
                                        { id: 'admin', label: 'Administrador', desc: 'Gestión completa y configuración' },
                                        { id: 'supervisor', label: 'Supervisor', desc: 'Ventas, reportes y caja' },
                                        { id: 'cajero', label: 'Cajero', desc: 'Terminal POS y cobros' },
                                        { id: 'vendedor', label: 'Vendedor', desc: 'Acceso solo al TPV' },
                                        { id: 'inventario', label: 'Inventario', desc: 'Productos y compras' },
                                        { id: 'personalizado', label: 'Personalizado', desc: 'Permisos a la medida' },
                                    ].map(r => {
                                        const isSelected = formData.rol === r.id || (r.id === 'admin_master' && (formData.rol === 'admin_master' || formData.rol === 'administrador master'))
                                        const roleSt = ROLE_COLORS[r.id] || ROLE_COLORS.cajero
                                        return (
                                            <div
                                                key={r.id}
                                                onClick={() => handleRoleChange(r.id)}
                                                style={{
                                                    padding: '0.75rem 0.6rem', borderRadius: '8px',
                                                    background: isSelected ? roleSt.bg : 'rgba(255,255,255,0.02)',
                                                    border: `1px solid ${isSelected ? roleSt.text : 'var(--s-glass-border)'}`,
                                                    cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <div style={{ fontSize: '0.8rem', fontWeight: 900, color: isSelected ? roleSt.text : '#fff' }}>
                                                    {r.label}
                                                </div>
                                                <div style={{ fontSize: '0.62rem', color: 'var(--s-text-dim)', marginTop: '0.2rem', lineHeight: 1.2 }}>
                                                    {r.desc}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Sección 4: Permisos de Acceso a Módulos (Matriz de Checkboxes) */}
                            <div>
                                {(formData.rol === 'admin_master' || formData.rol === 'administrador master') ? (
                                    <div style={{
                                        padding: '0.75rem 1rem', borderRadius: '8px',
                                        background: 'rgba(255, 215, 0, 0.1)', border: '1px solid rgba(255, 215, 0, 0.4)',
                                        display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.85rem'
                                    }}>
                                        <Award size={20} style={{ color: '#ffd700', flexShrink: 0 }} />
                                        <div style={{ fontSize: '0.75rem', color: '#fff' }}>
                                            <strong style={{ color: '#ffd700' }}>👑 Rol Exclusivo:</strong> Solo el <strong>Administrador Master</strong> tiene acceso total e incondicional a todos los módulos del sistema.
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{
                                        padding: '0.7rem 1rem', borderRadius: '8px',
                                        background: 'rgba(0, 230, 118, 0.05)', border: '1px solid rgba(0, 230, 118, 0.25)',
                                        display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.85rem'
                                    }}>
                                        <Check size={18} style={{ color: 'var(--s-neon)', flexShrink: 0 }} />
                                        <div style={{ fontSize: '0.75rem', color: '#fff' }}>
                                            <strong style={{ color: 'var(--s-neon)' }}>Control por Checkboxes:</strong> El Administrador Master marca o desmarca los módulos que este usuario podrá ver en la aplicación.
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fff' }}>
                                        MÓDULOS DE ACCESO HABILITADOS ({formData.permisos.length} DE {SYSTEM_MODULES.length})
                                    </label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            type="button"
                                            onClick={() => handleSelectAllPermisos(true)}
                                            style={{
                                                background: 'none', border: 'none', color: 'var(--s-neon)',
                                                fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer'
                                            }}
                                        >
                                            Seleccionar Todos
                                        </button>
                                        <span style={{ color: 'var(--s-text-dim)', fontSize: '0.65rem' }}>•</span>
                                        <button
                                            type="button"
                                            onClick={() => handleSelectAllPermisos(false)}
                                            style={{
                                                background: 'none', border: 'none', color: 'var(--s-text-dim)',
                                                fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer'
                                            }}
                                        >
                                            Desmarcar Todos
                                        </button>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.6rem' }}>
                                    {SYSTEM_MODULES.map(mod => {
                                        const checked = formData.permisos.includes(mod.id)
                                        const ModIcon = MODULE_ICONS[mod.id] || Layers

                                        return (
                                            <div
                                                key={mod.id}
                                                onClick={() => togglePermiso(mod.id)}
                                                style={{
                                                    padding: '0.7rem 0.85rem', borderRadius: '8px',
                                                    background: checked ? 'rgba(0, 230, 118, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                                                    border: `1px solid ${checked ? 'rgba(0, 230, 118, 0.35)' : 'var(--s-glass-border)'}`,
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <div style={{
                                                    width: '18px', height: '18px', borderRadius: '4px',
                                                    background: checked ? 'var(--s-neon)' : 'transparent',
                                                    border: `1px solid ${checked ? 'var(--s-neon)' : 'rgba(255,255,255,0.3)'}`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    {checked && <Check size={12} style={{ color: '#000', strokeWidth: 3 }} />}
                                                </div>

                                                <ModIcon size={16} style={{ color: checked ? 'var(--s-neon)' : 'var(--s-text-dim)' }} />

                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: checked ? '#fff' : 'var(--s-text-dim)' }}>
                                                        {mod.label}
                                                    </div>
                                                    <div style={{ fontSize: '0.62rem', color: 'var(--s-text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {mod.desc}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Botones de acción del Formulario */}
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--s-glass-border)' }}>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="s-btn s-btn-primary"
                                    style={{
                                        flex: 2, height: '3.2rem', fontSize: '0.9rem', fontWeight: 900,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem'
                                    }}
                                >
                                    {saving ? (
                                        <>
                                            <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                                            GUARDANDO EN GOOGLE SHEETS...
                                        </>
                                    ) : (
                                        <>
                                            <Check size={18} />
                                            GUARDAR USUARIO
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={handleNewUser}
                                    style={{
                                        flex: 1, height: '3.2rem', fontSize: '0.85rem', fontWeight: 800,
                                        background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--s-glass-border)',
                                        color: '#fff', borderRadius: '8px', cursor: 'pointer'
                                    }}
                                >
                                    LIMPIAR FORMULARIO
                                </button>
                            </div>

                        </form>
                    </div>

                </div>
            </motion.div>
        </div>
    )
}

export default UserManagerModal
