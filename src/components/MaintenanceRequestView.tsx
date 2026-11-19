import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileCode2,
  FileText,
  Loader2,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import {
  AssetItem,
  ConditionStatus,
  LocationUnit,
  MaintenanceDamageDetailItem,
  MaintenanceRequest,
  MaintenanceRequestCategory,
  MaintenanceRequestStatus,
  ManagedUserAccount,
  NotaDinasFormat,
  RoleProfile,
  VehicleItem,
} from '../types/simas';
import { formatDateID, formatIDR } from '../utils/formatters';
import {
  downloadNotaDinasDocx,
  downloadNotaDinasHtml,
  formatTanggalBiasa,
  formatTanggalTerbilang,
} from '../utils/notaDinasWordHelper';
import { resolvePosAdminForLocation } from '../utils/posAdminHelper';
import {
  ItemPhotoControl,
  ItemPhotoThumbnail,
  PhotoLightboxData,
  PhotoLightboxModal,
} from './ItemPhotoControl';
import { QrCodeImage } from './QrCodeCanvas';

interface MaintenanceRequestViewProps {
  requests: MaintenanceRequest[];
  assets: AssetItem[];
  vehicles: VehicleItem[];
  locations: LocationUnit[];
  roleProfile: RoleProfile;
  posAdmins?: ManagedUserAccount[];
  preselectedAssetId?: string;
  onCreateRequest: (
    payload: Omit<MaintenanceRequest, 'id' | 'status' | 'tanggalPengajuan'>
  ) => void;
  onVerifyRequest: (payload: {
    requestId: string;
    approved: boolean;
    nomorNotaDinas: string;
    kepadaYthUmpeg: string;
    tembusanUmpeg: string;
    approvedBudgetEstimate?: number;
    bengkelRujukan?: string;
    verificationNote: string;
  }) => void;
  onCancelVerifyRequest: (requestId: string) => void;
  onCompleteRequest: (requestId: string, restoreAssetCondition: boolean) => void;
}

const STATUS_META: Record<
  MaintenanceRequestStatus,
  { label: string; textClass: string; badgeClass: string }
