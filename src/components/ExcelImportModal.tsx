import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from 'lucide-react';
import {
  ParsedWorkbookData,
  autoMatchColumns,
  detectHeaderAndRows,
  parseExcelOrCsvFile,
} from '../utils/excelImportHelper';

export interface ExcelFieldDefinition {
  key: string;
  label: string;
  required: boolean;
}

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  fieldDefinitions: readonly ExcelFieldDefinition[];
  fieldAliases: Record<string, string[]>;
  onDownloadTemplate: () => void;
  extraOptions?: React.ReactNode;
  onConfirmImport: (
    rows: string[][],
    mapping: Record<string, number>
  ) => { importedCount: number; message?: string };
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  fieldDefinitions,
  fieldAliases,
  onDownloadTemplate,
  extraOptions,
  onConfirmImport,
}) => {
  const [workbook, setWorkbook] = useState<ParsedWorkbookData | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [manualHeaderRow, setManualHeaderRow] = useState<number | undefined>(undefined);
  const [columnMapping, setColumnMapping] = useState<Record<string, number>>({});
  const [loadingFile, setLoadingFile] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [importSuccess, setImportSuccess] = useState<string>('');

  const sheetMatrix = useMemo(() => {
    if (!workbook || !activeSheet) return [];
    return workbook.sheets[activeSheet] ?? [];
  }, [workbook, activeSheet]);

  const detectedTable = useMemo(
    () => detectHeaderAndRows(sheetMatrix, manualHeaderRow),
    [sheetMatrix, manualHeaderRow]
  );

  const resetState = () => {
    setWorkbook(null);
    setActiveSheet('');
    setManualHeaderRow(undefined);
    setColumnMapping({});
    setErrorMsg('');
    setImportSuccess('');
  };

  const applySheetDetection = (
    matrix: string[][],
    overrideRow?: number
  ) => {
    const detected = detectHeaderAndRows(matrix, overrideRow);
    setManualHeaderRow(detected.headerRowIndex);
    setColumnMapping(autoMatchColumns(detected.headers, fieldAliases));
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');
    setImportSuccess('');
    setLoadingFile(true);
    try {
      const parsed = await parseExcelOrCsvFile(file);
      if (parsed.sheetNames.length === 0) {
        setErrorMsg('Berkas Excel/CSV tidak memiliki baris data yang dapat dibaca.');
        setWorkbook(null);
        return;
      }
      const firstSheet = parsed.sheetNames[0];
      setWorkbook(parsed);
      setActiveSheet(firstSheet);
      applySheetDetection(parsed.sheets[firstSheet] ?? []);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Gagal membaca berkas Excel/CSV. Pastikan format .xlsx, .xls, atau .csv valid.'
      );
    } finally {
      setLoadingFile(false);
      e.target.value = '';
    }
  };

  const handleSheetChange = (sheetName: string) => {
    setActiveSheet(sheetName);
    setImportSuccess('');
    if (workbook) {
      applySheetDetection(workbook.sheets[sheetName] ?? []);
    }
  };

  const handleHeaderRowChange = (oneBasedRow: number) => {
    const zeroBased = Math.max(0, Math.min(sheetMatrix.length - 1, oneBasedRow - 1));
    setManualHeaderRow(zeroBased);
    const detected = detectHeaderAndRows(sheetMatrix, zeroBased);
    setColumnMapping(autoMatchColumns(detected.headers, fieldAliases));
  };

  const missingRequiredFields = useMemo(
    () =>
      fieldDefinitions.filter(
        (f) => f.required && (columnMapping[f.key] === undefined || columnMapping[f.key] < 0)
      ),
    [fieldDefinitions, columnMapping]
  );

  const previewFields = useMemo(
    () => fieldDefinitions.slice(0, 6),
    [fieldDefinitions]
  );

  const previewRows = useMemo(
    () => detectedTable.rows.slice(0, 5),
    [detectedTable.rows]
  );

  const handleExecuteImport = () => {
    if (!workbook || detectedTable.rows.length === 0) return;
    if (missingRequiredFields.length > 0) {
      setErrorMsg(
        `Kolom wajib belum dipetakan: ${missingRequiredFields.map((f) => f.label).join(', ')}.`
      );
      return;
    }
    setErrorMsg('');
    const result = onConfirmImport(detectedTable.rows, columnMapping);
    if (result.importedCount <= 0) {
      setErrorMsg(
        'Tidak ada baris valid yang berhasil diimpor. Periksa kembali pemetaan kolom dan baris header tabel.'
      );
      return;
    }
    setImportSuccess(
      result.message ||
        `Berhasil mengimpor ${result.importedCount} baris data dari "${workbook.fileName}" ke SIMAS-BMD.`
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 overflow-y-auto no-print">
      <div className="bg-white border border-slate-200 rounded-lg max-w-4xl w-full shadow-2xl my-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 bg-[#0B2545] text-white">
          <div className="flex items-start gap-3">
            <FileSpreadsheet className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-display text-base font-bold">{title}</h3>
              <p className="text-xs text-slate-300 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              resetState();
              onClose();
            }}
            className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
            aria-label="Tutup modal import Excel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs max-h-[80vh] overflow-y-auto">
          {/* Step 1: Upload File & Download Template */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
            <label className="md:col-span-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border-2 border-dashed border-slate-300 hover:border-[#0B2545] bg-slate-50 cursor-pointer">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-md bg-[#0B2545]/10 text-[#0B2545] flex items-center justify-center shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">
                    {loadingFile
                      ? 'Membaca berkas Excel/CSV...'
                      : workbook
                        ? `Berkas aktif: ${workbook.fileName}`
                        : 'Pilih Berkas Excel / CSV (.xlsx, .xls, .csv)'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Mendukung ekspor SIMBADA, e-BMD, SIPD Aset, SIMAK-BMN, BAST CSV, atau format kustom
                  </p>
                </div>
              </div>
              <span className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0B2545] rounded shrink-0 self-start sm:self-auto">
                Pilih File
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={(e) => void handleFileSelected(e)}
                className="sr-only"
              />
            </label>

            <div className="md:col-span-4 p-4 rounded-lg border border-slate-200 bg-white flex flex-col justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">Butuh Contoh Format?</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Unduh template Excel (.xlsx) resmi agar kolom langsung terpetakan otomatis.
                </p>
              </div>
              <button
                type="button"
                onClick={onDownloadTemplate}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0B2545] bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh Template (.xlsx)
              </button>
            </div>
          </div>

          {extraOptions && (
            <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200">
              {extraOptions}
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {importSuccess && (
            <div className="p-3.5 rounded-md bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{importSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetState();
                  onClose();
                }}
                className="px-3 py-1 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded cursor-pointer shrink-0"
              >
                Selesai &amp; Tutup
              </button>
            </div>
          )}

          {workbook && (
            <>
              {/* Step 2: Sheet & Header Row Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-md bg-slate-50 border border-slate-200">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Lembar Kerja (Sheet)
                  </label>
                  <select
                    value={activeSheet}
                    onChange={(e) => handleSheetChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md"
                  >
                    {workbook.sheetNames.map((name) => (
                      <option key={name} value={name}>
                        {name} ({workbook.sheets[name]?.length ?? 0} baris)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Baris Header Kolom (Otomatis / Ubah)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, sheetMatrix.length)}
                    value={(detectedTable.headerRowIndex ?? 0) + 1}
                    onChange={(e) => handleHeaderRowChange(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-mono"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <div className="px-3 py-2 rounded-md bg-white border border-slate-200 text-slate-700 tabular-nums">
                    Terdeteksi:{' '}
                    <strong className="text-[#0B2545]">
                      {detectedTable.headers.length} kolom
                    </strong>{' '}
                    ·{' '}
                    <strong className="text-emerald-700">
                      {detectedTable.rows.length} baris data
                    </strong>
                  </div>
                </div>
              </div>

              {/* Step 3: Column Mapping */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-display text-xs font-bold uppercase tracking-wider text-[#0B2545]">
                    Pemetaan Kolom Sumber Excel → SIMAS-BMD
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Kolom bertanda * wajib dipetakan
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-3 rounded-md border border-slate-200 bg-slate-50/70">
                  {fieldDefinitions.map((field) => {
                    const currentIdx = columnMapping[field.key] ?? -1;
                    return (
                      <div
                        key={field.key}
                        className="bg-white p-2.5 rounded border border-slate-200 space-y-1"
                      >
                        <label className="block font-semibold text-slate-800 text-[11px]">
                          {field.label}{' '}
                          {field.required && <span className="text-red-600">*</span>}
                        </label>
                        <select
                          value={currentIdx}
                          onChange={(e) =>
                            setColumnMapping((prev) => ({
                              ...prev,
                              [field.key]: Number(e.target.value),
                            }))
                          }
                          className={`w-full px-2 py-1.5 text-[11px] border rounded ${
                            currentIdx >= 0
                              ? 'border-emerald-300 bg-emerald-50/40 text-slate-900 font-medium'
                              : field.required
                                ? 'border-red-300 bg-red-50/40 text-slate-600'
                                : 'border-slate-300 text-slate-500'
                          }`}
                        >
                          <option value={-1}>-- Abaikan / Nilai Default --</option>
                          {detectedTable.headers.map((header, idx) => (
                            <option key={`${header}-${idx}`} value={idx}>
                              Kolom {idx + 1}: {header}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 4: Live Preview */}
              <div className="space-y-2">
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-[#0B2545]">
                  Pratinjau 5 Baris Pertama Hasil Pemetaan
                </h4>
                <div className="overflow-x-auto border border-slate-200 rounded-md">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                        <th className="py-2 px-3 w-10 text-center">#</th>
                        {previewFields.map((f) => (
                          <th key={f.key} className="py-2 px-3 whitespace-nowrap">
                            {f.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {previewRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={previewFields.length + 1}
                            className="py-6 text-center text-slate-500"
                          >
                            Tidak ada baris data setelah baris header.
                          </td>
                        </tr>
                      ) : (
                        previewRows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-center font-mono text-slate-500">
                              {rIdx + 1}
                            </td>
                            {previewFields.map((f) => {
                              const colIdx = columnMapping[f.key] ?? -1;
                              const val = colIdx >= 0 ? row[colIdx] || '-' : '—';
                              return (
                                <td
                                  key={f.key}
                                  className="py-2 px-3 max-w-[180px] truncate text-slate-800"
                                  title={val}
                                >
                                  {val}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            {workbook
              ? `Siap memproses ${detectedTable.rows.length} baris ke modul aktif.`
              : 'Unggah file .xlsx, .xls, atau .csv untuk memulai.'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                resetState();
                onClose();
              }}
              className="px-4 py-2 font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              disabled={!workbook || detectedTable.rows.length === 0}
              onClick={handleExecuteImport}
              className="inline-flex items-center gap-1.5 px-4 py-2 font-semibold text-white bg-[#0B2545] hover:bg-[#133C73] disabled:opacity-45 rounded-md cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Impor {detectedTable.rows.length > 0 ? `${detectedTable.rows.length} ` : ''}Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
