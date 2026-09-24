import { useState, useCallback } from 'react';

const getDriveApiUrl = () => {
    const url = import.meta?.env?.VITE_GS_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbwup--lIgu_r4EmGomBJo1fceZIPdWhG1zrNAt-Jud8NpF5E9q719tzrpH0b-Fl7OL88w/exec';
    return String(url || '').trim().replace(/\s+/g, '').replace(/\/+$/, '');
};
const DRIVE_API_URL = getDriveApiUrl();
const DRIVE_FOLDER_ID = import.meta?.env?.VITE_GS_DRIVE_FOLDER_ID || '1Otottj5OHWtAszwKm_MQMIuByt_UBLW8';

async function compressImage(file, maxWidth = 400, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const width = Math.min(img.width, maxWidth);
                const height = (img.height * width) / img.width;
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob && blob.size > 0) {
                        const r = new FileReader();
                        r.onloadend = () => resolve(r.result.split(',')[1]);
                        r.onerror = () => resolve(null);
                        r.readAsDataURL(blob);
                    } else {
                        resolve(null);
                    }
                }, 'image/webp', quality);
            };
            img.onerror = () => resolve(null);
            img.src = e.target.result;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });
}

export function useImageStorage() {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);

    const uploadImage = useCallback(async (file, productId) => {
        if (!file) return { success: false, error: 'Sin archivo' };

        setUploading(true);
        setError(null);

        try {
            const base64 = await compressImage(file, 400, 0.7);
            if (!base64) {
                setUploading(false);
                return { success: false, error: 'Error al comprimir imagen' };
            }

            const filename = `${productId || 'new'}_${Date.now()}.webp`;

            console.log('[ImageStorage] Subiendo a:', DRIVE_API_URL);

            const payload = JSON.stringify({
                action: 'UPLOAD_IMAGE',
                data: {
                    data: base64,
                    filename: filename,
                    folderId: DRIVE_FOLDER_ID
                }
            });

            const response = await fetch(DRIVE_API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8'
                },
                body: payload
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const text = await response.text();
            let result;
            try {
                result = JSON.parse(text);
            } catch (jsonErr) {
                throw new Error('Respuesta de Google Drive no es un JSON válido: ' + text.substring(0, 200));
            }

            console.log('[ImageStorage] Result:', JSON.stringify(result));

            setUploading(false);

            if (result && (result.success === true || result.status === 'success')) {
                const realUrl = result.thumbnailUrl || result.webViewLink || '';
                return {
                    success: true,
                    filename,
                    url: realUrl,
                    fileId: result.fileId || ''
                };
            }

            return { success: false, error: result.error || result.message || 'Error en respuesta de subida' };
        } catch (err) {
            setError(err.message);
            console.error('Upload error:', err);
            setUploading(false);
            return { success: false, error: err.message };
        }
    }, []);

    const getImageUrl = useCallback((url) => {
        if (!url) return null;
        if (url.startsWith('data:')) return url;
        if (url.startsWith('blob:')) return url;
        if (url.includes('drive.google.com')) return url;
        if (url.includes('unsplash.com')) return url;
        if (url.includes('images.unsplash')) return url;
        return url;
    }, []);

    return { uploadImage, getImageUrl, uploading, error };
}