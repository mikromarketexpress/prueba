import React, { useState } from 'react';

/**
 * ProductImageUploader
 * -------------------
 * Allows the user to select an image file and upload it to a Google Drive folder
 * using a Google Apps Script endpoint.
 *
 * The endpoint URL must be provided via the VITE_DRIVE_UPLOAD_URL environment
 * variable (defined in .env.local). The Apps Script should accept a multipart/form-
 * data POST with the fields:
 *   - file: the binary image file
 *   - folderId: (optional) the Drive folder ID where the image will be stored
 *
 * The component displays a preview of the selected image, an upload button,
 * and basic success/error feedback.
 */
const ProductImageUploader = () => {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [status, setStatus] = useState('idle'); // idle | uploading | success | error
  const [message, setMessage] = useState('');

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      const url = URL.createObjectURL(selected);
      setPreviewUrl(url);
    }
  };

  const upload = async () => {
    if (!file) {
      setMessage('Selecciona una imagen antes de subir.');
      setStatus('error');
      return;
    }
    setStatus('uploading');
    setMessage('');
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      await new Promise((resolve, reject) => {
        reader.onload = resolve;
        reader.onerror = reject;
      });
      const dataUrl = reader.result;
      // dataUrl format: data:<mime>;base64,<base64data>
      const base64 = dataUrl.split(',')[1];
      const payload = {
        action: 'UPLOAD_IMAGE',
        data: base64,
        filename: file.name,
        // optional folderId can be sent if needed
      };
      const response = await fetch(import.meta.env.VITE_DRIVE_UPLOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setStatus('success');
        setMessage(`Imagen subida correctamente. URL: ${data.thumbnailUrl || data.webViewLink}`);
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage(`Fallo al subir la imagen: ${err.message}`);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 bg-gray-900/60 rounded-lg backdrop-blur-md border border-gray-700">
      <h2 className="text-xl font-bold mb-4 text-white">Subir Imagen de Producto</h2>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="mb-3 block w-full text-white bg-gray-800 rounded"
      />
      {previewUrl && (
        <img src={previewUrl} alt="Vista previa" className="mb-3 w-full h-auto rounded" />
      )}
      <button
        onClick={upload}
        disabled={status === 'uploading'}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white w-full"
      >
        {status === 'uploading' ? 'Subiendo…' : 'Subir Imagen'}
      </button>
      {message && (
        <p className={`mt-3 ${status === 'error' ? 'text-red-400' : 'text-green-400'}`}>{message}</p>
      )}
    </div>
  );
};

export default ProductImageUploader;
