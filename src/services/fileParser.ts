import * as XLSX from 'xlsx';
import { DrugItem, SourceType, SubWarehouse } from '../types/inventory';
import { getDrugStatus } from '../utils/drugUtils';

export interface ParsedImportRow {
  name: string;
  shelf: string;
  lot: string;
  company: string;
  source: SourceType;
  subWarehouse: SubWarehouse;
  expiryDate: string;
  quantity: number;
  unit: string;
  min: number;
  max: number;
  receivedDate: string;
  notes: string;
  isValid: boolean;
  validationError?: string;
}

/**
 * แปลงไฟล์ Excel (.xlsx, .xls, .csv) เป็นชุดข้อมูลรายการยา
 */
export async function parseExcelFile(file: File): Promise<ParsedImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        // อ่านแผ่นงานแรก
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // แปลงเป็น Array of Objects
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rows.length <= 1) {
          resolve([]);
          return;
        }

        const headerRow = rows[0].map((h: any) => String(h || '').trim().toLowerCase());
        
        // หาตำแหน่งคอลัมน์แบบยืดหยุ่น
        const findColIndex = (keywords: string[]) => {
          return headerRow.findIndex((col: string) => 
            keywords.some(kw => col.includes(kw.toLowerCase()))
          );
        };

        const idxName = findColIndex(['ชื่อยา', 'drug', 'name', 'item', 'รายการยา']);
        const idxShelf = findColIndex(['shelf', 'ชั้น', 'ช่อง', 'ที่เก็บ', 'location']);
        const idxLot = findColIndex(['lot', 'batch', 'รุ่น']);
        const idxCompany = findColIndex(['บริษัท', 'company', 'manufacturer', 'ผู้ผลิต']);
        const idxSource = findColIndex(['แหล่ง', 'source', 'ที่มา']);
        const idxSubWh = findColIndex(['คลังย่อย', 'sub', 'warehouse', 'คลัง', 'แผนก']);
        const idxExpiry = findColIndex(['หมดอายุ', 'exp', 'expiry']);
        const idxQty = findColIndex(['จำนวน', 'qty', 'quantity', 'คงเหลือ']);
        const idxUnit = findColIndex(['หน่วย', 'unit']);
        const idxMin = findColIndex(['min', 'ต่ำสุด', 'ขั้นต่ำ']);
        const idxMax = findColIndex(['max', 'สูงสุด']);
        const idxReceived = findColIndex(['รับ', 'received', 'date_in']);
        const idxNotes = findColIndex(['หมายเหตุ', 'note', 'remark']);

        const parsedList: ParsedImportRow[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0 || !row.some((cell: any) => cell !== null && cell !== '')) {
            continue; // ข้ามแถวว่าง
          }

          const rawName = idxName !== -1 ? String(row[idxName] || '').trim() : String(row[0] || '').trim();
          if (!rawName) continue;

          const rawShelf = idxShelf !== -1 ? String(row[idxShelf] || '').trim() : (row[1] ? String(row[1]).trim() : 'ทั่วไป');
          const rawLot = idxLot !== -1 ? String(row[idxLot] || '').trim() : (row[2] ? String(row[2]).trim() : 'LOT-' + Date.now().toString().slice(-4));
          const rawCompany = idxCompany !== -1 ? String(row[idxCompany] || '').trim() : (row[3] ? String(row[3]).trim() : 'ไม่ระบุ');
          
          let rawSource: SourceType = 'GPO';
          const sourceText = idxSource !== -1 ? String(row[idxSource] || '').trim() : '';
          if (sourceText.includes('พัทลุง')) {
            rawSource = 'รพ.พัทลุง';
          } else if (sourceText.includes('ไม่ใช่') || sourceText.toLowerCase().includes('non-gpo')) {
            rawSource = 'ไม่ใช่ GPO';
          } else if (sourceText.includes('GPO') || sourceText.includes('องค์การ')) {
            rawSource = 'GPO';
          } else if (sourceText) {
            rawSource = 'อื่นๆ';
          }

          let rawSubWh: SubWarehouse = 'OPD';
          const subText = idxSubWh !== -1 ? String(row[idxSubWh] || '').trim() : '';
          if (subText.toUpperCase().includes('IPD')) {
            rawSubWh = 'IPD';
          } else if (subText.toUpperCase().includes('ER')) {
            rawSubWh = 'ER';
          } else if (subText.includes('คลังใหญ่') || subText.toUpperCase().includes('MAIN')) {
            rawSubWh = 'คลังใหญ่ (Main)';
          } else {
            rawSubWh = 'OPD';
          }

          // วันหมดอายุ
          let rawExpiry = '';
          const expCell = idxExpiry !== -1 ? row[idxExpiry] : row[6];
          if (expCell instanceof Date) {
            rawExpiry = expCell.toISOString().split('T')[0];
          } else if (typeof expCell === 'string' && expCell) {
            rawExpiry = expCell.split('T')[0];
          } else if (typeof expCell === 'number') {
            // Excel serial date to YYYY-MM-DD
            const d = new Date(Math.round((expCell - 25569) * 86400 * 1000));
            rawExpiry = d.toISOString().split('T')[0];
          } else {
            // วันที่ default 1 ปีข้างหน้า
            const future = new Date();
            future.setFullYear(future.getFullYear() + 1);
            rawExpiry = future.toISOString().split('T')[0];
          }

          const rawQty = idxQty !== -1 ? Number(row[idxQty]) || 0 : (Number(row[7]) || 0);
          const rawUnit = idxUnit !== -1 ? String(row[idxUnit] || '').trim() : (row[8] ? String(row[8]).trim() : 'เม็ด');
          const rawMin = idxMin !== -1 ? Number(row[idxMin]) || 0 : (Number(row[9]) || 0);
          const rawMax = idxMax !== -1 ? Number(row[idxMax]) || 0 : (Number(row[10]) || 0);
          const rawReceived = idxReceived !== -1 ? String(row[idxReceived] || '').split('T')[0] : new Date().toISOString().split('T')[0];
          const rawNotes = idxNotes !== -1 ? String(row[idxNotes] || '').trim() : '';

          parsedList.push({
            name: rawName,
            shelf: rawShelf || 'A1',
            lot: rawLot || 'N/A',
            company: rawCompany || 'องค์การเภสัชกรรม (GPO)',
            source: rawSource,
            subWarehouse: rawSubWh,
            expiryDate: rawExpiry,
            quantity: rawQty,
            unit: rawUnit || 'หน่วย',
            min: rawMin,
            max: rawMax,
            receivedDate: rawReceived || new Date().toISOString().split('T')[0],
            notes: rawNotes,
            isValid: Boolean(rawName && rawExpiry),
            validationError: !rawName ? 'ไม่มีชื่อยา' : (!rawExpiry ? 'ไม่มีวันหมดอายุ' : undefined),
          });
        }

        resolve(parsedList);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * ดาวน์โหลดไฟล์ตัวอย่าง Template Excel สำหรับคลังยา
 */
