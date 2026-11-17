export type RoleId =
  | 'SUPER_ADMIN'
  | 'ADMIN_PENGURUS'
  | 'KASUBAG_UMUM'
  | 'PETUGAS_LAPANGAN'
  | 'PIMPINAN_VIEWER';

export type KibCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export type ConditionStatus = 'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_BERAT';

export type MutationStatus =
  | 'MENUNGGU_KASUBAG'
  | 'DISETUJUI_KASUBAG'
  | 'SELESAI_VERIFIKASI'
  | 'DITOLAK';

export type DamageReportStatus =
  | 'BARU_DILAPORKAN'
  | 'DALAM_PENANGANAN'
  | 'SELESAI_DIPERBAIKI';

export type OpnameStatus =
  | 'BELUM_DICEK'
  | 'SESUAI'
  | 'KONDISI_BERUBAH'
  | 'SELISIH_TIDAK_ADA';

export type ModuleKey =
  | 'dashboard'
  | 'kib'
  | 'kendaraan'
  | 'qr_scanner'
  | 'mutasi'
  | 'opname_laporan'
  | 'rbac_audit';

export interface RolePermissions {
  canCreateAsset: boolean;
  canEditAsset: boolean;
  canDeleteAsset: boolean;
  canPrintQr: boolean;
  canApproveMutation: boolean;
  canVerifyMutation: boolean;
  canRequestMutation: boolean;
  canReportDamage: boolean;
  canResolveDamage: boolean;
  canPerformOpname: boolean;
  canExportReport: boolean;
  canViewAuditLogs: boolean;
  canManageRbacUsers: boolean;
}

export interface RoleProfile {
  id: RoleId;
  label: string;
  shortLabel: string;
  officerName: string;
  nip: string;
  unitName: string;
  assignedLocationId?: string;
  redirectModule: ModuleKey;
  permissions: RolePermissions;
  allowedModules: ModuleKey[];
}

export interface ManagedUserAccount {
  id: string;
  username: string;
  nip: string;
  officerName: string;
  role: RoleId;
  unitName: string;
  isActive: boolean;
}

export interface AuthSessionUser {
  id: string;
  username: string;
  nip: string;
  officerName: string;
  role: RoleId;
  unitName: string;
  redirectModule: ModuleKey;
}

export interface AuthSession {
  token: string;
  expiresAt: number;
  user: AuthSessionUser;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  identifier: string;
  officerName: string;
  role: RoleId | 'UNKNOWN';
  event:
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILED'
    | 'LOGOUT'
    | 'TOKEN_REFRESH'
    | 'SESSION_EXPIRED'
    | 'RBAC_DENIED'
    | 'USER_UPDATED'
    | 'RBAC_POLICY_UPDATED';
  detail: string;
  ipAddress: string;
}

export interface LocationUnit {
  id: string;
  code: string;
  name: string;
  type: 'MAKO' | 'POS_DAMKAR' | 'GUDANG_LOGISTIK';
  address: string;
  coordinator: string;
  phone: string;
  isFirePost: boolean;
}

export interface AssetItem {
  id: string;
  qrPayload: string;
  kibType: KibCategory;
  kodeBarang: string;
  nomorRegister: string;
  namaBarang: string;
  merkTipe: string;
  spesifikasi: string;
  tahunPerolehan: number;
  asalPerolehan: 'APBD Kab. Sidoarjo' | 'Hibah BNPB' | 'Hibah Provinsi Jatim' | 'Swadaya/Lainnya';
  jumlahUnit: number;
  satuan: string;
  nilaiPerolehan: number;
  kondisi: ConditionStatus;
  locationId: string;
  penanggungJawab: string;
  nomorPolisiOrSertifikat: string;
  lastOpnameDate: string;
  lastOpnameStatus: OpnameStatus;
  keterangan: string;
}

export interface AssetMutation {
  id: string;
  nomorSurat: string;
  assetId: string;
  fromLocationId: string;
  toLocationId: string;
  requestedBy: string;
  requestedByRole: RoleId;
  requestDate: string;
  reason: string;
  status: MutationStatus;
  reviewedBy?: string;
  reviewDate?: string;
  reviewNote?: string;
  verifiedBy?: string;
  verifyDate?: string;
}

export interface DamageReport {
  id: string;
  ticketNumber: string;
  assetId: string;
  locationId: string;
  reportedBy: string;
  reportDate: string;
  reportedCondition: Exclude<ConditionStatus, 'BAIK'>;
  chronology: string;
  estimatedAction: string;
  status: DamageReportStatus;
  handledBy?: string;
  resolvedDate?: string;
  resolutionNote?: string;
}

export interface OpnameCheckRecord {
  id: string;
  assetId: string;
  periodeTahun: number;
  locationId: string;
  checkedBy: string;
  checkDate: string;
  status: OpnameStatus;
  observedCondition: ConditionStatus;
  notes: string;
}

export type VehicleCategory = 'RODA_4' | 'RODA_2';

export type TaxStatus = 'LUNAS_AKTIF' | 'BELUM_BAYAR';

export type BpkbStatus = 'SUDAH_KELUAR' | 'BELUM_KELUAR_PROSES';

export type AcquisitionSource =
  | 'APBD Kabupaten'
  | 'Hibah'
  | 'Bantuan Pusat'
  | 'Bantuan Provinsi'
  | 'Lainnya';

export type MaintenanceType =
  | 'PEMELIHARAAN_RUTIN'
  | 'PERBAIKAN_RINGAN'
  | 'PERBAIKAN_BERAT';

export interface VehicleItem {
  id: string;
  kodeBarang: string;
  nomorRegister: string;
  kategori: VehicleCategory;
  namaKendaraan: string;
  merkTipe: string;
  tahunPerolehan: number;
  warna: string;
  nomorPolisi: string;
  nomorRangka: string;
  nomorMesin: string;
  statusPajak: TaxStatus;
  pajakBerlakuSampai: string;
  statusBpkb: BpkbStatus;
  nomorBpkb?: string;
  locationId: string;
  penanggungJawab: string;
  jabatanPemegang: string;
  kondisi: ConditionStatus;
  sumberPerolehan: AcquisitionSource;
  nilaiPerolehan: number;
  hibahInstansiPemberi?: string;
  hibahNomorBast?: string;
  hibahTanggal?: string;
  keterangan?: string;
}

export interface VehicleMaintenanceRecord {
  id: string;
  vehicleId: string;
  tanggalPerbaikan: string;
  jenisPenanganan: MaintenanceType;
  deskripsiKerusakan: string;
  tindakanPerbaikan: string;
  bengkelPelaksana: string;
  biaya: number;
  buktiNamaFile?: string;
  buktiMimeType?: string;
  buktiDataUrl?: string;
  dicatatOleh: string;
}
