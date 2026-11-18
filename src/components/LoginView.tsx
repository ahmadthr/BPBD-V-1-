import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Flame,
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
  jabatan?: string;
  unitName: string;
  assignedLocationId?: string;
  roleLabel: string;
  redirectDesc: string;
  passHint: string;
  isActive: boolean;
}

const DEFAULT_DEMO_ACCOUNTS: PublicPersona[] = [
  {
    id: 'USR-000',
    roleLabel: 'Super Admin · Pengurus Barang Pengguna',
    officerName: 'Ahmad Thohir, A. Md.',
    jabatan: 'Kasubbag. Umum dan Kepegawaian',
    unitName: 'Kasubbag. Umum & Kepegawaian · Pengurus Barang Pengguna',
    username: 'superadmin',
    nip: '198706162010011008',
    passHint: 'SuperAdmin#2026',
    redirectDesc: 'Manajemen Hak Akses & User',
    isActive: true,
  },
  {
    id: 'USR-001',
    roleLabel: 'Pembantu Pengurus Barang Pengguna',
    officerName: 'Kusnadi, SP.',
    jabatan: 'Analis Kebencanaan Ahli Pertama',
    unitName: 'Pembantu Pengurus Barang Pengguna BPBD',
    username: 'kusnadi',
    nip: '197406012007011024',
    passHint: 'BpbdSda#2026',
    redirectDesc: 'Master KIB & Generator QR',
    isActive: true,
  },
  {
    id: 'USR-002',
    roleLabel: 'Pejabat Penatausahaan Pengguna Barang',
    officerName: 'Karsono, SE., M. Ak.',
    jabatan: 'Plt. Sekretaris (Kabid. Pencegahan dan Kesiapsiagaan)',
    unitName: 'Pejabat Penatausahaan Pengguna Barang BPBD',
    username: 'karsono',
    nip: '197209141998031004',
    passHint: 'Kasubag#2026',
    redirectDesc: 'Panel Approval Mutasi',
    isActive: true,
  },
  {
    id: 'USR-004',
    roleLabel: 'Pengguna Barang (Kepala Pelaksana)',
    officerName: 'Sabino Mariano, S. Sos., M.KP.',
    jabatan: 'Kepala Pelaksana',
    unitName: 'Kepala Pelaksana BPBD Kab. Sidoarjo',
    username: 'sabino',
    nip: '197401081993021003',
    passHint: 'Kalaksa#2026',
    redirectDesc: 'Dashboard Eksekutif (View-Only)',
    isActive: true,
  },
  {
    id: 'USR-POS-00',
    roleLabel: 'Admin Pos Mako BPBD',
    officerName: 'Operator Mako BPBD Sidoarjo',
    jabatan: 'Admin Aset Mako BPBD & Gudang Logistik',
    unitName: 'Mako BPBD & Gudang Logistik Sidoarjo',
    assignedLocationId: 'LOC-MAKO',
    username: 'pos.mako',
    nip: '198805102014021002',
    passHint: 'PosMako#2026',
    redirectDesc: 'Scanner QR & Inventaris Mako',
    isActive: true,
  },
  {
    id: 'USR-POS-01',
    roleLabel: 'Admin Pos Damkar Kota',
    officerName: 'Satuman',
    jabatan: 'Penanggung Jawab Pos Damkar Kota',
    unitName: 'Pos Damkar Kota Sidoarjo',
    assignedLocationId: 'LOC-POS-01',
    username: 'pos.kota',
    nip: '197804122009011001',
    passHint: 'PosKota#2026',
    redirectDesc: 'Scanner QR & Inventaris Pos Kota',
    isActive: true,
  },
  {
    id: 'USR-POS-02',
    roleLabel: 'Admin Pos Damkar Buduran',
    officerName: 'Ngadi, SH',
    jabatan: 'Penanggung Jawab Pos Damkar Buduran',
    unitName: 'Pos Damkar Buduran',
    assignedLocationId: 'LOC-POS-02',
    username: 'pos.buduran',
    nip: '197906182009011002',
    passHint: 'PosBuduran#2026',
    redirectDesc: 'Scanner QR & Inventaris Pos Buduran',
    isActive: true,
  },
  {
    id: 'USR-POS-03',
    roleLabel: 'Admin Pos Damkar Waru',
    officerName: 'Sutoyo',
    jabatan: 'Penanggung Jawab Pos Damkar Waru',
    unitName: 'Pos Damkar Waru',
    assignedLocationId: 'LOC-POS-03',
    username: 'pos.waru',
    nip: '198002142010011003',
    passHint: 'PosWaru#2026',
    redirectDesc: 'Scanner QR & Inventaris Pos Waru',
    isActive: true,
  },
  {
    id: 'USR-POS-04',
    roleLabel: 'Admin Pos Damkar Krian',
    officerName: 'Widy Agus Setyawan',
    jabatan: 'Penanggung Jawab Pos Damkar Krian',
    unitName: 'Pos Damkar Krian',
    assignedLocationId: 'LOC-POS-04',
    username: 'pos.krian',
    nip: '198208172011011004',
    passHint: 'PosKrian#2026',
    redirectDesc: 'Scanner QR & Inventaris Pos Krian',
    isActive: true,
  },
  {
    id: 'USR-POS-05',
    roleLabel: 'Admin Pos Damkar Porong',
    officerName: 'Edi Mulyadi',
    jabatan: 'Penanggung Jawab Pos Damkar Porong',
    unitName: 'Pos Damkar Porong',
    assignedLocationId: 'LOC-POS-05',
    username: 'pos.porong',
    nip: '198103222010011005',
    passHint: 'PosPorong#2026',
    redirectDesc: 'Scanner QR & Inventaris Pos Porong',
    isActive: true,
  },
  {
    id: 'USR-POS-06',
    roleLabel: 'Admin Pos Damkar Candi',
    officerName: 'Dita Mandariga',
    jabatan: 'Penanggung Jawab Pos Damkar Candi',
    unitName: 'Pos Damkar Candi',
    assignedLocationId: 'LOC-POS-06',
    username: 'pos.candi',
    nip: '198911092015021006',
    passHint: 'PosCandi#2026',
    redirectDesc: 'Scanner QR & Inventaris Pos Candi',
    isActive: true,
  },
  {
    id: 'USR-POS-07',
    roleLabel: 'Admin Pos Damkar Sukodono',
    officerName: 'Nur Achmad Zamanudin',
    jabatan: 'Penanggung Jawab Pos Damkar Sukodono',
    unitName: 'Pos Damkar Sukodono',
    assignedLocationId: 'LOC-POS-07',
    username: 'pos.sukodono',
    nip: '198704252014021007',
    passHint: 'PosSukodono#2026',
    redirectDesc: 'Scanner QR & Inventaris Pos Sukodono',
    isActive: true,
  },
];

