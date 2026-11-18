import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LogIn, LogOut, Menu } from 'lucide-react';
import { AssetPublicProfileView } from './components/AssetPublicProfileView';
import { DashboardView } from './components/DashboardView';
import { KibManagementView } from './components/KibManagementView';
import { KirRoomCardView } from './components/KirRoomCardView';
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
  INITIAL_ROOMS,
  INITIAL_ROOM_ITEMS,
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
  RoomAssetEntry,
  RoomUnit,
  VehicleItem,
  VehicleMaintenanceRecord,
} from './types/simas';
import {
  apiGetRbacConfig,
  apiLogout,
  apiRefreshSession,
  apiVerifySession,
} from './utils/authClient';
import { buildAssetDetailUrl, buildRoomDetailUrl } from './utils/printHelper';

const STORAGE_KEY = 'simas_bmd_bpbd_sidoarjo_v2';
const AUTH_STORAGE_KEY = 'simas_bmd_jwt_session_v2';

interface PersistedDomainState {
  assets: AssetItem[];
  mutations: AssetMutation[];
  damageReports: DamageReport[];
  vehicles: VehicleItem[];
  vehicleMaintenances: VehicleMaintenanceRecord[];
  rooms: RoomUnit[];
  roomItems: RoomAssetEntry[];
}

