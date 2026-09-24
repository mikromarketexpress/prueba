import { gsService } from '../lib/googleSheetsService'

const PRODUCT_IMAGES = {
    'COCA COLA': 'https://images.unsplash.com/photo-1629203851122-3726c0cf3d8f?w=400&q=80',
    'COCA': 'https://images.unsplash.com/photo-1629203851122-3726c0cf3d8f?w=400&q=80',
    'PEPSI': 'https://images.unsplash.com/photo-1629203851122-3726c0cf3d8f?w=400&q=80',
    'FANTA': 'https://images.unsplash.com/photo-1629203851122-3726c0cf3d8f?w=400&q=80',
    'SPRITE': 'https://images.unsplash.com/photo-1629203851122-3726c0cf3d8f?w=400&q=80',
    'AGUA': 'https://images.unsplash.com/photo-1560023907-5f339617ea55?w=400&q=80',
    'AGUA CRISTAL': 'https://images.unsplash.com/photo-1560023907-5f339617ea55?w=400&q=80',
    'BEBIDA': 'https://images.unsplash.com/photo-1629203851122-3726c0cf3d8f?w=400&q=80',
    'REFRESCO': 'https://images.unsplash.com/photo-1629203851122-3726c0cf3d8f?w=400&q=80',
    'CHOCOLATE': 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=400&q=80',
    'CHOCOLATE TAZA': 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=400&q=80',
    'GALLETA': 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80',
    'COOKIES': 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80',
    'CHIPS': 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&q=80',
    'PAPAS': 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&q=80',
    'ARROZ': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80',
    'HARINA': 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400&q=80',
    'ACEITE': 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80',
    'AZUCAR': 'https://images.unsplash.com/photo-1581268614595-97f987879270?w=400&q=80',
    'SAL': 'https://images.unsplash.com/photo-1518110925495-5fe2c8f7b9e7?w=400&q=80',
    'PASTA': 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=400&q=80',
    'FIDEOS': 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=400&q=80',
    'LECHE': 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&q=80',
    'LECHE PIL': 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&q=80',
    'HUEVOS': 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400&q=80',
    'HUEVO': 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400&q=80',
    'PAN': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80',
    'PAN BLANCO': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80',
    'QUESO': 'https://images.unsplash.com/photo-1618164435735-413d3b066c9a?w=400&q=80',
    'QUESO AMARILLO': 'https://images.unsplash.com/photo-1618164435735-413d3b066c9a?w=400&q=80',
    'MANTEQUILLA': 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&q=80',
    'JABON': 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&q=80',
    'JABON LAVA': 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&q=80',
    'JABON TOCADOR': 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&q=80',
    'SHAMPOO': 'https://images.unsplash.com/photo-1556227702-d1e4e7b5c232?w=400&q=80',
    'SHAMPOO HEAD': 'https://images.unsplash.com/photo-1556227702-d1e4e7b5c232?w=400&q=80',
    'ACONDICIONADOR': 'https://images.unsplash.com/photo-1556227702-d1e4e7b5c232?w=400&q=80',
    'DETERGENTE': 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=400&q=80',
    'CLORO': 'https://images.unsplash.com/photo-1584968173934-bc0a79f0832f?w=400&q=80',
    'BLANQUEADOR': 'https://images.unsplash.com/photo-1584968173934-bc0a79f0832f?w=400&q=80',
    'CEPILLO': 'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=400&q=80',
    'CEPILLO DIENTES': 'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=400&q=80',
    'PASTA DENTAL': 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&q=80',
    'COLGATE': 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&q=80',
    'PAPEL': 'https://images.unsplash.com/photo-1595590424283-fb4a2a9d8e71?w=400&q=80',
    'PAPEL HIGIENICO': 'https://images.unsplash.com/photo-1595590424283-fb4a2a9d8e71?w=400&q=80',
    'SERVILLETA': 'https://images.unsplash.com/photo-1585441747534-316d0506dbfa?w=400&q=80',
    'SERVIDILLAS': 'https://images.unsplash.com/photo-1585441747534-316d0506dbfa?w=400&q=80',
    'TOALLA': 'https://images.unsplash.com/photo-1585441747534-316d0506dbfa?w=400&q=80',
    'CAFÉ': 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&q=80',
    'CAFE': 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&q=80',
    'NESCAFE': 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&q=80',
    'TE': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80',
    'JUGO': 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80',
    'JUICE': 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80',
    'DEL VALLE': 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80',
    'CERVEZA': 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400&q=80',
    'POLAR': 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400&q=80',
    'VINO': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&q=80',
    'CIGARRO': 'https://images.unsplash.com/photo-1579444745028-e600b6fc8e6f?w=400&q=80',
    'CIGARRILLO': 'https://images.unsplash.com/photo-1579444745028-e600b6fc8e6f?w=400&q=80',
    'MALBORO': 'https://images.unsplash.com/photo-1579444745028-e600b6fc8e6f?w=400&q=80',
    'CHUPETES': 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=400&q=80',
    'DULCE': 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=400&q=80',
    'GOLOSINA': 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=400&q=80',
    'CHICLES': 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400&q=80',
    'HELADO': 'https://images.unsplash.com/photo-1557142046-c704a3adf364?w=400&q=80',
    'POLLO': 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&q=80',
    'CARNE': 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400&q=80',
    'CARNE RES': 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400&q=80',
    'PESCADO': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&q=80',
    'ATUN': 'https://images.unsplash.com/photo-1534483509719-3feaee7c30da?w=400&q=80',
    'ATÚN': 'https://images.unsplash.com/photo-1534483509719-3feaee7c30da?w=400&q=80',
    'MANZANA': 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&q=80',
    'PLATANO': 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&q=80',
    'BANANA': 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&q=80',
    'NARANJA': 'https://images.unsplash.com/photo-1547514701-42782101795e?w=400&q=80',
    'UVA': 'https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=400&q=80',
    'FRUTA': 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400&q=80',
    'VERDURA': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&q=80',
    'TOMATE': 'https://images.unsplash.com/photo-1546470427-e26264be0b11?w=400&q=80',
    'CEBOLLA': 'https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?w=400&q=80',
    'PAPA': 'https://images.unsplash.com/photo-1518977676601-b53f82ber33?w=400&q=80',
    'CEREAL': 'https://images.unsplash.com/photo-1521483451569-e33803c0330c?w=400&q=80',
    'AVENA': 'https://images.unsplash.com/photo-1614961233913-a5113a4a34ed?w=400&q=80',
    'MAYONESA': 'https://images.unsplash.com/photo-1606956652215-5121c2105c3c?w=400&q=80',
    'KETCHUP': 'https://images.unsplash.com/photo-1581750802635-4d3a4a4a34ed?w=400&q=80',
    'MOSTAZA': 'https://images.unsplash.com/photo-1584949091598-c31daaaa4aa9?w=400&q=80',
    'SALSA': 'https://images.unsplash.com/photo-1581750802635-4d3a4a4a34ed?w=400&q=80',
    'FRIJOL': 'https://images.unsplash.com/photo-1551754212-da1ef83a5f94?w=400&q=80',
    'FRIJOLES': 'https://images.unsplash.com/photo-1551754212-da1ef83a5f94?w=400&q=80',
    'LENTEJA': 'https://images.unsplash.com/photo-1590785252986-8cf5f8499774?w=400&q=80',
    'LENTEJAS': 'https://images.unsplash.com/photo-1590785252986-8cf5f8499774?w=400&q=80',
    'GARBANZO': 'https://images.unsplash.com/photo-1590785252986-8cf5f8499774?w=400&q=80',
    'GARBANZOS': 'https://images.unsplash.com/photo-1590785252986-8cf5f8499774?w=400&q=80',
    'MAIZ': 'https://images.unsplash.com/photo-1551754212-da1ef83a5f94?w=400&q=80',
    'MAÍZ': 'https://images.unsplash.com/photo-1551754212-da1ef83a5f94?w=400&q=80',
    'PURE': 'https://images.unsplash.com/photo-1516192518150-40b87d51bda7?w=400&q=80',
    'CONSOME': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80',
    'CONSOMÉ': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80',
    'SOPA': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80',
    'SOPAS': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80',
    'CREMA': 'https://images.unsplash.com/photo-1586428209059-61a8ea5e4a8e?w=400&q=80',
    'VINAGRE': 'https://images.unsplash.com/photo-1528751014939-9e27e5b1c2bf?w=400&q=80',
    'MAYONECA': 'https://images.unsplash.com/photo-1606956652215-5121c2105c3c?w=400&q=80',
    'SARDINA': 'https://images.unsplash.com/photo-1534483509719-3feaee7c30da?w=400&q=80',
    'LEGISOY': 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&q=80',
    'PONY MALTA': 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&q=80',
    'MALTA': 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&q=80',
    'MIEL': 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400&q=80',
    'MARGARINA': 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&q=80',
    'MARGARINA MANTECA': 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&q=80',
    'GELATINA': 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&q=80',
    'CUADerno': 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400&q=80',
    'LAPIZ': 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400&q=80',
    'LÁPIZ': 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400&q=80',
    'BOLIGRAFO': 'https://images.unsplash.com/photo-1585336261022-680e295ce3fe?w=400&q=80',
    'BOLÍGRAFO': 'https://images.unsplash.com/photo-1585336261022-680e295ce3fe?w=400&q=80',
    'MOCHILA': 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80',
    'BOLSAS': 'https://images.unsplash.com/photo-1591348278863-a8fb3887e2aa?w=400&q=80',
    'BOLSA': 'https://images.unsplash.com/photo-1591348278863-a8fb3887e2aa?w=400&q=80',
    'GUANTES': 'https://images.unsplash.com/photo-1584483766114-2cea6facdf57?w=400&q=80',
    'MASCARILLA': 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&q=80',
    'JABON LÍQUIDO': 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&q=80',
    'CLOROX': 'https://images.unsplash.com/photo-1584968173934-bc0a79f0832f?w=400&q=80',
    'ESCoba': 'https://images.unsplash.com/photo-1584671247441-1d8d4f852e8a?w=400&q=80',
    'TRAPEADOR': 'https://images.unsplash.com/photo-1584671247441-1d8d4f852e8a?w=400&q=80',
    'DESINFECTANTE': 'https://images.unsplash.com/photo-1584968173934-bc0a79f0832f?w=400&q=80',
    'AMBIENTADOR': 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&q=80',
    'SUAVIZANTE': 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=400&q=80',
    'LAVAPLATOS': 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=400&q=80',
    'ESPONJA': 'https://images.unsplash.com/photo-1584671248050-2f89614a2e0f?w=400&q=80',
    'FOCO': 'https://images.unsplash.com/photo-1541123437800-1bb1317badc2?w=400&q=80',
    'BOMBILLA': 'https://images.unsplash.com/photo-1541123437800-1bb1317badc2?w=400&q=80',
    'PILA': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
    'BATERIA': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
    'VELA': 'https://images.unsplash.com/photo-1602523961358-f9f03dd557db?w=400&q=80',
    'ENCENDEDOR': 'https://images.unsplash.com/photo-1579444745028-e600b6fc8e6f?w=400&q=80',
    'FOSFORO': 'https://images.unsplash.com/photo-1579444745028-e600b6fc8e6f?w=400&q=80',
    'FÓSFORO': 'https://images.unsplash.com/photo-1579444745028-e600b6fc8e6f?w=400&q=80',
    'GAS': 'https://images.unsplash.com/photo-1581281863883-2469417a1669?w=400&q=80',
    'GAS LICUADO': 'https://images.unsplash.com/photo-1581281863883-2469417a1669?w=400&q=80',
    'CILINDRO': 'https://images.unsplash.com/photo-1581281863883-2469417a1669?w=400&q=80',
}

