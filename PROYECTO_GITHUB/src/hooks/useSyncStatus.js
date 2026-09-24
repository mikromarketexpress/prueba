import { useState, useEffect, useCallback } from 'react';
import { gsService } from '../lib/googleSheetsService';

export function useSyncStatus() {
    const [status, setStatus] = useState({
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        isSyncing: false,
        lastSync: null
    });

    const refresh = useCallback(async () => {
        setStatus(prev => ({
            ...prev,
            lastSync: Date.now()
        }));
    }, []);

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

    const sync = useCallback(async () => {
        if (status.isSyncing || !status.isOnline) return null;
        setStatus(prev => ({ ...prev, isSyncing: true }));
        try {
            await gsService.refresh();
            setStatus(prev => ({ ...prev, lastSync: Date.now(), isSyncing: false }));
            return { success: true };
        } catch (e) {
            setStatus(prev => ({ ...prev, isSyncing: false }));
            return { success: false, error: e.message };
        }
    }, [status.isSyncing, status.isOnline]);

    return {
        ...status,
        refresh,
        sync
    };
}

export function useOfflineMode() {
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return {
        isOffline,
        pendingCount: 0,
        pendingOperations: [],
        hasPendingChanges: false
    };
}