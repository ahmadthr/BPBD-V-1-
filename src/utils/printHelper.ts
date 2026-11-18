import QRCode from 'qrcode';

function getSafeOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    return window.location.origin;
  }
  return 'https://simas-bmd.sidoarjokab.go.id';
}

export function buildAssetDetailUrl(
  kodeBarang: string,
  nomorRegister: string
): { fullUrl: string; pathUrl: string } {
  const params = new URLSearchParams({
    aset: 'detail',
    kode: kodeBarang,
  });
  if (nomorRegister) {
    params.set('register', nomorRegister);
  }
  const pathUrl = `/?${params.toString()}`;
  return {
    fullUrl: `${getSafeOrigin()}${pathUrl}`,
    pathUrl,
  };
}

export function buildRoomDetailUrl(roomId: string): {
  fullUrl: string;
  pathUrl: string;
} {
  const params = new URLSearchParams({
    aset: 'ruang',
    ruang: roomId,
  });
  const pathUrl = `/?${params.toString()}`;
  return {
    fullUrl: `${getSafeOrigin()}${pathUrl}`,
    pathUrl,
  };
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback to textarea execCommand below
  }

  try {
    if (typeof document === 'undefined') return false;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '-9999px';
    textarea.style.fontSize = '16px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

export function escapeHtml(value: string | number | undefined | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildStandalonePrintHtml(
  title: string,
  bodyHtml: string,
  extraCss = ''
): string {
  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      margin: 0;
      padding: 18px;
      font-family: "Segoe UI", Roboto, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
    }
    .print-toolbar {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    .print-toolbar button {
      background: #0B2545;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      padding: 8px 14px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    @media print {
      body { padding: 0; }
      .print-toolbar { display: none !important; }
    }
    ${extraCss}
  </style>
</head>
<body>
  <div class="print-toolbar">
    <button type="button" onclick="window.print()">Cetak Dokumen</button>
  </div>
  ${bodyHtml}
</body>
</html>`;
}

function getOrCreatePrintPortal(): HTMLDivElement {
  let portal = document.getElementById('simas-print-portal') as HTMLDivElement | null;
  if (!portal) {
    portal = document.createElement('div');
    portal.id = 'simas-print-portal';
    document.body.appendChild(portal);
  }
  return portal;
}

export function printHtmlInHiddenFrame(
  title: string,
  bodyHtml: string,
  extraCss = ''
): boolean {
  try {
    const portal = getOrCreatePrintPortal();
    portal.innerHTML = `<style>${extraCss}</style><div class="simas-print-title" style="display:none">${escapeHtml(
      title
    )}</div>${bodyHtml}`;
    document.body.classList.add('simas-printing-portal');

    const cleanup = () => {
      document.body.classList.remove('simas-printing-portal');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    const imgs = Array.from(portal.querySelectorAll('img'));
    const pendingImgs = imgs.filter((img) => !img.complete);

    const trigger = () => {
      try {
        window.print();
      } finally {
        window.setTimeout(cleanup, 1500);
      }
    };

    if (pendingImgs.length === 0) {
      trigger();
    } else {
      void Promise.all(
        pendingImgs.map(
          (img) =>
            new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
              window.setTimeout(resolve, 1200);
            })
        )
      ).then(trigger);
    }
    return true;
  } catch {
    document.body.classList.remove('simas-printing-portal');
    window.print();
    return false;
  }
}

export function downloadHtmlDocument(
  filename: string,
  title: string,
  bodyHtml: string,
  extraCss = ''
): void {
  const html = buildStandalonePrintHtml(title, bodyHtml, extraCss);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2
): number {
  const words = text.split(/\s+/);
  let line = '';
  let currentY = y;
  let lineCount = 0;

  for (let i = 0; i < words.length; i++) {
    const testLine = line ? `${line} ${words[i]}` : words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      lineCount += 1;
      if (lineCount >= maxLines) return currentY + lineHeight;
      line = words[i];
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

export interface StickerRenderData {
  id: string;
  kibLabel: string;
  namaBarang: string;
  kodeBarang: string;
  nomorRegister: string;
  tahunPerolehan: number | string;
  locationName: string;
  qrPayload: string;
  qrUrl: string;
}

export async function generateStickerHtmlBlock(
  item: StickerRenderData
): Promise<string> {
  const qrDataUrl = await QRCode.toDataURL(item.qrUrl, {
    width: 360,
    margin: 1,
    color: { dark: '#0B2545', light: '#FFFFFF' },
    errorCorrectionLevel: 'M',
  });
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';
  const logoUrl = `${origin}/assets/aistudio/logo-bpbd-sidoarjo-removebg-preview_e9477ae6.png`;

  return `
    <div class="sticker-card">
      <div class="sticker-head">
        <div class="sticker-brand">
          <img src="${escapeHtml(logoUrl)}" alt="Logo BPBD Sidoarjo" class="sticker-logo" />
          <div>
            <div class="sticker-gov">PEMERINTAH KABUPATEN SIDOARJO</div>
            <div class="sticker-opd">BPBD · Barang Milik Daerah (${escapeHtml(item.kibLabel)})</div>
          </div>
        </div>
        <div class="sticker-id">${escapeHtml(item.id)}</div>
      </div>

      <div class="sticker-body">
        <div class="sticker-qr-wrap">
          <img src="${qrDataUrl}" alt="QR ${escapeHtml(item.id)}" class="sticker-qr" />
        </div>
        <div class="sticker-meta">
          <div class="sticker-title">${escapeHtml(item.namaBarang)}</div>
          <div class="sticker-row"><span>Kode Barang</span><strong>${escapeHtml(item.kodeBarang)}</strong></div>
          <div class="sticker-row"><span>No. Register</span><strong>${escapeHtml(item.nomorRegister)} / ${escapeHtml(item.tahunPerolehan)}</strong></div>
          <div class="sticker-row"><span>Lokasi</span><strong>${escapeHtml(item.locationName)}</strong></div>
        </div>
      </div>

      <div class="sticker-foot">
        <span>${escapeHtml(item.qrPayload)}</span>
        <span>${escapeHtml(item.qrUrl)}</span>
      </div>
    </div>
  `;
}

export const STICKER_PRINT_CSS = `
  @page { size: auto; margin: 10mm; }
  .sticker-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
  .sticker-single {
    max-width: 440px;
    margin: 0 auto;
  }
  .sticker-card {
    border: 2px solid #0f172a;
    background: #ffffff;
    padding: 14px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .sticker-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1.5px solid #0f172a;
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  .sticker-brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .sticker-logo {
    width: 32px;
    height: 32px;
    object-fit: contain;
  }
  .sticker-gov {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #0f172a;
  }
  .sticker-opd {
    font-size: 11px;
    font-weight: 700;
    color: #0B2545;
  }
  .sticker-id {
    font-family: monospace;
    font-size: 11px;
    font-weight: 700;
    color: #334155;
  }
  .sticker-body {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  .sticker-qr-wrap {
    border: 1px solid #cbd5e1;
    padding: 4px;
    background: #ffffff;
    flex-shrink: 0;
  }
  .sticker-qr {
    width: 104px;
    height: 104px;
    display: block;
  }
  .sticker-meta {
    flex: 1;
    min-width: 0;
  }
  .sticker-title {
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 6px;
    line-height: 1.3;
  }
  .sticker-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 11px;
    color: #475569;
    padding: 3px 0;
    border-bottom: 1px solid #f1f5f9;
  }
  .sticker-row strong {
    font-family: monospace;
    color: #0f172a;
    text-align: right;
  }
  .sticker-foot {
    margin-top: 8px;
    padding-top: 6px;
    border-top: 1px solid #cbd5e1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-family: monospace;
    font-size: 9px;
    color: #475569;
    word-break: break-all;
  }
`;

export async function downloadStickerCardPng(
  item: StickerRenderData
): Promise<void> {
  const width = 960;
  const height = 520;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background & Border
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 6;
  ctx.strokeRect(16, 16, width - 32, height - 32);

  // Header divider
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(36, 114);
  ctx.lineTo(width - 36, 114);
  ctx.stroke();

  // Logo + Header Text
  const logoImg = await loadImage(
    '/assets/aistudio/logo-bpbd-sidoarjo-removebg-preview_e9477ae6.png'
  );
  if (logoImg) {
    ctx.drawImage(logoImg, 40, 32, 68, 68);
  }

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('PEMERINTAH KABUPATEN SIDOARJO', 124, 62);

  ctx.fillStyle = '#0B2545';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`BPBD · BARANG MILIK DAERAH (${item.kibLabel})`, 124, 94);

  ctx.fillStyle = '#334155';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(item.id, width - 42, 78);
  ctx.textAlign = 'left';

  // QR Code
  const qrDataUrl = await QRCode.toDataURL(item.qrUrl, {
    width: 300,
    margin: 1,
    color: { dark: '#0B2545', light: '#FFFFFF' },
    errorCorrectionLevel: 'M',
  });
  const qrImg = await loadImage(qrDataUrl);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 138, 256, 256);
  if (qrImg) {
    ctx.drawImage(qrImg, 48, 146, 240, 240);
  }

  // Right-side Metadata
  const metaX = 326;
  const metaMaxW = width - metaX - 42;
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 26px sans-serif';
  const nextY = wrapCanvasText(ctx, item.namaBarang, metaX, 170, metaMaxW, 34, 2);

  const rows: [string, string][] = [
    ['Kode Barang', item.kodeBarang],
    ['No. Register', `${item.nomorRegister} / ${item.tahunPerolehan}`],
    ['Lokasi', item.locationName],
  ];

  let rowY = Math.max(nextY + 18, 248);
  rows.forEach(([label, val]) => {
    ctx.fillStyle = '#64748B';
    ctx.font = '18px sans-serif';
    ctx.fillText(label, metaX, rowY);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(val.slice(0, 34), width - 42, rowY);
    ctx.textAlign = 'left';

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(metaX, rowY + 12);
    ctx.lineTo(width - 42, rowY + 12);
    ctx.stroke();

    rowY += 46;
  });

  // Footer URL & Payload
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(36, 422);
  ctx.lineTo(width - 36, 422);
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.font = '16px monospace';
  ctx.fillText(`Payload : ${item.qrPayload}`, 40, 454);
  ctx.fillStyle = '#0B2545';
  ctx.font = 'bold 15px monospace';
  ctx.fillText(`Tautan  : ${item.qrUrl}`, 40, 482);

  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `Stiker-QR-${item.id}-${item.kodeBarang}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export interface KirItemRenderRow {
  namaBarang: string;
  merkModel: string;
  tahunPerolehan: number | string;
  kodeBarang: string;
  nomorRegister: string;
  jumlah: number;
  satuan: string;
  kondisi: 'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_BERAT';
  keterangan: string;
}

export interface KirSheetRenderData {
  roomId: string;
  kodeRuang: string;
  namaRuang: string;
  locationLabel: string;
  lantaiGedung: string;
  penanggungJawab: string;
  nipPenanggungJawab: string;
  qrUrl: string;
  items: KirItemRenderRow[];
}

function fitTextEllipsis(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  const s = String(text ?? '');
  if (ctx.measureText(s).width <= maxWidth) return s;
  let out = s;
  while (out.length > 1 && ctx.measureText(`${out}...`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}...`;
}

async function renderKirSheetCanvases(
  sheet: KirSheetRenderData,
  logoImg: HTMLImageElement | null
): Promise<HTMLCanvasElement[]> {
  const W = 1754; // A4 Landscape @150dpi
  const H = 1240;
  const qrDataUrl = await QRCode.toDataURL(sheet.qrUrl, {
    width: 240,
    margin: 1,
    color: { dark: '#0B2545', light: '#FFFFFF' },
  });
  const qrImg = await loadImage(qrDataUrl);

  const todayStr = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const ROWS_PER_PAGE = 14;
  const itemChunks: KirItemRenderRow[][] = [];
  if (sheet.items.length === 0) {
    itemChunks.push([]);
  } else {
    for (let i = 0; i < sheet.items.length; i += ROWS_PER_PAGE) {
      itemChunks.push(sheet.items.slice(i, i + ROWS_PER_PAGE));
    }
  }

  const canvases: HTMLCanvasElement[] = [];

  itemChunks.forEach((chunk, pageIndex) => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Sheet background & outer frame
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 3;
    ctx.strokeRect(36, 36, W - 72, H - 72);

    // Kop Surat
    if (logoImg) {
      ctx.drawImage(logoImg, 64, 54, 88, 88);
    }
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('PEMERINTAH KABUPATEN SIDOARJO', 170, 82);
    ctx.fillStyle = '#0B2545';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('BADAN PENANGGULANGAN BENCANA DAERAH (BPBD)', 170, 114);
    ctx.fillStyle = '#475569';
    ctx.font = '16px sans-serif';
    ctx.fillText(
      'Jl. Sultan Agung No. 19A, Magersari, Sidoarjo · Telp. (031) 8953200',
      170,
      140
    );

    // QR Code top-right
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(W - 182, 50, 118, 122);
    if (qrImg) {
      ctx.drawImage(qrImg, W - 170, 56, 94, 94);
    }
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(sheet.kodeRuang, W - 123, 166);
    ctx.textAlign = 'left';

    // Double line below Kop
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(58, 182);
    ctx.lineTo(W - 58, 182);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(58, 187);
    ctx.lineTo(W - 58, 187);
    ctx.stroke();

    // Document Title
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    const pageSuffix =
      itemChunks.length > 1 ? ` (HAL. ${pageIndex + 1}/${itemChunks.length})` : '';
    ctx.fillText(`KARTU INVENTARIS RUANGAN (KIR)${pageSuffix}`, W / 2, 224);
    ctx.textAlign = 'left';

    // Metadata 2-column grid
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(58, 242, W - 116, 86);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.strokeRect(58, 242, W - 116, 86);

    const metaRowsLeft: [string, string][] = [
      ['Provinsi / Kab.', ': Jawa Timur / Kabupaten Sidoarjo'],
      ['Unit Kerja / OPD', ': BPBD Kabupaten Sidoarjo'],
      ['Pos / Gedung', `: ${sheet.locationLabel} (${sheet.lantaiGedung})`],
    ];
    const metaRowsRight: [string, string][] = [
      ['Nama Ruangan', `: ${sheet.namaRuang}`],
      ['Kode Lokasi / Ruang', `: ${sheet.kodeRuang}`],
      ['Penanggung Jawab', `: ${sheet.penanggungJawab}`],
    ];

    ctx.font = '16px sans-serif';
    metaRowsLeft.forEach(([lbl, val], idx) => {
      const y = 268 + idx * 24;
      ctx.fillStyle = '#475569';
      ctx.font = '16px sans-serif';
      ctx.fillText(lbl, 76, y);
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(fitTextEllipsis(ctx, val, 540), 235, y);
    });
    metaRowsRight.forEach(([lbl, val], idx) => {
      const y = 268 + idx * 24;
      ctx.fillStyle = '#475569';
      ctx.font = '16px sans-serif';
      ctx.fillText(lbl, 880, y);
      ctx.fillStyle = idx === 0 ? '#0B2545' : '#0F172A';
      ctx.font = idx === 1 ? 'bold 16px monospace' : 'bold 16px sans-serif';
      ctx.fillText(fitTextEllipsis(ctx, val, 580), 1065, y);
    });

    // Table Layout (total width = 1638)
    const tableX = 58;
    const tableY = 344;
    const cols = [
      { key: 'no', title: 'No', w: 48, align: 'center' as const },
      { key: 'nama', title: 'Nama / Jenis Barang', w: 330, align: 'left' as const },
      { key: 'merk', title: 'Merk / Model / Tipe', w: 250, align: 'left' as const },
      { key: 'thn', title: 'Thn', w: 68, align: 'center' as const },
      { key: 'kode', title: 'Kode Barang', w: 190, align: 'left' as const },
      { key: 'reg', title: 'Reg', w: 72, align: 'center' as const },
      { key: 'jml', title: 'Jumlah', w: 112, align: 'center' as const },
      { key: 'b', title: 'B', w: 46, align: 'center' as const },
      { key: 'rr', title: 'RR', w: 46, align: 'center' as const },
      { key: 'rb', title: 'RB', w: 46, align: 'center' as const },
      { key: 'ket', title: 'Keterangan', w: 430, align: 'left' as const },
    ];
    const tableW = cols.reduce((s, c) => s + c.w, 0);

    // Header Row (two-tier for Keadaan Barang)
    const hRow1 = 30;
    const hRow2 = 26;
    const headerH = hRow1 + hRow2;
    ctx.fillStyle = '#F1F5F9';
    ctx.fillRect(tableX, tableY, tableW, headerH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(tableX, tableY, tableW, headerH);

    let cx = tableX;
    let kondisiStartX = 0;
    let kondisiWidth = 0;
    cols.forEach((col) => {
      if (col.key === 'b' || col.key === 'rr' || col.key === 'rb') {
        if (col.key === 'b') kondisiStartX = cx;
        kondisiWidth += col.w;
        // Sub-header box
        ctx.strokeRect(cx, tableY + hRow1, col.w, hRow2);
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(col.title, cx + col.w / 2, tableY + hRow1 + 18);
      } else {
        ctx.strokeRect(cx, tableY, col.w, headerH);
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(col.title, cx + col.w / 2, tableY + 34);
      }
      cx += col.w;
    });
    // Keadaan Barang top merged cell
    ctx.strokeRect(kondisiStartX, tableY, kondisiWidth, hRow1);
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Keadaan Barang', kondisiStartX + kondisiWidth / 2, tableY + 20);
    ctx.textAlign = 'left';

    // Data Rows
    const rowH = 38;
    let ry = tableY + headerH;
    if (chunk.length === 0) {
      ctx.strokeRect(tableX, ry, tableW, rowH);
      ctx.fillStyle = '#64748B';
      ctx.font = 'italic 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        'Belum ada daftar barang tercatat pada ruangan ini.',
        tableX + tableW / 2,
        ry + 24
      );
      ctx.textAlign = 'left';
      ry += rowH;
    } else {
      chunk.forEach((it, idx) => {
        const globalNo = pageIndex * ROWS_PER_PAGE + idx + 1;
        const vals = [
          String(globalNo),
          it.namaBarang,
          it.merkModel,
          String(it.tahunPerolehan),
          it.kodeBarang,
          it.nomorRegister,
          `${it.jumlah} ${it.satuan}`,
          it.kondisi === 'BAIK' ? 'V' : '-',
          it.kondisi === 'RUSAK_RINGAN' ? 'V' : '-',
          it.kondisi === 'RUSAK_BERAT' ? 'V' : '-',
          it.keterangan || '-',
        ];
        let rx = tableX;
        cols.forEach((col, cIdx) => {
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1;
          ctx.strokeRect(rx, ry, col.w, rowH);
          const isMono =
            col.key === 'no' ||
            col.key === 'thn' ||
            col.key === 'kode' ||
            col.key === 'reg' ||
            col.key === 'jml';
          const isBold =
            col.key === 'nama' ||
            col.key === 'b' ||
            col.key === 'rr' ||
            col.key === 'rb';
          ctx.fillStyle = '#0F172A';
          ctx.font = `${isBold ? 'bold ' : ''}14px ${isMono ? 'monospace' : 'sans-serif'}`;
          const text = fitTextEllipsis(ctx, vals[cIdx], col.w - 14);
          if (col.align === 'center') {
            ctx.textAlign = 'center';
            ctx.fillText(text, rx + col.w / 2, ry + 24);
          } else {
            ctx.textAlign = 'left';
            ctx.fillText(text, rx + 8, ry + 24);
          }
          rx += col.w;
        });
        ry += rowH;
      });
    }

    // Note below table
    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = '14px sans-serif';
    ctx.fillText(
      'Catatan: B = Baik · RR = Rusak Ringan · RB = Rusak Berat. Dilarang memindahkan barang dari ruangan tanpa seizin Pengurus Barang & Kasubag Umum.',
      tableX,
      Math.max(ry + 24, 945)
    );

    // 3-Column Signature Block at bottom
    const sigY = 1005;
    const sigCols = [
      {
        x: 310,
        top: 'Mengetahui,',
        role: 'Kasubag Umum & Kepegawaian',
        name: 'Dra. Siti Rahmawati, M.Si.',
        nip: 'NIP. 19790821 200501 2 011',
      },
      {
        x: 877,
        top: 'Diperiksa Oleh,',
        role: 'Pengurus Barang Pengguna',
        name: 'Hendra Wijaya, S.Sos.',
        nip: 'NIP. 19860412 201001 1 008',
      },
      {
        x: 1444,
        top: `Sidoarjo, ${todayStr}`,
        role: 'Penanggung Jawab Ruangan',
        name: sheet.penanggungJawab,
        nip: `NIP. ${sheet.nipPenanggungJawab || '-'}`,
      },
    ];

    sigCols.forEach((sc) => {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0F172A';
      ctx.font = '16px sans-serif';
      ctx.fillText(sc.top, sc.x, sigY);
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(sc.role, sc.x, sigY + 24);
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(sc.name, sc.x, sigY + 114);
      const nameW = ctx.measureText(sc.name).width;
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sc.x - nameW / 2, sigY + 118);
      ctx.lineTo(sc.x + nameW / 2, sigY + 118);
      ctx.stroke();
      ctx.font = '14px monospace';
      ctx.fillStyle = '#334155';
      ctx.fillText(sc.nip, sc.x, sigY + 138);
    });
    ctx.textAlign = 'left';

    canvases.push(canvas);
  });

  return canvases;
}

function buildPdfFromJpegPages(
  pages: { bytes: Uint8Array; width: number; height: number }[]
): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let offset = 0;

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    offset += bytes.length;
  };
  const pushStr = (str: string) => {
    pushBytes(encoder.encode(str));
  };

  pushStr('%PDF-1.4\n');

  // Object numbering:
  // 1: Catalog, 2: Pages
  // For page i (0..n-1): pageObj = 3 + i*3, contentObj = 4 + i*3, imageObj = 5 + i*3
  const offsets: number[] = [0];
  const kidsRefs = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');

  // 1: Catalog
  offsets[1] = offset;
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // 2: Pages
  offsets[2] = offset;
  pushStr(`2 0 obj\n<< /Type /Pages /Kids [ ${kidsRefs} ] /Count ${pages.length} >>\nendobj\n`);

  const ptW = '841.89';
  const ptH = '595.28';

  pages.forEach((pg, i) => {
    const pageId = 3 + i * 3;
    const contentId = 4 + i * 3;
    const imageId = 5 + i * 3;
    const streamCmd = `q\n${ptW} 0 0 ${ptH} 0 0 cm\n/Im0 Do\nQ\n`;

    offsets[pageId] = offset;
    pushStr(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW} ${ptH}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
    );

    offsets[contentId] = offset;
    pushStr(
      `${contentId} 0 obj\n<< /Length ${streamCmd.length} >>\nstream\n${streamCmd}endstream\nendobj\n`
    );

    offsets[imageId] = offset;
    pushStr(
      `${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pg.width} /Height ${pg.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.bytes.length} >>\nstream\n`
    );
    pushBytes(pg.bytes);
    pushStr('\nendstream\nendobj\n');
  });

  const xrefStart = offset;
  const totalObjs = offsets.length;
  pushStr(`xref\n0 ${totalObjs}\n`);
  pushStr('0000000000 65535 f \n');
  for (let i = 1; i < totalObjs; i++) {
    pushStr(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(
    `trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  );

  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

export async function downloadKirPdf(
  sheets: KirSheetRenderData[],
  filename: string
): Promise<void> {
  const logoImg = await loadImage(
    '/assets/aistudio/logo-bpbd-sidoarjo-removebg-preview_e9477ae6.png'
  );
  const allCanvases: HTMLCanvasElement[] = [];
  for (const s of sheets) {
    const pages = await renderKirSheetCanvases(s, logoImg);
    allCanvases.push(...pages);
  }
  if (allCanvases.length === 0) return;

  const jpegPages = allCanvases.map((cv) => {
    const dataUrl = cv.toDataURL('image/jpeg', 0.92);
    const base64 = dataUrl.split(',')[1] ?? '';
    const binStr = atob(base64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return { bytes, width: cv.width, height: cv.height };
  });

  const pdfBlob = buildPdfFromJpegPages(jpegPages);
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function downloadKirPng(
  sheet: KirSheetRenderData,
  filename: string
): Promise<void> {
  const logoImg = await loadImage(
    '/assets/aistudio/logo-bpbd-sidoarjo-removebg-preview_e9477ae6.png'
  );
  const canvases = await renderKirSheetCanvases(sheet, logoImg);
  if (canvases.length === 0) return;
  const dataUrl = canvases[0].toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

