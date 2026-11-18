import {
  AssetItem,
  ConditionStatus,
  DamageReportStatus,
  KibCategory,
  LocationUnit,
  MutationStatus,
  OpnameStatus,
} from '../types/simas';

export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactIDR(amount: number): string {
  if (amount >= 1_000_000_000_000) {
    return `Rp ${(amount / 1_000_000_000_000).toFixed(2).replace('.', ',')} T`;
  }
  if (amount >= 1_000_000_000) {
    return `Rp ${(amount / 1_000_000_000).toFixed(2).replace('.', ',')} M`;
  }
  if (amount >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toFixed(1).replace('.', ',')} Jt`;
  }
  return formatIDR(amount);
}

export function formatDateID(isoDate: string): string {
  if (!isoDate) return '-';
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export interface TaxExpiryInfo {
  status: 'EXPIRED' | 'EXPIRING_SOON' | 'ACTIVE' | 'UNKNOWN';
  daysRemaining: number;
  shortText: string;
  textClass: string;
}

export function getTaxExpiryInfo(isoDate?: string): TaxExpiryInfo {
  if (!isoDate) {
    return {
      status: 'UNKNOWN',
      daysRemaining: 0,
      shortText: 'Tanggal belum diisi',
      textClass: 'text-slate-500',
    };
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  const expiry = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(isoDate);
  if (Number.isNaN(expiry.getTime())) {
    return {
      status: 'UNKNOWN',
      daysRemaining: 0,
      shortText: isoDate,
      textClass: 'text-slate-500',
    };
  }
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expiryMidnight = new Date(
    expiry.getFullYear(),
    expiry.getMonth(),
    expiry.getDate()
  );
  const daysRemaining = Math.round(
    (expiryMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysRemaining < 0) {
    return {
      status: 'EXPIRED',
      daysRemaining,
      shortText: `Berakhir ${Math.abs(daysRemaining)} hari lalu`,
      textClass: 'text-red-700',
    };
  }
  if (daysRemaining === 0) {
    return {
      status: 'EXPIRING_SOON',
      daysRemaining: 0,
      shortText: 'Berakhir hari ini',
      textClass: 'text-red-700',
    };
  }
  if (daysRemaining <= 30) {
    return {
      status: 'EXPIRING_SOON',
      daysRemaining,
      shortText: `Segera berakhir (${daysRemaining} hari lagi)`,
      textClass: 'text-amber-700',
    };
  }
  return {
    status: 'ACTIVE',
    daysRemaining,
    shortText: `Aktif (${daysRemaining} hari lagi)`,
    textClass: 'text-emerald-700',
  };
}

export const KIB_META: Record<
  KibCategory,
  { code: string; name: string; fullName: string; description: string }
> = {
  A: {
    code: 'KIB A',
    name: 'Tanah',
    fullName: 'KIB A · Tanah',
    description: 'Lahan Mako BPBD, Pos Damkar, dan fasilitas penunjang kebencanaan.',
  },
  B: {
    code: 'KIB B',
    name: 'Peralatan & Mesin',
    fullName: 'KIB B · Peralatan & Mesin',
    description: 'Armada damkar, kendaraan evakuasi, pompa, perahu LCR, komunikasi & TIK.',
  },
  C: {
    code: 'KIB C',
    name: 'Gedung & Bangunan',
    fullName: 'KIB C · Gedung & Bangunan',
    description: 'Gedung kantor Pusdalops, gudang logistik, dan hanggar armada pos.',
  },
  D: {
    code: 'KIB D',
    name: 'Jalan, Irigasi & Jaringan',
    fullName: 'KIB D · Jalan, Irigasi & Jaringan',
    description: 'Instalasi hydrant pemadam, jaringan EWS banjir, dan akses pos.',
  },
  E: {
    code: 'KIB E',
    name: 'Aset Tetap Lainnya',
    fullName: 'KIB E · Aset Tetap Lainnya',
    description: 'Peta rawan bencana, dokumen kajian risiko, dan koleksi perpustakaan teknis.',
  },
  F: {
    code: 'KIB F',
    name: 'Konstruksi Dalam Pengerjaan',
    fullName: 'KIB F · Konstruksi Dalam Pengerjaan',
    description: 'Pekerjaan pembangunan dan rehabilitasi sarana prasarana dalam progres.',
  },
};

export const CONDITION_META: Record<
  ConditionStatus,
  {
    label: string;
    shortLabel: string;
    textClass: string;
    dotColor: string;
    barColor: string;
    subtleSurface: string;
  }
> = {
  BAIK: {
    label: 'Baik',
    shortLabel: 'Baik',
    textClass: 'text-emerald-700',
    dotColor: 'bg-emerald-600',
    barColor: '#16A34A',
    subtleSurface: 'bg-emerald-50 border-emerald-200',
  },
  RUSAK_RINGAN: {
    label: 'Rusak Ringan',
    shortLabel: 'Rusak Ringan',
    textClass: 'text-amber-700',
    dotColor: 'bg-amber-600',
    barColor: '#D97706',
    subtleSurface: 'bg-amber-50 border-amber-200',
  },
  RUSAK_BERAT: {
    label: 'Rusak Berat',
    shortLabel: 'Rusak Berat',
    textClass: 'text-red-700',
    dotColor: 'bg-red-600',
    barColor: '#DC2626',
    subtleSurface: 'bg-red-50 border-red-200',
  },
};

export const MUTATION_STATUS_META: Record<
  MutationStatus,
  { label: string; textClass: string; indicatorClass: string }
> = {
  MENUNGGU_KASUBAG: {
    label: 'Menunggu Approval Kasubag',
    textClass: 'text-amber-700',
    indicatorClass: 'bg-amber-600',
  },
  DISETUJUI_KASUBAG: {
    label: 'Disetujui · Menunggu Verifikasi Fisik',
    textClass: 'text-blue-800',
    indicatorClass: 'bg-blue-700',
  },
  SELESAI_VERIFIKASI: {
    label: 'Selesai & Terverifikasi',
    textClass: 'text-emerald-700',
    indicatorClass: 'bg-emerald-600',
  },
  DITOLAK: {
    label: 'Ditolak',
    textClass: 'text-red-700',
    indicatorClass: 'bg-red-600',
  },
};

export const DAMAGE_STATUS_META: Record<
  DamageReportStatus,
  { label: string; textClass: string; indicatorClass: string }
> = {
  BARU_DILAPORKAN: {
    label: 'Baru Dilaporkan',
    textClass: 'text-red-700',
    indicatorClass: 'bg-red-600',
  },
  DALAM_PENANGANAN: {
    label: 'Dalam Penanganan Teknisi',
    textClass: 'text-amber-700',
    indicatorClass: 'bg-amber-600',
  },
  SELESAI_DIPERBAIKI: {
    label: 'Selesai Diperbaiki',
    textClass: 'text-emerald-700',
    indicatorClass: 'bg-emerald-600',
  },
};

export const OPNAME_STATUS_META: Record<
  OpnameStatus,
  { label: string; textClass: string; indicatorClass: string }
> = {
  BELUM_DICEK: {
    label: 'Belum Dicek',
    textClass: 'text-slate-600',
    indicatorClass: 'bg-slate-400',
  },
  SESUAI: {
    label: 'Sesuai / Ada',
    textClass: 'text-emerald-700',
    indicatorClass: 'bg-emerald-600',
  },
  KONDISI_BERUBAH: {
    label: 'Kondisi Berubah',
    textClass: 'text-amber-700',
    indicatorClass: 'bg-amber-600',
  },
  SELISIH_TIDAK_ADA: {
    label: 'Selisih / Tidak Ditemukan',
    textClass: 'text-red-700',
    indicatorClass: 'bg-red-600',
  },
};

export function exportAssetsToCSV(
  assets: AssetItem[],
  locations: LocationUnit[],
  filename = 'simas-bmd-bpbd-sidoarjo-kib.csv'
): void {
  const locMap = new Map(locations.map((l) => [l.id, l.name]));
  const headers = [
    'ID Aset',
    'Kategori KIB',
    'Kode Barang',
    'Nomor Register',
    'Nama Barang',
    'Merk / Tipe',
    'Tahun Perolehan',
    'Asal Perolehan',
    'Jumlah',
    'Satuan',
    'Nilai Perolehan (IDR)',
    'Kondisi',
    'Lokasi Penempatan',
    'Penanggung Jawab',
    'No. Polisi / Sertifikat',
    'Status Opname Terakhir',
    'Tanggal Opname Terakhir',
  ];

  const escapeCsv = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = assets.map((a) =>
    [
      a.id,
      `KIB ${a.kibType}`,
      a.kodeBarang,
      a.nomorRegister,
      a.namaBarang,
      a.merkTipe,
      a.tahunPerolehan,
      a.asalPerolehan,
      a.jumlahUnit,
      a.satuan,
      a.nilaiPerolehan,
      CONDITION_META[a.kondisi].label,
      locMap.get(a.locationId) ?? a.locationId,
      a.penanggungJawab,
      a.nomorPolisiOrSertifikat,
      OPNAME_STATUS_META[a.lastOpnameStatus].label,
      a.lastOpnameDate,
    ]
      .map(escapeCsv)
      .join(',')
  );

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
