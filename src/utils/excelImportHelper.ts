import * as XLSX from 'xlsx';
import {
  AcquisitionSource,
  AssetItem,
  BpkbStatus,
  ConditionStatus,
  KibCategory,
  LocationUnit,
  RoomAssetEntry,
  TaxStatus,
  VehicleCategory,
  VehicleItem,
} from '../types/simas';

export interface ParsedWorkbookData {
  fileName: string;
  sheetNames: string[];
  sheets: Record<string, string[][]>;
}

export interface DetectedSheetTable {
  headerRowIndex: number;
  headers: string[];
  rows: string[][];
}

function cellToString(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  return String(val).trim();
}

/**
 * Parses .xlsx, .xls, or .csv files using SheetJS and normalizes every sheet
 * into a 2D array of trimmed strings.
 */
export async function parseExcelOrCsvFile(file: File): Promise<ParsedWorkbookData> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheets: Record<string, string[][]> = {};

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;
    const rawMatrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: '',
      blankrows: false,
    });
    const normalized = rawMatrix
      .map((row) => (Array.isArray(row) ? row.map(cellToString) : []))
      .filter((row) => row.some((cell) => cell !== ''));
    sheets[sheetName] = normalized;
  }

  return {
    fileName: file.name,
    sheetNames: workbook.SheetNames.filter((n) => (sheets[n]?.length ?? 0) > 0),
    sheets,
  };
}

const HEADER_KEYWORDS = [
  'nama barang',
  'nama/jenis',
  'uraian',
  'kode barang',
  'kode rek',
  'register',
  'no. reg',
  'nopol',
  'nomor polisi',
  'merk',
  'tahun',
  'nilai',
  'harga',
  'kondisi',
  'keadaan',
  'jumlah',
  'lokasi',
  'ruang',
  'rangka',
  'mesin',
];

/**
 * Automatically finds the real header row in government KIB / BAST / SIMBADA / e-BMD
 * spreadsheets that often have title/kop rows at the top.
 */
export function detectHeaderAndRows(
  matrix: string[][],
  manualHeaderRow?: number
): DetectedSheetTable {
  if (!matrix || matrix.length === 0) {
    return { headerRowIndex: 0, headers: [], rows: [] };
  }

  let bestRowIdx = 0;
  if (typeof manualHeaderRow === 'number' && manualHeaderRow >= 0 && manualHeaderRow < matrix.length) {
    bestRowIdx = manualHeaderRow;
  } else {
    let bestScore = -1;
    const scanLimit = Math.min(matrix.length, 25);
    for (let r = 0; r < scanLimit; r++) {
      const row = matrix[r];
      const nonEmpty = row.filter((c) => c !== '').length;
      if (nonEmpty < 2) continue;
      let keywordHits = 0;
      for (const cell of row) {
        const lower = cell.toLowerCase();
        if (HEADER_KEYWORDS.some((kw) => lower.includes(kw))) {
          keywordHits += 1;
        }
      }
      const score = keywordHits * 10 + nonEmpty;
      if (keywordHits > 0 && score > bestScore) {
        bestScore = score;
        bestRowIdx = r;
      }
    }
  }

  const rawHeaders = matrix[bestRowIdx] ?? [];
  const maxCols = Math.max(
    rawHeaders.length,
    ...matrix.slice(bestRowIdx + 1, bestRowIdx + 50).map((r) => r.length)
  );
  const headers: string[] = [];
  for (let c = 0; c < maxCols; c++) {
    const h = (rawHeaders[c] ?? '').trim();
    headers.push(h || `Kolom ${c + 1}`);
  }

  const dataRows = matrix.slice(bestRowIdx + 1).filter((row) => {
    const nonEmptyCells = row.filter((c) => c !== '');
    if (nonEmptyCells.length === 0) return false;
    // Skip summary/total rows at bottom of BAST/KIB sheets
    const joined = nonEmptyCells.join(' ').toLowerCase();
    if (
      (joined.startsWith('jumlah') || joined.startsWith('total')) &&
      nonEmptyCells.length <= 4
    ) {
      return false;
    }
    return true;
  });

  return {
    headerRowIndex: bestRowIdx,
    headers,
    rows: dataRows,
  };
}

