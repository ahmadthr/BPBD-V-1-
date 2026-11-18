import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bike,
  Building2,
  Car,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  FileCheck2,
  FileText,
  LogIn,
  MapPin,
  Paperclip,
  QrCode,
  Shield,
  ShieldCheck,
  UserCheck,
  Wrench,
  X,
} from 'lucide-react';
import {
  AssetItem,
  AssetMutation,
  AuthSession,
  DamageReport,
  LocationUnit,
  RoleProfile,
  RoomAssetEntry,
  RoomUnit,
  VehicleItem,
  VehicleMaintenanceRecord,
} from '../types/simas';
import {
  DAMAGE_STATUS_META,
  KIB_META,
  OPNAME_STATUS_META,
  formatDateID,
  formatIDR,
  getTaxExpiryInfo,
} from '../utils/formatters';
import {
  buildAssetDetailUrl,
  buildRoomDetailUrl,
  copyTextToClipboard,
} from '../utils/printHelper';
import {
  ItemPhotoThumbnail,
  PhotoLightboxData,
  PhotoLightboxModal,
} from './ItemPhotoControl';
import { QrCodeImage } from './QrCodeCanvas';
import { ConditionIndicator } from './StatusText';

interface AssetPublicProfileViewProps {
  kodeParam: string;
  registerParam: string;
  ruangParam?: string;
  assets: AssetItem[];
  vehicles: VehicleItem[];
  vehicleMaintenances: VehicleMaintenanceRecord[];
  locations: LocationUnit[];
  mutations: AssetMutation[];
  damageReports: DamageReport[];
  rooms?: RoomUnit[];
  roomItems?: RoomAssetEntry[];
  session: AuthSession | null;
  roleProfile: RoleProfile;
  onBackToDashboard: () => void;
  onEditDataAction: (target: { type: 'vehicle' | 'asset' | 'kir'; id: string }) => void;
  onSelectAlternateAsset: (kode: string, register: string) => void;
}

const MAINTENANCE_LABEL: Record<
  VehicleMaintenanceRecord['jenisPenanganan'],
  { label: string; textClass: string }
> = {
  PEMELIHARAAN_RUTIN: {
    label: 'Pemeliharaan Rutin',
    textClass: 'text-emerald-700',
  },
  PERBAIKAN_RINGAN: {
    label: 'Perbaikan Ringan',
    textClass: 'text-amber-700',
  },
  PERBAIKAN_BERAT: {
    label: 'Perbaikan Berat',
    textClass: 'text-red-700',
  },
};

