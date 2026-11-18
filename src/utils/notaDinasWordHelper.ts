import QRCode from 'qrcode';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  convertMillimetersToTwip,
} from 'docx';
import { MaintenanceRequest, NotaDinasFormat } from '../types/simas';

const LOGO_URL = '/assets/logo-pemkab-sidoarjo.png';

const HARI_ID = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

const BULAN_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const ANGKA_TERBILANG = [
  '',
  'Satu',
  'Dua',
  'Tiga',
  'Empat',
  'Lima',
  'Enam',
  'Tujuh',
  'Delapan',
  'Sembilan',
  'Sepuluh',
  'Sebelas',
];

export function terbilangAngka(n: number): string {
  const num = Math.floor(Math.abs(n));
  if (num === 0) return 'Nol';
  if (num < 12) return ANGKA_TERBILANG[num];
  if (num < 20) return `${terbilangAngka(num - 10)} Belas`;
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const rem = num % 10;
    return `${ANGKA_TERBILANG[tens]} Puluh${rem ? ' ' + terbilangAngka(rem) : ''}`;
  }
  if (num < 200) {
    const rem = num % 100;
    return `Seratus${rem ? ' ' + terbilangAngka(rem) : ''}`;
  }
  if (num < 1000) {
    const hundreds = Math.floor(num / 100);
    const rem = num % 100;
    return `${ANGKA_TERBILANG[hundreds]} Ratus${rem ? ' ' + terbilangAngka(rem) : ''}`;
  }
  if (num < 2000) {
    const rem = num % 1000;
    return `Seribu${rem ? ' ' + terbilangAngka(rem) : ''}`;
  }
  if (num < 1_000_000) {
    const thousands = Math.floor(num / 1000);
    const rem = num % 1000;
    return `${terbilangAngka(thousands)} Ribu${rem ? ' ' + terbilangAngka(rem) : ''}`;
  }
  return String(num);
}

export function formatTanggalBiasa(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return `${parsed.getDate()} ${BULAN_ID[parsed.getMonth()]} ${parsed.getFullYear()}`;
}

export function formatTanggalTerbilang(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  const hari = HARI_ID[parsed.getDay()];
  const tgl = terbilangAngka(parsed.getDate());
  const bln = BULAN_ID[parsed.getMonth()];
  const thn = terbilangAngka(parsed.getFullYear());
  return `${hari} Tanggal ${tgl} Bulan ${bln} Tahun ${thn}`;
}

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;
    const bin = atob(parts[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function createQrBytes(text: string): Promise<Uint8Array | null> {
  try {
    const dataUrl = await QRCode.toDataURL(text, {
      width: 180,
      margin: 1,
      color: { dark: '#0B192C', light: '#FFFFFF' },
    });
    return dataUrlToUint8Array(dataUrl);
  } catch {
    return null;
  }
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
const ALL_NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
} as const;

const THIN_BLACK_BORDER = { style: BorderStyle.SINGLE, size: 6, color: '1E293B' } as const;
const ALL_BLACK_BORDERS = {
  top: THIN_BLACK_BORDER,
  bottom: THIN_BLACK_BORDER,
  left: THIN_BLACK_BORDER,
  right: THIN_BLACK_BORDER,
  insideHorizontal: THIN_BLACK_BORDER,
  insideVertical: THIN_BLACK_BORDER,
} as const;

function textPara(
  text: string,
  opts?: {
    bold?: boolean;
    italic?: boolean;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spaceBefore?: number;
    spaceAfter?: number;
    firstLineIndent?: number;
    color?: string;
  }
): Paragraph {
  return new Paragraph({
    alignment: opts?.align ?? AlignmentType.LEFT,
    spacing: {
      before: opts?.spaceBefore ?? 0,
      after: opts?.spaceAfter ?? 40,
      line: 260,
    },
    indent: opts?.firstLineIndent
      ? { firstLine: opts.firstLineIndent }
      : undefined,
    children: [
      new TextRun({
        text,
        font: 'Arial',
        size: opts?.size ?? 20, // 10pt
        bold: opts?.bold ?? false,
        italics: opts?.italic ?? false,
        color: opts?.color ?? '000000',
      }),
    ],
  });
}

function buildKopSuratTable(logoBytes: Uint8Array | null): Table {
  const logoParagraph = logoBytes
    ? new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            type: 'png',
            data: logoBytes,
            transformation: { width: 68, height: 62 },
          }),
        ],
      })
    : textPara('BPBD\nSIDOARJO', { bold: true, size: 16, align: AlignmentType.CENTER });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: NO_BORDER,
      left: NO_BORDER,
      right: NO_BORDER,
      insideHorizontal: NO_BORDER,
      insideVertical: NO_BORDER,
      bottom: { style: BorderStyle.DOUBLE, size: 12, color: '000000' },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: ALL_NO_BORDERS,
            margins: { bottom: 100, top: 0, left: 0, right: 60 },
            children: [logoParagraph],
          }),
          new TableCell({
            width: { size: 85, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: ALL_NO_BORDERS,
            margins: { bottom: 100, top: 0, left: 40, right: 0 },
            children: [
              textPara('PEMERINTAH KABUPATEN SIDOARJO', {
                size: 20,
                align: AlignmentType.CENTER,
                spaceAfter: 10,
              }),
              textPara('BADAN PENANGGULANGAN BENCANA DAERAH', {
                bold: true,
                size: 26,
                align: AlignmentType.CENTER,
                spaceAfter: 20,
              }),
              textPara('Jalan Sultan Agung No. 19, Sidoarjo, Jawa Timur 61212', {
                size: 17,
                align: AlignmentType.CENTER,
                spaceAfter: 10,
              }),
              textPara('Telepon (031) 8953200,', {
                size: 17,
                align: AlignmentType.CENTER,
                spaceAfter: 10,
              }),
              textPara(
                'Laman www.bpbd.sidoarjokab.go.id, Pos-el bpbd@sidoarjokab.go.id',
                {
                  size: 17,
                  align: AlignmentType.CENTER,
                  spaceAfter: 20,
                }
              ),
            ],
          }),
        ],
      }),
    ],
  });
}