export function normalizeHeaderName(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Matches spreadsheet headers against candidate aliases and returns the column index,
 * or -1 if no column matched.
 */
export function autoMatchColumns(
  headers: string[],
  fieldAliases: Record<string, string[]>
): Record<string, number> {
  const normalizedHeaders = headers.map(normalizeHeaderName);
  const result: Record<string, number> = {};

  for (const [fieldKey, aliases] of Object.entries(fieldAliases)) {
    let matchedIdx = -1;
    // Exact match first
    for (const alias of aliases) {
      const idx = normalizedHeaders.findIndex((h) => h === alias);
      if (idx !== -1) {
        matchedIdx = idx;
        break;
      }
    }
    // Substring match second
    if (matchedIdx === -1) {
      for (const alias of aliases) {
        const idx = normalizedHeaders.findIndex((h) => h.includes(alias));
        if (idx !== -1) {
          matchedIdx = idx;
          break;
        }
      }
    }
    result[fieldKey] = matchedIdx;
  }

  return result;
}

export function parseIndonesianNumber(raw: string, fallback = 0): number {
  if (!raw) return fallback;
  let cleaned = raw.replace(/rp\.?/gi, '').replace(/\s+/g, '').trim();
  if (!cleaned) return fallback;
  // Detect Indonesian format like "1.732.777.100,00" vs US "1732777100.00"
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+(,\d{1,2})$/.test(cleaned)) {
    cleaned = cleaned.replace(',', '.');
  } else {
    cleaned = cleaned.replace(/,/g, '');
  }
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : fallback;
}

export function parseYearValue(raw: string, fallback = 2025): number {
  const match = raw.match(/\b(19\d{2}|20\d{2})\b/);
  if (match) return Number(match[1]);
  const num = parseIndonesianNumber(raw, fallback);
  return num >= 1950 && num <= 2035 ? Math.round(num) : fallback;
}

export function parseConditionValue(raw: string): ConditionStatus {
  const s = raw.toLowerCase().trim();
  if (!s || s === 'b' || s === 'baik' || s.includes('baik')) return 'BAIK';
  if (s === 'rb' || s.includes('berat')) return 'RUSAK_BERAT';
  if (s === 'rr' || s.includes('ringan') || s.includes('kurang')) return 'RUSAK_RINGAN';
  return 'BAIK';
}

export function parseKibCategory(raw: string, kodeBarang = ''): KibCategory {
  const s = raw.toUpperCase().trim();
  if (s === 'A' || s.includes('KIB A') || s.includes('TANAH')) return 'A';
  if (s === 'B' || s.includes('KIB B') || s.includes('PERALATAN')) return 'B';
  if (s === 'C' || s.includes('KIB C') || s.includes('GEDUNG')) return 'C';
  if (s === 'D' || s.includes('KIB D') || s.includes('JARINGAN') || s.includes('JALAN')) return 'D';
  if (s === 'E' || s.includes('KIB E') || s.includes('LAIN')) return 'E';
  if (s === 'F' || s.includes('KIB F') || s.includes('KONSTRUKSI')) return 'F';

  // Derive from Permendagri 108/2016 kode barang prefix
  if (kodeBarang.startsWith('1.3.1')) return 'A';
  if (kodeBarang.startsWith('1.3.2')) return 'B';
  if (kodeBarang.startsWith('1.3.3')) return 'C';
  if (kodeBarang.startsWith('1.3.4')) return 'D';
  if (kodeBarang.startsWith('1.3.5')) return 'E';
  if (kodeBarang.startsWith('1.3.6')) return 'F';
  return 'B';
}

export function resolveLocationId(
  rawLocation: string,
  locations: LocationUnit[],
  defaultLocationId: string
): string {
  const q = rawLocation.toLowerCase().trim();
  if (!q) return defaultLocationId;
  for (const loc of locations) {
    if (
      loc.id.toLowerCase() === q ||
      loc.code.toLowerCase() === q ||
      loc.name.toLowerCase() === q ||
      q.includes(loc.code.toLowerCase())
    ) {
      return loc.id;
    }
  }
  const keywords: [string, string][] = [
    ['mako', 'LOC-MAKO'],
    ['gudang', 'LOC-MAKO'],
    ['kota', 'LOC-POS-01'],
    ['buduran', 'LOC-POS-02'],
    ['waru', 'LOC-POS-03'],
    ['krian', 'LOC-POS-04'],
    ['porong', 'LOC-POS-05'],
    ['candi', 'LOC-POS-06'],
    ['sukodono', 'LOC-POS-07'],
  ];
  for (const [kw, id] of keywords) {
    if (q.includes(kw)) return id;
  }
  return defaultLocationId;
}

