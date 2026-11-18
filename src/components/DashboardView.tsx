import React from 'react';
import {
  ArrowRight,
  Building2,
  Download,
  FileSpreadsheet,
  Flame,
  MapPin,
  Printer,
  Users,
} from 'lucide-react';
import { BAST_INVENTARIS_META, TIM_INVENTARIS_2026 } from '../data/initialData';
import {
  AssetItem,
  AssetMutation,
  DamageReport,
  KibCategory,
  LocationUnit,
  ModuleKey,
  RoleProfile,
} from '../types/simas';
import {
  CONDITION_META,
  KIB_META,
  exportAssetsToCSV,
  formatCompactIDR,
  formatDateID,
  formatIDR,
} from '../utils/formatters';
import { ConditionIndicator } from './StatusText';

interface DashboardViewProps {
  assets: AssetItem[];
  locations: LocationUnit[];
  mutations: AssetMutation[];
  damageReports: DamageReport[];
  roleProfile: RoleProfile;
  onNavigateModule: (mod: ModuleKey) => void;
  onFilterKibByLocation: (locationId: string) => void;
  onFilterKibByCategory: (kib: KibCategory) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  assets,
  locations,
  mutations,
  damageReports,
  roleProfile,
  onNavigateModule,
  onFilterKibByLocation,
  onFilterKibByCategory,
}) => {
  const totalItems = assets.length;
  const totalUnits = assets.reduce((sum, a) => sum + a.jumlahUnit, 0);
  const totalValue = assets.reduce((sum, a) => sum + a.nilaiPerolehan, 0);

  const countBaik = assets.filter((a) => a.kondisi === 'BAIK').length;
  const countRingan = assets.filter((a) => a.kondisi === 'RUSAK_RINGAN').length;
  const countBerat = assets.filter((a) => a.kondisi === 'RUSAK_BERAT').length;

  const pctBaik = totalItems > 0 ? Math.round((countBaik / totalItems) * 100) : 0;
  const pctRingan = totalItems > 0 ? Math.round((countRingan / totalItems) * 100) : 0;
  const pctBerat = totalItems > 0 ? Math.max(0, 100 - pctBaik - pctRingan) : 0;

  const pendingMutations = mutations.filter(
    (m) => m.status === 'MENUNGGU_KASUBAG' || m.status === 'DISETUJUI_KASUBAG'
  );
  const activeDamages = damageReports.filter(
    (d) => d.status !== 'SELESAI_DIPERBAIKI'
  );

  // Donut chart geometry (SVG stroke-dasharray on radius 44, circumference ≈ 276.46)
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const lenBaik = totalItems > 0 ? (countBaik / totalItems) * circumference : 0;
  const lenRingan = totalItems > 0 ? (countRingan / totalItems) * circumference : 0;
  const lenBerat = totalItems > 0 ? (countBerat / totalItems) * circumference : 0;

  // KIB summary A-F
  const kibCategories: KibCategory[] = ['A', 'B', 'C', 'D', 'E', 'F'];
  const kibSummary = kibCategories.map((cat) => {
    const items = assets.filter((a) => a.kibType === cat);
    const value = items.reduce((s, a) => s + a.nilaiPerolehan, 0);
    return {
      cat,
      name: KIB_META[cat].name,
      count: items.length,
      value,
      sharePct: totalValue > 0 ? (value / totalValue) * 100 : 0,
    };
  });

  // Pos & Mako summary
  const locationSummaries = locations.map((loc) => {
    const locAssets = assets.filter((a) => a.locationId === loc.id);
    const value = locAssets.reduce((s, a) => s + a.nilaiPerolehan, 0);
    const baik = locAssets.filter((a) => a.kondisi === 'BAIK').length;
    const issue = locAssets.length - baik;
    return { loc, count: locAssets.length, value, baik, issue };
  });

  const firePostsCount = locations.filter((l) => l.isFirePost).length;

  return (
    <div className="space-y-6">
      {/* Executive Role Context Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Ringkasan Inventarisasi BMD · BPBD Kab. Sidoarjo
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Pemantauan kondisi aset real-time pada Mako BPBD dan {firePostsCount} Pos Damkar / Lapangan · Peran aktif:{' '}
            <span className="font-semibold text-[#0B2545]">{roleProfile.label}</span>
          </p>
        </div>
        {roleProfile.permissions.canExportReport && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 no-print">
            <a
              href={BAST_INVENTARIS_META.csvAssetUrl}
              download={BAST_INVENTARIS_META.csvDownloadFilename}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#0B2545] bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Unduh CSV BAST Pengecekan
            </a>
            <button
              type="button"
              onClick={() => exportAssetsToCSV(assets, locations, 'rekap-aset-bpbd-sidoarjo-2026.csv')}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Ekspor Rekap CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Laporan
            </button>
          </div>
        )}
      </div>

      {roleProfile.assignedLocationId && (
        <div className="px-4 py-3 rounded-md bg-amber-50 border border-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-amber-950">
            <strong className="font-semibold">
              Akun Khusus Pos Aktif:{' '}
              {locations.find((l) => l.id === roleProfile.assignedLocationId)?.name ??
                roleProfile.assignedLocationId}
            </strong>
            <span className="mx-1.5 text-amber-400">·</span>
            <span>
              Penanggung Jawab: {roleProfile.officerName}. Data KIB, Kendaraan &amp; KIR difokuskan ke pos penugasan Anda.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onFilterKibByLocation(roleProfile.assignedLocationId!)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
          >
            Buka Inventaris Pos Ini
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-medium text-slate-500">Total Nilai Perolehan BMD</p>
          <p className="font-display text-2xl font-bold text-slate-900 mt-2 tabular-nums">
            {formatCompactIDR(totalValue)}
          </p>
          <p className="font-mono text-xs text-slate-500 mt-1 tabular-nums">
            {formatIDR(totalValue)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-medium text-slate-500">Item & Unit Aset Tercatat</p>
          <p className="font-display text-2xl font-bold text-slate-900 mt-2 tabular-nums">
            {totalItems} <span className="text-base font-medium text-slate-500">Register</span>
          </p>
          <p className="text-xs text-slate-600 mt-1 tabular-nums">
            Total fisik {totalUnits} unit/bidang di KIB A–F
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-medium text-slate-500">Kesiapan Kondisi Baik</p>
          <p className="font-display text-2xl font-bold text-emerald-700 mt-2 tabular-nums">
            {pctBaik}%
          </p>
          <p className="text-xs text-slate-600 mt-1 tabular-nums">
            {countBaik} Baik · {countRingan} Rusak Ringan · {countBerat} Rusak Berat
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-medium text-slate-500">Antrean Mutasi & Perbaikan</p>
          <p className="font-display text-2xl font-bold text-[#0B2545] mt-2 tabular-nums">
            {pendingMutations.length + activeDamages.length}{' '}
            <span className="text-base font-medium text-slate-500">Berkas</span>
          </p>
          <p className="text-xs text-slate-600 mt-1 tabular-nums">
            {pendingMutations.length} mutasi aktif · {activeDamages.length} laporan kerusakan
          </p>
        </div>
      </div>

      {/* Middle Section: Condition Distribution + KIB Valuation Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Condition Distribution Chart */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900">
              Distribusi Kondisi Barang
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Status kelayakan operasional seluruh register KIB A–F
            </p>
          </div>

          <div className="my-6 flex flex-col sm:flex-row items-center gap-6">
            <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 112 112" className="w-full h-full -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r={radius}
                  fill="none"
                  stroke="#F1F5F9"
                  strokeWidth="14"
                />
                {lenBaik > 0 && (
                  <circle
                    cx="56"
                    cy="56"
                    r={radius}
                    fill="none"
                    stroke="#16A34A"
                    strokeWidth="14"
                    strokeDasharray={`${lenBaik} ${circumference}`}
                    strokeDashoffset={0}
                  />
                )}
                {lenRingan > 0 && (
                  <circle
                    cx="56"
                    cy="56"
                    r={radius}
                    fill="none"
                    stroke="#D97706"
                    strokeWidth="14"
                    strokeDasharray={`${lenRingan} ${circumference}`}
                    strokeDashoffset={-lenBaik}
                  />
                )}
                {lenBerat > 0 && (
                  <circle
                    cx="56"
                    cy="56"
                    r={radius}
                    fill="none"
                    stroke="#DC2626"
                    strokeWidth="14"
                    strokeDasharray={`${lenBerat} ${circumference}`}
                    strokeDashoffset={-(lenBaik + lenRingan)}
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-display text-xl font-bold text-slate-900 tabular-nums">
                  {totalItems}
                </span>
                <span className="text-[11px] text-slate-500">Total Item</span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-3">
              {[
                { key: 'BAIK' as const, count: countBaik, pct: pctBaik },
                { key: 'RUSAK_RINGAN' as const, count: countRingan, pct: pctRingan },
                { key: 'RUSAK_BERAT' as const, count: countBerat, pct: pctBerat },
              ].map((row) => {
                const meta = CONDITION_META[row.key];
                return (
                  <div key={row.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <ConditionIndicator condition={row.key} />
                      <span className="font-mono font-semibold text-slate-800 tabular-nums">
                        {row.count} ({row.pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-sm overflow-hidden">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${row.pct}%`,
                          backgroundColor: meta.barColor,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Aset perlu atensi segera (RR/RB)</span>
            <button
              type="button"
              onClick={() => onNavigateModule('opname_laporan')}
              className="font-semibold text-[#0B2545] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              {countRingan + countBerat} item · Lihat Pelaporan
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* KIB A-F Rekapitulasi Nilai */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                Rekapitulasi Nilai Aset per Golongan KIB (A–F)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Klik golongan KIB untuk memfilter daftar inventaris terpusat
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateModule('kib')}
              className="text-xs font-semibold text-[#0B2545] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Buka Master KIB
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 pr-3">Golongan</th>
                  <th className="py-2.5 px-3 text-right">Item</th>
                  <th className="py-2.5 px-3 text-right">Nilai Perolehan</th>
                  <th className="py-2.5 pl-3 w-32">Proporsi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {kibSummary.map((row) => (
                  <tr
                    key={row.cat}
                    onClick={() => onFilterKibByCategory(row.cat)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 pr-3">
                      <span className="font-semibold text-slate-900">KIB {row.cat}</span>
                      <span className="text-slate-400 mx-1.5">·</span>
                      <span className="text-slate-600">{row.name}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                      {row.count}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                      {formatIDR(row.value)}
                    </td>
                    <td className="py-2.5 pl-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-sm overflow-hidden">
                          <div
                            className="h-full bg-[#17467E]"
                            style={{ width: `${Math.max(row.sharePct, row.count > 0 ? 4 : 0)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-slate-500 tabular-nums w-9 text-right">
                          {row.sharePct.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Placement Grid: Mako & 7 Pos Damkar Sidoarjo */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-200">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900">
              Sebaran Penempatan Aset · Mako & 7 Pos Damkar / Lapangan
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Klik unit kerja atau pos untuk melihat daftar barang dan penanggung jawab di lokasi tersebut
            </p>
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            {locations.length} Titik Penempatan Aktif
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {locationSummaries.map(({ loc, count, value, baik, issue }) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => onFilterKibByLocation(loc.id)}
              className="text-left p-4 rounded-md border border-slate-200 hover:border-[#0B2545] hover:bg-slate-50/70 transition-colors flex flex-col justify-between gap-3 cursor-pointer"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold text-[#0B2545]">
                    {loc.code}
                  </span>
                  {loc.isFirePost ? (
                    <Flame className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
                  ) : (
                    <Building2 className="w-3.5 h-3.5 text-[#0B2545] shrink-0" aria-hidden="true" />
                  )}
                </div>
                <p className="font-display text-sm font-bold text-slate-900 leading-snug">
                  {loc.name}
                </p>
                <p className="text-[11px] text-slate-500 flex items-start gap-1">
                  <MapPin className="w-3 h-3 shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="line-clamp-1">{loc.address}</span>
                </p>
              </div>

              <div className="pt-2.5 border-t border-slate-100 flex items-end justify-between gap-2">
                <div>
                  <p className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                    {count} Register
                  </p>
                  <p className="text-[11px] text-slate-500 tabular-nums">
                    {formatCompactIDR(value)}
                  </p>
                </div>
                <div className="text-right text-[11px] tabular-nums">
                  <span className="text-emerald-700 font-medium">{baik} Baik</span>
                  {issue > 0 && (
                    <span className="block text-amber-700 font-medium">
                      {issue} Perlu Cek
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Split: Pending Approvals & Active Damage Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="font-display text-sm font-bold text-slate-900">
              Antrean Persetujuan & Verifikasi Mutasi
            </h3>
            <button
              type="button"
              onClick={() => onNavigateModule('mutasi')}
              className="text-xs font-semibold text-[#0B2545] hover:underline cursor-pointer"
            >
              Kelola Mutasi
            </button>
          </div>
          {pendingMutations.length === 0 ? (
            <p className="py-6 text-xs text-slate-500 text-center">
              Seluruh pengajuan mutasi barang telah selesai diproses.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingMutations.slice(0, 4).map((m) => {
                const asset = assets.find((a) => a.id === m.assetId);
                const fromLoc = locations.find((l) => l.id === m.fromLocationId);
                const toLoc = locations.find((l) => l.id === m.toLocationId);
                return (
                  <div key={m.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {asset?.namaBarang ?? m.assetId}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {fromLoc?.code ?? m.fromLocationId} → {toLoc?.code ?? m.toLocationId} ·{' '}
                        {formatDateID(m.requestDate)}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] font-medium text-amber-700 shrink-0">
                      {m.status === 'MENUNGGU_KASUBAG' ? 'Menunggu Kasubag' : 'Verifikasi'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="font-display text-sm font-bold text-slate-900">
              Laporan Kerusakan Aktif Lapangan
            </h3>
            <button
              type="button"
              onClick={() => onNavigateModule('opname_laporan')}
              className="text-xs font-semibold text-[#0B2545] hover:underline cursor-pointer"
            >
              Tindak Lanjut
            </button>
          </div>
          {activeDamages.length === 0 ? (
            <p className="py-6 text-xs text-slate-500 text-center">
              Tidak ada laporan kerusakan barang aktif saat ini.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {activeDamages.slice(0, 4).map((d) => {
                const asset = assets.find((a) => a.id === d.assetId);
                const loc = locations.find((l) => l.id === d.locationId);
                return (
                  <div key={d.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {asset?.namaBarang ?? d.assetId}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {loc?.name ?? d.locationId} · Pelapor: {d.reportedBy}
                      </p>
                    </div>
                    <ConditionIndicator condition={d.reportedCondition} compact />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dokumen Resmi BAST Pengecekan Inventaris & Susunan Tim Inventaris BMD 2026 */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#0B2545]" aria-hidden="true" />
              Tim Inventaris BMD Tahun {BAST_INVENTARIS_META.tahunTim} &amp; Dokumen BAST Pengecekan
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {BAST_INVENTARIS_META.judul} · Kode OPD {BAST_INVENTARIS_META.kodeOpd} ·{' '}
              {BAST_INVENTARIS_META.totalRegisterKibB} Register ({formatIDR(BAST_INVENTARIS_META.totalNilaiPerolehanKibB)})
            </p>
          </div>
          <a
            href={BAST_INVENTARIS_META.csvAssetUrl}
            download={BAST_INVENTARIS_META.csvDownloadFilename}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            Unduh BAST Pengecekan Inventaris (CSV)
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                <th className="py-2.5 px-4 w-12 text-center">No</th>
                <th className="py-2.5 px-4">Nama &amp; NIP</th>
                <th className="py-2.5 px-4">Jabatan</th>
                <th className="py-2.5 px-4">Keterangan / Peran BMD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {TIM_INVENTARIS_2026.map((m) => (
                <tr key={m.no} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-4 text-center font-mono text-slate-500 tabular-nums">
                    {m.no}
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="font-semibold text-slate-900">{m.nama}</div>
                    <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                      NIP {m.nip}
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-slate-700">{m.jabatan}</td>
                  <td className="py-2.5 px-4 font-semibold text-[#0B2545]">{m.keterangan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
