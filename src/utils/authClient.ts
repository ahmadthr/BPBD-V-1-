import { ROLE_PROFILES } from '../data/initialData';
import {
  AuditLogEntry,
  AuthSession,
  ManagedUserAccount,
  ModuleKey,
  RoleId,
  RolePermissions,
  RoleProfile,
} from '../types/simas';

const FALLBACK_STORE_KEY = 'simas_bmd_local_auth_store_v2';
const SESSION_TTL_SECONDS = 30 * 60;

interface LocalAccount extends ManagedUserAccount {
  password: string;
  aliases?: string[];
}

interface LocalAuthStore {
  accounts: LocalAccount[];
  roleConfigs: Record<RoleId, RoleProfile>;
  auditLogs: AuditLogEntry[];
}

const DEFAULT_LOCAL_ACCOUNTS: LocalAccount[] = [
  {
    id: 'USR-000',
    username: 'superadmin',
    aliases: ['thohir', 'ahmad.thohir', 'pengurus'],
    nip: '198706162010011008',
    officerName: 'Ahmad Thohir, A. Md.',
    jabatan: 'Kasubbag. Umum dan Kepegawaian',
    role: 'SUPER_ADMIN',
    unitName: 'Kasubbag. Umum & Kepegawaian · Pengurus Barang Pengguna',
    isActive: true,
    password: 'SuperAdmin#2026',
  },
  {
    id: 'USR-001',
    username: 'kusnadi',
    aliases: ['pembantu', 'pengurus2'],
    nip: '197406012007011024',
    officerName: 'Kusnadi, SP.',
    jabatan: 'Analis Kebencanaan Ahli Pertama',
    role: 'ADMIN_PENGURUS',
    unitName: 'Pembantu Pengurus Barang Pengguna BPBD',
    isActive: true,
    password: 'BpbdSda#2026',
  },
  {
    id: 'USR-002',
    username: 'karsono',
    aliases: ['kasubag', 'penatausahaan', 'sekretaris'],
    nip: '197209141998031004',
    officerName: 'Karsono, SE., M. Ak.',
    jabatan: 'Plt. Sekretaris (Kabid. Pencegahan dan Kesiapsiagaan)',
    role: 'KASUBAG_UMUM',
    unitName: 'Pejabat Penatausahaan Pengguna Barang BPBD',
    isActive: true,
    password: 'Kasubag#2026',
  },
  {
    id: 'USR-004',
    username: 'sabino',
    aliases: ['pimpinan', 'kalaksa', 'penggunabarang'],
    nip: '197401081993021003',
    officerName: 'Sabino Mariano, S. Sos., M.KP.',
    jabatan: 'Kepala Pelaksana',
    role: 'PIMPINAN_VIEWER',
    unitName: 'Kepala Pelaksana BPBD · Pengguna Barang',
    isActive: true,
    password: 'Kalaksa#2026',
  },
  {
    id: 'USR-POS-00',
    username: 'pos.mako',
    aliases: ['mako'],
    nip: '199006112018011008',
    officerName: 'Mochamad Irfan',
    jabatan: 'Operator Aset Mako & Pusdalops',
    role: 'PETUGAS_LAPANGAN',
    unitName: 'Mako BPBD & Gudang Logistik Sidoarjo',
    assignedLocationId: 'LOC-MAKO',
    isActive: true,
    password: 'PosMako#2026',
  },
  {
    id: 'USR-POS-01',
    username: 'pos.kota',
    aliases: ['petugas', 'kota'],
    nip: '197804122009011001',
    officerName: 'Satuman',
    jabatan: 'Penanggung Jawab Pos Damkar Kota',
    role: 'PETUGAS_LAPANGAN',
    unitName: 'Pos Damkar Kota Sidoarjo',
    assignedLocationId: 'LOC-POS-01',
    isActive: true,
    password: 'PosKota#2026',
  },
  {
    id: 'USR-POS-02',
    username: 'pos.buduran',
    aliases: ['buduran'],
    nip: '197905142010011002',
    officerName: 'Ngadi, SH',
    jabatan: 'Penanggung Jawab Pos Damkar Buduran',
    role: 'PETUGAS_LAPANGAN',
    unitName: 'Pos Damkar Buduran',
    assignedLocationId: 'LOC-POS-02',
    isActive: true,
    password: 'PosBuduran#2026',
  },
  {
    id: 'USR-POS-03',
    username: 'pos.waru',
    aliases: ['waru'],
    nip: '198103102011011003',
    officerName: 'Sutoyo',
    jabatan: 'Penanggung Jawab Pos Damkar Waru',
    role: 'PETUGAS_LAPANGAN',
    unitName: 'Pos Damkar Waru',
    assignedLocationId: 'LOC-POS-03',
    isActive: true,
    password: 'PosWaru#2026',
  },
  {
    id: 'USR-POS-04',
    username: 'pos.krian',
    aliases: ['krian'],
    nip: '198307182012011004',
    officerName: 'Widy Agus Setyawan',
    jabatan: 'Penanggung Jawab Pos Damkar Krian',
    role: 'PETUGAS_LAPANGAN',
    unitName: 'Pos Damkar Krian',
    assignedLocationId: 'LOC-POS-04',
    isActive: true,
    password: 'PosKrian#2026',
  },
  {
    id: 'USR-POS-05',
    username: 'pos.porong',
    aliases: ['porong'],
    nip: '198409222013011005',
    officerName: 'Edi Mulyadi',
    jabatan: 'Penanggung Jawab Pos Damkar Porong',
    role: 'PETUGAS_LAPANGAN',
    unitName: 'Pos Damkar Porong',
    assignedLocationId: 'LOC-POS-05',
    isActive: true,
    password: 'PosPorong#2026',
  },
  {
    id: 'USR-POS-06',
    username: 'pos.candi',
    aliases: ['candi'],
    nip: '198611052014011006',
    officerName: 'Dita Mandariga',
    jabatan: 'Penanggung Jawab Pos Damkar Candi',
    role: 'PETUGAS_LAPANGAN',
    unitName: 'Pos Damkar Candi',
    assignedLocationId: 'LOC-POS-06',
    isActive: true,
    password: 'PosCandi#2026',
  },
  {
    id: 'USR-POS-07',
    username: 'pos.sukodono',
    aliases: ['sukodono'],
    nip: '198802172015011007',
    officerName: 'Nur Achmad Zamanudin',
    jabatan: 'Penanggung Jawab Pos Damkar Sukodono',
    role: 'PETUGAS_LAPANGAN',
    unitName: 'Pos Damkar Sukodono',
    assignedLocationId: 'LOC-POS-07',
    isActive: true,
    password: 'PosSukodono#2026',
  },
];