const DEFAULT_PASS_BY_USER: Record<string, string> = {
  superadmin: 'SuperAdmin#2026',
  kusnadi: 'BpbdSda#2026',
  karsono: 'Kasubag#2026',
  sabino: 'Kalaksa#2026',
  'pos.mako': 'PosMako#2026',
  'pos.kota': 'PosKota#2026',
  'pos.buduran': 'PosBuduran#2026',
  'pos.waru': 'PosWaru#2026',
  'pos.krian': 'PosKrian#2026',
  'pos.porong': 'PosPorong#2026',
  'pos.candi': 'PosCandi#2026',
  'pos.sukodono': 'PosSukodono#2026',
};

const MODULE_DESC: Record<string, string> = {
  rbac_audit: 'Manajemen Hak Akses & User',
  kib: 'Master KIB & Generator QR',
  mutasi: 'Panel Approval Mutasi',
  qr_scanner: 'Scanner QR & Inventaris Pos',
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
  const [demoGroupTab, setDemoGroupTab] = useState<'tim' | 'pos'>('tim');
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
          jabatan: a.jabatan,
          unitName: a.unitName ?? a.roleLabel,
          assignedLocationId: a.assignedLocationId,
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

  const timPersonas = personas.filter((p) => !p.assignedLocationId);
  const posPersonas = personas.filter((p) => Boolean(p.assignedLocationId));
  const displayedPersonas = demoGroupTab === 'tim' ? timPersonas : posPersonas;

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
              Mewujudkan tata kelola aset daerah yang tertib administrasi, transparan, dan akuntabel oleh Tim Inventaris BMD bersama seluruh Pos Damkar di Kabupaten Sidoarjo.
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
                    placeholder="Masukkan NIP atau Username (misal: superadmin / pos.kota)"
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

          {/* Toggle Kredensial Tim Inventaris 2026 & Akun Khusus Pos */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowDemoList((prev) => !prev)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#0B192C]" aria-hidden="true" />
                Daftar Akun Tim Inventaris 2026 &amp; Akun Khusus Pos ({personas.length})
              </span>
              {showDemoList ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {showDemoList && (
              <div className="border-t border-slate-200">
                <div className="flex border-b border-slate-200 bg-slate-50 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setDemoGroupTab('tim')}
                    className={`flex-1 py-2 px-3 text-center cursor-pointer transition-colors ${
                      demoGroupTab === 'tim'
                        ? 'bg-white text-[#0B192C] border-b-2 border-[#0B192C]'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Tim Inventaris &amp; RBAC ({timPersonas.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoGroupTab('pos')}
                    className={`flex-1 py-2 px-3 text-center inline-flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                      demoGroupTab === 'pos'
                        ? 'bg-white text-[#0B192C] border-b-2 border-[#0B192C]'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Flame className="w-3 h-3 text-amber-600" aria-hidden="true" />
                    Akun Khusus Pos ({posPersonas.length})
                  </button>
                </div>

                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {displayedPersonas.map((acc) => (
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
                        <p className="text-[11px] text-slate-600 truncate">
                          {acc.jabatan ? `${acc.jabatan} · ` : ''}
                          {acc.unitName}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          <span className="font-mono text-slate-700">
                            {acc.username} / {acc.passHint}
                          </span>
                          {' · '}
                          <span className="font-mono">NIP {acc.nip}</span>
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
