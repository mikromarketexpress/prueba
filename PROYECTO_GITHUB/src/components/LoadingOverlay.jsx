import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LoadingOverlay = ({ isVisible, message = "Procesando Producto..." }) => {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9999,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(8, 13, 24, 0.4)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                    }}
                >
                    <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                        {/* Outer rotating ring */}
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            style={{
                                width: '100%',
                                height: '100%',
                                borderRadius: '50%',
                                border: '4px solid transparent',
                                borderTopColor: 'var(--s-neon)',
                                filter: 'drop-shadow(0 0 8px var(--s-neon-glow))',
                            }}
                        />

                        {/* Inner pulse */}
                        <motion.div
                            animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.3, 0.7, 0.3] }}
                            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                            style={{
                                position: 'absolute',
                                inset: '15px',
                                borderRadius: '50%',
                                background: 'var(--s-neon)',
                                opacity: 0.5,
                                filter: 'blur(10px)',
                            }}
                        />
                    </div>

                    <motion.p
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                        style={{
                            marginTop: '2rem',
                            color: 'var(--s-neon)',
                            fontSize: '0.9rem',
                            fontWeight: 900,
                            letterSpacing: '0.2em',
                            textTransform: 'uppercase',
                            textShadow: '0 0 10px var(--s-neon-glow)'
                        }}
                    >
                        {message}
                    </motion.p>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default LoadingOverlay;