export function parseAsalPerolehanKib(
  raw: string
): AssetItem['asalPerolehan'] {
  const s = raw.toLowerCase();
  if (s.includes('bnpb') || s.includes('pusat')) return 'Hibah BNPB';
  if (s.includes('provinsi') || s.includes('jatim')) return 'Hibah Provinsi Jatim';
  if (s.includes('swadaya') || s.includes('hibah') || s.includes('lain')) {
    return s.includes('apbd') ? 'APBD Kab. Sidoarjo' : 'Swadaya/Lainnya';
  }
  return 'APBD Kab. Sidoarjo';
}

export function parseVehicleAcquisitionSource(raw: string): AcquisitionSource {
  const s = raw.toLowerCase();
  if (s.includes('pusat') || s.includes('bnpb')) return 'Bantuan Pusat';
  if (s.includes('provinsi') || s.includes('jatim')) return 'Bantuan Provinsi';
  if (s.includes('hibah')) return 'Hibah';
  if (s.includes('apbd')) return 'APBD Kabupaten';
  return s ? 'Lainnya' : 'APBD Kabupaten';
}

export function parseVehicleCategory(raw: string, nama = ''): VehicleCategory {
  const s = `${raw} ${nama}`.toLowerCase();
  if (s.includes('roda 2') || s.includes('r2') || s.includes('motor') || s.includes('sepeda')) {
    return 'RODA_2';
  }
  return 'RODA_4';
}

export function parseTaxStatus(raw: string): TaxStatus {
  const s = raw.toLowerCase();
  if (s.includes('belum') || s.includes('tunggak') || s.includes('mati')) {
    return 'BELUM_BAYAR';
  }
  return 'LUNAS_AKTIF';
}

export function parseBpkbStatus(raw: string, nomorBpkb = ''): BpkbStatus {
  const s = raw.toLowerCase();
  if (s.includes('belum') || s.includes('proses')) return 'BELUM_KELUAR_PROSES';
  if (s.includes('sudah') || s.includes('ada') || nomorBpkb.trim()) return 'SUDAH_KELUAR';
  return 'SUDAH_KELUAR';
}

export function parseDateString(raw: string, fallback = ''): string {
  const s = raw.trim();
  if (!s) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return fallback;
}

export function exportWorkbookXlsx(
  sheetName: string,
  headers: string[],
  rows: (string | number)[][],
  fileName: string
): void {
  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 16) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}

export const KIB_FIELD_DEFINITIONS = [
  { key: 'namaBarang', label: 'Nama / Jenis Barang', required: true },
  { key: 'kodeBarang', label: 'Kode Barang', required: false },
  { key: 'nomorRegister', label: 'Nomor Register', required: false },
  { key: 'kibType', label: 'Golongan KIB (A-F)', required: false },
  { key: 'merkTipe', label: 'Merk / Tipe / Ukuran', required: false },
  { key: 'spesifikasi', label: 'Spesifikasi / Bahan', required: false },
  { key: 'tahunPerolehan', label: 'Tahun Perolehan', required: false },
  { key: 'jumlahUnit', label: 'Jumlah', required: false },
  { key: 'satuan', label: 'Satuan', required: false },
  { key: 'nilaiPerolehan', label: 'Nilai / Harga Perolehan', required: false },
  { key: 'kondisi', label: 'Kondisi (B / RR / RB)', required: false },
  { key: 'locationId', label: 'Lokasi / Pos Penempatan', required: false },
  { key: 'penanggungJawab', label: 'Penanggung Jawab / Pemegang', required: false },
  { key: 'nomorPolisiOrSertifikat', label: 'No. Polisi / Sertifikat / SN', required: false },
  { key: 'asalPerolehan', label: 'Asal Perolehan', required: false },
  { key: 'keterangan', label: 'Keterangan', required: false },
] as const;

