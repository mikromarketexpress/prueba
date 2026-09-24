import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { gsService } from '../lib/googleSheetsService';

const SyncStatus = ({ compact = false }) => {
    const [status, setStatus] = useState({
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        isSyncing: false,
        pendingCount: 0,
        lastSync: null
    });

    useEffect(() => {
        const handleOnline = () => setStatus(prev => ({ ...prev, isOnline: true }));
        const handleOffline = () => setStatus(prev => ({ ...prev, isOnline: false }));

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleSync = async () => {
        if (status.isSyncing || !status.isOnline) return;
        setStatus(prev => ({ ...prev, isSyncing: true }));
        try {
            await gsService.refresh();
            setStatus(prev => ({ ...prev, lastSync: Date.now(), isSyncing: false }));
        } catch (e) {
            setStatus(prev => ({ ...prev, isSyncing: false }));
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return 'Nunca';
        const diff = Date.now() - timestamp;
        if (diff < 60000) return 'Hace un momento';
        if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
        if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} h`;
        return new Date(timestamp).toLocaleDateString('es-VE');
    };

    if (compact) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {status.isOnline ? (
                    <Wifi size={14} style={{ color: 'var(--s-neon)' }} />
                ) : (
                    <WifiOff size={14} style={{ color: '#ff5252' }} />
                )}
            </div>
        );
    }

    return (
        <div className="s-panel" style={{
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            background: 'rgba(13, 18, 32, 0.95)',
            border: status.isOnline 
                ? '1px solid rgba(0, 230, 118, 0.2)' 
                : '1px solid rgba(255, 82, 82, 0.3)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {status.isOnline ? (
                    <>
                        <div style={{
                            width: '2rem',
                            height: '2rem',
                            borderRadius: '50%',
                            background: 'rgba(0, 230, 118, 0.1)',
                            border: '1px solid rgba(0, 230, 118, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Wifi size={16} style={{ color: 'var(--s-neon)' }} />
                        </div>
                        <div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--s-neon)' }}>
                                CONECTADO
                            </span>
                            <p style={{ fontSize: '0.6rem', color: 'var(--s-text-dim)', margin: 0 }}>
                                Última sync: {formatTime(status.lastSync)}
                            </p>
                        </div>
                    </>
                ) : (
                    <>
                        <div style={{
                            width: '2rem',
                            height: '2rem',
                            borderRadius: '50%',
                            background: 'rgba(255, 82, 82, 0.1)',
                            border: '1px solid rgba(255, 82, 82, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <WifiOff size={16} style={{ color: '#ff5252' }} />
                        </div>
                        <div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#ff5252' }}>
                                MODO OFFLINE
                            </span>
                            <p style={{ fontSize: '0.6rem', color: 'var(--s-text-dim)', margin: 0 }}>
                                Los cambios se sincronizarán al reconectar
                            </p>
                        </div>
                    </>
                )}
            </div>

            {status.isOnline && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.4rem 0.75rem',
                    background: 'rgba(0, 230, 118, 0.1)',
                    border: '1px solid rgba(0, 230, 118, 0.2)',
                    borderRadius: '8px'
                }}>
                    <Check size={14} style={{ color: 'var(--s-neon)' }} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--s-neon)' }}>
                        SINCRONIZADO
                    </span>
                </div>
            )}

            <button
                onClick={handleSync}
                disabled={!status.isOnline || status.isSyncing}
                style={{
                    marginLeft: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    background: status.isOnline ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${status.isOnline ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '8px',
                    color: status.isOnline ? 'var(--s-neon)' : 'var(--s-text-dim)',
                    cursor: status.isOnline && !status.isSyncing ? 'pointer' : 'not-allowed',
                    fontSize: '0.7rem',
                    fontWeight: 900,
                    transition: 'all 0.2s'
                }}
            >
                <RefreshCw 
                    size={14} 
                    style={{ 
                        animation: status.isSyncing ? 'spin 1s linear infinite' : 'none' 
                    }} 
                />
                {status.isSyncing ? 'SYNC...' : 'SYNC'}
            </button>
        </div>
    );
};

export default SyncStatus;