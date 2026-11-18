export interface CompressedPhotoResult {
  dataUrl: string;
  fileName: string;
}

/**
 * Compresses an uploaded image file to a lightweight JPEG/PNG Data URL
 * suitable for persistent local storage and printable cards.
 */
export async function compressImageFileToDataUrl(
  file: File,
  maxDimension = 900,
  quality = 0.78
): Promise<CompressedPhotoResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Berkas harus berupa gambar (JPG, PNG, WEBP).');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Ukuran gambar melebihi batas 10 MB.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Gagal membaca berkas gambar.'));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.readAsDataURL(file);
  });

  // Skip canvas re-encoding for SVG
  if (file.type === 'image/svg+xml') {
    return { dataUrl: rawDataUrl, fileName: file.name };
  }

  return new Promise<CompressedPhotoResult>((resolve) => {
    const img = new Image();
    img.onload = () => {
      let targetW = img.width;
      let targetH = img.height;
      if (targetW > maxDimension || targetH > maxDimension) {
        if (targetW >= targetH) {
          targetH = Math.round((targetH * maxDimension) / targetW);
          targetW = maxDimension;
        } else {
          targetW = Math.round((targetW * maxDimension) / targetH);
          targetH = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, targetW);
      canvas.height = Math.max(1, targetH);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ dataUrl: rawDataUrl, fileName: file.name });
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve({
        dataUrl: compressed.length < rawDataUrl.length ? compressed : rawDataUrl,
        fileName: file.name,
      });
    };
    img.onerror = () => {
      resolve({ dataUrl: rawDataUrl, fileName: file.name });
    };
    img.src = rawDataUrl;
  });
}
