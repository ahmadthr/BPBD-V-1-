import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  AlertTriangle,
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileCode2,
  ImagePlus,
  Link2,
  Printer,
  QrCode,
  RefreshCw,
  ScanLine,
  Search,
} from 'lucide-react';
import {
  AssetItem,
  AssetMutation,
  ConditionStatus,
  DamageReport,
  KibCategory,
  LocationUnit,
  OpnameStatus,
  RoleProfile,
  RoomAssetEntry,
  RoomUnit,
  VehicleItem,
} from '../types/simas';
import {
  DAMAGE_STATUS_META,
  OPNAME_STATUS_META,
  formatDateID,
  formatIDR,
} from '../utils/formatters';
import {
  STICKER_PRINT_CSS,
  buildAssetDetailUrl,
  buildRoomDetailUrl,
  copyTextToClipboard,
  downloadHtmlDocument,
  generateStickerHtmlBlock,
  printHtmlInHiddenFrame,
} from '../utils/printHelper';
import {
  PhotoLightboxData,
  PhotoLightboxModal,
} from './ItemPhotoControl';
import { PrintableQrSticker, QrCodeImage } from './QrCodeCanvas';
import { ConditionIndicator } from './StatusText';

interface QrScannerViewProps {
  assets: AssetItem[];
  vehicles?: VehicleItem[];
  rooms?: RoomUnit[];
  roomItems?: RoomAssetEntry[];
  locations: LocationUnit[];
  mutations: AssetMutation[];
  damageReports: DamageReport[];
  roleProfile: RoleProfile;
  onRecordQuickOpname: (
    assetId: string,
    status: OpnameStatus,
    observedCondition: ConditionStatus,
    notes: string
  ) => void;
  onQuickNavigateToDamage: (assetId: string) => void;
  onOpenPublicProfile: (kode: string, register: string) => void;
  onOpenRoomProfile?: (roomId: string) => void;
}

type TargetCategoryFilter = 'ALL' | KibCategory | 'KENDARAAN' | 'KIR';

function normalizeRegToken(val: string): string {
  return val.trim().toLowerCase().replace(/^0+(?=\d)/, '');
}

function normalizeCompactCode(val: string): string {
  return val.trim().toLowerCase().replace(/\s+/g, '');
}

