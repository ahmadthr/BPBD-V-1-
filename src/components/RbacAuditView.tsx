import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Clock,
  Edit3,
  FileSpreadsheet,
  Key,
  MapPin,
  Minus,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Upload,
  UserCog,
  X,
} from 'lucide-react';
import {
  apiCreateUser,
  apiGetAuditLogs,
  apiUpdateRolePolicy,
  apiUpdateUser,
} from '../utils/authClient';
import { INITIAL_LOCATIONS, ROLE_PROFILES } from '../data/initialData';
import { ExcelImportModal } from './ExcelImportModal';
import {
  KIB_FIELD_ALIASES,
  KIB_FIELD_DEFINITIONS,
  KIR_FIELD_ALIASES,
  KIR_FIELD_DEFINITIONS,
  VEHICLE_FIELD_ALIASES,
  VEHICLE_FIELD_DEFINITIONS,
  downloadKibExcelTemplate,
  downloadKirExcelTemplate,
  downloadVehicleExcelTemplate,
  mapRowsToKibAssets,
  mapRowsToKirEntries,
  mapRowsToVehicles,
} from '../utils/excelImportHelper';
import {
  AssetItem,
  AuditLogEntry,
  AuthSession,
  LocationUnit,
  ManagedUserAccount,
  ModuleKey,
  RoleId,
  RolePermissions,
  RoleProfile,
  RoomAssetEntry,
  RoomUnit,
  VehicleItem,
} from '../types/simas';

interface RbacAuditViewProps {
  session: AuthSession;
  roleConfigs: Record<RoleId, RoleProfile>;
  users: ManagedUserAccount[];
  remainingSeconds: number;
  locations?: LocationUnit[];
  rooms?: RoomUnit[];
  onImportAssets?: (items: Omit<AssetItem, 'id' | 'qrPayload'>[]) => void;
  onImportVehicles?: (items: Omit<VehicleItem, 'id'>[]) => void;
  onImportRoomItems?: (items: Omit<RoomAssetEntry, 'id'>[]) => void;
  onRefreshSession: () => Promise<void>;
  onRbacUpdated: (payload: {
    roleConfigs?: Record<RoleId, RoleProfile>;
    users?: ManagedUserAccount[];
    updatedSelfUser?: ManagedUserAccount;
    toast?: string;
  }) => void;
}

const PERMISSION_ROWS: {
  label: string;
  key: keyof RolePermissions;
}[] = [
  { label: 'Input Perolehan Aset Baru (KIB A–F)', key: 'canCreateAsset' },
  { label: 'Ubah / Edit Register Master KIB', key: 'canEditAsset' },
  { label: 'Hapus Register Aset KIB', key: 'canDeleteAsset' },
  { label: 'Cetak & Unduh Label QR Code & KIR', key: 'canPrintQr' },
  { label: 'Ajukan Usulan Mutasi Lokasi', key: 'canRequestMutation' },
  { label: 'Approval (Setujui/Tolak) Mutasi Aset', key: 'canApproveMutation' },
  { label: 'Verifikasi Fisik & Pindah Lokasi KIB', key: 'canVerifyMutation' },
  { label: 'Input Laporan Kerusakan Lapangan', key: 'canReportDamage' },
  { label: 'Tindak Lanjut & Pemulihan Tiket Rusak', key: 'canResolveDamage' },
  { label: 'Cek Kondisi & Opname Fisik Mandiri', key: 'canPerformOpname' },
  { label: 'Unduh / Cetak Laporan & Berita Acara', key: 'canExportReport' },
  { label: 'Akses Log Audit Keamanan Autentikasi', key: 'canViewAuditLogs' },
  { label: 'Kelola Pengguna, Nama & Hak Akses RBAC', key: 'canManageRbacUsers' },
];

const ROLE_ORDER: RoleId[] = [
  'SUPER_ADMIN',
  'ADMIN_PENGURUS',
  'KASUBAG_UMUM',
  'PETUGAS_LAPANGAN',
  'PIMPINAN_VIEWER',
];

