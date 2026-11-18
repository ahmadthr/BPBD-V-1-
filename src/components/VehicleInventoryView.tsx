import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bike,
  Car,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Eye,
  FileCheck2,
  FileText,
  Paperclip,
  Plus,
  Printer,
  Search,
  Trash2,
  Truck,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import {
  AcquisitionSource,
  BpkbStatus,
  ConditionStatus,
  LocationUnit,
  MaintenanceType,
  RoleProfile,
  TaxStatus,
  VehicleCategory,
  VehicleItem,
  VehicleMaintenanceRecord,
} from '../types/simas';
import { formatDateID, formatIDR, getTaxExpiryInfo } from '../utils/formatters';
import { ConditionIndicator } from './StatusText';

interface VehicleInventoryViewProps {
  vehicles: VehicleItem[];
  maintenances: VehicleMaintenanceRecord[];
  locations: LocationUnit[];
  roleProfile: RoleProfile;
  onAddVehicle: (vehicle: Omit<VehicleItem, 'id'>) => void;
  onUpdateVehicle: (vehicle: VehicleItem) => void;
  onDeleteVehicle: (vehicleId: string) => void;
  onAddMaintenance: (
    record: Omit<VehicleMaintenanceRecord, 'id' | 'dicatatOleh'>
  ) => void;
}

const CATEGORY_TABS: { key: VehicleCategory | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Semua Kendaraan' },
  { key: 'RODA_4', label: 'Kendaraan Roda 4' },
  { key: 'RODA_2', label: 'Kendaraan Roda 2' },
];

const ACQUISITION_SOURCES: AcquisitionSource[] = [
  'APBD Kabupaten',
  'Hibah',
  'Bantuan Pusat',
  'Bantuan Provinsi',
  'Lainnya',
];

const MAINTENANCE_TYPE_META: Record<
  MaintenanceType,
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

const EMPTY_VEHICLE_FORM: Omit<VehicleItem, 'id'> = {
  kodeBarang: '1.3.2.02.01.005',
  nomorRegister: '0001',
  kategori: 'RODA_4',
  namaKendaraan: '',
  merkTipe: '',
  tahunPerolehan: 2026,
  warna: '',
  nomorPolisi: '',
  nomorRangka: '',
  nomorMesin: '',
  statusPajak: 'LUNAS_AKTIF',
  pajakBerlakuSampai: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
    .toISOString()
    .slice(0, 10),
  stnkBerlakuSampai: new Date(new Date().setFullYear(new Date().getFullYear() + 5))
    .toISOString()
    .slice(0, 10),
  statusBpkb: 'SUDAH_KELUAR',
  nomorBpkb: '',
  locationId: 'LOC-MAKO',
  penanggungJawab: '',
  jabatanPemegang: '',
  kondisi: 'BAIK',
  sumberPerolehan: 'APBD Kabupaten',
  nilaiPerolehan: 0,
  hibahInstansiPemberi: '',
  hibahNomorBast: '',
  hibahTanggal: '',
  keterangan: '',
};

const EMPTY_MAINTENANCE_FORM = {
  tanggalPerbaikan: new Date().toISOString().slice(0, 10),
  jenisPenanganan: 'PEMELIHARAAN_RUTIN' as MaintenanceType,
  deskripsiKerusakan: '',
  tindakanPerbaikan: '',
  bengkelPelaksana: '',
  biaya: 0,
  buktiNamaFile: '',
  buktiMimeType: '',
  buktiDataUrl: '',
};

