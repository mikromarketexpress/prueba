import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { gsService } from '../lib/googleSheetsService'

const CajaContext = createContext(null)

const SESION_STORAGE_KEY = 'mme_sesion_caja_id'

export const CajaProvider = ({ children }) => {
    const [sesionActiva, setSesionActiva] = useState(null)
    const [loading, setLoading] = useState(true)
    const [tasaBCV, setTasaBCV] = useState(() => {
        const saved = localStorage.getItem('mme_tasa_bcv')
        return saved ? parseFloat(saved) : (gsService.getTasaBcv() || 0)
    })
    const [tasaBCVEuro, setTasaBCVEuro] = useState(() => {
        const saved = localStorage.getItem('mme_tasa_bcv_euro')
        return saved ? parseFloat(saved) : (gsService.getTasaBcvEuro() || 0)
    })

    const isCajaAbierta = !!sesionActiva

    const updateTasaBCV = useCallback((tasa) => {
        const num = parseFloat(tasa) || 0
        setTasaBCV(num)
        localStorage.setItem('mme_tasa_bcv', num.toString())
    }, [])

    const updateTasaBCVEuro = useCallback((tasa) => {
        const num = parseFloat(tasa) || 0
        setTasaBCVEuro(num)
        localStorage.setItem('mme_tasa_bcv_euro', num.toString())
    }, [])

    // Escuchar actualizaciones de tasas en tiempo real emitidas por gsService o entre pestañas
    useEffect(() => {
        const handleTasasUpdated = (e) => {
            if (e.detail) {
                if (e.detail.tasaBcv > 0) {
                    setTasaBCV(e.detail.tasaBcv)
                }
                if (e.detail.tasaBcvEuro > 0) {
                    setTasaBCVEuro(e.detail.tasaBcvEuro)
                }
            }
        }

        const handleStorage = (e) => {
            if (e.key === 'mme_tasa_bcv' && e.newValue) {
                const val = parseFloat(e.newValue)
                if (val > 0) setTasaBCV(val)
            }
            if (e.key === 'mme_tasa_bcv_euro' && e.newValue) {
                const val = parseFloat(e.newValue)
                if (val > 0) setTasaBCVEuro(val)
            }
        }

        window.addEventListener('mme_tasas_updated', handleTasasUpdated)
        window.addEventListener('storage', handleStorage)

        return () => {
            window.removeEventListener('mme_tasas_updated', handleTasasUpdated)
            window.removeEventListener('storage', handleStorage)
        }
    }, [])

    useEffect(() => {
        const loadSesion = async () => {
            try {
                await gsService.initialize()
                const sesiones = gsService.getTable('Caja') || []
                const activa = sesiones.find(s => s.estado === 'ACTIVA') || null
                setSesionActiva(activa)

                if (activa) {
                    localStorage.setItem(SESION_STORAGE_KEY, activa.id)
                } else {
                    const savedId = localStorage.getItem(SESION_STORAGE_KEY)
                    if (savedId) {
                        const savedSesion = sesiones.find(s => String(s.id) === String(savedId))
                        if (savedSesion) {
                            setSesionActiva(savedSesion)
                        } else {
                            localStorage.removeItem(SESION_STORAGE_KEY)
                        }
                    }
                }

                // Cargar tasas del cache
                const tasaDb = gsService.tasaBcv || gsService.getTasaBcv() || 0
                if (tasaDb > 0) {
                    setTasaBCV(tasaDb)
                    localStorage.setItem('mme_tasa_bcv', tasaDb.toString())
                }

                const tasaEuroDb = gsService.tasaBcvEuro || gsService.getTasaBcvEuro() || 0
                if (tasaEuroDb > 0) {
                    setTasaBCVEuro(tasaEuroDb)
                    localStorage.setItem('mme_tasa_bcv_euro', tasaEuroDb.toString())
                }

                // Sincronizar ambas tasas automáticamente en tiempo real
                try {
                    const syncResult = await gsService.fetchAndUpdateTasas()
                    if (syncResult?.success && syncResult.data) {
                        if (syncResult.data.tasa_bcv > 0) setTasaBCV(syncResult.data.tasa_bcv)
                        if (syncResult.data.tasa_euro > 0) setTasaBCVEuro(syncResult.data.tasa_euro)
                    }
                } catch (e) {}
            } catch(err) {
                console.error('Error loading sesion:', err)
            } finally {
                setLoading(false)
            }
        }
        loadSesion()
    }, [])

    useEffect(() => {
        if (sesionActiva?.tasa_bcv_apertura) {
            const tasa = parseFloat(sesionActiva.tasa_bcv_apertura)
            if (tasa > 0) {
                setTasaBCV(tasa)
                localStorage.setItem('mme_tasa_bcv', tasa.toString())
            }
        }
    }, [sesionActiva])

    useEffect(() => {
        if (sesionActiva?.id) {
            localStorage.setItem(SESION_STORAGE_KEY, sesionActiva.id)
        } else {
            localStorage.removeItem(SESION_STORAGE_KEY)
        }
    }, [sesionActiva])

    const refreshTasaFromDB = useCallback(() => {
        const tasaDb = gsService.tasaBcv || gsService.getTasaBcv() || 0
        setTasaBCV(tasaDb)
        localStorage.setItem('mme_tasa_bcv', tasaDb.toString())

        const tasaEuroDb = gsService.tasaBcvEuro || gsService.getTasaBcvEuro() || 0
        if (tasaEuroDb > 0) {
            setTasaBCVEuro(tasaEuroDb)
            localStorage.setItem('mme_tasa_bcv_euro', tasaEuroDb.toString())
        }
    }, [])

    return (
        <CajaContext.Provider value={{
            sesionActiva,
            setSesionActiva,
            loading,
            tasaBCV,
            setTasaBCV: updateTasaBCV,
            tasaBCVEuro,
            setTasaBCVEuro: updateTasaBCVEuro,
            isCajaAbierta,
            refreshTasaFromDB
        }}>
            {children}
        </CajaContext.Provider>
    )
}

export const useCaja = () => useContext(CajaContext)