function stripSecret(acc: LocalAccount): ManagedUserAccount {
  const { password: _p, aliases: _a, ...rest } = acc;
  return rest;
}

function getLocalStore(): LocalAuthStore {
  try {
    const raw = localStorage.getItem(FALLBACK_STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalAuthStore;
      if (Array.isArray(parsed.accounts) && parsed.roleConfigs) {
        (Object.keys(parsed.roleConfigs) as RoleId[]).forEach((r) => {
          const mods = parsed.roleConfigs[r]?.allowedModules;
          if (Array.isArray(mods)) {
            if (!mods.includes('kendaraan')) mods.push('kendaraan');
            if (!mods.includes('kir')) mods.push('kir');
          }
        });
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  const init: LocalAuthStore = {
    accounts: DEFAULT_LOCAL_ACCOUNTS,
    roleConfigs: structuredClone(ROLE_PROFILES),
    auditLogs: [
      {
        id: 'AUD-LOCAL-01',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        identifier: '197209141998031004',
        officerName: 'Karsono, SE., M. Ak.',
        role: 'KASUBAG_UMUM',
        event: 'LOGIN_SUCCESS',
        detail: 'Autentikasi berhasil · Pejabat Penatausahaan Pengguna Barang · Redireksi ke Approval Mutasi.',
        ipAddress: '10.15.4.22',
      },
      {
        id: 'AUD-LOCAL-02',
        timestamp: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
        identifier: 'pos.krian',
        officerName: 'Widy Agus Setyawan',
        role: 'PETUGAS_LAPANGAN',
        event: 'LOGIN_SUCCESS',
        detail: 'Autentikasi berhasil (Pos Damkar Krian) · Redireksi ke Pemindai QR Lapangan.',
        ipAddress: '10.15.8.14',
      },
    ],
  };
  saveLocalStore(init);
  return init;
}

function saveLocalStore(store: LocalAuthStore): void {
  try {
    localStorage.setItem(FALLBACK_STORE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

function toBase64Url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64Url(b64u: string): string {
  const pad = b64u.length % 4 === 0 ? '' : '='.repeat(4 - (b64u.length % 4));
  const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return decodeURIComponent(escape(atob(b64)));
}

function buildLocalJwt(user: AuthSession['user']): { token: string; expiresAt: number } {
  const iat = Math.floor(Date.now() / 1000);
  const expiresAt = iat + SESSION_TTL_SECONDS;
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(JSON.stringify({ ...user, sub: user.id, iat, exp: expiresAt }));
  const sig = toBase64Url(`simas-bmd-local-${user.id}-${iat}`);
  return {
    token: `${header}.${payload}.${sig}`,
    expiresAt,
  };
}

function parseLocalJwt(token: string): { sub: string; exp: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(fromBase64Url(parts[1])) as { sub?: string; exp?: number };
    if (!payload.sub || !payload.exp) return null;
    return { sub: payload.sub, exp: payload.exp };
  } catch {
    return null;
  }
}

async function tryApi<T>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data: T; networkUnavailable?: false } | { networkUnavailable: true }> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { networkUnavailable: true };
    }
    const data = (await res.json()) as T;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { networkUnavailable: true };
  }
}

export async function apiLogin(
  identifier: string,
  password: string
): Promise<{ ok: true; session: AuthSession } | { ok: false; error: string }> {
  const remote = await tryApi<{
    token?: string;
    expiresAt?: number;
    user?: AuthSession['user'];
    error?: string;
  }>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });

  if (!('networkUnavailable' in remote)) {
    if (!remote.ok || !remote.data.token || !remote.data.user || !remote.data.expiresAt) {
      return {
        ok: false,
        error: remote.data.error || 'NIP / Username atau kata sandi tidak sesuai.',
      };
    }
    return {
      ok: true,
      session: {
        token: remote.data.token,
        expiresAt: remote.data.expiresAt,
        user: remote.data.user,
      },
    };
  }

  // Fallback for static CDN publish
  const store = getLocalStore();
  const idLower = identifier.trim().toLowerCase();
  const normalized = identifier.trim().replace(/\s+/g, '').toLowerCase();
  const account = store.accounts.find(
    (a) =>
      a.username.toLowerCase() === idLower ||
      Boolean(a.aliases?.some((al) => al.toLowerCase() === idLower)) ||
      a.nip.replace(/\s+/g, '').toLowerCase() === normalized
  );

  if (!account || account.password !== password) {
    store.auditLogs.unshift({
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      identifier: identifier || '(kosong)',
      officerName: account ? account.officerName : 'Akun Tidak Terdaftar',
      role: account ? account.role : 'UNKNOWN',
      event: 'LOGIN_FAILED',
      detail: 'Gagal autentikasi: NIP/Username atau kata sandi tidak cocok.',
      ipAddress: 'client-web',
    });
    saveLocalStore(store);
    return {
      ok: false,
      error: 'NIP / Username atau kata sandi tidak sesuai. Percobaan ini dicatat pada audit log.',
    };
  }

  if (!account.isActive) {
    return {
      ok: false,
      error: 'Akun ini sedang dinonaktifkan oleh Super Admin.',
    };
  }

  const roleCfg = store.roleConfigs[account.role] ?? ROLE_PROFILES[account.role];
  const sessionUser: AuthSession['user'] = {
    id: account.id,
    username: account.username,
    nip: account.nip,
    officerName: account.officerName,
    jabatan: account.jabatan,
    role: account.role,
    unitName: account.unitName,
    assignedLocationId: account.assignedLocationId,
    redirectModule: roleCfg.redirectModule,
  };
  const { token, expiresAt } = buildLocalJwt(sessionUser);

  store.auditLogs.unshift({
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    identifier: account.nip,
    officerName: account.officerName,
    role: account.role,
    event: 'LOGIN_SUCCESS',
    detail: `Autentikasi JWT berhasil (${account.unitName}) · Arahkan ke modul ${roleCfg.redirectModule}.`,
    ipAddress: 'client-web',
  });
  saveLocalStore(store);

  return { ok: true, session: { token, expiresAt, user: sessionUser } };
}

