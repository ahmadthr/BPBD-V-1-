import React, { useMemo, useState } from 'react';
import {
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  Plus,
  Printer,
  QrCode,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  AssetItem,
  ConditionStatus,
  KibCategory,
  LocationUnit,
  RoleProfile,
} from '../types/simas';
import {
  KIB_FIELD_ALIASES,
  KIB_FIELD_DEFINITIONS,
  downloadKibExcelTemplate,
  exportWorkbookXlsx,
  mapRowsToKibAssets,
} from '../utils/excelImportHelper';
import {
  KIB_META,
  OPNAME_STATUS_META,
  exportAssetsToCSV,
  formatDateID,
  formatIDR,
} from '../utils/formatters';
import { ExcelImportModal } from './ExcelImportModal';
import {
  ItemPhotoControl,
  ItemPhotoThumbnail,
  PhotoLightboxData,
  PhotoLightboxModal,
} from './ItemPhotoControl';
import { PrintableQrSticker } from './QrCodeCanvas';
import { ConditionIndicator } from './StatusText';

interface KibManagementViewProps {
  assets: AssetItem[];
  locations: LocationUnit[];
  roleProfile: RoleProfile;
  initialKibFilter?: KibCategory | 'ALL';
  initialLocationFilter?: string;
  onAddAsset: (asset: Omit<AssetItem, 'id' | 'qrPayload'>) => void;
  onImportAssets?: (assets: Omit<AssetItem, 'id' | 'qrPayload'>[]) => void;
  onUpdateAsset: (asset: AssetItem) => void;
  onDeleteAsset: (assetId: string) => void;
  onQuickNavigateToMutation: (assetId: string) => void;
  onQuickNavigateToDamage: (assetId: string) => void;
  onOpenPublicProfile?: (kode: string, register: string) => void;
}

const KIB_TABS: { key: KibCategory | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Semua KIB' },
  { key: 'A', label: 'KIB A · Tanah' },
  { key: 'B', label: 'KIB B · Peralatan & Mesin' },
  { key: 'C', label: 'KIB C · Gedung' },
  { key: 'D', label: 'KIB D · Jaringan' },
  { key: 'E', label: 'KIB E · Aset Lain' },
  { key: 'F', label: 'KIB F · Konstruksi' },
];

const EMPTY_FORM: Omit<AssetItem, 'id' | 'qrPayload'> = {
  kibType: 'B',
  kodeBarang: '1.3.2.02.01.06.004',
  nomorRegister: '0001',
  namaBarang: '',
  merkTipe: '',
  spesifikasi: '',
  tahunPerolehan: 2026,
  asalPerolehan: 'APBD Kab. Sidoarjo',
  jumlahUnit: 1,
  satuan: 'Unit',
  nilaiPerolehan: 0,
  kondisi: 'BAIK',
  locationId: 'LOC-MAKO',
  penanggungJawab: '',
  nomorPolisiOrSertifikat: '',
  lastOpnameDate: new Date().toISOString().slice(0, 10),
  lastOpnameStatus: 'SESUAI',
  keterangan: '',
  fotoDataUrl: undefined,
  fotoNamaFile: undefined,
};