function buildMetadataTable(
  rows: Array<[string, string]>,
  labelWidthPct: number,
  withBottomBorder: boolean
): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: NO_BORDER,
      left: NO_BORDER,
      right: NO_BORDER,
      insideHorizontal: NO_BORDER,
      insideVertical: NO_BORDER,
      bottom: withBottomBorder
        ? { style: BorderStyle.SINGLE, size: 8, color: '000000' }
        : NO_BORDER,
    },
    rows: rows.map(
      ([label, value], idx) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: labelWidthPct, type: WidthType.PERCENTAGE },
              borders: ALL_NO_BORDERS,
              margins: {
                top: 18,
                bottom: idx === rows.length - 1 && withBottomBorder ? 90 : 18,
                left: 0,
                right: 40,
              },
              children: [textPara(label, { size: 20, spaceAfter: 0 })],
            }),
            new TableCell({
              width: { size: 3, type: WidthType.PERCENTAGE },
              borders: ALL_NO_BORDERS,
              margins: {
                top: 18,
                bottom: idx === rows.length - 1 && withBottomBorder ? 90 : 18,
                left: 0,
                right: 20,
              },
              children: [textPara(':', { size: 20, spaceAfter: 0 })],
            }),
            new TableCell({
              width: { size: 97 - labelWidthPct, type: WidthType.PERCENTAGE },
              borders: ALL_NO_BORDERS,
              margins: {
                top: 18,
                bottom: idx === rows.length - 1 && withBottomBorder ? 90 : 18,
                left: 20,
                right: 0,
              },
              children: [textPara(value || '-', { size: 20, spaceAfter: 0 })],
            }),
          ],
        })
    ),
  });
}

function buildSignatureBox(params: {
  headingTop: string;
  subHeading?: string;
  signerName: string;
  signerTitle: string;
  signerRank?: string;
  signerNip: string;
  isVerified: boolean;
  qrBytes: Uint8Array | null;
}): Paragraph[] {
  const paragraphs: Paragraph[] = [
    textPara(params.headingTop, { size: 20, spaceAfter: 10 }),
  ];
  if (params.subHeading) {
    paragraphs.push(textPara(params.subHeading, { size: 20, spaceAfter: 20 }));
  }

  if (params.isVerified && params.qrBytes) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 40, after: 40 },
        children: [
          new ImageRun({
            type: 'png',
            data: params.qrBytes,
            transformation: { width: 56, height: 56 },
          }),
        ],
      })
    );
    paragraphs.push(
      textPara(`Ditandatangani secara elektronik oleh:`, {
        size: 15,
        color: '334155',
        spaceAfter: 10,
      })
    );
    paragraphs.push(
      textPara(`${params.signerTitle}`, {
        size: 15,
        color: '334155',
        spaceAfter: 30,
      })
    );
  } else {
    paragraphs.push(textPara('', { size: 20, spaceBefore: 360, spaceAfter: 360 }));
  }

  paragraphs.push(
    textPara(params.signerName, { bold: true, size: 20, spaceAfter: 10 })
  );
  if (params.signerRank) {
    paragraphs.push(textPara(params.signerRank, { size: 19, spaceAfter: 10 }));
  }
  paragraphs.push(
    textPara(`NIP ${params.signerNip || '-'}`, { size: 19, spaceAfter: 0 })
  );

  return paragraphs;
}

