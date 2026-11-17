import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  Printer,
  QrCode,
  ScanLine,
  Search,
} from 'lucide-react';
import {
  AssetItem,
  AssetMutation,
  ConditionStatus,
  DamageReport,
  LocationUnit,
  OpnameStatus,
  RoleProfile,
} from '../types/simas';
import {
  DAMAGE_STATUS_META,
  OPNAME_STATUS_META,
  formatDateID,
  formatIDR,
} from '../utils/formatters';
import { PrintableQrSticker, QrCodeImage } from './QrCodeCanvas';
import { ConditionIndicator } from './StatusText';

interface QrScannerViewProps {
  assets: AssetItem[];
  locations: LocationUnit[];
  mutations: AssetMutation[];
  damageReports: DamageReport[];
  roleProfile: RoleProfile;
  onRecordQuickOpname: (
    assetId: string,
    status: OpnameStatus,
    observedCondition: ConditionStatus,
    notes: string
  ) => void;
  onQuickNavigateToDamage: (assetId: string) => void;
}

export const QrScannerView: React.FC<QrScannerViewProps> = ({
  assets,
  locations,
  mutations,
  damageReports,
  roleProfile,
  onRecordQuickOpname,
  onQuickNavigateToDamage,
}) => {
  const [subTab, setSubTab] = useState<'scanner' | 'generator'>('scanner');
  const [manualInput, setManualInput] = useState<string>('');
  const [scannedAssetId, setScannedAssetId] = useState<string>(assets[2]?.id ?? assets[0]?.id ?? '');
  const [isScanningAnim, setIsScanningAnim] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [opnameFeedback, setOpnameFeedback] = useState<string>('');
  const [generatorLocationFilter, setGeneratorLocationFilter] = useState<string>('ALL');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const locationMap = useMemo(
    () => new Map(locations.map((l) => [l.id, l])),
    [locations]
  );

  const scannedAsset = useMemo(
    () => assets.find((a) => a.id === scannedAssetId) ?? null,
    [assets, scannedAssetId]
  );

  const assetMutations = useMemo(
    () => mutations.filter((m) => m.assetId === scannedAssetId),
    [mutations, scannedAssetId]
  );

  const assetDamages = useMemo(
    () => damageReports.filter((d) => d.assetId === scannedAssetId),
    [damageReports, scannedAssetId]
  );

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const toggleLiveCamera = async () => {
    if (cameraActive) {
      stopCamera();
      return;
    }
    setCameraError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Akses kamera perangkat tidak tersedia di peramban ini. Gunakan mode Simulasi Bidik QR di bawah.'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError(
        'Izin kamera tidak diberikan atau tidak ada webcam terhubung. Gunakan tombol Simulasi Bidik QR untuk pengujian lapangan.'
      );
    }
  };

  const triggerSimulatedScan = (assetId: string) => {
    setIsScanningAnim(true);
    setOpnameFeedback('');
    window.setTimeout(() => {
      setScannedAssetId(assetId);
      setIsScanningAnim(false);
    }, 260);
  };

  const handleManualLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const q = manualInput.trim().toLowerCase();
    if (!q) return;
    const match = assets.find(
      (a) =>
        a.id.toLowerCase() === q ||
        a.qrPayload.toLowerCase() === q ||
        a.kodeBarang.toLowerCase() === q ||
        a.namaBarang.toLowerCase().includes(q) ||
        a.nomorPolisiOrSertifikat.toLowerCase() === q
    );
    if (match) {
      triggerSimulatedScan(match.id);
    } else {
      setOpnameFeedback(`Kode atau aset "${manualInput}" tidak ditemukan pada Master KIB.`);
    }
  };

  const handleQuickOpname = (status: OpnameStatus, condition: ConditionStatus) => {
    if (!scannedAsset) return;
    const note =
      status === 'SESUAI'
        ? `Cek kondisi harian / opname via pemindai QR oleh ${roleProfile.officerName}.`
        : `Temuan perubahan kondisi saat scan QR oleh ${roleProfile.officerName}.`;
    onRecordQuickOpname(scannedAsset.id, status, condition, note);
    setOpnameFeedback(
      `Berhasil mencatat status opname "${OPNAME_STATUS_META[status].label}" untuk ${scannedAsset.id}.`
    );
  };

  const generatorAssets = useMemo(() => {
    if (generatorLocationFilter === 'ALL') return assets;
    return assets.filter((a) => a.locationId === generatorLocationFilter);
  }, [assets, generatorLocationFilter]);

  return (
    <div className="space-y-5">
      {/* Header & Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4 no-print">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            QR Code Aset & Simulasi Pemindai Lapangan
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Pindai kode QR pada armada dan peralatan pos untuk cek riwayat serta opname real-time
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setSubTab('scanner')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'scanner'
                ? 'bg-white text-[#0B2545] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ScanLine className="w-3.5 h-3.5" />
            Pemindai Lapangan
          </button>
          <button
            type="button"
            onClick={() => setSubTab('generator')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'generator'
                ? 'bg-white text-[#0B2545] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            Generator & Cetak Label
          </button>
        </div>
      </div>

      {subTab === 'scanner' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Panel: Simulated Camera Viewfinder & Field Trigger */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-slate-900">
                Kamera Pemindai QR (Simulasi & Perangkat)
              </h3>
              <button
                type="button"
                onClick={toggleLiveCamera}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700 cursor-pointer"
              >
                {cameraActive ? (
                  <>
                    <CameraOff className="w-3.5 h-3.5" />
                    Matikan Kamera
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    Aktifkan Kamera
                  </>
                )}
              </button>
            </div>

            {/* Optical Viewfinder */}
            <div className="relative aspect-[4/3] w-full rounded-md bg-slate-950 overflow-hidden flex items-center justify-center border border-slate-800">
              {cameraActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                  {scannedAsset ? (
                    <div className="p-2.5 bg-white rounded-md shadow-sm">
                      <QrCodeImage value={scannedAsset.qrPayload} size={120} />
                    </div>
                  ) : (
                    <QrCode className="w-16 h-16 text-slate-600" />
                  )}
                  <p className="font-mono text-[11px] text-slate-300">
                    {isScanningAnim
                      ? 'Membaca payload QR SIMAS-BMD...'
                      : scannedAsset
                        ? scannedAsset.qrPayload
                        : 'Arahkan kamera ke stiker QR aset'}
                  </p>
                </div>
              )}

              {/* Reticle Frame */}
              <div className="pointer-events-none absolute inset-6 border border-white/20 rounded-sm">
                <div className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-2 border-l-2 border-amber-400" />
                <div className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-2 border-r-2 border-amber-400" />
                <div className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-2 border-l-2 border-amber-400" />
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-2 border-r-2 border-amber-400" />
              </div>
            </div>

            {cameraError && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2.5">
                {cameraError}
              </p>
            )}

            {/* Manual Payload Lookup */}
            <form onSubmit={handleManualLookup} className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Cari / Masukkan Payload QR atau ID Aset
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Contoh: AST-003 atau W 8014 NP"
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-[#0B2545]"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md cursor-pointer shrink-0"
                >
                  Pindai
                </button>
              </div>
            </form>

            {/* Quick Simulation Targets */}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <p className="text-xs font-semibold text-slate-700">
                Simulasi Bidik Stiker QR Aset Lapangan:
              </p>
              <div className="grid grid-cols-1 gap-1.5 max-h-52 overflow-y-auto pr-1">
                {assets.slice(0, 8).map((item) => {
                  const isSelected = item.id === scannedAssetId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => triggerSimulatedScan(item.id)}
                      className={`text-left px-3 py-2 rounded-md border text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-[#0B2545] text-white border-[#0B2545]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate font-medium">
                        <span className="font-mono mr-1.5">{item.id}</span>
                        {item.namaBarang}
                      </span>
                      <span
                        className={`font-mono text-[11px] shrink-0 ${
                          isSelected ? 'text-amber-300' : 'text-slate-500'
                        }`}
                      >
                        KIB {item.kibType}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Panel: Real-time Inspection Result & Field Actions */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-5">
            {!scannedAsset ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Pilih atau pindai kode QR aset untuk menampilkan informasi real-time.
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <p className="font-mono text-xs font-semibold text-[#0B2545]">
                      KIB {scannedAsset.kibType} · {scannedAsset.id} · Reg.{' '}
                      {scannedAsset.nomorRegister}
                    </p>
                    <h3 className="font-display text-lg font-bold text-slate-900 mt-1">
                      {scannedAsset.namaBarang}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {scannedAsset.merkTipe} · {scannedAsset.nomorPolisiOrSertifikat}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <ConditionIndicator condition={scannedAsset.kondisi} />
                    <p className="font-mono text-xs font-semibold text-slate-900 mt-1 tabular-nums sm:text-right">
                      {formatIDR(scannedAsset.nilaiPerolehan)}
                    </p>
                  </div>
                </div>

                {opnameFeedback && (
                  <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
                    {opnameFeedback}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2">
                    <div>
                      <span className="text-slate-500 block">Lokasi Penempatan Saat Ini</span>
                      <span className="font-semibold text-slate-900">
                        {locationMap.get(scannedAsset.locationId)?.name ??
                          scannedAsset.locationId}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Penanggung Jawab Unit</span>
                      <span className="font-medium text-slate-900">
                        {scannedAsset.penanggungJawab}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-slate-500 block">Status Opname Terakhir</span>
                      <span className="font-semibold text-slate-900">
                        {OPNAME_STATUS_META[scannedAsset.lastOpnameStatus].label} ·{' '}
                        {formatDateID(scannedAsset.lastOpnameDate)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Kode Barang Permendagri</span>
                      <span className="font-mono font-medium text-slate-900 tabular-nums">
                        {scannedAsset.kodeBarang}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Field Actions (RBAC-aware) */}
                <div className="border-t border-slate-200 pt-4 space-y-2">
                  <p className="text-xs font-semibold text-slate-800">
                    Aksi Cek Lapangan & Opname Cepat
                  </p>
                  {roleProfile.permissions.canPerformOpname ||
                  roleProfile.permissions.canReportDamage ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {roleProfile.permissions.canPerformOpname && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleQuickOpname('SESUAI', 'BAIK')}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Verifikasi Fisik Ada & Baik
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickOpname('KONDISI_BERUBAH', 'RUSAK_RINGAN')
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-md cursor-pointer"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Tandai Rusak Ringan
                          </button>
                        </>
                      )}
                      {roleProfile.permissions.canReportDamage && (
                        <button
                          type="button"
                          onClick={() => onQuickNavigateToDamage(scannedAsset.id)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 bg-white border border-red-300 hover:bg-red-50 rounded-md cursor-pointer"
                        >
                          Buat Laporan Kerusakan
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Mode Viewer (Pimpinan) hanya memiliki akses lihat riwayat aset. Ubah simulasi role ke Petugas Lapangan / Pengurus Barang untuk mencatat opname.
                    </p>
                  )}
                </div>

                {/* Historical Audit Trail */}
                <div className="border-t border-slate-200 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="font-semibold text-slate-800 mb-2">
                      Riwayat Mutasi ({assetMutations.length})
                    </p>
                    {assetMutations.length === 0 ? (
                      <p className="text-slate-500">Belum pernah dimutasi dari lokasi awal.</p>
                    ) : (
                      <ul className="space-y-2">
                        {assetMutations.map((m) => (
                          <li key={m.id} className="border-b border-slate-100 pb-1.5">
                            <p className="font-medium text-slate-800">
                              {locationMap.get(m.fromLocationId)?.code} →{' '}
                              {locationMap.get(m.toLocationId)?.code}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {formatDateID(m.requestDate)} · {m.nomorSurat}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="font-semibold text-slate-800 mb-2">
                      Riwayat Kerusakan ({assetDamages.length})
                    </p>
                    {assetDamages.length === 0 ? (
                      <p className="text-slate-500">Tidak ada riwayat kerusakan tercatat.</p>
                    ) : (
                      <ul className="space-y-2">
                        {assetDamages.map((d) => (
                          <li key={d.id} className="border-b border-slate-100 pb-1.5">
                            <p className="font-medium text-slate-800">
                              {d.ticketNumber} · {DAMAGE_STATUS_META[d.status].label}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {formatDateID(d.reportDate)} · {d.chronology.slice(0, 72)}...
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Generator & Cetak Label Massal */
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg p-4 no-print">
            <div className="flex items-center gap-3">
              <label
                htmlFor="qr-loc-filter"
                className="text-xs font-semibold text-slate-700 whitespace-nowrap"
              >
                Filter Lokasi Stiker:
              </label>
              <select
                id="qr-loc-filter"
                value={generatorLocationFilter}
                onChange={(e) => setGeneratorLocationFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
              >
                <option value="ALL">Semua Lokasi ({assets.length} Label)</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} · {l.name}
                  </option>
                ))}
              </select>
            </div>
            {roleProfile.permissions.canPrintQr && (
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md cursor-pointer self-start sm:self-auto"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Semua Label ({generatorAssets.length})
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {generatorAssets.map((item) => (
              <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-4">
                <PrintableQrSticker
                  asset={item}
                  locationName={locationMap.get(item.locationId)?.name ?? item.locationId}
                  canPrint={roleProfile.permissions.canPrintQr}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