export const KIB_FIELD_ALIASES: Record<string, string[]> = {
  namaBarang: ['nama barang', 'nama jenis barang', 'jenis barang', 'uraian barang', 'nama aset', 'uraian'],
  kodeBarang: ['kode barang', 'kode rek', 'kode aset', 'kode sub rincian'],
  nomorRegister: ['nomor register', 'no register', 'no reg', 'register', 'reg'],
  kibType: ['golongan kib', 'kib', 'jenis kib'],
  merkTipe: ['merk tipe', 'merk model', 'merk', 'type', 'tipe'],
  spesifikasi: ['spesifikasi', 'ukuran', 'bahan', 'konstruksi'],
  tahunPerolehan: ['tahun perolehan', 'tahun pembelian', 'tahun', 'thn'],
  jumlahUnit: ['jumlah unit', 'jumlah barang', 'jumlah', 'jml', 'qty'],
  satuan: ['satuan', 'unit'],
  nilaiPerolehan: ['nilai perolehan', 'harga perolehan', 'harga', 'nilai', 'jumlah harga'],
  kondisi: ['kondisi', 'keadaan barang', 'keadaan', 'status kondisi'],
  locationId: ['lokasi', 'pos', 'penempatan', 'ruang', 'unit kerja'],
  penanggungJawab: ['penanggung jawab', 'pemegang', 'pengguna', 'pj'],
  nomorPolisiOrSertifikat: ['nomor polisi', 'no polisi', 'nopol', 'sertifikat', 'nomor rangka', 'serial'],
  asalPerolehan: ['asal perolehan', 'asal usul', 'sumber dana', 'sumber'],
  keterangan: ['keterangan', 'catatan', 'ket'],
};

export const VEHICLE_FIELD_DEFINITIONS = [
  { key: 'namaKendaraan', label: 'Nama / Jenis Kendaraan', required: true },
  { key: 'nomorPolisi', label: 'Nomor Polisi (Plat)', required: false },
  { key: 'kategori', label: 'Kategori (Roda 4 / Roda 2)', required: false },
  { key: 'kodeBarang', label: 'Kode Barang', required: false },
  { key: 'nomorRegister', label: 'Nomor Register', required: false },
  { key: 'merkTipe', label: 'Merk / Tipe', required: false },
  { key: 'tahunPerolehan', label: 'Tahun Perolehan', required: false },
  { key: 'warna', label: 'Warna', required: false },
  { key: 'nomorRangka', label: 'Nomor Rangka', required: false },
  { key: 'nomorMesin', label: 'Nomor Mesin', required: false },
  { key: 'statusPajak', label: 'Status Pajak', required: false },
  { key: 'pajakBerlakuSampai', label: 'Masa Pajak Berakhir', required: false },
  { key: 'statusBpkb', label: 'Keterangan BPKB', required: false },
  { key: 'nomorBpkb', label: 'Nomor BPKB', required: false },
  { key: 'locationId', label: 'Pos Penempatan', required: false },
  { key: 'penanggungJawab', label: 'Pemegang / Penanggung Jawab', required: false },
  { key: 'sumberPerolehan', label: 'Sumber Perolehan', required: false },
  { key: 'nilaiPerolehan', label: 'Nilai Perolehan', required: false },
  { key: 'kondisi', label: 'Kondisi', required: false },
  { key: 'keterangan', label: 'Keterangan', required: false },
] as const;

