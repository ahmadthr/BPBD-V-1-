import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  Plus,
  Printer,
  RotateCcw,
  Wrench,
  XCircle,
} from 'lucide-react';
import { BAST_INVENTARIS_META, TIM_INVENTARIS_2026 } from '../data/initialData';
import {
  AssetItem,
  ConditionStatus,
  DamageReport,
  DamageReportStatus,
  LocationUnit,
  OpnameStatus,
  RoleProfile,
} from '../types/simas';
import {
  DAMAGE_STATUS_META,
  OPNAME_STATUS_META,
  exportAssetsToCSV,
  formatDateID,
  formatIDR,
} from '../utils/formatters';
import { ConditionIndicator } from './StatusText';

interface OpnameReportViewProps {
  assets: AssetItem[];
  locations: LocationUnit[];
  damageReports: DamageReport[];
  roleProfile: RoleProfile;
  preselectedDamageAssetId?: string;
  onCreateDamageReport: (payload: {
    assetId: string;
    reportedCondition: Exclude<ConditionStatus, 'BAIK'>;
    chronology: string;
    estimatedAction: string;
  }) => void;
  onUpdateDamageStatus: (reportId: string, nextStatus: DamageReportStatus) => void;
  onCancelDamageReport?: (reportId: string) => void;
  onUpdateOpnameCheck: (
    assetId: string,
    status: OpnameStatus,
    observedCondition: ConditionStatus,
    notes: string
  ) => void;
  onRequestMaintenanceForAsset?: (assetId: string) => void;
}

