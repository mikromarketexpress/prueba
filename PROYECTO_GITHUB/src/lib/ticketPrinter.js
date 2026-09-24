export function getEmpresaConfig() {
    try {
        const saved = localStorage.getItem('mme_config_v1');
        if (saved) {
            const parsed = JSON.parse(saved);
            return {
                nombre: parsed.nombre_empresa || 'MICRO MARKET EXPRESS',
                rif: parsed.rif_empresa || 'J-12345678-9',
                direccion: parsed.direccion_empresa || 'AV. PRINCIPAL, LOCAL 1, CARACAS',
                telefono: parsed.telefono_empresa || '+58 412-1234567',
                mensaje: parsed.mensaje_ticket || '¡GRACIAS POR SU COMPRA! VUELVA PRONTO.',
                serial_caja_fiscal: parsed.serial_caja_fiscal || 'MME-POS-01',
                providencia_seniat: parsed.providencia_seniat || 'SNAT/2011/00071'
            };
        }
    } catch (e) {}
    return {
        nombre: 'MICRO MARKET EXPRESS',
        rif: 'J-12345678-9',
        direccion: 'AV. PRINCIPAL, LOCAL 1, CARACAS',
        telefono: '+58 412-1234567',
        mensaje: '¡GRACIAS POR SU COMPRA! VUELVA PRONTO.',
        serial_caja_fiscal: 'MME-POS-01',
        providencia_seniat: 'SNAT/2011/00071'
    };
}