const DEFAULT_IMAGES = [
    'https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=400&q=80',
    'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=400&q=80',
    'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400&q=80',
    'https://images.unsplash.com/photo-1550504920-36d0af83c6e3?w=400&q=80',
    'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=400&q=80',
    'https://images.unsplash.com/photo-1604909052743-94e838986d24?w=400&q=80',
    'https://images.unsplash.com/photo-1590947132387-155cc02f3212?w=400&q=80',
    'https://images.unsplash.com/photo-1557844352-761f2565b576?w=400&q=80',
    'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=400&q=80',
    'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&q=80',
    'https://images.unsplash.com/photo-1535912259725-d5a5c1e639f6?w=400&q=80',
    'https://images.unsplash.com/photo-1559847844-5315695dadae?w=400&q=80',
    'https://images.unsplash.com/photo-1574856344992-1c0d2e6c87f9?w=400&q=80',
    'https://images.unsplash.com/photo-1564419320461-6870880221ad?w=400&q=80',
    'https://images.unsplash.com/photo-1608564697061-c61b4c5ecb39?w=400&q=80',
    'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=400&q=80',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
    'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80',
    'https://images.unsplash.com/photo-1493770348161-369560ae357d?w=400&q=80',
]

export function getImageForProduct(nombre) {
    if (!nombre) return DEFAULT_IMAGES[0]
    
    const upper = nombre.toUpperCase()
    
    for (const [keyword, url] of Object.entries(PRODUCT_IMAGES)) {
        if (upper.includes(keyword.toUpperCase())) {
            return url
        }
    }
    
    const hash = hashCode(nombre)
    const idx = Math.abs(hash) % DEFAULT_IMAGES.length
    return DEFAULT_IMAGES[idx]
}

function hashCode(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
    }
    return hash
}

export async function autoLinkAllImages() {
    try {
        const productos = gsService.getTable('Productos')
        let linked = 0
        
        for (const producto of productos) {
            if (!producto.imagen_url || producto.imagen_url.startsWith('data:')) {
                const imageUrl = getImageForProduct(producto.nombre)
                await gsService.update('Productos', {
                    ...producto,
                    imagen_url: imageUrl
                })
                linked++
                await new Promise(r => setTimeout(r, 100))
            }
        }
        
        await gsService.refresh()
        return { success: true, linked }
    } catch (error) {
        console.error('Error linking images:', error)
        return { success: false, error: error.message }
    }
}
