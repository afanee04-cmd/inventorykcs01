import React, { useState } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  FileText, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Check, 
  Loader2, 
  ExternalLink,
  Layers,
  ArrowRight,
  RotateCcw,
  Trash2,
  Edit2
} from 'lucide-react';
import { DrugItem, GasConfig, SourceType, SubWarehouse } from '../types/inventory';
import { parseExcelFile, downloadExcelTemplate, fileToBase64, ParsedImportRow } from '../services/fileParser';
import { GasApiService } from '../services/gasApiService';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportDrugs: (drugs: DrugItem[]) => void;
  gasConfig?: GasConfig;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportDrugs,
  gasConfig = {
    sheetId: '17Ja3Q7hKMt01AxGDhYbCkpE9RMHHCjIbf_aVEvqFROc',
    scriptUrl: '',
    folderId: '1O8MiCSQ43f2aoI7HvcPPY4EM97szYqlb',
    autoSync: false,
    lastSyncTime: null,
  },
}) => {
  const [activeTab, setActiveTab] = useState<'excel' | 'pdf'>('excel');
  
  // Excel state
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [excelError, setExcelError] = useState<string>('');

  // PDF state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [pdfUploadResult, setPdfUploadResult] = useState<{ url?: string; name?: string } | null>(null);
  const [pdfError, setPdfError] = useState<string>('');

  // Quick form for registering item from PDF
  const [pdfItemForm, setPdfItemForm] = useState({
    name: '',
    shelf: 'A1-01',
    lot: '',
    company: 'องค์การเภสัชกรรม (GPO)',
    source: 'GPO' as const,
    subWarehouse: 'OPD' as const,
    expiryDate: '',
    quantity: 100,
    unit: 'เม็ด',
    packageUnit: '10x10 เม็ด/กล่อง',
    min: 50,
    max: 1000,
  });

  if (!isOpen) return null;

  // Handle Excel file selection
  const handleExcelDrop = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFile(file);
    setIsParsingExcel(true);
    setExcelError('');

    try {
      const rows = await parseExcelFile(file);
      setParsedRows(rows);
      // เลือกเฉพาะแถวที่ valid โดยอัตโนมัติ
      const validIndices = new Set<number>();
      rows.forEach((r, idx) => {
        if (r.isValid) validIndices.add(idx);
      });
      setSelectedIndices(validIndices);
    } catch (err: any) {
      setExcelError('เกิดข้อผิดพลาดในการอ่านไฟล์ Excel: ' + (err.message || 'รูปแบบไฟล์ไม่ถูกต้อง'));
    } finally {
      setIsParsingExcel(false);
    }
  };

  const toggleSelectRow = (index: number) => {
    const updated = new Set(selectedIndices);
    if (updated.has(index)) {
      updated.delete(index);
    } else {
      updated.add(index);
    }
    setSelectedIndices(updated);
  };

  const toggleSelectAll = () => {
    if (selectedIndices.size === parsedRows.length) {
      setSelectedIndices(new Set());
    } else {
      const all = new Set<number>();
      parsedRows.forEach((_, i) => all.add(i));
      setSelectedIndices(all);
    }
  };

  // เคลียร์ข้อมูล Excel ที่อ่านเข้ามา เพื่อเลือกไฟล์ใหม่ได้ทันที
  const handleClearExcel = () => {
    setExcelFile(null);
    setParsedRows([]);
    setSelectedIndices(new Set());
    setExcelError('');
  };

  // แก้ไขข้อมูลแต่ละแถวในตารางพรีวิวได้ทันที
  const handleUpdateRowField = (index: number, field: keyof ParsedImportRow, value: any) => {
    setParsedRows((prev) => {
      const next = [...prev];
      const updated = { ...next[index], [field]: value };
      // อัปเดตสถานะความถูกต้อง
      const hasName = Boolean(updated.name && String(updated.name).trim());
      const hasExpiry = Boolean(updated.expiryDate && String(updated.expiryDate).trim());
      updated.isValid = hasName && hasExpiry && updated.quantity >= 0;

      if (!hasName) updated.validationError = 'ไม่มีชื่อยา';
      else if (!hasExpiry) updated.validationError = 'ไม่มีวันหมดอายุ';
      else if (updated.quantity < 0) updated.validationError = 'จำนวนคงเหลือติดลบ';
      else updated.validationError = undefined;

      next[index] = updated;
      return next;
    });
  };

  // ลบแถวที่ไม่ต้องการออกจากพรีวิวก่อนนำเข้า
  const handleDeletePreviewRow = (index: number) => {
    setParsedRows((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndices((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  };

  // ปรับเปลี่ยนคลังย่อย (OPD/IPD/ER/คลังใหญ่) ของรายการที่เลือกพร้อมกันทีเดียว
  const handleBatchChangeSubWarehouse = (targetWh: SubWarehouse) => {
    if (selectedIndices.size === 0) return;
    setParsedRows((prev) =>
      prev.map((r, i) => (selectedIndices.has(i) ? { ...r, subWarehouse: targetWh } : r))
    );
  };

  const handleConfirmImportExcel = () => {
    const itemsToAdd: DrugItem[] = [];
    const timestamp = Date.now();

    parsedRows.forEach((row, idx) => {
      if (selectedIndices.has(idx)) {
        itemsToAdd.push({
          id: row.id || `KCS-IMP-${timestamp.toString().slice(-4)}-${idx + 1}`,
          name: row.name,
          shelf: row.shelf || 'ทั่วไป',
          lot: row.lot || 'N/A',
          company: row.company || 'ไม่ระบุ',
          source: row.source,
          subWarehouse: row.subWarehouse,
          expiryDate: row.expiryDate,
          quantity: row.quantity,
          unit: row.unit,
          packageUnit: row.packageUnit || '',
          min: row.min,
          max: row.max,
          receivedDate: row.receivedDate || new Date().toISOString().split('T')[0],
          notes: row.notes || 'นำเข้าจากไฟล์ Excel',
          updatedAt: new Date().toISOString(),
        });
      }
    });

    if (itemsToAdd.length === 0) {
      setExcelError('กรุณาเลือกอย่างน้อย 1 รายการเพื่อนำเข้า');
      return;
    }

    onImportDrugs(itemsToAdd);
    onClose();
  };

  // Handle PDF file selection
  const handlePdfFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setPdfError('กรุณาเลือกไฟล์เอกสาร PDF เท่านั้น');
      return;
    }

    setPdfFile(file);
    setPdfError('');
    setPdfUploadResult(null);

    const url = URL.createObjectURL(file);
    setPdfPreviewUrl(url);

    // เดาชื่อยาจากชื่อไฟล์ถ้ามี
    const cleanFileName = file.name.replace('.pdf', '');
    setPdfItemForm((prev) => ({
      ...prev,
      name: prev.name || cleanFileName,
    }));
  };

  // Upload PDF to Google Drive Folder (Folder ID: 1O8MiCSQ43f2aoI7HvcPPY4EM97szYqlb)
  const handleUploadPdfToDrive = async () => {
    if (!pdfFile) return;

    setIsUploadingPdf(true);
    setPdfError('');

    try {
      const base64 = await fileToBase64(pdfFile);
      const res = await GasApiService.uploadFileToDrive(
        gasConfig,
        pdfFile.name,
        base64,
        'application/pdf'
      );

      if (res.success) {
        setPdfUploadResult({
          url: res.fileUrl || `https://drive.google.com/drive/folders/${gasConfig.folderId}`,
          name: pdfFile.name,
        });
      } else {
        setPdfError(res.error || 'ไม่สามารถอัปโหลดเข้า Google Drive ได้');
      }
    } catch (err: any) {
      setPdfError('เกิดข้อผิดพลาด: ' + (err.message || 'Upload error'));
    } finally {
      setIsUploadingPdf(false);
    }
  };

  // Add Item extracted or noted from PDF
  const handleAddDrugFromPdf = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfItemForm.name.trim()) {
      setPdfError('กรุณาระบุชื่อยา');
      return;
    }
    if (!pdfItemForm.expiryDate) {
      setPdfError('กรุณาระบุวันหมดอายุ');
      return;
    }

    const newDrug: DrugItem = {
      id: `KCS-PDF-${Date.now().toString().slice(-5)}`,
      name: pdfItemForm.name.trim(),
      shelf: pdfItemForm.shelf.trim() || 'A1-01',
      lot: pdfItemForm.lot.trim() || 'PDF-LOT',
      company: pdfItemForm.company.trim(),
      source: pdfItemForm.source,
      subWarehouse: pdfItemForm.subWarehouse,
      expiryDate: pdfItemForm.expiryDate,
      quantity: Number(pdfItemForm.quantity || 0),
      unit: pdfItemForm.unit || 'เม็ด',
      packageUnit: pdfItemForm.packageUnit || '',
      min: Number(pdfItemForm.min || 0),
      max: Number(pdfItemForm.max || 0),
      receivedDate: new Date().toISOString().split('T')[0],
      notes: `แนบเอกสาร PDF: ${pdfFile ? pdfFile.name : 'เอกสารรับเข้า'} (Folder: 1O8MiCSQ43f2aoI7HvcPPY4EM97szYqlb)`,
      updatedAt: new Date().toISOString(),
    };

    onImportDrugs([newDrug]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-800 rounded-lg text-emerald-300">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-['Prompt'] font-bold text-base sm:text-lg">
                นำเข้าข้อมูลคลังยา (Excel / PDF)
              </h3>
              <p className="text-xs text-emerald-200/80">ระบบคลังยานอก รพ.เขาชัยสน</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-emerald-300 hover:text-white hover:bg-emerald-800/80 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3">
          <button
            onClick={() => setActiveTab('excel')}
            className={`pb-3 px-4 text-xs sm:text-sm font-semibold flex items-center space-x-2 border-b-2 transition ${
              activeTab === 'excel'
                ? 'border-emerald-700 text-emerald-900 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>นำเข้าจากไฟล์ Excel (.xlsx / .csv)</span>
          </button>

          <button
            onClick={() => setActiveTab('pdf')}
            className={`pb-3 px-4 text-xs sm:text-sm font-semibold flex items-center space-x-2 border-b-2 transition ${
              activeTab === 'pdf'
                ? 'border-emerald-700 text-emerald-900 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4 text-teal-700" />
            <span>นำเข้าเอกสาร PDF & อัปโหลด Drive</span>
          </button>
        </div>

        {/* Tab 1: EXCEL IMPORT */}
        {activeTab === 'excel' && (
          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            
            {/* File drop zone & Template download */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-emerald-50/50 rounded-xl border border-emerald-200">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-emerald-950 font-['Prompt']">
                    เลือกหรือลากไฟล์ Excel เข้ามา
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    รองรับ .xlsx, .xls, .csv พร้อมระบบจับคู่คอลัมน์อัตโนมัติ
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={downloadExcelTemplate}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 shadow-xs transition"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>ดาวน์โหลด Template</span>
                </button>

                <label className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg cursor-pointer shadow-xs transition">
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>เลือกไฟล์ Excel</span>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleExcelDrop}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            {/* Error Message */}
            {excelError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{excelError}</span>
              </div>
            )}

            {/* Parsing Indicator */}
            {isParsingExcel && (
              <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
                <p className="text-xs font-medium">กำลังอ่านและจัดเรียงข้อมูลในไฟล์ Excel...</p>
              </div>
            )}

            {/* Parsed Table Preview */}
            {!isParsingExcel && parsedRows.length > 0 && (
              <div className="space-y-3">
                {/* Preview Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="flex items-center space-x-3 text-xs text-slate-700">
                    <button
                      onClick={toggleSelectAll}
                      className="text-xs text-emerald-800 hover:text-emerald-950 underline font-semibold cursor-pointer"
                    >
                      {selectedIndices.size === parsedRows.length ? 'ยกเลิกการเลือกทั้งหมด' : 'เลือกทั้งหมด'}
                    </button>
                    <span className="font-medium">• เลือกแล้ว <strong className="text-emerald-800 font-bold">{selectedIndices.size}</strong> จาก {parsedRows.length} รายการ</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleClearExcel}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                      title="เคลียร์รายการที่อ่านเข้ามาและเลือกไฟล์ใหม่"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>เคลียร์ข้อมูล / อัปไฟล์ใหม่</span>
                    </button>
                  </div>
                </div>

                {/* Batch Sub-Warehouse Tool */}
                <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5 text-emerald-950 font-medium">
                    <span>⚡ เปลี่ยนคลังย่อยของรายการที่เลือก ({selectedIndices.size}) เป็น:</span>
                    <button
                      type="button"
                      onClick={() => handleBatchChangeSubWarehouse('OPD')}
                      disabled={selectedIndices.size === 0}
                      className="px-2 py-0.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-bold disabled:opacity-40 transition cursor-pointer"
                    >
                      OPD (ผู้ป่วยนอก)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBatchChangeSubWarehouse('IPD')}
                      disabled={selectedIndices.size === 0}
                      className="px-2 py-0.5 bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 rounded font-bold disabled:opacity-40 transition cursor-pointer"
                    >
                      IPD (ผู้ป่วยใน)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBatchChangeSubWarehouse('ER')}
                      disabled={selectedIndices.size === 0}
                      className="px-2 py-0.5 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded font-bold disabled:opacity-40 transition cursor-pointer"
                    >
                      ER (ฉุกเฉิน)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBatchChangeSubWarehouse('คลังใหญ่ (Main)')}
                      disabled={selectedIndices.size === 0}
                      className="px-2 py-0.5 bg-white hover:bg-purple-100 text-purple-800 border border-purple-300 rounded font-bold disabled:opacity-40 transition cursor-pointer"
                    >
                      คลังใหญ่
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    * สามารถแก้ไขค่าในตารางได้โดยตรงทุกช่องก่อนกดนำเข้า
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-80 shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 uppercase text-[11px] font-semibold sticky top-0 z-10 shadow-2xs">
                      <tr>
                        <th className="p-2.5 text-center w-8">
                          <input
                            type="checkbox"
                            checked={selectedIndices.size === parsedRows.length && parsedRows.length > 0}
                            onChange={toggleSelectAll}
                            className="rounded text-emerald-700 focus:ring-emerald-600"
                          />
                        </th>
                        <th className="p-2.5 min-w-[150px]">ชื่อยา (แก้ไขได้)</th>
                        <th className="p-2.5 w-20">Shelf</th>
                        <th className="p-2.5 w-24">Lot</th>
                        <th className="p-2.5 min-w-[110px]">คลังย่อย</th>
                        <th className="p-2.5 min-w-[100px]">แหล่งที่มา</th>
                        <th className="p-2.5 min-w-[125px]">วันหมดอายุ</th>
                        <th className="p-2.5 w-18">จำนวน</th>
                        <th className="p-2.5 w-16">หน่วย</th>
                        <th className="p-2.5 min-w-[110px]">หน่วยบรรจุ</th>
                        <th className="p-2.5 min-w-[90px]">Min / Max</th>
                        <th className="p-2.5 w-24">สถานะ</th>
                        <th className="p-2.5 text-center w-10">ลบ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {parsedRows.map((row, idx) => {
                        const isSelected = selectedIndices.has(idx);
                        return (
                          <tr
                            key={idx}
                            className={`transition ${
                              isSelected ? 'bg-emerald-50/40' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectRow(idx)}
                                className="rounded text-emerald-700 focus:ring-emerald-600 cursor-pointer"
                              />
                            </td>

                            {/* Name */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={row.name}
                                onChange={(e) => handleUpdateRowField(idx, 'name', e.target.value)}
                                className="w-full px-2 py-1 font-semibold text-slate-900 border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded bg-white transition"
                                title="คลิกเพื่อแก้ไขชื่อยา"
                              />
                            </td>

                            {/* Shelf */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={row.shelf}
                                onChange={(e) => handleUpdateRowField(idx, 'shelf', e.target.value)}
                                className="w-full px-1.5 py-1 font-mono text-slate-700 border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded bg-white transition"
                                title="คลิกเพื่อแก้ไข Shelf"
                              />
                            </td>

                            {/* Lot */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={row.lot}
                                onChange={(e) => handleUpdateRowField(idx, 'lot', e.target.value)}
                                className="w-full px-1.5 py-1 font-mono text-slate-700 border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded bg-white transition"
                                title="คลิกเพื่อแก้ไข Lot No."
                              />
                            </td>

                            {/* Sub-Warehouse */}
                            <td className="p-2">
                              <select
                                value={row.subWarehouse}
                                onChange={(e) => handleUpdateRowField(idx, 'subWarehouse', e.target.value as SubWarehouse)}
                                className={`w-full px-2 py-1 rounded font-bold border transition cursor-pointer ${
                                  row.subWarehouse === 'IPD'
                                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                                    : row.subWarehouse === 'ER'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : row.subWarehouse === 'คลังใหญ่ (Main)'
                                    ? 'bg-purple-50 text-purple-800 border-purple-200'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                }`}
                                title="เลือกคลังย่อยสำหรับรายการนี้"
                              >
                                <option value="OPD">OPD (ผู้ป่วยนอก)</option>
                                <option value="IPD">IPD (ผู้ป่วยใน)</option>
                                <option value="ER">ER (ฉุกเฉิน)</option>
                                <option value="คลังใหญ่ (Main)">คลังใหญ่ (Main)</option>
                              </select>
                            </td>

                            {/* Source */}
                            <td className="p-2">
                              <select
                                value={row.source}
                                onChange={(e) => handleUpdateRowField(idx, 'source', e.target.value as SourceType)}
                                className="w-full px-1.5 py-1 rounded text-slate-700 border border-slate-200 bg-white transition cursor-pointer"
                              >
                                <option value="GPO">GPO</option>
                                <option value="ไม่ใช่ GPO">ไม่ใช่ GPO</option>
                                <option value="รพ.พัทลุง">รพ.พัทลุง</option>
                                <option value="อื่นๆ">อื่นๆ</option>
                              </select>
                            </td>

                            {/* Expiry Date */}
                            <td className="p-2">
                              <input
                                type="date"
                                value={row.expiryDate}
                                onChange={(e) => handleUpdateRowField(idx, 'expiryDate', e.target.value)}
                                className="w-full px-1.5 py-1 font-mono text-slate-800 border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded bg-white transition"
                                title="คลิกเพื่อแก้ไขวันหมดอายุ"
                              />
                            </td>

                            {/* Quantity */}
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                value={row.quantity}
                                onChange={(e) => handleUpdateRowField(idx, 'quantity', Number(e.target.value))}
                                className="w-full px-1.5 py-1 font-bold text-slate-800 border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded bg-white transition"
                              />
                            </td>

                            {/* Unit */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={row.unit}
                                onChange={(e) => handleUpdateRowField(idx, 'unit', e.target.value)}
                                className="w-full px-1.5 py-1 text-slate-700 border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded bg-white transition"
                              />
                            </td>

                            {/* Package Unit */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={row.packageUnit || ''}
                                onChange={(e) => handleUpdateRowField(idx, 'packageUnit', e.target.value)}
                                placeholder="ขนาดบรรจุ"
                                className="w-full px-1.5 py-1 text-emerald-900 font-medium border border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded bg-white transition"
                                title="หน่วยบรรจุ เช่น 10x10 เม็ด/กล่อง"
                              />
                            </td>

                            {/* Min / Max */}
                            <td className="p-2">
                              <div className="flex items-center space-x-1">
                                <input
                                  type="number"
                                  min="0"
                                  value={row.min}
                                  onChange={(e) => handleUpdateRowField(idx, 'min', Number(e.target.value))}
                                  className="w-10 px-1 py-1 text-[11px] text-slate-600 border border-slate-200 rounded text-center"
                                  title="Min"
                                />
                                <span className="text-slate-400">/</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={row.max}
                                  onChange={(e) => handleUpdateRowField(idx, 'max', Number(e.target.value))}
                                  className="w-10 px-1 py-1 text-[11px] text-slate-600 border border-slate-200 rounded text-center"
                                  title="Max"
                                />
                              </div>
                            </td>

                            {/* Status */}
                            <td className="p-2">
                              {row.isValid ? (
                                <span className="inline-flex items-center text-emerald-700 text-[11px] font-semibold">
                                  <Check className="w-3.5 h-3.5 mr-0.5" /> พร้อม
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-rose-600 text-[11px] font-medium" title={row.validationError}>
                                  <AlertCircle className="w-3.5 h-3.5 mr-0.5" /> {row.validationError}
                                </span>
                              )}
                            </td>

                            {/* Delete row */}
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeletePreviewRow(idx)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                                title="ลบรายการนี้ออกจากพรีวิว"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="pt-2 flex items-center justify-end space-x-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleConfirmImportExcel}
                    disabled={selectedIndices.size === 0}
                    className="inline-flex items-center space-x-1.5 px-5 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>นำเข้า {selectedIndices.size} รายการสู่ระบบคลัง</span>
                  </button>
                </div>
              </div>
            )}

            {!isParsingExcel && parsedRows.length === 0 && (
              <div className="py-12 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center p-6 space-y-2">
                <FileSpreadsheet className="w-10 h-10 text-slate-300" />
                <p className="text-sm font-semibold text-slate-700 font-['Prompt']">
                  ยังไม่ได้เลือกไฟล์ Excel
                </p>
                <p className="text-xs text-slate-500 max-w-md">
                  ท่านสามารถดาวน์โหลดไฟล์แบบฟอร์ม Template หรือเลือกไฟล์ Excel รายการยาของโรงพยาบาลเพื่อนำเข้าสู่ระบบได้ทันที
                </p>
              </div>
            )}

          </div>
        )}

        {/* Tab 2: PDF DOCUMENT IMPORT & GOOGLE DRIVE */}
        {activeTab === 'pdf' && (
          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            
            <div className="bg-teal-50/70 p-3.5 rounded-xl border border-teal-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-teal-950 font-['Prompt']">
                  เชื่อมโยง Google Drive Folder ID: {gasConfig.folderId}
                </h4>
                <p className="text-[11px] text-teal-800">
                  อัปโหลดใบส่งยา / ใบเบิกยา / ใบรับเข้า เก็บลงโฟลเดอร์ Google Drive คลังยา รพ.เขาชัยสน
                </p>
              </div>
              <a
                href={`https://drive.google.com/drive/folders/${gasConfig.folderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 text-xs text-teal-900 hover:underline font-semibold"
              >
                <span>เปิดโฟลเดอร์ Drive</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* PDF File Picker */}
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-4 text-center">
              <label className="cursor-pointer block space-y-1.5">
                <FileText className="w-8 h-8 text-teal-600 mx-auto" />
                <span className="text-xs sm:text-sm font-bold text-slate-800 font-['Prompt'] block">
                  {pdfFile ? pdfFile.name : 'คลิกเพื่อเลือกไฟล์ PDF (ใบส่งของ/ใบเบิกยา)'}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  {pdfFile ? `${(pdfFile.size / 1024).toFixed(1)} KB` : 'รองรับไฟล์เอกสาร PDF'}
                </span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handlePdfFile}
                  className="sr-only"
                />
              </label>
            </div>

            {/* Error */}
            {pdfError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{pdfError}</span>
              </div>
            )}

            {/* Uploaded to Drive Result */}
            {pdfUploadResult && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>อัปโหลดเข้า Google Drive สำเร็จ: <strong>{pdfUploadResult.name}</strong></span>
                </div>
                <a
                  href={pdfUploadResult.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 text-emerald-900 underline font-semibold"
                >
                  <span>ดูไฟล์ใน Drive</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {/* Action to upload file to drive */}
            {pdfFile && !pdfUploadResult && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleUploadPdfToDrive}
                  disabled={isUploadingPdf}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-teal-800 hover:bg-teal-900 disabled:bg-slate-300 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                >
                  {isUploadingPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังอัปโหลดเข้า Drive Folder...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>อัปโหลดไฟล์นี้เข้า Google Drive Folder ({gasConfig.folderId.slice(0, 8)}...)</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* PDF Quick Item Entry form */}
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-bold text-slate-800 font-['Prompt'] flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-800" />
                  <span>บันทึกรายการยาจากเอกสารนี้เข้าสู่คลังยา</span>
                </h4>
                <span className="text-[11px] text-slate-500">
                  กรอกข้อมูลยาตามใบส่งมอบใน PDF
                </span>
              </div>

              <form onSubmit={handleAddDrugFromPdf} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      ชื่อยา <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={pdfItemForm.name}
                      onChange={(e) => setPdfItemForm({ ...pdfItemForm, name: e.target.value })}
                      placeholder="เช่น Cefazolin 1g Injection"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Shelf (ชั้นวาง)
                    </label>
                    <input
                      type="text"
                      value={pdfItemForm.shelf}
                      onChange={(e) => setPdfItemForm({ ...pdfItemForm, shelf: e.target.value })}
                      placeholder="เช่น A1-01"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Lot No.</label>
                    <input
                      type="text"
                      value={pdfItemForm.lot}
                      onChange={(e) => setPdfItemForm({ ...pdfItemForm, lot: e.target.value })}
                      placeholder="เช่น LOT6701"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">แหล่งที่มา</label>
                    <select
                      value={pdfItemForm.source}
                      onChange={(e) => setPdfItemForm({ ...pdfItemForm, source: e.target.value as any })}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                    >
                      <option value="GPO">GPO</option>
                      <option value="ไม่ใช่ GPO">ไม่ใช่ GPO</option>
                      <option value="รพ.พัทลุง">รพ.พัทลุง</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">คลังย่อย</label>
                    <select
                      value={pdfItemForm.subWarehouse}
                      onChange={(e) => setPdfItemForm({ ...pdfItemForm, subWarehouse: e.target.value as any })}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                    >
                      <option value="OPD">OPD</option>
                      <option value="IPD">IPD</option>
                      <option value="ER">ER</option>
                      <option value="คลังใหญ่ (Main)">คลังใหญ่</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      วันหมดอายุ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={pdfItemForm.expiryDate}
                      onChange={(e) => setPdfItemForm({ ...pdfItemForm, expiryDate: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">จำนวนรับเข้า</label>
                    <input
                      type="number"
                      min="1"
                      value={pdfItemForm.quantity}
                      onChange={(e) => setPdfItemForm({ ...pdfItemForm, quantity: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">หน่วยนับย่อย</label>
                    <input
                      type="text"
                      value={pdfItemForm.unit}
                      onChange={(e) => setPdfItemForm({ ...pdfItemForm, unit: e.target.value })}
                      placeholder="เม็ด, แคปซูล, Vial"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">หน่วยบรรจุ</label>
                    <input
                      type="text"
                      value={pdfItemForm.packageUnit}
                      onChange={(e) => setPdfItemForm({ ...pdfItemForm, packageUnit: e.target.value })}
                      placeholder="เช่น 10x10 เม็ด/กล่อง"
                      className="w-full px-3 py-1.5 text-xs border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-emerald-50/20"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Min เตือน</label>
                    <input
                      type="number"
                      min="0"
                      value={pdfItemForm.min}
                      onChange={(e) => setPdfItemForm({ ...pdfItemForm, min: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    type="submit"
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>บันทึกยาจากเอกสารนี้เข้าคลัง</span>
                  </button>
                </div>
              </form>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
