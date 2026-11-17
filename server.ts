import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';

dotenv.config();

type RoleId =
  | 'SUPER_ADMIN'
  | 'ADMIN_PENGURUS'
  | 'KASUBAG_UMUM'
  | 'PETUGAS_LAPANGAN'
  | 'PIMPINAN_VIEWER';

type ModuleKey =
  | 'dashboard'
  | 'kib'
  | 'kendaraan'
  | 'qr_scanner'
  | 'mutasi'
  | 'opname_laporan'
  | 'rbac_audit';

interface RolePermissions {
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

interface RoleConfig {
  id: RoleId;
  label: string;
  shortLabel: string;
  redirectModule: ModuleKey;
  permissions: RolePermissions;
  allowedModules: ModuleKey[];
}

interface AuthAccount {
  id: string;
  username: string;
  nip: string;
  officerName: string;
  role: RoleId;
  unitName: string;
  isActive: boolean;
  salt: string;
  passwordHash: string;
}

interface JwtPayload {
  sub: string;
  username: string;
  nip: string;
  officerName: string;
  role: RoleId;
  unitName: string;
  redirectModule: ModuleKey;
  iat: number;
  exp: number;
}

interface AuditLogEntry {
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

const SESSION_TTL_SECONDS = 30 * 60;
const JWT_SECRET =
  process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, salt: string, expectedHex: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64').toString('utf8');
}

function signJwt(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  ttlSeconds = SESSION_TTL_SECONDS
): {
  token: string;
  iat: number;
  exp: number;
} {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttlSeconds;
  const fullPayload: JwtPayload = { ...payload, iat, exp };
  const headerB64 = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const sig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const sigB64 = base64UrlEncode(sig);
  return {
    token: `${headerB64}.${payloadB64}.${sigB64}`,
    iat,
    exp,
  };
}

function verifyJwt(
  token: string
): { valid: true; payload: JwtPayload } | { valid: false; reason: 'EXPIRED' | 'INVALID' } {
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'INVALID' };
  const [headerB64, payloadB64, sigB64] = parts;
  const expectedSig = base64UrlEncode(
    crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest()
  );

  const sigBuf = Buffer.from(sigB64);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { valid: false, reason: 'INVALID' };
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payloadB64)) as JwtPayload;
    const now = Math.floor(Date.now() / 1000);
    if (typeof parsed.exp !== 'number' || parsed.exp <= now) {
      return { valid: false, reason: 'EXPIRED' };
    }
    return { valid: true, payload: parsed };
  } catch {
    return { valid: false, reason: 'INVALID' };
  }
}