export const VEHICLE_FIELD_ALIASES: Record<string, string[]> = {
  namaKendaraan: ['nama kendaraan', 'nama barang', 'jenis kendaraan', 'uraian', 'nama'],
  nomorPolisi: ['nomor polisi', 'no polisi', 'plat nomor', 'nopol', 'plat'],
  kategori: ['kategori', 'jenis roda', 'roda'],
  kodeBarang: ['kode barang', 'kode aset'],
  nomorRegister: ['nomor register', 'no register', 'no reg', 'register'],
  merkTipe: ['merk tipe', 'merk model', 'merk', 'tipe'],
  tahunPerolehan: ['tahun perolehan', 'tahun pembelian', 'tahun', 'thn'],
  warna: ['warna'],
  nomorRangka: ['nomor rangka', 'no rangka', 'rangka', 'vin'],
  nomorMesin: ['nomor mesin', 'no mesin', 'mesin'],
  statusPajak: ['status pajak', 'pajak'],
  pajakBerlakuSampai: ['masa pajak', 'pajak berakhir', 'jatuh tempo pajak', 'tgl pajak'],
  statusBpkb: ['status bpkb', 'keterangan bpkb'],
  nomorBpkb: ['nomor bpkb', 'no bpkb', 'bpkb'],
  locationId: ['pos penempatan', 'lokasi', 'pos', 'penempatan', 'unit'],
  penanggungJawab: ['penanggung jawab', 'pemegang', 'pengemudi', 'pj'],
  sumberPerolehan: ['sumber perolehan', 'asal usul', 'sumber'],
  nilaiPerolehan: ['nilai perolehan', 'harga perolehan', 'harga', 'nilai'],
  kondisi: ['kondisi', 'keadaan'],
  keterangan: ['keterangan', 'catatan'],
};

export const KIR_FIELD_DEFINITIONS = [
  { key: 'namaBarang', label: 'Nama / Jenis Barang', required: true },
  { key: 'merkModel', label: 'Merk / Model', required: false },
  { key: 'tahunPerolehan', label: 'Tahun Perolehan', required: false },
  { key: 'kodeBarang', label: 'Kode Barang', required: false },
  { key: 'nomorRegister', label: 'No. Register', required: false },
  { key: 'jumlah', label: 'Jumlah', required: false },
  { key: 'satuan', label: 'Satuan', required: false },
  { key: 'kondisi', label: 'Kondisi (B / RR / RB)', required: false },
  { key: 'keterangan', label: 'Keterangan', required: false },
] as const;

export const KIR_FIELD_ALIASES: Record<string, string[]> = {
  namaBarang: ['nama jenis barang', 'nama barang', 'jenis barang', 'uraian'],
  merkModel: ['merk model', 'merk tipe', 'merk'],
  tahunPerolehan: ['tahun perolehan', 'tahun pembelian', 'tahun', 'thn'],
  kodeBarang: ['kode barang', 'kode'],
  nomorRegister: ['no register', 'nomor register', 'no reg', 'register', 'reg'],
  jumlah: ['jumlah', 'jml', 'qty'],
  satuan: ['satuan', 'unit'],
  kondisi: ['kondisi', 'keadaan barang', 'keadaan'],
  keterangan: ['keterangan', 'ket', 'catatan'],
};