function exportVehiclesToCSV(
  vehicles: VehicleItem[],
  locations: LocationUnit[],
  maintenances: VehicleMaintenanceRecord[]
): void {
  const locMap = new Map(locations.map((l) => [l.id, l.name]));
  const costByVehicle = new Map<string, number>();
  maintenances.forEach((m) => {
    costByVehicle.set(m.vehicleId, (costByVehicle.get(m.vehicleId) ?? 0) + m.biaya);
  });

  const headers = [
    'ID Kendaraan',
    'Kategori',
    'No. Polisi',
    'Nama Kendaraan',
    'Merk / Tipe',
    'Tahun',
    'No. Rangka',
    'No. Mesin',
    'Status Pajak',
    'Masa Pajak Kendaraan Berakhir',
    'Keterangan Jatuh Tempo Pajak',
    'STNK 5 Tahunan Berakhir',
    'Status BPKB',
    'No. BPKB',
    'Lokasi Penempatan',
    'Pegawai Penanggung Jawab',
    'Sumber Perolehan',
    'Instansi Pemberi Hibah',
    'No. Dokumen/BAST Hibah',
    'Tanggal Hibah',
    'Nilai Perolehan (IDR)',
    'Total Biaya Pemeliharaan (IDR)',
  ];

  const escapeCsv = (val: string | number | undefined) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = vehicles.map((v) => {
    const expiryInfo = getTaxExpiryInfo(v.pajakBerlakuSampai);
    return [
      v.id,
      v.kategori === 'RODA_4' ? 'Roda 4' : 'Roda 2',
      v.nomorPolisi,
      v.namaKendaraan,
      v.merkTipe,
      v.tahunPerolehan,
      v.nomorRangka,
      v.nomorMesin,
      v.statusPajak === 'LUNAS_AKTIF' ? 'Lunas/Aktif' : 'Belum Bayar',
      v.pajakBerlakuSampai,
      expiryInfo.shortText,
      v.stnkBerlakuSampai ?? '-',
      v.statusBpkb === 'SUDAH_KELUAR'
        ? 'BPKB Sudah Keluar'
        : 'BPKB Belum Keluar / Masih Proses',
      v.nomorBpkb ?? '-',
      locMap.get(v.locationId) ?? v.locationId,
      v.penanggungJawab,
      v.sumberPerolehan,
      v.hibahInstansiPemberi ?? '-',
      v.hibahNomorBast ?? '-',
      v.hibahTanggal ?? '-',
      v.nilaiPerolehan,
      costByVehicle.get(v.id) ?? 0,
    ]
      .map(escapeCsv)
      .join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'inventaris-kendaraan-bpbd-sidoarjo.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const VehicleInventoryView: React.FC<VehicleInventoryViewProps> = ({
  vehicles,
  maintenances,
  locations,
  roleProfile,
  onAddVehicle,
  onUpdateVehicle,
  onDeleteVehicle,
  onAddMaintenance,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<VehicleCategory | 'ALL'>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [taxFilter, setTaxFilter] = useState<TaxStatus | 'ALL' | 'EXPIRED_OR_SOON'>('ALL');
  const [bpkbFilter, setBpkbFilter] = useState<BpkbStatus | 'ALL'>('ALL');
  const [sourceFilter, setSourceFilter] = useState<AcquisitionSource | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleItem | null>(null);
  const [formData, setFormData] = useState<Omit<VehicleItem, 'id'>>(EMPTY_VEHICLE_FORM);

  const [detailVehicleId, setDetailVehicleId] = useState<string | null>(null);
  const [maintenanceFormOpen, setMaintenanceFormOpen] = useState<boolean>(false);
  const [maintenanceForm, setMaintenanceForm] = useState(EMPTY_MAINTENANCE_FORM);
  const [uploadError, setUploadError] = useState<string>('');

  const [proofPreview, setProofPreview] = useState<{
    fileName: string;
    mimeType: string;
    dataUrl: string;
    caption: string;
  } | null>(null);

  const locationMap = useMemo(
    () => new Map(locations.map((l) => [l.id, l])),
    [locations]
  );

  const detailVehicle = useMemo(
    () => vehicles.find((v) => v.id === detailVehicleId) ?? null,
    [vehicles, detailVehicleId]
  );

  const detailMaintenances = useMemo(
    () =>
      detailVehicleId
        ? maintenances
            .filter((m) => m.vehicleId === detailVehicleId)
            .sort((a, b) => b.tanggalPerbaikan.localeCompare(a.tanggalPerbaikan))
        : [],
    [maintenances, detailVehicleId]
  );

  const filteredVehicles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (categoryFilter !== 'ALL' && v.kategori !== categoryFilter) return false;
      if (locationFilter !== 'ALL' && v.locationId !== locationFilter) return false;
      if (taxFilter === 'EXPIRED_OR_SOON') {
        const exp = getTaxExpiryInfo(v.pajakBerlakuSampai);
        if (
          v.statusPajak !== 'BELUM_BAYAR' &&
          exp.status !== 'EXPIRED' &&
          exp.status !== 'EXPIRING_SOON'
        ) {
          return false;
        }
      } else if (taxFilter !== 'ALL' && v.statusPajak !== taxFilter) {
        return false;
      }
      if (bpkbFilter !== 'ALL' && v.statusBpkb !== bpkbFilter) return false;
      if (sourceFilter !== 'ALL' && v.sumberPerolehan !== sourceFilter) return false;
      if (!q) return true;

      const locName = locationMap.get(v.locationId)?.name.toLowerCase() ?? '';
      return (
        v.nomorPolisi.toLowerCase().includes(q) ||
        v.nomorRangka.toLowerCase().includes(q) ||
        v.nomorMesin.toLowerCase().includes(q) ||
        v.namaKendaraan.toLowerCase().includes(q) ||
        v.merkTipe.toLowerCase().includes(q) ||
        v.penanggungJawab.toLowerCase().includes(q) ||
        (v.hibahNomorBast ?? '').toLowerCase().includes(q) ||
        (v.hibahInstansiPemberi ?? '').toLowerCase().includes(q) ||
        locName.includes(q)
      );
    });
  }, [
    vehicles,
    categoryFilter,
    locationFilter,
    taxFilter,
    bpkbFilter,
    sourceFilter,
    searchQuery,
    locationMap,
  ]);

  const stats = useMemo(() => {
    const r4 = vehicles.filter((v) => v.kategori === 'RODA_4').length;
    const r2 = vehicles.filter((v) => v.kategori === 'RODA_2').length;
    const taxExpiredOrUnpaid = vehicles.filter((v) => {
      const exp = getTaxExpiryInfo(v.pajakBerlakuSampai);
      return v.statusPajak === 'BELUM_BAYAR' || exp.status === 'EXPIRED';
    }).length;
    const taxExpiringSoon = vehicles.filter(
      (v) => getTaxExpiryInfo(v.pajakBerlakuSampai).status === 'EXPIRING_SOON'
    ).length;
    const bpkbProcess = vehicles.filter(
      (v) => v.statusBpkb === 'BELUM_KELUAR_PROSES'
    ).length;
    const hibahCount = vehicles.filter(
      (v) => v.sumberPerolehan !== 'APBD Kabupaten'
    ).length;
    const totalMaintenanceCost = maintenances.reduce((sum, m) => sum + m.biaya, 0);
    return {
      r4,
      r2,
      taxExpiredOrUnpaid,
      taxExpiringSoon,
      bpkbProcess,
      hibahCount,
      totalMaintenanceCost,
    };
  }, [vehicles, maintenances]);

  const canRecordMaintenance =
    roleProfile.permissions.canReportDamage ||
    roleProfile.permissions.canResolveDamage ||
    roleProfile.permissions.canEditAsset ||
    roleProfile.permissions.canCreateAsset;

  const isHibahOrBantuan =
    formData.sumberPerolehan === 'Hibah' ||
    formData.sumberPerolehan === 'Bantuan Pusat' ||
    formData.sumberPerolehan === 'Bantuan Provinsi';

  const openCreateModal = () => {
    setEditingVehicle(null);
    setFormData({
      ...EMPTY_VEHICLE_FORM,
      kategori: categoryFilter === 'ALL' ? 'RODA_4' : categoryFilter,
      locationId: locationFilter === 'ALL' ? 'LOC-MAKO' : locationFilter,
    });
    setFormOpen(true);
  };

  const openEditModal = (v: VehicleItem) => {
    setEditingVehicle(v);
    const { id: _id, ...rest } = v;
    setFormData({
      ...EMPTY_VEHICLE_FORM,
      ...rest,
    });
    setFormOpen(true);
  };

  const handleSaveVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.namaKendaraan.trim() || !formData.nomorPolisi.trim()) return;
    if (editingVehicle) {
      onUpdateVehicle({
        ...editingVehicle,
        ...formData,
      });
    } else {
      onAddVehicle(formData);
    }
    setFormOpen(false);
    setEditingVehicle(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2.5 * 1024 * 1024) {
      setUploadError('Ukuran berkas melebihi 2,5 MB. Gunakan berkas foto/PDF yang lebih ringkas.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setMaintenanceForm((prev) => ({
          ...prev,
          buktiNamaFile: file.name,
          buktiMimeType: file.type || 'application/octet-stream',
          buktiDataUrl: reader.result as string,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailVehicleId || !maintenanceForm.deskripsiKerusakan.trim()) return;
    onAddMaintenance({
      vehicleId: detailVehicleId,
      tanggalPerbaikan: maintenanceForm.tanggalPerbaikan,
      jenisPenanganan: maintenanceForm.jenisPenanganan,
      deskripsiKerusakan: maintenanceForm.deskripsiKerusakan.trim(),
      tindakanPerbaikan: maintenanceForm.tindakanPerbaikan.trim(),
      bengkelPelaksana: maintenanceForm.bengkelPelaksana.trim() || 'Bengkel Rekanan Pemda',
      biaya: Number(maintenanceForm.biaya) || 0,
      buktiNamaFile: maintenanceForm.buktiNamaFile || undefined,
      buktiMimeType: maintenanceForm.buktiMimeType || undefined,
      buktiDataUrl: maintenanceForm.buktiDataUrl || undefined,
    });
    setMaintenanceForm(EMPTY_MAINTENANCE_FORM);
    setUploadError('');
    setMaintenanceFormOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Inventaris Kendaraan Dinas & Armada Operasional (Roda 4 & Roda 2)
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Pengelolaan identifikasi fisik, legalitas STNK/BPKB, aset hibah/BAST, dan riwayat servis armada BPBD Sidoarjo
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 no-print">
          {roleProfile.permissions.canExportReport && (
            <>
              <button
                type="button"
                onClick={() => exportVehiclesToCSV(filteredVehicles, locations, maintenances)}
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
                Cetak Daftar
              </button>
            </>
          )}
          {roleProfile.permissions.canCreateAsset && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Kendaraan
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Armada Roda 4</span>
            <Truck className="w-4 h-4 text-[#0B2545]" aria-hidden="true" />
          </div>
          <p className="font-display text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">
            {stats.r4} <span className="text-xs font-normal text-slate-500">Unit</span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Unit Roda 2</span>
            <Bike className="w-4 h-4 text-[#0B2545]" aria-hidden="true" />
          </div>
          <p className="font-display text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">
            {stats.r2} <span className="text-xs font-normal text-slate-500">Unit</span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Pajak Berakhir / Tunggak</span>
            <AlertTriangle className="w-4 h-4 text-red-600" aria-hidden="true" />
          </div>
          <p className="font-display text-2xl font-bold text-red-700 mt-1.5 tabular-nums">
            {stats.taxExpiredOrUnpaid}{' '}
            <span className="text-xs font-normal text-slate-500">Unit</span>
          </p>
          {stats.taxExpiringSoon > 0 && (
            <p className="text-[11px] font-semibold text-amber-700 mt-0.5 tabular-nums">
              +{stats.taxExpiringSoon} unit berakhir ≤30 hari
            </p>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>BPKB Dalam Proses</span>
            <Clock className="w-4 h-4 text-amber-600" aria-hidden="true" />
          </div>
          <p className="font-display text-2xl font-bold text-amber-700 mt-1.5 tabular-nums">
            {stats.bpkbProcess} <span className="text-xs font-normal text-slate-500">Unit</span>
          </p>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Realisasi Servis</span>
            <Wrench className="w-4 h-4 text-emerald-700" aria-hidden="true" />
          </div>
          <p className="font-display text-lg font-bold text-[#0B2545] mt-2 tabular-nums">
            {formatIDR(stats.totalMaintenanceCost)}
          </p>
        </div>
      </div>

      {/* Category Segmented Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto no-print">
        {CATEGORY_TABS.map((tab) => {
          const isActive = categoryFilter === tab.key;
          const count =
            tab.key === 'ALL'
              ? vehicles.length
              : vehicles.filter((v) => v.kategori === tab.key).length;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setCategoryFilter(tab.key)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
        <div className="md:col-span-4 relative">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nopol, no. rangka, no. mesin, pemegang, BAST..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#0B2545]"
          />
        </div>

        <div className="md:col-span-3">
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            aria-label="Filter pos penempatan"
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#0B2545]"
          >
            <option value="ALL">Semua Lokasi (Mako &amp; 7 Pos Damkar)</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            value={taxFilter}
            onChange={(e) =>
              setTaxFilter(e.target.value as TaxStatus | 'ALL' | 'EXPIRED_OR_SOON')
            }
            aria-label="Filter status dan masa pajak"
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#0B2545]"
          >
            <option value="ALL">Semua Status Pajak</option>
            <option value="EXPIRED_OR_SOON">Masa Pajak Berakhir / ≤30 Hari</option>
            <option value="LUNAS_AKTIF">Pajak Lunas / Aktif</option>
            <option value="BELUM_BAYAR">Pajak Belum Bayar</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            value={bpkbFilter}
            onChange={(e) => setBpkbFilter(e.target.value as BpkbStatus | 'ALL')}
            aria-label="Filter keterangan BPKB"
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#0B2545]"
          >
            <option value="ALL">Semua Status BPKB</option>
            <option value="SUDAH_KELUAR">BPKB Sudah Keluar</option>
            <option value="BELUM_KELUAR_PROSES">BPKB Masih Proses</option>
          </select>
        </div>

        <div className="md:col-span-1">
          <select
            value={sourceFilter}
            onChange={(e) =>
              setSourceFilter(e.target.value as AcquisitionSource | 'ALL')
            }
            aria-label="Filter sumber perolehan"
            className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#0B2545]"
          >
            <option value="ALL">Sumber</option>
            {ACQUISITION_SOURCES.map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Vehicle Inventory Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                <th className="py-3 px-4">Kategori &amp; No. Polisi</th>
                <th className="py-3 px-4">Kendaraan &amp; Identifikasi Fisik</th>
                <th className="py-3 px-4">Status Pajak &amp; BPKB</th>
                <th className="py-3 px-4">Sumber &amp; Detail Hibah</th>
                <th className="py-3 px-4">Pos Penempatan &amp; Pemegang</th>
                <th className="py-3 px-4">Kondisi</th>
                <th className="py-3 px-4 text-right no-print">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    Tidak ada unit kendaraan yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredVehicles.map((v) => {
                  const loc = locationMap.get(v.locationId);
                  const mntCount = maintenances.filter(
                    (m) => m.vehicleId === v.id
                  ).length;

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap align-top">
                        <div className="flex items-center gap-1.5 font-semibold text-[#0B2545]">
                          {v.kategori === 'RODA_4' ? (
                            <Car className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          ) : (
                            <Bike className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          )}
                          <span>{v.kategori === 'RODA_4' ? 'Roda 4' : 'Roda 2'}</span>
                        </div>
                        <div className="font-mono text-sm font-bold text-slate-900 mt-1 tabular-nums">
                          {v.nomorPolisi}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 mt-0.5 tabular-nums">
                          {v.id} · Reg {v.nomorRegister}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top max-w-xs">
                        <div className="font-semibold text-slate-900">
                          {v.namaKendaraan}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          {v.merkTipe} ({v.tahunPerolehan})
                        </div>
                        <div className="mt-1.5 space-y-0.5 font-mono text-[11px] text-slate-600 tabular-nums">
                          <div>Rangka: {v.nomorRangka}</div>
                          <div>Mesin : {v.nomorMesin}</div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap align-top">
                        {(() => {
                          const expiry = getTaxExpiryInfo(v.pajakBerlakuSampai);
                          return (
                            <>
                              <div className="flex items-center gap-1.5 font-semibold">
                                {v.statusPajak === 'LUNAS_AKTIF' ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-700">
                                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                                    Pajak Lunas/Aktif
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-red-700">
                                    <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                                    Pajak Belum Bayar
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-[11px] text-slate-700 mt-0.5 tabular-nums">
                                Pajak Berakhir: {formatDateID(v.pajakBerlakuSampai)}
                              </div>
                              <div className={`text-[11px] font-semibold tabular-nums ${expiry.textClass}`}>
                                {expiry.shortText}
                              </div>
                              {v.stnkBerlakuSampai && (
                                <div className="font-mono text-[10px] text-slate-500 mt-0.5 tabular-nums">
                                  STNK 5 Thn: {formatDateID(v.stnkBerlakuSampai)}
                                </div>
                              )}
                              <div className="mt-1.5 text-[11px] font-medium">
                                {v.statusBpkb === 'SUDAH_KELUAR' ? (
                                  <span className="text-slate-700">
                                    BPKB Sudah Keluar{' '}
                                    {v.nomorBpkb ? (
                                      <span className="font-mono text-slate-500">
                                        ({v.nomorBpkb})
                                      </span>
                                    ) : null}
                                  </span>
                                ) : (
                                  <span className="text-amber-700 font-semibold">
                                    BPKB Belum Keluar / Proses
                                  </span>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </td>

                      <td className="py-3.5 px-4 align-top max-w-[230px]">
                        <div className="font-semibold text-slate-900">
                          {v.sumberPerolehan}
                        </div>
                        {v.hibahInstansiPemberi ? (
                          <div className="mt-0.5 space-y-0.5 text-[11px] text-slate-600">
                            <div className="truncate" title={v.hibahInstansiPemberi}>
                              Dari: {v.hibahInstansiPemberi}
                            </div>
                            {v.hibahNomorBast && (
                              <div className="font-mono text-[10px] text-slate-500 truncate">
                                BAST: {v.hibahNomorBast}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="font-mono text-[11px] text-slate-500 mt-0.5 tabular-nums">
                            Nilai: {formatIDR(v.nilaiPerolehan)}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <div className="font-semibold text-slate-900">
                          {loc?.name ?? v.locationId}
                        </div>
                        <div className="text-[11px] text-slate-700 mt-0.5">
                          Pemegang: {v.penanggungJawab}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {v.jabatanPemegang}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap align-top">
                        <ConditionIndicator condition={v.kondisi} />
                        <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                          {mntCount} riwayat servis
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-right align-top no-print">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setDetailVehicleId(v.id);
                              setMaintenanceFormOpen(false);
                              setUploadError('');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#0B2545] border border-slate-300 hover:bg-slate-100 rounded cursor-pointer"
                            title="Detail legalitas & riwayat pemeliharaan"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Detail &amp; Servis
                          </button>

                          {roleProfile.permissions.canEditAsset && (
                            <button
                              type="button"
                              onClick={() => openEditModal(v)}
                              title="Edit data kendaraan"
                              className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}

                          {roleProfile.permissions.canDeleteAsset && (
                            <button
                              type="button"
                              onClick={() => onDeleteVehicle(v.id)}
                              title="Hapus kendaraan"
                              className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Add / Edit Vehicle */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-lg max-w-3xl w-full shadow-xl my-8 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-[#0B2545] text-white">
              <div>
                <h3 className="font-display text-base font-bold">
                  {editingVehicle
                    ? `Edit Inventaris Kendaraan (${editingVehicle.nomorPolisi})`
                    : 'Tambah Inventaris Kendaraan Baru (Roda 4 / Roda 2)'}
                </h3>
                <p className="text-xs text-slate-300">
                  Lengkapi identifikasi fisik, legalitas STNK/BPKB, penanggung jawab, dan data hibah/BAST
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveVehicle}
              className="p-6 space-y-5 text-xs max-h-[80vh] overflow-y-auto"
            >
              {/* Section A: Kategori & Identitas Dasar */}
              <div className="space-y-3">
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-[#0B2545] border-b border-slate-200 pb-1.5">
                  1. Kategori &amp; Identitas Kendaraan
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Kategori Kendaraan *
                    </label>
                    <select
                      value={formData.kategori}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          kategori: e.target.value as VehicleCategory,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    >
                      <option value="RODA_4">Roda 4 (Mobil / Truk / Armada)</option>
                      <option value="RODA_2">Roda 2 (Sepeda Motor / Trail)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Kode Barang (Permendagri) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.kodeBarang}
                      onChange={(e) =>
                        setFormData({ ...formData, kodeBarang: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nomor Register *
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
                      Nama / Fungsi Kendaraan *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.namaKendaraan}
                      onChange={(e) =>
                        setFormData({ ...formData, namaKendaraan: e.target.value })
                      }
                      placeholder="Misal: Mobil Rescue Tactical Double Cabin 4x4"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Merk / Tipe / Karoseri *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.merkTipe}
                      onChange={(e) =>
                        setFormData({ ...formData, merkTipe: e.target.value })
                      }
                      placeholder="Misal: Toyota Hilux 2.4 G / Hino Ranger"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Tahun Perolehan *
                    </label>
                    <input
                      type="number"
                      min={1990}
                      max={2035}
                      required
                      value={formData.tahunPerolehan}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          tahunPerolehan: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-md tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Warna Kendaraan
                    </label>
                    <input
                      type="text"
                      value={formData.warna}
                      onChange={(e) =>
                        setFormData({ ...formData, warna: e.target.value })
                      }
                      placeholder="Merah / Oranye BPBD"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Kondisi Fisik Saat Ini
                    </label>
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
                </div>
              </div>

              {/* Section B: Identifikasi Fisik & Legalitas Dokumen */}
              <div className="space-y-3">
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-[#0B2545] border-b border-slate-200 pb-1.5">
                  2. Identifikasi Fisik &amp; Legalitas Dokumen (STNK / BPKB)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nomor Polisi (Plat Nomor) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nomorPolisi}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          nomorPolisi: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="W 8014 NP"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nomor Rangka (VIN) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nomorRangka}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          nomorRangka: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="17 digit nomor rangka"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nomor Mesin *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nomorMesin}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          nomorMesin: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="Nomor blok mesin"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Status Pajak STNK *
                    </label>
                    <select
                      value={formData.statusPajak}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          statusPajak: e.target.value as TaxStatus,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    >
                      <option value="LUNAS_AKTIF">Lunas / Aktif</option>
                      <option value="BELUM_BAYAR">Belum Bayar</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Masa Pajak Kendaraan Berakhir (Tahunan) *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.pajakBerlakuSampai}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          pajakBerlakuSampai: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Masa STNK 5 Tahunan Berakhir
                    </label>
                    <input
                      type="date"
                      value={formData.stnkBerlakuSampai ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          stnkBerlakuSampai: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Keterangan BPKB *
                    </label>
                    <select
                      value={formData.statusBpkb}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          statusBpkb: e.target.value as BpkbStatus,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    >
                      <option value="SUDAH_KELUAR">BPKB Sudah Keluar</option>
                      <option value="BELUM_KELUAR_PROSES">
                        BPKB Belum Keluar / Masih Proses
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nomor BPKB (Jika Ada)
                    </label>
                    <input
                      type="text"
                      value={formData.nomorBpkb ?? ''}
                      disabled={formData.statusBpkb !== 'SUDAH_KELUAR'}
                      onChange={(e) =>
                        setFormData({ ...formData, nomorBpkb: e.target.value })
                      }
                      placeholder="R-04192831-JT"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono disabled:bg-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* Section C: Lokasi & Penanggung Jawab */}
              <div className="space-y-3">
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-[#0B2545] border-b border-slate-200 pb-1.5">
                  3. Lokasi Penempatan &amp; Pegawai Penanggung Jawab
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Pos Penempatan (Mako / 7 Pos Damkar) *
                    </label>
                    <select
                      value={formData.locationId}
                      onChange={(e) =>
                        setFormData({ ...formData, locationId: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    >
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nama Pegawai Pemegang Langsung *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.penanggungJawab}
                      onChange={(e) =>
                        setFormData({ ...formData, penanggungJawab: e.target.value })
                      }
                      placeholder="Nama ASN / PTT pemegang"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Jabatan / Regu Pemegang
                    </label>
                    <input
                      type="text"
                      value={formData.jabatanPemegang}
                      onChange={(e) =>
                        setFormData({ ...formData, jabatanPemegang: e.target.value })
                      }
                      placeholder="Danru Pos / Tim TRC"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    />
                  </div>
                </div>
              </div>

              {/* Section D: Sumber Perolehan & Detail Hibah */}
              <div className="space-y-3">
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-[#0B2545] border-b border-slate-200 pb-1.5">
                  4. Sumber Perolehan &amp; Keterangan Barang Hibah
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Sumber Perolehan *
                    </label>
                    <select
                      value={formData.sumberPerolehan}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sumberPerolehan: e.target.value as AcquisitionSource,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    >
                      {ACQUISITION_SOURCES.map((src) => (
                        <option key={src} value={src}>
                          {src}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nilai Perolehan / Taksiran Aset (Rp) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={formData.nilaiPerolehan}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          nilaiPerolehan: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-md tabular-nums"
                    />
                  </div>
                </div>

                {isHibahOrBantuan && (
                  <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200 space-y-3">
                    <p className="text-[11px] font-semibold text-[#0B2545]">
                      Rincian Dokumen Hibah / Bantuan Instansi Pemberi
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Asal Instansi Pemberi Hibah *
                        </label>
                        <input
                          type="text"
                          required={isHibahOrBantuan}
                          value={formData.hibahInstansiPemberi ?? ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              hibahInstansiPemberi: e.target.value,
                            })
                          }
                          placeholder="Misal: BNPB RI / Pemprov Jatim"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Nomor Dokumen / BAST Hibah *
                        </label>
                        <input
                          type="text"
                          required={isHibahOrBantuan}
                          value={formData.hibahNomorBast ?? ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              hibahNomorBast: e.target.value,
                            })
                          }
                          placeholder="BAST-HIBAH/BNPB/..."
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Tanggal BAST Hibah *
                        </label>
                        <input
                          type="date"
                          required={isHibahOrBantuan}
                          value={formData.hibahTanggal ?? ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              hibahTanggal: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Catatan / Keterangan Tambahan
                  </label>
                  <textarea
                    rows={2}
                    value={formData.keterangan ?? ''}
                    onChange={(e) =>
                      setFormData({ ...formData, keterangan: e.target.value })
                    }
                    placeholder="Keterangan kesiapan operasional atau catatan arsip dokumen..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
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
                  {editingVehicle ? 'Simpan Perubahan Kendaraan' : 'Simpan Kendaraan Baru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Vehicle Detail, Legality, Hibah Info & Maintenance History */}
      {detailVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-lg max-w-5xl w-full shadow-xl my-6 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-start justify-between px-6 py-4 bg-[#0B2545] text-white">
              <div>
                <div className="flex items-center gap-2 text-xs text-amber-300 font-semibold">
                  <span>{detailVehicle.kategori === 'RODA_4' ? 'KENDARAAN RODA 4' : 'KENDARAAN RODA 2'}</span>
                  <span>·</span>
                  <span className="font-mono">{detailVehicle.nomorPolisi}</span>
                  <span>·</span>
                  <span className="font-mono">{detailVehicle.id}</span>
                </div>
                <h3 className="font-display text-lg font-bold mt-0.5">
                  {detailVehicle.namaKendaraan}
                </h3>
                <p className="text-xs text-slate-300">
                  {detailVehicle.merkTipe} · Tahun {detailVehicle.tahunPerolehan} · Warna {detailVehicle.warna || '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetailVehicleId(null);
                  setMaintenanceFormOpen(false);
                }}
                className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
                aria-label="Tutup detail kendaraan"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
              {/* Top 3-column summary: Physical IDs | Tax & BPKB | Location & Hibah */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-2">
                  <p className="font-display font-bold text-[#0B2545] uppercase tracking-wider text-[11px]">
                    Identifikasi Fisik &amp; Register
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Nomor Polisi</span>
                      <span className="font-mono font-bold text-slate-900">
                        {detailVehicle.nomorPolisi}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Nomor Rangka</span>
                      <span className="font-mono text-slate-800">
                        {detailVehicle.nomorRangka}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Nomor Mesin</span>
                      <span className="font-mono text-slate-800">
                        {detailVehicle.nomorMesin}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Kode Barang</span>
                      <span className="font-mono text-slate-700">
                        {detailVehicle.kodeBarang}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 pt-1 border-t border-slate-200">
                      <span className="text-slate-500">Kondisi Fisik</span>
                      <ConditionIndicator condition={detailVehicle.kondisi} />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-2">
                  <p className="font-display font-bold text-[#0B2545] uppercase tracking-wider text-[11px]">
                    Legalitas Pajak STNK &amp; BPKB
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Status Pajak</span>
                      <span
                        className={`font-semibold ${
                          detailVehicle.statusPajak === 'LUNAS_AKTIF'
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }`}
                      >
                        {detailVehicle.statusPajak === 'LUNAS_AKTIF'
                          ? 'Lunas / Aktif'
                          : 'Belum Bayar'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Masa Pajak Berakhir</span>
                      <span className="text-right">
                        <span className="font-mono font-semibold text-slate-900 tabular-nums block">
                          {formatDateID(detailVehicle.pajakBerlakuSampai)}
                        </span>
                        <span
                          className={`text-[11px] font-semibold tabular-nums ${
                            getTaxExpiryInfo(detailVehicle.pajakBerlakuSampai).textClass
                          }`}
                        >
                          {getTaxExpiryInfo(detailVehicle.pajakBerlakuSampai).shortText}
                        </span>
                      </span>
                    </div>
                    {detailVehicle.stnkBerlakuSampai && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500">STNK 5 Tahunan Berakhir</span>
                        <span className="font-mono text-slate-900 tabular-nums">
                          {formatDateID(detailVehicle.stnkBerlakuSampai)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2 pt-1 border-t border-slate-200">
                      <span className="text-slate-500">Status BPKB</span>
                      <span
                        className={`font-semibold text-right ${
                          detailVehicle.statusBpkb === 'SUDAH_KELUAR'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {detailVehicle.statusBpkb === 'SUDAH_KELUAR'
                          ? 'Sudah Keluar'
                          : 'Belum Keluar / Proses'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Nomor BPKB</span>
                      <span className="font-mono text-slate-800">
                        {detailVehicle.nomorBpkb || 'Menunggu Penerbitan'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-2">
                  <p className="font-display font-bold text-[#0B2545] uppercase tracking-wider text-[11px]">
                    Penempatan, Pemegang &amp; Sumber
                  </p>
                  <div className="space-y-1.5">
                    <div>
                      <span className="text-slate-500 block">Pos Penempatan</span>
                      <span className="font-semibold text-slate-900">
                        {locationMap.get(detailVehicle.locationId)?.name ??
                          detailVehicle.locationId}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Pegawai Penanggung Jawab</span>
                      <span className="font-semibold text-slate-900">
                        {detailVehicle.penanggungJawab}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        {detailVehicle.jabatanPemegang}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 pt-1 border-t border-slate-200">
                      <span className="text-slate-500">Sumber Perolehan</span>
                      <span className="font-semibold text-[#0B2545]">
                        {detailVehicle.sumberPerolehan}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Nilai Perolehan</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {formatIDR(detailVehicle.nilaiPerolehan)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detail Sumber Barang Hibah / BAST Banner (if applicable) */}
              {(detailVehicle.hibahInstansiPemberi ||
                detailVehicle.hibahNomorBast ||
                detailVehicle.sumberPerolehan !== 'APBD Kabupaten') && (
                <div className="p-4 rounded-md bg-white border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-display font-bold text-[#0B2545]">
                    <FileCheck2 className="w-4 h-4 text-[#0B2545]" aria-hidden="true" />
                    <span>Keterangan Sumber Barang Hibah / Bantuan</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                    <div>
                      <span className="text-slate-500 block">Asal Instansi Pemberi</span>
                      <span className="font-semibold text-slate-900">
                        {detailVehicle.hibahInstansiPemberi || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Nomor Dokumen / BAST</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {detailVehicle.hibahNomorBast || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Tanggal BAST Hibah</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {detailVehicle.hibahTanggal
                          ? formatDateID(detailVehicle.hibahTanggal)
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Module: Riwayat Status Barang & Bukti Pemeliharaan / Perbaikan */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h4 className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-[#0B2545]" aria-hidden="true" />
                      Riwayat Pemeliharaan, Perbaikan &amp; Bukti Nota/Kuitansi
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                      Total {detailMaintenances.length} catatan servis · Akumulasi biaya:{' '}
                      <strong className="text-[#0B2545]">
                        {formatIDR(
                          detailMaintenances.reduce((sum, m) => sum + m.biaya, 0)
                        )}
                      </strong>
                    </p>
                  </div>

                  {canRecordMaintenance && (
                    <button
                      type="button"
                      onClick={() => setMaintenanceFormOpen((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md cursor-pointer self-start sm:self-auto whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {maintenanceFormOpen
                        ? 'Tutup Form Servis'
                        : 'Catat Pemeliharaan / Perbaikan'}
                    </button>
                  )}
                </div>

                {/* Inline Form to Add New Maintenance Record with Proof Upload */}
                {maintenanceFormOpen && canRecordMaintenance && (
                  <form
                    onSubmit={handleSaveMaintenance}
                    className="p-5 bg-slate-50/70 border-b border-slate-200 space-y-4 text-xs"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Tanggal Perbaikan *
                        </label>
                        <input
                          type="date"
                          required
                          value={maintenanceForm.tanggalPerbaikan}
                          onChange={(e) =>
                            setMaintenanceForm({
                              ...maintenanceForm,
                              tanggalPerbaikan: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Jenis Penanganan *
                        </label>
                        <select
                          value={maintenanceForm.jenisPenanganan}
                          onChange={(e) =>
                            setMaintenanceForm({
                              ...maintenanceForm,
                              jenisPenanganan: e.target.value as MaintenanceType,
                            })
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md"
                        >
                          <option value="PEMELIHARAAN_RUTIN">Pemeliharaan Rutin</option>
                          <option value="PERBAIKAN_RINGAN">Perbaikan Ringan</option>
                          <option value="PERBAIKAN_BERAT">Perbaikan Berat</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Biaya Perbaikan (Rp) *
                        </label>
                        <input
                          type="number"
                          min={0}
                          required
                          value={maintenanceForm.biaya}
                          onChange={(e) =>
                            setMaintenanceForm({
                              ...maintenanceForm,
                              biaya: Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Deskripsi Kerusakan / Keluhan *
                        </label>
                        <textarea
                          rows={2}
                          required
                          value={maintenanceForm.deskripsiKerusakan}
                          onChange={(e) =>
                            setMaintenanceForm({
                              ...maintenanceForm,
                              deskripsiKerusakan: e.target.value,
                            })
                          }
                          placeholder="Uraikan gejala kerusakan atau jadwal pemeliharaan berkala..."
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Tindakan Perbaikan &amp; Penggantian Suku Cadang *
                        </label>
                        <textarea
                          rows={2}
                          required
                          value={maintenanceForm.tindakanPerbaikan}
                          onChange={(e) =>
                            setMaintenanceForm({
                              ...maintenanceForm,
                              tindakanPerbaikan: e.target.value,
                            })
                          }
                          placeholder="Detail pekerjaan yang dilakukan bengkel..."
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Bengkel / Rekanan Pelaksana *
                        </label>
                        <input
                          type="text"
                          required
                          value={maintenanceForm.bengkelPelaksana}
                          onChange={(e) =>
                            setMaintenanceForm({
                              ...maintenanceForm,
                              bengkelPelaksana: e.target.value,
                            })
                          }
                          placeholder="Nama bengkel resmi / rekanan"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Unggah Bukti (Nota, Kuitansi, atau Foto Servis · Maks 2,5 MB)
                        </label>
                        <label className="flex items-center justify-between gap-2 px-3 py-2 bg-white border border-dashed border-slate-400 hover:border-[#0B2545] rounded-md cursor-pointer">
                          <span className="inline-flex items-center gap-2 text-slate-600 truncate">
                            <Upload className="w-3.5 h-3.5 text-[#0B2545] shrink-0" />
                            <span className="truncate">
                              {maintenanceForm.buktiNamaFile ||
                                'Pilih file JPG, PNG, atau PDF kuitansi...'}
                            </span>
                          </span>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleFileChange}
                            className="sr-only"
                          />
                        </label>
                        {uploadError && (
                          <p className="text-[11px] text-red-700 mt-1">{uploadError}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setMaintenanceFormOpen(false)}
                        className="px-3.5 py-2 font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md cursor-pointer"
                      >
                        Simpan Riwayat &amp; Bukti Servis
                      </button>
                    </div>
                  </form>
                )}

                {/* Maintenance History Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                        <th className="py-2.5 px-4">Tanggal</th>
                        <th className="py-2.5 px-4">Jenis Penanganan</th>
                        <th className="py-2.5 px-4">Kerusakan &amp; Tindakan Perbaikan</th>
                        <th className="py-2.5 px-4">Bengkel &amp; Pencatat</th>
                        <th className="py-2.5 px-4 text-right">Biaya (IDR)</th>
                        <th className="py-2.5 px-4 text-right">Bukti Nota / Foto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {detailMaintenances.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            Belum ada catatan pemeliharaan atau perbaikan untuk kendaraan ini.
                          </td>
                        </tr>
                      ) : (
                        detailMaintenances.map((m) => {
                          const meta = MAINTENANCE_TYPE_META[m.jenisPenanganan];
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
                              <td className="py-3 px-4 align-top">
                                <div className="font-medium text-slate-800">
                                  {m.bengkelPelaksana}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  Dicatat: {m.dicatatOleh}
                                </div>
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
                                        mimeType: m.buktiMimeType || 'image/png',
                                        dataUrl: m.buktiDataUrl || '',
                                        caption: `${detailVehicle.nomorPolisi} · ${formatDateID(
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
                                    Tanpa Lampiran
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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Proof Preview Modal (Nota / Kuitansi / Foto Servis / PDF) */}
      {proofPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/65 p-4">
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
    </div>
  );
};