const ROLE_CONFIGS: Record<RoleId, RoleConfig> = {
  SUPER_ADMIN: {
    id: 'SUPER_ADMIN',
    label: 'Super Admin Sistem & Tata Kelola RBAC',
    shortLabel: 'Super Admin',
    redirectModule: 'rbac_audit',
    permissions: {
      canCreateAsset: true,
      canEditAsset: true,
      canDeleteAsset: true,
      canPrintQr: true,
      canApproveMutation: true,
      canVerifyMutation: true,
      canRequestMutation: true,
      canReportDamage: true,
      canResolveDamage: true,
      canPerformOpname: true,
      canExportReport: true,
      canViewAuditLogs: true,
      canManageRbacUsers: true,
    },
    allowedModules: [
      'dashboard',
      'kib',
      'kendaraan',
      'qr_scanner',
      'mutasi',
      'opname_laporan',
      'rbac_audit',
    ],
  },
  ADMIN_PENGURUS: {
    id: 'ADMIN_PENGURUS',
    label: 'Admin Sistem / Pengurus Barang',
    shortLabel: 'Pengurus Barang',
    redirectModule: 'kib',
    permissions: {
      canCreateAsset: true,
      canEditAsset: true,
      canDeleteAsset: true,
      canPrintQr: true,
      canApproveMutation: false,
      canVerifyMutation: true,
      canRequestMutation: true,
      canReportDamage: true,
      canResolveDamage: true,
      canPerformOpname: true,
      canExportReport: true,
      canViewAuditLogs: true,
      canManageRbacUsers: false,
    },
    allowedModules: [
      'dashboard',
      'kib',
      'kendaraan',
      'qr_scanner',
      'mutasi',
      'opname_laporan',
      'rbac_audit',
    ],
  },
  KASUBAG_UMUM: {
    id: 'KASUBAG_UMUM',
    label: 'Kasubag Umum & Kepegawaian',
    shortLabel: 'Kasubag Umum',
    redirectModule: 'mutasi',
    permissions: {
      canCreateAsset: false,
      canEditAsset: false,
      canDeleteAsset: false,
      canPrintQr: true,
      canApproveMutation: true,
      canVerifyMutation: false,
      canRequestMutation: true,
      canReportDamage: false,
      canResolveDamage: true,
      canPerformOpname: true,
      canExportReport: true,
      canViewAuditLogs: true,
      canManageRbacUsers: false,
    },
    allowedModules: [
      'dashboard',
      'kib',
      'kendaraan',
      'qr_scanner',
      'mutasi',
      'opname_laporan',
      'rbac_audit',
    ],
  },
  PETUGAS_LAPANGAN: {
    id: 'PETUGAS_LAPANGAN',
    label: 'Petugas Lapangan / Pos Damkar',
    shortLabel: 'Petugas Pos',
    redirectModule: 'qr_scanner',
    permissions: {
      canCreateAsset: false,
      canEditAsset: false,
      canDeleteAsset: false,
      canPrintQr: false,
      canApproveMutation: false,
      canVerifyMutation: false,
      canRequestMutation: true,
      canReportDamage: true,
      canResolveDamage: false,
      canPerformOpname: true,
      canExportReport: false,
      canViewAuditLogs: false,
      canManageRbacUsers: false,
    },
    allowedModules: ['dashboard', 'kib', 'kendaraan', 'qr_scanner', 'mutasi', 'opname_laporan'],
  },
  PIMPINAN_VIEWER: {
    id: 'PIMPINAN_VIEWER',
    label: 'Pimpinan / Kalaksa (Viewer)',
    shortLabel: 'Pimpinan / Viewer',
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
      canExportReport: true,
      canViewAuditLogs: false,
      canManageRbacUsers: false,
    },
    allowedModules: ['dashboard', 'kib', 'kendaraan', 'mutasi', 'opname_laporan'],
  },
};

const ACCOUNTS: AuthAccount[] = [
  {
    id: 'USR-000',
    username: 'superadmin',
    nip: '198001012000011001',
    officerName: 'Ahmad Taufik, S.Kom., M.T.',
    role: 'SUPER_ADMIN',
    unitName: 'Administrator Utama TI & Tata Kelola BMD BPBD',
    isActive: true,
    salt: 'simas-salt-00',
    passwordHash: hashPassword('SuperAdmin#2026', 'simas-salt-00'),
  },
  {
    id: 'USR-001',
    username: 'pengurus',
    nip: '198604122010011008',
    officerName: 'Hendra Wijaya, S.Sos.',
    role: 'ADMIN_PENGURUS',
    unitName: 'Subbag Umum & Kepegawaian · Pengurus BMD',
    isActive: true,
    salt: 'simas-salt-01',
    passwordHash: hashPassword('BpbdSda#2026', 'simas-salt-01'),
  },
  {
    id: 'USR-002',
    username: 'kasubag',
    nip: '197908212005012011',
    officerName: 'Dra. Siti Rahmawati, M.Si.',
    role: 'KASUBAG_UMUM',
    unitName: 'Sekretariat BPBD Kab. Sidoarjo',
    isActive: true,
    salt: 'simas-salt-02',
    passwordHash: hashPassword('Kasubag#2026', 'simas-salt-02'),
  },
  {
    id: 'USR-003',
    username: 'petugas',
    nip: '199103152019031004',
    officerName: 'Bambang Triyono',
    role: 'PETUGAS_LAPANGAN',
    unitName: 'Pos Damkar Buduran / Kota',
    isActive: true,
    salt: 'simas-salt-03',
    passwordHash: hashPassword('PosDamkar#2026', 'simas-salt-03'),
  },
  {
    id: 'USR-004',
    username: 'pimpinan',
    nip: '197211041998031006',
    officerName: 'Ir. Dwi Purnomo, M.T.',
    role: 'PIMPINAN_VIEWER',
    unitName: 'Kepala Pelaksana BPBD Kab. Sidoarjo',
    isActive: true,
    salt: 'simas-salt-04',
    passwordHash: hashPassword('Kalaksa#2026', 'simas-salt-04'),
  },
];

