/**
 * MICRO MARKET EXPRESS - Financial Utils
 * =====================================
 * Centraliza cálculos de IVA, descuentos y moneda
 */

import dayjs from 'dayjs';

// ============================================================================
// CONFIGURATION
// ============================================================================

export const IVA_RATE = 0.16; // 16% IVA
export const DEFAULT_TASA_BCV = 46.50;

// ============================================================================
// CURRENCY HELPERS
// ============================================================================

export const formatCurrency = (amount, currency = 'USD') => {
    if (amount === null || amount === undefined) return '$0.00';
    
    if (currency === 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount);
    }
    
    if (currency === 'VES') {
        return new Intl.NumberFormat('es-VE', {
            style: 'currency',
            currency: 'VES',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }
    
    return amount.toFixed(2);
};

export const formatUSD = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0.00';
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

export const formatBS = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0,00';
    return new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

export const formatBs = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0';
    return new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

export const parseVENumber = (str) => {
    if (!str || typeof str !== 'string') return 0
    const cleaned = str
        .replace(/[^\d,]/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num
};

export const parseUSDNumber = (str) => {
    if (str === null || str === undefined || str === '') return 0
    if (typeof str === 'number') return str
    const cleaned = str.replace(/,/g, '')
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num
};

export const handleCurrencyInput = (e, currentValue, currency = 'USD') => {
    const cents = Math.round((parseFloat(currentValue || 0)) * 100)

    if (e.key === 'Backspace') {
        e.preventDefault()
        const newCents = Math.floor(cents / 10)
        return newCents / 100
    }

    if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        const digit = parseInt(e.key)
        const newCents = cents * 10 + digit
        if (newCents > 999999999999) return parseFloat(currentValue) || 0
        return newCents / 100
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
    }

    return parseFloat(currentValue) || 0
};

export const formatVENumber = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '0,00'
    const fixed = Number(num).toFixed(2)
    const parts = fixed.split('.')
    const intPart = parts[0]
    const decPart = parts[1]
    const withThousand = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return `${withThousand},${decPart}`
};

// ============================================================================
// IVA CALCULATIONS
// ============================================================================

export const calculateIVA = (subtotal, rate = IVA_RATE) => {
    const iva = subtotal * rate;
    return {
        subtotal,
        iva,
        total: subtotal + iva,
        rate
    };
};

export const calculateIVAIncluded = (total, rate = IVA_RATE) => {
    const subtotal = total / (1 + rate);
    const iva = total - subtotal;
    return {
        subtotal,
        iva,
        total,
        rate
    };
};

// ============================================================================
// PRICE CONVERSIONS
// ============================================================================

export const convertUsdToBs = (usdAmount, tasaBcv) => {
    if (!usdAmount || !tasaBcv) return 0;
    return usdAmount * tasaBcv;
};

export const convertBsToUsd = (bsAmount, tasaBcv) => {
    if (!bsAmount || !tasaBcv) return 0;
    return bsAmount / tasaBcv;
};

export const getPriceDisplay = (precioUsd, tasaBcv) => {
    const tasa = tasaBcv || DEFAULT_TASA_BCV;
    return {
        usd: precioUsd,
        bs: convertUsdToBs(precioUsd, tasa),
        tasa
    };
};

// ============================================================================
// DISCOUNT CALCULATIONS
// ============================================================================

export const calculateDiscount = (amount, discountPercent) => {
    if (!discountPercent || discountPercent <= 0) {
        return { original: amount, discount: 0, final: amount };
    }
    
    const discount = amount * (discountPercent / 100);
    const final = amount - discount;
    
    return {
        original: amount,
        discountPercent,
        discount,
        final
    };
};

export const applyDiscount = (amount, discountCode, rules = {}) => {
    const discountRules = {
        default: 0,
        ...rules
    };
    
    const percent = discountRules[discountCode] || discountRules.default;
    return calculateDiscount(amount, percent);
};

// ============================================================================
// CART TOTALS
// ============================================================================

export const calculateCartTotals = (cartItems, tasaBcv = DEFAULT_TASA_BCV, applyIva = true) => {
    const subtotal = cartItems.reduce((sum, item) => {
        return sum + (item.precio_usd * item.cantidad);
    }, 0);
    
    const totals = {
        items: cartItems.length,
        subtotal,
        tasaBcv,
        subtotalBs: convertUsdToBs(subtotal, tasaBcv)
    };
    
    if (applyIva) {
        const ivaCalc = calculateIVA(subtotal);
        totals.iva = ivaCalc.iva;
        totals.total = ivaCalc.total;
        totals.totalBs = convertUsdToBs(ivaCalc.total, tasaBcv);
    } else {
        totals.iva = 0;
        totals.total = subtotal;
        totals.totalBs = convertUsdToBs(subtotal, tasaBcv);
    }
    
    return totals;
};

// ============================================================================
// VENCIMIENTO CALCULATIONS (Para Cuentas por Cobrar/Pagar)
// ============================================================================

export const calcularDiasRestantes = (fechaVencimiento) => {
    if (!fechaVencimiento) return null;
    
    const hoy = dayjs().startOf('day');
    const vencimiento = dayjs(fechaVencimiento);
    const diff = vencimiento.diff(hoy, 'day');
    
    return diff;
};

export const getEstadoVencimiento = (fechaVencimiento, saldoPendiente = 0) => {
    if (!fechaVencimiento || saldoPendiente <= 0) {
        return { estado: 'pagado', diasRestantes: null, label: 'PAGADO', color: '#888' };
    }
    
    const diasRestantes = calcularDiasRestantes(fechaVencimiento);
    
    if (diasRestantes <= 3) {
        return { estado: 'critico', diasRestantes, label: 'CRÍTICO', color: '#ff3131' };
    } else if (diasRestantes <= 7) {
        return { estado: 'proximo', diasRestantes, label: 'PRÓXIMO', color: '#ffc107' };
    } else {
        return { estado: 'al-dia', diasRestantes, label: 'AL DÍA', color: '#00e676' };
    }
};

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
    };
    
    cuentas.forEach(cuenta => {
        const { estado } = getEstadoVencimiento(cuenta.fechaVencimiento, cuenta.saldoPendiente);
        
        switch (estado) {
            case 'critico':
                resultado.critico++;
                resultado.criticoMonto += cuenta.saldoPendiente || 0;
                break;
            case 'proximo':
                resultado.proximo++;
                resultado.proximoMonto += cuenta.saldoPendiente || 0;
                break;
            case 'al-dia':
                resultado.alDia++;
                break;
            case 'pagado':
                resultado.pagado++;
                break;
        }
        
        if (cuenta.saldoPendiente > 0) {
            resultado.totalPendiente += cuenta.saldoPendiente;
        }
    });
    
    return resultado;
};

export default {
    IVA_RATE,
    DEFAULT_TASA_BCV,
    formatCurrency,
    formatUSD,
    formatBS,
    formatBs,
    formatVENumber,
    parseVENumber,
    parseUSDNumber,
    handleCurrencyInput,
    calculateIVA,
    calculateIVAIncluded,
    convertUsdToBs,
    convertBsToUsd,
    getPriceDisplay,
    calculateDiscount,
    applyDiscount,
    calculateCartTotals,
    calcularDiasRestantes,
    getEstadoVencimiento,
    getResumenCuentas
};