const MODULE_OPTIONS: { key: ModuleKey; label: string }[] = [
  { key: 'rbac_audit', label: 'Keamanan & RBAC' },
  { key: 'kib', label: 'Master KIB A–F' },
  { key: 'kendaraan', label: 'Kendaraan R4/R2' },
  { key: 'kir', label: 'Kartu Ruang (KIR)' },
  { key: 'mutasi', label: 'Approval Mutasi' },
  { key: 'qr_scanner', label: 'Scanner QR' },
  { key: 'dashboard', label: 'Dashboard Eksekutif' },
  { key: 'opname_laporan', label: 'Opname & Laporan' },
  { key: 'pengajuan_pemeliharaan', label: 'Pengajuan Pemeliharaan' },
];

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatAuditTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
}

const EVENT_LABEL: Record<
  AuditLogEntry['event'],
  { label: string; textClass: string }
> = {
  LOGIN_SUCCESS: { label: 'Login Berhasil', textClass: 'text-emerald-700' },
  LOGIN_FAILED: { label: 'Login Gagal', textClass: 'text-red-700' },
  LOGOUT: { label: 'Logout Manual', textClass: 'text-slate-700' },
  TOKEN_REFRESH: { label: 'Perpanjang JWT', textClass: 'text-blue-800' },
  SESSION_EXPIRED: { label: 'Sesi Timeout', textClass: 'text-amber-700' },
  RBAC_DENIED: { label: 'Akses Ditolak (RBAC)', textClass: 'text-red-700' },
  USER_UPDATED: { label: 'Perubahan Profil User', textClass: 'text-[#0B2545]' },
  RBAC_POLICY_UPDATED: { label: 'Perubahan Kebijakan RBAC', textClass: 'text-[#0B2545]' },
};

