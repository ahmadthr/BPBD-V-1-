import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Printer } from 'lucide-react';
import { AssetItem } from '../types/simas';

interface QrCodeCanvasProps {
  value: string;
  size?: number;
  className?: string;
}

export const QrCodeImage: React.FC<QrCodeCanvasProps> = ({
  value,
  size = 160,
  className = '',
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: {
        dark: '#0B2545',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center border border-slate-200 bg-slate-50 text-xs text-slate-400 ${className}`}
      >
        Memuat QR...
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={`Kode QR ${value}`}
      width={size}
      height={size}
      className={`block bg-white ${className}`}
    />
  );
};

interface PrintableQrStickerProps {
  asset: AssetItem;
  locationName: string;
  canPrint?: boolean;
}

export const PrintableQrSticker: React.FC<PrintableQrStickerProps> = ({
  asset,
  locationName,
  canPrint = true,
}) => {
  const handleDownloadPng = async () => {
    try {
      const url = await QRCode.toDataURL(asset.qrPayload, {
        width: 512,
        margin: 2,
        color: { dark: '#0B2545', light: '#FFFFFF' },
      });
      const a = document.createElement('a');
      a.href = url;
      a.download = `QR-${asset.id}-${asset.kodeBarang}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      // handled silently
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-slate-900 bg-white p-4">
        <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/assets/aistudio/logo-bpbd-sidoarjo-removebg-preview_e9477ae6.png"
              alt="Logo BPBD Sidoarjo"
              referrerPolicy="no-referrer"
              className="w-8 h-8 object-contain shrink-0"
            />
            <div>
              <p className="text-[11px] font-bold tracking-wider uppercase text-slate-900">
                Pemerintah Kabupaten Sidoarjo
              </p>
              <p className="text-xs font-semibold text-[#0B2545]">
                BPBD · Barang Milik Daerah (KIB {asset.kibType})
              </p>
            </div>
          </div>
          <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
            {asset.id}
          </span>
        </div>

        <div className="flex items-start gap-4">
          <div className="shrink-0 border border-slate-200 p-1 bg-white">
            <QrCodeImage value={asset.qrPayload} size={112} />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="font-display text-sm font-bold text-slate-900 leading-snug">
              {asset.namaBarang}
            </p>
            <div className="grid grid-cols-1 gap-1 text-xs text-slate-600">
              <div className="flex justify-between gap-2 border-b border-slate-100 pb-1">
                <span>Kode Barang</span>
                <span className="font-mono font-medium text-slate-900 tabular-nums">
                  {asset.kodeBarang}
                </span>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-100 pb-1">
                <span>No. Register</span>
                <span className="font-mono font-medium text-slate-900 tabular-nums">
                  {asset.nomorRegister} / {asset.tahunPerolehan}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Lokasi</span>
                <span className="font-medium text-slate-900 truncate max-w-[180px]">
                  {locationName}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span className="truncate">{asset.qrPayload}</span>
          <span className="shrink-0 ml-2">SIMAS-BMD</span>
        </div>
      </div>

      {canPrint && (
        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak Label Stiker
          </button>
          <button
            type="button"
            onClick={handleDownloadPng}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Unduh PNG QR
          </button>
        </div>
      )}
    </div>
  );
};