> = {
  MENUNGGU_VERIFIKASI_KASUBAG: {
    label: 'Menunggu Verifikasi Kasubag Umpeg',
    textClass: 'text-amber-700',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  DISETUJUI_KASUBAG: {
    label: 'Disetujui Kasubag Umpeg',
    textClass: 'text-emerald-700',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  SELESAI_PERBAIKAN: {
    label: 'Selesai Diperbaiki',
    textClass: 'text-[#0B2545]',
    badgeClass: 'bg-slate-100 text-[#0B2545] border-slate-300',
  },
  DITOLAK: {
    label: 'Ditolak / Perlu Revisi',
    textClass: 'text-red-700',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
  },
};

const PRINT_NOTA_CSS = `
  @page { size: A4 portrait; margin: 14mm 16mm; }
  .nota-print-sheet {
    font-family: Arial, Helvetica, sans-serif;
    color: #000000;
    font-size: 10.5pt;
    line-height: 1.45;
  }
`;

export const MaintenanceRequestView: React.FC<MaintenanceRequestViewProps> = ({
  requests,
  assets,
  vehicles,
  locations,
  roleProfile,
  posAdmins = [],
  preselectedAssetId = '',
  onCreateRequest,
  onVerifyRequest,
  onCancelVerifyRequest,
  onCompleteRequest,
}) => {
  const lockedLocationId = roleProfile.assignedLocationId || '';
  const locationMap = useMemo(
    () => new Map(locations.map((l) => [l.id, l])),
    [locations]
  );

  const isSuperAdmin = roleProfile.id === 'SUPER_ADMIN';

  const canCreate =
    roleProfile.permissions.canReportDamage ||
    roleProfile.permissions.canCreateAsset ||
    roleProfile.permissions.canRequestMutation;

  const canVerifyKasubag = isSuperAdmin;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [locFilter, setLocFilter] = useState<string>(lockedLocationId || 'ALL');
  const effectiveLocFilter = lockedLocationId || locFilter;

  const [createOpen, setCreateOpen] = useState<boolean>(Boolean(preselectedAssetId));
  const [sourceMode, setSourceMode] = useState<'VEHICLE' | 'ASSET' | 'MANUAL'>(
    preselectedAssetId ? 'ASSET' : 'VEHICLE'
  );
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    vehicles[0]?.id ?? ''
  );
  const [selectedAssetId, setSelectedAssetId] = useState<string>(
    preselectedAssetId || assets[0]?.id || ''
  );

  const [formState, setFormState] = useState({
    nomorNotaDinas: `000/${2462 + requests.length}/438.6.6/2026`,
    kategori: 'KENDARAAN' as MaintenanceRequestCategory,
    reportedCondition: 'RUSAK_RINGAN' as Exclude<ConditionStatus, 'BAIK'>,
    locationId: lockedLocationId || locations[0]?.id || 'LOC-MAKO',
    unitPelaporLabel:
      locationMap.get(lockedLocationId || locations[0]?.id || 'LOC-MAKO')?.name ??
      roleProfile.unitName,
    namaBarang: '',
    jenisPeralatan: '',
    merkTipe: '',
    tahunPembuatanAtauCc: '',
    nomorPolisiOrIdentitas: '',
    nomorRangka: '',
    nomorMesin: '',
    namaPemilikPemegang: 'BPBD Sidoarjo',
    perihal: '',
    kronologiSingkat: '',
    kepadaYthUmpeg: 'Sdr. Plt. Sekretaris Badan Penanggulangan Bencana Daerah',
    tembusanUmpeg: 'Pejabat Pembuat Komitmen Sekretariat',
    kepadaUnitPos: 'Kepala Pelaksana BPBD Kab. Sidoarjo',
    requestedByPangkatGol: 'Penata Muda / III/a',
    fotoKerusakanDataUrl: undefined as string | undefined,
    fotoKerusakanNamaFile: undefined as string | undefined,
  });
  const [posAdminTtdConfirmed, setPosAdminTtdConfirmed] = useState<boolean>(true);

  const resolvedPosAdmin = useMemo(() => {
    const targetLoc = lockedLocationId || formState.locationId;
    return (
      resolvePosAdminForLocation(targetLoc, posAdmins, locations, roleProfile) ?? {
        name: roleProfile.officerName,
        nip: roleProfile.nip || '-',
        jabatan: roleProfile.jabatan || 'Penanggung Jawab Admin Pos',
      }
    );
  }, [lockedLocationId, formState.locationId, posAdmins, locations, roleProfile]);

  const [damageLines, setDamageLines] = useState<MaintenanceDamageDetailItem[]>([
    { id: 'ROW-1', jenisKerusakan: '', keterangan: 'Rusak / Perlu Perbaikan' },
  ]);

  const [verifyingRequest, setVerifyingRequest] =
    useState<MaintenanceRequest | null>(null);
  const [verifyForm, setVerifyForm] = useState({
    nomorNotaDinas: '',
    kepadaYthUmpeg: '',
    tembusanUmpeg: '',
    approvedBudgetEstimate: '',
    bengkelRujukan: '',
    verificationNote: '',
  });

  const [previewRequestId, setPreviewRequestId] = useState<string | null>(null);
  const [previewFormat, setPreviewFormat] = useState<NotaDinasFormat>(
    'FORMAT_KASUBAG_UMPEG'
  );
  const [downloadingWord, setDownloadingWord] = useState(false);
  const [actionNotice, setActionNotice] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoLightboxData | null>(null);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);

  const previewRequest = useMemo(
    () => requests.find((r) => r.id === previewRequestId) ?? null,
    [requests, previewRequestId]
  );

  useEffect(() => {
    let host = document.getElementById('simas-nota-print-portal');
    if (!host) {
      host = document.createElement('div');
      host.id = 'simas-nota-print-portal';
      document.body.appendChild(host);
    }
    setPortalHost(host);
  }, []);

  const populateFromVehicle = (vehId: string) => {
    const v = vehicles.find((item) => item.id === vehId);
    if (!v) return;
    const loc = locationMap.get(v.locationId);
    setFormState((prev) => ({
      ...prev,
      kategori: 'KENDARAAN',
      reportedCondition: v.kondisi === 'RUSAK_BERAT' ? 'RUSAK_BERAT' : 'RUSAK_RINGAN',
      locationId: lockedLocationId || v.locationId,
      unitPelaporLabel: loc?.name ?? prev.unitPelaporLabel,
      namaBarang: `${v.namaKendaraan} (${v.nomorPolisi})`,
      jenisPeralatan: v.kategori === 'RODA_4' ? 'Mobil / Roda 4' : 'Sepeda Motor / Roda 2',
      merkTipe: v.merkTipe,
      tahunPembuatanAtauCc: String(v.tahunPerolehan),
      nomorPolisiOrIdentitas: v.nomorPolisi,
      nomorRangka: v.nomorRangka,
      nomorMesin: v.nomorMesin,
      namaPemilikPemegang: `BPBD Sidoarjo / ${loc?.name ?? v.penanggungJawab}`,
      perihal: `Permohonan Perbaikan Kendaraan ${v.nomorPolisi}`,
      kronologiSingkat:
        v.kondisi === 'BAIK'
          ? `Unit ${v.namaKendaraan} (${v.nomorPolisi}) membutuhkan perawatan berkala / perbaikan komponen operasional.`
          : `Unit ${v.namaKendaraan} (${v.nomorPolisi}) berstatus ${v.kondisi.replace('_', ' ')} dan memerlukan perbaikan segera.`,
    }));
  };

  const populateFromAsset = (astId: string) => {
    const a = assets.find((item) => item.id === astId);
    if (!a) return;
    const loc = locationMap.get(a.locationId);
    setFormState((prev) => ({
      ...prev,
      kategori: 'PERALATAN_BARANG',
      reportedCondition: a.kondisi === 'RUSAK_BERAT' ? 'RUSAK_BERAT' : 'RUSAK_RINGAN',
      locationId: lockedLocationId || a.locationId,
      unitPelaporLabel: loc?.name ?? prev.unitPelaporLabel,
      namaBarang: a.namaBarang,
      jenisPeralatan: a.namaBarang,
      merkTipe: a.merkTipe,
      tahunPembuatanAtauCc: String(a.tahunPerolehan),
      nomorPolisiOrIdentitas: `${a.kodeBarang} · Reg. ${a.nomorRegister}`,
      nomorRangka: '',
      nomorMesin: '',
      namaPemilikPemegang: `BPBD Sidoarjo / ${loc?.name ?? a.penanggungJawab}`,
      perihal: `Permohonan Perbaikan/Pemeliharaan ${a.namaBarang}`,
      kronologiSingkat:
        a.keterangan ||
        `Barang ${a.namaBarang} (${a.id}) mengalami kendala operasional dan membutuhkan pemeliharaan/perbaikan.`,
    }));
  };

  useEffect(() => {
    if (preselectedAssetId) {
      setSourceMode('ASSET');
      setSelectedAssetId(preselectedAssetId);
      populateFromAsset(preselectedAssetId);
      setCreateOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedAssetId]);

  const openNewRequestModal = () => {
    const nextNum = `000/${2462 + requests.length}/438.6.6/2026`;
    setFormState((prev) => ({
      ...prev,
      nomorNotaDinas: nextNum,
      fotoKerusakanDataUrl: undefined,
      fotoKerusakanNamaFile: undefined,
    }));
    setDamageLines([
      { id: `ROW-${Date.now()}`, jenisKerusakan: '', keterangan: 'Rusak' },
    ]);
    const damagedVeh = vehicles.find((v) => v.kondisi !== 'BAIK') ?? vehicles[0];
    const damagedAst = assets.find((a) => a.kondisi !== 'BAIK') ?? assets[0];
    if (damagedVeh) {
      setSourceMode('VEHICLE');
      setSelectedVehicleId(damagedVeh.id);
      populateFromVehicle(damagedVeh.id);
    } else if (damagedAst) {
      setSourceMode('ASSET');
      setSelectedAssetId(damagedAst.id);
      populateFromAsset(damagedAst.id);
    } else {
      setSourceMode('MANUAL');
    }
    setCreateOpen(true);
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.namaBarang.trim() || !formState.perihal.trim()) return;
    if (!posAdminTtdConfirmed || !resolvedPosAdmin.name.trim()) return;
    const validLines = damageLines
      .filter((d) => d.jenisKerusakan.trim())
      .map((d) => ({
        ...d,
        jenisKerusakan: d.jenisKerusakan.trim(),
        keterangan: d.keterangan.trim() || 'Rusak',
      }));
    const finalLines: MaintenanceDamageDetailItem[] =
      validLines.length > 0
        ? validLines
        : [
            {
              id: `ROW-${Date.now()}`,
              jenisKerusakan: formState.kronologiSingkat || formState.perihal,
              keterangan: 'Membutuhkan Perbaikan',
            },
          ];

    const effectiveLoc = lockedLocationId || formState.locationId;
    const locObj = locationMap.get(effectiveLoc);
    const today = new Date().toISOString().slice(0, 10);

    onCreateRequest({
      nomorNotaDinas: formState.nomorNotaDinas.trim(),
      kategori: formState.kategori,
      reportedCondition: formState.reportedCondition,
      locationId: effectiveLoc,
      unitPelaporLabel: formState.unitPelaporLabel.trim() || locObj?.name || roleProfile.unitName,
      vehicleId: sourceMode === 'VEHICLE' ? selectedVehicleId || undefined : undefined,
      assetId: sourceMode === 'ASSET' ? selectedAssetId || undefined : undefined,
      namaBarang: formState.namaBarang.trim(),
      jenisPeralatan: formState.jenisPeralatan.trim() || formState.namaBarang.trim(),
      merkTipe: formState.merkTipe.trim() || '-',
      tahunPembuatanAtauCc: formState.tahunPembuatanAtauCc.trim() || '-',
      nomorPolisiOrIdentitas: formState.nomorPolisiOrIdentitas.trim() || '-',
      nomorRangka: formState.nomorRangka.trim() || undefined,
      nomorMesin: formState.nomorMesin.trim() || undefined,
      namaPemilikPemegang: formState.namaPemilikPemegang.trim() || 'BPBD Sidoarjo',
      kronologiSingkat: formState.kronologiSingkat.trim() || formState.perihal.trim(),
      rincianKerusakan: finalLines,
      fotoKerusakanDataUrl: formState.fotoKerusakanDataUrl,
      fotoKerusakanNamaFile: formState.fotoKerusakanNamaFile,
      requestedBy: resolvedPosAdmin.name,
      requestedByNip: resolvedPosAdmin.nip || '-',
      requestedByJabatan: resolvedPosAdmin.jabatan || 'Penanggung Jawab Admin Pos',
      requestedByPangkatGol: formState.requestedByPangkatGol.trim() || '-',
      requestedByRole: roleProfile.id,
      posAdminName: resolvedPosAdmin.name,
      posAdminNip: resolvedPosAdmin.nip || '-',
      posAdminJabatan: resolvedPosAdmin.jabatan || 'Penanggung Jawab Admin Pos',
      posAdminSignedAt: today,
      kepadaYthUmpeg: formState.kepadaYthUmpeg.trim(),
      tembusanUmpeg: formState.tembusanUmpeg.trim(),
      kepadaUnitPos: formState.kepadaUnitPos.trim(),
      mengetahuiUnitPosNama: 'Ahmad Thohir, A. Md.',
      mengetahuiUnitPosJabatan: 'Kepala Sub Bagian Umum dan Kepegawaian',
      mengetahuiUnitPosPangkat: 'Penata / III/c',
      mengetahuiUnitPosNip: '19870616 201001 1 008',
      perihal: formState.perihal.trim(),
    });
    setCreateOpen(false);
  };

  const openVerifyModal = (req: MaintenanceRequest) => {
    setVerifyingRequest(req);
    setVerifyForm({
      nomorNotaDinas: req.nomorNotaDinas,
      kepadaYthUmpeg:
        req.kepadaYthUmpeg || 'Sdr. Plt. Sekretaris Badan Penanggulangan Bencana Daerah',
      tembusanUmpeg: req.tembusanUmpeg || 'Pejabat Pembuat Komitmen Sekretariat',
      approvedBudgetEstimate: req.approvedBudgetEstimate
        ? String(req.approvedBudgetEstimate)
        : '',
      bengkelRujukan: req.bengkelRujukan || '',
      verificationNote:
        req.verificationNote ||
        'Diverifikasi Kasubag Umum & Kepegawaian. Layak diajukan pemeliharaan/perbaikan sesuai ketentuan BMD.',
    });
  };

  const handleQuickApprove = (req: MaintenanceRequest) => {
    onVerifyRequest({
      requestId: req.id,
      approved: true,
      nomorNotaDinas: req.nomorNotaDinas,
      kepadaYthUmpeg:
        req.kepadaYthUmpeg || 'Sdr. Plt. Sekretaris Badan Penanggulangan Bencana Daerah',
      tembusanUmpeg: req.tembusanUmpeg || 'Pejabat Pembuat Komitmen Sekretariat',
      approvedBudgetEstimate: req.approvedBudgetEstimate,
      bengkelRujukan: req.bengkelRujukan,
      verificationNote:
        req.verificationNote ||
        'Disetujui Kasubag Umum & Kepegawaian. Layak diajukan pemeliharaan/perbaikan sesuai ketentuan BMD.',
    });
  };

  const handleOpenNotaPreview = (
    req: MaintenanceRequest,
    defaultFmt?: NotaDinasFormat
  ) => {
    if (!isSuperAdmin) return;
    setActionNotice(null);
    setPreviewRequestId(req.id);
    setPreviewFormat(
      defaultFmt ??
        (req.status === 'DISETUJUI_KASUBAG' || req.status === 'SELESAI_PERBAIKAN'
          ? 'FORMAT_KASUBAG_UMPEG'
          : 'FORMAT_UNIT_POS')
    );
  };

  const handleDownloadWord = async (
    req: MaintenanceRequest,
    format: NotaDinasFormat
  ) => {
    if (!isSuperAdmin) return;
    setDownloadingWord(true);
    setActionNotice(null);
    try {
      const locName = locationMap.get(req.locationId)?.name ?? req.unitPelaporLabel;
      await downloadNotaDinasDocx(req, locName, format);
      setActionNotice({
        type: 'success',
        message: `Draft Word (.docx) Nota Dinas ${req.nomorNotaDinas} berhasil diunduh.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat file Word (.docx).';
      setActionNotice({
        type: 'error',
        message: `Gagal mengunduh Draft Word: ${msg}`,
      });
    } finally {
      setDownloadingWord(false);
    }
  };

  const handleDownloadHtmlPrint = async (
    req: MaintenanceRequest,
    format: NotaDinasFormat
  ) => {
    setDownloadingWord(true);
    setActionNotice(null);
    try {
      const locName = locationMap.get(req.locationId)?.name ?? req.unitPelaporLabel;
      await downloadNotaDinasHtml(req, locName, format);
      setActionNotice({
        type: 'success',
        message: `File cetak HTML Nota Dinas ${req.nomorNotaDinas} siap dibuka dan dicetak.`,
      });
    } catch {
      setActionNotice({
        type: 'error',
        message: 'Gagal menyiapkan file cetak HTML Nota Dinas.',
      });
    } finally {
      setDownloadingWord(false);
    }
  };

  const handlePrintPreview = () => {
    if (!previewRequest) return;
    document.body.classList.add('simas-printing-nota');
    const cleanup = () => {
      document.body.classList.remove('simas-printing-nota');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    try {
      window.print();
      setActionNotice({
        type: 'info',
        message: isSuperAdmin
          ? 'Perintah cetak dikirim. Jika dialog cetak diblokir browser/HP, gunakan tombol "File Cetak (.html)" atau "Unduh Word (.docx)".'
          : 'Perintah cetak dikirim. Jika dialog cetak diblokir browser/HP, gunakan tombol "File Cetak".',
      });
    } catch {
      setActionNotice({
        type: 'error',
        message: isSuperAdmin
          ? 'Dialog cetak diblokir browser. Gunakan tombol "File Cetak" atau "Unduh Word (.docx)".'
          : 'Dialog cetak diblokir browser. Gunakan tombol "File Cetak".',
      });
    } finally {
      window.setTimeout(cleanup, 1200);
    }
  };

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return requests.filter((r) => {
      if (effectiveLocFilter !== 'ALL' && r.locationId !== effectiveLocFilter) {
        return false;
      }
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.nomorNotaDinas.toLowerCase().includes(q) ||
        r.namaBarang.toLowerCase().includes(q) ||
        r.nomorPolisiOrIdentitas.toLowerCase().includes(q) ||
        r.requestedBy.toLowerCase().includes(q) ||
        r.perihal.toLowerCase().includes(q)
      );
    });
  }, [requests, effectiveLocFilter, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    return {
      total: requests.length,
      waiting: requests.filter((r) => r.status === 'MENUNGGU_VERIFIKASI_KASUBAG').length,
      approved: requests.filter((r) => r.status === 'DISETUJUI_KASUBAG').length,
      completed: requests.filter((r) => r.status === 'SELESAI_PERBAIKAN').length,
    };
  }, [requests]);

  const renderNotaDinasPreviewSheet = (
    req: MaintenanceRequest,
    format: NotaDinasFormat
  ) => {
    const locName = locationMap.get(req.locationId)?.name ?? req.unitPelaporLabel;
    const isVerified =
      req.status === 'DISETUJUI_KASUBAG' || req.status === 'SELESAI_PERBAIKAN';
    const qrPayload = `SIMAS-BMD|NOTA-DINAS|${req.nomorNotaDinas}|${req.id}|${
      req.verifiedBy || req.requestedBy
    }`;
    const kerusakanSummary =
      req.rincianKerusakan.length > 0
        ? req.rincianKerusakan
            .map((d) => `${d.jenisKerusakan}${d.keterangan ? ` (${d.keterangan})` : ''}`)
            .join('; ')
        : req.kronologiSingkat;

    const kasubagName = req.verifiedBy || 'Ahmad Thohir, A. Md.';
    const kasubagJabatan =
      req.verifiedByJabatan || 'Kepala Sub Bagian Umum dan Kepegawaian';
    const kasubagRank = req.verifiedByPangkatGol || 'Penata / III/c';
    const kasubagNip = (req.verifiedByNip || '19870616 201001 1 008').replace(/\s+/g, '');

    return (
      <div className="bg-white border border-slate-300 shadow-sm p-6 sm:p-10 text-black text-[13px] leading-relaxed nota-print-sheet max-w-[820px] mx-auto">
        {/* Official Kop Surat */}
        <div className="flex items-center gap-3 sm:gap-4 border-b-[3px] border-double border-black pb-3 mb-4">
          <img
            src="/assets/logo-pemkab-sidoarjo.png"
            alt="Logo Pemerintah Kabupaten Sidoarjo"
            className="w-14 h-[50px] sm:w-16 sm:h-[58px] object-contain shrink-0"
          />
          <div className="flex-1 text-center">
            <p className="text-[12.5px] tracking-wide uppercase">
              Pemerintah Kabupaten Sidoarjo
            </p>
            <p className="text-[16px] sm:text-[17px] font-bold tracking-wide uppercase">
              Badan Penanggulangan Bencana Daerah
            </p>
            <p className="text-[11px]">
              Jalan Sultan Agung No. 19, Sidoarjo, Jawa Timur 61212
            </p>
            <p className="text-[11px]">Telepon (031) 8953200,</p>
            <p className="text-[11px]">
              Laman www.bpbd.sidoarjokab.go.id, Pos-el bpbd@sidoarjokab.go.id
            </p>
          </div>
        </div>

        {/* Title */}
        <div className="text-center tracking-wider text-[14px] font-semibold uppercase my-3">
          NOTA DINAS
        </div>

        {format === 'FORMAT_KASUBAG_UMPEG' ? (
          <>
            {/* Metadata Format 1 (Foto 1) */}
            <table className="w-full text-[12.5px] border-b border-black mb-4">
              <tbody>
                {[
                  ['Yth', req.kepadaYthUmpeg],
                  ['Dari', 'Kepala Sub Bagian Umum dan Kepegawaian'],
                  ['Tembusan', req.tembusanUmpeg],
                  ['Tanggal', formatTanggalBiasa(req.tanggalPengajuan)],
                  ['Nomor', req.nomorNotaDinas],
                  ['Sifat', 'Biasa / Terbuka'],
                  [
                    'Lampiran',
                    req.fotoKerusakanDataUrl ? '1 (Satu) Berkas Foto Kondisi' : '-',
                  ],
                  ['Hal', req.perihal],
                ].map(([label, val], i, arr) => (
                  <tr key={label}>
                    <td className={`w-28 align-top py-0.5 ${i === arr.length - 1 ? 'pb-2' : ''}`}>
                      {label}
                    </td>
                    <td className={`w-4 align-top py-0.5 ${i === arr.length - 1 ? 'pb-2' : ''}`}>
                      :
                    </td>
                    <td className={`align-top py-0.5 ${i === arr.length - 1 ? 'pb-2' : ''}`}>
                      {val || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Body paragraphs */}
            <p className="text-justify indent-8 mb-2">
              Sehubungan dengan Kondisi{' '}
              {req.kategori === 'KENDARAAN'
                ? 'Kendaraan Dinas'
                : 'Barang Inventaris / Peralatan'}{' '}
              hari ini {formatTanggalTerbilang(req.tanggalPengajuan)},{' '}
              {req.kronologiSingkat}
            </p>
            <p className="text-justify indent-8 mb-3">
              Bersama ini kami mengajukan permohonan perawatan/perbaikan{' '}
              {req.kategori === 'KENDARAAN'
                ? 'kendaraan dinas / operasional'
                : 'barang / peralatan inventaris'}{' '}
              dengan spesifikasi sebagai berikut :
            </p>

            {/* 9-col table matching Foto 1 */}
            <div className="overflow-x-auto mb-3">
              <table className="w-full border-collapse border border-slate-800 text-[11.5px] text-center">
                <thead>
                  <tr className="font-bold">
                    <th className="border border-slate-800 p-1.5 w-8">No</th>
                    <th className="border border-slate-800 p-1.5">
                      Nama Pemilik dan Pemegang
                    </th>
                    <th className="border border-slate-800 p-1.5">
                      {req.kategori === 'KENDARAAN'
                        ? 'Jenis Kendaraan'
                        : 'Jenis Barang'}
                    </th>
                    <th className="border border-slate-800 p-1.5">Merk/Type</th>
                    <th className="border border-slate-800 p-1.5">
                      {req.kategori === 'KENDARAAN' ? 'Tahun /CC' : 'Tahun'}
                    </th>
                    <th className="border border-slate-800 p-1.5">
                      {req.kategori === 'KENDARAAN' ? 'Nomor Polisi' : 'Kode / Reg'}
                    </th>
                    <th className="border border-slate-800 p-1.5">
                      {req.kategori === 'KENDARAAN' ? 'Nomor Rangka' : 'Unit / Pos'}
                    </th>
                    <th className="border border-slate-800 p-1.5">
                      {req.kategori === 'KENDARAAN' ? 'Nomor Mesin' : 'Rujukan'}
                    </th>
                    <th className="border border-slate-800 p-1.5">Ket</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-800 p-1.5">1.</td>
                    <td className="border border-slate-800 p-1.5">
                      {req.namaPemilikPemegang}
                    </td>
                    <td className="border border-slate-800 p-1.5">
                      {req.jenisPeralatan || req.namaBarang}
                    </td>
                    <td className="border border-slate-800 p-1.5">{req.merkTipe}</td>
                    <td className="border border-slate-800 p-1.5 font-mono">
                      {req.tahunPembuatanAtauCc}
                    </td>
                    <td className="border border-slate-800 p-1.5 font-mono">
                      {req.nomorPolisiOrIdentitas}
                    </td>
                    <td className="border border-slate-800 p-1.5 font-mono">
                      {req.kategori === 'KENDARAAN'
                        ? req.nomorRangka || '-'
                        : locName}
                    </td>
                    <td className="border border-slate-800 p-1.5 font-mono">
                      {req.kategori === 'KENDARAAN'
                        ? req.nomorMesin || '-'
                        : req.bengkelRujukan || '-'}
                    </td>
                    <td className="border border-slate-800 p-1.5">{kerusakanSummary}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="indent-8 mb-6">
              Demikian yang kami sampaikan, untuk menjadikan periksa.
            </p>

            {/* Two-column signature block: Left = Penanggung Jawab Admin Pos (wajib), Right = a.n. Pemohon Kasubag Umpeg */}
            {(() => {
              const pjName = req.posAdminName || req.requestedBy;
              const pjJabatan =
                req.posAdminJabatan || req.requestedByJabatan || 'Penanggung Jawab Admin Pos';
              const pjNip = req.posAdminNip || req.requestedByNip || '-';
              const pjQrPayload = `SIMAS-BMD|TTD-PJ-POS|${req.nomorNotaDinas}|${req.id}|${pjName}|${pjNip}`;
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-[12px]">
                  <div className="space-y-1">
                    <p>Penanggung Jawab Admin Pos,</p>
                    <p>{pjJabatan}</p>
                    <div className="flex items-start gap-2.5 py-1">
                      <QrCodeImage value={pjQrPayload} size={56} />
                      <div className="text-[10px] leading-tight text-slate-700">
                        <p>Ditandatangani secara elektronik oleh</p>
                        <p className="mt-1 font-semibold">{pjName}</p>
                        <p>{pjJabatan}</p>
                      </div>
                    </div>
                    <p className="font-semibold">{pjName}</p>
                    <p>{req.requestedByPangkatGol || 'Penata Muda / III/a'}</p>
                    <p className="font-mono">NIP {pjNip}</p>
                  </div>

                  <div className="space-y-1">
                    <p>a.n. Pemohon</p>
                    <p>{kasubagJabatan}</p>
                    {isVerified ? (
                      <div className="flex items-start gap-2.5 py-1">
                        <QrCodeImage value={qrPayload} size={58} />
                        <div className="text-[10px] leading-tight text-slate-700">
                          <p>Ditandatangani secara elektronik oleh</p>
                          <p className="mt-1 font-semibold">{kasubagName}</p>
                          <p>{kasubagJabatan}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="h-14 flex items-center text-[11px] italic text-amber-700">
                        [Draft — Menunggu Verifikasi Kasubag Umpeg]
                      </div>
                    )}
                    <p className="font-semibold">{kasubagName}</p>
                    <p>{kasubagRank}</p>
                    <p className="font-mono">NIP {kasubagNip}</p>
                  </div>
                </div>
              );
            })()}
          </>
        ) : (
          <>
            {/* Metadata Format 2 (Foto 2) */}
            <table className="w-full text-[12.5px] mb-4">
              <tbody>
                {[
                  ['Kepada', req.kepadaUnitPos || 'Kepala Pelaksana BPBD Kab. Sidoarjo'],
                  ['Dari', req.posAdminJabatan || req.requestedByJabatan || req.unitPelaporLabel],
                  ['Tanggal', formatTanggalBiasa(req.tanggalPengajuan)],
                  ['Nomor', req.nomorNotaDinas],
                  ['Sifat', 'Biasa / Terbuka'],
                  [
                    'Lampiran',
                    req.fotoKerusakanDataUrl ? '1 (Satu) Berkas Foto Kondisi' : '-',
                  ],
                  ['Perihal', req.perihal],
                  ['Jenis Kendaraan/Peralatan', req.jenisPeralatan || req.namaBarang],
                  ['Merk Kendaraan/Peralatan', req.merkTipe || '-'],
                  ['Nomor Polisi/Identitas', req.nomorPolisiOrIdentitas || '-'],
                  ['Tahun Pembuatan', req.tahunPembuatanAtauCc || '-'],
                  ['Tempat/Lokasi/Wilayah', locName],
                ].map(([label, val]) => (
                  <tr key={label}>
                    <td className="w-52 align-top py-0.5">{label}</td>
                    <td className="w-4 align-top py-0.5">:</td>
                    <td className="align-top py-0.5">{val || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-justify indent-8 mb-3">
              Bersama ini kami laporkan dengan hormat bahwa {req.unitPelaporLabel || locName}{' '}
              saat ini membutuhkan perbaikan / perawatan{' '}
              {req.kategori === 'KENDARAAN' ? 'kendaraan' : 'peralatan / barang inventaris'}.
              Adapun jenis dan macam kerusakan sebagai berikut :
            </p>

            {/* 3-col table matching Foto 2 */}
            <table className="w-full border-collapse border border-slate-800 text-[12px] mb-3">
              <thead>
                <tr className="font-bold text-center">
                  <th className="border border-slate-800 py-1.5 px-2 w-12">NO</th>
                  <th className="border border-slate-800 py-1.5 px-3">
                    JENIS KERUSAKAN / PERAWATAN
                  </th>
                  <th className="border border-slate-800 py-1.5 px-3 w-48">
                    KETERANGAN
                  </th>
                </tr>
              </thead>
              <tbody>
                {req.rincianKerusakan.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="border border-slate-800 py-1.5 px-2 text-center">
                      {idx + 1}
                    </td>
                    <td className="border border-slate-800 py-1.5 px-3">
                      {item.jenisKerusakan}
                    </td>
                    <td className="border border-slate-800 py-1.5 px-3 text-center">
                      {item.keterangan || 'Rusak'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="indent-8 mb-6">
              Demikian untuk menjadikan periksa dan mohon petunjuk.
            </p>

            {/* Two-column signatures matching Foto 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-[12px]">
              <div className="space-y-1">
                <p>Mengetahui,</p>
                <p>{req.verifiedByJabatan || req.mengetahuiUnitPosJabatan}</p>
                {isVerified ? (
                  <div className="flex items-start gap-2.5 py-1.5">
                    <QrCodeImage value={qrPayload} size={54} />
                    <div className="text-[10px] leading-tight text-slate-700">
                      <p>Ditandatangani secara elektronik oleh</p>
                      <p className="mt-1 font-semibold">
                        {req.verifiedBy || req.mengetahuiUnitPosNama}
                      </p>
                      <p>{req.verifiedByJabatan || req.mengetahuiUnitPosJabatan}</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-14 flex items-center text-[11px] italic text-amber-700">
                    [Menunggu Verifikasi Kasubag Umpeg]
                  </div>
                )}
                <p className="font-semibold">
                  {req.verifiedBy || req.mengetahuiUnitPosNama}
                </p>
                <p>{req.verifiedByPangkatGol || req.mengetahuiUnitPosPangkat}</p>
                <p className="font-mono">
                  NIP. {req.verifiedByNip || req.mengetahuiUnitPosNip}
                </p>
              </div>

              {(() => {
                const pjName = req.posAdminName || req.requestedBy;
                const pjJabatan =
                  req.posAdminJabatan ||
                  req.requestedByJabatan ||
                  'Penanggung Jawab Admin Pos';
                const pjNip = req.posAdminNip || req.requestedByNip || '-';
                const pjQrPayload = `SIMAS-BMD|TTD-PJ-POS|${req.nomorNotaDinas}|${req.id}|${pjName}|${pjNip}`;
                return (
                  <div className="space-y-1">
                    <p>Yang mengajukan,</p>
                    <p>Penanggung Jawab Admin Pos · {pjJabatan}</p>
                    <div className="flex items-start gap-2.5 py-1.5">
                      <QrCodeImage value={pjQrPayload} size={54} />
                      <div className="text-[10px] leading-tight text-slate-700">
                        <p>Ditandatangani secara elektronik oleh</p>
                        <p className="mt-1 font-semibold">{pjName}</p>
                        <p>{pjJabatan}</p>
                      </div>
                    </div>
                    <p className="font-semibold">{pjName}</p>
                    <p>{req.requestedByPangkatGol || 'Penata Muda / III/a'}</p>
                    <p className="font-mono">NIP. {pjNip}</p>
                  </div>
                );
              })()}
            </div>
          </>
        )}

        {req.fotoKerusakanDataUrl && (
          <div className="mt-6 pt-3 border-t border-slate-200">
            <p className="text-[11px] font-semibold mb-2">
              Lampiran Dokumentasi Kondisi Barang Rusak:
            </p>
            <img
              src={req.fotoKerusakanDataUrl}
              alt={req.namaBarang}
              className="max-h-48 rounded border border-slate-300 object-contain"
            />
          </div>
        )}

        <div className="mt-10 pt-3 text-center text-[10px] italic text-slate-600 border-t border-slate-200">
          {isVerified
            ? 'Dokumen ini telah ditandatangani secara elektronik menggunakan sertifikat elektronik yang diterbitkan oleh Balai Besar Sertifikasi Elektronik (BSrE) sesuai dengan Undang Undang No 11 Tahun 2008 tentang Informasi dan Transaksi Elektronik.'
            : 'DRAFT NOTA DINAS SIMAS-BMD: Menunggu verifikasi dan persetujuan Kepala Sub Bagian Umum dan Kepegawaian BPBD Kabupaten Sidoarjo.'}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4 no-print">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Pengajuan Pemeliharaan Barang Rusak &amp; Nota Dinas
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            {isSuperAdmin
              ? 'Usulan perbaikan aset/kendaraan dari Mako & 7 Pos Damkar, verifikasi Kasubag Umpeg, dan unduh draft Word (.docx)'
              : 'Usulan perbaikan aset/kendaraan dari Mako & 7 Pos Damkar'}
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={openNewRequestModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Ajukan Pemeliharaan Barang Rusak
          </button>
        )}
      </div>

      {actionNotice && !previewRequest && (
        <div
          className={`px-4 py-2.5 rounded-md text-xs border flex items-center justify-between gap-2 no-print ${
            actionNotice.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : actionNotice.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-900 border-amber-200'
          }`}
        >
          <span>{actionNotice.message}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="underline text-[11px] shrink-0 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 no-print">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500">Total Pengajuan</p>
          <p className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {stats.total}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500">Menunggu Kasubag Umpeg</p>
          <p className="font-display text-2xl font-bold text-amber-700 mt-1 tabular-nums">
            {stats.waiting}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500">Disetujui / Siap Nota Dinas</p>
          <p className="font-display text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
            {stats.approved}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500">Selesai Diperbaiki</p>
          <p className="font-display text-2xl font-bold text-[#0B2545] mt-1 tabular-nums">
            {stats.completed}
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center no-print">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nomor nota dinas, nama barang/kendaraan, plat, atau pengaju..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0B2545]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={effectiveLocFilter}
            disabled={Boolean(lockedLocationId)}
            onChange={(e) => setLocFilter(e.target.value)}
            aria-label="Filter lokasi pengajuan"
            className="px-3 py-2 text-xs border border-slate-300 rounded-md bg-white disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed"
          >
            {!lockedLocationId && <option value="ALL">Semua Lokasi</option>}
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} · {l.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter status verifikasi"
            className="px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
          >
            <option value="ALL">Semua Status ({requests.length})</option>
            <option value="MENUNGGU_VERIFIKASI_KASUBAG">Menunggu Kasubag Umpeg</option>
            <option value="DISETUJUI_KASUBAG">Disetujui Kasubag Umpeg</option>
            <option value="SELESAI_PERBAIKAN">Selesai Diperbaiki</option>
            <option value="DITOLAK">Ditolak</option>
          </select>
        </div>
      </div>

      {/* Main List */}
      {(() => {
        const showActionColumn = isSuperAdmin || canVerifyKasubag;
        return (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden no-print">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    <th className="py-3 px-4">Nota Dinas &amp; Tanggal</th>
                    <th className="py-3 px-3 text-center w-14">Foto</th>
                    <th className="py-3 px-4">Barang / Kendaraan &amp; Lokasi</th>
                    <th className="py-3 px-4">Rincian Kerusakan</th>
                    <th className="py-3 px-4">Status Kasubag Umpeg</th>
                    {showActionColumn && (
                      <th className="py-3 px-4 text-right">
                        {isSuperAdmin ? 'Aksi & Draft Word' : 'Aksi'}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td
                        colSpan={showActionColumn ? 6 : 5}
                        className="py-10 text-center text-slate-500"
                      >
                        Belum ada data pengajuan pemeliharaan barang rusak sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((req) => {
                  const loc = locationMap.get(req.locationId);
                  const st = STATUS_META[req.status];
                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <div className="font-mono font-semibold text-[#0B2545] tabular-nums">
                          {req.nomorNotaDinas}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                          {formatDateID(req.tanggalPengajuan)} · {req.id}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1">
                          PJ Admin Pos:{' '}
                          <strong>{req.posAdminName || req.requestedBy}</strong>
                        </div>
                        <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                          TTD Penanggung Jawab Admin Pos Terlampir
                        </div>
                      </td>

                      <td className="py-3.5 px-3 align-top">
                        <div className="flex justify-center">
                          <ItemPhotoThumbnail
                            fotoDataUrl={req.fotoKerusakanDataUrl}
                            alt={req.namaBarang}
                            onClick={() =>
                              req.fotoKerusakanDataUrl &&
                              setLightboxPhoto({
                                title: req.namaBarang,
                                subtitle: `${req.nomorNotaDinas} · ${loc?.name ?? req.locationId}`,
                                dataUrl: req.fotoKerusakanDataUrl,
                                fileName: req.fotoKerusakanNamaFile,
                              })
                            }
                          />
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top max-w-[240px]">
                        <div className="font-semibold text-slate-900 leading-snug">
                          {req.namaBarang}
                        </div>
                        <div className="font-mono text-[11px] text-slate-600 mt-0.5">
                          {req.merkTipe} · {req.nomorPolisiOrIdentitas}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {loc?.name ?? req.unitPelaporLabel}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top max-w-xs">
                        <p className="font-medium text-slate-900">{req.perihal}</p>
                        <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600 list-disc pl-4">
                          {req.rincianKerusakan.map((det) => (
                            <li key={det.id}>
                              {det.jenisKerusakan}{' '}
                              <span className="text-slate-500">({det.keterangan})</span>
                            </li>
                          ))}
                        </ul>
                        {req.approvedBudgetEstimate && req.approvedBudgetEstimate > 0 && (
                          <p className="mt-1 font-mono text-[11px] font-semibold text-emerald-700 tabular-nums">
                            Est. Biaya: {formatIDR(req.approvedBudgetEstimate)}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <span
                          className={`inline-block px-2 py-1 text-[11px] font-semibold border rounded ${st.badgeClass}`}
                        >
                          {st.label}
                        </span>
                        {req.verifiedBy && (
                          <div className="text-[11px] text-slate-600 mt-1">
                            Verifikator: <strong>{req.verifiedBy}</strong>
                          </div>
                        )}
                        {req.verificationNote && (
                          <p className="text-[11px] text-slate-500 mt-0.5 max-w-[200px]">
                            “{req.verificationNote}”
                          </p>
                        )}
                      </td>

                      {showActionColumn && (
                        <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                          <div className="inline-flex flex-col items-end gap-2">
                            {canVerifyKasubag && (
                              <div className="inline-flex flex-wrap justify-end gap-1.5">
                                {req.status === 'MENUNGGU_VERIFIKASI_KASUBAG' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleQuickApprove(req);
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Setuju
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openVerifyModal(req);
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded cursor-pointer"
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5" />
                                      Verifikasi / Tolak
                                    </button>
                                  </>
                                )}

                                {req.status === 'DISETUJUI_KASUBAG' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onCompleteRequest(req.id, true);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#0B2545] bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded cursor-pointer"
                                  >
                                    <ClipboardCheck className="w-3.5 h-3.5" />
                                    Tandai Selesai Diperbaiki
                                  </button>
                                )}

                                {req.status !== 'MENUNGGU_VERIFIKASI_KASUBAG' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onCancelVerifyRequest(req.id);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded cursor-pointer"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Batal Verifikasi
                                  </button>
                                )}
                              </div>
                            )}

                            {isSuperAdmin && (
                              <div className="inline-flex flex-wrap justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenNotaPreview(req);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#0B2545] bg-white border border-slate-300 hover:bg-slate-50 rounded cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Pratinjau Nota Dinas
                                </button>
                                <button
                                  type="button"
                                  disabled={downloadingWord}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleDownloadWord(
                                      req,
                                      req.status === 'DISETUJUI_KASUBAG' ||
                                        req.status === 'SELESAI_PERBAIKAN'
                                        ? 'FORMAT_KASUBAG_UMPEG'
                                        : 'FORMAT_UNIT_POS'
                                    );
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] disabled:opacity-50 rounded cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Draft Word (.docx)
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
        );
      })()}

      {/* Modal 1: Buat Pengajuan Pemeliharaan Barang Rusak */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 overflow-y-auto no-print">
          <div className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full shadow-2xl overflow-hidden my-6">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-[#0B2545] text-white">
              <h3 className="font-display text-sm font-bold flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-300" />
                Formulir Pengajuan Pemeliharaan / Perbaikan Barang Rusak
              </h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="p-1 rounded text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitCreate}
              className="p-5 space-y-4 text-xs max-h-[82vh] overflow-y-auto"
            >
              {/* Source selector */}
              <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200 space-y-3">
                <p className="font-semibold text-slate-800">
                  1. Pilih Sumber Barang / Kendaraan Rusak
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'VEHICLE' as const, label: 'Dari Daftar Kendaraan (R4/R2)' },
                    { key: 'ASSET' as const, label: 'Dari Daftar Barang KIB A–F' },
                    { key: 'MANUAL' as const, label: 'Input Manual' },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        setSourceMode(opt.key);
                        if (opt.key === 'VEHICLE' && vehicles[0]) {
                          setSelectedVehicleId(vehicles[0].id);
                          populateFromVehicle(vehicles[0].id);
                        } else if (opt.key === 'ASSET' && assets[0]) {
                          setSelectedAssetId(assets[0].id);
                          populateFromAsset(assets[0].id);
                        }
                      }}
                      className={`px-3 py-1.5 rounded text-xs font-semibold border cursor-pointer ${
                        sourceMode === opt.key
                          ? 'bg-[#0B2545] text-white border-[#0B2545]'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {sourceMode === 'VEHICLE' && (
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => {
                      setSelectedVehicleId(e.target.value);
                      populateFromVehicle(e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        [{v.kondisi}] {v.nomorPolisi} · {v.namaKendaraan} (
                        {locationMap.get(v.locationId)?.code ?? v.locationId})
                      </option>
                    ))}
                  </select>
                )}

                {sourceMode === 'ASSET' && (
                  <select
                    value={selectedAssetId}
                    onChange={(e) => {
                      setSelectedAssetId(e.target.value);
                      populateFromAsset(e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                  >
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        [{a.kondisi}] {a.id} · {a.namaBarang} (
                        {locationMap.get(a.locationId)?.code ?? a.locationId})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Identitas Barang & Nota Dinas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nomor Draft Nota Dinas *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.nomorNotaDinas}
                    onChange={(e) =>
                      setFormState({ ...formState, nomorNotaDinas: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Lokasi Pos / Unit Penempatan *
                  </label>
                  <select
                    value={lockedLocationId || formState.locationId}
                    disabled={Boolean(lockedLocationId)}
                    onChange={(e) => {
                      const nextLoc = e.target.value;
                      setFormState({
                        ...formState,
                        locationId: nextLoc,
                        unitPelaporLabel:
                          locationMap.get(nextLoc)?.name ?? formState.unitPelaporLabel,
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white disabled:bg-slate-100"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code} · {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tingkat Kondisi Kerusakan *
                  </label>
                  <select
                    value={formState.reportedCondition}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        reportedCondition: e.target.value as Exclude<
                          ConditionStatus,
                          'BAIK'
                        >,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                  >
                    <option value="RUSAK_RINGAN">Rusak Ringan</option>
                    <option value="RUSAK_BERAT">Rusak Berat</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Barang / Kendaraan *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.namaBarang}
                    onChange={(e) =>
                      setFormState({ ...formState, namaBarang: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Perihal Nota Dinas *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.perihal}
                    onChange={(e) =>
                      setFormState({ ...formState, perihal: e.target.value })
                    }
                    placeholder="Contoh: Permohonan Perbaikan Mobil W 8520 NP"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Jenis Kendaraan / Peralatan
                  </label>
                  <input
                    type="text"
                    value={formState.jenisPeralatan}
                    onChange={(e) =>
                      setFormState({ ...formState, jenisPeralatan: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Merk / Tipe
                  </label>
                  <input
                    type="text"
                    value={formState.merkTipe}
                    onChange={(e) =>
                      setFormState({ ...formState, merkTipe: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tahun / CC
                  </label>
                  <input
                    type="text"
                    value={formState.tahunPembuatanAtauCc}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        tahunPembuatanAtauCc: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    No. Polisi / Kode Barang
                  </label>
                  <input
                    type="text"
                    value={formState.nomorPolisiOrIdentitas}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        nomorPolisiOrIdentitas: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    No. Rangka (Kendaraan)
                  </label>
                  <input
                    type="text"
                    value={formState.nomorRangka}
                    onChange={(e) =>
                      setFormState({ ...formState, nomorRangka: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    No. Mesin (Kendaraan)
                  </label>
                  <input
                    type="text"
                    value={formState.nomorMesin}
                    onChange={(e) =>
                      setFormState({ ...formState, nomorMesin: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kronologi / Keterangan Kondisi Barang *
                </label>
                <textarea
                  rows={2}
                  required
                  value={formState.kronologiSingkat}
                  onChange={(e) =>
                    setFormState({ ...formState, kronologiSingkat: e.target.value })
                  }
                  placeholder="Jelaskan kondisi kerusakan barang/kendaraan untuk naskah Nota Dinas..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>

              {/* Rincian Kerusakan Multi-Baris */}
              <div className="space-y-2 border border-slate-200 rounded-md p-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">
                    Tabel Jenis Kerusakan / Perawatan (Untuk Nota Dinas)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setDamageLines((prev) => [
                        ...prev,
                        {
                          id: `ROW-${Date.now()}-${prev.length + 1}`,
                          jenisKerusakan: '',
                          keterangan: 'Rusak',
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#0B2545] bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Tambah Baris
                  </button>
                </div>

                {damageLines.map((line, idx) => (
                  <div key={line.id} className="grid grid-cols-12 gap-2 items-center">
                    <span className="col-span-1 text-center font-mono text-slate-500">
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      value={line.jenisKerusakan}
                      onChange={(e) =>
                        setDamageLines((prev) =>
                          prev.map((row) =>
                            row.id === line.id
                              ? { ...row, jenisKerusakan: e.target.value }
                              : row
                          )
                        )
                      }
                      placeholder="Jenis kerusakan / item perawatan..."
                      className="col-span-6 px-2.5 py-1.5 border border-slate-300 rounded"
                    />
                    <input
                      type="text"
                      value={line.keterangan}
                      onChange={(e) =>
                        setDamageLines((prev) =>
                          prev.map((row) =>
                            row.id === line.id
                              ? { ...row, keterangan: e.target.value }
                              : row
                          )
                        )
                      }
                      placeholder="Keterangan (Misal: Rusak)"
                      className="col-span-4 px-2.5 py-1.5 border border-slate-300 rounded"
                    />
                    <button
                      type="button"
                      disabled={damageLines.length <= 1}
                      onClick={() =>
                        setDamageLines((prev) => prev.filter((r) => r.id !== line.id))
                      }
                      className="col-span-1 p-1.5 text-slate-400 hover:text-red-700 disabled:opacity-30 cursor-pointer"
                      aria-label="Hapus baris"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <ItemPhotoControl
                fotoDataUrl={formState.fotoKerusakanDataUrl}
                fotoNamaFile={formState.fotoKerusakanNamaFile}
                label={
                  isSuperAdmin
                    ? 'Lampiran Foto Kondisi Barang Rusak (Opsional — ikut tersemat di Word)'
                    : 'Lampiran Foto Kondisi Barang Rusak (Opsional — ikut tersemat di Nota Dinas)'
                }
                onChange={({ fotoDataUrl, fotoNamaFile }) =>
                  setFormState({
                    ...formState,
                    fotoKerusakanDataUrl: fotoDataUrl,
                    fotoKerusakanNamaFile: fotoNamaFile,
                  })
                }
              />

              {/* Mandatory TTD Penanggung Jawab Admin Pos block */}
              <div className="p-3.5 rounded-md bg-emerald-50/70 border border-emerald-200 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-[#0B2545] flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      Tanda Tangan Penanggung Jawab Admin Pos (Wajib)
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Setiap permohonan pemeliharaan wajib disertai TTD elektronik Penanggung Jawab Admin Pos lokasi penempatan barang.
                    </p>
                  </div>
                  <div className="shrink-0 bg-white p-1 border border-emerald-200 rounded">
                    <QrCodeImage
                      value={`SIMAS-BMD|TTD-PJ-POS|${formState.nomorNotaDinas}|${resolvedPosAdmin.name}|${resolvedPosAdmin.nip}`}
                      size={48}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] bg-white border border-emerald-200/80 rounded p-2.5">
                  <div>
                    <span className="text-slate-500 block">Penanggung Jawab Pos</span>
                    <strong className="text-slate-900">{resolvedPosAdmin.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Jabatan</span>
                    <strong className="text-slate-900">{resolvedPosAdmin.jabatan}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">NIP</span>
                    <strong className="font-mono text-slate-900">
                      {resolvedPosAdmin.nip}
                    </strong>
                  </div>
                </div>

                <label className="flex items-start gap-2 cursor-pointer text-[11px] text-slate-800 font-medium">
                  <input
                    type="checkbox"
                    required
                    checked={posAdminTtdConfirmed}
                    onChange={(e) => setPosAdminTtdConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-slate-400 text-emerald-700 focus:ring-emerald-600"
                  />
                  <span>
                    Saya mengonfirmasi bahwa permohonan pemeliharaan ini diketahui dan ditandatangani oleh Penanggung Jawab Admin Pos ({resolvedPosAdmin.name}) untuk dicantumkan pada Nota Dinas.
                  </span>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!posAdminTtdConfirmed}
                  className="px-4 py-2 font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] disabled:opacity-50 rounded-md cursor-pointer"
                >
                  Kirim Pengajuan ke Kasubag Umpeg
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Verifikasi & Persetujuan Kasubag Umpeg (Super Admin) */}
      {canVerifyKasubag && verifyingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 overflow-y-auto no-print">
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-[#0B2545] text-white">
              <h3 className="font-display text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                Verifikasi &amp; Persetujuan Kasubag Umpeg
              </h3>
              <button
                type="button"
                onClick={() => setVerifyingRequest(null)}
                className="p-1 rounded text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1">
                <p className="font-bold text-slate-900">{verifyingRequest.namaBarang}</p>
                <p className="text-slate-600">
                  Pengaju: {verifyingRequest.requestedBy} ({verifyingRequest.unitPelaporLabel})
                </p>
                <p className="text-slate-600">{verifyingRequest.kronologiSingkat}</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nomor Nota Dinas Resmi
                </label>
                <input
                  type="text"
                  value={verifyForm.nomorNotaDinas}
                  onChange={(e) =>
                    setVerifyForm({ ...verifyForm, nomorNotaDinas: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Yth (Tujuan Nota Dinas Umpeg)
                  </label>
                  <input
                    type="text"
                    value={verifyForm.kepadaYthUmpeg}
                    onChange={(e) =>
                      setVerifyForm({ ...verifyForm, kepadaYthUmpeg: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tembusan
                  </label>
                  <input
                    type="text"
                    value={verifyForm.tembusanUmpeg}
                    onChange={(e) =>
                      setVerifyForm({ ...verifyForm, tembusanUmpeg: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Estimasi Biaya / Pagu (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={verifyForm.approvedBudgetEstimate}
                    onChange={(e) =>
                      setVerifyForm({
                        ...verifyForm,
                        approvedBudgetEstimate: e.target.value,
                      })
                    }
                    placeholder="Contoh: 1500000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Bengkel / Rekanan Rujukan
                  </label>
                  <input
                    type="text"
                    value={verifyForm.bengkelRujukan}
                    onChange={(e) =>
                      setVerifyForm({ ...verifyForm, bengkelRujukan: e.target.value })
                    }
                    placeholder="Contoh: Bengkel Rekanan BPBD"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catatan Verifikasi Kasubag Umpeg
                </label>
                <textarea
                  rows={2}
                  value={verifyForm.verificationNote}
                  onChange={(e) =>
                    setVerifyForm({ ...verifyForm, verificationNote: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVerifyingRequest(null)}
                  className="px-3.5 py-2 font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onVerifyRequest({
                      requestId: verifyingRequest.id,
                      approved: false,
                      nomorNotaDinas: verifyForm.nomorNotaDinas,
                      kepadaYthUmpeg: verifyForm.kepadaYthUmpeg,
                      tembusanUmpeg: verifyForm.tembusanUmpeg,
                      verificationNote:
                        verifyForm.verificationNote || 'Ditolak / perlu kelengkapan data.',
                    });
                    setVerifyingRequest(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-md cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  Tolak Pengajuan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onVerifyRequest({
                      requestId: verifyingRequest.id,
                      approved: true,
                      nomorNotaDinas: verifyForm.nomorNotaDinas,
                      kepadaYthUmpeg: verifyForm.kepadaYthUmpeg,
                      tembusanUmpeg: verifyForm.tembusanUmpeg,
                      approvedBudgetEstimate: verifyForm.approvedBudgetEstimate
                        ? Number(verifyForm.approvedBudgetEstimate)
                        : undefined,
                      bengkelRujukan: verifyForm.bengkelRujukan.trim() || undefined,
                      verificationNote: verifyForm.verificationNote,
                    });
                    setVerifyingRequest(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Setuju &amp; Siapkan Nota Dinas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Live Nota Dinas Preview & Unduh Draft Word (.docx) (Super Admin) */}
      {isSuperAdmin && previewRequest && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/65 p-2 sm:p-5 overflow-y-auto no-print">
          <div className="bg-slate-100 border border-slate-300 rounded-lg max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[94vh] my-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3.5 bg-[#0B2545] text-white shrink-0">
              <div className="min-w-0">
                <h3 className="font-display text-sm font-bold flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-amber-300 shrink-0" />
                  <span className="truncate">
                    Pratinjau Nota Dinas · {previewRequest.nomorNotaDinas}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  {isSuperAdmin
                    ? 'Pilih format Nota Dinas standar Kabupaten Sidoarjo lalu unduh Word (.docx) atau cetak'
                    : 'Pilih format Nota Dinas standar Kabupaten Sidoarjo lalu pratinjau atau cetak'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canVerifyKasubag &&
                  previewRequest.status === 'MENUNGGU_VERIFIKASI_KASUBAG' && (
                    <button
                      type="button"
                      onClick={() => handleQuickApprove(previewRequest)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Setuju
                    </button>
                  )}

                {canVerifyKasubag &&
                  previewRequest.status !== 'MENUNGGU_VERIFIKASI_KASUBAG' && (
                    <button
                      type="button"
                      onClick={() => onCancelVerifyRequest(previewRequest.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-100 bg-rose-700/80 hover:bg-rose-600 rounded-md cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Batal Verifikasi
                    </button>
                  )}

                {isSuperAdmin && (
                  <button
                    type="button"
                    disabled={downloadingWord}
                    onClick={() => void handleDownloadWord(previewRequest, previewFormat)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0B2545] bg-amber-300 hover:bg-amber-200 disabled:opacity-50 rounded-md cursor-pointer"
                  >
                    {downloadingWord ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    Unduh Word (.docx)
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePrintPreview}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-white/15 hover:bg-white/25 rounded-md cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak / PDF
                </button>
                <button
                  type="button"
                  disabled={downloadingWord}
                  onClick={() => void handleDownloadHtmlPrint(previewRequest, previewFormat)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-md cursor-pointer"
                  title="Unduh file pratinjau HTML siap cetak apabila dialog print diblokir"
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  File Cetak
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewRequestId(null);
                    setActionNotice(null);
                  }}
                  className="p-1.5 rounded text-slate-300 hover:text-white cursor-pointer"
                  aria-label="Tutup pratinjau Nota Dinas"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {actionNotice && (
              <div
                className={`px-5 py-2 text-xs border-b shrink-0 flex items-center justify-between gap-2 ${
                  actionNotice.type === 'error'
                    ? 'bg-red-50 text-red-800 border-red-200'
                    : actionNotice.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-amber-50 text-amber-900 border-amber-200'
                }`}
              >
                <span>{actionNotice.message}</span>
                <button
                  type="button"
                  onClick={() => setActionNotice(null)}
                  className="underline text-[11px] shrink-0 cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            )}

            {/* Format Switcher Bar */}
            <div className="px-4 sm:px-5 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPreviewFormat('FORMAT_KASUBAG_UMPEG')}
                  className={`px-3 py-1.5 rounded font-semibold cursor-pointer border ${
                    previewFormat === 'FORMAT_KASUBAG_UMPEG'
                      ? 'bg-[#0B2545] text-white border-[#0B2545]'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Format 1 · Nota Dinas Kasubag Umpeg → Plt. Sekretaris
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFormat('FORMAT_UNIT_POS')}
                  className={`px-3 py-1.5 rounded font-semibold cursor-pointer border ${
                    previewFormat === 'FORMAT_UNIT_POS'
                      ? 'bg-[#0B2545] text-white border-[#0B2545]'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Format 2 · Nota Dinas Permohonan Unit / Pos Damkar
                </button>
              </div>
              {previewRequest.status === 'MENUNGGU_VERIFIKASI_KASUBAG' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Draft belum disetujui Kasubag Umpeg
                </span>
              )}
            </div>

            {/* Paper Preview Canvas */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6">
              {renderNotaDinasPreviewSheet(previewRequest, previewFormat)}
            </div>
          </div>
        </div>
      )}

      <PhotoLightboxModal
        photo={lightboxPhoto}
        onClose={() => setLightboxPhoto(null)}
      />

      {portalHost &&
        isSuperAdmin &&
        previewRequest &&
        createPortal(
          <>
            <style>{PRINT_NOTA_CSS}</style>
            {renderNotaDinasPreviewSheet(previewRequest, previewFormat)}
          </>,
          portalHost
        )}
    </div>
  );
};
