import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LogIn, LogOut, Menu } from 'lucide-react';
import { DashboardView } from './components/DashboardView';
import { KibManagementView } from './components/KibManagementView';
import { LoginView } from './components/LoginView';
import { MutationView } from './components/MutationView';
import { OpnameReportView } from './components/OpnameReportView';
import { QrScannerView } from './components/QrScannerView';
import { RbacAuditView } from './components/RbacAuditView';
import { Sidebar } from './components/Sidebar';
import { VehicleInventoryView } from './components/VehicleInventoryView';
import {
  INITIAL_ASSETS,
  INITIAL_DAMAGE_REPORTS,
  INITIAL_LOCATIONS,
  INITIAL_MUTATIONS,
  INITIAL_VEHICLES,
  INITIAL_VEHICLE_MAINTENANCE,
  ROLE_PROFILES,
} from './data/initialData';
import {
  AssetItem,
  AssetMutation,
  AuthSession,
  ConditionStatus,
  DamageReport,
  DamageReportStatus,
  KibCategory,
  ManagedUserAccount,
  ModuleKey,
  OpnameStatus,
  RoleId,
  RoleProfile,
  VehicleItem,
  VehicleMaintenanceRecord,
} from './types/simas';
import {
  apiGetRbacConfig,
  apiLogout,
  apiRefreshSession,
  apiVerifySession,
} from './utils/authClient';

const STORAGE_KEY = 'simas_bmd_bpbd_sidoarjo_v1';
const AUTH_STORAGE_KEY = 'simas_bmd_jwt_session_v1';

interface PersistedDomainState {
  assets: AssetItem[];
  mutations: AssetMutation[];
  damageReports: DamageReport[];
  vehicles: VehicleItem[];
  vehicleMaintenances: VehicleMaintenanceRecord[];
}

const MODULE_TITLES: Record<ModuleKey, string> = {
  dashboard: 'Dashboard Eksekutif',
  kib: 'Manajemen KIB A–F',
  kendaraan: 'Inventaris Kendaraan (Roda 4 & Roda 2)',
  qr_scanner: 'QR Code & Pemindai Lapangan',
  mutasi: 'Mutasi & Lokasi Aset',
  opname_laporan: 'Opname Fisik & Pelaporan Kerusakan',
  rbac_audit: 'Keamanan, Pengguna & Hak Akses RBAC',
};

const PUBLIC_GUEST_PROFILE: RoleProfile = {
  id: 'PIMPINAN_VIEWER',
  label: 'Tampilan Publik (Hanya Baca)',
  shortLabel: 'Tamu / Publik',
  officerName: 'Pengunjung Publik',
  nip: '-',
  unitName: 'BPBD Kabupaten Sidoarjo',
  redirectModule: 'dashboard',
  permissions: {
    canCreateAsset: false,
    canEditAsset: false,
    canDeleteAsset: false,
    canPrintQr: false,
    canApproveMutation: false,
    canVerifyMutation: false,
    canRequestMutation: false,
    canReportDamage: false,
    canResolveDamage: false,
    canPerformOpname: false,
    canExportReport: false,
    canViewAuditLogs: false,
    canManageRbacUsers: false,
  },
  allowedModules: ['dashboard'],
};

function loadInitialDomainState(): PersistedDomainState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedDomainState>;
      if (
        Array.isArray(parsed.assets) &&
        Array.isArray(parsed.mutations) &&
        Array.isArray(parsed.damageReports)
      ) {
        return {
          assets: parsed.assets,
          mutations: parsed.mutations,
          damageReports: parsed.damageReports,
          vehicles: Array.isArray(parsed.vehicles)
            ? parsed.vehicles
            : INITIAL_VEHICLES,
          vehicleMaintenances: Array.isArray(parsed.vehicleMaintenances)
            ? parsed.vehicleMaintenances
            : INITIAL_VEHICLE_MAINTENANCE,
        };
      }
    }
  } catch {
    // Fallback to initial seed
  }
  return {
    assets: INITIAL_ASSETS,
    mutations: INITIAL_MUTATIONS,
    damageReports: INITIAL_DAMAGE_REPORTS,
    vehicles: INITIAL_VEHICLES,
    vehicleMaintenances: INITIAL_VEHICLE_MAINTENANCE,
  };
}

function loadStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (
      parsed &&
      typeof parsed.token === 'string' &&
      typeof parsed.expiresAt === 'number' &&
      parsed.user &&
      ROLE_PROFILES[parsed.user.role]
    ) {
      const nowSec = Math.floor(Date.now() / 1000);
      if (parsed.expiresAt > nowSec) {
        return parsed;
      }
    }
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
  return null;
}

export default function App() {
  const initialDomain = useMemo(() => loadInitialDomainState(), []);
  const initialSession = useMemo(() => loadStoredSession(), []);

  const [session, setSession] = useState<AuthSession | null>(initialSession);
  const [showLoginScreen, setShowLoginScreen] = useState<boolean>(!initialSession);
  const [sessionNotice, setSessionNotice] = useState<string>('');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() =>
    initialSession
      ? Math.max(0, initialSession.expiresAt - Math.floor(Date.now() / 1000))
      : 0
  );

  const [roleConfigs, setRoleConfigs] =
    useState<Record<RoleId, RoleProfile>>(ROLE_PROFILES);
  const [managedUsers, setManagedUsers] = useState<ManagedUserAccount[]>([]);

  const [assets, setAssets] = useState<AssetItem[]>(initialDomain.assets);
  const [mutations, setMutations] = useState<AssetMutation[]>(initialDomain.mutations);
  const [damageReports, setDamageReports] = useState<DamageReport[]>(
    initialDomain.damageReports
  );
  const [vehicles, setVehicles] = useState<VehicleItem[]>(initialDomain.vehicles);
  const [vehicleMaintenances, setVehicleMaintenances] = useState<
    VehicleMaintenanceRecord[]
  >(initialDomain.vehicleMaintenances);
  const [activeModule, setActiveModule] = useState<ModuleKey>(
    initialSession ? initialSession.user.redirectModule : 'dashboard'
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const [kibInitialCategory, setKibInitialCategory] = useState<KibCategory | 'ALL'>('ALL');
  const [kibInitialLocation, setKibInitialLocation] = useState<string>('ALL');
  const [preselectMutationAssetId, setPreselectMutationAssetId] = useState<string>('');
  const [preselectDamageAssetId, setPreselectDamageAssetId] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string>('');

  const locations = INITIAL_LOCATIONS;

  // Persist KIB & Vehicle domain data
  useEffect(() => {
    try {
      const payload: PersistedDomainState = {
        assets,
        mutations,
        damageReports,
        vehicles,
        vehicleMaintenances,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota issues
    }
  }, [assets, mutations, damageReports, vehicles, vehicleMaintenances]);

  // Verify stored session & load live RBAC config + user directory
  useEffect(() => {
    if (!session) return;
    let active = true;

    void apiVerifySession(session.token).then((res) => {
      if (!active) return;
      if (!res.valid) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setSession(null);
        setShowLoginScreen(true);
        setSessionNotice('Sesi JWT sebelumnya telah berakhir. Silakan login kembali.');
        return;
      }
      if (res.user) {
        const verifiedUser = res.user;
        setSession((prev) => {
          if (!prev) return prev;
          const synced = { ...prev, user: verifiedUser };
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(synced));
          return synced;
        });
      }
    });

    void apiGetRbacConfig(session.token).then((data) => {
      if (!active || !data) return;
      setRoleConfigs((prev) => {
        const merged = { ...prev };
        (Object.keys(data.roleConfigs) as RoleId[]).forEach((r) => {
          merged[r] = { ...prev[r], ...data.roleConfigs[r] };
        });
        return merged;
      });
      setManagedUsers(data.users);
    });

    return () => {
      active = false;
    };
  }, [session?.token]);

  // JWT Expiration Countdown Timer
  useEffect(() => {
    if (!session) {
      setRemainingSeconds(0);
      return;
    }

    const updateTimer = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const diff = session.expiresAt - nowSec;
      if (diff <= 0) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setSession(null);
        setShowLoginScreen(true);
        setRemainingSeconds(0);
        setSessionNotice(
          'Masa aktif token sesi JWT telah habis (timeout otomatis). Silakan masuk kembali.'
        );
      } else {
        setRemainingSeconds(diff);
      }
    };

    updateTimer();
    const interval = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(interval);
  }, [session]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? '' : prev));
    }, 3500);
  }, []);

  const handleLoginSuccess = (newSession: AuthSession) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newSession));
    setSession(newSession);
    setShowLoginScreen(false);
    setSessionNotice('');
    setRemainingSeconds(
      Math.max(0, newSession.expiresAt - Math.floor(Date.now() / 1000))
    );
    setActiveModule(newSession.user.redirectModule);
    const profile = roleConfigs[newSession.user.role] ?? ROLE_PROFILES[newSession.user.role];
    showToast(
      `Selamat datang, ${newSession.user.officerName} (${profile.shortLabel}). Dialihkan ke ${MODULE_TITLES[newSession.user.redirectModule]}.`
    );
  };

  const handleLogout = async () => {
    const activeSession = session;
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setSession(null);
    setActiveModule('dashboard');
    setShowLoginScreen(true);
    setToastMessage('');
    setSessionNotice('Anda telah keluar dari sesi SIMAS-BMD dengan aman.');
    await apiLogout(activeSession);
  };

  const handleRefreshSession = async () => {
    if (!session) return;
    const res = await apiRefreshSession(session);
    if (res.ok && res.token && res.expiresAt) {
      const updated: AuthSession = {
        ...session,
        token: res.token,
        expiresAt: res.expiresAt,
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
      setSession(updated);
      showToast('Masa aktif sesi JWT berhasil diperpanjang (+30 menit).');
    } else {
      void handleLogout();
    }
  };

  // Show dedicated Login screen unless user chooses Public Observer mode
  if (!session && showLoginScreen) {
    return (
      <LoginView
        onLoginSuccess={handleLoginSuccess}
        onEnterPublicMode={() => {
          setShowLoginScreen(false);
          setActiveModule('dashboard');
        }}
        sessionNotice={sessionNotice}
      />
    );
  }

  const isAuthenticated = Boolean(session);
  const currentRole = session?.user.role;
  const activeRoleProfile: RoleProfile = session
    ? {
        ...(roleConfigs[session.user.role] ?? ROLE_PROFILES[session.user.role]),
        officerName: session.user.officerName,
        nip: session.user.nip,
        unitName: session.user.unitName,
      }
    : PUBLIC_GUEST_PROFILE;

  const safeActiveModule: ModuleKey = isAuthenticated
    ? activeRoleProfile.allowedModules.includes(activeModule)
      ? activeModule
      : activeRoleProfile.redirectModule
    : 'dashboard';

  const requireLoginPrompt = (actionLabel: string) => {
    setSessionNotice(`Silakan masuk menggunakan akun pegawai untuk mengakses ${actionLabel}.`);
    setShowLoginScreen(true);
  };

  const handleResetDemo = () => {
    setAssets(INITIAL_ASSETS);
    setMutations(INITIAL_MUTATIONS);
    setDamageReports(INITIAL_DAMAGE_REPORTS);
    setVehicles(INITIAL_VEHICLES);
    setVehicleMaintenances(INITIAL_VEHICLE_MAINTENANCE);
    localStorage.removeItem(STORAGE_KEY);
    showToast('Data simulasi KIB & Kendaraan SIMAS-BMD telah dikembalikan ke kondisi awal.');
  };

  const handleAddVehicle = (newVehicle: Omit<VehicleItem, 'id'>) => {
    if (!activeRoleProfile.permissions.canCreateAsset) return;
    const nextNum = vehicles.length + 1;
    const id = `KND-${String(nextNum).padStart(3, '0')}`;
    setVehicles((prev) => [{ ...newVehicle, id }, ...prev]);
    showToast(
      `Kendaraan ${newVehicle.nomorPolisi} (${newVehicle.namaKendaraan}) berhasil ditambahkan.`
    );
  };

  const handleUpdateVehicle = (updated: VehicleItem) => {
    if (!activeRoleProfile.permissions.canEditAsset) return;
    setVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    showToast(`Data kendaraan ${updated.nomorPolisi} (${updated.id}) berhasil diperbarui.`);
  };

  const handleDeleteVehicle = (vehicleId: string) => {
    if (!activeRoleProfile.permissions.canDeleteAsset) return;
    setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
    setVehicleMaintenances((prev) => prev.filter((m) => m.vehicleId !== vehicleId));
    showToast(`Data kendaraan ${vehicleId} dihapus dari daftar aktif.`);
  };

  const handleAddVehicleMaintenance = (
    record: Omit<VehicleMaintenanceRecord, 'id' | 'dicatatOleh'>
  ) => {
    const canRecord =
      activeRoleProfile.permissions.canReportDamage ||
      activeRoleProfile.permissions.canResolveDamage ||
      activeRoleProfile.permissions.canEditAsset ||
      activeRoleProfile.permissions.canCreateAsset;
    if (!canRecord) return;
    const seq = vehicleMaintenances.length + 1;
    const newRecord: VehicleMaintenanceRecord = {
      ...record,
      id: `MNT-2026-${String(seq).padStart(3, '0')}`,
      dicatatOleh: activeRoleProfile.officerName,
    };
    setVehicleMaintenances((prev) => [newRecord, ...prev]);
    showToast(`Riwayat pemeliharaan/perbaikan ${newRecord.id} berhasil dicatat.`);
  };

  const handleAddAsset = (newAsset: Omit<AssetItem, 'id' | 'qrPayload'>) => {
    if (!activeRoleProfile.permissions.canCreateAsset) return;
    const nextNum = assets.length + 1;
    const id = `AST-${String(nextNum).padStart(3, '0')}`;
    const qrPayload = `SIMAS-BMD|BPBD-SDA|${newAsset.kodeBarang}|${newAsset.nomorRegister}`;
    setAssets((prev) => [{ ...newAsset, id, qrPayload }, ...prev]);
    showToast(`Aset baru ${id} (${newAsset.namaBarang}) berhasil dicatat ke Master KIB.`);
  };

  const handleUpdateAsset = (updated: AssetItem) => {
    if (!activeRoleProfile.permissions.canEditAsset) return;
    setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    showToast(`Perubahan register ${updated.id} berhasil disimpan.`);
  };

  const handleDeleteAsset = (assetId: string) => {
    if (!activeRoleProfile.permissions.canDeleteAsset) return;
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
    showToast(`Register aset ${assetId} dihapus dari daftar aktif.`);
  };

  const handleCreateMutation = (payload: {
    assetId: string;
    toLocationId: string;
    reason: string;
  }) => {
    if (!activeRoleProfile.permissions.canRequestMutation || !currentRole) return;
    const targetAsset = assets.find((a) => a.id === payload.assetId);
    if (!targetAsset) return;
    const seq = mutations.length + 1;
    const today = new Date().toISOString().slice(0, 10);
    const newMutation: AssetMutation = {
      id: `MUT-2026-${String(seq).padStart(3, '0')}`,
      nomorSurat: `BA-MUT/${String(20 + seq).padStart(3, '0')}/438.5.1/2026`,
      assetId: payload.assetId,
      fromLocationId: targetAsset.locationId,
      toLocationId: payload.toLocationId,
      requestedBy: activeRoleProfile.officerName,
      requestedByRole: currentRole,
      requestDate: today,
      reason: payload.reason,
      status: 'MENUNGGU_KASUBAG',
    };
    setMutations((prev) => [newMutation, ...prev]);
    showToast(`Pengajuan mutasi ${newMutation.nomorSurat} dikirim untuk persetujuan Kasubag.`);
  };

  const handleApproveByKasubag = (
    mutationId: string,
    approved: boolean,
    note: string
  ) => {
    if (!activeRoleProfile.permissions.canApproveMutation) return;
    const today = new Date().toISOString().slice(0, 10);
    setMutations((prev) =>
      prev.map((m) =>
        m.id === mutationId
          ? {
              ...m,
              status: approved ? 'DISETUJUI_KASUBAG' : 'DITOLAK',
              reviewedBy: activeRoleProfile.officerName,
              reviewDate: today,
              reviewNote: note,
            }
          : m
      )
    );
    showToast(
      approved
        ? `Mutasi ${mutationId} disetujui Kasubag. Menunggu verifikasi serah terima Pengurus Barang.`
        : `Pengajuan mutasi ${mutationId} ditolak.`
    );
  };

  const handleVerifyByPengurus = (mutationId: string) => {
    if (!activeRoleProfile.permissions.canVerifyMutation) return;
    const target = mutations.find((m) => m.id === mutationId);
    if (!target) return;
    const today = new Date().toISOString().slice(0, 10);

    setMutations((prev) =>
      prev.map((m) =>
        m.id === mutationId
          ? {
              ...m,
              status: 'SELESAI_VERIFIKASI',
              verifiedBy: activeRoleProfile.officerName,
              verifyDate: today,
            }
          : m
      )
    );

    setAssets((prev) =>
      prev.map((a) =>
        a.id === target.assetId ? { ...a, locationId: target.toLocationId } : a
      )
    );

    showToast(
      `Serah terima fisik terverifikasi. Lokasi aset ${target.assetId} di Master KIB telah diperbarui.`
    );
  };

  const handleCreateDamageReport = (payload: {
    assetId: string;
    reportedCondition: Exclude<ConditionStatus, 'BAIK'>;
    chronology: string;
    estimatedAction: string;
  }) => {
    if (!activeRoleProfile.permissions.canReportDamage) return;
    const asset = assets.find((a) => a.id === payload.assetId);
    if (!asset) return;
    const today = new Date().toISOString().slice(0, 10);
    const seq = damageReports.length + 32;
    const newReport: DamageReport = {
      id: `DMG-2026-${String(damageReports.length + 1).padStart(3, '0')}`,
      ticketNumber: `LPK-2026-0${seq}`,
      assetId: payload.assetId,
      locationId: asset.locationId,
      reportedBy: activeRoleProfile.officerName,
      reportDate: today,
      reportedCondition: payload.reportedCondition,
      chronology: payload.chronology,
      estimatedAction: payload.estimatedAction,
      status: 'BARU_DILAPORKAN',
    };
    setDamageReports((prev) => [newReport, ...prev]);
    setAssets((prev) =>
      prev.map((a) =>
        a.id === payload.assetId ? { ...a, kondisi: payload.reportedCondition } : a
      )
    );
    showToast(
      `Laporan kerusakan ${newReport.ticketNumber} dicatat dan kondisi aset diperbarui.`
    );
  };

  const handleUpdateDamageStatus = (
    reportId: string,
    nextStatus: DamageReportStatus
  ) => {
    if (!activeRoleProfile.permissions.canResolveDamage) return;
    const target = damageReports.find((d) => d.id === reportId);
    if (!target) return;
    const today = new Date().toISOString().slice(0, 10);

    setDamageReports((prev) =>
      prev.map((d) =>
        d.id === reportId
          ? {
              ...d,
              status: nextStatus,
              handledBy: activeRoleProfile.officerName,
              resolvedDate: nextStatus === 'SELESAI_DIPERBAIKI' ? today : d.resolvedDate,
              resolutionNote:
                nextStatus === 'SELESAI_DIPERBAIKI'
                  ? 'Perbaikan selesai dan unit dinyatakan laik operasi.'
                  : d.resolutionNote,
            }
          : d
      )
    );

    if (nextStatus === 'SELESAI_DIPERBAIKI') {
      setAssets((prev) =>
        prev.map((a) =>
          a.id === target.assetId ? { ...a, kondisi: 'BAIK' } : a
        )
      );
      showToast(`Perbaikan ${target.ticketNumber} selesai. Kondisi aset dipulihkan ke Baik.`);
    } else {
      showToast(`Status tiket ${target.ticketNumber} diperbarui ke Dalam Penanganan.`);
    }
  };

  const handleUpdateOpnameCheck = (
    assetId: string,
    status: OpnameStatus,
    observedCondition: ConditionStatus,
    notes: string
  ) => {
    if (!activeRoleProfile.permissions.canPerformOpname) return;
    const today = new Date().toISOString().slice(0, 10);
    setAssets((prev) =>
      prev.map((a) =>
        a.id === assetId
          ? {
              ...a,
              lastOpnameDate: today,
              lastOpnameStatus: status,
              kondisi: observedCondition,
              keterangan: notes || a.keterangan,
            }
          : a
      )
    );
    showToast(`Cek fisik opname aset ${assetId} tercatat (${status}).`);
  };

  const pendingMutationCount = mutations.filter(
    (m) => m.status === 'MENUNGGU_KASUBAG' || m.status === 'DISETUJUI_KASUBAG'
  ).length;
  const pendingDamageCount = damageReports.filter(
    (d) => d.status !== 'SELESAI_DIPERBAIKI'
  ).length;

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        activeModule={safeActiveModule}
        onSelectModule={(mod) => {
          setPreselectMutationAssetId('');
          setPreselectDamageAssetId('');
          if (mod === 'kib') {
            setKibInitialCategory('ALL');
            setKibInitialLocation('ALL');
          }
          setActiveModule(mod);
        }}
        roleProfile={session ? activeRoleProfile : null}
        authUser={session?.user ?? null}
        remainingSeconds={remainingSeconds}
        pendingMutationCount={pendingMutationCount}
        pendingDamageCount={pendingDamageCount}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onOpenLogin={() => {
          setSessionNotice('');
          setShowLoginScreen(true);
        }}
        onLogout={() => void handleLogout()}
        onResetDemo={handleResetDemo}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-8 h-16 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-md text-slate-600 hover:bg-slate-100 cursor-pointer"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="font-display font-bold text-[#0B2545] whitespace-nowrap shrink-0">
                SIMAS-BMD
              </span>
              <span className="text-slate-300" aria-hidden="true">
                /
              </span>
              <h1 className="font-semibold text-slate-800 truncate">
                {MODULE_TITLES[safeActiveModule]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 text-xs">
            {session ? (
              <>
                <span className="hidden md:inline text-slate-600 whitespace-nowrap">
                  {session.user.officerName} ·{' '}
                  <strong className="text-[#0B2545]">
                    {activeRoleProfile.shortLabel}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Keluar
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSessionNotice('');
                  setShowLoginScreen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                Masuk / Login
              </button>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 px-4 sm:px-8 py-6 max-w-[1440px] w-full mx-auto">
          {!session && (
            <div className="mb-5 px-4 py-3 rounded-md bg-white border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
              <div className="text-slate-700">
                <strong className="text-[#0B2545]">Mode Ringkasan Publik (Hanya Baca)</strong>
                <span className="mx-1.5 text-slate-300">·</span>
                <span>
                  Masuk dengan NIP atau Username untuk mengakses Master KIB A–F, Scanner QR, Mutasi, Opname, atau Panel Super Admin.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSessionNotice('');
                  setShowLoginScreen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
              >
                <LogIn className="w-3.5 h-3.5" />
                Login Pegawai
              </button>
            </div>
          )}

          {session && remainingSeconds > 0 && remainingSeconds <= 120 && (
            <div className="mb-5 px-4 py-3 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-xs font-medium flex items-center justify-between gap-4 no-print">
              <span className="tabular-nums">
                Peringatan Keamanan: Masa aktif sesi JWT akan berakhir dalam {remainingSeconds} detik.
              </span>
              <button
                type="button"
                onClick={() => void handleRefreshSession()}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded cursor-pointer shrink-0"
              >
                Perpanjang Sesi
              </button>
            </div>
          )}

          {toastMessage && (
            <div
              role="status"
              className="mb-5 px-4 py-3 rounded-md bg-[#0B2545] text-white text-xs font-medium flex items-center justify-between gap-4 no-print"
            >
              <span>{toastMessage}</span>
              <button
                type="button"
                onClick={() => setToastMessage('')}
                className="text-slate-300 hover:text-white underline text-[11px] shrink-0 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          )}

          {safeActiveModule === 'dashboard' && (
            <DashboardView
              assets={assets}
              locations={locations}
              mutations={mutations}
              damageReports={damageReports}
              roleProfile={activeRoleProfile}
              onNavigateModule={(mod) => {
                if (!session) {
                  requireLoginPrompt(MODULE_TITLES[mod]);
                  return;
                }
                setActiveModule(mod);
              }}
              onFilterKibByLocation={(locId) => {
                if (!session) {
                  requireLoginPrompt('daftar aset per lokasi');
                  return;
                }
                setKibInitialCategory('ALL');
                setKibInitialLocation(locId);
                setActiveModule('kib');
              }}
              onFilterKibByCategory={(cat) => {
                if (!session) {
                  requireLoginPrompt(`rincian KIB ${cat}`);
                  return;
                }
                setKibInitialCategory(cat);
                setKibInitialLocation('ALL');
                setActiveModule('kib');
              }}
            />
          )}

          {session && safeActiveModule === 'kib' && (
            <KibManagementView
              key={`${kibInitialCategory}-${kibInitialLocation}`}
              assets={assets}
              locations={locations}
              roleProfile={activeRoleProfile}
              initialKibFilter={kibInitialCategory}
              initialLocationFilter={kibInitialLocation}
              onAddAsset={handleAddAsset}
              onUpdateAsset={handleUpdateAsset}
              onDeleteAsset={handleDeleteAsset}
              onQuickNavigateToMutation={(assetId) => {
                setPreselectMutationAssetId(assetId);
                setActiveModule('mutasi');
              }}
              onQuickNavigateToDamage={(assetId) => {
                setPreselectDamageAssetId(assetId);
                setActiveModule('opname_laporan');
              }}
            />
          )}

          {session && safeActiveModule === 'kendaraan' && (
            <VehicleInventoryView
              vehicles={vehicles}
              maintenances={vehicleMaintenances}
              locations={locations}
              roleProfile={activeRoleProfile}
              onAddVehicle={handleAddVehicle}
              onUpdateVehicle={handleUpdateVehicle}
              onDeleteVehicle={handleDeleteVehicle}
              onAddMaintenance={handleAddVehicleMaintenance}
            />
          )}

          {session && safeActiveModule === 'qr_scanner' && (
            <QrScannerView
              assets={assets}
              locations={locations}
              mutations={mutations}
              damageReports={damageReports}
              roleProfile={activeRoleProfile}
              onRecordQuickOpname={handleUpdateOpnameCheck}
              onQuickNavigateToDamage={(assetId) => {
                setPreselectDamageAssetId(assetId);
                setActiveModule('opname_laporan');
              }}
            />
          )}

          {session && safeActiveModule === 'mutasi' && (
            <MutationView
              key={`mut-${preselectMutationAssetId}`}
              assets={assets}
              locations={locations}
              mutations={mutations}
              roleProfile={activeRoleProfile}
              preselectedAssetId={preselectMutationAssetId}
              onCreateMutation={handleCreateMutation}
              onApproveByKasubag={handleApproveByKasubag}
              onVerifyByPengurus={handleVerifyByPengurus}
            />
          )}

          {session && safeActiveModule === 'opname_laporan' && (
            <OpnameReportView
              key={`opn-${preselectDamageAssetId}`}
              assets={assets}
              locations={locations}
              damageReports={damageReports}
              roleProfile={activeRoleProfile}
              preselectedDamageAssetId={preselectDamageAssetId}
              onCreateDamageReport={handleCreateDamageReport}
              onUpdateDamageStatus={handleUpdateDamageStatus}
              onUpdateOpnameCheck={handleUpdateOpnameCheck}
            />
          )}

          {session &&
            safeActiveModule === 'rbac_audit' &&
            (activeRoleProfile.permissions.canViewAuditLogs ||
              activeRoleProfile.permissions.canManageRbacUsers) && (
              <RbacAuditView
                session={session}
                roleConfigs={roleConfigs}
                users={managedUsers}
                remainingSeconds={remainingSeconds}
                onRefreshSession={handleRefreshSession}
                onRbacUpdated={({
                  roleConfigs: nextConfigs,
                  users: nextUsers,
                  updatedSelfUser,
                  toast,
                }) => {
                  if (nextConfigs) {
                    setRoleConfigs((prev) => {
                      const merged = { ...prev };
                      (Object.keys(nextConfigs) as RoleId[]).forEach((r) => {
                        merged[r] = { ...prev[r], ...nextConfigs[r] };
                      });
                      return merged;
                    });
                  }
                  if (nextUsers) {
                    setManagedUsers(nextUsers);
                  }
                  if (updatedSelfUser) {
                    setSession((prev) => {
                      if (!prev) return prev;
                      const updatedSession = {
                        ...prev,
                        user: {
                          ...prev.user,
                          officerName: updatedSelfUser.officerName,
                          nip: updatedSelfUser.nip,
                          unitName: updatedSelfUser.unitName,
                        },
                      };
                      localStorage.setItem(
                        AUTH_STORAGE_KEY,
                        JSON.stringify(updatedSession)
                      );
                      return updatedSession;
                    });
                  }
                  if (toast) showToast(toast);
                }}
              />
            )}
        </main>

        <footer className="border-t border-slate-200 bg-white px-4 sm:px-8 py-3.5 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 no-print">
          <span>
            © 2026 Badan Penanggulangan Bencana Daerah Kabupaten Sidoarjo
          </span>
          <span className="tabular-nums">
            SIMAS-BMD · Standar Kode Barang Permendagri 108/2016
          </span>
        </footer>
      </div>
    </div>
  );
}
