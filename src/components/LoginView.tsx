import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Shield,
  User,
} from 'lucide-react';
import { AuthSession } from '../types/simas';
import { apiGetPublicPersonas, apiLogin } from '../utils/authClient';

interface LoginViewProps {
  onLoginSuccess: (session: AuthSession) => void;
  onBackToDashboard?: () => void;
  sessionNotice?: string;
}

interface PublicPersona {
  id: string;
  username: string;
  nip: string;
  officerName: string;
  roleLabel: string;
  redirectDesc: string;
  passHint: string;
  isActive: boolean;
}

const DEFAULT_DEMO_ACCOUNTS: PublicPersona[] = [
  {
    id: 'USR-000',
    roleLabel: 'Super Admin Sistem',
    officerName: 'Ahmad Taufik, S.Kom., M.T.',
    username: 'superadmin',
    nip: '198001012000011001',
    passHint: 'SuperAdmin#2026',
    redirectDesc: 'Manajemen Hak Akses & User',
    isActive: true,
  },
  {
    id: 'USR-001',
    roleLabel: 'Admin / Pengurus Barang',
    officerName: 'Hendra Wijaya, S.Sos.',
    username: 'pengurus',
    nip: '198604122010011008',
    passHint: 'BpbdSda#2026',
    redirectDesc: 'Master KIB & Generator QR',
    isActive: true,
  },
  {
    id: 'USR-002',
    roleLabel: 'Kasubag Umum & Kepegawaian',
    officerName: 'Dra. Siti Rahmawati, M.Si.',
    username: 'kasubag',
    nip: '197908212005012011',
    passHint: 'Kasubag#2026',
    redirectDesc: 'Panel Approval Mutasi',
    isActive: true,
  },
  {
    id: 'USR-003',
    roleLabel: 'Petugas Lapangan / Pos',
    officerName: 'Bambang Triyono',
    username: 'petugas',
    nip: '199103152019031004',
    passHint: 'PosDamkar#2026',
    redirectDesc: 'Scanner QR & Check Kondisi',
    isActive: true,
  },
  {
    id: 'USR-004',
    roleLabel: 'Pimpinan / Viewer',
    officerName: 'Ir. Dwi Purnomo, M.T.',
    username: 'pimpinan',
    nip: '197211041998031006',
    passHint: 'Kalaksa#2026',
    redirectDesc: 'Dashboard Eksekutif (View-Only)',
    isActive: true,
  },
];

const DEFAULT_PASS_BY_USER: Record<string, string> = {
  superadmin: 'SuperAdmin#2026',
  pengurus: 'BpbdSda#2026',
  kasubag: 'Kasubag#2026',
  petugas: 'PosDamkar#2026',
  pimpinan: 'Kalaksa#2026',
};

