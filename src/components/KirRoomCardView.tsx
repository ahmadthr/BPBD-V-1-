import React, { useEffect, useMemo, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import QRCode from 'qrcode';
import {
  Building2,
  Check,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Plus,
  Printer,
  Shield,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  ConditionStatus,
  LocationUnit,
  ManagedUserAccount,
  RoleProfile,
  RoomAssetEntry,
  RoomUnit,
} from '../types/simas';
import { resolvePosAdminForLocation } from '../utils/posAdminHelper';
import {
  KIR_FIELD_ALIASES,
  KIR_FIELD_DEFINITIONS,
  downloadKirExcelTemplate,
  exportWorkbookXlsx,
  mapRowsToKirEntries,
} from '../utils/excelImportHelper';
import {
  KIR_LOGO_PATH,
  KirSheetRenderData,
  buildKirPrintUrl,
  buildRoomDetailUrl,
  copyTextToClipboard,
  downloadHtmlDocument,
  downloadKirPdf,
  downloadKirPng,
  escapeHtml,
  fetchImageAsDataUrl,
} from '../utils/printHelper';
import { ExcelImportModal } from './ExcelImportModal';
import {
  ItemPhotoControl,
  ItemPhotoThumbnail,
  PhotoLightboxData,
  PhotoLightboxModal,
} from './ItemPhotoControl';
import { QrCodeImage } from './QrCodeCanvas';
import { ConditionIndicator } from './StatusText';

interface KirRoomCardViewProps {
  rooms: RoomUnit[];
  roomItems: RoomAssetEntry[];
  locations: LocationUnit[];
  roleProfile: RoleProfile;
  posAdmins?: ManagedUserAccount[];
  onAddRoom: (room: Omit<RoomUnit, 'id'>) => void;
  onAddRoomItem: (item: Omit<RoomAssetEntry, 'id'>) => void;
  onUpdateRoomItem?: (item: RoomAssetEntry) => void;
  onImportRoomItems?: (items: Omit<RoomAssetEntry, 'id'>[]) => void;
  onDeleteRoomItem: (itemId: string) => void;
  onOpenRoomPublicView: (roomId: string) => void;
}

const KIR_PRINT_CSS = `
  @page { size: A4 landscape; margin: 10mm; }
  .kir-sheet {
    border: 1.5px solid #0f172a;
    padding: 16px;
    background: #ffffff;
    page-break-after: always;
    break-after: page;
  }
  .kir-sheet:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .kir-kop {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 3px double #0f172a;
    padding-bottom: 10px;
    margin-bottom: 12px;
    gap: 14px;
  }
  .kir-kop-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .kir-logo {
    width: 54px;
    height: 54px;
    object-fit: contain;
  }
  .kir-gov { font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
  .kir-opd { font-size: 14px; font-weight: 800; color: #0B2545; text-transform: uppercase; }
  .kir-addr { font-size: 10px; color: #475569; }
  .kir-title {
    text-align: center;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin: 6px 0 12px 0;
  }
  .kir-meta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 24px;
    font-size: 11px;
    margin-bottom: 12px;
  }
  .kir-meta-row {
    display: flex;
    gap: 8px;
  }
  .kir-meta-label { width: 145px; color: #475569; flex-shrink: 0; }
  .kir-meta-val { font-weight: 700; color: #0f172a; }
  table.kir-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5px;
    margin-bottom: 14px;
  }
  table.kir-table th,
  table.kir-table td {
    border: 1px solid #334155;
    padding: 5px 6px;
    vertical-align: top;
  }
  table.kir-table th {
    background: #f1f5f9;
    font-weight: 700;
    text-align: center;
    text-transform: uppercase;
    font-size: 9.5px;
  }
  .kir-sign-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin-top: 18px;
    font-size: 10.5px;
    text-align: center;
  }
  .kir-sign-space { height: 52px; }
  .kir-qr-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    border: 1px solid #cbd5e1;
    padding: 4px;
  }
  .kir-qr-box img { width: 64px; height: 64px; display: block; }
  .kir-qr-box span { font-family: monospace; font-size: 8px; margin-top: 2px; color: #334155; }
`;

function exportKirToCsv(
  room: RoomUnit,
  items: RoomAssetEntry[]
): void {
  const headers = [
    'No',
    'Nama Ruangan',
    'Kode Ruang',
    'Nama Barang',
    'Merk / Model',
    'Tahun',
    'Kode Barang',
    'Nomor Register',
    'Jumlah',
    'Satuan',
    'Kondisi',
    'Keterangan',
  ];

  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const rows = items.map((it, idx) =>
    [
      idx + 1,
      room.namaRuang,
      room.kodeRuang,
      it.namaBarang,
      it.merkModel,
      it.tahunPerolehan,
      it.kodeBarang,
      it.nomorRegister,
      it.jumlah,
      it.satuan,
      it.kondisi === 'BAIK'
        ? 'Baik (B)'
        : it.kondisi === 'RUSAK_RINGAN'
          ? 'Rusak Ringan (RR)'
          : 'Rusak Berat (RB)',
      it.keterangan,
    ]
      .map(esc)
      .join(',')
  );

  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `KIR-${room.kodeRuang}-${room.id}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const KirRoomCardView: React.FC<KirRoomCardViewProps> = ({
  rooms,
  roomItems,
  locations,
  roleProfile,
  posAdmins = [],
  onAddRoom,
  onAddRoomItem,
  onUpdateRoomItem,
  onImportRoomItems,
  onDeleteRoomItem,
  onOpenRoomPublicView,
}) => {
  const lockedLocationId = roleProfile.assignedLocationId || '';
  const [selectedRoomId, setSelectedRoomId] = useState<string>(() => {
    if (lockedLocationId) {
      const posRoom = rooms.find((r) => r.locationId === lockedLocationId);
      if (posRoom) return posRoom.id;
    }
    return rooms[0]?.id ?? '';
  });

  useEffect(() => {
    if (rooms.length === 0) {
      setSelectedRoomId('');
      return;
    }
    if (!rooms.some((r) => r.id === selectedRoomId)) {
      const preferred = lockedLocationId
        ? rooms.find((r) => r.locationId === lockedLocationId)
        : rooms[0];
      setSelectedRoomId((preferred ?? rooms[0]).id);
    }
  }, [rooms, selectedRoomId, lockedLocationId]);
  const [logoFailed, setLogoFailed] = useState(false);
  const [busyPrint, setBusyPrint] = useState(false);
  const [printScope, setPrintScope] = useState<'current' | 'all'>('current');
  const [printFeedback, setPrintFeedback] = useState<string>('');
  const [copiedRoomUrl, setCopiedRoomUrl] = useState<boolean>(false);
  const [roomQrDataMap, setRoomQrDataMap] = useState<Record<string, string>>({});
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoLightboxData | null>(null);
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false);

  useEffect(() => {
    let host = document.getElementById('simas-print-portal');
    if (!host) {
      host = document.createElement('div');
      host.id = 'simas-print-portal';
      document.body.appendChild(host);
    }
    setPortalHost(host);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all(
      rooms.map(async (rm) => {
        const { fullUrl } = buildRoomDetailUrl(rm.id);
        const dataUrl = await QRCode.toDataURL(fullUrl, {
          width: 240,
          margin: 1,
          color: { dark: '#0B2545', light: '#FFFFFF' },
        });
        return [rm.id, dataUrl] as const;
      })
    ).then((entries) => {
      if (!active) return;
      const map: Record<string, string> = {};
      entries.forEach(([id, url]) => {
        map[id] = url;
      });
      setRoomQrDataMap(map);
    });
    return () => {
      active = false;
    };
  }, [rooms]);

  const buildDefaultRoomForm = (locId: string) => {
    const admin = resolvePosAdminForLocation(locId, posAdmins, locations, roleProfile);
    const loc = locations.find((l) => l.id === locId);
    return {
      kodeRuang: `12.15.04.01.${String(rooms.length + 1).padStart(2, '0')}`,
      namaRuang: '',
      locationId: locId,
      penanggungJawab: admin?.name ?? '',
      nipPenanggungJawab: admin?.nip && admin.nip !== '-' ? admin.nip : '',
      jabatanPenanggungJawab: admin?.jabatan ?? '',
      lantaiGedung: loc ? `${loc.name} · Lt. 1` : 'Gedung Mako Lt. 1',
    };
  };

  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [roomForm, setRoomForm] = useState(() =>
    buildDefaultRoomForm(lockedLocationId || locations[0]?.id || 'LOC-MAKO')
  );

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [editingRoomItem, setEditingRoomItem] = useState<RoomAssetEntry | null>(null);
  const [itemForm, setItemForm] = useState<{
    namaBarang: string;
    merkModel: string;
    tahunPerolehan: number;
    kodeBarang: string;
    nomorRegister: string;
    jumlah: number;
    satuan: string;
    kondisi: ConditionStatus;
    keterangan: string;
    fotoDataUrl?: string;
    fotoNamaFile?: string;
  }>({
    namaBarang: '',
    merkModel: '',
    tahunPerolehan: 2026,
    kodeBarang: '1.3.2.05.01.001',
    nomorRegister: '0001',
    jumlah: 1,
    satuan: 'Unit',
    kondisi: 'BAIK',
    keterangan: '',
    fotoDataUrl: undefined,
    fotoNamaFile: undefined,
  });

  const locationMap = useMemo(
    () => new Map(locations.map((l) => [l.id, l])),
    [locations]
  );

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) ?? rooms[0] ?? null,
    [rooms, selectedRoomId]
  );

  const activeItems = useMemo(
    () =>
      selectedRoom
        ? roomItems.filter((it) => it.roomId === selectedRoom.id)
        : [],
    [roomItems, selectedRoom]
  );

  const roomQrLinks = useMemo(
    () => (selectedRoom ? buildRoomDetailUrl(selectedRoom.id) : null),
    [selectedRoom]
  );

  const currentChromePrintUrl = useMemo(
    () =>
      selectedRoom
        ? buildKirPrintUrl(selectedRoom.id, 'current', true).pathUrl
        : '',
    [selectedRoom]
  );

  const allChromePrintUrl = useMemo(
    () => buildKirPrintUrl(undefined, 'all', true).pathUrl,
    []
  );

  const conditionSummary = useMemo(() => {
    const baik = activeItems.filter((i) => i.kondisi === 'BAIK').reduce((s, i) => s + i.jumlah, 0);
    const rr = activeItems
      .filter((i) => i.kondisi === 'RUSAK_RINGAN')
      .reduce((s, i) => s + i.jumlah, 0);
    const rb = activeItems
      .filter((i) => i.kondisi === 'RUSAK_BERAT')
      .reduce((s, i) => s + i.jumlah, 0);
    return { baik, rr, rb, totalQty: baik + rr + rb };
  }, [activeItems]);

  const buildKirSheetHtml = async (room: RoomUnit): Promise<string> => {
    const items = roomItems.filter((it) => it.roomId === room.id);
    const loc = locationMap.get(room.locationId);
    const { fullUrl } = buildRoomDetailUrl(room.id);
    const qrDataUrl = await QRCode.toDataURL(fullUrl, {
      width: 240,
      margin: 1,
      color: { dark: '#0B2545', light: '#FFFFFF' },
    });
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : '';
    const inlineLogo = await fetchImageAsDataUrl(KIR_LOGO_PATH);
    const logoUrl = inlineLogo ?? `${origin}${KIR_LOGO_PATH}`;
    const todayStr = new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date());

    const rowsHtml =
      items.length === 0
        ? `<tr><td colspan="11" style="text-align:center; padding: 18px; color: #64748b;">Belum ada daftar barang tercatat pada ruangan ini.</td></tr>`
        : items
            .map(
              (it, idx) => `
          <tr>
            <td style="text-align:center; font-family:monospace;">${idx + 1}</td>
            <td><strong>${escapeHtml(it.namaBarang)}</strong></td>
            <td>${escapeHtml(it.merkModel)}</td>
            <td style="text-align:center; font-family:monospace;">${escapeHtml(it.tahunPerolehan)}</td>
            <td style="font-family:monospace;">${escapeHtml(it.kodeBarang)}</td>
            <td style="text-align:center; font-family:monospace;">${escapeHtml(it.nomorRegister)}</td>
            <td style="text-align:center; font-family:monospace;">${escapeHtml(it.jumlah)} ${escapeHtml(it.satuan)}</td>
            <td style="text-align:center; font-weight:700;">${it.kondisi === 'BAIK' ? '✓' : '-'}</td>
            <td style="text-align:center; font-weight:700;">${it.kondisi === 'RUSAK_RINGAN' ? '✓' : '-'}</td>
            <td style="text-align:center; font-weight:700;">${it.kondisi === 'RUSAK_BERAT' ? '✓' : '-'}</td>
            <td>${escapeHtml(it.keterangan)}</td>
          </tr>
        `
            )
            .join('');

    return `
      <div class="kir-sheet">
        <div class="kir-kop">
          <div class="kir-kop-left">
            <img src="${escapeHtml(logoUrl)}" alt="Logo Pemerintah Kabupaten Sidoarjo" class="kir-logo" />
            <div>
              <div class="kir-gov">Pemerintah Kabupaten Sidoarjo</div>
              <div class="kir-opd">Badan Penanggulangan Bencana Daerah (BPBD)</div>
              <div class="kir-addr">Jl. Sultan Agung No. 19A, Magersari, Sidoarjo · Telp. (031) 8953200</div>
            </div>
          </div>
          <div class="kir-qr-box">
            <img src="${qrDataUrl}" alt="QR Ruangan ${escapeHtml(room.kodeRuang)}" />
            <span>${escapeHtml(room.kodeRuang)}</span>
          </div>
        </div>

        <div class="kir-title">Kartu Inventaris Ruangan (KIR)</div>

        <div class="kir-meta-grid">
          <div class="kir-meta-row"><span class="kir-meta-label">Provinsi / Kab.</span><span class="kir-meta-val">: Jawa Timur / Kabupaten Sidoarjo</span></div>
          <div class="kir-meta-row"><span class="kir-meta-label">Nama Ruangan</span><span class="kir-meta-val">: ${escapeHtml(room.namaRuang)}</span></div>
          <div class="kir-meta-row"><span class="kir-meta-label">Unit Kerja / OPD</span><span class="kir-meta-val">: BPBD Kabupaten Sidoarjo</span></div>
          <div class="kir-meta-row"><span class="kir-meta-label">Kode Lokasi / Ruang</span><span class="kir-meta-val" style="font-family:monospace;">: ${escapeHtml(room.kodeRuang)}</span></div>
          <div class="kir-meta-row"><span class="kir-meta-label">Pos / Gedung</span><span class="kir-meta-val">: ${escapeHtml(loc?.name ?? room.lantaiGedung)} (${escapeHtml(room.lantaiGedung)})</span></div>
          <div class="kir-meta-row"><span class="kir-meta-label">Penanggung Jawab</span><span class="kir-meta-val">: ${escapeHtml(room.penanggungJawab)}</span></div>
        </div>

        <table class="kir-table">
          <thead>
            <tr>
              <th rowspan="2" style="width:28px;">No</th>
              <th rowspan="2">Nama / Jenis Barang</th>
              <th rowspan="2">Merk / Model / Tipe</th>
              <th rowspan="2" style="width:46px;">Tahun</th>
              <th rowspan="2" style="width:110px;">Kode Barang</th>
              <th rowspan="2" style="width:62px;">No. Reg</th>
              <th rowspan="2" style="width:68px;">Jumlah</th>
              <th colspan="3">Keadaan Barang</th>
              <th rowspan="2">Keterangan</th>
            </tr>
            <tr>
              <th style="width:28px;">B</th>
              <th style="width:28px;">RR</th>
              <th style="width:28px;">RB</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div style="font-size:10px; color:#475569; margin-bottom:8px;">
          Catatan: B = Baik · RR = Rusak Ringan · RB = Rusak Berat. Dilarang memindahkan barang dari ruangan tanpa seizin Pengurus Barang Pengguna &amp; Pejabat Penatausahaan Pengguna Barang.
        </div>

        <div class="kir-sign-grid">
          <div>
            <div>Mengetahui,</div>
            <div><strong>Pengguna Barang / Kepala Pelaksana</strong></div>
            <div class="kir-sign-space"></div>
            <div><u><strong>Sabino Mariano, S. Sos., M.KP.</strong></u></div>
            <div style="font-family:monospace;">NIP. 19740108 199302 1 003</div>
          </div>
          <div>
            <div>Diperiksa Oleh,</div>
            <div><strong>Pengurus Barang Pengguna</strong></div>
            <div class="kir-sign-space"></div>
            <div><u><strong>Ahmad Thohir, A. Md.</strong></u></div>
            <div style="font-family:monospace;">NIP. 19870616 201001 1 008</div>
          </div>
          <div>
            <div>Sidoarjo, ${escapeHtml(todayStr)}</div>
            <div><strong>Penanggung Jawab Ruangan</strong></div>
            <div class="kir-sign-space"></div>
            <div><u><strong>${escapeHtml(room.penanggungJawab)}</strong></u></div>
            <div style="font-family:monospace;">NIP. ${escapeHtml(room.nipPenanggungJawab || '-')}</div>
          </div>
        </div>
      </div>
    `;
  };

  const toRenderData = (rm: RoomUnit): KirSheetRenderData => {
    const loc = locationMap.get(rm.locationId);
    const { fullUrl } = buildRoomDetailUrl(rm.id);
    return {
      roomId: rm.id,
      kodeRuang: rm.kodeRuang,
      namaRuang: rm.namaRuang,
      locationLabel: loc?.name ?? rm.lantaiGedung,
      lantaiGedung: rm.lantaiGedung,
      penanggungJawab: rm.penanggungJawab,
      nipPenanggungJawab: rm.nipPenanggungJawab,
      qrUrl: fullUrl,
      items: roomItems
        .filter((it) => it.roomId === rm.id)
        .map((it) => ({
          namaBarang: it.namaBarang,
          merkModel: it.merkModel,
          tahunPerolehan: it.tahunPerolehan,
          kodeBarang: it.kodeBarang,
          nomorRegister: it.nomorRegister,
          jumlah: it.jumlah,
          satuan: it.satuan,
          kondisi: it.kondisi,
          keterangan: it.keterangan,
        })),
    };
  };

  const triggerSyncPortalPrint = (scope: 'current' | 'all', label: string) => {
    flushSync(() => {
      setPrintScope(scope);
    });
    document.body.classList.add('simas-printing-portal');
    const cleanup = () => {
      document.body.classList.remove('simas-printing-portal');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    try {
      window.print();
      setPrintFeedback(
        `Perintah cetak "${label}" dikirim ke browser. Jika dialog cetak tidak muncul karena pembatasan iframe, klik "Buka & Cetak di Chrome" atau "Unduh PDF Ruangan Ini".`
      );
    } catch {
      setPrintFeedback(
        `Dialog cetak diblokir oleh iframe browser. Gunakan "Buka & Cetak di Chrome" atau "Unduh PDF Ruangan Ini" untuk mencetak "${label}".`
      );
    } finally {
      window.setTimeout(cleanup, 1200);
    }
  };

  const handlePrintCurrentKir = () => {
    if (!selectedRoom) return;
    triggerSyncPortalPrint('current', `KIR ${selectedRoom.namaRuang}`);
  };

  const handleDownloadCurrentPdf = async () => {
    if (!selectedRoom) return;
    setBusyPrint(true);
    try {
      await downloadKirPdf(
        [toRenderData(selectedRoom)],
        `KIR-${selectedRoom.kodeRuang}-${selectedRoom.id}.pdf`
      );
      setPrintFeedback(
        `PDF A4 Landscape "KIR-${selectedRoom.kodeRuang}-${selectedRoom.id}.pdf" berhasil diunduh dan siap dicetak.`
      );
    } finally {
      setBusyPrint(false);
    }
  };

  const handleDownloadAllPdf = async () => {
    if (rooms.length === 0) return;
    setBusyPrint(true);
    try {
      await downloadKirPdf(
        rooms.map(toRenderData),
        `KIR-Semua-Ruangan-BPBD-Sidoarjo.pdf`
      );
      setPrintFeedback(
        `PDF multi-halaman (${rooms.length} ruangan) berhasil diunduh dan siap dicetak.`
      );
    } finally {
      setBusyPrint(false);
    }
  };

  const handleDownloadCurrentPng = async () => {
    if (!selectedRoom) return;
    setBusyPrint(true);
    try {
      await downloadKirPng(
        toRenderData(selectedRoom),
        `KIR-${selectedRoom.kodeRuang}-${selectedRoom.id}.png`
      );
    } finally {
      setBusyPrint(false);
    }
  };

  const handleDownloadKirHtml = async () => {
    if (!selectedRoom) return;
    setBusyPrint(true);
    try {
      const sheetHtml = await buildKirSheetHtml(selectedRoom);
      downloadHtmlDocument(
        `KIR-${selectedRoom.kodeRuang}-${selectedRoom.id}.html`,
        `KIR - ${selectedRoom.namaRuang}`,
        sheetHtml,
        KIR_PRINT_CSS
      );
    } finally {
      setBusyPrint(false);
    }
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomForm.namaRuang.trim() || !roomForm.penanggungJawab.trim()) return;
    const effectiveLocationId = lockedLocationId || roomForm.locationId;
    onAddRoom({
      ...roomForm,
      locationId: effectiveLocationId,
    });
    setAddRoomOpen(false);
    setRoomForm(buildDefaultRoomForm(lockedLocationId || locations[0]?.id || 'LOC-MAKO'));
  };

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom || !itemForm.namaBarang.trim()) return;
    if (editingRoomItem && onUpdateRoomItem) {
      onUpdateRoomItem({
        ...editingRoomItem,
        ...itemForm,
      });
    } else {
      onAddRoomItem({
        roomId: selectedRoom.id,
        ...itemForm,
      });
    }
    setAddItemOpen(false);
    setEditingRoomItem(null);
    setItemForm({
      namaBarang: '',
      merkModel: '',
      tahunPerolehan: 2026,
      kodeBarang: '1.3.2.05.01.001',
      nomorRegister: '0001',
      jumlah: 1,
      satuan: 'Unit',
      kondisi: 'BAIK',
      keterangan: '',
      fotoDataUrl: undefined,
      fotoNamaFile: undefined,
    });
  };

  const canModifyKir =
    roleProfile.permissions.canCreateAsset || roleProfile.permissions.canEditAsset;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4 no-print">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Cetak Kartu Inventaris Ruangan (KIR) Siap Tempel
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Daftar barang inventaris per ruangan kantor Mako &amp; 7 Pos Damkar sesuai standar Permendagri 108/2016
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {selectedRoom && (
            <>
              <a
                href={currentChromePrintUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak KIR di Chrome
                <ExternalLink className="w-3 h-3 opacity-80" />
              </a>
              <button
                type="button"
                disabled={busyPrint}
                onClick={handlePrintCurrentKir}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0B2545] bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-md cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Cepat
              </button>
              <button
                type="button"
                disabled={busyPrint}
                onClick={() => void handleDownloadCurrentPdf()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0B2545] bg-amber-100 hover:bg-amber-200 border border-amber-300 disabled:opacity-50 rounded-md cursor-pointer whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5" />
                Unduh PDF KIR
              </button>
              {rooms.length > 1 && (
                <>
                  <a
                    href={allChromePrintUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0B2545] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer whitespace-nowrap"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Cetak Semua di Chrome ({rooms.length})
                    <ExternalLink className="w-3 h-3 opacity-75" />
                  </a>
                  <button
                    type="button"
                    disabled={busyPrint}
                    onClick={() => void handleDownloadAllPdf()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-md cursor-pointer whitespace-nowrap"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    PDF Semua ({rooms.length})
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={busyPrint}
                onClick={() => void handleDownloadCurrentPng()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-md cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                PNG
              </button>
              <button
                type="button"
                disabled={busyPrint}
                onClick={() => void handleDownloadKirHtml()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer whitespace-nowrap"
              >
                <FileCode2 className="w-3.5 h-3.5" />
                HTML
              </button>
              <button
                type="button"
                onClick={() =>
                  exportWorkbookXlsx(
                    `KIR_${selectedRoom.kodeRuang}`,
                    [
                      'No',
                      'Nama Ruangan',
                      'Kode Ruang',
                      'Nama / Jenis Barang',
                      'Merk / Model',
                      'Tahun',
                      'Kode Barang',
                      'No. Register',
                      'Jumlah',
                      'Satuan',
                      'Kondisi',
                      'Keterangan',
                    ],
                    activeItems.map((it, idx) => [
                      idx + 1,
                      selectedRoom.namaRuang,
                      selectedRoom.kodeRuang,
                      it.namaBarang,
                      it.merkModel,
                      it.tahunPerolehan,
                      it.kodeBarang,
                      it.nomorRegister,
                      it.jumlah,
                      it.satuan,
                      it.kondisi,
                      it.keterangan,
                    ]),
                    `KIR-${selectedRoom.kodeRuang}-${selectedRoom.id}.xlsx`
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0B2545] bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-md cursor-pointer whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={() => exportKirToCsv(selectedRoom, activeItems)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
              {roomQrLinks && (
                <button
                  type="button"
                  onClick={() => {
                    void copyTextToClipboard(roomQrLinks.fullUrl).then((ok) => {
                      if (ok) {
                        setCopiedRoomUrl(true);
                        window.setTimeout(() => setCopiedRoomUrl(false), 2000);
                      }
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0B2545] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer whitespace-nowrap"
                >
                  {copiedRoomUrl ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                      Tautan Disalin
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Salin Tautan QR
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {printFeedback && (
        <div className="px-4 py-3 rounded-md bg-amber-50 border border-amber-300 text-amber-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
          <span>{printFeedback}</span>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {selectedRoom && (
              <>
                <a
                  href={currentChromePrintUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  Buka &amp; Cetak di Chrome
                </a>
                <button
                  type="button"
                  onClick={() => void handleDownloadCurrentPdf()}
                  className="px-3 py-1.5 text-[11px] font-semibold text-[#0B2545] bg-white border border-amber-300 hover:bg-amber-100 rounded cursor-pointer"
                >
                  Unduh PDF Ruangan Ini
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setPrintFeedback('')}
              className="px-2 py-1 text-[11px] text-amber-900 underline cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Room Picker & Management Toolbar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Room Directory */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-4 space-y-3 no-print">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#0B2545]" aria-hidden="true" />
              Pilih Ruangan / Pos ({rooms.length})
            </h3>
            {canModifyKir && (
              <button
                type="button"
                onClick={() => {
                  const defaultLoc =
                    lockedLocationId ||
                    selectedRoom?.locationId ||
                    locations[0]?.id ||
                    'LOC-MAKO';
                  setRoomForm(buildDefaultRoomForm(defaultLoc));
                  setAddRoomOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#0B2545] border border-slate-300 hover:bg-slate-50 rounded cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                Ruang Baru
              </button>
            )}
          </div>

          <div className="space-y-1.5 max-h-[540px] overflow-y-auto pr-1">
            {rooms.map((rm) => {
              const count = roomItems.filter((i) => i.roomId === rm.id).length;
              const isSelected = selectedRoom?.id === rm.id;
              return (
                <button
                  key={rm.id}
                  type="button"
                  onClick={() => setSelectedRoomId(rm.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-md border text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#0B2545] text-white border-[#0B2545]'
                      : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold truncate">{rm.namaRuang}</span>
                    <span
                      className={`font-mono text-[11px] shrink-0 tabular-nums ${
                        isSelected ? 'text-amber-300' : 'text-slate-500'
                      }`}
                    >
                      {count} item
                    </span>
                  </div>
                  <div
                    className={`text-[11px] mt-0.5 flex items-center justify-between gap-2 ${
                      isSelected ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    <span className="truncate">{rm.lantaiGedung}</span>
                    <span className="font-mono shrink-0">{rm.kodeRuang}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Live Official KIR Sheet Preview */}
        <div className="lg:col-span-8 space-y-4">
          {selectedRoom ? (
            <div className="bg-white border-2 border-slate-900 p-5 sm:p-7 shadow-sm space-y-5">
              {/* Official Kop Surat */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-4 border-double border-slate-900 pb-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 shrink-0 flex items-center justify-center">
                    {!logoFailed ? (
                      <img
                        src={KIR_LOGO_PATH}
                        alt="Logo Pemerintah Kabupaten Sidoarjo"
                        referrerPolicy="no-referrer"
                        onError={() => setLogoFailed(true)}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Shield className="w-10 h-10 text-[#0B2545]" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Pemerintah Kabupaten Sidoarjo
                    </p>
                    <p className="font-display text-base sm:text-lg font-extrabold uppercase text-[#0B2545]">
                      Badan Penanggulangan Bencana Daerah
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Jl. Sultan Agung No. 19A, Magersari, Sidoarjo · Telp. (031) 8953200
                    </p>
                  </div>
                </div>

                {roomQrLinks && (
                  <button
                    type="button"
                    onClick={() => onOpenRoomPublicView(selectedRoom.id)}
                    title="Klik untuk membuka halaman verifikasi QR ruangan ini"
                    className="self-start sm:self-auto flex flex-col items-center p-1.5 border border-slate-300 bg-white hover:border-[#0B2545] cursor-pointer"
                  >
                    <QrCodeImage value={roomQrLinks.fullUrl} size={68} />
                    <span className="font-mono text-[9px] text-slate-600 mt-1">
                      {selectedRoom.kodeRuang}
                    </span>
                  </button>
                )}
              </div>

              {/* Document Title */}
              <div className="text-center">
                <h3 className="font-display text-base font-extrabold tracking-widest uppercase text-slate-900">
                  Kartu Inventaris Ruangan (KIR)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tempelkan kartu ini pada dinding ruangan sebagai kendali fisik Barang Milik Daerah
                </p>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-xs border border-slate-200 bg-slate-50/60 p-3.5 rounded">
                <div className="flex gap-2">
                  <span className="w-36 text-slate-500 shrink-0">Provinsi / Kab.</span>
                  <span className="font-semibold text-slate-900">
                    : Jawa Timur / Kab. Sidoarjo
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="w-36 text-slate-500 shrink-0">Nama Ruangan</span>
                  <span className="font-bold text-[#0B2545]">
                    : {selectedRoom.namaRuang}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="w-36 text-slate-500 shrink-0">Unit Kerja / OPD</span>
                  <span className="font-semibold text-slate-900">
                    : BPBD Kab. Sidoarjo
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="w-36 text-slate-500 shrink-0">Kode Lokasi / Ruang</span>
                  <span className="font-mono font-semibold text-slate-900">
                    : {selectedRoom.kodeRuang}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="w-36 text-slate-500 shrink-0">Lokasi Gedung / Pos</span>
                  <span className="font-semibold text-slate-900">
                    : {selectedRoom.lantaiGedung}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="w-36 text-slate-500 shrink-0">Penanggung Jawab</span>
                  <span className="font-semibold text-slate-900">
                    : {selectedRoom.penanggungJawab}
                  </span>
                </div>
              </div>

              {/* Toolbar Tambah Barang Ruangan */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs no-print">
                <div className="text-slate-600 tabular-nums">
                  Total: <strong>{conditionSummary.totalQty}</strong> unit (Baik:{' '}
                  <span className="text-emerald-700 font-semibold">
                    {conditionSummary.baik}
                  </span>
                  , RR:{' '}
                  <span className="text-amber-700 font-semibold">
                    {conditionSummary.rr}
                  </span>
                  , RB:{' '}
                  <span className="text-red-700 font-semibold">
                    {conditionSummary.rb}
                  </span>
                  )
                </div>
                {(canModifyKir || roleProfile.id === 'SUPER_ADMIN') && (
                  <div className="flex flex-wrap items-center gap-2">
                    {roleProfile.id === 'SUPER_ADMIN' && (
                      <button
                        type="button"
                        onClick={() => setImportModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0B2545] bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Import Excel ke Ruangan
                      </button>
                    )}
                    {canModifyKir && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRoomItem(null);
                          setItemForm({
                            namaBarang: '',
                            merkModel: '',
                            tahunPerolehan: 2026,
                            kodeBarang: '1.3.2.05.01.001',
                            nomorRegister: '0001',
                            jumlah: 1,
                            satuan: 'Unit',
                            kondisi: 'BAIK',
                            keterangan: '',
                            fotoDataUrl: undefined,
                            fotoNamaFile: undefined,
                          });
                          setAddItemOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Tambah Barang ke Ruangan
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Standard KIR Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border border-slate-800 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-[11px] font-bold uppercase text-slate-800">
                      <th className="border border-slate-700 py-2 px-2 text-center w-9">
                        No
                      </th>
                      <th className="border border-slate-700 py-2 px-2 text-center no-print">
                        Foto
                      </th>
                      <th className="border border-slate-700 py-2 px-2.5">
                        Nama / Jenis Barang
                      </th>
                      <th className="border border-slate-700 py-2 px-2.5">
                        Merk / Model
                      </th>
                      <th className="border border-slate-700 py-2 px-2 text-center">
                        Thn
                      </th>
                      <th className="border border-slate-700 py-2 px-2.5">
                        Kode Barang
                      </th>
                      <th className="border border-slate-700 py-2 px-2 text-center">
                        Reg
                      </th>
                      <th className="border border-slate-700 py-2 px-2 text-center">
                        Jml
                      </th>
                      <th className="border border-slate-700 py-2 px-2.5">
                        Kondisi
                      </th>
                      <th className="border border-slate-700 py-2 px-2.5">
                        Keterangan
                      </th>
                      {canModifyKir && (
                        <th className="border border-slate-700 py-2 px-2 text-center no-print">
                          Aksi
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {activeItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={canModifyKir ? 11 : 10}
                          className="border border-slate-700 py-8 text-center text-slate-500"
                        >
                          Belum ada barang terdaftar pada ruangan ini.
                        </td>
                      </tr>
                    ) : (
                      activeItems.map((it, idx) => (
                        <tr key={it.id} className="hover:bg-slate-50/70">
                          <td className="border border-slate-700 py-2 px-2 text-center font-mono tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="border border-slate-700 py-2 px-2 no-print">
                            <div className="flex justify-center">
                              <ItemPhotoThumbnail
                                fotoDataUrl={it.fotoDataUrl}
                                alt={it.namaBarang}
                                onClick={() =>
                                  it.fotoDataUrl &&
                                  setLightboxPhoto({
                                    title: it.namaBarang,
                                    subtitle: `${selectedRoom.namaRuang} · ${it.kodeBarang}`,
                                    dataUrl: it.fotoDataUrl,
                                    fileName: it.fotoNamaFile,
                                  })
                                }
                              />
                            </div>
                          </td>
                          <td className="border border-slate-700 py-2 px-2.5 font-semibold text-slate-900">
                            {it.namaBarang}
                          </td>
                          <td className="border border-slate-700 py-2 px-2.5 text-slate-700">
                            {it.merkModel}
                          </td>
                          <td className="border border-slate-700 py-2 px-2 text-center font-mono tabular-nums">
                            {it.tahunPerolehan}
                          </td>
                          <td className="border border-slate-700 py-2 px-2.5 font-mono text-[11px] tabular-nums">
                            {it.kodeBarang}
                          </td>
                          <td className="border border-slate-700 py-2 px-2 text-center font-mono tabular-nums">
                            {it.nomorRegister}
                          </td>
                          <td className="border border-slate-700 py-2 px-2 text-center font-mono whitespace-nowrap tabular-nums">
                            {it.jumlah} {it.satuan}
                          </td>
                          <td className="border border-slate-700 py-2 px-2.5 whitespace-nowrap">
                            <ConditionIndicator condition={it.kondisi} compact />
                          </td>
                          <td className="border border-slate-700 py-2 px-2.5 text-slate-600">
                            {it.keterangan}
                          </td>
                          {canModifyKir && (
                            <td className="border border-slate-700 py-2 px-2 text-center no-print">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingRoomItem(it);
                                    setItemForm({
                                      namaBarang: it.namaBarang,
                                      merkModel: it.merkModel,
                                      tahunPerolehan: it.tahunPerolehan,
                                      kodeBarang: it.kodeBarang,
                                      nomorRegister: it.nomorRegister,
                                      jumlah: it.jumlah,
                                      satuan: it.satuan,
                                      kondisi: it.kondisi,
                                      keterangan: it.keterangan,
                                      fotoDataUrl: it.fotoDataUrl,
                                      fotoNamaFile: it.fotoNamaFile,
                                    });
                                    setAddItemOpen(true);
                                  }}
                                  title="Edit barang / unggah foto"
                                  className="p-1 text-slate-500 hover:text-[#0B2545] cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteRoomItem(it.id)}
                                  title="Hapus barang dari ruangan"
                                  className="p-1 text-slate-400 hover:text-red-700 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Signature Block */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 text-center text-xs">
                <div>
                  <p>Mengetahui,</p>
                  <p className="font-bold">Pengguna Barang / Kepala Pelaksana</p>
                  <div className="h-14" />
                  <p className="font-bold underline">Sabino Mariano, S. Sos., M.KP.</p>
                  <p className="font-mono text-[11px] text-slate-600">
                    NIP. 19740108 199302 1 003
                  </p>
                </div>
                <div>
                  <p>Diperiksa Oleh,</p>
                  <p className="font-bold">Pengurus Barang Pengguna</p>
                  <div className="h-14" />
                  <p className="font-bold underline">Ahmad Thohir, A. Md.</p>
                  <p className="font-mono text-[11px] text-slate-600">
                    NIP. 19870616 201001 1 008
                  </p>
                </div>
                <div>
                  <p>Sidoarjo, {new Date().getFullYear()}</p>
                  <p className="font-bold">Penanggung Jawab Ruangan</p>
                  <div className="h-14" />
                  <p className="font-bold underline">{selectedRoom.penanggungJawab}</p>
                  <p className="font-mono text-[11px] text-slate-600">
                    NIP. {selectedRoom.nipPenanggungJawab || '-'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-xs text-slate-500">
              Pilih ruangan di sebelah kiri untuk melihat pratinjau Kartu Inventaris Ruangan.
            </div>
          )}
        </div>
      </div>

      {/* Modal Tambah Ruangan Baru */}
      {addRoomOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-[#0B2545] text-white">
              <h3 className="font-display text-sm font-bold">
                Tambah Ruangan / Pos KIR Baru
              </h3>
              <button
                type="button"
                onClick={() => setAddRoomOpen(false)}
                className="p-1 rounded text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateRoom} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kode Ruang *
                  </label>
                  <input
                    type="text"
                    required
                    value={roomForm.kodeRuang}
                    onChange={(e) =>
                      setRoomForm({ ...roomForm, kodeRuang: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Lokasi Pos / Mako *
                  </label>
                  <select
                    value={lockedLocationId || roomForm.locationId}
                    disabled={Boolean(lockedLocationId)}
                    onChange={(e) => {
                      const nextLoc = e.target.value;
                      const admin = resolvePosAdminForLocation(
                        nextLoc,
                        posAdmins,
                        locations,
                        roleProfile
                      );
                      const loc = locations.find((l) => l.id === nextLoc);
                      setRoomForm({
                        ...roomForm,
                        locationId: nextLoc,
                        penanggungJawab: admin?.name ?? roomForm.penanggungJawab,
                        nipPenanggungJawab:
                          admin?.nip && admin.nip !== '-' ? admin.nip : '',
                        jabatanPenanggungJawab:
                          admin?.jabatan ?? roomForm.jabatanPenanggungJawab,
                        lantaiGedung: loc
                          ? `${loc.name} · Lt. 1`
                          : roomForm.lantaiGedung,
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md disabled:bg-slate-100 disabled:text-slate-700"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Ruangan *
                </label>
                <input
                  type="text"
                  required
                  value={roomForm.namaRuang}
                  onChange={(e) =>
                    setRoomForm({ ...roomForm, namaRuang: e.target.value })
                  }
                  placeholder="Misal: Ruang Rapat Kedaruratan"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Gedung / Lantai
                  </label>
                  <input
                    type="text"
                    value={roomForm.lantaiGedung}
                    onChange={(e) =>
                      setRoomForm({ ...roomForm, lantaiGedung: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Penanggung Jawab Ruangan *
                  </label>
                  <input
                    type="text"
                    required
                    value={roomForm.penanggungJawab}
                    onChange={(e) =>
                      setRoomForm({ ...roomForm, penanggungJawab: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    NIP Penanggung Jawab
                  </label>
                  <input
                    type="text"
                    value={roomForm.nipPenanggungJawab}
                    onChange={(e) =>
                      setRoomForm({
                        ...roomForm,
                        nipPenanggungJawab: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Jabatan
                  </label>
                  <input
                    type="text"
                    value={roomForm.jabatanPenanggungJawab}
                    onChange={(e) =>
                      setRoomForm({
                        ...roomForm,
                        jabatanPenanggungJawab: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddRoomOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md cursor-pointer"
                >
                  Simpan Ruangan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Barang ke Ruangan */}
      {addItemOpen && selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full shadow-xl overflow-hidden my-6">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-[#0B2545] text-white">
              <h3 className="font-display text-sm font-bold">
                {editingRoomItem
                  ? `Edit Barang · ${editingRoomItem.namaBarang}`
                  : `Tambah Barang ke ${selectedRoom.namaRuang}`}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setAddItemOpen(false);
                  setEditingRoomItem(null);
                }}
                className="p-1 rounded text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateItem} className="p-5 space-y-3 text-xs max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama / Jenis Barang *
                </label>
                <input
                  type="text"
                  required
                  value={itemForm.namaBarang}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, namaBarang: e.target.value })
                  }
                  placeholder="Misal: Printer Laserjet / AC Split 2 PK"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Merk / Model *
                  </label>
                  <input
                    type="text"
                    required
                    value={itemForm.merkModel}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, merkModel: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tahun Perolehan *
                  </label>
                  <input
                    type="number"
                    min={1990}
                    max={2035}
                    required
                    value={itemForm.tahunPerolehan}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        tahunPerolehan: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kode Barang *
                  </label>
                  <input
                    type="text"
                    required
                    value={itemForm.kodeBarang}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, kodeBarang: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    No. Reg *
                  </label>
                  <input
                    type="text"
                    required
                    value={itemForm.nomorRegister}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, nomorRegister: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Jumlah *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={itemForm.jumlah}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, jumlah: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Satuan
                  </label>
                  <input
                    type="text"
                    value={itemForm.satuan}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, satuan: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kondisi Barang
                  </label>
                  <select
                    value={itemForm.kondisi}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        kondisi: e.target.value as ConditionStatus,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  >
                    <option value="BAIK">Baik (B)</option>
                    <option value="RUSAK_RINGAN">Rusak Ringan (RR)</option>
                    <option value="RUSAK_BERAT">Rusak Berat (RB)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Keterangan
                </label>
                <input
                  type="text"
                  value={itemForm.keterangan}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, keterangan: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>

              <ItemPhotoControl
                fotoDataUrl={itemForm.fotoDataUrl}
                fotoNamaFile={itemForm.fotoNamaFile}
                label="Foto Barang Ruangan (Opsional)"
                onChange={({ fotoDataUrl, fotoNamaFile }) =>
                  setItemForm({ ...itemForm, fotoDataUrl, fotoNamaFile })
                }
              />

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddItemOpen(false);
                    setEditingRoomItem(null);
                  }}
                  className="px-4 py-2 font-semibold text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md cursor-pointer"
                >
                  {editingRoomItem ? 'Simpan Perubahan' : 'Tambahkan ke KIR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Import Modal for Active KIR Room (Super Admin Only) */}
      {roleProfile.id === 'SUPER_ADMIN' && selectedRoom && (
        <ExcelImportModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          title={`Import Excel ke KIR · ${selectedRoom.namaRuang}`}
          subtitle="Unggah daftar inventaris ruangan (.xlsx, .xls, .csv) dari aplikasi lain dan petakan langsung ke ruangan aktif"
          fieldDefinitions={KIR_FIELD_DEFINITIONS}
          fieldAliases={KIR_FIELD_ALIASES}
          onDownloadTemplate={downloadKirExcelTemplate}
          extraOptions={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-700">
                Target Ruangan Tujuan:{' '}
                <strong className="text-[#0B2545]">{selectedRoom.namaRuang}</strong>
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                Kode Ruang: {selectedRoom.kodeRuang}
              </span>
            </div>
          }
          onConfirmImport={(rows, mapping) => {
            const parsed = mapRowsToKirEntries(rows, mapping, selectedRoom.id);
            if (parsed.length > 0) {
              onImportRoomItems?.(parsed);
            }
            return {
              importedCount: parsed.length,
              message: `${parsed.length} item berhasil diimpor ke KIR "${selectedRoom.namaRuang}".`,
            };
          }}
        />
      )}

      <PhotoLightboxModal
        photo={lightboxPhoto}
        onClose={() => setLightboxPhoto(null)}
      />

      {/* Print Portal (A4 Landscape KIR) */}
      {portalHost &&
        createPortal(
          <>
            <style>{KIR_PRINT_CSS}</style>
            {(printScope === 'all' ? rooms : selectedRoom ? [selectedRoom] : []).map(
              (rm) => {
                const items = roomItems.filter((it) => it.roomId === rm.id);
                const loc = locationMap.get(rm.locationId);
                const qrData = roomQrDataMap[rm.id];
                const todayStr = new Intl.DateTimeFormat('id-ID', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                }).format(new Date());

                return (
                  <div key={rm.id} className="kir-sheet">
                    <div className="kir-kop">
                      <div className="kir-kop-left">
                        <img
                          src={KIR_LOGO_PATH}
                          alt="Logo Pemerintah Kabupaten Sidoarjo"
                          className="kir-logo"
                        />
                        <div>
                          <div className="kir-gov">Pemerintah Kabupaten Sidoarjo</div>
                          <div className="kir-opd">
                            Badan Penanggulangan Bencana Daerah (BPBD)
                          </div>
                          <div className="kir-addr">
                            Jl. Sultan Agung No. 19A, Magersari, Sidoarjo · Telp. (031)
                            8953200
                          </div>
                        </div>
                      </div>
                      <div className="kir-qr-box">
                        {qrData && (
                          <img src={qrData} alt={`QR Ruangan ${rm.kodeRuang}`} />
                        )}
                        <span>{rm.kodeRuang}</span>
                      </div>
                    </div>

                    <div className="kir-title">Kartu Inventaris Ruangan (KIR)</div>

                    <div className="kir-meta-grid">
                      <div className="kir-meta-row">
                        <span className="kir-meta-label">Provinsi / Kab.</span>
                        <span className="kir-meta-val">
                          : Jawa Timur / Kabupaten Sidoarjo
                        </span>
                      </div>
                      <div className="kir-meta-row">
                        <span className="kir-meta-label">Nama Ruangan</span>
                        <span className="kir-meta-val">: {rm.namaRuang}</span>
                      </div>
                      <div className="kir-meta-row">
                        <span className="kir-meta-label">Unit Kerja / OPD</span>
                        <span className="kir-meta-val">: BPBD Kabupaten Sidoarjo</span>
                      </div>
                      <div className="kir-meta-row">
                        <span className="kir-meta-label">Kode Lokasi / Ruang</span>
                        <span
                          className="kir-meta-val"
                          style={{ fontFamily: 'monospace' }}
                        >
                          : {rm.kodeRuang}
                        </span>
                      </div>
                      <div className="kir-meta-row">
                        <span className="kir-meta-label">Pos / Gedung</span>
                        <span className="kir-meta-val">
                          : {loc?.name ?? rm.lantaiGedung} ({rm.lantaiGedung})
                        </span>
                      </div>
                      <div className="kir-meta-row">
                        <span className="kir-meta-label">Penanggung Jawab</span>
                        <span className="kir-meta-val">: {rm.penanggungJawab}</span>
                      </div>
                    </div>

                    <table className="kir-table">
                      <thead>
                        <tr>
                          <th rowSpan={2} style={{ width: '28px' }}>
                            No
                          </th>
                          <th rowSpan={2}>Nama / Jenis Barang</th>
                          <th rowSpan={2}>Merk / Model / Tipe</th>
                          <th rowSpan={2} style={{ width: '46px' }}>
                            Tahun
                          </th>
                          <th rowSpan={2} style={{ width: '110px' }}>
                            Kode Barang
                          </th>
                          <th rowSpan={2} style={{ width: '62px' }}>
                            No. Reg
                          </th>
                          <th rowSpan={2} style={{ width: '68px' }}>
                            Jumlah
                          </th>
                          <th colSpan={3}>Keadaan Barang</th>
                          <th rowSpan={2}>Keterangan</th>
                        </tr>
                        <tr>
                          <th style={{ width: '28px' }}>B</th>
                          <th style={{ width: '28px' }}>RR</th>
                          <th style={{ width: '28px' }}>RB</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length === 0 ? (
                          <tr>
                            <td
                              colSpan={11}
                              style={{
                                textAlign: 'center',
                                padding: '18px',
                                color: '#64748b',
                              }}
                            >
                              Belum ada daftar barang tercatat pada ruangan ini.
                            </td>
                          </tr>
                        ) : (
                          items.map((it, idx) => (
                            <tr key={it.id}>
                              <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>
                                {idx + 1}
                              </td>
                              <td>
                                <strong>{it.namaBarang}</strong>
                              </td>
                              <td>{it.merkModel}</td>
                              <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>
                                {it.tahunPerolehan}
                              </td>
                              <td style={{ fontFamily: 'monospace' }}>{it.kodeBarang}</td>
                              <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>
                                {it.nomorRegister}
                              </td>
                              <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>
                                {it.jumlah} {it.satuan}
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 700 }}>
                                {it.kondisi === 'BAIK' ? '✓' : '-'}
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 700 }}>
                                {it.kondisi === 'RUSAK_RINGAN' ? '✓' : '-'}
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 700 }}>
                                {it.kondisi === 'RUSAK_BERAT' ? '✓' : '-'}
                              </td>
                              <td>{it.keterangan}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    <div
                      style={{
                        fontSize: '10px',
                        color: '#475569',
                        marginBottom: '8px',
                      }}
                    >
                      Catatan: B = Baik · RR = Rusak Ringan · RB = Rusak Berat. Dilarang
                      memindahkan barang dari ruangan tanpa seizin Pengurus Barang Pengguna
                      &amp; Pejabat Penatausahaan Pengguna Barang.
                    </div>

                    <div className="kir-sign-grid">
                      <div>
                        <div>Mengetahui,</div>
                        <div>
                          <strong>Pengguna Barang / Kepala Pelaksana</strong>
                        </div>
                        <div className="kir-sign-space" />
                        <div>
                          <u>
                            <strong>Sabino Mariano, S. Sos., M.KP.</strong>
                          </u>
                        </div>
                        <div style={{ fontFamily: 'monospace' }}>
                          NIP. 19740108 199302 1 003
                        </div>
                      </div>
                      <div>
                        <div>Diperiksa Oleh,</div>
                        <div>
                          <strong>Pengurus Barang Pengguna</strong>
                        </div>
                        <div className="kir-sign-space" />
                        <div>
                          <u>
                            <strong>Ahmad Thohir, A. Md.</strong>
                          </u>
                        </div>
                        <div style={{ fontFamily: 'monospace' }}>
                          NIP. 19870616 201001 1 008
                        </div>
                      </div>
                      <div>
                        <div>Sidoarjo, {todayStr}</div>
                        <div>
                          <strong>Penanggung Jawab Ruangan</strong>
                        </div>
                        <div className="kir-sign-space" />
                        <div>
                          <u>
                            <strong>{rm.penanggungJawab}</strong>
                          </u>
                        </div>
                        <div style={{ fontFamily: 'monospace' }}>
                          NIP. {rm.nipPenanggungJawab || '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
            )}
          </>,
          portalHost
        )}
    </div>
  );
};