export const AssetPublicProfileView: React.FC<AssetPublicProfileViewProps> = ({
  kodeParam,
  registerParam,
  ruangParam = '',
  assets,
  vehicles,
  vehicleMaintenances,
  locations,
  mutations,
  damageReports,
  rooms = [],
  roomItems = [],
  session,
  roleProfile,
  onBackToDashboard,
  onEditDataAction,
  onSelectAlternateAsset,
}) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const [copiedProfileLink, setCopiedProfileLink] = useState(false);
  const [proofPreview, setProofPreview] = useState<{
    fileName: string;
    mimeType: string;
    dataUrl: string;
    caption: string;
  } | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoLightboxData | null>(null);

  const locationMap = useMemo(
    () => new Map(locations.map((l) => [l.id, l])),
    [locations]
  );

  const normKode = kodeParam.trim().toLowerCase();
  const normReg = registerParam.trim().toLowerCase();

  // Match against both KIB Master Assets and Vehicle Inventory using kode + register
  const matchedAsset = useMemo(() => {
    if (!normKode) return null;
    return (
      assets.find(
        (a) =>
          a.kodeBarang.toLowerCase() === normKode &&
          (!normReg || a.nomorRegister.toLowerCase() === normReg)
      ) ??
      assets.find((a) => a.id.toLowerCase() === normKode) ??
      null
    );
  }, [assets, normKode, normReg]);

  const matchedVehicle = useMemo(() => {
    if (!normKode) return null;
    const direct = vehicles.find(
      (v) =>
        v.kodeBarang.toLowerCase() === normKode &&
        (!normReg || v.nomorRegister.toLowerCase() === normReg)
    );
    if (direct) return direct;
    if (matchedAsset && matchedAsset.nomorPolisiOrSertifikat) {
      return (
        vehicles.find(
          (v) =>
            v.nomorPolisi.toLowerCase() ===
            matchedAsset.nomorPolisiOrSertifikat.toLowerCase()
        ) ?? null
      );
    }
    return vehicles.find((v) => v.id.toLowerCase() === normKode) ?? null;
  }, [vehicles, matchedAsset, normKode, normReg]);

  const normRuang = ruangParam.trim().toLowerCase();
  const isRoomMode = normRuang.length > 0;

  const matchedRoom = useMemo(() => {
    if (!normRuang) return null;
    return (
      rooms.find(
        (r) =>
          r.id.toLowerCase() === normRuang ||
          r.kodeRuang.toLowerCase() === normRuang
      ) ?? null
    );
  }, [rooms, normRuang]);

  const matchedRoomEntries = useMemo(() => {
    if (!matchedRoom) return [];
    return roomItems.filter((item) => item.roomId === matchedRoom.id);
  }, [roomItems, matchedRoom]);

  const roomStats = useMemo(() => {
    return matchedRoomEntries.reduce(
      (acc, item) => {
        acc.totalUnits += item.jumlah;
        if (item.kondisi === 'BAIK') acc.baik += item.jumlah;
        else if (item.kondisi === 'RUSAK_RINGAN') acc.rusakRingan += item.jumlah;
        else acc.rusakBerat += item.jumlah;
        return acc;
      },
      { totalUnits: 0, baik: 0, rusakRingan: 0, rusakBerat: 0 }
    );
  }, [matchedRoomEntries]);

  const isFound = isRoomMode
    ? Boolean(matchedRoom)
    : Boolean(matchedAsset || matchedVehicle);
  const resolvedResourceLocationId = isRoomMode
    ? matchedRoom?.locationId ?? ''
    : matchedVehicle?.locationId ?? matchedAsset?.locationId ?? '';
  const isRestrictedByPos = Boolean(
    session &&
      roleProfile.assignedLocationId &&
      isFound &&
      resolvedResourceLocationId &&
      resolvedResourceLocationId !== roleProfile.assignedLocationId
  );
  const displayKode =
    matchedVehicle?.kodeBarang ?? matchedAsset?.kodeBarang ?? kodeParam;
  const displayRegister =
    matchedVehicle?.nomorRegister ?? matchedAsset?.nomorRegister ?? registerParam;
  const displayName =
    matchedVehicle?.namaKendaraan ?? matchedAsset?.namaBarang ?? 'Aset Tidak Ditemukan';
  const displayAssetNo =
    matchedAsset && matchedVehicle
      ? `${matchedAsset.id} / ${matchedVehicle.id}`
      : matchedAsset?.id ?? matchedVehicle?.id ?? '-';
  const displayMerk =
    matchedVehicle?.merkTipe ?? matchedAsset?.merkTipe ?? '-';
  const displayYear =
    matchedVehicle?.tahunPerolehan ?? matchedAsset?.tahunPerolehan ?? '-';
  const displayCondition =
    matchedVehicle?.kondisi ?? matchedAsset?.kondisi ?? 'BAIK';
  const displayValue =
    matchedVehicle?.nilaiPerolehan ?? matchedAsset?.nilaiPerolehan ?? 0;
  const displayLocationId =
    matchedVehicle?.locationId ?? matchedAsset?.locationId ?? '';
  const displayLocation = locationMap.get(displayLocationId);
  const displayOfficer =
    matchedVehicle?.penanggungJawab ?? matchedAsset?.penanggungJawab ?? '-';
  const displayPhotoUrl =
    matchedVehicle?.fotoDataUrl ?? matchedAsset?.fotoDataUrl ?? undefined;
  const displayPhotoName =
    matchedVehicle?.fotoNamaFile ?? matchedAsset?.fotoNamaFile ?? undefined;

  const qrPayloadString = `SIMAS-BMD|BPBD-SDA|${displayKode}|${displayRegister}`;
  const { fullUrl: fullAssetQrUrl, pathUrl: dynamicAssetRouteUrl } =
    buildAssetDetailUrl(displayKode, displayRegister);
  const { fullUrl: fullRoomQrUrl, pathUrl: dynamicRoomRouteUrl } =
    buildRoomDetailUrl(matchedRoom?.id ?? ruangParam);
  const dynamicRouteUrl = isRoomMode ? dynamicRoomRouteUrl : dynamicAssetRouteUrl;
  const fullShareUrl = isRoomMode ? fullRoomQrUrl : fullAssetQrUrl;

  const handleCopyProfileUrl = async () => {
    const ok = await copyTextToClipboard(fullShareUrl);
    if (ok) {
      setCopiedProfileLink(true);
      window.setTimeout(() => setCopiedProfileLink(false), 2000);
    }
  };

  const relatedMaintenances = useMemo(() => {
    if (!matchedVehicle) return [];
    return vehicleMaintenances
      .filter((m) => m.vehicleId === matchedVehicle.id)
      .sort((a, b) => b.tanggalPerbaikan.localeCompare(a.tanggalPerbaikan));
  }, [vehicleMaintenances, matchedVehicle]);

  const relatedDamages = useMemo(() => {
    if (!matchedAsset) return [];
    return damageReports.filter((d) => d.assetId === matchedAsset.id);
  }, [damageReports, matchedAsset]);

  const relatedMutations = useMemo(() => {
    if (!matchedAsset) return [];
    return mutations.filter((m) => m.assetId === matchedAsset.id);
  }, [mutations, matchedAsset]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Institutional Header */}
      <header className="bg-[#0B192C] text-white border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-full bg-white p-1.5 shrink-0 flex items-center justify-center border border-white/20">
              {!logoFailed ? (
                <img
                  src="/assets/aistudio/logo-bpbd-sidoarjo-removebg-preview_e9477ae6.png"
                  alt="Logo Pemerintah Kabupaten Sidoarjo & BPBD"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoFailed(true)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Shield className="w-6 h-6 text-[#0B192C]" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wider uppercase text-amber-300">
                Pemerintah Kabupaten Sidoarjo
              </p>
              <h1 className="font-display text-base sm:text-lg font-bold text-white truncate">
                {isRoomMode
                  ? 'BPBD Kabupaten Sidoarjo · Kartu Inventaris Ruangan (KIR)'
                  : 'BPBD Kabupaten Sidoarjo · Profil Aset BMD'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs shrink-0">
            {isRestrictedByPos ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                Akses Dibatasi Lokasi Pos
              </span>
            ) : isFound ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-300">
                <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                {isRoomMode
                  ? 'Terverifikasi - Kartu Inventaris Ruangan BMD'
                  : 'Terverifikasi - Barang Milik Daerah'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-semibold text-red-300">
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                {isRoomMode ? 'Ruangan Tidak Ditemukan' : 'Register Tidak Ditemukan'}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Top Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-mono truncate">
            Endpoint: {dynamicRouteUrl}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isFound && !isRestrictedByPos && (
              <button
                type="button"
                onClick={() => void handleCopyProfileUrl()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0B2545] bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer whitespace-nowrap"
              >
                {copiedProfileLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                    Tautan Disalin
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Salin Tautan
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onBackToDashboard}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke Dashboard
            </button>

            {isFound && !isRestrictedByPos && (
              <button
                type="button"
                onClick={() =>
                  onEditDataAction(
                    isRoomMode && matchedRoom
                      ? { type: 'kir', id: matchedRoom.id }
                      : {
                          type: matchedVehicle ? 'vehicle' : 'asset',
                          id: matchedVehicle ? matchedVehicle.id : matchedAsset!.id,
                        }
                  )
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md cursor-pointer whitespace-nowrap"
              >
                {session ? (
                  <>
                    <Edit3 className="w-3.5 h-3.5" />
                    {isRoomMode
                      ? 'Kelola & Cetak KIR Ruangan'
                      : roleProfile.permissions.canEditAsset
                        ? 'Edit Data Aset (Pegawai)'
                        : 'Lihat di Modul Manajemen'}
                  </>
                ) : (
                  <>
                    <LogIn className="w-3.5 h-3.5" />
                    {isRoomMode
                      ? 'Cetak / Kelola KIR (Khusus Login Pegawai)'
                      : 'Edit Data (Khusus Login Pegawai)'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {isRestrictedByPos ? (
          <div className="bg-white border border-amber-200 rounded-lg p-8 text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto" />
            <div className="space-y-1.5">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Akses Inventaris Dibatasi Sesuai Lokasi Pos
              </h2>
              <p className="text-xs text-slate-600 max-w-lg mx-auto leading-relaxed">
                Akun Anda ({roleProfile.officerName}) terdaftar sebagai Admin/Penanggung Jawab{' '}
                <strong>
                  {locationMap.get(roleProfile.assignedLocationId ?? '')?.name ??
                    roleProfile.unitName}
                </strong>
                . Barang atau ruangan ini tercatat di lokasi{' '}
                <strong>
                  {locationMap.get(resolvedResourceLocationId)?.name ??
                    resolvedResourceLocationId}
                </strong>{' '}
                sehingga tidak dapat dibuka menggunakan akun pos Anda.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={onBackToDashboard}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Kembali ke Inventaris Pos Anda
              </button>
            </div>
          </div>
        ) : !isFound ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto" />
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {isRoomMode ? 'Data Ruangan KIR Tidak Ditemukan' : 'Data Aset Tidak Ditemukan'}
              </h2>
              <p className="text-xs text-slate-600 max-w-lg mx-auto">
                {isRoomMode ? (
                  <>
                    Tidak ditemukan ruangan dengan kode{' '}
                    <span className="font-mono font-semibold">{ruangParam || '-'}</span> pada
                    daftar Kartu Inventaris Ruangan (KIR) BPBD Sidoarjo.
                  </>
                ) : (
                  <>
                    Tidak ditemukan barang dengan Kode Barang{' '}
                    <span className="font-mono font-semibold">{kodeParam || '-'}</span> dan
                    Nomor Register{' '}
                    <span className="font-mono font-semibold">{registerParam || '-'}</span>{' '}
                    pada database SIMAS-BMD BPBD Sidoarjo.
                  </>
                )}
              </p>
            </div>
            <div className="pt-2 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => onSelectAlternateAsset('1.3.2.02.01.06.004', '0014')}
                className="px-3.5 py-2 text-xs font-semibold text-[#0B2545] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
              >
                Uji Scan: Hino Damkar Pos Kota (W 9808 NP)
              </button>
              <button
                type="button"
                onClick={() => onSelectAlternateAsset('1.3.2.02.01.06.060', '0002')}
                className="px-3.5 py-2 text-xs font-semibold text-[#0B2545] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
              >
                Uji Scan: Rescue Car Isuzu Pos Krian (W 8023 NP)
              </button>
            </div>
          </div>
        ) : isRoomMode && matchedRoom ? (
          <>
            {/* Room KIR Header Card */}
            <section className="bg-white border border-slate-200 rounded-lg p-6">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="space-y-3 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <Building2 className="w-4 h-4 text-[#0B2545]" aria-hidden="true" />
                    <span className="font-mono font-semibold text-[#0B2545]">
                      {matchedRoom.kodeRuang}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {locationMap.get(matchedRoom.locationId)?.name ?? matchedRoom.locationId}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{matchedRoom.lantaiGedung}</span>
                  </div>

                  <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
                    {matchedRoom.namaRuang}
                  </h2>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-500 block">Penanggung Jawab</span>
                      <span className="font-semibold text-slate-900">
                        {matchedRoom.penanggungJawab}
                      </span>
                      <span className="block text-[11px] font-mono text-slate-500">
                        NIP. {matchedRoom.nipPenanggungJawab}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Total Jenis / Unit</span>
                      <span className="font-mono font-bold text-[#0B2545] tabular-nums">
                        {matchedRoomEntries.length} Jenis / {roomStats.totalUnits} Unit
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Kondisi Baik</span>
                      <span className="font-mono font-bold text-emerald-700 tabular-nums">
                        {roomStats.baik} Unit
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Rusak Ringan / Berat</span>
                      <span className="font-mono font-bold text-amber-700 tabular-nums">
                        {roomStats.rusakRingan} RR ·{' '}
                        <span className="text-red-700">{roomStats.rusakBerat} RB</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex flex-row md:flex-col items-center gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-md">
                  <QrCodeImage value={fullRoomQrUrl} size={96} />
                  <div className="text-left md:text-center space-y-0.5">
                    <p className="text-[11px] font-semibold text-[#0B2545] flex items-center md:justify-center gap-1">
                      <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
                      QR Kartu Ruangan
                    </p>
                    <p className="font-mono text-[10px] text-slate-500 break-all max-w-[170px]">
                      {fullRoomQrUrl}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Room KIR Items Table */}
            <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    Daftar Barang Inventaris Ruangan (Permendagri 108/2016)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Barang Milik Daerah yang tercatat menempel dan berada di {matchedRoom.namaRuang}
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold text-[#0B2545] tabular-nums">
                  {matchedRoomEntries.length} Item Terdaftar
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      <th className="py-3 px-4 w-10 text-center">No</th>
                      <th className="py-3 px-3 text-center w-14">Foto</th>
                      <th className="py-3 px-4">Nama Barang / Jenis</th>
                      <th className="py-3 px-4">Merk / Model</th>
                      <th className="py-3 px-4 text-center">Tahun</th>
                      <th className="py-3 px-4">Kode Barang &amp; No. Reg</th>
                      <th className="py-3 px-4 text-right">Jumlah</th>
                      <th className="py-3 px-4">Kondisi</th>
                      <th className="py-3 px-4">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {matchedRoomEntries.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500">
                          Belum ada barang inventaris tercatat pada ruangan ini.
                        </td>
                      </tr>
                    ) : (
                      matchedRoomEntries.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 text-center font-mono tabular-nums text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex justify-center">
                              <ItemPhotoThumbnail
                                fotoDataUrl={item.fotoDataUrl}
                                alt={item.namaBarang}
                                onClick={() =>
                                  item.fotoDataUrl &&
                                  setLightboxPhoto({
                                    title: item.namaBarang,
                                    subtitle: `${matchedRoom.namaRuang} · ${item.kodeBarang}`,
                                    dataUrl: item.fotoDataUrl,
                                    fileName: item.fotoNamaFile,
                                  })
                                }
                              />
                            </div>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {item.namaBarang}
                          </td>
                          <td className="py-3 px-4 text-slate-700">{item.merkModel}</td>
                          <td className="py-3 px-4 text-center font-mono tabular-nums text-slate-700">
                            {item.tahunPerolehan}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-700 tabular-nums">
                            {item.kodeBarang} · Reg. {item.nomorRegister}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                            {item.jumlah} {item.satuan}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <ConditionIndicator condition={item.kondisi} />
                          </td>
                          <td className="py-3 px-4 text-slate-600">{item.keterangan || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <>
            {/* Card 1: Informasi Utama Aset */}
            <section className="bg-white border border-slate-200 rounded-lg p-6">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="space-y-3 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="font-mono font-semibold text-[#0B2545]">
                      {displayAssetNo}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {matchedAsset
                        ? KIB_META[matchedAsset.kibType].fullName
                        : 'Inventaris Kendaraan Dinas'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Tahun {displayYear}</span>
                  </div>

                  <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
                    {displayName}
                  </h2>
                  <p className="text-sm text-slate-600">{displayMerk}</p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-500 block">Kode Barang</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {displayKode}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Nomor Register</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {displayRegister}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Kondisi Fisik</span>
                      <div className="mt-0.5">
                        <ConditionIndicator condition={displayCondition} />
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Nilai Perolehan</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {formatIDR(displayValue)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Embedded Photo + QR Verification Block */}
                <div className="shrink-0 flex flex-wrap items-stretch gap-3">
                  {displayPhotoUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxPhoto({
                          title: displayName,
                          subtitle: `${displayAssetNo} · ${displayKode}`,
                          dataUrl: displayPhotoUrl,
                          fileName: displayPhotoName,
                        })
                      }
                      className="flex flex-col items-center justify-center p-2 bg-slate-50 border border-slate-200 hover:border-[#0B2545] rounded-md cursor-pointer"
                      title="Klik untuk memperbesar foto barang"
                    >
                      <img
                        src={displayPhotoUrl}
                        alt={displayName}
                        className="w-28 h-24 object-cover rounded border border-slate-200 bg-white"
                      />
                      <span className="text-[10px] font-semibold text-[#0B2545] mt-1.5">
                        Foto Fisik Barang
                      </span>
                    </button>
                  )}

                  <div className="flex flex-row md:flex-col items-center gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-md">
                    <QrCodeImage value={fullAssetQrUrl} size={96} />
                    <div className="text-left md:text-center space-y-0.5">
                      <p className="text-[11px] font-semibold text-[#0B2545] flex items-center md:justify-center gap-1">
                        <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
                        Tautan QR Terverifikasi
                      </p>
                      <p className="font-mono text-[10px] text-slate-500 break-all max-w-[170px]">
                        {fullAssetQrUrl}
                      </p>
                      <p className="font-mono text-[9px] text-slate-400 break-all max-w-[170px]">
                        {qrPayloadString}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Card 2: Detail Spesifik & Legalitas (Kendaraan R4/R2 atau Aset KIB) */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left Column: Legalitas Kendaraan / Spesifikasi Aset */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                <h3 className="font-display text-sm font-bold text-[#0B2545] flex items-center gap-2 border-b border-slate-200 pb-2.5">
                  {matchedVehicle ? (
                    matchedVehicle.kategori === 'RODA_4' ? (
                      <Car className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Bike className="w-4 h-4" aria-hidden="true" />
                    )
                  ) : (
                    <FileText className="w-4 h-4" aria-hidden="true" />
                  )}
                  {matchedVehicle
                    ? `Identifikasi Fisik & Legalitas (${
                        matchedVehicle.kategori === 'RODA_4' ? 'Roda 4' : 'Roda 2'
                      })`
                    : 'Spesifikasi & Dokumen Kepemilikan'}
                </h3>

                {matchedVehicle ? (
                  <dl className="space-y-2.5 text-xs">
                    <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                      <dt className="text-slate-500">Nomor Polisi (Plat)</dt>
                      <dd className="font-mono font-bold text-slate-900 text-sm">
                        {matchedVehicle.nomorPolisi}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                      <dt className="text-slate-500">Nomor Rangka (VIN)</dt>
                      <dd className="font-mono font-medium text-slate-900">
                        {matchedVehicle.nomorRangka}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                      <dt className="text-slate-500">Nomor Mesin</dt>
                      <dd className="font-mono font-medium text-slate-900">
                        {matchedVehicle.nomorMesin}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                      <dt className="text-slate-500">Status &amp; Masa Pajak Berakhir</dt>
                      <dd className="text-right">
                        <span
                          className={`font-semibold ${
                            matchedVehicle.statusPajak === 'LUNAS_AKTIF'
                              ? 'text-emerald-700'
                              : 'text-red-700'
                          }`}
                        >
                          {matchedVehicle.statusPajak === 'LUNAS_AKTIF'
                            ? 'Lunas / Aktif'
                            : 'Belum Bayar'}
                        </span>
                        <span className="block font-mono text-[11px] text-slate-800 tabular-nums">
                          Berakhir: {formatDateID(matchedVehicle.pajakBerlakuSampai)}
                        </span>
                        <span
                          className={`block text-[11px] font-semibold tabular-nums ${
                            getTaxExpiryInfo(matchedVehicle.pajakBerlakuSampai).textClass
                          }`}
                        >
                          {getTaxExpiryInfo(matchedVehicle.pajakBerlakuSampai).shortText}
                        </span>
                        {matchedVehicle.stnkBerlakuSampai && (
                          <span className="block font-mono text-[10px] text-slate-500 tabular-nums">
                            STNK 5 Thn: {formatDateID(matchedVehicle.stnkBerlakuSampai)}
                          </span>
                        )}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Keterangan BPKB</dt>
                      <dd className="text-right">
                        <span
                          className={`font-semibold ${
                            matchedVehicle.statusBpkb === 'SUDAH_KELUAR'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {matchedVehicle.statusBpkb === 'SUDAH_KELUAR'
                            ? 'BPKB Sudah Keluar'
                            : 'BPKB Belum Keluar / Masih Proses'}
                        </span>
                        {matchedVehicle.nomorBpkb && (
                          <span className="block font-mono text-[11px] text-slate-500">
                            No. {matchedVehicle.nomorBpkb}
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  matchedAsset && (
                    <dl className="space-y-2.5 text-xs">
                      <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                        <dt className="text-slate-500">No. Sertifikat / Serial</dt>
                        <dd className="font-mono font-semibold text-slate-900">
                          {matchedAsset.nomorPolisiOrSertifikat}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                        <dt className="text-slate-500">Jumlah &amp; Satuan</dt>
                        <dd className="font-semibold text-slate-900 tabular-nums">
                          {matchedAsset.jumlahUnit} {matchedAsset.satuan}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                        <dt className="text-slate-500">Status Opname Terakhir</dt>
                        <dd className="font-semibold text-slate-900">
                          {OPNAME_STATUS_META[matchedAsset.lastOpnameStatus].label} (
                          {formatDateID(matchedAsset.lastOpnameDate)})
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500 mb-1">Spesifikasi Teknis</dt>
                        <dd className="text-slate-800 leading-relaxed">
                          {matchedAsset.spesifikasi}
                        </dd>
                      </div>
                    </dl>
                  )
                )}
              </div>

              {/* Right Column: Penempatan, Penanggung Jawab & Sumber Perolehan / Hibah */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                <h3 className="font-display text-sm font-bold text-[#0B2545] flex items-center gap-2 border-b border-slate-200 pb-2.5">
                  <MapPin className="w-4 h-4" aria-hidden="true" />
                  Pos Penempatan, Pemegang &amp; Sumber Perolehan
                </h3>

                <dl className="space-y-3 text-xs">
                  <div className="border-b border-slate-100 pb-2.5">
                    <dt className="text-slate-500">Pos Penempatan Operasional</dt>
                    <dd className="font-semibold text-slate-900 mt-0.5">
                      {displayLocation?.name ?? displayLocationId}
                    </dd>
                    {displayLocation && (
                      <dd className="text-[11px] text-slate-500 mt-0.5">
                        {displayLocation.address}
                      </dd>
                    )}
                  </div>

                  <div className="border-b border-slate-100 pb-2.5">
                    <dt className="text-slate-500 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-[#0B2545]" aria-hidden="true" />
                      Penanggung Jawab / Pemegang Langsung
                    </dt>
                    <dd className="font-semibold text-slate-900 mt-0.5">
                      {displayOfficer}
                    </dd>
                    {matchedVehicle?.jabatanPemegang && (
                      <dd className="text-[11px] text-slate-500">
                        {matchedVehicle.jabatanPemegang}
                      </dd>
                    )}
                  </div>

                  <div>
                    <dt className="text-slate-500 flex items-center gap-1">
                      <FileCheck2 className="w-3.5 h-3.5 text-[#0B2545]" aria-hidden="true" />
                      Sumber Perolehan &amp; Dokumen Hibah
                    </dt>
                    <dd className="font-semibold text-[#0B2545] mt-0.5">
                      {matchedVehicle?.sumberPerolehan ?? matchedAsset?.asalPerolehan}
                    </dd>

                    {matchedVehicle &&
                      (matchedVehicle.hibahInstansiPemberi ||
                        matchedVehicle.hibahNomorBast) && (
                        <div className="mt-2 p-3 rounded bg-slate-50 border border-slate-200 space-y-1">
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-500">Asal Instansi</span>
                            <span className="font-medium text-slate-900 text-right">
                              {matchedVehicle.hibahInstansiPemberi}
                            </span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-500">No. Dokumen / BAST</span>
                            <span className="font-mono font-medium text-slate-900 text-right">
                              {matchedVehicle.hibahNomorBast || '-'}
                            </span>
                          </div>
                          {matchedVehicle.hibahTanggal && (
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-500">Tanggal BAST</span>
                              <span className="font-mono text-slate-700 tabular-nums">
                                {formatDateID(matchedVehicle.hibahTanggal)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                </dl>
              </div>
            </section>

            {/* Card 3: Modul Riwayat Pemeliharaan/Perbaikan & Bukti Nota/Kuitansi */}
            <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-[#0B2545]" aria-hidden="true" />
                    {matchedVehicle
                      ? 'Riwayat Pemeliharaan, Perbaikan & Bukti Nota/Kuitansi'
                      : 'Riwayat Perbaikan & Mutasi Lokasi Aset'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Rekam jejak pemeliharaan fisik dan dokumentasi bukti pertanggungjawaban resmi
                  </p>
                </div>
                {matchedVehicle && (
                  <span className="font-mono text-xs font-semibold text-[#0B2545] tabular-nums">
                    Total Biaya Servis:{' '}
                    {formatIDR(
                      relatedMaintenances.reduce((sum, m) => sum + m.biaya, 0)
                    )}
                  </span>
                )}
              </div>

              {matchedVehicle ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                        <th className="py-3 px-4">Tanggal</th>
                        <th className="py-3 px-4">Jenis Penanganan</th>
                        <th className="py-3 px-4">Kerusakan &amp; Tindakan</th>
                        <th className="py-3 px-4">Bengkel Pelaksana</th>
                        <th className="py-3 px-4 text-right">Biaya</th>
                        <th className="py-3 px-4 text-right">Bukti Nota/Foto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {relatedMaintenances.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            Belum ada riwayat pemeliharaan atau perbaikan tercatat untuk unit ini.
                          </td>
                        </tr>
                      ) : (
                        relatedMaintenances.map((m) => {
                          const meta = MAINTENANCE_LABEL[m.jenisPenanganan];
                          return (
                            <tr key={m.id} className="hover:bg-slate-50/70">
                              <td className="py-3 px-4 font-mono text-[11px] text-slate-700 whitespace-nowrap tabular-nums align-top">
                                {formatDateID(m.tanggalPerbaikan)}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap align-top">
                                <span className={`font-semibold ${meta.textClass}`}>
                                  {meta.label}
                                </span>
                              </td>
                              <td className="py-3 px-4 align-top max-w-sm">
                                <div className="font-semibold text-slate-900">
                                  {m.deskripsiKerusakan}
                                </div>
                                <div className="text-slate-600 mt-0.5">
                                  Tindakan: {m.tindakanPerbaikan}
                                </div>
                              </td>
                              <td className="py-3 px-4 align-top text-slate-700">
                                {m.bengkelPelaksana}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 whitespace-nowrap tabular-nums align-top">
                                {formatIDR(m.biaya)}
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap align-top">
                                {m.buktiDataUrl ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setProofPreview({
                                        fileName: m.buktiNamaFile || 'Bukti-Servis',
                                        mimeType: m.buktiMimeType || 'image/svg+xml',
                                        dataUrl: m.buktiDataUrl || '',
                                        caption: `${matchedVehicle.nomorPolisi} · ${formatDateID(
                                          m.tanggalPerbaikan
                                        )} · ${formatIDR(m.biaya)}`,
                                      })
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#0B2545] border border-slate-300 hover:bg-slate-100 rounded cursor-pointer"
                                  >
                                    <Paperclip className="w-3 h-3" />
                                    Lihat Bukti
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-slate-400">
                                    Tidak Ada
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                  <div>
                    <p className="font-semibold text-slate-800 mb-2">
                      Riwayat Laporan Kerusakan ({relatedDamages.length})
                    </p>
                    {relatedDamages.length === 0 ? (
                      <p className="text-slate-500">
                        Tidak ada laporan kerusakan tercatat untuk aset ini.
                      </p>
                    ) : (
                      <ul className="space-y-2.5">
                        {relatedDamages.map((d) => (
                          <li
                            key={d.id}
                            className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-semibold text-slate-900">
                                {d.ticketNumber}
                              </span>
                              <span className={DAMAGE_STATUS_META[d.status].textClass}>
                                {DAMAGE_STATUS_META[d.status].label}
                              </span>
                            </div>
                            <p className="text-slate-700">{d.chronology}</p>
                            <p className="text-[11px] text-slate-500">
                              {formatDateID(d.reportDate)} · Pelapor: {d.reportedBy}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="font-semibold text-slate-800 mb-2">
                      Riwayat Mutasi Lokasi ({relatedMutations.length})
                    </p>
                    {relatedMutations.length === 0 ? (
                      <p className="text-slate-500">
                        Aset belum pernah dimutasi dari lokasi awal.
                      </p>
                    ) : (
                      <ul className="space-y-2.5">
                        {relatedMutations.map((m) => (
                          <li
                            key={m.id}
                            className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1"
                          >
                            <div className="font-semibold text-slate-900">
                              {locationMap.get(m.fromLocationId)?.name ?? m.fromLocationId}{' '}
                              → {locationMap.get(m.toLocationId)?.name ?? m.toLocationId}
                            </div>
                            <p className="text-slate-600">{m.reason}</p>
                            <p className="text-[11px] font-mono text-slate-500">
                              {formatDateID(m.requestDate)} · {m.nomorSurat}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 sm:px-6 py-4 text-xs text-slate-500 text-center">
        © 2026 Badan Penanggulangan Bencana Daerah Kabupaten Sidoarjo · Verifikasi Aset Publik SIMAS-BMD
      </footer>

      {/* Proof Preview Modal */}
      {proofPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <div className="min-w-0">
                <p className="font-display text-sm font-bold text-slate-900 flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-[#0B2545] shrink-0" />
                  <span className="truncate">{proofPreview.fileName}</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                  {proofPreview.caption}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProofPreview(null)}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 cursor-pointer shrink-0"
                aria-label="Tutup pratinjau bukti"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 bg-slate-100 flex items-center justify-center max-h-[70vh] overflow-auto">
              {proofPreview.mimeType.includes('pdf') ? (
                <iframe
                  title={proofPreview.fileName}
                  src={proofPreview.dataUrl}
                  className="w-full h-[55vh] bg-white rounded border border-slate-300"
                />
              ) : (
                <img
                  src={proofPreview.dataUrl}
                  alt={proofPreview.fileName}
                  className="max-w-full max-h-[60vh] object-contain rounded border border-slate-300 bg-white"
                />
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between bg-white text-xs">
              <a
                href={proofPreview.dataUrl}
                download={proofPreview.fileName}
                className="inline-flex items-center gap-1.5 font-semibold text-[#0B2545] hover:underline"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh Berkas Bukti
              </a>
              <button
                type="button"
                onClick={() => setProofPreview(null)}
                className="px-4 py-1.5 font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
      <PhotoLightboxModal
        photo={lightboxPhoto}
        onClose={() => setLightboxPhoto(null)}
      />
    </div>
  );
};
