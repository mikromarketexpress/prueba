import dayjs from 'dayjs'

export const EstadoVencimiento = {
    CRITICO: 'critico',
    PROXIMO: 'proximo',
    AL_DIA: 'al-dia',
    PAGADO: 'pagado'
}

export const COLORES_ESTADO = {
    [EstadoVencimiento.CRITICO]: {
        bg: 'rgba(255,49,49,0.15)',
        color: '#ff3131',
        border: 'rgba(255,49,49,0.3)',
        label: 'CRÍTICO'
    },
    [EstadoVencimiento.PROXIMO]: {
        bg: 'rgba(255,193,7,0.15)',
        color: '#ffc107',
        border: 'rgba(255,193,7,0.3)',
        label: 'PRÓXIMO'
    },
    [EstadoVencimiento.AL_DIA]: {
        bg: 'rgba(0,230,118,0.15)',
        color: 'var(--s-neon)',
        border: 'rgba(0,230,118,0.3)',
        label: 'AL DÍA'
    },
    [EstadoVencimiento.PAGADO]: {
        bg: 'rgba(100,100,100,0.15)',
        color: '#888',
        border: 'rgba(100,100,100,0.3)',
        label: 'PAGADO'
    }
}

export const calcularDiasRestantes = (fechaVencimiento) => {
    if (!fechaVencimiento) return null
    
    const hoy = dayjs().startOf('day')
    const vencimiento = dayjs(fechaVencimiento)
    const diff = vencimiento.diff(hoy, 'day')
    
    return diff
}

export const getEstadoVencimiento = (fechaVencimiento, saldoPendiente = 0) => {
    if (!fechaVencimiento || saldoPendiente <= 0) {
        return {
            estado: EstadoVencimiento.PAGADO,
            diasRestantes: null,
            clasificacion: COLORES_ESTADO[EstadoVencimiento.PAGADO]
        }
    }
    
    const diasRestantes = calcularDiasRestantes(fechaVencimiento)
    
    let estado
    if (diasRestantes <= 3) {
        estado = EstadoVencimiento.CRITICO
    } else if (diasRestantes <= 7) {
        estado = EstadoVencimiento.PROXIMO
    } else {
        estado = EstadoVencimiento.AL_DIA
    }
    
    return {
        estado,
        diasRestantes,
        clasificacion: COLORES_ESTADO[estado]
    }
}

export const getResumenCuentas = (cuentas) => {
    const resultado = {
        total: cuentas.length,
        critico: 0,
        proximo: 0,
        alDia: 0,
        pagado: 0,
        totalPendiente: 0,
        criticoMonto: 0,
        proximoMonto: 0
    }
    
    cuentas.forEach(cuenta => {
        const { estado, diasRestantes } = getEstadoVencimiento(cuenta.fechaVencimiento, cuenta.saldoPendiente)
        
        if (estado === EstadoVencimiento.CRITICO) {
            resultado.critico++
            resultado.criticoMonto += cuenta.saldoPendiente || 0
        } else if (estado === EstadoVencimiento.PROXIMO) {
            resultado.proximo++
            resultado.proximoMonto += cuenta.saldoPendiente || 0
        } else if (estado === EstadoVencimiento.AL_DIA) {
            resultado.alDia++
        } else {
            resultado.pagado++
        }
        
        resultado.totalPendiente += cuenta.saldoPendiente || 0
    })
    
    return resultado
}

export const formatCurrency = (monto) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(monto || 0)
}