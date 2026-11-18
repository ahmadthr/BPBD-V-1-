import React, { useState } from 'react';
import { Camera, Download, Image as ImageIcon, Loader2, Trash2, X, ZoomIn } from 'lucide-react';
import { compressImageFileToDataUrl } from '../utils/imageHelper';

interface ItemPhotoControlProps {
  fotoDataUrl?: string;
  fotoNamaFile?: string;
  label?: string;
  onChange: (next: { fotoDataUrl?: string; fotoNamaFile?: string }) => void;
}

export const ItemPhotoControl: React.FC<ItemPhotoControlProps> = ({
  fotoDataUrl,
  fotoNamaFile,
  label = 'Foto Fisik Barang / Aset',
  onChange,
}) => {
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    try {
      const result = await compressImageFileToDataUrl(file, 900, 0.78);
      onChange({
        fotoDataUrl: result.dataUrl,
        fotoNamaFile: result.fileName,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses foto.');
    } finally {
      setCompressing(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label className="block font-semibold text-slate-700 text-xs">{label}</label>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-md bg-slate-50 border border-slate-200">
        <div className="w-20 h-20 rounded-md border border-slate-300 bg-white overflow-hidden flex items-center justify-center shrink-0">
          {fotoDataUrl ? (
            <img
              src={fotoDataUrl}
              alt={fotoNamaFile || 'Foto barang'}
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon className="w-6 h-6 text-slate-300" aria-hidden="true" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="text-[11px] text-slate-600">
            {fotoDataUrl ? (
              <span className="font-medium text-emerald-700 block truncate">
                Terlampir: {fotoNamaFile || 'foto-barang.jpg'}
              </span>
            ) : (
              <span>
                Unggah foto kondisi fisik barang (JPG, PNG, WEBP). Foto otomatis dikompres agar ringan.
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0B2545] bg-white border border-slate-300 hover:bg-slate-100 rounded cursor-pointer">
              {compressing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5" />
                  {fotoDataUrl ? 'Ganti Foto' : 'Unggah / Ambil Foto'}
                </>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => void handleFileChange(e)}
                disabled={compressing}
                className="sr-only"
              />
            </label>

            {fotoDataUrl && (
              <button
                type="button"
                onClick={() => onChange({ fotoDataUrl: undefined, fotoNamaFile: undefined })}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus Foto
              </button>
            )}
          </div>

          {error && <p className="text-[11px] text-red-700 font-medium">{error}</p>}
        </div>
      </div>
    </div>
  );
};

interface ItemPhotoThumbnailProps {
  fotoDataUrl?: string;
  alt: string;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

export const ItemPhotoThumbnail: React.FC<ItemPhotoThumbnailProps> = ({
  fotoDataUrl,
  alt,
  onClick,
  size = 'sm',
}) => {
  const dim = size === 'md' ? 'w-12 h-12' : 'w-10 h-10';
  if (!fotoDataUrl) {
    return (
      <div
        className={`${dim} rounded border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-300 shrink-0`}
        title="Belum ada foto"
      >
        <ImageIcon className="w-4 h-4" aria-hidden="true" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title="Klik untuk memperbesar foto barang"
      className={`${dim} group relative rounded border border-slate-300 bg-white overflow-hidden shrink-0 cursor-pointer hover:border-[#0B2545]`}
    >
      <img src={fotoDataUrl} alt={alt} className="w-full h-full object-cover" />
      <span className="absolute inset-0 bg-slate-900/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
        <ZoomIn className="w-3.5 h-3.5" />
      </span>
    </button>
  );
};

export interface PhotoLightboxData {
  title: string;
  subtitle?: string;
  dataUrl: string;
  fileName?: string;
}

interface PhotoLightboxModalProps {
  photo: PhotoLightboxData | null;
  onClose: () => void;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  photo,
  onClose,
}) => {
  if (!photo) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 p-4 no-print">
      <div className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <div className="min-w-0">
            <h4 className="font-display text-sm font-bold text-slate-900 truncate">
              {photo.title}
            </h4>
            {photo.subtitle && (
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">{photo.subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 cursor-pointer shrink-0"
            aria-label="Tutup foto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 bg-slate-100 flex items-center justify-center max-h-[70vh] overflow-auto">
          <img
            src={photo.dataUrl}
            alt={photo.title}
            className="max-w-full max-h-[62vh] object-contain rounded border border-slate-300 bg-white"
          />
        </div>

        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between bg-white text-xs">
          <a
            href={photo.dataUrl}
            download={photo.fileName || 'foto-barang-simas-bmd.jpg'}
            className="inline-flex items-center gap-1.5 font-semibold text-[#0B2545] hover:underline"
          >
            <Download className="w-3.5 h-3.5" />
            Unduh Foto Barang
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
