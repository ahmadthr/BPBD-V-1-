import React from 'react';
import {
  ArrowLeftRight,
  ClipboardCheck,
  Clock,
  Database,
  LayoutDashboard,
  LogIn,
  LogOut,
  QrCode,
  RotateCcw,
  Shield,
  ShieldAlert,
  Truck,
  X,
} from 'lucide-react';
import { AuthSessionUser, ModuleKey, RoleProfile } from '../types/simas';

interface SidebarProps {
  activeModule: ModuleKey;
  onSelectModule: (mod: ModuleKey) => void;
  roleProfile: RoleProfile | null;
  authUser: AuthSessionUser | null;
  remainingSeconds: number;
  pendingMutationCount: number;
  pendingDamageCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenLogin: () => void;
  onLogout: () => void;
  onResetDemo: () => void;
}

const NAV_ITEMS: {
  key: ModuleKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: 'dashboard', label: 'Dashboard Eksekutif', icon: LayoutDashboard },
  { key: 'kib', label: 'Manajemen KIB A–F', icon: Database },
  { key: 'kendaraan', label: 'Inventaris Kendaraan', icon: Truck },
  { key: 'qr_scanner', label: 'QR Code & Scanner', icon: QrCode },
  { key: 'mutasi', label: 'Mutasi & Lokasi Aset', icon: ArrowLeftRight },
  { key: 'opname_laporan', label: 'Opname & Pelaporan', icon: ClipboardCheck },
  { key: 'rbac_audit', label: 'Keamanan & Audit RBAC', icon: ShieldAlert },
];

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  roleProfile,
  authUser,
  remainingSeconds,
  pendingMutationCount,
  pendingDamageCount,
  mobileOpen,
  onCloseMobile,
  onOpenLogin,
  onLogout,
  onResetDemo,
}) => {
  const allowedSet = new Set<ModuleKey>(
    roleProfile ? roleProfile.allowedModules : ['dashboard']
  );

  const [logoFailed, setLogoFailed] = React.useState(false);

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#0B2545] text-slate-100 select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white p-1 border border-white/20">
            {!logoFailed ? (
              <img
                src="/assets/aistudio/logo-bpbd-sidoarjo-removebg-preview_e9477ae6.png"
                alt="Logo BPBD Sidoarjo"
                referrerPolicy="no-referrer"
                onError={() => setLogoFailed(true)}
                className="w-full h-full object-contain"
              />
            ) : (
              <Shield className="h-5 w-5 text-[#0B2545]" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-display text-base font-bold tracking-tight text-white truncate">
              SIMAS-BMD
            </p>
            <p className="text-xs text-slate-300 truncate">
              BPBD Kab. Sidoarjo
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
          aria-label="Tutup menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Menu Utama">
        <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
          {authUser ? 'Modul Inventarisasi' : 'Ringkasan Publik'}
        </p>
        {NAV_ITEMS.map((item) => {
          const isAllowed = allowedSet.has(item.key);
          if (!isAllowed) return null;

          const Icon = item.icon;
          const isActive = activeModule === item.key;

          let countIndicator = 0;
          if (item.key === 'mutasi') countIndicator = pendingMutationCount;
          if (item.key === 'opname_laporan') countIndicator = pendingDamageCount;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                onSelectModule(item.key);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#17467E] text-white'
                  : 'text-slate-300 hover:text-white hover:bg-white/8'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="w-4 h-4 shrink-0 text-slate-300" aria-hidden="true" />
                <span className="truncate whitespace-nowrap">{item.label}</span>
              </span>
              {countIndicator > 0 && (
                <span className="font-mono text-xs font-semibold tabular-nums text-amber-300 shrink-0">
                  {countIndicator}
                </span>
              )}
            </button>
          );
        })}

        {!authUser && (
          <div className="px-3 pt-4">
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Masuk dengan akun NIP/Username untuk membuka Manajemen KIB A–F, QR Scanner, Mutasi, Opname, dan Panel Super Admin.
            </p>
          </div>
        )}
      </nav>

      {/* Bottom Auth Panel */}
      <div className="border-t border-white/10 p-4 space-y-3 bg-[#081C36]">
        {authUser && roleProfile ? (
          <>
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                {roleProfile.shortLabel}
              </p>
              <p className="text-xs font-semibold text-white truncate">
                {authUser.officerName}
              </p>
              <p className="font-mono text-[11px] text-slate-300 tabular-nums">
                NIP. {authUser.nip}
              </p>
              <p className="text-[11px] text-slate-400 truncate">{authUser.unitName}</p>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-300 pt-2 border-t border-white/10">
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" aria-hidden="true" />
                Sesi JWT
              </span>
              <span className="font-mono font-semibold text-white tabular-nums">
                {formatCountdown(remainingSeconds)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onLogout}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#163D6B] hover:bg-[#1E4F8A] border border-white/15 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                Keluar / Ganti Akun
              </button>
              <button
                type="button"
                onClick={onResetDemo}
                title="Reset data KIB simulasi ke kondisi awal"
                className="p-2 text-slate-300 hover:text-white border border-white/15 rounded-md hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                aria-label="Reset data KIB"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-2.5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                Mode Publik (Hanya Baca)
              </p>
              <p className="text-xs text-slate-300 mt-0.5">
                Belum masuk sesi pegawai
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onCloseMobile();
                onOpenLogin();
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold text-[#0B2545] bg-amber-400 hover:bg-amber-300 rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" />
              Masuk / Login Pegawai
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block lg:w-64 lg:shrink-0 border-r border-slate-200 no-print">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10 shadow-xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