export const OpnameReportView: React.FC<OpnameReportViewProps> = ({
  assets,
  locations,
  damageReports,
  roleProfile,
  preselectedDamageAssetId = '',
  onCreateDamageReport,
  onUpdateDamageStatus,
  onCancelDamageReport,
  onUpdateOpnameCheck,
  onRequestMaintenanceForAsset,
}) => {
  const [activeTab, setActiveTab] = useState<'kerusakan' | 'opname'>(
    preselectedDamageAssetId ? 'kerusakan' : 'kerusakan'
  );
  const [reportFormOpen, setReportFormOpen] = useState<boolean>(
    Boolean(preselectedDamageAssetId)
  );
  const [damageAssetId, setDamageAssetId] = useState<string>(
    preselectedDamageAssetId || assets[0]?.id || ''
  );
  const [damageCondition, setDamageCondition] = useState<
    Exclude<ConditionStatus, 'BAIK'>
  >('RUSAK_RINGAN');
  const [chronology, setChronology] = useState<string>('');
  const [estimatedAction, setEstimatedAction] = useState<string>('');

  const lockedLocationId = roleProfile.assignedLocationId || '';
  const isSuperAdmin = roleProfile.id === 'SUPER_ADMIN';
  const [opnameLocFilter, setOpnameLocFilter] = useState<string>(
    lockedLocationId || 'ALL'
  );
  const effectiveOpnameLocFilter = lockedLocationId || opnameLocFilter;

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const locationMap = useMemo(
    () => new Map(locations.map((l) => [l.id, l])),
    [locations]
  );

  const opnameAssets = useMemo(() => {
    if (effectiveOpnameLocFilter === 'ALL') return assets;
    return assets.filter((a) => a.locationId === effectiveOpnameLocFilter);
  }, [assets, effectiveOpnameLocFilter]);

  const opnameStats = useMemo(() => {
    const total = opnameAssets.length;
    const checked = opnameAssets.filter((a) => a.lastOpnameStatus !== 'BELUM_DICEK').length;
    const sesuai = opnameAssets.filter((a) => a.lastOpnameStatus === 'SESUAI').length;
    const selisih = opnameAssets.filter(
      (a) =>
        a.lastOpnameStatus === 'SELISIH_TIDAK_ADA' ||
        a.lastOpnameStatus === 'KONDISI_BERUBAH'
    ).length;
    const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
    return { total, checked, sesuai, selisih, pct };
  }, [opnameAssets]);

  const handleDamageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!damageAssetId || !chronology.trim()) return;
    onCreateDamageReport({
      assetId: damageAssetId,
      reportedCondition: damageCondition,
      chronology: chronology.trim(),
      estimatedAction: estimatedAction.trim() || 'Menunggu pemeriksaan teknisi bengkel/Mako.',
    });
    setChronology('');
    setEstimatedAction('');
    setReportFormOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Header & Sub-tab Control */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4 no-print">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Pelaporan Kerusakan & Opname Fisik Tahunan
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Pencatatan insiden kerusakan barang lapangan dan verifikasi fisik aset untuk meminimalkan selisih audit
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('kerusakan')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'kerusakan'
                ? 'bg-white text-[#0B2545] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            Pelaporan Kerusakan ({damageReports.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('opname')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'opname'
                ? 'bg-white text-[#0B2545] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            Opname Fisik 2026
          </button>
        </div>
      </div>

      {activeTab === 'kerusakan' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-600">
              Setiap laporan kerusakan otomatis memperbarui status kondisi aset pada Kartu Inventaris Barang.
            </p>
            {roleProfile.permissions.canReportDamage && (
              <button
                type="button"
                onClick={() => setReportFormOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {reportFormOpen ? 'Tutup Form' : 'Lapor Kerusakan Barang'}
              </button>
            )}
          </div>

          {reportFormOpen && roleProfile.permissions.canReportDamage && (
            <form
              onSubmit={handleDamageSubmit}
              className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 text-xs"
            >
              <h3 className="font-display text-sm font-bold text-slate-900">
                Formulir Pelaporan Kerusakan Aset Lapangan / Kantor
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Aset / Barang yang Rusak
                  </label>
                  <select
                    value={damageAssetId}
                    onChange={(e) => setDamageAssetId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  >
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.id} · {a.namaBarang} ({locationMap.get(a.locationId)?.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Klasifikasi Tingkat Kerusakan
                  </label>
                  <select
                    value={damageCondition}
                    onChange={(e) =>
                      setDamageCondition(
                        e.target.value as Exclude<ConditionStatus, 'BAIK'>
                      )
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  >
                    <option value="RUSAK_RINGAN">
                      Rusak Ringan (Masih dapat diperbaiki / operasional terbatas)
                    </option>
                    <option value="RUSAK_BERAT">
                      Rusak Berat (Tidak layak operasi / usul penghapusan)
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kronologi & Gejala Kerusakan
                </label>
                <textarea
                  required
                  rows={2}
                  value={chronology}
                  onChange={(e) => setChronology(e.target.value)}
                  placeholder="Jelaskan kondisi komponen yang rusak dan kejadian saat operasional."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Rekomendasi Penanganan / Kebutuhan Suku Cadang
                </label>
                <input
                  type="text"
                  value={estimatedAction}
                  onChange={(e) => setEstimatedAction(e.target.value)}
                  placeholder="Contoh: Penggantian seal mekanikal pompa / servis bengkel rekanan"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReportFormOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-md cursor-pointer"
                >
                  Kirim Laporan Kerusakan
                </button>
              </div>
            </form>
          )}

          {/* Damage Report Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    <th className="py-3 px-4">Tiket & Tanggal</th>
                    <th className="py-3 px-4">Barang & Lokasi</th>
                    <th className="py-3 px-4">Kondisi Dilaporkan</th>
                    <th className="py-3 px-4">Kronologi & Rencana Tindakan</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Tindak Lanjut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {damageReports.map((d) => {
                    const asset = assetMap.get(d.assetId);
                    const loc = locationMap.get(d.locationId);
                    const statusMeta = DAMAGE_STATUS_META[d.status];
                    return (
                      <tr key={d.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 align-top whitespace-nowrap">
                          <div className="font-mono font-semibold text-slate-900 tabular-nums">
                            {d.ticketNumber}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                            {formatDateID(d.reportDate)}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {d.reportedBy}
                          </div>
                        </td>

                        <td className="py-3 px-4 align-top max-w-[200px]">
                          <div className="font-semibold text-slate-900 leading-snug">
                            {asset?.namaBarang ?? d.assetId}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {loc?.name ?? d.locationId}
                          </div>
                        </td>

                        <td className="py-3 px-4 align-top whitespace-nowrap">
                          <ConditionIndicator condition={d.reportedCondition} />
                        </td>

                        <td className="py-3 px-4 align-top max-w-sm">
                          <p className="text-slate-700 leading-relaxed">{d.chronology}</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Rencana: {d.estimatedAction}
                          </p>
                          {d.resolutionNote && (
                            <p className="text-[11px] text-emerald-700 mt-1 font-medium">
                              Penyelesaian: {d.resolutionNote}
                            </p>
                          )}
                        </td>

                        <td className="py-3 px-4 align-top whitespace-nowrap">
                          <span className={`font-semibold ${statusMeta.textClass}`}>
                            {statusMeta.label}
                          </span>
                        </td>

                        <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                          <div className="inline-flex flex-col items-end gap-1.5">
                            {isSuperAdmin &&
                            roleProfile.permissions.canResolveDamage &&
                            d.status !== 'SELESAI_DIPERBAIKI' ? (
                              <div className="inline-flex flex-wrap justify-end items-center gap-1.5">
                                {d.status === 'BARU_DILAPORKAN' && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateDamageStatus(d.id, 'DALAM_PENANGANAN')
                                    }
                                    className="px-2.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded cursor-pointer"
                                  >
                                    Proses Teknisi
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateDamageStatus(d.id, 'SELESAI_DIPERBAIKI')
                                  }
                                  className="px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded cursor-pointer"
                                >
                                  Selesai &amp; Pulihkan Baik
                                </button>
                                {d.status === 'DALAM_PENANGANAN' && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateDamageStatus(d.id, 'BARU_DILAPORKAN')
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded cursor-pointer"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    Batalkan
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="inline-flex flex-wrap justify-end items-center gap-2">
                                {!isSuperAdmin &&
                                roleProfile.permissions.canResolveDamage &&
                                d.status === 'BARU_DILAPORKAN' ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateDamageStatus(d.id, 'DALAM_PENANGANAN')
                                    }
                                    className="px-2.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded cursor-pointer"
                                  >
                                    Proses Teknisi
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-slate-400">
                                    {d.status === 'SELESAI_DIPERBAIKI'
                                      ? `Selesai ${formatDateID(d.resolvedDate ?? '')}`
                                      : 'Menunggu Super Admin'}
                                  </span>
                                )}
                                {isSuperAdmin &&
                                  d.status === 'SELESAI_DIPERBAIKI' &&
                                  roleProfile.permissions.canResolveDamage && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onUpdateDamageStatus(d.id, 'BARU_DILAPORKAN')
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded cursor-pointer"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      Batalkan
                                    </button>
                                  )}
                              </div>
                            )}

                            {isSuperAdmin && (
                              <div className="inline-flex flex-wrap justify-end items-center gap-1.5">
                                {onRequestMaintenanceForAsset &&
                                  d.status !== 'SELESAI_DIPERBAIKI' && (
                                    <button
                                      type="button"
                                      onClick={() => onRequestMaintenanceForAsset(d.assetId)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#0B2545] bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded cursor-pointer"
                                    >
                                      <Wrench className="w-3 h-3" />
                                      Ajukan Pemeliharaan (Nota Dinas)
                                    </button>
                                  )}
                                {d.status === 'BARU_DILAPORKAN' &&
                                  onCancelDamageReport && (
                                    <button
                                      type="button"
                                      onClick={() => onCancelDamageReport(d.id)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded cursor-pointer"
                                    >
                                      <XCircle className="w-3 h-3" />
                                      Batalkan Laporan
                                    </button>
                                  )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Opname Fisik Tahunan 2026 */
        <div className="space-y-4">
          {/* Opname Progress & Filter */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900">
                    Progres Cek Fisik Tahunan (Stock Opname BMD 2026)
                  </span>
                  <span className="font-mono font-bold text-[#0B2545] tabular-nums">
                    {opnameStats.checked} / {opnameStats.total} Terverifikasi ({opnameStats.pct}%)
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-[#0B2545] transition-all duration-300"
                    style={{ width: `${opnameStats.pct}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 tabular-nums">
                  {opnameStats.sesuai} Sesuai · {opnameStats.selisih} Selisih / Kondisi Berubah ·{' '}
                  {opnameStats.total - opnameStats.checked} Belum Dicek
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0 no-print">
                <select
                  value={effectiveOpnameLocFilter}
                  disabled={Boolean(lockedLocationId)}
                  onChange={(e) => setOpnameLocFilter(e.target.value)}
                  aria-label="Filter pos untuk opname"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-md bg-white disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed"
                >
                  {!lockedLocationId && (
                    <option value="ALL">Semua Lokasi ({assets.length})</option>
                  )}
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} · {l.name}
                    </option>
                  ))}
                </select>
                {roleProfile.permissions.canExportReport && (
                  <>
                    <a
                      href={BAST_INVENTARIS_META.csvAssetUrl}
                      download={BAST_INVENTARIS_META.csvDownloadFilename}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0B2545] bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-md"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Unduh CSV BAST Pengecekan
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        exportAssetsToCSV(
                          opnameAssets,
                          locations,
                          'berita-acara-opname-bpbd-2026.csv'
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Unduh BA Opname
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Cetak Kertas Kerja
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Checklist Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    <th className="py-3 px-4">Register KIB</th>
                    <th className="py-3 px-4">Nama Barang & Lokasi</th>
                    <th className="py-3 px-4">Kondisi Tercatat</th>
                    <th className="py-3 px-4">Status Opname 2026</th>
                    {roleProfile.id === 'SUPER_ADMIN' &&
                      roleProfile.permissions.canPerformOpname && (
                        <th className="py-3 px-4 text-right no-print">Verifikasi Fisik</th>
                      )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {opnameAssets.map((a) => {
                    const loc = locationMap.get(a.locationId);
                    const opMeta = OPNAME_STATUS_META[a.lastOpnameStatus];
                    const canVerifyOpname =
                      roleProfile.id === 'SUPER_ADMIN' &&
                      roleProfile.permissions.canPerformOpname;
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 align-top whitespace-nowrap">
                          <div className="font-mono font-semibold text-[#0B2545] tabular-nums">
                            {a.id} · KIB {a.kibType}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                            {a.kodeBarang}
                          </div>
                        </td>

                        <td className="py-3 px-4 align-top">
                          <div className="font-semibold text-slate-900">{a.namaBarang}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {loc?.name ?? a.locationId} · PJ: {a.penanggungJawab}
                          </div>
                        </td>

                        <td className="py-3 px-4 align-top whitespace-nowrap">
                          <ConditionIndicator condition={a.kondisi} />
                        </td>

                        <td className="py-3 px-4 align-top whitespace-nowrap">
                          <span className={`font-semibold ${opMeta.textClass}`}>
                            {opMeta.label}
                          </span>
                          <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                            Cek: {formatDateID(a.lastOpnameDate)}
                          </div>
                        </td>

                        {canVerifyOpname && (
                          <td className="py-3 px-4 align-top text-right whitespace-nowrap no-print">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateOpnameCheck(
                                    a.id,
                                    'SESUAI',
                                    'BAIK',
                                    `Opname fisik sesuai oleh ${roleProfile.officerName}.`
                                  )
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Sesuai
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateOpnameCheck(
                                    a.id,
                                    'KONDISI_BERUBAH',
                                    'RUSAK_RINGAN',
                                    `Ditemukan perubahan kondisi saat opname.`
                                  )
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded cursor-pointer"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Berubah
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateOpnameCheck(
                                    a.id,
                                    'SELISIH_TIDAK_ADA',
                                    a.kondisi,
                                    `Barang tidak ditemukan di lokasi saat opname.`
                                  )
                                }
                                className="px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded cursor-pointer"
                              >
                                Selisih
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Susunan Tim Inventaris BMD 2026 & Lembar Pengesahan BAST */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Tim Inventaris Barang Milik Daerah BPBD Kabupaten Sidoarjo Tahun 2026
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Referensi BAST KIB B Tahun {BAST_INVENTARIS_META.tahunRekap} ({BAST_INVENTARIS_META.totalRegisterKibB} Register · {formatIDR(BAST_INVENTARIS_META.totalNilaiPerolehanKibB)})
                </p>
              </div>
              <a
                href={BAST_INVENTARIS_META.csvAssetUrl}
                download={BAST_INVENTARIS_META.csvDownloadFilename}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B2545] hover:underline no-print"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh Lampiran BAST CSV
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {TIM_INVENTARIS_2026.map((member) => (
                <div
                  key={member.no}
                  className="p-3.5 rounded-md border border-slate-200 bg-slate-50/70 space-y-1"
                >
                  <p className="text-[11px] font-semibold text-[#0B2545]">
                    {member.no}. {member.keterangan}
                  </p>
                  <p className="font-bold text-slate-900">{member.nama}</p>
                  <p className="font-mono text-[11px] text-slate-600 tabular-nums">
                    NIP {member.nip}
                  </p>
                  <p className="text-[11px] text-slate-500">{member.jabatan}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
