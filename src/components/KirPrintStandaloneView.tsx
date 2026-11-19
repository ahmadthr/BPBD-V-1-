import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { ArrowLeft, FileText, Printer, Shield } from 'lucide-react';
import { LocationUnit, RoomAssetEntry, RoomUnit } from '../types/simas';
import {
  KIR_LOGO_PATH,
  KirSheetRenderData,
  buildRoomDetailUrl,
  downloadKirPdf,
} from '../utils/printHelper';

interface KirPrintStandaloneViewProps {
  rooms: RoomUnit[];
  roomItems: RoomAssetEntry[];
  locations: LocationUnit[];
  targetRoomId?: string;
  scope: 'current' | 'all';
  autoprint?: boolean;
  onBackToApp: () => void;
}

const STANDALONE_KIR_CSS = `
  @page { size: A4 landscape; margin: 10mm; }
  .kir-print-sheet {
    border: 1.5px solid #0f172a;
    padding: 16px;
    background: #ffffff;
    page-break-after: always;
    break-after: page;
    margin-bottom: 20px;
  }
  .kir-print-sheet:last-child {
    page-break-after: auto;
    break-after: auto;
    margin-bottom: 0;
  }
  .kir-kop {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 3px double #0f172a;
    padding-bottom: 10px;
    margin-bottom: 12px;
    gap: 14px;
  }
  .kir-kop-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .kir-logo {
    width: 56px;
    height: 56px;
    object-fit: contain;
  }
  .kir-gov { font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #0f172a; }
  .kir-opd { font-size: 14px; font-weight: 800; color: #0B2545; text-transform: uppercase; }
  .kir-addr { font-size: 10px; color: #475569; }
  .kir-title {
    text-align: center;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin: 6px 0 12px 0;
    color: #0f172a;
  }
  .kir-meta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 24px;
    font-size: 11px;
    margin-bottom: 12px;
  }
  .kir-meta-row {
    display: flex;
    gap: 8px;
  }
  .kir-meta-label { width: 145px; color: #475569; flex-shrink: 0; }
  .kir-meta-val { font-weight: 700; color: #0f172a; }
  table.kir-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5px;
    margin-bottom: 12px;
  }
  table.kir-table th,
  table.kir-table td {
    border: 1px solid #334155;
    padding: 5px 6px;
    vertical-align: top;
  }
  table.kir-table th {
    background: #f1f5f9;
    font-weight: 700;
    text-align: center;
    text-transform: uppercase;
    font-size: 9.5px;
    color: #0f172a;
  }
  .kir-sign-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin-top: 16px;
    font-size: 10.5px;
    text-align: center;
  }
  .kir-sign-space { height: 52px; }
  .kir-qr-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    border: 1px solid #cbd5e1;
    padding: 4px;
    background: #ffffff;
    flex-shrink: 0;
  }
  .kir-qr-box img { width: 64px; height: 64px; display: block; }
  .kir-qr-box span { font-family: monospace; font-size: 8px; margin-top: 2px; color: #334155; }
  @media print {
    body { background: #ffffff !important; margin: 0 !important; padding: 0 !important; }
    .kir-print-wrapper { padding: 0 !important; max-width: 100% !important; background: #ffffff !important; }
    .kir-print-sheet { margin-bottom: 0 !important; }
  }
`;

