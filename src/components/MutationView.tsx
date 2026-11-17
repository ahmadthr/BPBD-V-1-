import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  AssetItem,
  AssetMutation,
  LocationUnit,
  MutationStatus,
  RoleProfile,
} from '../types/simas';
import { MUTATION_STATUS_META, formatDateID } from '../utils/formatters';

interface MutationViewProps {
  assets: AssetItem[];
  locations: LocationUnit[];
  mutations: AssetMutation[];
  roleProfile: RoleProfile;
  preselectedAssetId?: string;
  onCreateMutation: (payload: {
    assetId: string;
    toLocationId: string;
    reason: string;
  }) => void;
  onApproveByKasubag: (mutationId: string, approved: boolean, note: string) => void;
  onVerifyByPengurus: (mutationId: string) => void;
}

export const MutationView: React.FC<MutationViewProps> = ({
  assets,
  locations,
  mutations,
  roleProfile,
  preselectedAssetId = '',
  onCreateMutation,
  onApproveByKasubag,
  onVerifyByPengurus,
}) => {
  const [statusFilter, setStatusFilter] = useState<MutationStatus | 'ALL'>('ALL');
  const [formOpen, setFormOpen] = useState<boolean>(Boolean(preselectedAssetId));
  const [selectedAssetId, setSelectedAssetId] = useState<string>(
    preselectedAssetId || assets[0]?.id || ''
  );
  const [toLocationId, setToLocationId] = useState<string>('LOC-POS-01');
  const [reason, setReason] = useState<string>('');

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const locationMap = useMemo(
    () => new Map(locations.map((l) => [l.id, l])),
    [locations]
  );

  const selectedAsset = assetMap.get(selectedAssetId);

  const filteredMutations = useMemo(() => {
    if (statusFilter === 'ALL') return mutations;
    return mutations.filter((m) => m.status === statusFilter);
  }, [mutations, statusFilter]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId || !toLocationId || !reason.trim()) return;
    if (selectedAsset && selectedAsset.locationId === toLocationId) return;
    onCreateMutation({
      assetId: selectedAssetId,
      toLocationId,
      reason: reason.trim(),
    });
    setReason('');
    setFormOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Mutasi & Perpindahan Lokasi Aset
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Pencatatan perpindahan barang antar bidang Mako dan 7 Pos Damkar dengan persetujuan berjenjang
          </p>
        </div>

        {roleProfile.permissions.canRequestMutation && (
          <button
            type="button"
            onClick={() => setFormOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {formOpen ? 'Tutup Formulir' : 'Ajukan Mutasi Baru'}
          </button>
        )}
      </div>

      {/* Create Mutation Form Panel */}
      {formOpen && roleProfile.permissions.canRequestMutation && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 text-xs"
        >
          <h3 className="font-display text-sm font-bold text-slate-900">
            Formulir Usulan Mutasi / Relokasi Barang Milik Daerah
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Pilih Barang / Register KIB
              </label>
              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id} · {a.namaBarang}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Lokasi Asal (Saat Ini)
              </label>
              <input
                type="text"
                readOnly
                value={
                  selectedAsset
                    ? locationMap.get(selectedAsset.locationId)?.name ??
                      selectedAsset.locationId
                    : '-'
                }
                className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-md text-slate-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Lokasi Tujuan Mutasi
              </label>
              <select
                value={toLocationId}
                onChange={(e) => setToLocationId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              >
                {locations
                  .filter((l) => l.id !== selectedAsset?.locationId)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} · {l.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Alasan / Dasar Kebutuhan Operasional Mutasi
            </label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Penguatan armada siaga kekeringan atau penarikan peralatan untuk perbaikan di Mako."
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 font-semibold text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md cursor-pointer"
            >
              Kirim Pengajuan Mutasi
            </button>
          </div>
        </form>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
        {(
          [
            { key: 'ALL', label: 'Semua Berkas' },
            { key: 'MENUNGGU_KASUBAG', label: 'Menunggu Kasubag' },
            { key: 'DISETUJUI_KASUBAG', label: 'Siap Verifikasi Fisik' },
            { key: 'SELESAI_VERIFIKASI', label: 'Selesai' },
            { key: 'DITOLAK', label: 'Ditolak' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatusFilter(t.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              statusFilter === t.key
                ? 'bg-white text-[#0B2545] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Mutation Records Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {filteredMutations.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            Belum ada berkas mutasi pada status ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4">No. BA & Tanggal</th>
                  <th className="py-3 px-4">Barang / Aset</th>
                  <th className="py-3 px-4">Perpindahan Lokasi</th>
                  <th className="py-3 px-4">Pemohon & Alasan</th>
                  <th className="py-3 px-4">Status Workflow</th>
                  <th className="py-3 px-4 text-right">Tindakan RBAC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredMutations.map((m) => {
                  const asset = assetMap.get(m.assetId);
                  const fromLoc = locationMap.get(m.fromLocationId);
                  const toLoc = locationMap.get(m.toLocationId);
                  const statusMeta = MUTATION_STATUS_META[m.status];

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <div className="font-mono font-semibold text-slate-900 tabular-nums">
                          {m.nomorSurat}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                          {formatDateID(m.requestDate)}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top max-w-[210px]">
                        <div className="font-semibold text-slate-900 leading-snug">
                          {asset?.namaBarang ?? m.assetId}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                          {m.assetId} · KIB {asset?.kibType ?? '-'}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top">
                        <div className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                          <span>{fromLoc?.code ?? m.fromLocationId}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-[#0B2545] font-semibold">
                            {toLoc?.code ?? m.toLocationId}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Ke: {toLoc?.name ?? m.toLocationId}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top max-w-xs">
                        <div className="font-medium text-slate-800">{m.requestedBy}</div>
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                          {m.reason}
                        </p>
                        {m.reviewNote && (
                          <p className="text-[11px] text-slate-500 italic mt-1">
                            Catatan Kasubag: {m.reviewNote}
                          </p>
                        )}
                      </td>

                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <span className={`font-semibold ${statusMeta.textClass}`}>
                          {statusMeta.label}
                        </span>
                        {m.reviewedBy && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Oleh: {m.reviewedBy}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                        {m.status === 'MENUNGGU_KASUBAG' &&
                        roleProfile.permissions.canApproveMutation ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                onApproveByKasubag(
                                  m.id,
                                  true,
                                  'Disetujui sesuai kebutuhan operasional pos.'
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Setujui
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onApproveByKasubag(
                                  m.id,
                                  false,
                                  'Ditunda menunggu evaluasi stok armada.'
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 border border-red-300 hover:bg-red-50 rounded cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              Tolak
                            </button>
                          </div>
                        ) : m.status === 'DISETUJUI_KASUBAG' &&
                          roleProfile.permissions.canVerifyMutation ? (
                          <button
                            type="button"
                            onClick={() => onVerifyByPengurus(m.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Verifikasi & Pindah KIB
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            {m.status === 'MENUNGGU_KASUBAG'
                              ? 'Perlu Akses Kasubag'
                              : m.status === 'DISETUJUI_KASUBAG'
                                ? 'Perlu Pengurus Barang'
                                : 'Arsip Tercatat'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
