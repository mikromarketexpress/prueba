import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { gsService } from '../lib/googleSheetsService'

const AuthContext = createContext(null)

// Permisos por defecto según cada rol del sistema
export const ROLE_DEFAULT_PERMISSIONS = {
    admin_master: ['pos', 'dashboard', 'inventory', 'cuentas-por-cobrar', 'cuentas-por-pagar', 'reportes', 'usuarios', 'configuracion'],
    admin: ['pos', 'dashboard', 'inventory', 'cuentas-por-cobrar', 'cuentas-por-pagar', 'reportes', 'configuracion'],
    supervisor: ['pos', 'dashboard', 'inventory', 'cuentas-por-cobrar', 'cuentas-por-pagar', 'reportes'],
    cajero: ['pos', 'cuentas-por-cobrar'],
    vendedor: ['pos'],
    inventario: ['inventory', 'cuentas-por-pagar'],
    personalizado: ['pos']
}

// Catálogo de módulos disponibles en el sistema
export const SYSTEM_MODULES = [
    { id: 'pos', label: 'Terminal de Venta (POS)', desc: 'Facturación, cobros, vueltos y arqueo' },
    { id: 'dashboard', label: 'Estadísticas / Dashboard', desc: 'Métricas de ventas, ingresos y utilidades' },
    { id: 'inventory', label: 'Inventario de Productos', desc: 'Gestión de productos, precios y stock' },
    { id: 'cuentas-por-cobrar', label: 'Cuentas por Cobrar', desc: 'Control de clientes a crédito y deudas' },
    { id: 'cuentas-por-pagar', label: 'Cuentas por Pagar', desc: 'Control de facturas de proveedores' },
    { id: 'reportes', label: 'Reportes y Cierres', desc: 'Historial de ventas y reportes Z / X' },
    { id: 'usuarios', label: 'Gestión de Usuarios', desc: 'Crear, editar roles y accesos de personal' },
    { id: 'configuracion', label: 'Configuración del Sistema', desc: 'Ajustes de empresa, tickets, monedas y conexión' }
]