export const QrScannerView: React.FC<QrScannerViewProps> = ({
  assets,
  vehicles = [],
  rooms = [],
  roomItems = [],
  locations,
  mutations,
  damageReports,
  roleProfile,
  onRecordQuickOpname,
  onQuickNavigateToDamage,
  onOpenPublicProfile,
  onOpenRoomProfile,
}) => {
  const lockedLocationId = roleProfile.assignedLocationId || '';
  const [subTab, setSubTab] = useState<'scanner' | 'generator'>('scanner');
  const [manualInput, setManualInput] = useState<string>('');
  const [targetFilter, setTargetFilter] = useState<TargetCategoryFilter>('ALL');
  const [targetSearch, setTargetSearch] = useState<string>('');
  const [scannedAssetId, setScannedAssetId] = useState<string>(
    () =>
      (lockedLocationId
        ? assets.find((a) => a.locationId === lockedLocationId)
        : assets[2] ?? assets[0]
      )?.id ??
      assets[0]?.id ??
      ''
  );
  const [scannedCustomLink, setScannedCustomLink] = useState<{
    kode: string;
    register: string;
    label: string;
  } | null>(null);
  const [scannedRoomLink, setScannedRoomLink] = useState<RoomUnit | null>(null);
  const [scannedRoomItem, setScannedRoomItem] = useState<{
    item: RoomAssetEntry;
    room: RoomUnit | null;
  } | null>(null);
  const [lastDecodedRaw, setLastDecodedRaw] = useState<string>('');
  const [isScanningAnim, setIsScanningAnim] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraStarting, setCameraStarting] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string>('');
  const [opnameFeedback, setOpnameFeedback] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copyLinkFailed, setCopyLinkFailed] = useState<boolean>(false);
  const [printingAll, setPrintingAll] = useState<boolean>(false);
  const [generatorLocationFilter, setGeneratorLocationFilter] = useState<string>(
    lockedLocationId || 'ALL'
  );
  const [generatorKibFilter, setGeneratorKibFilter] = useState<'ALL' | KibCategory>('ALL');
  const [generatorSearch, setGeneratorSearch] = useState<string>('');
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoLightboxData | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const decodeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (lockedLocationId) {
      setGeneratorLocationFilter(lockedLocationId);
    }
  }, [lockedLocationId]);

  useEffect(() => {
    if (scannedAssetId && !assets.some((a) => a.id === scannedAssetId)) {
      setScannedAssetId(assets[0]?.id ?? '');
    }
  }, [assets, scannedAssetId]);

  const locationMap = useMemo(
    () => new Map(locations.map((l) => [l.id, l])),
    [locations]
  );

  const roomMap = useMemo(
    () => new Map(rooms.map((r) => [r.id, r])),
    [rooms]
  );

  const scannedAsset = useMemo(
    () => assets.find((a) => a.id === scannedAssetId) ?? null,
    [assets, scannedAssetId]
  );

  const scannedVehicle = useMemo(() => {
    if (scannedCustomLink) {
      return (
        vehicles.find(
          (v) =>
            v.kodeBarang.toLowerCase() === scannedCustomLink.kode.toLowerCase() &&
            (!scannedCustomLink.register ||
              normalizeRegToken(v.nomorRegister) ===
                normalizeRegToken(scannedCustomLink.register))
        ) ?? null
      );
    }
    if (!scannedAsset) return null;
    return (
      vehicles.find(
        (v) =>
          v.kodeBarang.toLowerCase() === scannedAsset.kodeBarang.toLowerCase() &&
          normalizeRegToken(v.nomorRegister) ===
            normalizeRegToken(scannedAsset.nomorRegister)
      ) ?? null
    );
  }, [vehicles, scannedAsset, scannedCustomLink]);

  const activeKode =
    scannedRoomItem?.item.kodeBarang ??
    scannedCustomLink?.kode ??
    scannedAsset?.kodeBarang ??
    '';
  const activeRegister =
    scannedRoomItem?.item.nomorRegister ??
    scannedCustomLink?.register ??
    scannedAsset?.nomorRegister ??
    '';

  const activeDetailLinks = useMemo(() => {
    if (scannedRoomLink) {
      return buildRoomDetailUrl(scannedRoomLink.id);
    }
    if (scannedRoomItem?.room) {
      return buildRoomDetailUrl(scannedRoomItem.room.id);
    }
    if (!activeKode) return null;
    return buildAssetDetailUrl(activeKode, activeRegister);
  }, [scannedRoomLink, scannedRoomItem, activeKode, activeRegister]);

  const assetMutations = useMemo(
    () => (scannedAsset ? mutations.filter((m) => m.assetId === scannedAsset.id) : []),
    [mutations, scannedAsset]
  );

  const assetDamages = useMemo(
    () =>
      scannedAsset ? damageReports.filter((d) => d.assetId === scannedAsset.id) : [],
    [damageReports, scannedAsset]
  );

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraStarting(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const triggerSimulatedScan = useCallback((assetId: string) => {
    setIsScanningAnim(true);
    setOpnameFeedback('');
    setScannedCustomLink(null);
    setScannedRoomLink(null);
    setScannedRoomItem(null);
    window.setTimeout(() => {
      setScannedAssetId(assetId);
      setIsScanningAnim(false);
    }, 180);
  }, []);

  const selectVehicleTarget = useCallback((veh: VehicleItem) => {
    setIsScanningAnim(true);
    setOpnameFeedback('');
    setScannedAssetId('');
    setScannedRoomLink(null);
    setScannedRoomItem(null);
    window.setTimeout(() => {
      setScannedCustomLink({
        kode: veh.kodeBarang,
        register: veh.nomorRegister,
        label: `${veh.namaKendaraan} (${veh.nomorPolisi})`,
      });
      setIsScanningAnim(false);
    }, 150);
  }, []);

  const selectRoomTarget = useCallback((room: RoomUnit) => {
    setIsScanningAnim(true);
    setOpnameFeedback(
      `QR Kartu Inventaris Ruangan (KIR) terbaca untuk ${room.namaRuang}.`
    );
    setScannedAssetId('');
    setScannedCustomLink(null);
    setScannedRoomItem(null);
    window.setTimeout(() => {
      setScannedRoomLink(room);
      setIsScanningAnim(false);
    }, 150);
  }, []);

  const selectRoomItemTarget = useCallback(
    (item: RoomAssetEntry) => {
      const parentRoom = roomMap.get(item.roomId) ?? null;
      setIsScanningAnim(true);
      setOpnameFeedback(
        `Barang KIR Ruangan terbaca: ${item.namaBarang} (${parentRoom?.namaRuang ?? item.roomId}).`
      );
      setScannedAssetId('');
      setScannedCustomLink(null);
      setScannedRoomLink(null);
      window.setTimeout(() => {
        setScannedRoomItem({ item, room: parentRoom });
        setIsScanningAnim(false);
      }, 150);
    },
    [roomMap]
  );

  const resolveByKodeRegister = useCallback(
    (kode: string, register: string, labelHint?: string): boolean => {
      const normKode = kode.trim().toLowerCase();
      const normReg = normalizeRegToken(register);
      if (!normKode) return false;

      const matchedAsset =
        assets.find(
          (a) =>
            a.kodeBarang.toLowerCase() === normKode &&
            (!normReg || normalizeRegToken(a.nomorRegister) === normReg)
        ) ??
        assets.find((a) => a.kodeBarang.toLowerCase() === normKode) ??
        null;
      if (matchedAsset) {
        triggerSimulatedScan(matchedAsset.id);
        setOpnameFeedback(
          `QR KIB ${matchedAsset.kibType} terbaca: ${matchedAsset.namaBarang} (${matchedAsset.id}).`
        );
        return true;
      }

      const matchedVeh =
        vehicles.find(
          (v) =>
            v.kodeBarang.toLowerCase() === normKode &&
            (!normReg || normalizeRegToken(v.nomorRegister) === normReg)
        ) ??
        vehicles.find((v) => v.kodeBarang.toLowerCase() === normKode) ??
        null;
      if (matchedVeh) {
        selectVehicleTarget(matchedVeh);
        setOpnameFeedback(
          `QR Kendaraan terbaca: ${matchedVeh.namaKendaraan} (${matchedVeh.nomorPolisi}).`
        );
        return true;
      }

      const matchedRoomItem =
        roomItems.find(
          (it) =>
            it.kodeBarang.toLowerCase() === normKode &&
            (!normReg || normalizeRegToken(it.nomorRegister) === normReg)
        ) ??
        roomItems.find((it) => it.kodeBarang.toLowerCase() === normKode) ??
        null;
      if (matchedRoomItem) {
        selectRoomItemTarget(matchedRoomItem);
        return true;
      }

      const matchedRoom = rooms.find(
        (r) => r.kodeRuang.toLowerCase() === normKode
      );
      if (matchedRoom) {
        selectRoomTarget(matchedRoom);
        return true;
      }

      if (lockedLocationId) {
        return false;
      }

      setScannedAssetId('');
      setScannedRoomLink(null);
      setScannedRoomItem(null);
      setScannedCustomLink({
        kode: kode.trim(),
        register: register.trim(),
        label: labelHint?.trim() || `Barang / KIB (${kode.trim()})`,
      });
      setOpnameFeedback(
        `QR Terbaca! Kode Barang ${kode.trim()}${register.trim() ? ` (Reg. ${register.trim()})` : ''} siap dibuka.`
      );
      return true;
    },
    [
      assets,
      vehicles,
      roomItems,
      rooms,
      lockedLocationId,
      triggerSimulatedScan,
      selectVehicleTarget,
      selectRoomItemTarget,
      selectRoomTarget,
    ]
  );

  const processScannedCode = useCallback(
    (rawText: string) => {
      const raw = rawText.trim();
      if (!raw) return false;
      setLastDecodedRaw(raw);

      // 1. JSON QR payload (external e-BMD / SIMDA / custom JSON QR)
      if (raw.startsWith('{') && raw.endsWith('}')) {
        try {
          const obj = JSON.parse(raw) as Record<string, unknown>;
          const ruangVal = String(obj.ruang ?? obj.kodeRuang ?? obj.roomId ?? '').trim();
          if (ruangVal) {
            const matchedRoom = rooms.find(
              (r) =>
                r.id.toLowerCase() === ruangVal.toLowerCase() ||
                r.kodeRuang.toLowerCase() === ruangVal.toLowerCase()
            );
            if (matchedRoom) {
              selectRoomTarget(matchedRoom);
              return true;
            }
          }
          const kodeVal = String(
            obj.kodeBarang ?? obj.kode_barang ?? obj.kode ?? ''
          ).trim();
          const regVal = String(
            obj.nomorRegister ?? obj.nomor_register ?? obj.register ?? obj.reg ?? ''
          ).trim();
          const namaVal = String(obj.namaBarang ?? obj.nama ?? obj.name ?? '').trim();
          if (kodeVal && resolveByKodeRegister(kodeVal, regVal, namaVal)) {
            return true;
          }
          const idVal = String(obj.id ?? '').trim();
          if (idVal) {
            const byId = assets.find((a) => a.id.toLowerCase() === idVal.toLowerCase());
            if (byId) {
              triggerSimulatedScan(byId.id);
              return true;
            }
          }
        } catch {
          // Not valid JSON, continue
        }
      }

      // 2. URL format: ?aset=detail&kode=...&register=..., ?aset=ruang&ruang=..., /aset/detail?..., or #/...
      if (
        raw.includes('kode=') ||
        raw.includes('kodeBarang=') ||
        raw.includes('ruang=') ||
        raw.startsWith('http://') ||
        raw.startsWith('https://') ||
        raw.startsWith('/?') ||
        raw.startsWith('?')
      ) {
        try {
          const normalizedInput = raw.includes('#') ? raw.replace('#', '') : raw;
          const parsedUrl = new URL(
            normalizedInput.startsWith('http')
              ? normalizedInput
              : `https://simas.local${
                  normalizedInput.startsWith('/') || normalizedInput.startsWith('?')
                    ? normalizedInput
                    : `/${normalizedInput}`
                }`
          );
          const ruang =
            parsedUrl.searchParams.get('ruang') ??
            parsedUrl.searchParams.get('room') ??
            '';
          if (ruang) {
            const matchedRoom = rooms.find(
              (r) =>
                r.id.toLowerCase() === ruang.toLowerCase() ||
                r.kodeRuang.toLowerCase() === ruang.toLowerCase()
            );
            if (lockedLocationId && !matchedRoom) {
              return false;
            }
            if (matchedRoom) {
              selectRoomTarget(matchedRoom);
              return true;
            }
            setScannedAssetId('');
            setScannedCustomLink(null);
            setScannedRoomItem(null);
            setScannedRoomLink({
              id: ruang,
              kodeRuang: ruang,
              namaRuang: `Ruangan ${ruang}`,
              locationId: '',
              lantaiGedung: '-',
              penanggungJawab: '-',
              nipPenanggungJawab: '-',
              jabatanPenanggungJawab: '-',
            });
            setOpnameFeedback(`QR Kartu Inventaris Ruangan (KIR) terbaca untuk ${ruang}.`);
            return true;
          }

          const kode =
            parsedUrl.searchParams.get('kode') ??
            parsedUrl.searchParams.get('kodeBarang') ??
            parsedUrl.searchParams.get('kode_barang') ??
            '';
          const register =
            parsedUrl.searchParams.get('register') ??
            parsedUrl.searchParams.get('nomorRegister') ??
            parsedUrl.searchParams.get('reg') ??
            '';
          if (kode && resolveByKodeRegister(kode, register)) {
            return true;
          }
        } catch {
          // continue
        }
      }

      // 3. Pipe / semicolon delimited formats: SIMAS-BMD|BPBD-SDA|<kode>|<reg>, KIB-X|<kode>|<reg>, or <kode>|<reg>
      if (raw.includes('|') || raw.includes(';')) {
        const sep = raw.includes('|') ? '|' : ';';
        const parts = raw.split(sep).map((s) => s.trim());
        if (parts.length >= 4 && parts[0].toUpperCase() === 'SIMAS-BMD') {
          if (resolveByKodeRegister(parts[2], parts[3])) return true;
        } else if (parts.length >= 3 && parts[0].toUpperCase().startsWith('KIB')) {
          if (resolveByKodeRegister(parts[1], parts[2])) return true;
        } else if (parts.length >= 2) {
          if (resolveByKodeRegister(parts[0], parts[1])) return true;
        }
      }

      // 4. Direct match across ALL KIB A-F assets, vehicles, KIR rooms, & KIR room items
      const q = raw.toLowerCase();
      const compactQ = normalizeCompactCode(raw);

      const assetExact = assets.find(
        (a) =>
          a.id.toLowerCase() === q ||
          a.qrPayload.toLowerCase() === q ||
          a.kodeBarang.toLowerCase() === q ||
          normalizeCompactCode(a.nomorPolisiOrSertifikat) === compactQ ||
          `${a.kodeBarang.toLowerCase()}/${a.nomorRegister.toLowerCase()}` === q ||
          `${a.kodeBarang.toLowerCase()}-${a.nomorRegister.toLowerCase()}` === q
      );
      if (assetExact) {
        triggerSimulatedScan(assetExact.id);
        setOpnameFeedback(
          `Aset KIB ${assetExact.kibType} terbaca: ${assetExact.namaBarang} (${assetExact.id}).`
        );
        return true;
      }

      const vehExact = vehicles.find(
        (v) =>
          v.id.toLowerCase() === q ||
          normalizeCompactCode(v.nomorPolisi) === compactQ ||
          v.nomorRangka.toLowerCase() === q ||
          v.nomorMesin.toLowerCase() === q ||
          v.kodeBarang.toLowerCase() === q
      );
      if (vehExact) {
        selectVehicleTarget(vehExact);
        setOpnameFeedback(
          `Kendaraan terbaca: ${vehExact.namaKendaraan} (${vehExact.nomorPolisi}).`
        );
        return true;
      }

      const roomExact = rooms.find(
        (r) =>
          r.id.toLowerCase() === q ||
          r.kodeRuang.toLowerCase() === q ||
          r.namaRuang.toLowerCase() === q
      );
      if (roomExact) {
        selectRoomTarget(roomExact);
        return true;
      }

      const roomItemExact = roomItems.find(
        (it) => it.id.toLowerCase() === q || it.kodeBarang.toLowerCase() === q
      );
      if (roomItemExact) {
        selectRoomItemTarget(roomItemExact);
        return true;
      }

      // 5. Embedded Permendagri Kode Barang extraction from multiline/sticker text
      const kodeMatches = raw.match(/\b\d\.\d\.\d(?:\.\d{1,3}){2,5}\b/g);
      if (kodeMatches && kodeMatches.length > 0) {
        const regMatch = raw.match(/(?:reg(?:ister)?|no\.?\s*reg)\s*[:#-]?\s*([A-Za-z0-9]+)/i);
        const extractedKode = kodeMatches[0];
        const extractedReg = regMatch?.[1] ?? '';
        if (resolveByKodeRegister(extractedKode, extractedReg)) {
          return true;
        }
      }

      // 6. Fuzzy partial match across ALL KIB A-F assets, vehicles, KIR rooms, & KIR items
      const kibQueryMatch = q.match(/^kib\s*([a-f])$/i);
      if (kibQueryMatch) {
        const targetKib = kibQueryMatch[1].toUpperCase() as KibCategory;
        const kibAsset = assets.find((a) => a.kibType === targetKib);
        if (kibAsset) {
          setTargetFilter(targetKib);
          triggerSimulatedScan(kibAsset.id);
          setOpnameFeedback(
            `Menampilkan KIB ${targetKib}: ${kibAsset.namaBarang} (${kibAsset.id}).`
          );
          return true;
        }
      }

      const assetPartial = assets.find(
        (a) =>
          a.namaBarang.toLowerCase().includes(q) ||
          a.merkTipe.toLowerCase().includes(q) ||
          a.kodeBarang.toLowerCase().includes(q) ||
          a.nomorPolisiOrSertifikat.toLowerCase().includes(q)
      );
      if (assetPartial) {
        triggerSimulatedScan(assetPartial.id);
        setOpnameFeedback(
          `Aset KIB ${assetPartial.kibType} terbaca: ${assetPartial.namaBarang} (${assetPartial.id}).`
        );
        return true;
      }

      const vehPartial = vehicles.find(
        (v) =>
          v.namaKendaraan.toLowerCase().includes(q) ||
          v.merkTipe.toLowerCase().includes(q) ||
          v.nomorPolisi.toLowerCase().includes(q)
      );
      if (vehPartial) {
        selectVehicleTarget(vehPartial);
        return true;
      }

      const roomPartial = rooms.find((r) => r.namaRuang.toLowerCase().includes(q));
      if (roomPartial) {
        selectRoomTarget(roomPartial);
        return true;
      }

      const roomItemPartial = roomItems.find(
        (it) =>
          it.namaBarang.toLowerCase().includes(q) ||
          it.merkModel.toLowerCase().includes(q)
      );
      if (roomItemPartial) {
        selectRoomItemTarget(roomItemPartial);
        return true;
      }

      return false;
    },
    [
      assets,
      vehicles,
      rooms,
      roomItems,
      lockedLocationId,
      resolveByKodeRegister,
      triggerSimulatedScan,
      selectVehicleTarget,
      selectRoomTarget,
      selectRoomItemTarget,
    ]
  );

  // Attach active MediaStream to always-mounted <video> element and ensure mobile playback
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!cameraActive || !video || !stream) return;

    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.muted = true;
    video.srcObject = stream;
    void video.play().catch(() => {
      // Some mobile browsers delay play until metadata is ready
    });
  }, [cameraActive]);

  // Live camera QR frame decoder loop (Native BarcodeDetector + jsQR fallback)
  useEffect(() => {
    if (!cameraActive) return;

    type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => {
      detect: (source: ImageBitmapSource) => Promise<{ rawValue?: string }[]>;
    };
    const DetectorCtor = (
      window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
    ).BarcodeDetector;
    const nativeDetector = DetectorCtor
      ? new DetectorCtor({ formats: ['qr_code'] })
      : null;

    let busy = false;
    const timer = window.setInterval(() => {
      if (busy) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        return;
      }
      busy = true;

      const runDecode = async () => {
        try {
          if (nativeDetector) {
            try {
              const detected = await nativeDetector.detect(video);
              const val = detected[0]?.rawValue;
              if (val) {
                const ok = processScannedCode(val);
                if (ok) {
                  stopCamera();
                  return;
                }
                setOpnameFeedback(
                  `QR terbaca (${val}), namun data aset tidak termasuk lokasi/daftar inventaris Anda.`
                );
                stopCamera();
                return;
              }
            } catch {
              // Fallback to jsQR canvas frame below
            }
          }

          let canvas = decodeCanvasRef.current;
          if (!canvas) {
            canvas = document.createElement('canvas');
            decodeCanvasRef.current = canvas;
          }
          const maxDim = 960;
          const scale = Math.min(
            1,
            maxDim / Math.max(video.videoWidth, video.videoHeight)
          );
          canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
          canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const decoded = jsQR(imgData.data, imgData.width, imgData.height, {
            inversionAttempts: 'attemptBoth',
          });
          if (decoded?.data) {
            const ok = processScannedCode(decoded.data);
            if (ok) {
              stopCamera();
            } else {
              setOpnameFeedback(
                `QR terbaca (${decoded.data}), namun data aset tidak termasuk lokasi/daftar inventaris Anda.`
              );
              stopCamera();
            }
          }
        } finally {
          busy = false;
        }
      };

      void runDecode();
    }, 160);

    return () => window.clearInterval(timer);
  }, [cameraActive, processScannedCode, stopCamera]);

  const startCameraStream = async (targetFacing: 'environment' | 'user') => {
    setCameraError('');
    setCameraStarting(true);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStarting(false);
      setCameraError(
        'Browser atau konteks halaman saat ini belum mendukung live streaming kamera (memerlukan HTTPS). Gunakan tombol "Foto QR (HP)" untuk memotret langsung dengan kamera HP.'
      );
      return;
    }

    const attempts: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { ideal: targetFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      {
        video: { facingMode: targetFacing },
        audio: false,
      },
      {
        video: true,
        audio: false,
      },
    ];

    let stream: MediaStream | null = null;
    let lastError: unknown = null;

    for (const constraints of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!stream) {
      setCameraStarting(false);
      setCameraActive(false);
      const errName =
        lastError && typeof lastError === 'object' && 'name' in lastError
          ? String((lastError as { name: string }).name)
          : '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setCameraError(
          'Izin akses kamera ditolak oleh browser/perangkat. Pastikan izin Kamera diaktifkan pada ikon gembok/pengaturan situs Chrome, atau gunakan tombol "Foto QR (HP)" di samping.'
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setCameraError(
          'Perangkat kamera tidak ditemukan. Gunakan tombol "Foto QR (HP)" atau Simulasi Bidik QR di bawah.'
        );
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        setCameraError(
          'Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi kamera lain lalu coba lagi, atau gunakan tombol "Foto QR (HP)".'
        );
      } else {
        setCameraError(
          `Kamera live belum dapat dibuka (${errName || 'pembatasan peramban'}). Gunakan tombol "Foto QR (HP)" untuk langsung membuka kamera HP.`
        );
      }
      return;
    }

    streamRef.current = stream;
    setCameraActive(true);
    setCameraStarting(false);

    if (videoRef.current) {
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.setAttribute('webkit-playsinline', 'true');
      videoRef.current.muted = true;
      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
      } catch {
        // play() will be retried in useEffect or onLoadedMetadata
      }
    }
  };

  const toggleLiveCamera = async () => {
    if (cameraActive) {
      stopCamera();
      return;
    }
    await startCameraStream(facingMode);
  };

  const handleSwitchCamera = async () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    if (cameraActive) {
      await startCameraStream(nextFacing);
    }
  };

  const handleScanFromPhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCameraError('');

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('Gagal membaca berkas foto.'));
        reader.readAsDataURL(file);
      });

      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Format gambar tidak valid.'));
        el.src = dataUrl;
      });

      const canvas = decodeCanvasRef.current ?? document.createElement('canvas');
      decodeCanvasRef.current = canvas;
      const maxDim = 1200;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const decoded = jsQR(imgData.data, imgData.width, imgData.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (!decoded?.data) {
        setCameraError(
          'QR Code tidak terdeteksi pada foto tersebut. Pastikan stiker QR terlihat jelas, fokus, dan tidak terpotong.'
        );
        return;
      }

      const found = processScannedCode(decoded.data);
      if (!found) {
        setCameraError(
          `QR terbaca ("${decoded.data}"), namun data aset tidak ditemukan pada daftar inventaris lokasi Anda.`
        );
      }
    } catch {
      setCameraError('Gagal memproses foto QR Code. Silakan coba ambil ulang.');
    }
  };

  const handleManualLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    const found = processScannedCode(manualInput);
    if (!found) {
      setOpnameFeedback(
        `Kode atau aset "${manualInput}" tidak ditemukan pada Master KIB / Kendaraan.`
      );
    }
  };

  const handleQuickOpname = (status: OpnameStatus, condition: ConditionStatus) => {
    if (!scannedAsset) return;
    const note =
      status === 'SESUAI'
        ? `Cek kondisi harian / opname via pemindai QR oleh ${roleProfile.officerName}.`
        : `Temuan perubahan kondisi saat scan QR oleh ${roleProfile.officerName}.`;
    onRecordQuickOpname(scannedAsset.id, status, condition, note);
    setOpnameFeedback(
      `Berhasil mencatat status opname "${OPNAME_STATUS_META[status].label}" untuk ${scannedAsset.id}.`
    );
  };

  const handleCopyActiveLink = async () => {
    if (!activeDetailLinks) return;
    const ok = await copyTextToClipboard(activeDetailLinks.fullUrl);
    if (ok) {
      setCopyLinkFailed(false);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopyLinkFailed(true);
      window.setTimeout(() => setCopyLinkFailed(false), 3500);
    }
  };

  const filteredTargetAssets = useMemo(() => {
    const q = targetSearch.trim().toLowerCase();
    return assets.filter((a) => {
      if (targetFilter !== 'ALL' && targetFilter !== 'KENDARAAN' && targetFilter !== 'KIR') {
        if (a.kibType !== targetFilter) return false;
      }
      if (!q) return true;
      return (
        a.id.toLowerCase().includes(q) ||
        a.namaBarang.toLowerCase().includes(q) ||
        a.kodeBarang.toLowerCase().includes(q) ||
        a.merkTipe.toLowerCase().includes(q) ||
        a.nomorPolisiOrSertifikat.toLowerCase().includes(q) ||
        `kib ${a.kibType}`.toLowerCase().includes(q)
      );
    });
  }, [assets, targetFilter, targetSearch]);

  const filteredTargetVehicles = useMemo(() => {
    const q = targetSearch.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (!q) return true;
      return (
        v.id.toLowerCase().includes(q) ||
        v.namaKendaraan.toLowerCase().includes(q) ||
        v.nomorPolisi.toLowerCase().includes(q) ||
        v.kodeBarang.toLowerCase().includes(q) ||
        v.merkTipe.toLowerCase().includes(q)
      );
    });
  }, [vehicles, targetSearch]);

  const filteredTargetRooms = useMemo(() => {
    const q = targetSearch.trim().toLowerCase();
    return rooms.filter((r) => {
      if (!q) return true;
      return (
        r.id.toLowerCase().includes(q) ||
        r.namaRuang.toLowerCase().includes(q) ||
        r.kodeRuang.toLowerCase().includes(q)
      );
    });
  }, [rooms, targetSearch]);

  const filteredTargetRoomItems = useMemo(() => {
    const q = targetSearch.trim().toLowerCase();
    return roomItems.filter((it) => {
      if (!q) return true;
      return (
        it.id.toLowerCase().includes(q) ||
        it.namaBarang.toLowerCase().includes(q) ||
        it.kodeBarang.toLowerCase().includes(q) ||
        it.merkModel.toLowerCase().includes(q)
      );
    });
  }, [roomItems, targetSearch]);

  const generatorAssets = useMemo(() => {
    const q = generatorSearch.trim().toLowerCase();
    return assets.filter((a) => {
      if (generatorLocationFilter !== 'ALL' && a.locationId !== generatorLocationFilter) {
        return false;
      }
      if (generatorKibFilter !== 'ALL' && a.kibType !== generatorKibFilter) {
        return false;
      }
      if (!q) return true;
      return (
        a.id.toLowerCase().includes(q) ||
        a.namaBarang.toLowerCase().includes(q) ||
        a.kodeBarang.toLowerCase().includes(q) ||
        a.merkTipe.toLowerCase().includes(q) ||
        a.nomorPolisiOrSertifikat.toLowerCase().includes(q)
      );
    });
  }, [assets, generatorLocationFilter, generatorKibFilter, generatorSearch]);

  const buildAllStickersHtml = async () => {
    const blocks = await Promise.all(
      generatorAssets.map((item) => {
        const { fullUrl } = buildAssetDetailUrl(item.kodeBarang, item.nomorRegister);
        return generateStickerHtmlBlock({
          id: item.id,
          kibLabel: `KIB ${item.kibType}`,
          namaBarang: item.namaBarang,
          kodeBarang: item.kodeBarang,
          nomorRegister: item.nomorRegister,
          tahunPerolehan: item.tahunPerolehan,
          locationName: locationMap.get(item.locationId)?.name ?? item.locationId,
          qrPayload: item.qrPayload,
          qrUrl: fullUrl,
        });
      })
    );
    return `<div class="sticker-grid">${blocks.join('')}</div>`;
  };

  const handlePrintAllLabels = async () => {
    setPrintingAll(true);
    try {
      const html = await buildAllStickersHtml();
      printHtmlInHiddenFrame(
        `Label QR Code SIMAS-BMD (${generatorAssets.length} Aset)`,
        html,
        STICKER_PRINT_CSS
      );
    } finally {
      setPrintingAll(false);
    }
  };

  const handleDownloadAllLabelsHtml = async () => {
    setPrintingAll(true);
    try {
      const html = await buildAllStickersHtml();
      downloadHtmlDocument(
        `Label-QR-SIMAS-BMD-${generatorLocationFilter}.html`,
        `Label QR Code SIMAS-BMD (${generatorAssets.length} Aset)`,
        html,
        STICKER_PRINT_CSS
      );
    } finally {
      setPrintingAll(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4 no-print">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            QR Code Aset &amp; Pemindai Lapangan
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Setiap kode QR memuat tautan langsung ke profil aset atau KIR ruangan untuk pemindaian kamera HP
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setSubTab('scanner')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'scanner'
                ? 'bg-white text-[#0B2545] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ScanLine className="w-3.5 h-3.5" />
            Pemindai Lapangan
          </button>
          <button
            type="button"
            onClick={() => setSubTab('generator')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'generator'
                ? 'bg-white text-[#0B2545] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            Generator &amp; Cetak Label
          </button>
        </div>
      </div>

      {subTab === 'scanner' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Panel: Camera Viewfinder & Field Trigger */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-slate-900">
                Kamera Pemindai QR (Real-Time &amp; Simulasi)
              </h3>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={cameraStarting}
                  onClick={() => void toggleLiveCamera()}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold border rounded-md cursor-pointer ${
                    cameraActive
                      ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                      : 'bg-[#0B2545] border-[#0B2545] text-white hover:bg-[#133C73]'
                  }`}
                >
                  {cameraActive ? (
                    <>
                      <CameraOff className="w-3.5 h-3.5" />
                      Matikan
                    </>
                  ) : (
                    <>
                      <Camera className="w-3.5 h-3.5" />
                      {cameraStarting ? 'Membuka...' : 'Aktifkan Kamera'}
                    </>
                  )}
                </button>
                {cameraActive && (
                  <button
                    type="button"
                    onClick={() => void handleSwitchCamera()}
                    title="Ganti kamera depan / belakang"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Putar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  title="Buka kamera HP secara langsung untuk memfoto stiker QR"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700 cursor-pointer"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  Foto QR (HP)
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => void handleScanFromPhotoFile(e)}
                  className="sr-only"
                  aria-label="Ambil foto stiker QR dengan kamera HP"
                />
              </div>
            </div>

            {/* Optical Viewfinder */}
            <div className="relative aspect-[4/3] w-full rounded-md bg-slate-950 overflow-hidden flex items-center justify-center border border-slate-800">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={(e) => {
                  void e.currentTarget.play().catch(() => {});
                }}
                className={
                  cameraActive ? 'w-full h-full object-cover' : 'hidden'
                }
              />

              {!cameraActive && (
                <div className="flex flex-col items-center justify-center p-5 text-center space-y-3">
                  {activeDetailLinks ? (
                    <div className="p-2.5 bg-white rounded-md shadow-sm">
                      <QrCodeImage value={activeDetailLinks.fullUrl} size={124} />
                    </div>
                  ) : (
                    <QrCode className="w-16 h-16 text-slate-600" />
                  )}
                  <p className="font-mono text-[11px] text-slate-300 break-all px-2">
                    {isScanningAnim
                      ? 'Membaca tautan QR SIMAS-BMD...'
                      : activeDetailLinks
                        ? activeDetailLinks.pathUrl
                        : 'Arahkan kamera ke stiker QR aset'}
                  </p>
                </div>
              )}

              {cameraActive && (
                <div className="pointer-events-none absolute top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded bg-slate-900/80 text-emerald-300 text-[11px] font-semibold whitespace-nowrap">
                  Kamera Aktif · Arahkan ke Stiker QR
                </div>
              )}

              {/* Reticle Frame */}
              <div className="pointer-events-none absolute inset-6 border border-white/20 rounded-sm">
                <div className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-2 border-l-2 border-amber-400" />
                <div className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-2 border-r-2 border-amber-400" />
                <div className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-2 border-l-2 border-amber-400" />
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-2 border-r-2 border-amber-400" />
              </div>
            </div>

            {/* Link Hasil Scan Box — ALWAYS displays clickable URL immediately */}
            {activeDetailLinks && (
              <div className="p-3 rounded-md bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#0B2545] flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Tautan Hasil Pemindaian QR:
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopyActiveLink()}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-[#0B2545] cursor-pointer"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-700" />
                        Disalin
                      </>
                    ) : copyLinkFailed ? (
                      <>
                        <Copy className="w-3 h-3 text-amber-700" />
                        Salin manual di bawah
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Salin URL
                      </>
                    )}
                  </button>
                </div>

                <a
                  href={activeDetailLinks.pathUrl}
                  onClick={(e) => {
                    e.preventDefault();
                    if (scannedRoomLink && onOpenRoomProfile) {
                      onOpenRoomProfile(scannedRoomLink.id);
                    } else {
                      onOpenPublicProfile(activeKode, activeRegister);
                    }
                  }}
                  className="block font-mono text-[11px] text-[#0B2545] underline break-all hover:text-[#17467E]"
                >
                  {activeDetailLinks.fullUrl}
                </a>

                {copyLinkFailed && (
                  <input
                    type="text"
                    readOnly
                    value={activeDetailLinks.fullUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full px-2 py-1 text-[11px] font-mono bg-white border border-amber-300 rounded text-slate-800"
                    aria-label="Salin URL QR secara manual"
                  />
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (scannedRoomLink && onOpenRoomProfile) {
                      onOpenRoomProfile(scannedRoomLink.id);
                    } else {
                      onOpenPublicProfile(activeKode, activeRegister);
                    }
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {scannedRoomLink
                    ? `Buka Profil KIR Ruangan (${scannedRoomLink.kodeRuang})`
                    : 'Buka Halaman Profil Aset'}
                </button>
              </div>
            )}

            {lastDecodedRaw && (
              <p className="font-mono text-[11px] text-slate-500 truncate">
                Terbaca terakhir: {lastDecodedRaw}
              </p>
            )}

            {cameraError && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2.5">
                {cameraError}
              </p>
            )}

            {/* Manual Payload Lookup */}
            <form onSubmit={handleManualLookup} className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Cari / Masukkan Payload QR, Kode Barang KIB A–F, URL, atau Plat Nomor
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Kode KIB, ID Aset, URL QR, Nama Barang, atau W 9808 NP"
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-[#0B2545]"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md cursor-pointer shrink-0"
                >
                  Pindai
                </button>
              </div>
            </form>

            {/* Quick Simulation Targets — ALL KIB A-F, Vehicles & KIR Rooms */}
            <div className="pt-3 border-t border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-700">
                  Pilih Semua Barang / KIB / Ruangan ({assets.length} KIB · {vehicles.length} Kendaraan · {rooms.length} Ruang):
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={targetFilter}
                  onChange={(e) => setTargetFilter(e.target.value as TargetCategoryFilter)}
                  aria-label="Filter kategori KIB atau jenis barang"
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-800"
                >
                  <option value="ALL">Semua KIB &amp; Barang ({assets.length})</option>
                  <option value="A">KIB A · Tanah ({assets.filter((a) => a.kibType === 'A').length})</option>
                  <option value="B">KIB B · Peralatan &amp; Mesin ({assets.filter((a) => a.kibType === 'B').length})</option>
                  <option value="C">KIB C · Gedung &amp; Bangunan ({assets.filter((a) => a.kibType === 'C').length})</option>
                  <option value="D">KIB D · Jalan, Irigasi &amp; Jaringan ({assets.filter((a) => a.kibType === 'D').length})</option>
                  <option value="E">KIB E · Aset Tetap Lainnya ({assets.filter((a) => a.kibType === 'E').length})</option>
                  <option value="F">KIB F · Konstruksi dlm Pengerjaan ({assets.filter((a) => a.kibType === 'F').length})</option>
                  <option value="KENDARAAN">Inventaris Kendaraan ({vehicles.length})</option>
                  <option value="KIR">KIR Ruangan &amp; Barang Ruang ({rooms.length + roomItems.length})</option>
                </select>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={targetSearch}
                    onChange={(e) => setTargetSearch(e.target.value)}
                    placeholder="Filter nama / kode / plat..."
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1.5 max-h-60 overflow-y-auto pr-1">
                {targetFilter !== 'KENDARAAN' &&
                  targetFilter !== 'KIR' &&
                  filteredTargetAssets.map((item) => {
                    const isSelected =
                      !scannedCustomLink &&
                      !scannedRoomLink &&
                      !scannedRoomItem &&
                      item.id === scannedAssetId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => triggerSimulatedScan(item.id)}
                        className={`text-left px-3 py-2 rounded-md border text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-[#0B2545] text-white border-[#0B2545]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="truncate font-medium">
                          <span className="font-mono mr-1.5">{item.id}</span>
                          {item.namaBarang}
                        </span>
                        <span
                          className={`font-mono text-[11px] shrink-0 ${
                            isSelected ? 'text-amber-300' : 'text-slate-500'
                          }`}
                        >
                          KIB {item.kibType}
                        </span>
                      </button>
                    );
                  })}

                {(targetFilter === 'KENDARAAN' ||
                  (targetFilter === 'ALL' && targetSearch.trim().length > 0)) &&
                  filteredTargetVehicles.map((veh) => {
                    const isSelected =
                      Boolean(scannedCustomLink) &&
                      scannedVehicle?.id === veh.id &&
                      !scannedAsset;
                    return (
                      <button
                        key={veh.id}
                        type="button"
                        onClick={() => selectVehicleTarget(veh)}
                        className={`text-left px-3 py-2 rounded-md border text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-[#0B2545] text-white border-[#0B2545]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="truncate font-medium">
                          <span className="font-mono mr-1.5">{veh.id}</span>
                          {veh.namaKendaraan} ({veh.nomorPolisi})
                        </span>
                        <span
                          className={`font-mono text-[11px] shrink-0 ${
                            isSelected ? 'text-amber-300' : 'text-slate-500'
                          }`}
                        >
                          Kendaraan
                        </span>
                      </button>
                    );
                  })}

                {(targetFilter === 'KIR' ||
                  (targetFilter === 'ALL' && targetSearch.trim().length > 0)) && (
                  <>
                    {filteredTargetRooms.map((rm) => {
                      const isSelected = scannedRoomLink?.id === rm.id;
                      return (
                        <button
                          key={rm.id}
                          type="button"
                          onClick={() => selectRoomTarget(rm)}
                          className={`text-left px-3 py-2 rounded-md border text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-[#0B2545] text-white border-[#0B2545]'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span className="truncate font-medium">
                            <span className="font-mono mr-1.5">{rm.kodeRuang}</span>
                            {rm.namaRuang}
                          </span>
                          <span
                            className={`font-mono text-[11px] shrink-0 ${
                              isSelected ? 'text-amber-300' : 'text-slate-500'
                            }`}
                          >
                            KIR Ruang
                          </span>
                        </button>
                      );
                    })}
                    {filteredTargetRoomItems.map((it) => {
                      const isSelected = scannedRoomItem?.item.id === it.id;
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => selectRoomItemTarget(it)}
                          className={`text-left px-3 py-2 rounded-md border text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-[#0B2545] text-white border-[#0B2545]'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span className="truncate font-medium">
                            <span className="font-mono mr-1.5">{it.id}</span>
                            {it.namaBarang}
                          </span>
                          <span
                            className={`font-mono text-[11px] shrink-0 ${
                              isSelected ? 'text-amber-300' : 'text-slate-500'
                            }`}
                          >
                            KIR Barang
                          </span>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: Real-time Inspection Result & Field Actions */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-5">
            {!scannedAsset &&
            !scannedVehicle &&
            !scannedRoomLink &&
            !scannedRoomItem &&
            !scannedCustomLink ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Pilih atau pindai kode QR aset, KIB A–F, kendaraan, atau KIR ruangan untuk menampilkan informasi real-time.
              </div>
            ) : scannedRoomItem ? (
              <div className="space-y-4 text-xs">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <p className="font-mono font-semibold text-[#0B2545]">
                      BARANG KIR RUANGAN · {scannedRoomItem.item.id} · Reg.{' '}
                      {scannedRoomItem.item.nomorRegister}
                    </p>
                    <h3 className="font-display text-lg font-bold text-slate-900 mt-1">
                      {scannedRoomItem.item.namaBarang}
                    </h3>
                    <p className="text-slate-600 mt-0.5">
                      {scannedRoomItem.item.merkModel} · Tahun {scannedRoomItem.item.tahunPerolehan}
                    </p>
                  </div>
                  <ConditionIndicator condition={scannedRoomItem.item.kondisi} />
                </div>
                {opnameFeedback && (
                  <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
                    {opnameFeedback}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-500 block">Kode Barang Permendagri</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {scannedRoomItem.item.kodeBarang}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Jumlah</span>
                    <span className="font-semibold text-slate-900">
                      {scannedRoomItem.item.jumlah} {scannedRoomItem.item.satuan}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Ruangan Terdaftar</span>
                    <span className="font-semibold text-slate-900">
                      {scannedRoomItem.room?.namaRuang ?? scannedRoomItem.item.roomId}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Keterangan</span>
                    <span className="text-slate-800">
                      {scannedRoomItem.item.keterangan || '-'}
                    </span>
                  </div>
                </div>
                {onOpenRoomProfile && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenRoomProfile(
                        scannedRoomItem.room?.id ?? scannedRoomItem.item.roomId
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Buka Profil KIR Ruangan
                  </button>
                )}
              </div>
            ) : scannedRoomLink ? (
              <div className="space-y-4 text-xs">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <p className="font-mono font-semibold text-[#0B2545]">
                      KIR RUANGAN · {scannedRoomLink.kodeRuang}
                    </p>
                    <h3 className="font-display text-lg font-bold text-slate-900 mt-1">
                      {scannedRoomLink.namaRuang}
                    </h3>
                    <p className="text-slate-600 mt-0.5">
                      {locationMap.get(scannedRoomLink.locationId)?.name ??
                        scannedRoomLink.lantaiGedung}
                    </p>
                  </div>
                </div>
                <p className="text-slate-600">
                  Penanggung Jawab: <strong>{scannedRoomLink.penanggungJawab}</strong>
                </p>
                {onOpenRoomProfile && (
                  <button
                    type="button"
                    onClick={() => onOpenRoomProfile(scannedRoomLink.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Buka Halaman Profil KIR Ruangan
                  </button>
                )}
              </div>
            ) : scannedCustomLink && !scannedAsset && scannedVehicle ? (
              <div className="space-y-4 text-xs">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <p className="font-mono font-semibold text-[#0B2545]">
                      {scannedVehicle.id} · {scannedVehicle.nomorPolisi}
                    </p>
                    <h3 className="font-display text-lg font-bold text-slate-900 mt-1">
                      {scannedVehicle.namaKendaraan}
                    </h3>
                    <p className="text-slate-600 mt-0.5">{scannedVehicle.merkTipe}</p>
                  </div>
                  <ConditionIndicator condition={scannedVehicle.kondisi} />
                </div>
                {scannedVehicle.fotoDataUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxPhoto({
                        title: `${scannedVehicle.namaKendaraan} · ${scannedVehicle.nomorPolisi}`,
                        subtitle: scannedVehicle.merkTipe,
                        dataUrl: scannedVehicle.fotoDataUrl!,
                        fileName: scannedVehicle.fotoNamaFile,
                      })
                    }
                    className="w-full sm:w-56 h-36 rounded-md border border-slate-300 bg-slate-50 overflow-hidden cursor-pointer hover:border-[#0B2545]"
                  >
                    <img
                      src={scannedVehicle.fotoDataUrl}
                      alt={scannedVehicle.namaKendaraan}
                      className="w-full h-full object-cover"
                    />
                  </button>
                )}
                <p className="text-slate-600">
                  Klik tombol di bawah untuk membuka halaman profil kendaraan lengkap beserta status pajak, BPKB, hibah, dan riwayat servis.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    onOpenPublicProfile(
                      scannedVehicle.kodeBarang,
                      scannedVehicle.nomorRegister
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Buka Halaman Profil Kendaraan
                </button>
              </div>
            ) : scannedCustomLink && !scannedAsset ? (
              <div className="space-y-4 text-xs">
                <div className="border-b border-slate-200 pb-4">
                  <p className="font-mono font-semibold text-[#0B2545]">
                    QR KODE BARANG / KIB · {scannedCustomLink.kode}
                    {scannedCustomLink.register ? ` · Reg. ${scannedCustomLink.register}` : ''}
                  </p>
                  <h3 className="font-display text-lg font-bold text-slate-900 mt-1">
                    {scannedCustomLink.label}
                  </h3>
                </div>
                {opnameFeedback && (
                  <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
                    {opnameFeedback}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() =>
                    onOpenPublicProfile(
                      scannedCustomLink.kode,
                      scannedCustomLink.register
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] rounded-md cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Buka Halaman Profil Aset
                </button>
              </div>
            ) : (
              scannedAsset && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <p className="font-mono text-xs font-semibold text-[#0B2545]">
                        KIB {scannedAsset.kibType} · {scannedAsset.id} · Reg.{' '}
                        {scannedAsset.nomorRegister}
                      </p>
                      <h3 className="font-display text-lg font-bold text-slate-900 mt-1">
                        {scannedAsset.namaBarang}
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {scannedAsset.merkTipe} · {scannedAsset.nomorPolisiOrSertifikat}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <ConditionIndicator condition={scannedAsset.kondisi} />
                      <p className="font-mono text-xs font-semibold text-slate-900 mt-1 tabular-nums sm:text-right">
                        {formatIDR(scannedAsset.nilaiPerolehan)}
                      </p>
                    </div>
                  </div>

                  {opnameFeedback && (
                    <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
                      {opnameFeedback}
                    </div>
                  )}

                  {(scannedAsset.fotoDataUrl || scannedVehicle?.fotoDataUrl) && (
                    <div className="p-3 rounded-md bg-slate-50 border border-slate-200 flex items-center gap-3.5 text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxPhoto({
                            title: scannedAsset.namaBarang,
                            subtitle: `${scannedAsset.id} · ${scannedAsset.kodeBarang}`,
                            dataUrl:
                              scannedAsset.fotoDataUrl || scannedVehicle?.fotoDataUrl || '',
                            fileName:
                              scannedAsset.fotoNamaFile || scannedVehicle?.fotoNamaFile,
                          })
                        }
                        className="w-24 h-20 rounded border border-slate-300 bg-white overflow-hidden shrink-0 cursor-pointer hover:border-[#0B2545]"
                      >
                        <img
                          src={scannedAsset.fotoDataUrl || scannedVehicle?.fotoDataUrl}
                          alt={scannedAsset.namaBarang}
                          className="w-full h-full object-cover"
                        />
                      </button>
                      <div className="min-w-0 space-y-1">
                        <p className="font-semibold text-slate-800">Foto Fisik Aset Terlampir</p>
                        <p className="text-[11px] text-slate-500">
                          Klik thumbnail untuk memperbesar foto barang saat inspeksi lapangan.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-2">
                      <div>
                        <span className="text-slate-500 block">
                          Lokasi Penempatan Saat Ini
                        </span>
                        <span className="font-semibold text-slate-900">
                          {locationMap.get(scannedAsset.locationId)?.name ??
                            scannedAsset.locationId}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Penanggung Jawab Unit</span>
                        <span className="font-medium text-slate-900">
                          {scannedAsset.penanggungJawab}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <span className="text-slate-500 block">Status Opname Terakhir</span>
                        <span className="font-semibold text-slate-900">
                          {OPNAME_STATUS_META[scannedAsset.lastOpnameStatus].label} ·{' '}
                          {formatDateID(scannedAsset.lastOpnameDate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">
                          Kode Barang Permendagri
                        </span>
                        <span className="font-mono font-medium text-slate-900 tabular-nums">
                          {scannedAsset.kodeBarang}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Field Actions (RBAC-aware) */}
                  <div className="border-t border-slate-200 pt-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-800">
                      Aksi Cek Lapangan &amp; Opname Cepat
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {roleProfile.id === 'SUPER_ADMIN' &&
                        roleProfile.permissions.canPerformOpname && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleQuickOpname('SESUAI', 'BAIK')}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Verifikasi Fisik Ada &amp; Baik
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickOpname('KONDISI_BERUBAH', 'RUSAK_RINGAN')
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-md cursor-pointer"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Tandai Rusak Ringan
                          </button>
                        </>
                      )}
                      {roleProfile.permissions.canReportDamage && (
                        <button
                          type="button"
                          onClick={() => onQuickNavigateToDamage(scannedAsset.id)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 bg-white border border-red-300 hover:bg-red-50 rounded-md cursor-pointer"
                        >
                          Buat Laporan Kerusakan
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          onOpenPublicProfile(
                            scannedAsset.kodeBarang,
                            scannedAsset.nomorRegister
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0B2545] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Buka Halaman Profil Aset
                      </button>
                    </div>
                  </div>

                  {/* Historical Audit Trail */}
                  <div className="border-t border-slate-200 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="font-semibold text-slate-800 mb-2">
                        Riwayat Mutasi ({assetMutations.length})
                      </p>
                      {assetMutations.length === 0 ? (
                        <p className="text-slate-500">
                          Belum pernah dimutasi dari lokasi awal.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {assetMutations.map((m) => (
                            <li key={m.id} className="border-b border-slate-100 pb-1.5">
                              <p className="font-medium text-slate-800">
                                {locationMap.get(m.fromLocationId)?.code} →{' '}
                                {locationMap.get(m.toLocationId)?.code}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {formatDateID(m.requestDate)} · {m.nomorSurat}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <p className="font-semibold text-slate-800 mb-2">
                        Riwayat Kerusakan ({assetDamages.length})
                      </p>
                      {assetDamages.length === 0 ? (
                        <p className="text-slate-500">
                          Tidak ada riwayat kerusakan tercatat.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {assetDamages.map((d) => (
                            <li key={d.id} className="border-b border-slate-100 pb-1.5">
                              <p className="font-medium text-slate-800">
                                {d.ticketNumber} · {DAMAGE_STATUS_META[d.status].label}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {formatDateID(d.reportDate)} ·{' '}
                                {d.chronology.slice(0, 72)}...
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      ) : (
        /* Generator & Cetak Label Massal */
        <div className="space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg p-4 no-print">
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                id="qr-loc-filter"
                value={lockedLocationId || generatorLocationFilter}
                disabled={Boolean(lockedLocationId)}
                onChange={(e) => setGeneratorLocationFilter(e.target.value)}
                aria-label="Filter lokasi stiker QR"
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white disabled:bg-slate-100 disabled:text-slate-700"
              >
                {!lockedLocationId && (
                  <option value="ALL">Semua Lokasi ({assets.length} Barang)</option>
                )}
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} · {l.name}
                  </option>
                ))}
              </select>
              <select
                value={generatorKibFilter}
                onChange={(e) =>
                  setGeneratorKibFilter(e.target.value as 'ALL' | KibCategory)
                }
                aria-label="Filter kategori KIB stiker QR"
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-800"
              >
                <option value="ALL">Semua KIB A–F</option>
                <option value="A">KIB A (Tanah)</option>
                <option value="B">KIB B (Peralatan &amp; Mesin)</option>
                <option value="C">KIB C (Gedung &amp; Bangunan)</option>
                <option value="D">KIB D (Jalan, Irigasi &amp; Jaringan)</option>
                <option value="E">KIB E (Aset Tetap Lainnya)</option>
                <option value="F">KIB F (Konstruksi dlm Pengerjaan)</option>
              </select>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={generatorSearch}
                  onChange={(e) => setGeneratorSearch(e.target.value)}
                  placeholder="Cari barang / kode KIB..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md w-48"
                />
              </div>
            </div>
            {roleProfile.permissions.canPrintQr && (
              <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
                <button
                  type="button"
                  disabled={printingAll || generatorAssets.length === 0}
                  onClick={() => void handlePrintAllLabels()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] disabled:opacity-50 rounded-md cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {printingAll
                    ? 'Menyiapkan...'
                    : `Cetak Semua Label (${generatorAssets.length})`}
                </button>
                <button
                  type="button"
                  disabled={printingAll || generatorAssets.length === 0}
                  onClick={() => void handleDownloadAllLabelsHtml()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-md cursor-pointer"
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  Unduh File Cetak (.html)
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {generatorAssets.map((item) => (
              <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-4">
                <PrintableQrSticker
                  asset={item}
                  locationName={locationMap.get(item.locationId)?.name ?? item.locationId}
                  canPrint={roleProfile.permissions.canPrintQr}
                  onOpenPublicProfile={onOpenPublicProfile}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      <PhotoLightboxModal
        photo={lightboxPhoto}
        onClose={() => setLightboxPhoto(null)}
      />
    </div>
  );
};