export function downloadKibExcelTemplate(): void {
  exportWorkbookXlsx(
    'Template_Import_KIB',
    [
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
    [
      [
        'B',
        '1.3.2.05.01.005',
        '0001',
        'Pompa Alkon Pemadam Portabel',
        'Honda GX-160 / Shibaura',
        'Debit 500 L/menit lengkap selang hisap 2.5 inch',
        2026,
        'APBD Kab. Sidoarjo',
        2,
        'Unit',
        24500000,
        'Baik',
        'Pos Damkar Kota Sidoarjo',
        'Satuman',
        'SN-HB-2026-001',
        'Import dari aplikasi BMD / Excel',
      ],
    ],
    'template-import-kib-simas-bmd.xlsx'
  );
}

export function downloadVehicleExcelTemplate(): void {
  exportWorkbookXlsx(
    'Template_Kendaraan',
    [
      'Kategori',
      'Kode Barang',
      'Nomor Register',
      'Nama Kendaraan',
      'Merk / Tipe',
      'Tahun Perolehan',
      'Warna',
      'Nomor Polisi',
      'Nomor Rangka',
      'Nomor Mesin',
      'Status Pajak',
      'Masa Pajak Berakhir',
      'Keterangan BPKB',
      'Nomor BPKB',
      'Pos Penempatan',
      'Penanggung Jawab',
      'Sumber Perolehan',
      'Nilai Perolehan',
      'Kondisi',
      'Keterangan',
    ],
    [
      [
        'Roda 4',
        '1.3.2.02.01.06.004',
        '0021',
        'Mobil Tangki Air Suplai Damkar',
        'Isuzu Elf NMR 71',
        2026,
        'Merah',
        'W 9901 NP',
        'MHCNMR71LPJ001234',
        '4HG1-889120',
        'Lunas/Aktif',
        '2027-05-15',
        'BPKB Sudah Keluar',
        'U-01234567',
        'Pos Damkar Waru',
        'Sutoyo',
        'APBD Kabupaten',
        685000000,
        'Baik',
        'Contoh baris import kendaraan',
      ],
    ],
    'template-import-kendaraan-simas-bmd.xlsx'
  );
}

export function downloadKirExcelTemplate(): void {
  exportWorkbookXlsx(
    'Template_KIR',
    [
      'Nama / Jenis Barang',
      'Merk / Model',
      'Tahun',
      'Kode Barang',
      'No. Register',
      'Jumlah',
      'Satuan',
      'Kondisi',
      'Keterangan',
    ],
    [
      [
        'Komputer PC All-in-One Posko',
        'Lenovo IdeaCentre AIO 24',
        2025,
        '1.3.2.10.01.02.001',
        '0012',
        2,
        'Unit',
        'Baik',
        'Meja operator piket 24 jam',
      ],
    ],
    'template-import-kir-simas-bmd.xlsx'
  );
}

export function mapRowsToKibAssets(
  rows: string[][],
  mapping: Record<string, number>,
  locations: LocationUnit[],
  defaultLocationId: string,
  defaultOfficer: string
): Omit<AssetItem, 'id' | 'qrPayload'>[] {
  const today = new Date().toISOString().slice(0, 10);
  const get = (row: string[], key: string) => {
    const idx = mapping[key];
    return typeof idx === 'number' && idx >= 0 ? (row[idx] ?? '').trim() : '';
  };

  const results: Omit<AssetItem, 'id' | 'qrPayload'>[] = [];
  rows.forEach((row, i) => {
    const namaBarang = get(row, 'namaBarang');
    if (!namaBarang) return;

    const kodeBarang = get(row, 'kodeBarang') || '1.3.2.05.01.001';
    const nomorRegister = (get(row, 'nomorRegister') || String(i + 1)).padStart(4, '0');
    const kibType = parseKibCategory(get(row, 'kibType'), kodeBarang);
    const merkTipe = get(row, 'merkTipe') || '-';
    const spesifikasi = get(row, 'spesifikasi') || `${namaBarang} (${merkTipe})`;
    const tahunPerolehan = parseYearValue(get(row, 'tahunPerolehan'), 2025);
    const jumlahUnit = Math.max(1, Math.round(parseIndonesianNumber(get(row, 'jumlahUnit'), 1)));
    const satuan = get(row, 'satuan') || 'Unit';
    const nilaiPerolehan = Math.max(0, parseIndonesianNumber(get(row, 'nilaiPerolehan'), 0));
    const kondisi = parseConditionValue(get(row, 'kondisi'));
    const locationId = resolveLocationId(
      get(row, 'locationId'),
      locations,
      defaultLocationId
    );
    const locObj = locations.find((l) => l.id === locationId);
    const penanggungJawab =
      get(row, 'penanggungJawab') || locObj?.coordinator || defaultOfficer;
    const nomorPolisiOrSertifikat = get(row, 'nomorPolisiOrSertifikat');
    const asalPerolehan = parseAsalPerolehanKib(get(row, 'asalPerolehan'));
    const keterangan =
      get(row, 'keterangan') || 'Diimpor melalui modul Import Excel SIMAS-BMD.';

    results.push({
      kibType,
      kodeBarang,
      nomorRegister,
      namaBarang,
      merkTipe,
      spesifikasi,
      tahunPerolehan,
      asalPerolehan,
      jumlahUnit,
      satuan,
      nilaiPerolehan,
      kondisi,
      locationId,
      penanggungJawab,
      nomorPolisiOrSertifikat,
      lastOpnameDate: today,
      lastOpnameStatus: 'BELUM_DICEK',
      keterangan,
    });
  });

  return results;
}

export function mapRowsToVehicles(
  rows: string[][],
  mapping: Record<string, number>,
  locations: LocationUnit[],
  defaultLocationId: string,
  defaultOfficer: string
): Omit<VehicleItem, 'id'>[] {
  const nextYear = new Date(new Date().setFullYear(new Date().getFullYear() + 1))
    .toISOString()
    .slice(0, 10);

  const get = (row: string[], key: string) => {
    const idx = mapping[key];
    return typeof idx === 'number' && idx >= 0 ? (row[idx] ?? '').trim() : '';
  };

  const results: Omit<VehicleItem, 'id'>[] = [];
  rows.forEach((row, i) => {
    const namaKendaraan = get(row, 'namaKendaraan');
    if (!namaKendaraan) return;

    const kategori = parseVehicleCategory(get(row, 'kategori'), namaKendaraan);
    const kodeBarang =
      get(row, 'kodeBarang') ||
      (kategori === 'RODA_2' ? '1.3.2.02.01.04.001' : '1.3.2.02.01.06.004');
    const nomorRegister = (get(row, 'nomorRegister') || String(i + 1)).padStart(4, '0');
    const merkTipe = get(row, 'merkTipe') || namaKendaraan;
    const tahunPerolehan = parseYearValue(get(row, 'tahunPerolehan'), 2025);
    const warna = get(row, 'warna') || 'Merah';
    const nomorPolisi = (get(row, 'nomorPolisi') || `W ${9000 + i} NP`).toUpperCase();
    const nomorRangka = (get(row, 'nomorRangka') || '-').toUpperCase();
    const nomorMesin = (get(row, 'nomorMesin') || '-').toUpperCase();
    const statusPajak = parseTaxStatus(get(row, 'statusPajak'));
    const pajakBerlakuSampai = parseDateString(get(row, 'pajakBerlakuSampai'), nextYear);
    const nomorBpkb = get(row, 'nomorBpkb');
    const statusBpkb = parseBpkbStatus(get(row, 'statusBpkb'), nomorBpkb);
    const locationId = resolveLocationId(
      get(row, 'locationId'),
      locations,
      defaultLocationId
    );
    const locObj = locations.find((l) => l.id === locationId);
    const penanggungJawab =
      get(row, 'penanggungJawab') || locObj?.coordinator || defaultOfficer;
    const sumberPerolehan = parseVehicleAcquisitionSource(get(row, 'sumberPerolehan'));
    const nilaiPerolehan = Math.max(0, parseIndonesianNumber(get(row, 'nilaiPerolehan'), 0));
    const kondisi = parseConditionValue(get(row, 'kondisi'));
    const keterangan =
      get(row, 'keterangan') || 'Diimpor dari file Excel / aplikasi eksternal.';

    results.push({
      kodeBarang,
      nomorRegister,
      kategori,
      namaKendaraan,
      merkTipe,
      tahunPerolehan,
      warna,
      nomorPolisi,
      nomorRangka,
      nomorMesin,
      statusPajak,
      pajakBerlakuSampai,
      statusBpkb,
      nomorBpkb: nomorBpkb || undefined,
      locationId,
      penanggungJawab,
      jabatanPemegang: locObj ? `Penanggung Jawab ${locObj.name}` : 'Operator Armada',
      kondisi,
      sumberPerolehan,
      nilaiPerolehan,
      keterangan,
    });
  });

  return results;
}

export function mapRowsToKirEntries(
  rows: string[][],
  mapping: Record<string, number>,
  roomId: string
): Omit<RoomAssetEntry, 'id'>[] {
  const get = (row: string[], key: string) => {
    const idx = mapping[key];
    return typeof idx === 'number' && idx >= 0 ? (row[idx] ?? '').trim() : '';
  };

  const results: Omit<RoomAssetEntry, 'id'>[] = [];
  rows.forEach((row, i) => {
    const namaBarang = get(row, 'namaBarang');
    if (!namaBarang) return;

    results.push({
      roomId,
      namaBarang,
      merkModel: get(row, 'merkModel') || '-',
      tahunPerolehan: parseYearValue(get(row, 'tahunPerolehan'), 2025),
      kodeBarang: get(row, 'kodeBarang') || '1.3.2.05.01.001',
      nomorRegister: (get(row, 'nomorRegister') || String(i + 1)).padStart(4, '0'),
      jumlah: Math.max(1, Math.round(parseIndonesianNumber(get(row, 'jumlah'), 1))),
      satuan: get(row, 'satuan') || 'Unit',
      kondisi: parseConditionValue(get(row, 'kondisi')),
      keterangan: get(row, 'keterangan') || 'Import Excel',
    });
  });

  return results;
}