export const RbacAuditView: React.FC<RbacAuditViewProps> = ({
  session,
  roleConfigs,
  users,
  remainingSeconds,
  locations = INITIAL_LOCATIONS,
  rooms = [],
  onImportAssets,
  onImportVehicles,
  onImportRoomItems,
  onRefreshSession,
  onRbacUpdated,
}) => {
  const currentProfile = roleConfigs[session.user.role] ?? ROLE_PROFILES[session.user.role];
  const isSuperAdmin =
    currentProfile.permissions.canManageRbacUsers &&
    session.user.role === 'SUPER_ADMIN';

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(true);
  const [logError, setLogError] = useState<string>('');
  const [refreshingJwt, setRefreshingJwt] = useState<boolean>(false);

  // Super Admin Excel Import Hub state
  const [superImportTarget, setSuperImportTarget] = useState<
    'kib' | 'kendaraan' | 'kir' | null
  >(null);
  const [importDefaultLoc, setImportDefaultLoc] = useState<string>(
    locations[0]?.id ?? 'LOC-MAKO'
  );
  const [importTargetRoomId, setImportTargetRoomId] = useState<string>(
    rooms[0]?.id ?? ''
  );

  useEffect(() => {
    if (!importTargetRoomId && rooms.length > 0) {
      setImportTargetRoomId(rooms[0].id);
    }
  }, [rooms, importTargetRoomId]);

  const locationMap = new Map(locations.map((l) => [l.id, l]));

  // User Edit / Create Modal state
  const [editingUser, setEditingUser] = useState<ManagedUserAccount | null>(null);
  const [createUserOpen, setCreateUserOpen] = useState<boolean>(false);
  const [userForm, setUserForm] = useState({
    username: '',
    officerName: '',
    nip: '',
    jabatan: '',
    unitName: '',
    assignedLocationId: '',
    role: 'PETUGAS_LAPANGAN' as RoleId,
    isActive: true,
    password: '',
  });
  const [userSaving, setUserSaving] = useState<boolean>(false);
  const [userFormError, setUserFormError] = useState<string>('');

  // Draft RBAC matrix for Super Admin editing
  const [draftConfigs, setDraftConfigs] = useState<Record<RoleId, RoleProfile>>(roleConfigs);
  const [dirtyRoles, setDirtyRoles] = useState<Set<RoleId>>(new Set());
  const [savingMatrix, setSavingMatrix] = useState<boolean>(false);

  useEffect(() => {
    setDraftConfigs(roleConfigs);
    setDirtyRoles(new Set());
  }, [roleConfigs]);

  const fetchAuditLogs = useCallback(async () => {
    setLoadingLogs(true);
    setLogError('');
    try {
      const result = await apiGetAuditLogs(session.token, session.user.role);
      if (!result.ok) {
        setLogError(result.error);
        setLogs([]);
      } else {
        setLogs(result.logs);
      }
    } catch {
      setLogError('Gagal memuat audit log.');
    } finally {
      setLoadingLogs(false);
    }
  }, [session.token, session.user.role]);

  useEffect(() => {
    void fetchAuditLogs();
  }, [fetchAuditLogs]);

  const handleExtendSession = async () => {
    setRefreshingJwt(true);
    await onRefreshSession();
    await fetchAuditLogs();
    setRefreshingJwt(false);
  };

  const openEditUserModal = (u: ManagedUserAccount) => {
    setEditingUser(u);
    setCreateUserOpen(false);
    setUserFormError('');
    setUserForm({
      username: u.username,
      officerName: u.officerName,
      nip: u.nip,
      jabatan: u.jabatan ?? '',
      unitName: u.unitName,
      assignedLocationId: u.assignedLocationId ?? '',
      role: u.role,
      isActive: u.isActive,
      password: '',
    });
  };

  const openCreateUserModal = () => {
    setEditingUser(null);
    setCreateUserOpen(true);
    setUserFormError('');
    setUserForm({
      username: '',
      officerName: '',
      nip: '',
      jabatan: 'Admin / Operator Pos Damkar',
      unitName: 'Pos Damkar Kota Sidoarjo',
      assignedLocationId: 'LOC-POS-01',
      role: 'PETUGAS_LAPANGAN',
      isActive: true,
      password: '',
    });
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError('');
    setUserSaving(true);
    try {
      if (editingUser) {
        const result = await apiUpdateUser(
          session.token,
          session.user,
          editingUser.id,
          {
            officerName: userForm.officerName,
            nip: userForm.nip,
            jabatan: userForm.jabatan,
            unitName: userForm.unitName,
            assignedLocationId: userForm.assignedLocationId || undefined,
            role: userForm.role,
            isActive: userForm.isActive,
            newPassword: userForm.password,
          }
        );
        if (!result.ok) {
          setUserFormError(result.error);
          setUserSaving(false);
          return;
        }
        onRbacUpdated({
          users: result.users,
          updatedSelfUser:
            editingUser.id === session.user.id ? result.user : undefined,
          toast: `Profil "${result.user.officerName}" berhasil diperbarui.`,
        });
        setEditingUser(null);
      } else if (createUserOpen) {
        const result = await apiCreateUser(session.token, session.user, {
          username: userForm.username,
          officerName: userForm.officerName,
          nip: userForm.nip,
          jabatan: userForm.jabatan,
          unitName: userForm.unitName,
          assignedLocationId: userForm.assignedLocationId || undefined,
          role: userForm.role,
          password: userForm.password,
        });
        if (!result.ok) {
          setUserFormError(result.error);
          setUserSaving(false);
          return;
        }
        onRbacUpdated({
          users: result.users,
          toast: `Akun baru "${result.user.officerName}" (@${result.user.username}) berhasil dibuat.`,
        });
        setCreateUserOpen(false);
      }
      await fetchAuditLogs();
    } catch {
      setUserFormError('Gagal menyimpan perubahan.');
    } finally {
      setUserSaving(false);
    }
  };

  const toggleDraftPermission = (roleId: RoleId, key: keyof RolePermissions) => {
    if (!isSuperAdmin) return;
    if (
      roleId === 'SUPER_ADMIN' &&
      (key === 'canManageRbacUsers' || key === 'canViewAuditLogs')
    ) {
      return;
    }
    setDraftConfigs((prev) => {
      const current = prev[roleId];
      const nextPerms: RolePermissions = {
        ...current.permissions,
        [key]: !current.permissions[key],
      };
      return {
        ...prev,
        [roleId]: {
          ...current,
          permissions: nextPerms,
        },
      };
    });
    setDirtyRoles((prev) => new Set(prev).add(roleId));
  };

  const changeDraftRedirect = (roleId: RoleId, nextRedirect: ModuleKey) => {
    if (!isSuperAdmin) return;
    setDraftConfigs((prev) => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        redirectModule: nextRedirect,
      },
    }));
    setDirtyRoles((prev) => new Set(prev).add(roleId));
  };

  const handleSaveMatrix = async () => {
    if (dirtyRoles.size === 0) return;
    setSavingMatrix(true);
    try {
      let latestConfigs = draftConfigs;
      for (const roleId of Array.from(dirtyRoles)) {
        const cfg = draftConfigs[roleId];
        const res = await apiUpdateRolePolicy(session.token, session.user, roleId, {
          permissions: cfg.permissions,
          redirectModule: cfg.redirectModule,
        });
        if (res.ok && res.roleConfigs) {
          latestConfigs = res.roleConfigs;
        }
      }
      onRbacUpdated({
        roleConfigs: latestConfigs,
        toast: 'Kebijakan hak akses RBAC dan modul redireksi berhasil disimpan.',
      });
      setDirtyRoles(new Set());
      await fetchAuditLogs();
    } finally {
      setSavingMatrix(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            {isSuperAdmin
              ? 'Panel Super Admin · Tim Inventaris 2026, Akun Pos & Hak Akses RBAC'
              : 'Keamanan Sesi JWT, Matriks RBAC & Audit Log'}
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            {isSuperAdmin
              ? 'Kelola nama pejabat, jabatan, lingkup Pos Damkar, penetapan hak akses per role, dan pantau audit log autentikasi'
              : 'Pengawasan token sesi aktif, pembatasan hak akses antar role, dan riwayat percobaan masuk sistem'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchAuditLogs()}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Muat Ulang Data
        </button>
      </div>

      {/* Active JWT Session Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <ShieldCheck className="w-4 h-4 text-[#0B2545]" />
            <span>Identitas Sesi Terautentikasi</span>
          </div>
          <p className="font-display text-base font-bold text-slate-900">
            {session.user.officerName}
          </p>
          <p className="text-xs text-slate-600">
            {session.user.jabatan || currentProfile.shortLabel}
          </p>
          <p className="font-mono text-xs text-slate-600 tabular-nums">
            NIP {session.user.nip} · {currentProfile.shortLabel}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Sisa Masa Aktif Token JWT</span>
          </div>
          <p className="font-display text-2xl font-bold text-[#0B2545] tabular-nums">
            {formatCountdown(remainingSeconds)}
          </p>
          <button
            type="button"
            disabled={refreshingJwt}
            onClick={() => void handleExtendSession()}
            className="text-xs font-semibold text-[#0B2545] hover:underline cursor-pointer"
          >
            {refreshingJwt ? 'Memperpanjang...' : 'Perpanjang Sesi (+30 Menit)'}
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Key className="w-4 h-4 text-emerald-700" />
            <span>Signature Token (HS256)</span>
          </div>
          <p className="font-mono text-[11px] text-slate-600 break-all line-clamp-2">
            {session.token}
          </p>
          <p className="text-[11px] text-slate-500">
            Timeout otomatis aktif saat token kedaluwarsa.
          </p>
        </div>
      </div>

      {/* Super Admin Exclusive: Pusat Import Excel Data Eksternal */}
      {isSuperAdmin && (
        <div className="bg-white border border-amber-300 rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-amber-50/70 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-bold text-[#0B2545] flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-amber-700" aria-hidden="true" />
                Pusat Import Excel Data Eksternal (Khusus Super Admin)
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Hanya Super Admin yang memiliki akses mengimpor file .xlsx, .xls, atau .csv dari SIMBADA, e-BMD, SIPD, atau rekap BAST ke dalam SIMAS-BMD.
              </p>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded bg-[#0B2545] text-amber-300 text-[11px] font-semibold whitespace-nowrap self-start sm:self-auto">
              Akses Terbatas: SUPER_ADMIN
            </span>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-3 bg-slate-50/50">
              <div>
                <p className="font-display text-sm font-bold text-slate-900">
                  Import Master KIB A–F
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Impor data barang modal, peralatan, mesin, gedung, dan aset lainnya sekaligus ke Master KIB.
                </p>
              </div>
              <button
                type="button"
                disabled={!onImportAssets}
                onClick={() => setSuperImportTarget('kib')}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0B2545] bg-amber-100 hover:bg-amber-200 border border-amber-300 disabled:opacity-50 rounded-md cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Import Excel Master KIB
              </button>
            </div>

            <div className="border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-3 bg-slate-50/50">
              <div>
                <p className="font-display text-sm font-bold text-slate-900">
                  Import Kendaraan R4 &amp; R2
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Impor daftar armada dinas beserta nomor polisi, rangka, mesin, status pajak, dan BPKB.
                </p>
              </div>
              <button
                type="button"
                disabled={!onImportVehicles}
                onClick={() => setSuperImportTarget('kendaraan')}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0B2545] bg-amber-100 hover:bg-amber-200 border border-amber-300 disabled:opacity-50 rounded-md cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Import Excel Kendaraan
              </button>
            </div>

            <div className="border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-3 bg-slate-50/50">
              <div>
                <p className="font-display text-sm font-bold text-slate-900">
                  Import Kartu Ruang (KIR)
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Impor rincian inventaris barang ruangan langsung ke salah satu ruangan / Pos Damkar terdaftar.
                </p>
              </div>
              <button
                type="button"
                disabled={!onImportRoomItems || rooms.length === 0}
                onClick={() => setSuperImportTarget('kir')}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0B2545] bg-amber-100 hover:bg-amber-200 border border-amber-300 disabled:opacity-50 rounded-md cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Import Excel KIR Ruangan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section 1: User Directory & Edit Nama (Super Admin Editable) */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <UserCog className="w-4 h-4 text-[#0B2545]" aria-hidden="true" />
              Direktori Tim Inventaris 2026 &amp; Akun Khusus Setiap Pos ({users.length} Akun)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isSuperAdmin
                ? 'Ubah nama pegawai, NIP, jabatan, penetapan Pos Damkar khusus, role RBAC, atau tambahkan akun baru'
                : 'Daftar pejabat Tim Inventaris 2026 & operator Pos Damkar terdaftar (khusus Super Admin yang dapat mengubah data)'}
            </p>
          </div>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={openCreateUserModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md cursor-pointer self-start sm:self-auto whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Akun Pegawai / Pos
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                <th className="py-3 px-4">Username &amp; NIP</th>
                <th className="py-3 px-4">Nama Lengkap &amp; Jabatan</th>
                <th className="py-3 px-4">Unit / Lingkup Pos</th>
                <th className="py-3 px-4">Role RBAC</th>
                <th className="py-3 px-4">Status</th>
                {isSuperAdmin && <th className="py-3 px-4 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((u) => {
                const roleLabel =
                  (roleConfigs[u.role] ?? ROLE_PROFILES[u.role])?.shortLabel ?? u.role;
                const assignedLoc = u.assignedLocationId
                  ? locationMap.get(u.assignedLocationId)
                  : undefined;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap tabular-nums">
                      <div className="font-semibold text-slate-900">@{u.username}</div>
                      <div className="text-slate-500">{u.nip}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{u.officerName}</div>
                      {u.jabatan && (
                        <div className="text-[11px] text-slate-500 mt-0.5">{u.jabatan}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <div>{u.unitName}</div>
                      {assignedLoc && (
                        <div className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-amber-800 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          Khusus {assignedLoc.code} ({assignedLoc.name})
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#0B2545] whitespace-nowrap">
                      {roleLabel}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          u.isActive ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {u.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEditUserModal(u)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[#0B2545] border border-slate-300 hover:bg-slate-100 rounded cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit Nama &amp; Role
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: RBAC Matrix Configuration (Interactive for Super Admin) */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900">
              {isSuperAdmin
                ? 'Penentuan Matriks Kewenangan Hak Akses (RBAC)'
                : 'Matriks Kewenangan Hak Akses (RBAC Matrix)'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isSuperAdmin
                ? 'Centang atau hapus centang izin per role (termasuk role khusus Admin Pos) dan atur halaman redireksi setelah login'
                : 'Pemisahan tugas antara Pengurus Barang (Super Admin), Pembantu Pengurus, Pejabat Penatausahaan, Admin Pos, dan Pengguna Barang'}
            </p>
          </div>
          {isSuperAdmin && (
            <button
              type="button"
              disabled={dirtyRoles.size === 0 || savingMatrix}
              onClick={() => void handleSaveMatrix()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] disabled:opacity-45 rounded-md cursor-pointer self-start sm:self-auto whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              {savingMatrix
                ? 'Menyimpan...'
                : dirtyRoles.size > 0
                  ? `Simpan Perubahan (${dirtyRoles.size} Role)`
                  : 'Semua Perubahan Tersimpan'}
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                <th className="py-3 px-4">Kewenangan / Fitur Sistem</th>
                {ROLE_ORDER.map((r) => (
                  <th key={r} className="py-3 px-3 text-center whitespace-nowrap">
                    {(draftConfigs[r] ?? ROLE_PROFILES[r]).shortLabel}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {/* Redirect module selector row */}
              <tr className="bg-slate-50/50">
                <td className="py-2.5 px-4 font-semibold text-slate-900">
                  Halaman Redireksi Otomatis Setelah Login
                </td>
                {ROLE_ORDER.map((r) => {
                  const cfg = draftConfigs[r] ?? ROLE_PROFILES[r];
                  return (
                    <td key={r} className="py-2.5 px-2 text-center">
                      {isSuperAdmin ? (
                        <select
                          value={cfg.redirectModule}
                          onChange={(e) =>
                            changeDraftRedirect(r, e.target.value as ModuleKey)
                          }
                          aria-label={`Redireksi login untuk ${cfg.shortLabel}`}
                          className="w-full max-w-[140px] px-2 py-1 text-[11px] font-medium border border-slate-300 rounded bg-white"
                        >
                          {MODULE_OPTIONS.map((m) => (
                            <option key={m.key} value={m.key}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[11px] text-slate-700 font-medium">
                          {MODULE_OPTIONS.find((m) => m.key === cfg.redirectModule)?.label ??
                            cfg.redirectModule}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {PERMISSION_ROWS.map((row) => (
                <tr key={row.key} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-4 font-medium text-slate-800">
                    {row.label}
                  </td>
                  {ROLE_ORDER.map((r) => {
                    const cfg = draftConfigs[r] ?? ROLE_PROFILES[r];
                    const allowed = cfg.permissions[row.key];
                    const isLocked =
                      r === 'SUPER_ADMIN' &&
                      (row.key === 'canManageRbacUsers' ||
                        row.key === 'canViewAuditLogs');

                    return (
                      <td key={r} className="py-2.5 px-3 text-center">
                        {isSuperAdmin ? (
                          <input
                            type="checkbox"
                            checked={allowed}
                            disabled={isLocked}
                            onChange={() => toggleDraftPermission(r, row.key)}
                            aria-label={`${row.label} untuk ${cfg.shortLabel}`}
                            className="h-4 w-4 accent-[#0B2545] rounded border-slate-300 cursor-pointer disabled:opacity-50"
                          />
                        ) : allowed ? (
                          <Check
                            className="w-4 h-4 text-emerald-700 inline-block"
                            aria-label="Diizinkan"
                          />
                        ) : (
                          <Minus
                            className="w-4 h-4 text-slate-300 inline-block"
                            aria-label="Tidak diizinkan"
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Authentication Audit Logs */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-display text-base font-bold text-slate-900">
            Catatan Audit Log Autentikasi &amp; Perubahan RBAC
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Merekam percobaan login, kegagalan kata sandi, perubahan nama pegawai, dan pembaruan kebijakan RBAC
          </p>
        </div>

        {logError ? (
          <div className="p-6 text-xs text-red-700">{logError}</div>
        ) : loadingLogs ? (
          <div className="p-6 text-xs text-slate-500">Memuat catatan audit log...</div>
        ) : logs.length === 0 ? (
          <div className="p-6 text-xs text-slate-500">Belum ada catatan aktivitas autentikasi.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4">Waktu Kejadian</th>
                  <th className="py-3 px-4">NIP / Username</th>
                  <th className="py-3 px-4">Pelaku &amp; Role</th>
                  <th className="py-3 px-4">Status Kejadian</th>
                  <th className="py-3 px-4">Keterangan</th>
                  <th className="py-3 px-4 text-right">Alamat IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {logs.map((entry) => {
                  const ev = EVENT_LABEL[entry.event];
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap tabular-nums">
                        {formatAuditTime(entry.timestamp)}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-800 whitespace-nowrap tabular-nums">
                        {entry.identifier}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {entry.officerName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {entry.role === 'UNKNOWN'
                            ? 'Tidak Terautentikasi'
                            : (roleConfigs[entry.role] ?? ROLE_PROFILES[entry.role]).shortLabel}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className={`font-semibold ${ev.textClass}`}>
                          {ev.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 max-w-sm">
                        {entry.detail}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                        {entry.ipAddress}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Edit Nama & Profil User / Tambah Akun Baru */}
      {(editingUser || createUserOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="font-display text-base font-bold text-slate-900">
                {editingUser
                  ? `Edit Profil & Nama Pegawai (@${editingUser.username})`
                  : 'Tambah Akun Pegawai / Pos Baru'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setCreateUserOpen(false);
                }}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4 text-xs">
              {userFormError && (
                <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-700">
                  {userFormError}
                </div>
              )}

              {createUserOpen && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Username Login
                  </label>
                  <input
                    type="text"
                    required
                    value={userForm.username}
                    onChange={(e) =>
                      setUserForm({ ...userForm, username: e.target.value })
                    }
                    placeholder="Contoh: pos.waru2"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Lengkap &amp; Gelar Pegawai
                </label>
                <input
                  type="text"
                  required
                  value={userForm.officerName}
                  onChange={(e) =>
                    setUserForm({ ...userForm, officerName: e.target.value })
                  }
                  placeholder="Nama lengkap pegawai"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    NIP (18 Digit)
                  </label>
                  <input
                    type="text"
                    required
                    value={userForm.nip}
                    onChange={(e) => setUserForm({ ...userForm, nip: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Role Hak Akses (RBAC)
                  </label>
                  <select
                    value={userForm.role}
                    disabled={editingUser?.role === 'SUPER_ADMIN'}
                    onChange={(e) =>
                      setUserForm({ ...userForm, role: e.target.value as RoleId })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md disabled:bg-slate-100"
                  >
                    {ROLE_ORDER.map((r) => (
                      <option key={r} value={r}>
                        {(roleConfigs[r] ?? ROLE_PROFILES[r]).label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Jabatan / Keterangan Tim
                  </label>
                  <input
                    type="text"
                    value={userForm.jabatan}
                    onChange={(e) =>
                      setUserForm({ ...userForm, jabatan: e.target.value })
                    }
                    placeholder="Contoh: Penanggung Jawab Pos Damkar"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Lingkup Pos Khusus (Opsional)
                  </label>
                  <select
                    value={userForm.assignedLocationId}
                    onChange={(e) => {
                      const locId = e.target.value;
                      const loc = INITIAL_LOCATIONS.find((l) => l.id === locId);
                      setUserForm({
                        ...userForm,
                        assignedLocationId: locId,
                        unitName: loc ? loc.name : userForm.unitName,
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                  >
                    <option value="">Semua Lokasi (Lintas Pos / Mako)</option>
                    {INITIAL_LOCATIONS.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code} · {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Unit Kerja / Pos Penugasan
                </label>
                <input
                  type="text"
                  required
                  value={userForm.unitName}
                  onChange={(e) =>
                    setUserForm({ ...userForm, unitName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {editingUser
                      ? 'Reset Kata Sandi (Opsional, min. 6 karakter)'
                      : 'Kata Sandi Awal (min. 6 karakter)'}
                  </label>
                  <input
                    type="password"
                    required={createUserOpen}
                    minLength={createUserOpen ? 6 : undefined}
                    value={userForm.password}
                    onChange={(e) =>
                      setUserForm({ ...userForm, password: e.target.value })
                    }
                    placeholder={
                      editingUser ? 'Kosongkan jika tidak diubah' : 'Minimal 6 karakter'
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>

                {editingUser && editingUser.role !== 'SUPER_ADMIN' && (
                  <label className="inline-flex items-center gap-2 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userForm.isActive}
                      onChange={(e) =>
                        setUserForm({ ...userForm, isActive: e.target.checked })
                      }
                      className="h-4 w-4 accent-[#0B2545]"
                    />
                    <span className="font-semibold text-slate-700">
                      Status Akun Aktif
                    </span>
                  </label>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingUser(null);
                    setCreateUserOpen(false);
                  }}
                  className="px-4 py-2 font-semibold text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={userSaving}
                  className="px-4 py-2 font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] disabled:opacity-50 rounded-md cursor-pointer"
                >
                  {userSaving ? 'Menyimpan...' : 'Simpan Data Pegawai'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Super Admin Excel Import Modal */}
      {isSuperAdmin && superImportTarget === 'kib' && (
        <ExcelImportModal
          isOpen
          onClose={() => setSuperImportTarget(null)}
          title="Import Excel Master KIB (Khusus Super Admin)"
          subtitle="Unggah file .xlsx, .xls, atau .csv dari SIMBADA / e-BMD / SIPD / rekap BAST ke Master KIB SIMAS-BMD"
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
                  Diterapkan bila baris Excel tidak mencantumkan kolom Mako / Pos Damkar.
                </p>
              </div>
              <select
                value={importDefaultLoc}
                onChange={(e) => setImportDefaultLoc(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-md bg-white text-xs font-medium"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code} · {loc.name}
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
              session.user.officerName
            );
            if (parsed.length > 0) {
              onImportAssets?.(parsed);
            }
            return {
              importedCount: parsed.length,
              message: `${parsed.length} register aset berhasil diimpor ke Master KIB.`,
            };
          }}
        />
      )}

      {isSuperAdmin && superImportTarget === 'kendaraan' && (
        <ExcelImportModal
          isOpen
          onClose={() => setSuperImportTarget(null)}
          title="Import Excel Kendaraan R4 & R2 (Khusus Super Admin)"
          subtitle="Unggah file .xlsx, .xls, atau .csv daftar armada dinas ke modul Kendaraan SIMAS-BMD"
          fieldDefinitions={VEHICLE_FIELD_DEFINITIONS}
          fieldAliases={VEHICLE_FIELD_ALIASES}
          onDownloadTemplate={downloadVehicleExcelTemplate}
          extraOptions={
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">
                  Pos Penempatan Default Jika Kolom Pos Kosong
                </p>
                <p className="text-[11px] text-slate-500">
                  Menentukan pos penempatan bila Excel tidak memuat nama Mako atau Pos Damkar.
                </p>
              </div>
              <select
                value={importDefaultLoc}
                onChange={(e) => setImportDefaultLoc(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-md bg-white text-xs font-medium"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code} · {loc.name}
                  </option>
                ))}
              </select>
            </div>
          }
          onConfirmImport={(rows, mapping) => {
            const parsed = mapRowsToVehicles(
              rows,
              mapping,
              locations,
              importDefaultLoc,
              session.user.officerName
            );
            if (parsed.length > 0) {
              onImportVehicles?.(parsed);
            }
            return {
              importedCount: parsed.length,
              message: `${parsed.length} unit kendaraan berhasil diimpor.`,
            };
          }}
        />
      )}

      {isSuperAdmin && superImportTarget === 'kir' && (
        <ExcelImportModal
          isOpen
          onClose={() => setSuperImportTarget(null)}
          title="Import Excel Kartu Inventaris Ruangan (Khusus Super Admin)"
          subtitle="Unggah daftar barang dari file Excel/CSV untuk dimasukkan ke ruangan KIR terpilih"
          fieldDefinitions={KIR_FIELD_DEFINITIONS}
          fieldAliases={KIR_FIELD_ALIASES}
          onDownloadTemplate={downloadKirExcelTemplate}
          extraOptions={
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">
                  Ruangan Tujuan Impor KIR
                </p>
                <p className="text-[11px] text-slate-500">
                  Seluruh baris dari file Excel akan ditambahkan ke Kartu Inventaris Ruangan ini.
                </p>
              </div>
              <select
                value={importTargetRoomId}
                onChange={(e) => setImportTargetRoomId(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-md bg-white text-xs font-medium"
              >
                {rooms.map((rm) => (
                  <option key={rm.id} value={rm.id}>
                    {rm.kodeRuang} · {rm.namaRuang}
                  </option>
                ))}
              </select>
            </div>
          }
          onConfirmImport={(rows, mapping) => {
            const targetRoom =
              rooms.find((r) => r.id === importTargetRoomId) ?? rooms[0];
            if (!targetRoom) {
              return { importedCount: 0, message: 'Tidak ada ruangan KIR yang tersedia.' };
            }
            const parsed = mapRowsToKirEntries(rows, mapping, targetRoom.id);
            if (parsed.length > 0) {
              onImportRoomItems?.(parsed);
            }
            return {
              importedCount: parsed.length,
              message: `${parsed.length} item barang berhasil diimpor ke ${targetRoom.namaRuang}.`,
            };
          }}
        />
      )}
    </div>
  );
};