// Perfil predeterminado del Administrador Master (control absoluto)
export const DEFAULT_MASTER_ADMIN = {
    id: 'usr_1790269997647',
    username: 'edsondesigner',
    password: 'York1604',
    nombre_completo: 'Edson Designer',
    nombre_vendedor: 'Edson Designer',
    cargo: 'Administrador Master',
    rol: 'admin_master',
    foto_url: 'https://drive.google.com/thumbnail?id=1JLaEUIVJxwpE4q3D980RW41fYGzHTwJR&sz=w400',
    permisos: ['pos', 'dashboard', 'inventory', 'cuentas-por-cobrar', 'cuentas-por-pagar', 'reportes', 'usuarios', 'configuracion'],
    estado: 'activo'
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        try {
            // Si el usuario cerró sesión explícitamente, mostrar pantalla de selección de usuario
            if (localStorage.getItem('mme_sesion_cerrada') === 'true') {
                return null
            }

            const saved = localStorage.getItem('mme_vendedor_activo')
            if (saved) {
                const parsed = JSON.parse(saved)
                if (parsed && parsed.id) {
                    const isMaster = String(parsed.rol || '').toLowerCase().includes('master') || 
                                     String(parsed.cargo || '').toLowerCase().includes('master') ||
                                     String(parsed.username || '').toLowerCase() === 'edsondesigner' ||
                                     String(parsed.nombre_completo || '').toLowerCase().includes('edson')
                    if (isMaster) {
                        return {
                            ...DEFAULT_MASTER_ADMIN,
                            ...parsed,
                            rol: 'admin_master',
                            cargo: 'Administrador Master',
                            permisos: SYSTEM_MODULES.map(m => m.id)
                        }
                    }
                    return parsed
                }
            }
        } catch (e) {}
        
        // Dejar por defecto al Administrador Master al abrir por primera vez
        try {
            localStorage.setItem('mme_vendedor_activo', JSON.stringify(DEFAULT_MASTER_ADMIN))
        } catch (e) {}
        return DEFAULT_MASTER_ADMIN
    })

    const [usuarios, setUsuarios] = useState(() => {
        try {
            const list = gsService.getUsuarios()
            return (list && list.length > 0) ? list : [DEFAULT_MASTER_ADMIN]
        } catch (e) {
            return [DEFAULT_MASTER_ADMIN]
        }
    })

    const [loadingUsuarios, setLoadingUsuarios] = useState(false)

    // Cargar usuarios desde Google Sheets / Cache
    const refreshUsuarios = useCallback(async () => {
        setLoadingUsuarios(true)
        try {
            const list = gsService.getUsuarios()
            if (list && list.length > 0) {
                setUsuarios(list)
                // Si el usuario actual es Master Admin, sincronizar datos frescos manteniendo su rol
                if (user) {
                    const freshMaster = list.find(u => 
                        String(u.rol || '').toLowerCase().includes('master') || 
                        String(u.cargo || '').toLowerCase().includes('master') ||
                        String(u.username || '').toLowerCase() === 'edsondesigner'
                    )
                    if (freshMaster) {
                        const updated = {
                            ...freshMaster,
                            rol: 'admin_master',
                            cargo: 'Administrador Master',
                            permisos: SYSTEM_MODULES.map(m => m.id)
                        }
                        setUser(updated)
                        try { localStorage.setItem('mme_vendedor_activo', JSON.stringify(updated)) } catch(e) {}
                    }
                }
            }
        } catch (err) {
            console.warn('[AuthContext] Error refrescando usuarios:', err)
        } finally {
            setLoadingUsuarios(false)
        }
    }, [user])

    useEffect(() => {
        refreshUsuarios()
    }, [])

    const login = (userData) => {
        const isMaster = String(userData.rol || '').toLowerCase().includes('master') || 
                         String(userData.cargo || '').toLowerCase().includes('master') ||
                         String(userData.username || '').toLowerCase() === 'edsondesigner' ||
                         String(userData.nombre_completo || '').toLowerCase().includes('edson')

        const fullUser = {
            ...userData,
            nombre_vendedor: userData.nombre_completo || userData.nombre_vendedor || userData.username || 'Usuario',
            rol: isMaster ? 'admin_master' : userData.rol,
            cargo: isMaster ? 'Administrador Master' : (userData.cargo || userData.rol),
            permisos: isMaster ? SYSTEM_MODULES.map(m => m.id) : (userData.permisos || [])
        }
        setUser(fullUser)
        try {
            localStorage.removeItem('mme_sesion_cerrada')
            localStorage.setItem('mme_vendedor_activo', JSON.stringify(fullUser))
        } catch (e) {}
    }

    const logout = () => {
        // Al cerrar sesión o cambiar de usuario, limpiamos la sesión activa para mostrar ProfileSelection
        setUser(null)
        try {
            localStorage.removeItem('mme_vendedor_activo')
            localStorage.setItem('mme_sesion_cerrada', 'true')
        } catch (e) {}
    }

    // Guardar / Modificar Usuario (Optimización Ultra-Rápida con Optimistic UI)
    const saveUsuario = async (userData) => {
        const prevUsuarios = [...usuarios]
        const cleanUser = {
            ...userData,
            id: userData.id || ('usr_' + Date.now()),
            fecha_creacion: userData.fecha_creacion || new Date().toISOString()
        }

        // 1. Actualización inmediata en memoria React (0 ms)
        const isExisting = prevUsuarios.some(u => String(u.id) === String(cleanUser.id))
        const nextUsuarios = isExisting
            ? prevUsuarios.map(u => String(u.id) === String(cleanUser.id) ? { ...u, ...cleanUser } : u)
            : [cleanUser, ...prevUsuarios]
        
        setUsuarios(nextUsuarios)

        // 2. Persistir de inmediato en caché local
        if (gsService.cache) {
            gsService.cache.Usuarios = nextUsuarios
            gsService._saveToLocalStorage()
        }

        // 3. Si el usuario editado es el actual, refrescar su sesión al instante
        if (user && String(user.id) === String(cleanUser.id)) {
            login({ ...user, ...cleanUser })
        }

        // 4. Sincronización en segundo plano con Google Apps Script
        try {
            const res = await gsService.upsertUsuario(cleanUser)
            if (res && res.success && res.data) {
                setUsuarios(res.data)
                if (user && String(user.id) === String(cleanUser.id)) {
                    const serverUser = res.data.find(u => String(u.id) === String(cleanUser.id))
                    if (serverUser) login({ ...user, ...serverUser })
                }
            }
            return res || { success: true }
        } catch (err) {
            console.error('[AuthContext] Error al guardar usuario en servidor, revirtiendo estado:', err)
            setUsuarios(prevUsuarios)
            if (gsService.cache) {
                gsService.cache.Usuarios = prevUsuarios
                gsService._saveToLocalStorage()
            }
            throw err
        }
    }

    // Eliminar Usuario (Optimización Ultra-Rápida con Optimistic UI)
    const removeUsuario = async (id) => {
        const prevUsuarios = [...usuarios]
        const nextUsuarios = prevUsuarios.filter(u => String(u.id) !== String(id))

        // 1. Actualización inmediata en memoria (0 ms)
        setUsuarios(nextUsuarios)
        if (gsService.cache) {
            gsService.cache.Usuarios = nextUsuarios
            gsService._saveToLocalStorage()
        }

        // 2. Sincronizar eliminación en Google Apps Script
        try {
            const res = await gsService.deleteUsuario(id)
            if (res && res.success && res.data) {
                setUsuarios(res.data)
            }
            return res || { success: true }
        } catch (err) {
            console.error('[AuthContext] Error al eliminar usuario en servidor, revirtiendo:', err)
            setUsuarios(prevUsuarios)
            if (gsService.cache) {
                gsService.cache.Usuarios = prevUsuarios
                gsService._saveToLocalStorage()
            }
            throw err
        }
    }

    // Comprobar si el usuario activo tiene acceso a un módulo específico
    const canAccess = useCallback((moduleId) => {
        if (!user) return true // El Administrador Master tiene acceso total por defecto
        
        const role = String(user.rol || '').toLowerCase().trim()
        const cargo = String(user.cargo || '').toLowerCase().trim()
        const username = String(user.username || '').toLowerCase().trim()
        const nombre = String(user.nombre_completo || user.nombre_vendedor || '').toLowerCase().trim()
        
        // EL ADMINISTRADOR MASTER LLEVA EL CONTROL TOTAL DE LA APLICACIÓN EN TODOS LOS MÓDULOS
        if (
            role === 'admin_master' || 
            role === 'administrador master' || 
            role.includes('master') || 
            cargo.includes('master') || 
            username === 'edsondesigner' ||
            nombre.includes('edson')
        ) {
            return true
        }

        // Para cualquier otro usuario, verificar permisos explícitos
        let userPerms = user.permisos
        if (typeof userPerms === 'string' && userPerms.trim() !== '') {
            try {
                userPerms = JSON.parse(userPerms)
            } catch (e) {
                userPerms = userPerms.split(',').map(s => s.trim().toLowerCase())
            }
        }
        if (Array.isArray(userPerms)) {
            return userPerms.includes(moduleId)
        }

        // Fallback a los permisos predeterminados del rol si el usuario no tiene permisos guardados
        const normalizedRole = role.replace(/\s+/g, '_')
        const defaultPerms = ROLE_DEFAULT_PERMISSIONS[normalizedRole] || ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.cajero
        return defaultPerms.includes(moduleId)
    }, [user])

    const isAuthenticated = Boolean(user && user.id)

    const isMasterAdmin = Boolean(
        user && (
            String(user.rol || '').toLowerCase().includes('master') || 
            String(user.cargo || '').toLowerCase().includes('master') ||
            String(user.username || '').toLowerCase() === 'edsondesigner' ||
            String(user.nombre_completo || '').toLowerCase().includes('edson')
        )
    )

    return (
        <AuthContext.Provider value={{
            user,
            login,
            logout,
            cambiarUsuario: logout,
            isAuthenticated,
            isMasterAdmin,
            usuarios,
            loadingUsuarios,
            refreshUsuarios,
            saveUsuario,
            removeUsuario,
            canAccess
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