const MODULE_TITLES: Record<ModuleKey, string> = {
  dashboard: 'Dashboard Eksekutif',
  kib: 'Manajemen KIB A–F',
  kendaraan: 'Inventaris Kendaraan (Roda 4 & Roda 2)',
  kir: 'Kartu Inventaris Ruangan (KIR)',
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
          rooms: Array.isArray(parsed.rooms) ? parsed.rooms : INITIAL_ROOMS,
          roomItems: Array.isArray(parsed.roomItems)
            ? parsed.roomItems
            : INITIAL_ROOM_ITEMS,
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
    rooms: INITIAL_ROOMS,
    roomItems: INITIAL_ROOM_ITEMS,
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

function parseAssetDetailFromLocation(): {
  kode: string;
  register: string;
  ruang: string;
} | null {
  try {
    const pathname = window.location.pathname.replace(/\/+$/, '');
    const searchParams = new URLSearchParams(window.location.search);

    let hashParams: URLSearchParams | null = null;
    let hashPath = '';
    if (window.location.hash) {
      const rawHash = window.location.hash.replace(/^#/, '');
      const qIdx = rawHash.indexOf('?');
      hashPath = (qIdx >= 0 ? rawHash.slice(0, qIdx) : rawHash).replace(/\/+$/, '');
      if (qIdx >= 0) {
        hashParams = new URLSearchParams(rawHash.slice(qIdx + 1));
      }
    }

    const kode = searchParams.get('kode') ?? hashParams?.get('kode') ?? '';
    const register =
      searchParams.get('register') ?? hashParams?.get('register') ?? '';
    const ruang = searchParams.get('ruang') ?? hashParams?.get('ruang') ?? '';
    const asetMode = searchParams.get('aset') ?? hashParams?.get('aset') ?? '';

    const isExplicitRoute =
      pathname === '/aset/detail' ||
      hashPath === '/aset/detail' ||
      asetMode === 'detail' ||
      asetMode === 'ruang';

    if (isExplicitRoute || Boolean(kode) || Boolean(ruang)) {
      return { kode, register, ruang };
    }
  } catch {
    // ignore
  }
  return null;
}

export default function App() {
  const initialDomain = useMemo(() => loadInitialDomainState(), []);
  const initialSession = useMemo(() => loadStoredSession(), []);

  const [assetDetailRoute, setAssetDetailRoute] = useState<{
    kode: string;
    register: string;
    ruang: string;
  } | null>(() => parseAssetDetailFromLocation());
  const [postLoginTargetModule, setPostLoginTargetModule] = useState<ModuleKey | null>(
    null
  );

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
  const [rooms, setRooms] = useState<RoomUnit[]>(initialDomain.rooms);
  const [roomItems, setRoomItems] = useState<RoomAssetEntry[]>(initialDomain.roomItems);
  const [activeModule, setActiveModule] = useState<ModuleKey>(
    initialSession ? initialSession.user.redirectModule : 'dashboard'
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const [kibInitialCategory, setKibInitialCategory] = useState<KibCategory | 'ALL'>('ALL');
  const [kibInitialLocation, setKibInitialLocation] = useState<string>(
    initialSession?.user.assignedLocationId ?? 'ALL'
  );
  const [preselectMutationAssetId, setPreselectMutationAssetId] = useState<string>('');
  const [preselectDamageAssetId, setPreselectDamageAssetId] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string>('');

  const locations = INITIAL_LOCATIONS;

  // Sync browser back/forward navigation with /aset/detail route
  useEffect(() => {
    const onPopState = () => {
      setAssetDetailRoute(parseAssetDetailFromLocation());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const openAssetDetailRoute = useCallback((kode: string, register: string) => {
    const { pathUrl } = buildAssetDetailUrl(kode, register);
    window.history.pushState({}, '', pathUrl);
    setAssetDetailRoute({ kode, register, ruang: '' });
  }, []);

  const openRoomDetailRoute = useCallback((roomId: string) => {
    const { pathUrl } = buildRoomDetailUrl(roomId);
    window.history.pushState({}, '', pathUrl);
    setAssetDetailRoute({ kode: '', register: '', ruang: roomId });
  }, []);

  const closeAssetDetailRoute = useCallback(() => {
    window.history.pushState({}, '', '/');
    setAssetDetailRoute(null);
  }, []);

  // Persist KIB, Vehicle & Room KIR domain data
  useEffect(() => {
    try {
      const payload: PersistedDomainState = {
        assets,
        mutations,
        damageReports,
        vehicles,
        vehicleMaintenances,
        rooms,
        roomItems,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota issues
    }
  }, [assets, mutations, damageReports, vehicles, vehicleMaintenances, rooms, roomItems]);

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
    const targetMod = postLoginTargetModule ?? newSession.user.redirectModule;
    setPostLoginTargetModule(null);
    setKibInitialCategory('ALL');
    setKibInitialLocation(newSession.user.assignedLocationId ?? 'ALL');
    setActiveModule(targetMod);
    const profile = roleConfigs[newSession.user.role] ?? ROLE_PROFILES[newSession.user.role];
    showToast(
      `Selamat datang, ${newSession.user.officerName} (${profile.shortLabel}). Dialihkan ke ${MODULE_TITLES[targetMod]}.`
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

  const currentProfileForDetail: RoleProfile = session
    ? {
        ...(roleConfigs[session.user.role] ?? ROLE_PROFILES[session.user.role]),
        officerName: session.user.officerName,
        nip: session.user.nip,
        jabatan: session.user.jabatan,
        unitName: session.user.unitName,
        assignedLocationId: session.user.assignedLocationId,
      }
    : PUBLIC_GUEST_PROFILE;

  // Public/Internal Asset & Room KIR Profile Route (/aset/detail?kode=...&register=... or ?ruang=...)
  if (assetDetailRoute) {
    return (
      <AssetPublicProfileView
        kodeParam={assetDetailRoute.kode}
        registerParam={assetDetailRoute.register}
        ruangParam={assetDetailRoute.ruang}
        assets={assets}
        vehicles={vehicles}
        vehicleMaintenances={vehicleMaintenances}
        locations={locations}
        mutations={mutations}
        damageReports={damageReports}
        rooms={rooms}
        roomItems={roomItems}
        session={session}
        roleProfile={currentProfileForDetail}
        onBackToDashboard={() => {
          closeAssetDetailRoute();
          setShowLoginScreen(false);
          setActiveModule('dashboard');
        }}
        onEditDataAction={({ type }) => {
          const destModule: ModuleKey =
            type === 'vehicle' ? 'kendaraan' : type === 'kir' ? 'kir' : 'kib';
          closeAssetDetailRoute();
          if (!session) {
            setPostLoginTargetModule(destModule);
            setSessionNotice(
              'Silakan masuk menggunakan akun pegawai berwenang untuk mengubah atau mencetak data.'
            );
            setShowLoginScreen(true);
            return;
          }
          setActiveModule(destModule);
        }}
        onSelectAlternateAsset={(kode, register) => {
          openAssetDetailRoute(kode, register);
        }}
      />
    );
  }

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
        jabatan: session.user.jabatan,
        unitName: session.user.unitName,
        assignedLocationId: session.user.assignedLocationId,
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
    setRooms(INITIAL_ROOMS);
    setRoomItems(INITIAL_ROOM_ITEMS);
    localStorage.removeItem(STORAGE_KEY);
    showToast('Data simulasi KIB, Kendaraan & KIR SIMAS-BMD telah dikembalikan ke kondisi awal.');
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

  const handleAddRoom = (newRoom: Omit<RoomUnit, 'id'>) => {
    if (!activeRoleProfile.permissions.canCreateAsset) return;
    const seq = rooms.length + 1;
    const id = `RM-${String(seq).padStart(2, '0')}`;
    setRooms((prev) => [...prev, { ...newRoom, id }]);
    showToast(`Ruangan KIR baru "${newRoom.namaRuang}" (${newRoom.kodeRuang}) ditambahkan.`);
  };

  const handleAddRoomItem = (newItem: Omit<RoomAssetEntry, 'id'>) => {
    if (!activeRoleProfile.permissions.canCreateAsset) return;
    const seq = roomItems.length + 1;
    const id = `KIR-${String(seq).padStart(3, '0')}`;
    setRoomItems((prev) => [...prev, { ...newItem, id }]);
    showToast(`Barang "${newItem.namaBarang}" ditambahkan ke Kartu Inventaris Ruangan.`);
  };

  const handleDeleteRoomItem = (itemId: string) => {
    if (!activeRoleProfile.permissions.canDeleteAsset) return;
    setRoomItems((prev) => prev.filter((item) => item.id !== itemId));
    showToast(`Item KIR ${itemId} dihapus dari daftar ruangan.`);
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
            setKibInitialLocation(activeRoleProfile.assignedLocationId ?? 'ALL');
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
                  {session.user.assignedLocationId && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[11px] font-semibold">
                      {locations.find((l) => l.id === session.user.assignedLocationId)?.code ??
                        session.user.assignedLocationId}
                    </span>
                  )}
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
              onOpenPublicProfile={openAssetDetailRoute}
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

          {session && safeActiveModule === 'kir' && (
            <KirRoomCardView
              rooms={rooms}
              roomItems={roomItems}
              locations={locations}
              roleProfile={activeRoleProfile}
              onAddRoom={handleAddRoom}
              onAddRoomItem={handleAddRoomItem}
              onDeleteRoomItem={handleDeleteRoomItem}
              onOpenRoomPublicView={openRoomDetailRoute}
            />
          )}

          {session && safeActiveModule === 'qr_scanner' && (
            <QrScannerView
              assets={assets}
              vehicles={vehicles}
              rooms={rooms}
              locations={locations}
              mutations={mutations}
              damageReports={damageReports}
              roleProfile={activeRoleProfile}
              onRecordQuickOpname={handleUpdateOpnameCheck}
              onQuickNavigateToDamage={(assetId) => {
                setPreselectDamageAssetId(assetId);
                setActiveModule('opname_laporan');
              }}
              onOpenPublicProfile={openAssetDetailRoute}
              onOpenRoomProfile={openRoomDetailRoute}
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
                          jabatan: updatedSelfUser.jabatan,
                          unitName: updatedSelfUser.unitName,
                          assignedLocationId: updatedSelfUser.assignedLocationId,
                          role: updatedSelfUser.role,
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