export const KibManagementView: React.FC<KibManagementViewProps> = ({
  assets,
  locations,
  roleProfile,
  initialKibFilter = 'ALL',
  initialLocationFilter = 'ALL',
  onAddAsset,
  onImportAssets,
  onUpdateAsset,
  onDeleteAsset,
  onQuickNavigateToMutation,
  onQuickNavigateToDamage,
  onOpenPublicProfile,
}) => {
  const lockedLocationId = roleProfile.assignedLocationId || '';
  const [kibFilter, setKibFilter] = useState<KibCategory | 'ALL'>(initialKibFilter);
  const [locationFilter, setLocationFilter] = useState<string>(
    lockedLocationId || (initialLocationFilter !== 'ALL' ? initialLocationFilter : 'ALL')
  );
  const [conditionFilter, setConditionFilter] = useState<ConditionStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);
  const [qrAsset, setQrAsset] = useState<AssetItem | null>(null);
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [editingAsset, setEditingAsset] = useState<AssetItem | null>(null);
  const [formData, setFormData] = useState<Omit<AssetItem, 'id' | 'qrPayload'>>(EMPTY_FORM);
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoLightboxData | null>(null);
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false);
  const [importDefaultLoc, setImportDefaultLoc] = useState<string>(
    roleProfile.assignedLocationId || 'LOC-MAKO'
  );

  const locationMap = useMemo(
    () => new Map(locations.map((l) => [l.id, l])),
    [locations]
  );

  const effectiveLocationFilter = lockedLocationId || locationFilter;

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return assets.filter((a) => {
      if (kibFilter !== 'ALL' && a.kibType !== kibFilter) return false;
      if (effectiveLocationFilter !== 'ALL' && a.locationId !== effectiveLocationFilter) return false;
      if (conditionFilter !== 'ALL' && a.kondisi !== conditionFilter) return false;
      if (!q) return true;
      const locName = locationMap.get(a.locationId)?.name.toLowerCase() ?? '';
      return (
        a.id.toLowerCase().includes(q) ||
        a.namaBarang.toLowerCase().includes(q) ||
        a.kodeBarang.toLowerCase().includes(q) ||
        a.merkTipe.toLowerCase().includes(q) ||
        a.penanggungJawab.toLowerCase().includes(q) ||
        a.nomorPolisiOrSertifikat.toLowerCase().includes(q) ||
        locName.includes(q)
      );
    });
  }, [assets, kibFilter, effectiveLocationFilter, conditionFilter, searchQuery, locationMap]);

  const filteredTotalValue = useMemo(
    () => filteredAssets.reduce((sum, a) => sum + a.nilaiPerolehan, 0),
    [filteredAssets]
  );

  const openCreateModal = () => {
    setEditingAsset(null);
    setFormData({
      ...EMPTY_FORM,
      kibType: kibFilter === 'ALL' ? 'B' : kibFilter,
      locationId: locationFilter === 'ALL' ? 'LOC-MAKO' : locationFilter,
    });
    setFormOpen(true);
  };

  const openEditModal = (asset: AssetItem) => {
    setEditingAsset(asset);
    const { id: _id, qrPayload: _qr, ...rest } = asset;
    setFormData(rest);
    setFormOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.namaBarang.trim()) return;
    if (editingAsset) {
      onUpdateAsset({
        ...editingAsset,
        ...formData,
      });
    } else {
      onAddAsset(formData);
    }
    setFormOpen(false);
    setEditingAsset(null);
  };

  return (
    <div className="space-y-5">
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Kartu Inventaris Barang (KIB A–F) Terpusat
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            {kibFilter === 'ALL'
              ? 'Seluruh golongan Barang Milik Daerah BPBD Kabupaten Sidoarjo'
              : `${KIB_META[kibFilter].fullName} — ${KIB_META[kibFilter].description}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 no-print">
          {roleProfile.permissions.canExportReport && (
            <>
              <button
                type="button"
                onClick={() =>
                  exportWorkbookXlsx(
                    `KIB_${kibFilter}`,
                    [
                      'ID Aset',
                      'Golongan KIB',
                      'Kode Barang',
                      'Nomor Register',
                      'Nama Barang',
                      'Merk / Tipe',
                      'Spesifikasi',
                      'Tahun Perolehan',
                      'Asal Perolehan',
                      'Jumlah',
                      'Satuan',
                      'Nilai Perolehan',
                      'Kondisi',
                      'Lokasi Penempatan',
                      'Penanggung Jawab',
                      'No. Polisi / Sertifikat',
                      'Keterangan',
                    ],
                    filteredAssets.map((a) => [
                      a.id,
                      a.kibType,
                      a.kodeBarang,
                      a.nomorRegister,
                      a.namaBarang,
                      a.merkTipe,
                      a.spesifikasi,
                      a.tahunPerolehan,
                      a.asalPerolehan,
                      a.jumlahUnit,
                      a.satuan,
                      a.nilaiPerolehan,
                      a.kondisi,
                      locationMap.get(a.locationId)?.name ?? a.locationId,
                      a.penanggungJawab,
                      a.nomorPolisiOrSertifikat,
                      a.keterangan,
                    ]),
                    `kib-${kibFilter.toLowerCase()}-bpbd-sidoarjo.xlsx`
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0B2545] bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                Ekspor Excel
              </button>
              <button
                type="button"
                onClick={() =>
                  exportAssetsToCSV(
                    filteredAssets,
                    locations,
                    `kib-${kibFilter.toLowerCase()}-bpbd-sidoarjo.csv`
                  )
                }
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Ekspor CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak KIB
              </button>
            </>
          )}
          {roleProfile.id === 'SUPER_ADMIN' && (
            <button
              type="button"
              onClick={() => setImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0B2545] bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Import Excel
            </button>
          )}
          {roleProfile.permissions.canCreateAsset && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Input Perolehan Aset
            </button>
          )}
        </div>
      </div>

      {/* Segmented KIB Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto no-print">
        {KIB_TABS.map((tab) => {
          const isActive = kibFilter === tab.key;
          const count =
            tab.key === 'ALL'
              ? assets.length
              : assets.filter((a) => a.kibType === tab.key).length;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setKibFilter(tab.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-white text-[#0B2545] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 no-print">
        <div className="md:col-span-5 relative">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama barang, kode Permendagri, no. polisi/sertifikat..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0B2545]"
          />
        </div>

        <div className="md:col-span-4">
          <select
            value={effectiveLocationFilter}
            disabled={Boolean(lockedLocationId)}
            onChange={(e) => setLocationFilter(e.target.value)}
            aria-label="Filter lokasi penempatan"
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0B2545] cursor-pointer disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed"
          >
            {!lockedLocationId && (
              <option value="ALL">Semua Lokasi (Mako &amp; 7 Pos Damkar)</option>
            )}
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.code} · {loc.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value as ConditionStatus | 'ALL')}
            aria-label="Filter kondisi barang"
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0B2545] cursor-pointer"
          >
            <option value="ALL">Semua Kondisi Barang</option>
            <option value="BAIK">Baik</option>
            <option value="RUSAK_RINGAN">Rusak Ringan</option>
            <option value="RUSAK_BERAT">Rusak Berat</option>
          </select>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 px-1">
        <span className="tabular-nums">
          Menampilkan <strong className="text-slate-900">{filteredAssets.length}</strong> dari{' '}
          {assets.length} register aset
        </span>
        <span className="tabular-nums">
          Subtotal Nilai Perolehan:{' '}
          <strong className="font-mono text-slate-900">{formatIDR(filteredTotalValue)}</strong>
        </span>
      </div>

      {/* Main Data Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {filteredAssets.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-900">
              Tidak ada aset yang sesuai dengan filter pencarian
            </p>
            <p className="text-xs text-slate-500">
              Ubah kata kunci pencarian atau atur ulang filter golongan KIB dan lokasi pos.
            </p>
            <button
              type="button"
              onClick={() => {
                setKibFilter('ALL');
                setLocationFilter(lockedLocationId || 'ALL');
                setConditionFilter('ALL');
                setSearchQuery('');
              }}
              className="px-4 py-2 text-xs font-semibold text-[#0B2545] border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-3 text-center w-14">Foto</th>
                  <th className="py-3 px-4">KIB & Kode Barang</th>
                  <th className="py-3 px-4">Nama Barang / Merk & Tipe</th>
                  <th className="py-3 px-4 text-center">Tahun</th>
                  <th className="py-3 px-4 text-right">Jml</th>
                  <th className="py-3 px-4 text-right">Nilai Perolehan</th>
                  <th className="py-3 px-4">Kondisi</th>
                  <th className="py-3 px-4">Lokasi & PJ</th>
                  <th className="py-3 px-4 text-right no-print">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredAssets.map((asset) => {
                  const loc = locationMap.get(asset.locationId);
                  return (
                    <tr
                      key={asset.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-3 align-top">
                        <div className="flex justify-center">
                          <ItemPhotoThumbnail
                            fotoDataUrl={asset.fotoDataUrl}
                            alt={asset.namaBarang}
                            onClick={() =>
                              asset.fotoDataUrl &&
                              setLightboxPhoto({
                                title: asset.namaBarang,
                                subtitle: `${asset.id} · ${asset.kodeBarang}`,
                                dataUrl: asset.fotoDataUrl,
                                fileName: asset.fotoNamaFile,
                              })
                            }
                          />
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <div className="font-mono font-semibold text-[#0B2545] tabular-nums">
                          KIB {asset.kibType} · {asset.id}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 tabular-nums mt-0.5">
                          {asset.kodeBarang} / Reg {asset.nomorRegister}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top max-w-xs">
                        <div className="font-semibold text-slate-900 leading-snug">
                          {asset.namaBarang}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {asset.merkTipe}
                          {asset.nomorPolisiOrSertifikat
                            ? ` · ${asset.nomorPolisiOrSertifikat}`
                            : ''}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top text-center font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {asset.tahunPerolehan}
                      </td>

                      <td className="py-3 px-4 align-top text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {asset.jumlahUnit} {asset.satuan}
                      </td>

                      <td className="py-3 px-4 align-top text-right font-mono font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                        {formatIDR(asset.nilaiPerolehan)}
                      </td>

                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <ConditionIndicator condition={asset.kondisi} />
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Opname: {formatDateID(asset.lastOpnameDate)}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top max-w-[200px]">
                        <div className="font-medium text-slate-800 truncate">
                          {loc?.name ?? asset.locationId}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          PJ: {asset.penanggungJawab}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top text-right whitespace-nowrap no-print">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedAsset(asset)}
                            title="Lihat detail KIB"
                            className="p-1.5 rounded hover:bg-slate-200/70 text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setQrAsset(asset)}
                            title="Label QR Code Aset"
                            className="p-1.5 rounded hover:bg-slate-200/70 text-[#0B2545] cursor-pointer"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          {roleProfile.permissions.canEditAsset && (
                            <button
                              type="button"
                              onClick={() => openEditModal(asset)}
                              title="Edit Data Aset"
                              className="p-1.5 rounded hover:bg-slate-200/70 text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {roleProfile.permissions.canDeleteAsset && (
                            <button
                              type="button"
                              onClick={() => onDeleteAsset(asset.id)}
                              title="Hapus Register"
                              className="p-1.5 rounded hover:bg-red-50 text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Asset Detail Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 no-print">
          <div className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200">
              <div>
                <p className="font-mono text-xs font-semibold text-[#0B2545]">
                  {KIB_META[selectedAsset.kibType].fullName} · {selectedAsset.id}
                </p>
                <h3 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                  {selectedAsset.namaBarang}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAsset(null)}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
                aria-label="Tutup detail"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {selectedAsset.fotoDataUrl && (
                <div className="p-3 rounded-md bg-slate-50 border border-slate-200 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxPhoto({
                        title: selectedAsset.namaBarang,
                        subtitle: `${selectedAsset.id} · ${selectedAsset.kodeBarang}`,
                        dataUrl: selectedAsset.fotoDataUrl!,
                        fileName: selectedAsset.fotoNamaFile,
                      })
                    }
                    className="w-28 h-24 rounded border border-slate-300 bg-white overflow-hidden shrink-0 cursor-pointer hover:border-[#0B2545]"
                  >
                    <img
                      src={selectedAsset.fotoDataUrl}
                      alt={selectedAsset.namaBarang}
                      className="w-full h-full object-cover"
                    />
                  </button>
                  <div className="space-y-1 min-w-0">
                    <p className="font-semibold text-slate-800">Foto Dokumentasi Fisik Barang</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {selectedAsset.fotoNamaFile || 'foto-aset-bmd.jpg'}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxPhoto({
                          title: selectedAsset.namaBarang,
                          subtitle: `${selectedAsset.id} · ${selectedAsset.kodeBarang}`,
                          dataUrl: selectedAsset.fotoDataUrl!,
                          fileName: selectedAsset.fotoNamaFile,
                        })
                      }
                      className="text-[11px] font-semibold text-[#0B2545] hover:underline cursor-pointer"
                    >
                      Perbesar Foto
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 border-b sm:border-b-0 pb-3 sm:pb-0 border-slate-100">
                  <div>
                    <span className="text-slate-500 block">Kode Barang Permendagri</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {selectedAsset.kodeBarang} · Reg. {selectedAsset.nomorRegister}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Merk / Tipe / Ukuran</span>
                    <span className="font-medium text-slate-900">{selectedAsset.merkTipe}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">No. Polisi / Sertifikat / SN</span>
                    <span className="font-mono font-medium text-slate-900">
                      {selectedAsset.nomorPolisiOrSertifikat || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Asal & Tahun Perolehan</span>
                    <span className="font-medium text-slate-900 tabular-nums">
                      {selectedAsset.asalPerolehan} ({selectedAsset.tahunPerolehan})
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <span className="text-slate-500 block">Nilai Perolehan</span>
                    <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                      {formatIDR(selectedAsset.nilaiPerolehan)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Kondisi Terkini</span>
                    <div className="mt-0.5">
                      <ConditionIndicator condition={selectedAsset.kondisi} />
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Lokasi Penempatan</span>
                    <span className="font-medium text-slate-900">
                      {locationMap.get(selectedAsset.locationId)?.name ??
                        selectedAsset.locationId}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Penanggung Jawab & Opname</span>
                    <span className="font-medium text-slate-900">
                      {selectedAsset.penanggungJawab} ·{' '}
                      {OPNAME_STATUS_META[selectedAsset.lastOpnameStatus].label} (
                      {formatDateID(selectedAsset.lastOpnameDate)})
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-2">
                <p className="font-semibold text-slate-800">Spesifikasi Teknis & Keterangan</p>
                <p className="text-slate-600 leading-relaxed">{selectedAsset.spesifikasi}</p>
                {selectedAsset.keterangan && (
                  <p className="text-slate-500 italic">Catatan: {selectedAsset.keterangan}</p>
                )}
              </div>

              <div className="border-t border-slate-200 pt-4 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedAsset;
                    setSelectedAsset(null);
                    setQrAsset(target);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-[#0B2545] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                >
                  Lihat Label QR
                </button>
                {roleProfile.permissions.canRequestMutation && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = selectedAsset.id;
                      setSelectedAsset(null);
                      onQuickNavigateToMutation(id);
                    }}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                  >
                    Ajukan Mutasi Lokasi
                  </button>
                )}
                {roleProfile.permissions.canReportDamage && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = selectedAsset.id;
                      setSelectedAsset(null);
                      onQuickNavigateToDamage(id);
                    }}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-md cursor-pointer"
                  >
                    Laporkan Kerusakan
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Label Modal */}
      {qrAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 no-print">
              <h3 className="font-display text-base font-bold text-slate-900">
                Label QR Code BMD
              </h3>
              <button
                type="button"
                onClick={() => setQrAsset(null)}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
                aria-label="Tutup modal QR"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <PrintableQrSticker
              asset={qrAsset}
              locationName={
                locationMap.get(qrAsset.locationId)?.name ?? qrAsset.locationId
              }
              canPrint={roleProfile.permissions.canPrintQr}
              onOpenPublicProfile={(kode, register) => {
                setQrAsset(null);
                onOpenPublicProfile?.(kode, register);
              }}
            />
          </div>
        </div>
      )}

      {/* Add / Edit Asset Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 no-print">
          <div className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="font-display text-base font-bold text-slate-900">
                {editingAsset ? `Edit Aset · ${editingAsset.id}` : 'Input Perolehan Aset KIB Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Golongan KIB
                  </label>
                  <select
                    value={formData.kibType}
                    onChange={(e) =>
                      setFormData({ ...formData, kibType: e.target.value as KibCategory })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  >
                    {(['A', 'B', 'C', 'D', 'E', 'F'] as KibCategory[]).map((k) => (
                      <option key={k} value={k}>
                        {KIB_META[k].fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kode Barang (Permendagri)
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.kodeBarang}
                    onChange={(e) => setFormData({ ...formData, kodeBarang: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nomor Register
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nomorRegister}
                    onChange={(e) =>
                      setFormData({ ...formData, nomorRegister: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Barang / Aset
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.namaBarang}
                    onChange={(e) => setFormData({ ...formData, namaBarang: e.target.value })}
                    placeholder="Contoh: Pompa Apung Kebakaran Tohatsu"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Merk / Tipe / Ukuran
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.merkTipe}
                    onChange={(e) => setFormData({ ...formData, merkTipe: e.target.value })}
                    placeholder="Contoh: Hino Ranger / Tohatsu VC82"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tahun</label>
                  <input
                    type="number"
                    min={1980}
                    max={2035}
                    value={formData.tahunPerolehan}
                    onChange={(e) =>
                      setFormData({ ...formData, tahunPerolehan: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jumlah</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.jumlahUnit}
                    onChange={(e) =>
                      setFormData({ ...formData, jumlahUnit: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Satuan</label>
                  <input
                    type="text"
                    value={formData.satuan}
                    onChange={(e) => setFormData({ ...formData, satuan: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nilai Perolehan (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={formData.nilaiPerolehan}
                    onChange={(e) =>
                      setFormData({ ...formData, nilaiPerolehan: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Lokasi Penempatan
                  </label>
                  <select
                    value={formData.locationId}
                    onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code} · {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kondisi</label>
                  <select
                    value={formData.kondisi}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        kondisi: e.target.value as ConditionStatus,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  >
                    <option value="BAIK">Baik</option>
                    <option value="RUSAK_RINGAN">Rusak Ringan</option>
                    <option value="RUSAK_BERAT">Rusak Berat</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Asal Perolehan
                  </label>
                  <select
                    value={formData.asalPerolehan}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        asalPerolehan: e.target.value as AssetItem['asalPerolehan'],
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  >
                    <option value="APBD Kab. Sidoarjo">APBD Kab. Sidoarjo</option>
                    <option value="Hibah BNPB">Hibah BNPB</option>
                    <option value="Hibah Provinsi Jatim">Hibah Provinsi Jatim</option>
                    <option value="Swadaya/Lainnya">Swadaya/Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Penanggung Jawab
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.penanggungJawab}
                    onChange={(e) =>
                      setFormData({ ...formData, penanggungJawab: e.target.value })
                    }
                    placeholder="Nama petugas / koordinator pos"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    No. Polisi / Sertifikat / Serial
                  </label>
                  <input
                    type="text"
                    value={formData.nomorPolisiOrSertifikat}
                    onChange={(e) =>
                      setFormData({ ...formData, nomorPolisiOrSertifikat: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Spesifikasi Teknis & Keterangan
                </label>
                <textarea
                  rows={2}
                  value={formData.spesifikasi}
                  onChange={(e) => setFormData({ ...formData, spesifikasi: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>

              <ItemPhotoControl
                fotoDataUrl={formData.fotoDataUrl}
                fotoNamaFile={formData.fotoNamaFile}
                label="Foto Fisik Barang / Aset KIB (Opsional)"
                onChange={({ fotoDataUrl, fotoNamaFile }) =>
                  setFormData({ ...formData, fotoDataUrl, fotoNamaFile })
                }
              />

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md cursor-pointer"
                >
                  {editingAsset ? 'Simpan Perubahan' : 'Simpan ke Master KIB'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Import Modal for External BMD Apps (Super Admin Only) */}
      {roleProfile.id === 'SUPER_ADMIN' && (
        <ExcelImportModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          title="Import Excel Master KIB (Support SIMBADA / e-BMD / SIPD / CSV)"
          subtitle="Unggah file .xlsx, .xls, atau .csv dari aplikasi pengelola aset lain dan petakan kolom ke Master KIB SIMAS-BMD"
          fieldDefinitions={KIB_FIELD_DEFINITIONS}
          fieldAliases={KIB_FIELD_ALIASES}
          onDownloadTemplate={downloadKibExcelTemplate}
          extraOptions={
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">
                  Lokasi Default Jika Kolom Lokasi Tidak Ada di Excel
                </p>
                <p className="text-[11px] text-slate-500">
                  Baris yang sudah mencantumkan nama Pos / Mako di Excel akan otomatis dicocokkan ke lokasi masing-masing.
                </p>
              </div>
              <select
                value={importDefaultLoc}
                onChange={(e) => setImportDefaultLoc(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} · {l.name}
                  </option>
                ))}
              </select>
            </div>
          }
          onConfirmImport={(rows, mapping) => {
            const parsed = mapRowsToKibAssets(
              rows,
              mapping,
              locations,
              importDefaultLoc,
              roleProfile.officerName
            );
            if (parsed.length > 0) {
              onImportAssets?.(parsed);
            }
            return {
              importedCount: parsed.length,
              message: `${parsed.length} register barang berhasil diimpor ke Master KIB A–F.`,
            };
          }}
        />
      )}

      <PhotoLightboxModal
        photo={lightboxPhoto}
        onClose={() => setLightboxPhoto(null)}
      />
    </div>
  );
};