export async function apiVerifySession(
  token: string
): Promise<{ valid: boolean; user?: AuthSession['user'] }> {
  const remote = await tryApi<{ valid?: boolean; user?: AuthSession['user'] }>(
    '/api/auth/session',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!('networkUnavailable' in remote)) {
    if (!remote.ok) return { valid: false };
    return { valid: true, user: remote.data.user };
  }

  const parsed = parseLocalJwt(token);
  const now = Math.floor(Date.now() / 1000);
  if (!parsed || parsed.exp <= now) return { valid: false };
  const store = getLocalStore();
  const acc = store.accounts.find((a) => a.id === parsed.sub);
  if (!acc || !acc.isActive) return { valid: false };
  const roleCfg = store.roleConfigs[acc.role] ?? ROLE_PROFILES[acc.role];
  return {
    valid: true,
    user: {
      id: acc.id,
      username: acc.username,
      nip: acc.nip,
      officerName: acc.officerName,
      jabatan: acc.jabatan,
      role: acc.role,
      unitName: acc.unitName,
      assignedLocationId: acc.assignedLocationId,
      redirectModule: roleCfg.redirectModule,
    },
  };
}

export async function apiRefreshSession(
  session: AuthSession
): Promise<{ ok: boolean; token?: string; expiresAt?: number }> {
  const remote = await tryApi<{ token?: string; expiresAt?: number }>(
    '/api/auth/refresh',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.token}` },
    }
  );
  if (!('networkUnavailable' in remote)) {
    if (remote.ok && remote.data.token && remote.data.expiresAt) {
      return { ok: true, token: remote.data.token, expiresAt: remote.data.expiresAt };
    }
    return { ok: false };
  }

  const { token, expiresAt } = buildLocalJwt(session.user);
  const store = getLocalStore();
  store.auditLogs.unshift({
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    identifier: session.user.nip,
    officerName: session.user.officerName,
    role: session.user.role,
    event: 'TOKEN_REFRESH',
    detail: 'Perpanjangan masa aktif token JWT (+30 menit).',
    ipAddress: 'client-web',
  });
  saveLocalStore(store);
  return { ok: true, token, expiresAt };
}

export async function apiLogout(session: AuthSession | null): Promise<void> {
  if (!session) return;
  const remote = await tryApi('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.token}` },
  });
  if ('networkUnavailable' in remote) {
    const store = getLocalStore();
    store.auditLogs.unshift({
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      identifier: session.user.nip,
      officerName: session.user.officerName,
      role: session.user.role,
      event: 'LOGOUT',
      detail: 'Pengguna keluar dari sesi SIMAS-BMD secara manual.',
      ipAddress: 'client-web',
    });
    saveLocalStore(store);
  }
}