const fmtUSD = (n) => {
    if (n === null || n === undefined || isNaN(n)) return '0.00'
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

const fmtBS = (n) => {
    if (n === null || n === undefined || isNaN(n)) return '0,00'
    return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

const fmtFecha = (iso) => {
    if (!iso) return '-'
    const d = new Date(iso)
    return d.toLocaleDateString('es-VE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    })
}

const COMMON_CSS = `
    @page { size: 80mm auto; margin: 0mm; }
    html, body {
        margin: 0;
        padding: 0;
        width: 80mm;
        background: #ffffff !important;
        color: #000000 !important;
        font-family: "Courier New", Courier, monospace;
        font-size: 11px;
        line-height: 1.25;
        -webkit-print-color-adjust: exact;
    }
    .ticket-container {
        width: 72mm;
        margin: 0 auto;
        padding: 8px 0;
        box-sizing: border-box;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: 700; }
    .flex-space { display: flex; justify-content: space-between; }
    .divider { margin: 4px 0; border-top: 1px dashed #000; }
    .double-divider { margin: 5px 0; border-top: 2px double #000; }
    .h1 { font-size: 14px; font-weight: 900; letter-spacing: 0.05em; }
    .h2 { font-size: 12px; font-weight: 800; }
    .h3 { font-size: 11px; font-weight: 700; }
    .small { font-size: 9.5px; }
    .info-row { display: flex; justify-content: space-between; padding: 1.5px 0; font-size: 10.5px; }
    .prod-row { font-size: 10px; padding: 1.5px 0; }
    .prod-row .col-qty { width: 12%; text-align: left; }
    .prod-row .col-desc { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .prod-row .col-iva { width: 8%; text-align: center; font-weight: bold; }
    .prod-row .col-price { width: 22%; text-align: right; }
    .prod-row .col-total { width: 22%; text-align: right; }
    .prod-header { font-weight: 700; font-size: 9.5px; border-bottom: 1px solid #000; padding: 2px 0; }
    .total-row { padding: 1.5px 0; font-size: 10.5px; }
    .total-row .amt-usd { text-align: right; min-width: 65px; }
    .total-row .amt-bs { text-align: right; min-width: 75px; font-size: 9.5px; color: #333; }
    .total-final { font-size: 13px; font-weight: 900; padding: 3px 0; }
    .total-final .amt-usd { font-size: 13px; }
    .total-final .amt-bs { font-size: 11px; }
    .pago-row { padding: 1.5px 0; font-size: 10px; }
    .vuelto-check { color: #008000; }
    .footer { margin-top: 6px; padding-top: 4px; border-top: 1px solid #000; font-size: 9px; }
`;

export function abrirTicketImpresion(datos) {
    const EMPRESA = getEmpresaConfig();
    const {
        idVenta,
        numeroFactura,
        fecha,
        sesionCajaId,
        productos = [],
        pagos = {},
        vueltoUSD = 0,
        vueltoBS = 0,
        tasaBCV = 1,
        cliente = {}
    } = datos;

    const tasaValida = Number(tasaBCV) > 0 ? Number(tasaBCV) : 1;

    // Calcular desglose fiscal por producto
    let baseExentaUSD = 0;
    let baseImponibleUSD = 0;

    const prodRows = productos.map(p => {
        const cantidad = Number(p.cantidad) || 1;
        const precio = Number(p.precio_usd) || 0;
        const totalItem = cantidad * precio;
        const alicuota = String(p.alicuota_iva || 'G').toUpperCase();

        if (alicuota === 'E') {
            baseExentaUSD += totalItem;
        } else {
            baseImponibleUSD += totalItem;
        }

        const tagAlicuota = alicuota === 'E' ? '(E)' : (alicuota === 'R' ? '(R)' : '(G)');

        return (
            '<div class="flex-space prod-row">' +
            '<span class="col-qty">' + cantidad + '</span>' +
            '<span class="col-desc">' + String(p.nombre || '').toUpperCase() + '</span>' +
            '<span class="col-iva">' + tagAlicuota + '</span>' +
            '<span class="col-price">' + fmtUSD(precio) + '</span>' +
            '<span class="col-total">' + fmtUSD(totalItem) + '</span>' +
            '</div>'
        );
    }).join('\n');

    const ivaUSD = baseImponibleUSD * 0.16;
    const efectivoUSD = parseFloat(String(pagos?.efectivo_usd || '0').replace(',', '.')) || 0;
    const baseIgtfUSD = efectivoUSD;
    const igtfUSD = baseIgtfUSD > 0 ? baseIgtfUSD * 0.03 : 0;

    const totalGeneralUSD = baseExentaUSD + baseImponibleUSD + ivaUSD + igtfUSD;
    const totalGeneralBS = totalGeneralUSD * tasaValida;

    let metodosHTML = '';
    const metodos = [
        { id: 'efectivo_usd', label: 'EFECTIVO USD ($)' },
        { id: 'efectivo_bs', label: 'EFECTIVO BS' },
        { id: 'debito', label: 'PUNTO DE VENTA / DÉBITO' },
        { id: 'pago_movil', label: 'PAGO MÓVIL' },
        { id: 'bio_pago', label: 'BIOPAGO BANCO DE VZLA' },
        { id: 'transferencia', label: 'TRANSFERENCIA BANCARIA' },
    ];
    for (const m of metodos) {
        const val = parseFloat(String(pagos?.[m.id] || '0').replace(',', '.')) || 0;
        if (val > 0) {
            const prefix = m.id === 'efectivo_usd' ? '$' : 'Bs';
            const formatted = m.id === 'efectivo_usd' ? fmtUSD(val) : fmtBS(val);
            metodosHTML += '<div class="flex-space pago-row"><span>' + m.label + '</span><span class="bold">' + prefix + ' ' + formatted + '</span></div>';
        }
    }

    let vueltoHTML = '';
    if (vueltoUSD > 0) {
        vueltoHTML += '<div class="flex-space pago-row"><span>✓ VUELTO USD:</span><span class="bold vuelto-check">$ ' + fmtUSD(vueltoUSD) + '</span></div>';
    }
    if (vueltoBS > 0) {
        vueltoHTML += '<div class="flex-space pago-row"><span>✓ VUELTO BS:</span><span class="bold vuelto-check">Bs ' + fmtBS(vueltoBS) + '</span></div>';
    }

    const docNum = numeroFactura || idVenta?.slice(0, 8)?.toUpperCase() || '00000001';
    const cliNombre = cliente.nombre || datos.clienteNombre || 'CONSUMIDOR FINAL';
    const cliDoc = cliente.cedulaRif || datos.clienteIdentificacion || 'V-99999999-0';
    const cliDir = cliente.direccion || datos.clienteDireccion || 'CIUDAD';
    const cliTel = cliente.telefono || datos.clienteCelular || '';

    const ventana = window.open('', '_blank', 'width=420,height=650');
    if (!ventana) return;

    ventana.document.write(
        '<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>FACTURA FISCAL - ' + docNum + '</title>' +
        '<style>' + COMMON_CSS + '</style>' +
        '</head>' +
        '<body>' +
        '<div class="ticket-container">' +

        '<div class="text-center">' +
        '<div class="h1">' + EMPRESA.nombre + '</div>' +
        '<div class="small"><b>RIF: ' + EMPRESA.rif + '</b></div>' +
        '<div class="small">' + EMPRESA.direccion + '</div>' +
        '<div class="small">TELÉFONO: ' + EMPRESA.telefono + '</div>' +
        '<div class="small">DISPOSITIVO FISCAL: ' + EMPRESA.serial_caja_fiscal + '</div>' +
        '</div>' +

        '<div class="double-divider"></div>' +

        '<div class="text-center h2">FACTURA FISCAL</div>' +
        '<div class="text-center small">CONFORME A PROVIDENCIA ' + EMPRESA.providencia_seniat + '</div>' +

        '<div class="divider"></div>' +

        '<div class="info-row"><span>FACTURA NRO:</span><span class="bold"># ' + docNum + '</span></div>' +
        '<div class="info-row"><span>FECHA Y HORA:</span><span class="bold">' + fmtFecha(fecha) + '</span></div>' +
        '<div class="info-row"><span>SESIÓN CAJA:</span><span>' + (sesionCajaId ? String(sesionCajaId).slice(0, 15) : 'TURNO PRINCIPAL') + '</span></div>' +
        '<div class="info-row"><span>TASA OFICIAL BCV:</span><span class="bold">Bs ' + fmtBS(tasaValida) + '</span></div>' +

        '<div class="divider"></div>' +

        '<div class="info-row"><span>CLIENTE / RAZÓN SOCIAL:</span><span class="bold">' + String(cliNombre).toUpperCase() + '</span></div>' +
        '<div class="info-row"><span>CÉDULA / RIF:</span><span class="bold">' + String(cliDoc).toUpperCase() + '</span></div>' +
        (cliDir ? '<div class="info-row"><span>DIRECCIÓN:</span><span>' + String(cliDir).toUpperCase() + '</span></div>' : '') +
        (cliTel ? '<div class="info-row"><span>TELÉFONO:</span><span>' + String(cliTel).toUpperCase() + '</span></div>' : '') +

        '<div class="divider"></div>' +

        '<div class="flex-space prod-header">' +
        '<span class="col-qty">CANT</span>' +
        '<span class="col-desc">DESCRIPCIÓN</span>' +
        '<span class="col-iva">ALÍQ</span>' +
        '<span class="col-price">P.UNIT($)</span>' +
        '<span class="col-total">TOTAL($)</span>' +
        '</div>' +

        prodRows +

        '<div class="divider"></div>' +

        '<div class="flex-space total-row"><span>TOTAL EXENTO (E)</span><span class="amt-usd">' + fmtUSD(baseExentaUSD) + ' $</span><span class="amt-bs">Bs ' + fmtBS(baseExentaUSD * tasaValida) + '</span></div>' +
        '<div class="flex-space total-row"><span>BASE IMPONIBLE (G 16%)</span><span class="amt-usd">' + fmtUSD(baseImponibleUSD) + ' $</span><span class="amt-bs">Bs ' + fmtBS(baseImponibleUSD * tasaValida) + '</span></div>' +
        '<div class="flex-space total-row"><span>I.V.A. (16%)</span><span class="amt-usd">' + fmtUSD(ivaUSD) + ' $</span><span class="amt-bs">Bs ' + fmtBS(ivaUSD * tasaValida) + '</span></div>' +
        (igtfUSD > 0
            ? '<div class="flex-space total-row"><span>BASE IMPONIBLE IGTF (3%)</span><span class="amt-usd">' + fmtUSD(baseIgtfUSD) + ' $</span><span class="amt-bs">Bs ' + fmtBS(baseIgtfUSD * tasaValida) + '</span></div>' +
              '<div class="flex-space total-row"><span>I.G.T.F. PERCIBIDO (3%)</span><span class="amt-usd">' + fmtUSD(igtfUSD) + ' $</span><span class="amt-bs">Bs ' + fmtBS(igtfUSD * tasaValida) + '</span></div>'
            : ''
        ) +

        '<div class="divider"></div>' +

        '<div class="flex-space total-row total-final"><span>TOTAL A PAGAR:</span><span class="amt-usd">' + fmtUSD(totalGeneralUSD) + ' $</span><span class="amt-bs">Bs ' + fmtBS(totalGeneralBS) + '</span></div>' +

        '<div class="divider"></div>' +

        '<div class="h3 text-center">FORMA DE PAGO</div>' +
        '<div style="margin-top:3px">' + metodosHTML + '</div>' +

        (vueltoHTML ? '<div class="divider"></div><div class="h3 text-center">CAMBIO / VUELTO</div><div style="margin-top:3px">' + vueltoHTML + '</div>' : '') +

        '<div class="double-divider"></div>' +

        '<div class="text-center small">' +
        '<div><b>' + EMPRESA.mensaje + '</b></div>' +
        '<div style="margin-top:2px">' + EMPRESA.nombre + '</div>' +
        '<div style="margin-top:4px; font-size: 8.5px; color: #444;">COMPROBANTE EMITIDO EN CUMPLIMIENTO CON LA LEY DEL IVA Y PROVIDENCIAS DEL SENIAT</div>' +
        '</div>' +

        '<div class="footer text-center">' +
        'EMISIÓN: ' + fmtFecha(new Date().toISOString()) + ' | SERIE: ' + EMPRESA.serial_caja_fiscal +
        '</div>' +

        '</div>' +
        '</body>' +
        '</html>'
    );

    ventana.document.close();
    ventana.focus();
    setTimeout(function() {
        ventana.print();
        ventana.close();
    }, 500);
}

export function imprimirReporteX(datos) {
    const EMPRESA = getEmpresaConfig();
    const {
        sesionId,
        cajero,
        fechaApertura,
        tasaBCV = 1,
        totalVentasUSD = 0,
        totalVentasBS = 0,
        baseExentaUSD = 0,
        baseImponibleUSD = 0,
        ivaUSD = 0,
        baseIgtfUSD = 0,
        igtfUSD = 0,
        cantTransacciones = 0,
        facturaInicial = '-',
        facturaFinal = '-',
        desglosePagos = {}
    } = datos;

    const tasaValida = Number(tasaBCV) > 0 ? Number(tasaBCV) : 1;

    let metodosHTML = '';
    const metodos = [
        { id: 'efectivo_usd', label: 'EFECTIVO USD ($)' },
        { id: 'efectivo_bs', label: 'EFECTIVO BS' },
        { id: 'debito', label: 'DÉBITO / PUNTO' },
        { id: 'pago_movil', label: 'PAGO MÓVIL' },
        { id: 'bio_pago', label: 'BIOPAGO' },
        { id: 'transferencia', label: 'TRANSFERENCIA' },
    ];
    for (const m of metodos) {
        const val = Number(desglosePagos[m.id]) || 0;
        if (val > 0) {
            const prefix = m.id === 'efectivo_usd' ? '$' : 'Bs';
            const formatted = m.id === 'efectivo_usd' ? fmtUSD(val) : fmtBS(val);
            metodosHTML += '<div class="flex-space pago-row"><span>' + m.label + '</span><span class="bold">' + prefix + ' ' + formatted + '</span></div>';
        }
    }

    const ventana = window.open('', '_blank', 'width=420,height=650');
    if (!ventana) return;

    ventana.document.write(
        '<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>REPORTE X - CORTE PARCIAL</title>' +
        '<style>' + COMMON_CSS + '</style>' +
        '</head>' +
        '<body>' +
        '<div class="ticket-container">' +

        '<div class="text-center">' +
        '<div class="h1">' + EMPRESA.nombre + '</div>' +
        '<div class="small"><b>RIF: ' + EMPRESA.rif + '</b></div>' +
        '<div class="small">' + EMPRESA.direccion + '</div>' +
        '<div class="small">DISPOSITIVO: ' + EMPRESA.serial_caja_fiscal + '</div>' +
        '</div>' +

        '<div class="double-divider"></div>' +

        '<div class="text-center h2">*** REPORTE X ***</div>' +
        '<div class="text-center small">CORTE PARCIAL DE CAJA (SIN CIERRE)</div>' +

        '<div class="divider"></div>' +

        '<div class="info-row"><span>FECHA / HORA CORTE:</span><span class="bold">' + fmtFecha(new Date().toISOString()) + '</span></div>' +
        '<div class="info-row"><span>APERTURA TURNO:</span><span>' + fmtFecha(fechaApertura) + '</span></div>' +
        '<div class="info-row"><span>CAJERO / OPERADOR:</span><span class="bold">' + String(cajero || 'CAJERO').toUpperCase() + '</span></div>' +
        '<div class="info-row"><span>SESIÓN CAJA:</span><span>' + (sesionId ? String(sesionId).slice(0, 15) : '-') + '</span></div>' +
        '<div class="info-row"><span>TASA OFICIAL BCV:</span><span class="bold">Bs ' + fmtBS(tasaValida) + '</span></div>' +
        '<div class="info-row"><span>TRANSACCIONES:</span><span class="bold">' + cantTransacciones + '</span></div>' +
        '<div class="info-row"><span>RANGO FACTURAS:</span><span>' + facturaInicial + ' AL ' + facturaFinal + '</span></div>' +

        '<div class="divider"></div>' +

        '<div class="text-center h3">TOTALES FISCALES PARCIALES</div>' +

        '<div class="flex-space total-row"><span>VENTAS EXENTAS (E):</span><span class="amt-usd">' + fmtUSD(baseExentaUSD) + ' $</span><span class="amt-bs">Bs ' + fmtBS(baseExentaUSD * tasaValida) + '</span></div>' +
        '<div class="flex-space total-row"><span>BASE IMPONIBLE (G 16%):</span><span class="amt-usd">' + fmtUSD(baseImponibleUSD) + ' $</span><span class="amt-bs">Bs ' + fmtBS(baseImponibleUSD * tasaValida) + '</span></div>' +
        '<div class="flex-space total-row"><span>I.V.A. (16%):</span><span class="amt-usd">' + fmtUSD(ivaUSD) + ' $</span><span class="amt-bs">Bs ' + fmtBS(ivaUSD * tasaValida) + '</span></div>' +
        '<div class="flex-space total-row"><span>BASE IGTF (3%):</span><span class="amt-usd">' + fmtUSD(baseIgtfUSD) + ' $</span><span class="amt-bs">Bs ' + fmtBS(baseIgtfUSD * tasaValida) + '</span></div>' +
        '<div class="flex-space total-row"><span>I.G.T.F. (3%):</span><span class="amt-usd">' + fmtUSD(igtfUSD) + ' $</span><span class="amt-bs">Bs ' + fmtBS(igtfUSD * tasaValida) + '</span></div>' +

        '<div class="divider"></div>' +

        '<div class="flex-space total-row total-final"><span>VENTAS TOTALES:</span><span class="amt-usd">' + fmtUSD(totalVentasUSD) + ' $</span><span class="amt-bs">Bs ' + fmtBS(totalVentasBS) + '</span></div>' +

        '<div class="divider"></div>' +

        '<div class="h3 text-center">TOTAL RECAUDADO POR MEDIO</div>' +
        '<div style="margin-top:3px">' + (metodosHTML || '<div class="text-center small">SIN COBROS REGISTRADOS</div>') + '</div>' +

        '<div class="double-divider"></div>' +

        '<div class="text-center small" style="color: #444;">' +
        '<div>*** DOCUMENTO DE CONTROL PARCIAL ***</div>' +
        '<div>NO TIENE VALOR DE CIERRE DEFINITIVO</div>' +
        '</div>' +

        '<div class="footer text-center">' +
        'IMPRESO: ' + fmtFecha(new Date().toISOString()) + ' | DISPOSITIVO: ' + EMPRESA.serial_caja_fiscal +
        '</div>' +

        '</div>' +
        '</body>' +
        '</html>'
    );

    ventana.document.close();
    ventana.focus();
    setTimeout(function() {
        ventana.print();
        ventana.close();
    }, 500);
}

export function imprimirReporteZ(datos) {
    const EMPRESA = getEmpresaConfig();
    const {
        numeroReporteZ = 'Z-0001',
        sesionId,
        cajero,
        fechaApertura,
        fechaCierre,
        tasaBCV = 1,
        totalVentasUSD = 0,
        totalVentasBS = 0,
        baseExentaUSD = 0,
        baseImponibleUSD = 0,
        ivaUSD = 0,
        baseIgtfUSD = 0,
        igtfUSD = 0,
        cantTransacciones = 0,
        facturaInicial = '00000001',
        facturaFinal = '00000001',
        desglosePagos = {},
        montoInicialUSD = 0,
        montoInicialBS = 0,
        montoFinalRealUSD = 0,
        montoFinalRealBS = 0,
        diferenciaUSD = 0,
        diferenciaBS = 0
    } = datos;

    const tasaValida = Number(tasaBCV) > 0 ? Number(tasaBCV) : 1;

    let metodosHTML = '';
    const metodos = [
        { id: 'efectivo_usd', label: 'EFECTIVO USD ($)' },
        { id: 'efectivo_bs', label: 'EFECTIVO BS' },
        { id: 'debito', label: 'DÉBITO / PUNTO' },
        { id: 'pago_movil', label: 'PAGO MÓVIL' },
        { id: 'bio_pago', label: 'BIOPAGO' },
        { id: 'transferencia', label: 'TRANSFERENCIA' },
    ];
    for (const m of metodos) {
        const val = Number(desglosePagos[m.id]) || 0;
        if (val > 0) {
            const prefix = m.id === 'efectivo_usd' ? '$' : 'Bs';
            const formatted = m.id === 'efectivo_usd' ? fmtUSD(val) : fmtBS(val);
            metodosHTML += '<div class="flex-space pago-row"><span>' + m.label + '</span><span class="bold">' + prefix + ' ' + formatted + '</span></div>';
        }
    }

    const ventana = window.open('', '_blank', 'width=420,height=750');
    if (!ventana) return;

    ventana.document.write(
        '<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>REPORTE Z - CIERRE DIARIO FISCAL ' + numeroReporteZ + '</title>' +
        '<style>' + COMMON_CSS + '</style>' +
        '</head>' +
        '<body>' +
        '<div class="ticket-container">' +

        '<div class="text-center">' +
        '<div class="h1">' + EMPRESA.nombre + '</div>' +
        '<div class="small"><b>RIF: ' + EMPRESA.rif + '</b></div>' +
        '<div class="small">' + EMPRESA.direccion + '</div>' +
        '<div class="small">TELÉFONO: ' + EMPRESA.telefono + '</div>' +
        '<div class="small">DISPOSITIVO FISCAL: ' + EMPRESA.serial_caja_fiscal + '</div>' +
        '</div>' +

        '<div class="double-divider"></div>' +

        '<div class="text-center h2">*** REPORTE Z (CIERRE FISCAL DIARIO) ***</div>' +
        '<div class="text-center small">CONFORME A PROVIDENCIA ' + EMPRESA.providencia_seniat + '</div>' +

        '<div class="divider"></div>' +

        '<div class="info-row"><span>REPORTE Z NRO:</span><span class="bold">' + numeroReporteZ + '</span></div>' +
        '<div class="info-row"><span>FECHA / HORA CIERRE:</span><span class="bold">' + fmtFecha(fechaCierre || new Date().toISOString()) + '</span></div>' +
        '<div class="info-row"><span>APERTURA TURNO:</span><span>' + fmtFecha(fechaApertura) + '</span></div>' +
        '<div class="info-row"><span>RESPONSABLE / CAJERO:</span><span class="bold">' + String(cajero || 'CAJERO').toUpperCase() + '</span></div>' +
        '<div class="info-row"><span>SESIÓN CAJA ID:</span><span>' + (sesionId ? String(sesionId).slice(0, 15) : '-') + '</span></div>' +
        '<div class="info-row"><span>TASA OFICIAL BCV:</span><span class="bold">Bs ' + fmtBS(tasaValida) + '</span></div>' +

        '<div class="double-divider"></div>' +

        '<div class="text-center h3">REGISTRO DE FACTURACIÓN EMITIDA</div>' +
        '<div class="info-row"><span>FACTURA INICIAL:</span><span class="bold">' + facturaInicial + '</span></div>' +
        '<div class="info-row"><span>FACTURA FINAL:</span><span class="bold">' + facturaFinal + '</span></div>' +
        '<div class="info-row"><span>TOTAL DOCUMENTOS EMITIDOS:</span><span class="bold">' + cantTransacciones + '</span></div>' +

        '<div class="divider"></div>' +

        '<div class="text-center h3">RESUMEN TRIBUTARIO ACUMULADO</div>' +

        '<div class="flex-space total-row"><span>VENTAS EXENTAS (E):</span><span class="amt-usd">' + fmtUSD(baseExentaUSD) + ' $</span><span class="amt-bs">Bs ' + fmtBS(baseExentaUSD * tasaValida) + '</span></div>' +
        '<div class="flex-space total-row"><span>BASE IMPONIBLE (G 16%):</span><span class="amt-usd">' + fmtUSD(baseImponibleUSD) + ' $</span><span class="amt-bs">Bs ' + fmtBS(baseImponibleUSD * tasaValida) + '</span></div>' +
        '<div class="flex-space total-row"><span>DÉBITO FISCAL IVA (16%):</span><span class="amt-usd">' + fmtUSD(ivaUSD) + ' $</span><span class="amt-bs">Bs ' + fmtBS(ivaUSD * tasaValida) + '</span></div>' +
        '<div class="flex-space total-row"><span>BASE IMPONIBLE IGTF (3%):</span><span class="amt-usd">' + fmtUSD(baseIgtfUSD) + ' $</span><span class="amt-bs">Bs ' + fmtBS(baseIgtfUSD * tasaValida) + '</span></div>' +
        '<div class="flex-space total-row"><span>I.G.T.F. PERCIBIDO (3%):</span><span class="amt-usd">' + fmtUSD(igtfUSD) + ' $</span><span class="amt-bs">Bs ' + fmtBS(igtfUSD * tasaValida) + '</span></div>' +

        '<div class="divider"></div>' +

        '<div class="flex-space total-row total-final"><span>VENTAS TOTALES DEL DÍA:</span><span class="amt-usd">' + fmtUSD(totalVentasUSD) + ' $</span><span class="amt-bs">Bs ' + fmtBS(totalVentasBS) + '</span></div>' +

        '<div class="divider"></div>' +

        '<div class="h3 text-center">DESGLOSE TOTAL POR MÉTODO DE PAGO</div>' +
        '<div style="margin-top:3px">' + (metodosHTML || '<div class="text-center small">SIN COBROS REGISTRADOS</div>') + '</div>' +

        '<div class="divider"></div>' +

        '<div class="text-center h3">ARQUEO DE CAJA FÍSICO</div>' +
        '<div class="info-row"><span>MONTO INICIAL CAJA:</span><span>$ ' + fmtUSD(montoInicialUSD) + ' / Bs ' + fmtBS(montoInicialBS) + '</span></div>' +
        '<div class="info-row"><span>MONTO CONTADO AL CIERRE:</span><span class="bold">$ ' + fmtUSD(montoFinalRealUSD) + ' / Bs ' + fmtBS(montoFinalRealBS) + '</span></div>' +
        '<div class="info-row"><span>DIFERENCIA / DESCUADRE:</span><span class="bold" style="color: ' + (diferenciaUSD < 0 ? '#ff0000' : '#008000') + '">' + (diferenciaUSD >= 0 ? '+' : '') + '$ ' + fmtUSD(diferenciaUSD) + ' / Bs ' + fmtBS(diferenciaBS) + '</span></div>' +

        '<div class="double-divider"></div>' +

        '<div class="text-center small" style="color: #333;">' +
        '<div><b>CIERRE DIARIO FISCAL VALIDADOR SENIAT</b></div>' +
        '<div style="margin-top:2px">MEMORIA FISCAL AUDITADA Y ALMACENADA</div>' +
        '<div style="margin-top:2px">PROHIBIDA SU ALTERACIÓN O DUPLICIDAD</div>' +
        '</div>' +

        '<div class="footer text-center">' +
        'CIERRE EFECTUADO: ' + fmtFecha(new Date().toISOString()) + ' | DISPOSITIVO: ' + EMPRESA.serial_caja_fiscal +
        '</div>' +

        '</div>' +
        '</body>' +
        '</html>'
    );

    ventana.document.close();
    ventana.focus();
    setTimeout(function() {
        ventana.print();
        ventana.close();
    }, 500);
}