const MODULE_DESC: Record<string, string> = {
  rbac_audit: 'Manajemen Hak Akses & User',
  kib: 'Master KIB & Generator QR',
  mutasi: 'Panel Approval Mutasi',
  qr_scanner: 'Scanner QR & Check Kondisi',
  dashboard: 'Dashboard Eksekutif',
  opname_laporan: 'Opname & Pelaporan',
};

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  onBackToDashboard,
  sessionNotice = '',
}) => {
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [personas, setPersonas] = useState<PublicPersona[]>(DEFAULT_DEMO_ACCOUNTS);

  useEffect(() => {
    let active = true;
    apiGetPublicPersonas()
      .then((accounts) => {
        if (!active || accounts.length === 0) return;
        const mapped: PublicPersona[] = accounts.map((a) => ({
          id: a.id,
          username: a.username,
          nip: a.nip,
          officerName: a.officerName,
          roleLabel: a.roleLabel,
          redirectDesc: MODULE_DESC[a.redirectModule] ?? a.redirectModule,
          passHint: DEFAULT_PASS_BY_USER[a.username] ?? '••••••••',
          isActive: a.isActive,
        }));
        setPersonas(mapped);
      })
      .catch(() => {
        // Keep default fallback
      });
    return () => {
      active = false;
    };
  }, []);

  const submitLogin = async (idValue: string, passValue: string) => {
    setErrorMessage('');
    setLoading(true);
    try {
      const result = await apiLogin(idValue, passValue);
      if (!result.ok) {
        setErrorMessage(result.error);
        setLoading(false);
        return;
      }
      onLoginSuccess(result.session);
    } catch {
      setErrorMessage('Terjadi gangguan saat memproses autentikasi.');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitLogin(identifier, password);
  };

  const handlePrefill = (username: string, pass: string) => {
    setIdentifier(username);
    setPassword(pass === '••••••••' ? '' : pass);
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between px-4 py-8 sm:px-6 lg:px-8">
      <div className="my-auto mx-auto w-full max-w-5xl space-y-3">
        {onBackToDashboard && (
          <div>
            <button
              type="button"
              onClick={onBackToDashboard}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B2545] hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke Dashboard Eksekutif
            </button>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Left Institutional Panel */}
          <div className="lg:col-span-5 bg-[#0B2545] text-white p-8 flex flex-col justify-between space-y-8">
            <div className="space-y-6">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-lg bg-[#163D6B] border border-white/15 flex items-center justify-center shrink-0">
                  <Shield className="h-6 w-6 text-amber-400" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-wider uppercase text-amber-300">
                    Pemerintah Kabupaten Sidoarjo
                  </p>
                  <p className="font-display text-lg font-bold tracking-tight text-white">
                    BPBD Kabupaten Sidoarjo
                  </p>
                </div>
              </div>

              <div className="space-y-2 border-t border-white/10 pt-6">
                <h1 className="font-display text-2xl font-bold tracking-tight text-white">
                  SIMAS-BMD
                </h1>
                <p className="text-sm text-slate-200 leading-relaxed">
                  Sistem Inventarisasi & Manajemen Aset Barang Milik Daerah Terintegrasi
                </p>
                <p className="text-xs font-semibold text-amber-300 pt-1">
                  Tertib Aset, Siap Siaga Bencana
                </p>
              </div>
            </div>

            <div className="space-y-3 border-t border-white/10 pt-6 text-xs">
              <p className="font-semibold text-slate-200">
                Redireksi Otomatis Berbasis Hak Akses (RBAC)
              </p>
              <ul className="space-y-2 text-slate-300">
                <li className="flex items-start justify-between gap-2">
                  <span>Super Admin Sistem</span>
                  <span className="text-amber-300 text-right">Hak Akses & Edit User</span>
                </li>
                <li className="flex items-start justify-between gap-2">
                  <span>Admin / Pengurus Barang</span>
                  <span className="text-amber-300 text-right">Master KIB & QR</span>
                </li>
                <li className="flex items-start justify-between gap-2">
                  <span>Kasubag Umum</span>
                  <span className="text-amber-300 text-right">Approval Mutasi</span>
                </li>
                <li className="flex items-start justify-between gap-2">
                  <span>Petugas Lapangan / Pos</span>
                  <span className="text-amber-300 text-right">Scanner QR & Kondisi</span>
                </li>
                <li className="flex items-start justify-between gap-2">
                  <span>Pimpinan / Viewer</span>
                  <span className="text-amber-300 text-right">Dashboard Eksekutif</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Minimalist Login Form */}
          <div className="lg:col-span-7 p-6 sm:p-10 space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="font-display text-xl font-bold text-slate-900">
                Masuk ke Portal Inventarisasi BMD
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Autentikasi dilindungi token sesi JWT dengan pencatatan audit log otomatis.
              </p>
            </div>

            {sessionNotice && !errorMessage && (
              <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>{sessionNotice}</span>
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-identifier"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  NIP atau Username
                </label>
                <div className="relative">
                  <User
                    className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="login-identifier"
                    type="text"
                    autoComplete="username"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Masukkan NIP (18 digit) atau username"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0B2545] font-mono"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Kata Sandi
                </label>
                <div className="relative">
                  <Lock
                    className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi terenkripsi"
                    className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0B2545]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] disabled:opacity-60 rounded-md transition-colors cursor-pointer"
              >
                <span>{loading ? 'Memverifikasi Kredensial...' : 'Masuk ke Sistem'}</span>
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            {/* Quick Credential Reference for RBAC Testing */}
            <div className="border-t border-slate-200 pt-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#0B2545]" aria-hidden="true" />
                  Daftar Akun Aktif (5 Persona RBAC)
                </p>
                <span className="text-[11px] text-slate-500">
                  Klik Isi Form untuk uji coba
                </span>
              </div>

              <div className="border border-slate-200 rounded-md overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                      <th className="py-2 px-3">Pegawai & Role</th>
                      <th className="py-2 px-3">Username / NIP</th>
                      <th className="py-2 px-3">Password</th>
                      <th className="py-2 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {personas.map((acc) => (
                      <tr
                        key={acc.id}
                        className={`hover:bg-slate-50 ${!acc.isActive ? 'opacity-55' : ''}`}
                      >
                        <td className="py-2 px-3">
                          <p className="font-semibold text-slate-900">{acc.officerName}</p>
                          <p className="text-[11px] text-slate-500">
                            {acc.roleLabel} · {acc.redirectDesc}
                          </p>
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-700 tabular-nums">
                          <div>{acc.username}</div>
                          <div className="text-slate-400">{acc.nip}</div>
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-700">
                          {acc.passHint}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handlePrefill(acc.username, acc.passHint)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-[#0B2545] border border-slate-300 hover:bg-slate-100 rounded cursor-pointer whitespace-nowrap"
                          >
                            Isi Form
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-6 text-center text-xs text-slate-500">
        SIMAS-BMD · Badan Penanggulangan Bencana Daerah Kabupaten Sidoarjo · Keamanan Sesi JWT & RBAC
      </footer>
    </div>
  );
};