export const KirPrintStandaloneView: React.FC<KirPrintStandaloneViewProps> = ({
  rooms,
  roomItems,
  locations,
  targetRoomId,
  scope,
  autoprint = false,
  onBackToApp,
}) => {
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [busyPdf, setBusyPdf] = useState(false);
  const autoPrintedRef = useRef(false);

  const locationMap = useMemo(
    () => new Map(locations.map((l) => [l.id, l])),
    [locations]
  );

  const sheetsToRender = useMemo(() => {
    if (scope === 'all') return rooms;
    const target = targetRoomId
      ? rooms.find(
          (r) =>
            r.id.toLowerCase() === targetRoomId.toLowerCase() ||
            r.kodeRuang.toLowerCase() === targetRoomId.toLowerCase()
        )
      : rooms[0];
    return target ? [target] : rooms.slice(0, 1);
  }, [rooms, scope, targetRoomId]);

  useEffect(() => {
    let active = true;
    if (sheetsToRender.length === 0) return;
    void Promise.all(
      sheetsToRender.map(async (rm) => {
        const { fullUrl } = buildRoomDetailUrl(rm.id);
        const dataUrl = await QRCode.toDataURL(fullUrl, {
          width: 240,
          margin: 1,
          color: { dark: '#0B2545', light: '#FFFFFF' },
        });
        return [rm.id, dataUrl] as const;
      })
    ).then((entries) => {
      if (!active) return;
      const next: Record<string, string> = {};
      entries.forEach(([id, url]) => {
        next[id] = url;
      });
      setQrMap(next);
    });
    return () => {
      active = false;
    };
  }, [sheetsToRender]);

  const allQrsReady =
    sheetsToRender.length > 0 &&
    sheetsToRender.every((rm) => Boolean(qrMap[rm.id]));

  useEffect(() => {
    if (!autoprint || autoPrintedRef.current) return;
    if (!allQrsReady || (!logoLoaded && !logoFailed)) return;
    autoPrintedRef.current = true;
    const timer = window.setTimeout(() => {
      try {
        window.print();
      } catch {
        // User can click "Cetak / Simpan PDF di Chrome" button in toolbar
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [autoprint, allQrsReady, logoLoaded, logoFailed]);

  const toRenderData = (rm: RoomUnit): KirSheetRenderData => {
    const loc = locationMap.get(rm.locationId);
    const { fullUrl } = buildRoomDetailUrl(rm.id);
    return {
      roomId: rm.id,
      kodeRuang: rm.kodeRuang,
      namaRuang: rm.namaRuang,
      locationLabel: loc?.name ?? rm.lantaiGedung,
      lantaiGedung: rm.lantaiGedung,
      penanggungJawab: rm.penanggungJawab,
      nipPenanggungJawab: rm.nipPenanggungJawab,
      qrUrl: fullUrl,
      items: roomItems
        .filter((it) => it.roomId === rm.id)
        .map((it) => ({
          namaBarang: it.namaBarang,
          merkModel: it.merkModel,
          tahunPerolehan: it.tahunPerolehan,
          kodeBarang: it.kodeBarang,
          nomorRegister: it.nomorRegister,
          jumlah: it.jumlah,
          satuan: it.satuan,
          kondisi: it.kondisi,
          keterangan: it.keterangan,
        })),
    };
  };

  const handleDownloadPdf = async () => {
    if (sheetsToRender.length === 0) return;
    setBusyPdf(true);
    try {
      const filename =
        scope === 'all' || sheetsToRender.length > 1
          ? 'KIR-Semua-Ruangan-BPBD-Sidoarjo.pdf'
          : `KIR-${sheetsToRender[0].kodeRuang}-${sheetsToRender[0].id}.pdf`;
      await downloadKirPdf(sheetsToRender.map(toRenderData), filename);
    } finally {
      setBusyPdf(false);
    }
  };

  const todayStr = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <style>{STANDALONE_KIR_CSS}</style>

      {/* Chrome Print Action Bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 no-print shadow-xs">
        <div className="max-w-[1160px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-sm sm:text-base font-bold text-[#0B2545]">
              Cetak Kartu Inventaris Ruangan (KIR) · Browser Chrome
            </h1>
            <p className="text-xs text-slate-600">
              {sheetsToRender.length === 1
                ? `${sheetsToRender[0].namaRuang} (${sheetsToRender[0].kodeRuang})`
                : `${sheetsToRender.length} Ruangan · Format Kertas A4 Landscape`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              Cetak / Simpan PDF di Chrome
            </button>
            <button
              type="button"
              disabled={busyPdf || sheetsToRender.length === 0}
              onClick={() => void handleDownloadPdf()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0B2545] bg-amber-100 hover:bg-amber-200 border border-amber-300 disabled:opacity-50 rounded-md cursor-pointer whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              {busyPdf ? 'Menyiapkan PDF...' : 'Unduh File PDF'}
            </button>
            <button
              type="button"
              onClick={onBackToApp}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali
            </button>
          </div>
        </div>
      </div>

      {/* Printable A4 Landscape KIR Sheets */}
      <div className="kir-print-wrapper max-w-[1160px] mx-auto p-4 sm:p-6">
        {sheetsToRender.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-600">
            Data ruangan KIR tidak ditemukan.
          </div>
        ) : (
          sheetsToRender.map((rm) => {
            const items = roomItems.filter((it) => it.roomId === rm.id);
            const loc = locationMap.get(rm.locationId);
            const qrData = qrMap[rm.id];

            return (
              <div key={rm.id} className="kir-print-sheet">
                <div className="kir-kop">
                  <div className="kir-kop-left">
                    {!logoFailed ? (
                      <img
                        src={KIR_LOGO_PATH}
                        alt="Logo Pemerintah Kabupaten Sidoarjo"
                        className="kir-logo"
                        onLoad={() => setLogoLoaded(true)}
                        onError={() => setLogoFailed(true)}
                      />
                    ) : (
                      <Shield className="w-12 h-12 text-[#0B2545]" />
                    )}
                    <div>
                      <div className="kir-gov">Pemerintah Kabupaten Sidoarjo</div>
                      <div className="kir-opd">
                        Badan Penanggulangan Bencana Daerah (BPBD)
                      </div>
                      <div className="kir-addr">
                        Jl. Sultan Agung No. 19A, Magersari, Sidoarjo · Telp. (031)
                        8953200
                      </div>
                    </div>
                  </div>
                  <div className="kir-qr-box">
                    {qrData && (
                      <img src={qrData} alt={`QR Ruangan ${rm.kodeRuang}`} />
                    )}
                    <span>{rm.kodeRuang}</span>
                  </div>
                </div>

                <div className="kir-title">Kartu Inventaris Ruangan (KIR)</div>

                <div className="kir-meta-grid">
                  <div className="kir-meta-row">
                    <span className="kir-meta-label">Provinsi / Kab.</span>
                    <span className="kir-meta-val">
                      : Jawa Timur / Kabupaten Sidoarjo
                    </span>
                  </div>
                  <div className="kir-meta-row">
                    <span className="kir-meta-label">Nama Ruangan</span>
                    <span className="kir-meta-val">: {rm.namaRuang}</span>
                  </div>
                  <div className="kir-meta-row">
                    <span className="kir-meta-label">Unit Kerja / OPD</span>
                    <span className="kir-meta-val">: BPBD Kabupaten Sidoarjo</span>
                  </div>
                  <div className="kir-meta-row">
                    <span className="kir-meta-label">Kode Lokasi / Ruang</span>
                    <span
                      className="kir-meta-val"
                      style={{ fontFamily: 'monospace' }}
                    >
                      : {rm.kodeRuang}
                    </span>
                  </div>
                  <div className="kir-meta-row">
                    <span className="kir-meta-label">Pos / Gedung</span>
                    <span className="kir-meta-val">
                      : {loc?.name ?? rm.lantaiGedung} ({rm.lantaiGedung})
                    </span>
                  </div>
                  <div className="kir-meta-row">
                    <span className="kir-meta-label">Penanggung Jawab</span>
                    <span className="kir-meta-val">: {rm.penanggungJawab}</span>
                  </div>
                </div>

                <table className="kir-table">
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{ width: '28px' }}>
                        No
                      </th>
                      <th rowSpan={2}>Nama / Jenis Barang</th>
                      <th rowSpan={2}>Merk / Model / Tipe</th>
                      <th rowSpan={2} style={{ width: '46px' }}>
                        Tahun
                      </th>
                      <th rowSpan={2} style={{ width: '110px' }}>
                        Kode Barang
                      </th>
                      <th rowSpan={2} style={{ width: '62px' }}>
                        No. Reg
                      </th>
                      <th rowSpan={2} style={{ width: '68px' }}>
                        Jumlah
                      </th>
                      <th colSpan={3}>Keadaan Barang</th>
                      <th rowSpan={2}>Keterangan</th>
                    </tr>
                    <tr>
                      <th style={{ width: '28px' }}>B</th>
                      <th style={{ width: '28px' }}>RR</th>
                      <th style={{ width: '28px' }}>RB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={11}
                          style={{
                            textAlign: 'center',
                            padding: '18px',
                            color: '#64748b',
                          }}
                        >
                          Belum ada daftar barang tercatat pada ruangan ini.
                        </td>
                      </tr>
                    ) : (
                      items.map((it, idx) => (
                        <tr key={it.id}>
                          <td
                            style={{
                              textAlign: 'center',
                              fontFamily: 'monospace',
                            }}
                          >
                            {idx + 1}
                          </td>
                          <td>
                            <strong>{it.namaBarang}</strong>
                          </td>
                          <td>{it.merkModel}</td>
                          <td
                            style={{
                              textAlign: 'center',
                              fontFamily: 'monospace',
                            }}
                          >
                            {it.tahunPerolehan}
                          </td>
                          <td style={{ fontFamily: 'monospace' }}>
                            {it.kodeBarang}
                          </td>
                          <td
                            style={{
                              textAlign: 'center',
                              fontFamily: 'monospace',
                            }}
                          >
                            {it.nomorRegister}
                          </td>
                          <td
                            style={{
                              textAlign: 'center',
                              fontFamily: 'monospace',
                            }}
                          >
                            {it.jumlah} {it.satuan}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>
                            {it.kondisi === 'BAIK' ? '✓' : '-'}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>
                            {it.kondisi === 'RUSAK_RINGAN' ? '✓' : '-'}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>
                            {it.kondisi === 'RUSAK_BERAT' ? '✓' : '-'}
                          </td>
                          <td>{it.keterangan}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                <div
                  style={{
                    fontSize: '10px',
                    color: '#475569',
                    marginBottom: '8px',
                  }}
                >
                  Catatan: B = Baik · RR = Rusak Ringan · RB = Rusak Berat.
                  Dilarang memindahkan barang dari ruangan tanpa seizin Pengurus
                  Barang Pengguna &amp; Pejabat Penatausahaan Pengguna Barang.
                </div>

                <div className="kir-sign-grid">
                  <div>
                    <div>Mengetahui,</div>
                    <div>
                      <strong>Pengguna Barang / Kepala Pelaksana</strong>
                    </div>
                    <div className="kir-sign-space" />
                    <div>
                      <u>
                        <strong>Sabino Mariano, S. Sos., M.KP.</strong>
                      </u>
                    </div>
                    <div style={{ fontFamily: 'monospace' }}>
                      NIP. 19740108 199302 1 003
                    </div>
                  </div>
                  <div>
                    <div>Diperiksa Oleh,</div>
                    <div>
                      <strong>Pengurus Barang Pengguna</strong>
                    </div>
                    <div className="kir-sign-space" />
                    <div>
                      <u>
                        <strong>Ahmad Thohir, A. Md.</strong>
                      </u>
                    </div>
                    <div style={{ fontFamily: 'monospace' }}>
                      NIP. 19870616 201001 1 008
                    </div>
                  </div>
                  <div>
                    <div>Sidoarjo, {todayStr}</div>
                    <div>
                      <strong>Penanggung Jawab Ruangan</strong>
                    </div>
                    <div className="kir-sign-space" />
                    <div>
                      <u>
                        <strong>{rm.penanggungJawab}</strong>
                      </u>
                    </div>
                    <div style={{ fontFamily: 'monospace' }}>
                      NIP. {rm.nipPenanggungJawab || '-'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