export interface PublicPersonaRecord {
  id: string;
  username: string;
  nip: string;
  officerName: string;
  jabatan?: string;
  unitName?: string;
  assignedLocationId?: string;
  role: RoleId;
  roleLabel: string;
  redirectModule: ModuleKey;
  isActive: boolean;
}

export async function apiGetPublicPersonas(): Promise<PublicPersonaRecord[]> {
  const remote = await tryApi<{
    accounts?: PublicPersonaRecord[];
  }>('/api/rbac/public-personas');

  if (!('networkUnavailable' in remote) && remote.ok && Array.isArray(remote.data.accounts)) {
    return remote.data.accounts;
  }

  const store = getLocalStore();
  return store.accounts.map((a) => ({
    id: a.id,
    username: a.username,
    nip: a.nip,
    officerName: a.officerName,
    jabatan: a.jabatan,
    unitName: a.unitName,
    assignedLocationId: a.assignedLocationId,
    role: a.role,
    roleLabel: (store.roleConfigs[a.role] ?? ROLE_PROFILES[a.role]).label,
    redirectModule: (store.roleConfigs[a.role] ?? ROLE_PROFILES[a.role]).redirectModule,
    isActive: a.isActive,
  }));
}

export async function apiGetRbacConfig(token: string): Promise<{
  roleConfigs: Record<RoleId, RoleProfile>;
  users: ManagedUserAccount[];
} | null> {
  const remote = await tryApi<{
    roleConfigs?: Record<RoleId, RoleProfile>;
    users?: ManagedUserAccount[];
  }>('/api/rbac/config', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!('networkUnavailable' in remote) && remote.ok && remote.data.roleConfigs && remote.data.users) {
    return {
      roleConfigs: remote.data.roleConfigs,
      users: remote.data.users,
    };
  }

  const store = getLocalStore();
  return {
    roleConfigs: store.roleConfigs,
    users: store.accounts.map(stripSecret),
  };
}

