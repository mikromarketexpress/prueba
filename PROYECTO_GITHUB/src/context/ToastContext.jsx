import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const lastToastRef = useRef({ message: '', time: 0 });

    const playSound = (type) => {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            const ctx = new AudioContextClass();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === 'success') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            } else {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.2);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            }

            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        } catch (e) {
            console.warn('Audio feedback failed', e);
        }
    };

    const showToast = useCallback((message, type = 'success') => {
        if (!message) return;
        const now = Date.now();
        // Evitar duplicados del mismo mensaje si ocurren en menos de 2.5 segundos
        if (lastToastRef.current.message === message && (now - lastToastRef.current.time) < 2500) {
            return;
        }
        lastToastRef.current = { message, time: now };

        const id = now + Math.random();
        setToasts(prev => {
            if (prev.some(t => t.message === message)) return prev;
            return [...prev, { id, message, type }];
        });
        playSound(type);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div style={{
                position: 'fixed',
                top: '2.5rem',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10000,
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                pointerEvents: 'none',
                width: '100%',
                alignItems: 'center'
            }}>
                <AnimatePresence>
                    {toasts.map(toast => {
                        const isError = toast.type === 'error';
                        const color = isError ? '#ff3131' :
                            toast.type === 'warning' ? '#ff9100' :
                                toast.type === 'info' ? '#00b0ff' : 'var(--s-neon)';

                        return (
                            <motion.div
                                key={toast.id}
                                initial={{ opacity: 0, y: -40, scale: 0.95, filter: 'blur(10px)' }}
                                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, scale: 0.9, y: -20, filter: 'blur(10px)', transition: { duration: 0.2 } }}
                                style={{
                                    background: 'rgba(10, 15, 25, 0.85)',
                                    backdropFilter: 'blur(20px)',
                                    WebkitBackdropFilter: 'blur(20px)',
                                    border: `1px solid ${color}`,
                                    boxShadow: `0 0 30px ${color}33`,
                                    color: '#fff',
                                    padding: '1.25rem 2.5rem',
                                    borderRadius: '14px',
                                    fontWeight: 1000,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1.25rem',
                                    pointerEvents: 'auto',
                                    minWidth: '320px',
                                    maxWidth: '90vw',
                                    borderLeft: `6px solid ${color}`
                                }}
                            >
                                <div style={{ color: color, display: 'flex', alignItems: 'center' }}>
                                    {toast.type === 'success' && <CheckCircle2 size={24} />}
                                    {toast.type === 'error' && <XCircle size={24} />}
                                    {toast.type === 'warning' && <AlertCircle size={24} />}
                                    {toast.type === 'info' && <Info size={24} />}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                    <span style={{ fontSize: '0.6rem', color: color, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.8 }}>
                                        {toast.type === 'error' ? 'Error del Sistema' : 'Notificación'}
                                    </span>
                                    <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.9rem' }}>
                                        {toast.message}
                                    </span>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};
