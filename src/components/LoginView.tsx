import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  Shield,
  User,
} from 'lucide-react';
import { AuthSession } from '../types/simas';
import { apiGetPublicPersonas, apiLogin } from '../utils/authClient';

interface LoginViewProps {
  onLoginSuccess: (session: AuthSession) => void;
  onEnterPublicMode: () => void;
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

const LOGO_PATH = '/assets/aistudio/logo-bpbd-sidoarjo-removebg-preview_e9477ae6.png';

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  onEnterPublicMode,
  sessionNotice = '',
}) => {
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [logoError, setLogoError] = useState<boolean>(false);
  const [showDemoList, setShowDemoList] = useState<boolean>(false);
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
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-slate-100">
      {/* Sisi Kiri: Panel Branding Instansi Pemerintah (#0B192C) */}
      <section className="bg-[#0B192C] text-white flex flex-col items-center justify-center px-8 py-12 lg:px-14">
        <div className="max-w-md w-full text-center space-y-6">
          {/* Logo Resmi BPBD Sidoarjo */}
          <div className="mx-auto w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-white/95 p-3 shadow-lg flex items-center justify-center">
            {!logoError ? (
              <img
                src={LOGO_PATH}
                alt="Logo BPBD Sidoarjo"
                referrerPolicy="no-referrer"
                onError={() => setLogoError(true)}
                className="w-full h-full object-contain"
              />
            ) : (
              <Shield className="w-16 h-16 text-[#0B192C]" aria-hidden="true" />
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-widest uppercase text-amber-400">
              Pemerintah Kabupaten Sidoarjo
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              SIMAS-BMD
            </h1>
            <p className="font-display text-base sm:text-lg font-medium text-slate-200">
              Sistem Informasi Manajemen Barang Milik Daerah
            </p>
          </div>

          <div className="pt-4 border-t border-white/15">
            <p className="text-sm text-slate-300 leading-relaxed">
              Mewujudkan tata kelola aset daerah yang tertib administrasi, transparan, dan akuntabel guna mendukung kesiapsiagaan armada serta peralatan penanggulangan bencana di seluruh wilayah Kabupaten Sidoarjo.
            </p>
          </div>
        </div>
      </section>

      {/* Sisi Kanan: Form Login */}
      <section className="bg-slate-100 flex flex-col justify-between px-4 py-8 sm:px-10 lg:px-14">
        <div className="my-auto mx-auto w-full max-w-md space-y-5">
          {/* Card Form Login */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-7 sm:p-9 space-y-6">
            <div className="space-y-1.5">
              <h2 className="font-display text-2xl font-bold text-slate-900">
                Selamat Datang
              </h2>
              <p className="text-sm text-slate-500">
                Silakan masuk menggunakan NIP atau Username Anda
              </p>
            </div>

            {sessionNotice && !errorMessage && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>{sessionNotice}</span>
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Input Field 1: NIP / Username */}
              <div>
                <label
                  htmlFor="login-identifier"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  NIP / Username
                </label>
                <div className="relative">
                  <User
                    className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="login-identifier"
                    type="text"
                    autoComplete="username"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Masukkan NIP atau Username"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700 transition-colors"
                  />
                </div>
              </div>

              {/* Input Field 2: Password */}
              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock
                    className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    className="w-full pl-10 pr-11 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword ? 'Sembunyikan password' : 'Tampilkan password'
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Tombol Utama */}
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg shadow-sm transition-all duration-200 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>{loading ? 'Memverifikasi...' : 'Masuk / Login'}</span>
              </button>
            </form>

            {/* Opsi Alternatif: Masuk sebagai Pengamat / Mode Publik (Hanya Baca) */}
            <div className="pt-2 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={onEnterPublicMode}
                className="text-xs font-medium text-slate-600 hover:text-[#0B192C] hover:underline transition-colors cursor-pointer"
              >
                Masuk sebagai Pengamat / Mode Publik (Hanya Baca)
              </button>
            </div>
          </div>

          {/* Toggle Kredensial Uji Coba RBAC (Opsional & Rapi) */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowDemoList((prev) => !prev)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#0B192C]" aria-hidden="true" />
                Kredensial Uji Coba Hak Akses (5 Role RBAC)
              </span>
              {showDemoList ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {showDemoList && (
              <div className="border-t border-slate-200 divide-y divide-slate-100">
                {personas.map((acc) => (
                  <div
                    key={acc.id}
                    className={`px-4 py-2.5 flex items-center justify-between gap-3 text-xs ${
                      !acc.isActive ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">
                        {acc.officerName}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {acc.roleLabel} ·{' '}
                        <span className="font-mono text-slate-700">
                          {acc.username} / {acc.passHint}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePrefill(acc.username, acc.passHint)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-[#0B192C] border border-slate-300 hover:bg-slate-100 rounded cursor-pointer shrink-0"
                    >
                      Isi Form
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="pt-8 text-center text-xs text-slate-500">
          © 2026 Badan Penanggulangan Bencana Daerah Kabupaten Sidoarjo
        </footer>
      </section>
    </div>
  );
};
