import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, ExternalLink, FileCode2, Printer } from 'lucide-react';
import { AssetItem } from '../types/simas';
import {
  STICKER_PRINT_CSS,
  buildAssetDetailUrl,
  copyTextToClipboard,
  downloadHtmlDocument,
  downloadStickerCardPng,
  generateStickerHtmlBlock,
  printHtmlInHiddenFrame,
} from '../utils/printHelper';

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
  onOpenPublicProfile?: (kode: string, register: string) => void;
}

export const PrintableQrSticker: React.FC<PrintableQrStickerProps> = ({
  asset,
  locationName,
  canPrint = true,
  onOpenPublicProfile,
}) => {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const { fullUrl, pathUrl } = buildAssetDetailUrl(
    asset.kodeBarang,
    asset.nomorRegister
  );

  const stickerData = {
    id: asset.id,
    kibLabel: `KIB ${asset.kibType}`,
    namaBarang: asset.namaBarang,
    kodeBarang: asset.kodeBarang,
    nomorRegister: asset.nomorRegister,
    tahunPerolehan: asset.tahunPerolehan,
    locationName,
    qrPayload: asset.qrPayload,
    qrUrl: fullUrl,
  };

  const handlePrintSticker = async () => {
    setBusy(true);
    try {
      const cardHtml = await generateStickerHtmlBlock(stickerData);
      printHtmlInHiddenFrame(
        `Stiker QR ${asset.id} - ${asset.namaBarang}`,
        `<div class="sticker-single">${cardHtml}</div>`,
        STICKER_PRINT_CSS
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadStickerPng = async () => {
    setBusy(true);
    try {
      await downloadStickerCardPng(stickerData);
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadStickerHtml = async () => {
    setBusy(true);
    try {
      const cardHtml = await generateStickerHtmlBlock(stickerData);
      downloadHtmlDocument(
        `Stiker-QR-${asset.id}-${asset.kodeBarang}.html`,
        `Stiker QR ${asset.id} - ${asset.namaBarang}`,
        `<div class="sticker-single">${cardHtml}</div>`,
        STICKER_PRINT_CSS
      );
    } finally {
      setBusy(false);
    }
  };

  const [copyFailed, setCopyFailed] = useState(false);

  const handleCopyUrl = async () => {
    const ok = await copyTextToClipboard(fullUrl);
    if (ok) {
      setCopyFailed(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      setCopyFailed(true);
      window.setTimeout(() => setCopyFailed(false), 3000);
    }
  };

  return (
    <div className="space-y-3">
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
            {/* QR encodes the real clickable URL so smartphone cameras open /aset/detail directly */}
            <QrCodeImage value={fullUrl} size={112} />
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

        <div className="mt-3 pt-2 border-t border-slate-200 space-y-1 text-[10px] font-mono">
          <div className="text-slate-500 truncate">{asset.qrPayload}</div>
          <div className="flex items-center justify-between gap-2">
            <a
              href={pathUrl}
              onClick={(e) => {
                if (onOpenPublicProfile) {
                  e.preventDefault();
                  onOpenPublicProfile(asset.kodeBarang, asset.nomorRegister);
                }
              }}
              className="text-[#0B2545] hover:underline truncate inline-flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3 shrink-0" />
              <span className="truncate">{fullUrl}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Action Buttons: Copy URL, Print Isolated Sticker, Download PNG Sticker, Download HTML */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        {canPrint && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handlePrintSticker()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Label Stiker
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleDownloadStickerPng()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh Stiker PNG
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleDownloadStickerHtml()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Unduh file HTML siap cetak jika dialog print browser dibatasi"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              File Cetak
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => void handleCopyUrl()}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0B2545] bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-700" />
              Tautan Disalin
            </>
          ) : copyFailed ? (
            <>
              <Copy className="w-3.5 h-3.5 text-amber-700" />
              Pilih URL di atas
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Salin Tautan QR
            </>
          )}
        </button>
      </div>
    </div>
  );
};