export async function downloadNotaDinasDocx(
  req: MaintenanceRequest,
  locationName: string,
  format: NotaDinasFormat
): Promise<void> {
  const posAdminName = req.posAdminName || req.requestedBy;
  const posAdminJabatan =
    req.posAdminJabatan || req.requestedByJabatan || 'Penanggung Jawab Admin Pos';
  const posAdminNip = req.posAdminNip || req.requestedByNip || '-';

  const [logoBytes, qrBytes, posAdminQrBytes] = await Promise.all([
    fetchImageBytes(LOGO_URL),
    createQrBytes(
      `SIMAS-BMD|NOTA-DINAS|${req.nomorNotaDinas}|${req.id}|${req.verifiedBy || req.requestedBy}`
    ),
    createQrBytes(
      `SIMAS-BMD|TTD-PJ-POS|${req.nomorNotaDinas}|${req.id}|${posAdminName}|${posAdminNip}`
    ),
  ]);

  const isVerified =
    req.status === 'DISETUJUI_KASUBAG' || req.status === 'SELESAI_PERBAIKAN';

  const sectionsChildren: (Paragraph | Table)[] = [];

  sectionsChildren.push(buildKopSuratTable(logoBytes));
  sectionsChildren.push(
    textPara('NOTA DINAS', {
      size: 22,
      bold: false,
      align: AlignmentType.CENTER,
      spaceBefore: 180,
      spaceAfter: 160,
    })
  );

  if (format === 'FORMAT_KASUBAG_UMPEG') {
    // Format 1: Nota Dinas Kasubag Umpeg -> Plt. Sekretaris BPBD (Foto 1)
    sectionsChildren.push(
      buildMetadataTable(
        [
          ['Yth', req.kepadaYthUmpeg || 'Sdr. Plt. Sekretaris Badan Penanggulangan Bencana Daerah'],
          ['Dari', 'Kepala Sub Bagian Umum dan Kepegawaian'],
          ['Tembusan', req.tembusanUmpeg || 'Pejabat Pembuat Komitmen Sekretariat'],
          ['Tanggal', formatTanggalBiasa(req.tanggalPengajuan)],
          ['Nomor', req.nomorNotaDinas],
          ['Sifat', 'Biasa / Terbuka'],
          ['Lampiran', req.fotoKerusakanDataUrl ? '1 (Satu) Berkas Foto Kondisi' : '-'],
          ['Hal', req.perihal],
        ],
        18,
        true
      )
    );

    const intro1 = `Sehubungan dengan Kondisi ${
      req.kategori === 'KENDARAAN' ? 'Kendaraan Dinas' : 'Barang Inventaris / Peralatan'
    } hari ini ${formatTanggalTerbilang(req.tanggalPengajuan)}, ${req.kronologiSingkat}`;
    const intro2 = `Bersama ini kami mengajukan permohonan perawatan/perbaikan ${
      req.kategori === 'KENDARAAN'
        ? 'kendaraan dinas / operasional'
        : 'peralatan / barang inventaris'
    } dengan spesifikasi sebagai berikut :`;

    sectionsChildren.push(
      textPara(intro1, {
        align: AlignmentType.JUSTIFIED,
        firstLineIndent: convertMillimetersToTwip(12),
        spaceBefore: 160,
        spaceAfter: 90,
      })
    );
    sectionsChildren.push(
      textPara(intro2, {
        align: AlignmentType.JUSTIFIED,
        firstLineIndent: convertMillimetersToTwip(12),
        spaceAfter: 120,
      })
    );

    const kerusakanRingkas =
      req.rincianKerusakan.length > 0
        ? req.rincianKerusakan
            .map((r) => `${r.jenisKerusakan}${r.keterangan ? ` (${r.keterangan})` : ''}`)
            .join('; ')
        : req.kronologiSingkat;

    const specHeaders = [
      'No',
      'Nama Pemilik dan Pemegang',
      req.kategori === 'KENDARAAN' ? 'Jenis Kendaraan' : 'Jenis Barang',
      'Merk/Type',
      req.kategori === 'KENDARAAN' ? 'Tahun /CC' : 'Tahun',
      req.kategori === 'KENDARAAN' ? 'Nomor Polisi' : 'Kode / Reg',
      req.kategori === 'KENDARAAN' ? 'Nomor Rangka' : 'Unit / Pos',
      req.kategori === 'KENDARAAN' ? 'Nomor Mesin' : 'Rujukan',
      'Ket',
    ];
    const colWidths = [5, 14, 10, 11, 9, 11, 14, 11, 15];

    const specValues = [
      '1.',
      req.namaPemilikPemegang || 'BPBD Sidoarjo',
      req.jenisPeralatan || req.namaBarang,
      req.merkTipe || '-',
      req.tahunPembuatanAtauCc || '-',
      req.nomorPolisiOrIdentitas || '-',
      req.kategori === 'KENDARAAN'
        ? req.nomorRangka || '-'
        : locationName || req.unitPelaporLabel,
      req.kategori === 'KENDARAAN'
        ? req.nomorMesin || '-'
        : req.bengkelRujukan || '-',
      kerusakanRingkas,
    ];

    sectionsChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        borders: ALL_BLACK_BORDERS,
        rows: [
          new TableRow({
            tableHeader: true,
            children: specHeaders.map(
              (h, idx) =>
                new TableCell({
                  width: { size: colWidths[idx], type: WidthType.PERCENTAGE },
                  verticalAlign: VerticalAlign.CENTER,
                  margins: { top: 60, bottom: 60, left: 45, right: 45 },
                  children: [
                    textPara(h, {
                      bold: true,
                      size: 17,
                      align: AlignmentType.CENTER,
                      spaceAfter: 0,
                    }),
                  ],
                })
            ),
          }),
          new TableRow({
            children: specValues.map(
              (val, idx) =>
                new TableCell({
                  width: { size: colWidths[idx], type: WidthType.PERCENTAGE },
                  verticalAlign: VerticalAlign.CENTER,
                  margins: { top: 60, bottom: 60, left: 45, right: 45 },
                  children: [
                    textPara(val, {
                      size: 17,
                      align: idx === 0 ? AlignmentType.CENTER : AlignmentType.CENTER,
                      spaceAfter: 0,
                    }),
                  ],
                })
            ),
          }),
        ],
      })
    );

    sectionsChildren.push(
      textPara('Demikian yang kami sampaikan, untuk menjadikan periksa.', {
        firstLineIndent: convertMillimetersToTwip(12),
        spaceBefore: 110,
        spaceAfter: 200,
      })
    );

    // Signature block: Left = Penanggung Jawab Admin Pos (wajib), Right = a.n. Pemohon (Kasubag Umpeg)
    const kasubagName = req.verifiedBy || 'Ahmad Thohir, A. Md.';
    const kasubagNip = (req.verifiedByNip || '19870616 201001 1 008').replace(/\s+/g, '');
    const kasubagJabatan =
      req.verifiedByJabatan || 'Kepala Sub Bagian Umum dan Kepegawaian';
    const kasubagRank = req.verifiedByPangkatGol || 'Penata / III/c';

    sectionsChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        borders: ALL_NO_BORDERS,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 48, type: WidthType.PERCENTAGE },
                borders: ALL_NO_BORDERS,
                margins: { right: 80 },
                children: buildSignatureBox({
                  headingTop: 'Penanggung Jawab Admin Pos,',
                  subHeading: posAdminJabatan,
                  signerName: posAdminName,
                  signerTitle: posAdminJabatan,
                  signerRank: req.requestedByPangkatGol || 'Penata Muda / III/a',
                  signerNip: posAdminNip,
                  isVerified: true,
                  qrBytes: posAdminQrBytes,
                }),
              }),
              new TableCell({
                width: { size: 4, type: WidthType.PERCENTAGE },
                borders: ALL_NO_BORDERS,
                children: [textPara('', { size: 18 })],
              }),
              new TableCell({
                width: { size: 48, type: WidthType.PERCENTAGE },
                borders: ALL_NO_BORDERS,
                margins: { left: 80 },
                children: buildSignatureBox({
                  headingTop: 'a.n. Pemohon',
                  subHeading: kasubagJabatan,
                  signerName: kasubagName,
                  signerTitle: kasubagJabatan,
                  signerRank: kasubagRank,
                  signerNip: kasubagNip,
                  isVerified,
                  qrBytes,
                }),
              }),
            ],
          }),
        ],
      })
    );
  } else {
    // Format 2: Nota Dinas Permohonan Unit / Pos Damkar -> Kepala Pelaksana BPBD (Foto 2)
    sectionsChildren.push(
      buildMetadataTable(
        [
          ['Kepada', req.kepadaUnitPos || 'Kepala Pelaksana BPBD Kab. Sidoarjo'],
          ['Dari', posAdminJabatan || req.unitPelaporLabel],
          ['Tanggal', formatTanggalBiasa(req.tanggalPengajuan)],
          ['Nomor', req.nomorNotaDinas],
          ['Sifat', 'Biasa / Terbuka'],
          ['Lampiran', req.fotoKerusakanDataUrl ? '1 (Satu) Berkas Foto Kondisi' : '-'],
          ['Perihal', req.perihal],
          ['Jenis Kendaraan/Peralatan', req.jenisPeralatan || req.namaBarang],
          ['Merk Kendaraan/Peralatan', req.merkTipe || '-'],
          ['Nomor Polisi/Identitas', req.nomorPolisiOrIdentitas || '-'],
          ['Tahun Pembuatan', req.tahunPembuatanAtauCc || '-'],
          ['Tempat/Lokasi/Wilayah', locationName || req.unitPelaporLabel],
        ],
        30,
        false
      )
    );

    const introPos = `Bersama ini kami laporkan dengan hormat bahwa ${
      req.unitPelaporLabel || locationName
    } saat ini membutuhkan perbaikan / perawatan ${
      req.kategori === 'KENDARAAN' ? 'kendaraan' : 'peralatan / barang'
    }. Adapun jenis dan macam kerusakan sebagai berikut :`;

    sectionsChildren.push(
      textPara(introPos, {
        align: AlignmentType.JUSTIFIED,
        firstLineIndent: convertMillimetersToTwip(12),
        spaceBefore: 160,
        spaceAfter: 120,
      })
    );

    const detailRows =
      req.rincianKerusakan.length > 0
        ? req.rincianKerusakan
        : [
            {
              id: 'fallback',
              jenisKerusakan: req.kronologiSingkat,
              keterangan: 'Membutuhkan perbaikan / perawatan',
            },
          ];

    sectionsChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        borders: ALL_BLACK_BORDERS,
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              new TableCell({
                width: { size: 8, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 60, bottom: 60, left: 60, right: 60 },
                children: [
                  textPara('NO', {
                    bold: true,
                    size: 19,
                    align: AlignmentType.CENTER,
                    spaceAfter: 0,
                  }),
                ],
              }),
              new TableCell({
                width: { size: 58, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 60, bottom: 60, left: 80, right: 80 },
                children: [
                  textPara('JENIS KERUSAKAN / PERAWATAN', {
                    bold: true,
                    size: 19,
                    align: AlignmentType.CENTER,
                    spaceAfter: 0,
                  }),
                ],
              }),
              new TableCell({
                width: { size: 34, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 60, bottom: 60, left: 80, right: 80 },
                children: [
                  textPara('KETERANGAN', {
                    bold: true,
                    size: 19,
                    align: AlignmentType.CENTER,
                    spaceAfter: 0,
                  }),
                ],
              }),
            ],
          }),
          ...detailRows.map(
            (det, idx) =>
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 8, type: WidthType.PERCENTAGE },
                    verticalAlign: VerticalAlign.CENTER,
                    margins: { top: 55, bottom: 55, left: 60, right: 60 },
                    children: [
                      textPara(String(idx + 1), {
                        size: 19,
                        align: AlignmentType.CENTER,
                        spaceAfter: 0,
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 58, type: WidthType.PERCENTAGE },
                    verticalAlign: VerticalAlign.CENTER,
                    margins: { top: 55, bottom: 55, left: 80, right: 80 },
                    children: [
                      textPara(det.jenisKerusakan, { size: 19, spaceAfter: 0 }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 34, type: WidthType.PERCENTAGE },
                    verticalAlign: VerticalAlign.CENTER,
                    margins: { top: 55, bottom: 55, left: 80, right: 80 },
                    children: [
                      textPara(det.keterangan || 'Rusak', {
                        size: 19,
                        align: AlignmentType.CENTER,
                        spaceAfter: 0,
                      }),
                    ],
                  }),
                ],
              })
          ),
        ],
      })
    );

    sectionsChildren.push(
      textPara('Demikian untuk menjadikan periksa dan mohon petunjuk.', {
        firstLineIndent: convertMillimetersToTwip(12),
        spaceBefore: 120,
        spaceAfter: 180,
      })
    );

    const mengetahuiName = req.verifiedBy || req.mengetahuiUnitPosNama || 'Ahmad Thohir, A. Md.';
    const mengetahuiJabatan =
      req.verifiedByJabatan ||
      req.mengetahuiUnitPosJabatan ||
      'Kepala Sub Bagian Umum dan Kepegawaian';
    const mengetahuiPangkat =
      req.verifiedByPangkatGol || req.mengetahuiUnitPosPangkat || 'Penata / III/c';
    const mengetahuiNip =
      req.verifiedByNip || req.mengetahuiUnitPosNip || '19870616 201001 1 008';

    sectionsChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        borders: ALL_NO_BORDERS,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 48, type: WidthType.PERCENTAGE },
                borders: ALL_NO_BORDERS,
                margins: { right: 80 },
                children: buildSignatureBox({
                  headingTop: 'Mengetahui,',
                  subHeading: mengetahuiJabatan,
                  signerName: mengetahuiName,
                  signerTitle: mengetahuiJabatan,
                  signerRank: mengetahuiPangkat,
                  signerNip: mengetahuiNip,
                  isVerified,
                  qrBytes,
                }),
              }),
              new TableCell({
                width: { size: 4, type: WidthType.PERCENTAGE },
                borders: ALL_NO_BORDERS,
                children: [textPara('', { size: 18 })],
              }),
              new TableCell({
                width: { size: 48, type: WidthType.PERCENTAGE },
                borders: ALL_NO_BORDERS,
                margins: { left: 80 },
                children: buildSignatureBox({
                  headingTop: 'Yang mengajukan,',
                  subHeading: `Penanggung Jawab Admin Pos · ${posAdminJabatan}`,
                  signerName: posAdminName,
                  signerTitle: posAdminJabatan,
                  signerRank: req.requestedByPangkatGol || 'Penata Muda / III/a',
                  signerNip: posAdminNip,
                  isVerified: true,
                  qrBytes: posAdminQrBytes,
                }),
              }),
            ],
          }),
        ],
      })
    );
  }

  // Optional embedded damage photo on page bottom if present
  if (req.fotoKerusakanDataUrl) {
    const lowerMime = req.fotoKerusakanDataUrl.slice(0, 40).toLowerCase();
    const imgType: 'png' | 'jpg' = lowerMime.includes('image/png') ? 'png' : 'jpg';
    const photoBytes = dataUrlToUint8Array(req.fotoKerusakanDataUrl);
    if (photoBytes) {
      sectionsChildren.push(
        textPara('Lampiran Dokumentasi Kondisi Barang Rusak:', {
          bold: true,
          size: 18,
          spaceBefore: 240,
          spaceAfter: 60,
        })
      );
      sectionsChildren.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 120 },
          children: [
            new ImageRun({
              type: imgType,
              data: photoBytes,
              transformation: { width: 240, height: 165 },
            }),
          ],
        })
      );
    }
  }

  // Footer BSrE disclaimer
  sectionsChildren.push(
    textPara(
      isVerified
        ? 'Dokumen ini telah ditandatangani secara elektronik menggunakan sertifikat elektronik yang diterbitkan oleh Balai Besar Sertifikasi Elektronik (BSrE), Badan Siber dan Sandi Negara.'
        : 'DRAFT PENGAJUAN SIMAS-BMD: Dokumen ini merupakan draf Nota Dinas usulan pemeliharaan/perbaikan menunggu verifikasi final Kasubag Umum dan Kepegawaian.',
      {
        italic: true,
        size: 15,
        align: AlignmentType.CENTER,
        color: '475569',
        spaceBefore: 360,
        spaceAfter: 0,
      }
    )
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(210), // A4 / F4 width 210mm
              height: convertMillimetersToTwip(330), // F4 government paper height 330mm
            },
            margin: {
              top: convertMillimetersToTwip(16),
              right: convertMillimetersToTwip(18),
              bottom: convertMillimetersToTwip(18),
              left: convertMillimetersToTwip(18),
            },
          },
        },
        children: sectionsChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  if (!blob || blob.size === 0) {
    throw new Error('Dokumen Word kosong gagal dibuat.');
  }
  const url = URL.createObjectURL(blob);
  const safeNo = req.nomorNotaDinas.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const prefix =
    format === 'FORMAT_KASUBAG_UMPEG'
      ? 'Nota-Dinas-Kasubag-Umpeg'
      : 'Nota-Dinas-Permohonan-Unit';

  const link = document.createElement('a');
  link.href = url;
  link.download = `${prefix}-${safeNo}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function escapeHtml(value: string | undefined | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function downloadNotaDinasHtml(
  req: MaintenanceRequest,
  locationName: string,
  format: NotaDinasFormat
): Promise<void> {
  const isVerified =
    req.status === 'DISETUJUI_KASUBAG' || req.status === 'SELESAI_PERBAIKAN';
  const posAdminName = req.posAdminName || req.requestedBy;
  const posAdminJabatan =
    req.posAdminJabatan || req.requestedByJabatan || 'Penanggung Jawab Admin Pos';
  const posAdminNip = req.posAdminNip || req.requestedByNip || '-';

  const qrPayload = `SIMAS-BMD|NOTA-DINAS|${req.nomorNotaDinas}|${req.id}|${
    req.verifiedBy || req.requestedBy
  }`;
  const posAdminQrPayload = `SIMAS-BMD|TTD-PJ-POS|${req.nomorNotaDinas}|${req.id}|${posAdminName}|${posAdminNip}`;
  const [qrDataUrl, posAdminQrDataUrl] = await Promise.all([
    QRCode.toDataURL(qrPayload, {
      width: 180,
      margin: 1,
      color: { dark: '#0B192C', light: '#FFFFFF' },
    }),
    QRCode.toDataURL(posAdminQrPayload, {
      width: 180,
      margin: 1,
      color: { dark: '#0B192C', light: '#FFFFFF' },
    }),
  ]);
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';
  const logoSrc = `${origin}${LOGO_URL}`;

  const kasubagName = req.verifiedBy || 'Ahmad Thohir, A. Md.';
  const kasubagJabatan =
    req.verifiedByJabatan || 'Kepala Sub Bagian Umum dan Kepegawaian';
  const kasubagRank = req.verifiedByPangkatGol || 'Penata / III/c';
  const kasubagNip = (req.verifiedByNip || '19870616 201001 1 008').replace(/\s+/g, '');

  const kerusakanSummary =
    req.rincianKerusakan.length > 0
      ? req.rincianKerusakan
          .map((d) => `${d.jenisKerusakan}${d.keterangan ? ` (${d.keterangan})` : ''}`)
          .join('; ')
      : req.kronologiSingkat;

  const bodySection =
    format === 'FORMAT_KASUBAG_UMPEG'
      ? `
      <table class="meta-table meta-border">
        <tr><td class="lbl">Yth</td><td class="col">:</td><td>${escapeHtml(req.kepadaYthUmpeg)}</td></tr>
        <tr><td class="lbl">Dari</td><td class="col">:</td><td>Kepala Sub Bagian Umum dan Kepegawaian</td></tr>
        <tr><td class="lbl">Tembusan</td><td class="col">:</td><td>${escapeHtml(req.tembusanUmpeg)}</td></tr>
        <tr><td class="lbl">Tanggal</td><td class="col">:</td><td>${escapeHtml(formatTanggalBiasa(req.tanggalPengajuan))}</td></tr>
        <tr><td class="lbl">Nomor</td><td class="col">:</td><td>${escapeHtml(req.nomorNotaDinas)}</td></tr>
        <tr><td class="lbl">Sifat</td><td class="col">:</td><td>Biasa / Terbuka</td></tr>
        <tr><td class="lbl">Lampiran</td><td class="col">:</td><td>${req.fotoKerusakanDataUrl ? '1 (Satu) Berkas Foto Kondisi' : '-'}</td></tr>
        <tr><td class="lbl pb">Hal</td><td class="col pb">:</td><td class="pb">${escapeHtml(req.perihal)}</td></tr>
      </table>
      <p class="para">Sehubungan dengan Kondisi ${
        req.kategori === 'KENDARAAN' ? 'Kendaraan Dinas' : 'Barang Inventaris / Peralatan'
      } hari ini ${escapeHtml(formatTanggalTerbilang(req.tanggalPengajuan))}, ${escapeHtml(req.kronologiSingkat)}</p>
      <p class="para">Bersama ini kami mengajukan permohonan perawatan/perbaikan ${
        req.kategori === 'KENDARAAN'
          ? 'kendaraan dinas / operasional'
          : 'barang / peralatan inventaris'
      } dengan spesifikasi sebagai berikut :</p>
      <table class="grid-table">
        <thead>
          <tr>
            <th>No</th><th>Nama Pemilik dan Pemegang</th><th>${
              req.kategori === 'KENDARAAN' ? 'Jenis Kendaraan' : 'Jenis Barang'
            }</th><th>Merk/Type</th><th>${
        req.kategori === 'KENDARAAN' ? 'Tahun /CC' : 'Tahun'
      }</th><th>${req.kategori === 'KENDARAAN' ? 'Nomor Polisi' : 'Kode / Reg'}</th><th>${
        req.kategori === 'KENDARAAN' ? 'Nomor Rangka' : 'Unit / Pos'
      }</th><th>${
        req.kategori === 'KENDARAAN' ? 'Nomor Mesin' : 'Rujukan'
      }</th><th>Ket</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1.</td>
            <td>${escapeHtml(req.namaPemilikPemegang)}</td>
            <td>${escapeHtml(req.jenisPeralatan || req.namaBarang)}</td>
            <td>${escapeHtml(req.merkTipe)}</td>
            <td>${escapeHtml(req.tahunPembuatanAtauCc)}</td>
            <td>${escapeHtml(req.nomorPolisiOrIdentitas)}</td>
            <td>${escapeHtml(req.kategori === 'KENDARAAN' ? req.nomorRangka || '-' : locationName)}</td>
            <td>${escapeHtml(req.kategori === 'KENDARAAN' ? req.nomorMesin || '-' : req.bengkelRujukan || '-')}</td>
            <td>${escapeHtml(kerusakanSummary)}</td>
          </tr>
        </tbody>
      </table>
      <p class="para">Demikian yang kami sampaikan, untuk menjadikan periksa.</p>
      <div class="ttd-two">
        <div>
          <div>Penanggung Jawab Admin Pos,</div>
          <div>${escapeHtml(posAdminJabatan)}</div>
          <div class="tte-row"><img src="${posAdminQrDataUrl}" width="54" height="54" /><div class="tte-meta"><div>Ditandatangani secara elektronik oleh</div><div><strong>${escapeHtml(posAdminName)}</strong></div><div>${escapeHtml(posAdminJabatan)}</div></div></div>
          <div><strong>${escapeHtml(posAdminName)}</strong></div>
          <div>${escapeHtml(req.requestedByPangkatGol || 'Penata Muda / III/a')}</div>
          <div>NIP ${escapeHtml(posAdminNip)}</div>
        </div>
        <div>
          <div>a.n. Pemohon</div>
          <div>${escapeHtml(kasubagJabatan)}</div>
          ${
            isVerified
              ? `<div class="tte-row"><img src="${qrDataUrl}" width="58" height="58" /><div class="tte-meta"><div>Ditandatangani secara elektronik oleh</div><div><strong>${escapeHtml(kasubagName)}</strong></div><div>${escapeHtml(kasubagJabatan)}</div></div></div>`
              : `<div class="draft-tte">[Draft — Menunggu Verifikasi Kasubag Umpeg]</div>`
          }
          <div><strong>${escapeHtml(kasubagName)}</strong></div>
          <div>${escapeHtml(kasubagRank)}</div>
          <div>NIP ${escapeHtml(kasubagNip)}</div>
        </div>
      </div>`
      : `
      <table class="meta-table">
        <tr><td class="lbl-wide">Kepada</td><td class="col">:</td><td>${escapeHtml(req.kepadaUnitPos || 'Kepala Pelaksana BPBD Kab. Sidoarjo')}</td></tr>
        <tr><td class="lbl-wide">Dari</td><td class="col">:</td><td>${escapeHtml(posAdminJabatan || req.unitPelaporLabel)}</td></tr>
        <tr><td class="lbl-wide">Tanggal</td><td class="col">:</td><td>${escapeHtml(formatTanggalBiasa(req.tanggalPengajuan))}</td></tr>
        <tr><td class="lbl-wide">Nomor</td><td class="col">:</td><td>${escapeHtml(req.nomorNotaDinas)}</td></tr>
        <tr><td class="lbl-wide">Sifat</td><td class="col">:</td><td>Biasa / Terbuka</td></tr>
        <tr><td class="lbl-wide">Lampiran</td><td class="col">:</td><td>${req.fotoKerusakanDataUrl ? '1 (Satu) Berkas Foto Kondisi' : '-'}</td></tr>
        <tr><td class="lbl-wide">Perihal</td><td class="col">:</td><td>${escapeHtml(req.perihal)}</td></tr>
        <tr><td class="lbl-wide">Jenis Kendaraan/Peralatan</td><td class="col">:</td><td>${escapeHtml(req.jenisPeralatan || req.namaBarang)}</td></tr>
        <tr><td class="lbl-wide">Merk Kendaraan/Peralatan</td><td class="col">:</td><td>${escapeHtml(req.merkTipe || '-')}</td></tr>
        <tr><td class="lbl-wide">Nomor Polisi/Identitas</td><td class="col">:</td><td>${escapeHtml(req.nomorPolisiOrIdentitas || '-')}</td></tr>
        <tr><td class="lbl-wide">Tahun Pembuatan</td><td class="col">:</td><td>${escapeHtml(req.tahunPembuatanAtauCc || '-')}</td></tr>
        <tr><td class="lbl-wide">Tempat/Lokasi/Wilayah</td><td class="col">:</td><td>${escapeHtml(locationName)}</td></tr>
      </table>
      <p class="para">Bersama ini kami laporkan dengan hormat bahwa ${escapeHtml(
        req.unitPelaporLabel || locationName
      )} saat ini membutuhkan perbaikan / perawatan ${
        req.kategori === 'KENDARAAN' ? 'kendaraan' : 'peralatan / barang inventaris'
      }. Adapun jenis dan macam kerusakan sebagai berikut :</p>
      <table class="grid-table">
        <thead><tr><th style="width:45px">NO</th><th>JENIS KERUSAKAN / PERAWATAN</th><th style="width:180px">KETERANGAN</th></tr></thead>
        <tbody>
          ${req.rincianKerusakan
            .map(
              (item, idx) =>
                `<tr><td style="text-align:center">${idx + 1}</td><td style="text-align:left">${escapeHtml(
                  item.jenisKerusakan
                )}</td><td style="text-align:center">${escapeHtml(
                  item.keterangan || 'Rusak'
                )}</td></tr>`
            )
            .join('')}
        </tbody>
      </table>
      <p class="para">Demikian untuk menjadikan periksa dan mohon petunjuk.</p>
      <div class="ttd-two">
        <div>
          <div>Mengetahui,</div>
          <div>${escapeHtml(req.verifiedByJabatan || req.mengetahuiUnitPosJabatan)}</div>
          ${
            isVerified
              ? `<div class="tte-row"><img src="${qrDataUrl}" width="54" height="54" /><div class="tte-meta"><div>Ditandatangani secara elektronik oleh</div><div><strong>${escapeHtml(req.verifiedBy || req.mengetahuiUnitPosNama)}</strong></div><div>${escapeHtml(req.verifiedByJabatan || req.mengetahuiUnitPosJabatan)}</div></div></div>`
              : `<div class="draft-tte">[Menunggu Verifikasi Kasubag Umpeg]</div>`
          }
          <div><strong>${escapeHtml(req.verifiedBy || req.mengetahuiUnitPosNama)}</strong></div>
          <div>${escapeHtml(req.verifiedByPangkatGol || req.mengetahuiUnitPosPangkat)}</div>
          <div>NIP. ${escapeHtml(req.verifiedByNip || req.mengetahuiUnitPosNip)}</div>
        </div>
        <div>
          <div>Yang mengajukan,</div>
          <div>Penanggung Jawab Admin Pos · ${escapeHtml(posAdminJabatan)}</div>
          <div class="tte-row"><img src="${posAdminQrDataUrl}" width="54" height="54" /><div class="tte-meta"><div>Ditandatangani secara elektronik oleh</div><div><strong>${escapeHtml(posAdminName)}</strong></div><div>${escapeHtml(posAdminJabatan)}</div></div></div>
          <div><strong>${escapeHtml(posAdminName)}</strong></div>
          <div>${escapeHtml(req.requestedByPangkatGol || 'Penata Muda / III/a')}</div>
          <div>NIP. ${escapeHtml(posAdminNip)}</div>
        </div>
      </div>`;

  const html = `<!doctype html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Nota Dinas ${escapeHtml(req.nomorNotaDinas)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 24px auto; max-width: 790px; font-size: 11pt; line-height: 1.45; }
    .toolbar { display: flex; justify-content: flex-end; margin-bottom: 14px; }
    .toolbar button { background: #0B2545; color: #fff; border: 0; border-radius: 6px; padding: 8px 14px; font-weight: 600; cursor: pointer; }
    .kop { display: flex; align-items: center; gap: 14px; border-bottom: 4px double #000; padding-bottom: 10px; margin-bottom: 12px; }
    .kop-text { flex: 1; text-align: center; }
    .kop-text .gov { font-size: 11pt; text-transform: uppercase; }
    .kop-text .inst { font-size: 14pt; font-weight: 700; text-transform: uppercase; }
    .kop-text .addr { font-size: 9.5pt; }
    .title { text-align: center; font-size: 12pt; font-weight: 600; letter-spacing: 0.06em; margin: 12px 0; }
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10.5pt; }
    .meta-border { border-bottom: 1px solid #000; }
    .meta-table td { vertical-align: top; padding: 2px 0; }
    .lbl { width: 105px; }
    .lbl-wide { width: 195px; }
    .col { width: 16px; }
    .pb { padding-bottom: 8px !important; }
    .para { text-align: justify; text-indent: 32px; margin: 10px 0; }
    .grid-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9.5pt; }
    .grid-table th, .grid-table td { border: 1px solid #1E293B; padding: 5px 6px; }
    .grid-table th { font-weight: 700; text-align: center; }
    .grid-table td { text-align: center; }
    .ttd-right { display: flex; justify-content: flex-end; margin-top: 18px; }
    .ttd-box { width: 290px; font-size: 10pt; }
    .ttd-two { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 18px; font-size: 10pt; }
    .tte-row { display: flex; gap: 8px; align-items: flex-start; margin: 6px 0; }
    .tte-meta { font-size: 8.5pt; color: #334155; line-height: 1.25; }
    .draft-tte { padding: 14px 0; font-style: italic; color: #b45309; font-size: 9.5pt; }
    .footer-bsre { margin-top: 28px; padding-top: 10px; border-top: 1px solid #cbd5e1; text-align: center; font-style: italic; font-size: 8.5pt; color: #475569; }
    @media print { .toolbar { display: none; } body { margin: 0; } }
  </style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Cetak Nota Dinas</button></div>
  <div class="kop">
    <img src="${escapeHtml(logoSrc)}" width="64" height="58" style="object-fit:contain" alt="Logo Kabupaten Sidoarjo" />
    <div class="kop-text">
      <div class="gov">Pemerintah Kabupaten Sidoarjo</div>
      <div class="inst">Badan Penanggulangan Bencana Daerah</div>
      <div class="addr">Jalan Sultan Agung No. 19, Sidoarjo, Jawa Timur 61212</div>
      <div class="addr">Telepon (031) 8953200,</div>
      <div class="addr">Laman www.bpbd.sidoarjokab.go.id, Pos-el bpbd@sidoarjokab.go.id</div>
    </div>
  </div>
  <div class="title">NOTA DINAS</div>
  ${bodySection}
  ${
    req.fotoKerusakanDataUrl
      ? `<div style="margin-top:18px;padding-top:10px;border-top:1px solid #e2e8f0"><div style="font-size:9.5pt;font-weight:700;margin-bottom:6px">Lampiran Dokumentasi Kondisi Barang Rusak:</div><img src="${escapeHtml(
          req.fotoKerusakanDataUrl
        )}" style="max-height:190px;border:1px solid #cbd5e1" /></div>`
      : ''
  }
  <div class="footer-bsre">${
    isVerified
      ? 'Dokumen ini telah ditandatangani secara elektronik menggunakan sertifikat elektronik yang diterbitkan oleh Balai Besar Sertifikasi Elektronik (BSrE) sesuai dengan Undang Undang No 11 Tahun 2008 tentang Informasi dan Transaksi Elektronik.'
      : 'DRAFT NOTA DINAS SIMAS-BMD: Menunggu verifikasi dan persetujuan Kepala Sub Bagian Umum dan Kepegawaian BPBD Kabupaten Sidoarjo.'
  }</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const safeNo = req.nomorNotaDinas.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const link = document.createElement('a');
  link.href = url;
  link.download = `Pratinjau-Nota-Dinas-${safeNo}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