const auditLogs: AuditLogEntry[] = [
  {
    id: 'AUD-INIT-01',
    timestamp: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    identifier: '197908212005012011',
    officerName: 'Dra. Siti Rahmawati, M.Si.',
    role: 'KASUBAG_UMUM',
    event: 'LOGIN_SUCCESS',
    detail: 'Autentikasi berhasil · Redireksi otomatis ke Panel Approval Mutasi.',
    ipAddress: '10.15.4.22',
  },
  {
    id: 'AUD-INIT-02',
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    identifier: '199103152019031004',
    officerName: 'Bambang Triyono',
    role: 'PETUGAS_LAPANGAN',
    event: 'LOGIN_SUCCESS',
    detail: 'Autentikasi berhasil · Redireksi otomatis ke Pemindai QR Lapangan.',
    ipAddress: '10.15.8.14',
  },
];

function recordAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) {
  const newEntry: AuditLogEntry = {
    id: `AUD-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  auditLogs.unshift(newEntry);
  if (auditLogs.length > 150) {
    auditLogs.length = 150;
  }
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || '127.0.0.1';
}

function sanitizeAccount(acc: AuthAccount) {
  return {
    id: acc.id,
    username: acc.username,
    nip: acc.nip,
    officerName: acc.officerName,
    role: acc.role,
    unitName: acc.unitName,
    isActive: acc.isActive,
  };
}

interface AuthedRequest extends Request {
  authUser?: JwtPayload;
}

function requireJwt(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token sesi JWT tidak ditemukan. Silakan masuk kembali.' });
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const verification = verifyJwt(token);
  if (!verification.valid) {
    if (verification.reason === 'EXPIRED') {
      recordAudit({
        identifier: '-',
        officerName: 'Sesi Kedaluwarsa',
        role: 'UNKNOWN',
        event: 'SESSION_EXPIRED',
        detail: 'Token JWT telah melewati batas waktu aktif (timeout).',
        ipAddress: getClientIp(req),
      });
      res.status(401).json({ error: 'Masa aktif sesi JWT telah berakhir. Silakan login ulang.' });
      return;
    }
    res.status(401).json({ error: 'Token sesi JWT tidak valid.' });
    return;
  }
  req.authUser = verification.payload;
  next();
}

function requireSuperAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = req.authUser;
  if (!user || user.role !== 'SUPER_ADMIN') {
    recordAudit({
      identifier: user?.nip ?? '-',
      officerName: user?.officerName ?? 'Tidak Diketahui',
      role: user?.role ?? 'UNKNOWN',
      event: 'RBAC_DENIED',
      detail: 'Akses ditolak: Operasi perubahan pengguna atau kebijakan RBAC khusus Super Admin.',
      ipAddress: getClientIp(req),
    });
    res.status(403).json({
      error: 'Akses ditolak (RBAC). Hanya Super Admin Sistem yang dapat mengubah pengguna dan hak akses.',
    });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const rawIdentifier = String(req.body?.identifier ?? '').trim();
    const normalizedNip = rawIdentifier.replace(/\s+/g, '');
    const password = String(req.body?.password ?? '');
    const ipAddress = getClientIp(req);

    if (!rawIdentifier || !password) {
      recordAudit({
        identifier: rawIdentifier || '(kosong)',
        officerName: 'Tidak Diketahui',
        role: 'UNKNOWN',
        event: 'LOGIN_FAILED',
        detail: 'Gagal autentikasi: NIP/Username atau password kosong.',
        ipAddress,
      });
      res.status(400).json({ error: 'NIP/Username dan password wajib diisi.' });
      return;
    }

    const account = ACCOUNTS.find(
      (a) =>
        a.username.toLowerCase() === rawIdentifier.toLowerCase() ||
        a.nip.replace(/\s+/g, '') === normalizedNip
    );

    if (!account || !verifyPassword(password, account.salt, account.passwordHash)) {
      recordAudit({
        identifier: rawIdentifier,
        officerName: account ? account.officerName : 'Akun Tidak Terdaftar',
        role: account ? account.role : 'UNKNOWN',
        event: 'LOGIN_FAILED',
        detail: account
          ? 'Gagal autentikasi: Kata sandi tidak cocok.'
          : 'Gagal autentikasi: NIP atau username tidak ditemukan.',
        ipAddress,
      });
      res.status(401).json({
        error: 'NIP / Username atau kata sandi tidak sesuai. Percobaan ini dicatat pada audit log.',
      });
      return;
    }

    if (!account.isActive) {
      recordAudit({
        identifier: account.nip,
        officerName: account.officerName,
        role: account.role,
        event: 'LOGIN_FAILED',
        detail: 'Gagal autentikasi: Akun sedang dinonaktifkan oleh Super Admin.',
        ipAddress,
      });
      res.status(403).json({
        error: 'Akun ini sedang dinonaktifkan oleh Super Admin. Hubungi administrator sistem.',
      });
      return;
    }

    const roleConfig = ROLE_CONFIGS[account.role];
    const { token, iat, exp } = signJwt({
      sub: account.id,
      username: account.username,
      nip: account.nip,
      officerName: account.officerName,
      role: account.role,
      unitName: account.unitName,
      redirectModule: roleConfig.redirectModule,
    });

    recordAudit({
      identifier: account.nip,
      officerName: account.officerName,
      role: account.role,
      event: 'LOGIN_SUCCESS',
      detail: `Autentikasi JWT berhasil · Arahkan ke modul ${roleConfig.redirectModule}.`,
      ipAddress,
    });

    res.json({
      token,
      issuedAt: iat,
      expiresAt: exp,
      ttlSeconds: SESSION_TTL_SECONDS,
      user: {
        id: account.id,
        username: account.username,
        nip: account.nip,
        officerName: account.officerName,
        role: account.role,
        unitName: account.unitName,
        redirectModule: roleConfig.redirectModule,
      },
    });
  });

  app.get('/api/auth/session', requireJwt, (req: AuthedRequest, res: Response) => {
    const tokenUser = req.authUser!;
    const liveAccount = ACCOUNTS.find((a) => a.id === tokenUser.sub);
    if (!liveAccount || !liveAccount.isActive) {
      res.status(401).json({ error: 'Akun sudah tidak aktif. Silakan masuk kembali.' });
      return;
    }
    const roleConfig = ROLE_CONFIGS[liveAccount.role];
    const now = Math.floor(Date.now() / 1000);
    res.json({
      valid: true,
      remainingSeconds: Math.max(0, tokenUser.exp - now),
      expiresAt: tokenUser.exp,
      user: {
        id: liveAccount.id,
        username: liveAccount.username,
        nip: liveAccount.nip,
        officerName: liveAccount.officerName,
        role: liveAccount.role,
        unitName: liveAccount.unitName,
        redirectModule: roleConfig.redirectModule,
      },
    });
  });

  app.post('/api/auth/refresh', requireJwt, (req: AuthedRequest, res: Response) => {
    const tokenUser = req.authUser!;
    const liveAccount = ACCOUNTS.find((a) => a.id === tokenUser.sub);
    if (!liveAccount || !liveAccount.isActive) {
      res.status(401).json({ error: 'Akun tidak aktif.' });
      return;
    }
    const roleConfig = ROLE_CONFIGS[liveAccount.role];
    const { token, iat, exp } = signJwt({
      sub: liveAccount.id,
      username: liveAccount.username,
      nip: liveAccount.nip,
      officerName: liveAccount.officerName,
      role: liveAccount.role,
      unitName: liveAccount.unitName,
      redirectModule: roleConfig.redirectModule,
    });

    recordAudit({
      identifier: liveAccount.nip,
      officerName: liveAccount.officerName,
      role: liveAccount.role,
      event: 'TOKEN_REFRESH',
      detail: 'Perpanjangan masa aktif token JWT (+30 menit).',
      ipAddress: getClientIp(req),
    });

    res.json({
      token,
      issuedAt: iat,
      expiresAt: exp,
      ttlSeconds: SESSION_TTL_SECONDS,
    });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const verification = verifyJwt(authHeader.slice('Bearer '.length).trim());
      if (verification.valid) {
        recordAudit({
          identifier: verification.payload.nip,
          officerName: verification.payload.officerName,
          role: verification.payload.role,
          event: 'LOGOUT',
          detail: 'Pengguna keluar dari sesi SIMAS-BMD secara manual.',
          ipAddress: getClientIp(req),
        });
      }
    }
    res.json({ ok: true });
  });

  app.get('/api/auth/audit-logs', requireJwt, (req: AuthedRequest, res: Response) => {
    const user = req.authUser!;
    const liveRole = ACCOUNTS.find((a) => a.id === user.sub)?.role ?? user.role;
    const allowed = ROLE_CONFIGS[liveRole]?.permissions.canViewAuditLogs;
    if (!allowed) {
      recordAudit({
        identifier: user.nip,
        officerName: user.officerName,
        role: liveRole,
        event: 'RBAC_DENIED',
        detail: 'Akses ditolak: Role tidak memiliki izin membaca log audit keamanan.',
        ipAddress: getClientIp(req),
      });
      res.status(403).json({
        error: 'Akses ditolak (RBAC). Role Anda tidak memiliki izin mengakses log audit keamanan.',
      });
      return;
    }
    res.json({ logs: auditLogs });
  });

  // Public/Login directory preview (only non-sensitive display labels for login helper)
  app.get('/api/rbac/public-personas', (_req: Request, res: Response) => {
    res.json({
      accounts: ACCOUNTS.map((a) => ({
        id: a.id,
        username: a.username,
        nip: a.nip,
        officerName: a.officerName,
        role: a.role,
        roleLabel: ROLE_CONFIGS[a.role].label,
        redirectModule: ROLE_CONFIGS[a.role].redirectModule,
        isActive: a.isActive,
      })),
    });
  });

  // Get live RBAC configuration & user list (authenticated)
  app.get('/api/rbac/config', requireJwt, (_req: AuthedRequest, res: Response) => {
    res.json({
      roleConfigs: ROLE_CONFIGS,
      users: ACCOUNTS.map(sanitizeAccount),
    });
  });

  // Super Admin: Edit user name, NIP, unit, role, active state, or optional new password
  app.put(
    '/api/rbac/users/:id',
    requireJwt,
    requireSuperAdmin,
    (req: AuthedRequest, res: Response) => {
      const targetId = req.params.id;
      const target = ACCOUNTS.find((a) => a.id === targetId);
      if (!target) {
        res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
        return;
      }

      const nextName = String(req.body?.officerName ?? target.officerName).trim();
      const nextNip = String(req.body?.nip ?? target.nip).replace(/\s+/g, '').trim();
      const nextUnit = String(req.body?.unitName ?? target.unitName).trim();
      const nextRole = (req.body?.role ?? target.role) as RoleId;
      const nextActive =
        typeof req.body?.isActive === 'boolean' ? req.body.isActive : target.isActive;
      const newPassword =
        typeof req.body?.newPassword === 'string' ? req.body.newPassword.trim() : '';

      if (!nextName || !nextNip) {
        res.status(400).json({ error: 'Nama pegawai dan NIP wajib diisi.' });
        return;
      }

      if (!ROLE_CONFIGS[nextRole]) {
        res.status(400).json({ error: 'Role tidak valid.' });
        return;
      }

      // Prevent locking out the sole Super Admin
      if (target.role === 'SUPER_ADMIN' && (nextRole !== 'SUPER_ADMIN' || !nextActive)) {
        res.status(400).json({
          error: 'Akun Super Admin utama tidak boleh dinonaktifkan atau diturunkan rolenya.',
        });
        return;
      }

      const prevName = target.officerName;
      target.officerName = nextName;
      target.nip = nextNip;
      target.unitName = nextUnit || target.unitName;
      target.role = nextRole;
      target.isActive = nextActive;

      if (newPassword.length >= 6) {
        target.passwordHash = hashPassword(newPassword, target.salt);
      }

      const actor = req.authUser!;
      recordAudit({
        identifier: target.nip,
        officerName: actor.officerName,
        role: actor.role,
        event: 'USER_UPDATED',
        detail: `Super Admin memperbarui profil ${target.username} (${prevName} → ${target.officerName}, Role: ${ROLE_CONFIGS[target.role].shortLabel}, Aktif: ${target.isActive ? 'Ya' : 'Tidak'}).`,
        ipAddress: getClientIp(req),
      });

      res.json({
        user: sanitizeAccount(target),
        users: ACCOUNTS.map(sanitizeAccount),
      });
    }
  );

  // Super Admin: Create new officer account
  app.post(
    '/api/rbac/users',
    requireJwt,
    requireSuperAdmin,
    (req: AuthedRequest, res: Response) => {
      const username = String(req.body?.username ?? '')
        .trim()
        .toLowerCase();
      const nip = String(req.body?.nip ?? '').replace(/\s+/g, '').trim();
      const officerName = String(req.body?.officerName ?? '').trim();
      const unitName = String(req.body?.unitName ?? '').trim();
      const role = req.body?.role as RoleId;
      const password = String(req.body?.password ?? '').trim();

      if (!username || !nip || !officerName || !password || !ROLE_CONFIGS[role]) {
        res.status(400).json({
          error: 'Username, NIP, nama lengkap, role, dan kata sandi wajib diisi.',
        });
        return;
      }

      if (
        ACCOUNTS.some(
          (a) => a.username.toLowerCase() === username || a.nip === nip
        )
      ) {
        res.status(409).json({
          error: 'Username atau NIP sudah terdaftar di sistem.',
        });
        return;
      }

      const salt = `simas-salt-${Date.now()}`;
      const newAcc: AuthAccount = {
        id: `USR-${String(ACCOUNTS.length).padStart(3, '0')}`,
        username,
        nip,
        officerName,
        role,
        unitName: unitName || 'BPBD Kabupaten Sidoarjo',
        isActive: true,
        salt,
        passwordHash: hashPassword(password, salt),
      };
      ACCOUNTS.push(newAcc);

      const actor = req.authUser!;
      recordAudit({
        identifier: newAcc.nip,
        officerName: actor.officerName,
        role: actor.role,
        event: 'USER_UPDATED',
        detail: `Super Admin menambahkan akun baru ${newAcc.officerName} (@${newAcc.username}, Role: ${ROLE_CONFIGS[newAcc.role].shortLabel}).`,
        ipAddress: getClientIp(req),
      });

      res.status(201).json({
        user: sanitizeAccount(newAcc),
        users: ACCOUNTS.map(sanitizeAccount),
      });
    }
  );

  // Super Admin: Update RBAC permissions & redirectModule for a role
  app.put(
    '/api/rbac/roles/:roleId',
    requireJwt,
    requireSuperAdmin,
    (req: AuthedRequest, res: Response) => {
      const roleId = req.params.roleId as RoleId;
      const targetConfig = ROLE_CONFIGS[roleId];
      if (!targetConfig) {
        res.status(404).json({ error: 'Role tidak ditemukan.' });
        return;
      }

      const incomingPermissions = req.body?.permissions as Partial<RolePermissions> | undefined;
      const incomingRedirect = req.body?.redirectModule as ModuleKey | undefined;
      const incomingModules = req.body?.allowedModules as ModuleKey[] | undefined;

      if (incomingPermissions) {
        const merged: RolePermissions = {
          ...targetConfig.permissions,
          ...incomingPermissions,
        };
        if (roleId === 'SUPER_ADMIN') {
          merged.canManageRbacUsers = true;
          merged.canViewAuditLogs = true;
        }
        targetConfig.permissions = merged;
      }

      if (incomingRedirect) {
        targetConfig.redirectModule = incomingRedirect;
      }

      if (Array.isArray(incomingModules) && incomingModules.length > 0) {
        const set = new Set<ModuleKey>(incomingModules);
        set.add('dashboard');
        if (roleId === 'SUPER_ADMIN') set.add('rbac_audit');
        if (targetConfig.permissions.canViewAuditLogs) set.add('rbac_audit');
        targetConfig.allowedModules = Array.from(set);
      } else {
        // Auto-sync rbac_audit visibility with canViewAuditLogs / canManageRbacUsers
        const modSet = new Set<ModuleKey>(targetConfig.allowedModules);
        if (
          targetConfig.permissions.canViewAuditLogs ||
          targetConfig.permissions.canManageRbacUsers
        ) {
          modSet.add('rbac_audit');
        } else if (roleId !== 'SUPER_ADMIN') {
          modSet.delete('rbac_audit');
        }
        modSet.add(targetConfig.redirectModule);
        targetConfig.allowedModules = Array.from(modSet);
      }

      const actor = req.authUser!;
      recordAudit({
        identifier: actor.nip,
        officerName: actor.officerName,
        role: actor.role,
        event: 'RBAC_POLICY_UPDATED',
        detail: `Super Admin memperbarui hak akses RBAC untuk role ${targetConfig.shortLabel} (Redireksi: ${targetConfig.redirectModule}).`,
        ipAddress: getClientIp(req),
      });

      res.json({
        roleConfig: targetConfig,
        roleConfigs: ROLE_CONFIGS,
      });
    }
  );

  const distDir = path.resolve(process.cwd(), 'dist');
  const isProd =
    process.env.NODE_ENV === 'production' ||
    (fs.existsSync(distDir) && process.env.npm_lifecycle_event === 'start');
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.use((_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`SIMAS-BMD Server running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SIMAS-BMD server:', err);
  process.exit(1);
});
