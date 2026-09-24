import React, { useState, useEffect } from 'react'

const ROLE_COLORS = {
    admin_master: { bg: 'rgba(255, 215, 0, 0.18)', text: '#ffd700', border: 'rgba(255, 215, 0, 0.5)' },
    admin: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.4)' },
    supervisor: { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.4)' },
    cajero: { bg: 'rgba(0, 230, 118, 0.15)', text: 'var(--s-neon)', border: 'rgba(0, 230, 118, 0.4)' },
    vendedor: { bg: 'rgba(6, 182, 212, 0.15)', text: '#06b6d4', border: 'rgba(6, 182, 212, 0.4)' },
    inventario: { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.4)' },
    personalizado: { bg: 'rgba(251, 191, 36, 0.15)', text: '#fbbf24', border: 'rgba(251, 191, 36, 0.4)' }
}

const UserAvatar = ({ 
    src, 
    name = 'Usuario', 
    role = 'cajero', 
    size = 40, 
    showOnlineDot = false, 
    style = {},
    fontSize
}) => {
    const [hasError, setHasError] = useState(false)
    const normalizedRole = String(role || 'cajero').toLowerCase().trim().replace(/\s+/g, '_')
    const roleStyle = ROLE_COLORS[normalizedRole] || (normalizedRole.includes('master') ? ROLE_COLORS.admin_master : (normalizedRole.includes('vendedor') ? ROLE_COLORS.vendedor : ROLE_COLORS.cajero))
    const initial = (name || 'U').charAt(0).toUpperCase()

    // Reset error when src changes
    useEffect(() => {
        setHasError(false)
    }, [src])

    const computedFontSize = fontSize || (size * 0.42) + 'px'

    return (
        <div style={{
            position: 'relative',
            width: size + 'px',
            height: size + 'px',
            minWidth: size + 'px',
            minHeight: size + 'px',
            flexShrink: 0,
            borderRadius: '50%',
            ...style
        }}>
            {src && !hasError ? (
                <img
                    src={src}
                    alt={name}
                    referrerPolicy="no-referrer"
                    onError={() => setHasError(true)}
                    style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: `2px solid ${roleStyle.text}`,
                        boxShadow: `0 0 10px ${roleStyle.bg}`,
                        display: 'block'
                    }}
                />
            ) : (
                <div style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: roleStyle.bg,
                    border: `2px solid ${roleStyle.text}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: roleStyle.text,
                    fontWeight: 900,
                    fontSize: computedFontSize,
                    boxShadow: `0 0 10px ${roleStyle.bg}`,
                    userSelect: 'none'
                }}>
                    {initial}
                </div>
            )}

            {showOnlineDot && (
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: Math.max(8, Math.round(size * 0.24)) + 'px',
                    height: Math.max(8, Math.round(size * 0.24)) + 'px',
                    borderRadius: '50%',
                    background: 'var(--s-neon)',
                    border: '2px solid #0d1117',
                    boxShadow: '0 0 6px var(--s-neon)'
                }} />
            )}
        </div>
    )
}

export default UserAvatar