export async function apiGetAuditLogs(
  token: string,
  currentRole: RoleId
): Promise<{ ok: true; logs: AuditLogEntry[] } | { ok: false; error: string }> {
  const remote = await tryApi<{ logs?: AuditLogEntry[]; error?: string }>(
    '/api/auth/audit-logs',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!('networkUnavailable' in remote)) {
    if (!remote.ok) {
      return { ok: false, error: remote.data.error || 'Akses ditolak.' };
    }
    return { ok: true, logs: remote.data.logs ?? [] };
  }

  const store = getLocalStore();
  if (!store.roleConfigs[currentRole]?.permissions.canViewAuditLogs) {
    return { ok: false, error: 'Akses ditolak (RBAC).' };
  }
  return { ok: true, logs: store.auditLogs };
}

export async function apiUpdateUser(
  token: string,
  actor: AuthSession['user'],
  userId: string,
  payload: {
    officerName: string;
    nip: string;
    jabatan?: string;
    unitName: string;
    assignedLocationId?: string;
    role: RoleId;
    isActive: boolean;
    newPassword?: string;
  }
): Promise<
  | { ok: true; user: ManagedUserAccount; users: ManagedUserAccount[] }
  | { ok: false; error: string }
> {
  const remote = await tryApi<{
    user?: ManagedUserAccount;
    users?: ManagedUserAccount[];
    error?: string;
  }>(`/api/rbac/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!('networkUnavailable' in remote)) {
    if (!remote.ok || !remote.data.user || !remote.data.users) {
      return { ok: false, error: remote.data.error || 'Gagal memperbarui user.' };
    }
    return { ok: true, user: remote.data.user, users: remote.data.users };
  }

  if (actor.role !== 'SUPER_ADMIN') {
    return { ok: false, error: 'Hanya Super Admin yang dapat mengubah data pegawai.' };
  }
  const store = getLocalStore();
  const target = store.accounts.find((a) => a.id === userId);
  if (!target) return { ok: false, error: 'Pengguna tidak ditemukan.' };
  const prevName = target.officerName;
  target.officerName = payload.officerName.trim();
  target.nip = payload.nip.replace(/\s+/g, '').trim();
  if (typeof payload.jabatan === 'string') {
    target.jabatan = payload.jabatan.trim();
  }
  target.unitName = payload.unitName.trim();
  target.assignedLocationId =
    payload.assignedLocationId && payload.assignedLocationId.trim()
      ? payload.assignedLocationId.trim()
      : undefined;
  if (target.role !== 'SUPER_ADMIN') {
    target.role = payload.role;
    target.isActive = payload.isActive;
  }
  if (payload.newPassword && payload.newPassword.length >= 6) {
    target.password = payload.newPassword;
  }
  store.auditLogs.unshift({
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    identifier: target.nip,
    officerName: actor.officerName,
    role: actor.role,
    event: 'USER_UPDATED',
    detail: `Super Admin memperbarui profil ${target.username} (${prevName} → ${target.officerName}).`,
    ipAddress: 'client-web',
  });
  saveLocalStore(store);
  return {
    ok: true,
    user: stripSecret(target),
    users: store.accounts.map(stripSecret),
  };
}

export async function apiCreateUser(
  token: string,
  actor: AuthSession['user'],
  payload: {
    username: string;
    officerName: string;
    nip: string;
    jabatan?: string;
    unitName: string;
    assignedLocationId?: string;
    role: RoleId;
    password: string;
  }
): Promise<
  | { ok: true; user: ManagedUserAccount; users: ManagedUserAccount[] }
  | { ok: false; error: string }
> {
  const remote = await tryApi<{
    user?: ManagedUserAccount;
    users?: ManagedUserAccount[];
    error?: string;
  }>('/api/rbac/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!('networkUnavailable' in remote)) {
    if (!remote.ok || !remote.data.user || !remote.data.users) {
      return { ok: false, error: remote.data.error || 'Gagal membuat user baru.' };
    }
    return { ok: true, user: remote.data.user, users: remote.data.users };
  }

  if (actor.role !== 'SUPER_ADMIN') {
    return { ok: false, error: 'Hanya Super Admin yang dapat menambah akun.' };
  }
  const store = getLocalStore();
  const uname = payload.username.trim().toLowerCase();
  const nipClean = payload.nip.replace(/\s+/g, '').trim();
  if (store.accounts.some((a) => a.username.toLowerCase() === uname || a.nip === nipClean)) {
    return { ok: false, error: 'Username atau NIP sudah terdaftar.' };
  }
  const newAcc: LocalAccount = {
    id: `USR-${String(store.accounts.length).padStart(3, '0')}`,
    username: uname,
    nip: nipClean,
    officerName: payload.officerName.trim(),
    jabatan: payload.jabatan?.trim() || undefined,
    role: payload.role,
    unitName: payload.unitName.trim() || 'BPBD Kabupaten Sidoarjo',
    assignedLocationId:
      payload.assignedLocationId && payload.assignedLocationId.trim()
        ? payload.assignedLocationId.trim()
        : undefined,
    isActive: true,
    password: payload.password,
  };
  store.accounts.push(newAcc);
  store.auditLogs.unshift({
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    identifier: newAcc.nip,
    officerName: actor.officerName,
    role: actor.role,
    event: 'USER_UPDATED',
    detail: `Super Admin menambahkan akun baru ${newAcc.officerName} (@${newAcc.username}).`,
    ipAddress: 'client-web',
  });
  saveLocalStore(store);
  return {
    ok: true,
    user: stripSecret(newAcc),
    users: store.accounts.map(stripSecret),
  };
}

export async function apiUpdateRolePolicy(
  token: string,
  actor: AuthSession['user'],
  roleId: RoleId,
  payload: {
    permissions: RolePermissions;
    redirectModule: ModuleKey;
  }
): Promise<{ ok: boolean; roleConfigs?: Record<RoleId, RoleProfile> }> {
  const remote = await tryApi<{ roleConfigs?: Record<RoleId, RoleProfile> }>(
    `/api/rbac/roles/${roleId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }
  );
  if (!('networkUnavailable' in remote)) {
    return { ok: remote.ok, roleConfigs: remote.data.roleConfigs };
  }

  if (actor.role !== 'SUPER_ADMIN') return { ok: false };
  const store = getLocalStore();
  const cfg = store.roleConfigs[roleId];
  if (!cfg) return { ok: false };
  cfg.permissions = { ...payload.permissions };
  if (roleId === 'SUPER_ADMIN') {
    cfg.permissions.canManageRbacUsers = true;
    cfg.permissions.canViewAuditLogs = true;
  }
  cfg.redirectModule = payload.redirectModule;
  const mods = new Set<ModuleKey>(cfg.allowedModules);
  if (cfg.permissions.canViewAuditLogs || cfg.permissions.canManageRbacUsers) {
    mods.add('rbac_audit');
  } else if (roleId !== 'SUPER_ADMIN') {
    mods.delete('rbac_audit');
  }
  mods.add(cfg.redirectModule);
  cfg.allowedModules = Array.from(mods);

  store.auditLogs.unshift({
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    identifier: actor.nip,
    officerName: actor.officerName,
    role: actor.role,
    event: 'RBAC_POLICY_UPDATED',
    detail: `Super Admin memperbarui hak akses RBAC untuk role ${cfg.shortLabel}.`,
    ipAddress: 'client-web',
  });
  saveLocalStore(store);
  return { ok: true, roleConfigs: store.roleConfigs };
}