export function downloadExcelTemplate() {
  const headers = [
    'ชื่อยา (Drug Name)',
    'Shelf (ชั้นวาง)',
    'Lot No.',
    'บริษัทผู้จัดจำหน่าย',
    'แหล่งที่มา (GPO / ไม่ใช่ GPO / รพ.พัทลุง)',
    'คลังย่อย (OPD / IPD / ER)',
    'วันหมดอายุ (YYYY-MM-DD)',
    'จำนวนคงเหลือ',
    'หน่วยนับ',
    'Min (ขั้นต่ำ)',
    'Max (สูงสุด)',
    'วันที่รับเข้า',
    'หมายเหตุ',
  ];

  const sampleRows = [
    [
      'Paracetamol 500 mg Tablet',
      'A1-02',
      'GPO67012',
      'องค์การเภสัชกรรม (GPO)',
      'GPO',
      'OPD',
      '2027-06-30',
      2000,
      'เม็ด',
      1000,
      10000,
      '2026-05-01',
      'ยาแก้ปวดลดไข้มาตรฐาน',
    ],
    [
      'Amoxicillin 500 mg Capsule',
      'B2-01',
      'BER-2601',
      'บ. เบอร์ลินฟาร์มาฯ',
      'ไม่ใช่ GPO',
      'ER',
      '2026-11-15',
      300,
      'แคปซูล',
      500,
      2500,
      '2026-04-10',
      'ตู้ยาฉุกเฉิน',
    ],
    [
      'Ceftriaxone 1g Injection',
      'C1-ตู้เย็น',
      'PTL-26089',
      'รพ.พัทลุง',
      'รพ.พัทลุง',
      'IPD',
      '2027-01-20',
      50,
      'Vial',
      30,
      100,
      '2026-03-20',
      'ยาต้านจุลชีพ',
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  
  // กำหนดความกว้างของคอลัมน์
  ws['!cols'] = [
    { wch: 30 }, // ชื่อยา
    { wch: 15 }, // shelf
    { wch: 15 }, // lot
    { wch: 25 }, // บริษัท
    { wch: 20 }, // แหล่งที่มา
    { wch: 15 }, // คลังย่อย
    { wch: 16 }, // วันหมดอายุ
    { wch: 12 }, // จำนวน
    { wch: 10 }, // หน่วย
    { wch: 10 }, // min
    { wch: 10 }, // max
    { wch: 14 }, // วันที่รับ
    { wch: 25 }, // หมายเหตุ
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template คลังยา');
  XLSX.writeFile(wb, 'แบบฟอร์มนำเข้าคลังยา_รพ_เขาชัยสน.xlsx');
}

/**
 * ส่งออกรายการยาเป็น Excel
 */
export function exportDrugsToExcel(drugs: DrugItem[]) {
  const headers = [
    'รหัสยา (ID)',
    'ชื่อยา (Drug Name)',
    'Shelf (ชั้นวาง)',
    'Lot No.',
    'บริษัทผู้ผลิต/จัดจำหน่าย',
    'แหล่งที่มา (Source)',
    'คลังย่อย (Sub-warehouse)',
    'วันหมดอายุ (Expiry)',
    'สถานะวันหมดอายุ (Expiry Status)',
    'วันคงเหลือก่อนหมดอายุ',
    'จำนวนคงเหลือ',
    'หน่วยนับ',
    'Min (ขั้นต่ำ)',
    'Max (สูงสุด)',
    'สถานะสต็อก (Stock Status)',
    'สรุปการแจ้งเตือน (Alert Summary)',
    'วันที่รับเข้า',
    'หมายเหตุ',
  ];

  const rows = drugs.map((d) => {
    const st = getDrugStatus(d);
    
    let expStatusText = 'ปลอดภัย';
    if (st.expiryStatus === 'expired') {
      expStatusText = `หมดอายุแล้ว (เลยมา ${Math.abs(st.daysLeft)} วัน)`;
    } else if (st.expiryStatus === 'near_expiry') {
      expStatusText = `ใกล้หมดอายุ (เหลือ ${st.daysLeft} วัน)`;
    } else {
      expStatusText = `ปลอดภัย (เหลือ ${st.daysLeft} วัน)`;
    }

    let stockStatusText = 'ปกติ';
    if (d.quantity <= 0) {
      stockStatusText = 'สต็อกหมด (0)';
    } else if (d.quantity <= d.min) {
      stockStatusText = `ถึงเกณฑ์ Min หรือต่ำกว่า (${d.quantity}/${d.min})`;
    } else if (d.max > 0 && d.quantity > d.max) {
      stockStatusText = `สต็อกเกิน Max (${d.quantity}/${d.max})`;
    } else {
      stockStatusText = `ปกติ (${d.quantity})`;
    }

    let alertSummaryText = 'ปกติ';
    if (st.expiryStatus === 'expired') {
      alertSummaryText = '🚨 หมดอายุแล้ว (ห้ามจ่าย)';
    } else if (st.expiryStatus === 'near_expiry' && st.stockStatus === 'low') {
      alertSummaryText = '⚡ วิกฤต: ใกล้หมดอายุ & ต่ำกว่า Min';
    } else if (st.expiryStatus === 'near_expiry') {
      alertSummaryText = '⏳ ใกล้หมดอายุ (≤ 70 วัน)';
    } else if (st.stockStatus === 'low') {
      alertSummaryText = '📉 ถึงเกณฑ์ Min (ต้องสั่งเพิ่ม)';
    } else {
      alertSummaryText = '🟢 ปกติ';
    }

    return [
      d.id,
      d.name,
      d.shelf,
      d.lot,
      d.company,
      d.source,
      d.subWarehouse,
      d.expiryDate,
      expStatusText,
      st.daysLeft < 0 ? `เลยมา ${Math.abs(st.daysLeft)} วัน` : `${st.daysLeft} วัน`,
      d.quantity,
      d.unit,
      d.min,
      d.max,
      stockStatusText,
      alertSummaryText,
      d.receivedDate,
      d.notes || '',
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    { wch: 12 }, // รหัสยา
    { wch: 30 }, // ชื่อยา
    { wch: 14 }, // Shelf
    { wch: 14 }, // Lot
    { wch: 25 }, // บริษัท
    { wch: 16 }, // แหล่ง
    { wch: 16 }, // คลังย่อย
    { wch: 14 }, // วันหมดอายุ
    { wch: 28 }, // สถานะวันหมดอายุ
    { wch: 18 }, // วันคงเหลือ
    { wch: 14 }, // จำนวนคงเหลือ
    { wch: 10 }, // หน่วย
    { wch: 12 }, // min
    { wch: 12 }, // max
    { wch: 28 }, // สถานะสต็อก
    { wch: 28 }, // สรุปการแจ้งเตือน
    { wch: 14 }, // วันที่รับ
    { wch: 25 }, // หมายเหตุ
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'คลังยานอก รพ.เขาชัยสน');
  
  const today = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `รายงานคลังยานอก_รพ_เขาชัยสน_${today}.xlsx`);
}

/**
 * แปลงไฟล์เป็น Base64 สำหรับส่งขึ้น Google Drive / Apps Script
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // ลบ data:application/pdf;base64, ออก
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}
