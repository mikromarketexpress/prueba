/**
 * Servicio para formatear y enviar recibos digitales por WhatsApp
 */

export function generarMensajeWhatsApp({ idVenta, fecha, productos, pagos, totalUSD, totalBS, tasaBCV, cliente }) {
    const formatUSD = (n) => {
        const clean = String(n || '0').replace(/[^0-9.-]/g, '');
        const num = parseFloat(clean) || 0;
        return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    };
    const formatBS = (n) => {
        let clean = String(n || '0').trim();
        if (clean.includes('.') && clean.includes(',')) {
            clean = clean.replace(/\./g, '').replace(',', '.');
        } else if (clean.includes(',')) {
            clean = clean.replace(',', '.');
        } else {
            clean = clean.replace(/[^0-9.-]/g, '');
        }
        const num = parseFloat(clean) || 0;
        return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    };

    let msg = `*🛒 MICRO MARKET EXPRESS *\n`;
    msg += `*RIF:* J-50462002-3\n`;
    msg += `-------------------------------------------\n`;
    msg += `*TICKET:* #${String(idVenta || '').slice(0, 8).toUpperCase()}\n`;
    msg += `*FECHA:* ${new Date(fecha || Date.now()).toLocaleString('es-VE')}\n`;
    
    if (cliente && cliente.nombre && cliente.nombre.toUpperCase() !== 'SIN DATOS') {
        msg += `*CLIENTE:* ${cliente.nombre.toUpperCase()}\n`;
        msg += `*CI/RIF:* ${cliente.cedulaRif}\n`;
        if (cliente.telefono) msg += `*TLF:* ${cliente.telefono}\n`;
    } else {
        msg += `*CLIENTE:* Consumidor Final\n`;
    }
    
    msg += `-------------------------------------------\n`;
    
    productos.forEach(p => {
        const qty = Number(p.cantidad) || 1;
        const precio = Number(p.precio_usd) || 0;
        const total = qty * precio;
        msg += `• ${qty} x ${String(p.nombre).toUpperCase().slice(0, 20)} ($${formatUSD(precio)})\n`;
        msg += `   *Total:* $${formatUSD(total)}\n`;
    });
    
    msg += `-------------------------------------------\n`;
    msg += `*TASA BCV:* Bs. ${formatBS(tasaBCV)}\n`;
    msg += `*SUBTOTAL:* $${formatUSD(totalUSD)}\n`;
    
    // Calcular IGTF si se pagó en Efectivo USD
    const efectivoUSD = parseFloat(String(pagos?.efectivo_usd || '0').replace(',', '.')) || 0;
    const igft = efectivoUSD > 0 ? efectivoUSD * 0.03 : 0;
    
    if (igft > 0) {
        msg += `*I.G.T.F. (3%):* $${formatUSD(igft)}\n`;
        msg += `*TOTAL CON IGTF:* $${formatUSD(totalUSD + igft)}\n`;
    } else {
        msg += `*TOTAL:* $${formatUSD(totalUSD)} / Bs. ${formatBS(totalBS)}\n`;
    }

    msg += `-------------------------------------------\n`;
    msg += `*MÉTODOS DE PAGO:*\n`;
    
    const metodos = [
        { id: 'efectivo_usd', label: 'Efectivo USD' },
        { id: 'efectivo_bs', label: 'Efectivo BS' },
        { id: 'debito', label: 'Débito' },
        { id: 'pago_movil', label: 'Pago Móvil' },
        { id: 'bio_pago', label: 'Biopago' },
        { id: 'transferencia', label: 'Transferencia' }
    ];

    metodos.forEach(m => {
        const val = parseFloat(String(pagos?.[m.id] || '0').replace(',', '.')) || 0;
        if (val > 0) {
            const prefix = m.id === 'efectivo_usd' ? '$' : 'Bs.';
            const formatted = m.id === 'efectivo_usd' ? formatUSD(val) : formatBS(val);
            msg += `  - ${m.label}: ${prefix} ${formatted}\n`;
        }
    });

    msg += `\n¡Gracias por su compra!\n`;
    msg += `_Micro Market Express - Calidad y Rapidez_`;

    // Limpiar número telefónico del cliente si lo tiene
    let phoneNum = '';
    if (cliente && cliente.telefono) {
        // Eliminar caracteres no numéricos y prefijos redundantes
        phoneNum = String(cliente.telefono).replace(/[^0-9]/g, '');
        // Si no tiene código de país, asumir +58
        if (phoneNum.length === 10 && phoneNum.startsWith('4')) {
            phoneNum = '58' + phoneNum;
        } else if (phoneNum.startsWith('04')) {
            phoneNum = '58' + phoneNum.slice(1);
        }
    }

    const encodedText = encodeURIComponent(msg);
    const link = phoneNum 
        ? `https://api.whatsapp.com/send?phone=${phoneNum}&text=${encodedText}`
        : `https://api.whatsapp.com/send?text=${encodedText}`;

    return {
        text: msg,
        link
    };
}
