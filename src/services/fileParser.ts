import * as XLSX from 'xlsx';
import { DrugItem, SourceType, SubWarehouse } from '../types/inventory';
import { getDrugStatus, parseUnitAndPackage } from '../utils/drugUtils';

export interface ParsedImportRow {
  id?: string;
  name: string;
  shelf: string;
  lot: string;
  company: string;
  source: SourceType;
  subWarehouse: SubWarehouse;
  expiryDate: string;
  quantity: number;
  unit: string;
  packageUnit: string;
  min: number;
  max: number;
  receivedDate: string;
  notes: string;
  isValid: boolean;
  validationError?: string;
}

/**
 * แปลงค่าตัวเลขอย่างเสถียร (ลบคอมม่า, ดึงตัวเลขจากสตริงที่มีหน่วยนับ)
 */
export function parseCleanNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const str = String(val).replace(/,/g, '').trim();
  // ดึงตัวเลขแรกที่พบในสตริง
  const match = str.match(/-?\d+(?:\.\d+)?/);
  if (match) {
    const num = parseFloat(match[0]);
    return isNaN(num) ? fallback : num;
  }
  return fallback;
}

const THAI_MONTHS: Record<string, number> = {
  'ม.ค.': 1, 'มกราคม': 1, 'jan': 1, 'january': 1,
  'ก.พ.': 2, 'กุมภาพันธ์': 2, 'feb': 2, 'february': 2,
  'มี.ค.': 3, 'มีนาคม': 3, 'mar': 3, 'march': 3,
  'เม.ย.': 4, 'เมษายน': 4, 'apr': 4, 'april': 4,
  'พ.ค.': 5, 'พฤษภาคม': 5, 'may': 5,
  'มิ.ย.': 6, 'มิถุนายน': 6, 'jun': 6, 'june': 6,
  'ก.ค.': 7, 'กรกฎาคม': 7, 'jul': 7, 'july': 7,
  'ส.ค.': 8, 'สิงหาคม': 8, 'aug': 8, 'august': 8,
  'ก.ย.': 9, 'กันยายน': 9, 'sep': 9, 'september': 9,
  'ต.ค.': 10, 'ตุลาคม': 10, 'oct': 10, 'october': 10,
  'พ.ย.': 11, 'พฤศจิกายน': 11, 'nov': 11, 'november': 11,
  'ธ.ค.': 12, 'ธันวาคม': 12, 'dec': 12, 'december': 12,
};

/**
 * แปลงวันที่แบบครอบคลุม:
 * - Excel Serial Date (e.g. 45678)
 * - วันที่ไทย พ.ศ. (e.g. 20/11/2569, 20/11/69, 20 พ.ย. 2569)
 * - รูปแบบสากล YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
 * - Date object
 */
export function parseRobustDate(val: any, fallbackYearsFromNow = 1): string {
  if (val === null || val === undefined || val === '') {
    const d = new Date();
    d.setFullYear(d.getFullYear() + fallbackYearsFromNow);
    return d.toISOString().split('T')[0];
  }

  // 1. Date object จาก JS
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const year = val.getFullYear();
      // ปรับ พ.ศ. เกิน 2400
      const adjYear = year > 2400 ? year - 543 : year;
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${adjYear}-${m}-${d}`;
    }
  }

  // 2. Excel Serial Number
  if (typeof val === 'number') {
    if (val > 1000 && val < 100000) {
      // Excel serial date to JS Date (accounting for 1900 leap year bug)
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    }
  }

  const str = String(val).trim();

  // 3. รูปแบบ ISO YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    let y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (y > 2400) y -= 543; // แปลง พ.ศ. -> ค.ศ.
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // 4. รูปแบบ วัน/เดือน/ปี เช่น 20/11/2569 หรือ 20/11/2026 หรือ 20-11-69
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    let y = parseInt(dmyMatch[3], 10);
    if (y >= 2400) y -= 543;
    else if (y < 100) {
      // 2 หลัก: ถ้า > 40 ถือเป็น พ.ศ. 2 หลัก (เช่น 69 -> 2569 -> 2026)
      if (y >= 40) y = (2500 + y) - 543;
      else y = 2000 + y;
    }
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // 5. ตรวจสอบชื่อเดือนภาษาไทย เช่น "20 พ.ย. 2569" หรือ "15 มกราคม 2026"
  for (const [mName, mNum] of Object.entries(THAI_MONTHS)) {
    if (str.includes(mName)) {
      const parts = str.match(/\d+/g);
      if (parts && parts.length >= 2) {
        const d = parseInt(parts[0], 10);
        let y = parseInt(parts[1], 10);
        if (parts.length >= 3) {
          y = parseInt(parts[parts.length - 1], 10);
        }
        if (y >= 2400) y -= 543;
        else if (y < 100 && y >= 40) y = (2500 + y) - 543;
        else if (y < 100) y = 2000 + y;
        return `${y}-${String(mNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
  }

  // 6. พยายาม parse ผ่าน Date.parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    let y = parsed.getFullYear();
    if (y > 2400) y -= 543;
    return `${y}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }

  // Fallback
  const d = new Date();
  d.setFullYear(d.getFullYear() + fallbackYearsFromNow);
  return d.toISOString().split('T')[0];
}

/**
 * ระบุแหล่งที่มาอย่างแม่นยำ
 */
export function parseSource(val: any, companyVal?: any): SourceType {
  const str = String(val || '').toLowerCase().trim();
  const comp = String(companyVal || '').toLowerCase().trim();
  if (str.includes('พัทลุง') || str.includes('ptl') || comp.includes('พัทลุง')) return 'รพ.พัทลุง';
  if (str.includes('ไม่ใช่') || str.includes('non-gpo') || str.includes('nongpo')) return 'ไม่ใช่ GPO';
  if (str.includes('gpo') || str.includes('องค์การ') || str.includes('เภสัชกรรม') || comp.includes('องค์การเภสัชกรรม') || comp.includes('gpo')) return 'GPO';
  if (str) return 'อื่นๆ';
  if (comp.includes('เบอร์ลิน') || comp.includes('ซิลลิค') || comp.includes('ดีเคเอสเอช') || comp.includes('สยามเภสัช')) return 'ไม่ใช่ GPO';
  return 'GPO';
}

/**
 * ระบุคลังย่อยอย่างแม่นยำ (OPD / IPD / ER / คลังใหญ่)
 * ตรวจสอบทั้งจากคอลัมน์คลังย่อย, Shelf, เซลล์ในแถว, และชื่อ Sheet
 */
export function parseSubWarehouse(val: any, shelfVal?: any, rowCells?: any[], sheetName?: string): SubWarehouse {
  const checkStr = (input: any): SubWarehouse | null => {
    if (input === null || input === undefined || input === '') return null;
    const s = String(input).trim();
    if (!s) return null;
    const upper = s.toUpperCase();

    // 1. IPD (ผู้ป่วยใน / หอผู้ป่วย / วอร์ด / Ward / ICU / CCU / LR / Inpatient)
    if (
      /\bIPD\b/.test(upper) ||
      upper === 'IPD' ||
      s.includes('ผู้ป่วยใน') ||
      s.includes('หอผู้ป่วย') ||
      s.includes('วอร์ด') ||
      /\bWARD\b/.test(upper) ||
      /\bINPATIENT\b/.test(upper) ||
      /\bICU\b/.test(upper) ||
      /\bCCU\b/.test(upper) ||
      s.includes('ห้องคลอด') ||
      s.includes('ตึกผู้ป่วย') ||
      s.includes('ตึกสามัญ') ||
      s.includes('ตึกพิเศษ')
    ) {
      return 'IPD';
    }

    // 2. ER (ฉุกเฉิน / อุบัติเหตุ / Emergency / ER)
    // ตรวจสอบแบบ word boundary หรือ exact match เพื่อไม่ให้ชนกับคำอังกฤษ เช่น order, water, powder, number, supplier
    if (
      /\bER\b/.test(upper) ||
      upper === 'ER' ||
      s.includes('ฉุกเฉิน') ||
      s.includes('อุบัติเหตุ') ||
      /\bEMERGENCY\b/.test(upper) ||
      s.includes('ห้องฉุกเฉิน') ||
      s.includes('จุดตรวจฉุกเฉิน') ||
      s.includes('หน่วยฉุกเฉิน') ||
      s.includes('ห้องอุบัติเหตุ')
    ) {
      return 'ER';
    }

    // 3. คลังใหญ่ (Main / คลังกลาง / คลังยาใหญ่)
    if (
      s.includes('คลังใหญ่') ||
      /\bMAIN\b/.test(upper) ||
      upper === 'MAIN' ||
      s.includes('คลังกลาง') ||
      s.includes('คลังยาใหญ่') ||
      s.includes('คลังเวชภัณฑ์')
    ) {
      return 'คลังใหญ่ (Main)';
    }

    // 4. OPD (ผู้ป่วยนอก / OPD / Outpatient / ห้องยาผู้ป่วยนอก)
    if (
      /\bOPD\b/.test(upper) ||
      upper === 'OPD' ||
      s.includes('ผู้ป่วยนอก') ||
      /\bOUTPATIENT\b/.test(upper) ||
      s.includes('ห้องยาผู้ป่วยนอก')
    ) {
      return 'OPD';
    }

    return null;
  };

  // 1. ตรวจสอบจากค่าในคอลัมน์คลังย่อยโดยตรง
  const fromVal = checkStr(val);
  if (fromVal) return fromVal;

  // 2. ตรวจสอบจากค่า Shelf (เช่น "ER-01", "C1-IPD", "ตู้ยาฉุกเฉิน")
  const fromShelf = checkStr(shelfVal);
  if (fromShelf) return fromShelf;

  // 3. ตรวจสอบจากทุกเซลล์ในแถวนั้น (ข้ามสตริงยาวเกิน 25 ตัวอักษรเพื่อไม่ให้ชนกับชื่อยาหรือหมายเหตุ)
  if (Array.isArray(rowCells)) {
    for (const cell of rowCells) {
      if (cell === null || cell === undefined || cell === '') continue;
      if (typeof cell === 'number') continue;
      const strCell = String(cell).trim();
      if (strCell.length > 25) continue;
      const fromCell = checkStr(strCell);
      if (fromCell) return fromCell;
    }
  }

  // 4. ตรวจสอบจากชื่อ Sheet (เช่น Sheet ชื่อ "ER", "IPD", "OPD")
  if (sheetName) {
    const fromSheet = checkStr(sheetName);
    if (fromSheet) return fromSheet;
  }

  // ค่าเริ่มต้นถ้าหาไม่พบเลย
  return 'OPD';
}

/**
 * แปลงไฟล์ Excel (.xlsx, .xls, .csv, .tsv, .txt) เป็นชุดข้อมูลรายการยาอย่างเสถียรสูงสุด
 */
export async function parseExcelFile(file: File): Promise<ParsedImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        if (!buffer || buffer.byteLength === 0) {
          resolve([]);
          return;
        }

        const isCsvOrText = file.name.match(/\.(csv|tsv|txt)$/i);
        let workbook: XLSX.WorkBook;

        if (isCsvOrText) {
          // พยายามตรวจจับและถอดรหัส CSV ภาษาไทย (UTF-8 หรือ Windows-874 / TIS-620)
          let decodedText = '';
          try {
            const utf8Decoder = new TextDecoder('utf-8', { fatal: false });
            decodedText = utf8Decoder.decode(buffer);
            // ถ้าพบตัวอักษรแทนที่ \uFFFD หรือมีลักษณะเข้ารหัสผิด ให้ลองถอดรหัสแบบ windows-874
            if (decodedText.includes('\uFFFD')) {
              try {
                const tisDecoder = new TextDecoder('windows-874', { fatal: false });
                decodedText = tisDecoder.decode(buffer);
              } catch {
                // คงเดิม
              }
            }
          } catch {
            decodedText = '';
          }

          if (decodedText) {
            workbook = XLSX.read(decodedText, { type: 'string', raw: false });
          } else {
            const uint8 = new Uint8Array(buffer);
            workbook = XLSX.read(uint8, { type: 'array', cellDates: true, raw: false });
          }
        } else {
          // ไฟล์ .xlsx / .xls
          const uint8 = new Uint8Array(buffer);
          workbook = XLSX.read(uint8, { type: 'array', cellDates: true, raw: false });
        }
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          resolve([]);
          return;
        }

        // ค้นหา Sheet ที่เหมาะสมที่สุด (มีข้อมูลที่มีคีย์เวิร์ดคลังยามากที่สุด)
        let bestSheetName = workbook.SheetNames[0];
        let bestScore = -1;
        let bestRows: any[][] = [];

        const drugDetectKeywords = ['ยา', 'drug', 'name', 'shelf', 'lot', 'exp', 'qty', 'หน่วย', 'unit', 'บรรจุ', 'pack'];

        for (const sheetName of workbook.SheetNames) {
          const ws = workbook.Sheets[sheetName];
          if (!ws) continue;
          const r: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          if (!r || r.length === 0) continue;

          // ประเมินคะแนนของชีท
          let sheetScore = r.length;
          const previewRows = r.slice(0, 15);
          for (const row of previewRows) {
            if (Array.isArray(row)) {
              const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
              for (const kw of drugDetectKeywords) {
                if (rowStr.includes(kw)) sheetScore += 10;
              }
            }
          }

          if (sheetScore > bestScore) {
            bestScore = sheetScore;
            bestSheetName = sheetName;
            bestRows = r;
          }
        }

        if (bestRows.length <= 0) {
          resolve([]);
          return;
        }

        // ค้นหาแถว Header ที่แท้จริง (สแกนลึกสูงสุด 30 แถวแรก)
        const headerKeywords = [
          'ชื่อยา', 'drug', 'name', 'item', 'รายการยา', 'ชื่อสามัญ', 'เวชภัณฑ์', 'รายการ',
          'shelf', 'ชั้นวาง', 'ชั้น', 'ช่อง', 'ที่เก็บ', 'location', 'ตู้', 'ตำแหน่ง',
          'lot', 'batch', 'รุ่น', 'เลขที่ผลิต', 'รุ่นที่ผลิต',
          'บริษัท', 'company', 'ผู้ผลิต', 'ผู้จำหน่าย', 'vendor',
          'แหล่ง', 'source', 'ที่มา', 'จัดซื้อ',
          'คลัง', 'warehouse', 'คลังย่อย', 'ward',
          'วันหมดอายุ', 'หมดอายุ', 'exp', 'expiry', 'ed',
          'จำนวน', 'qty', 'quantity', 'คงเหลือ', 'ยอดคงเหลือ', 'ยอด', 'สต็อก', 'balance',
          'หน่วย', 'unit', 'หน่วยนับ', 'หน่วยย่อย', 'uom',
          'บรรจุ', 'pack', 'ขนาดบรรจุ', 'หน่วยบรรจุ', 'packaging',
          'min', 'max', 'ขั้นต่ำ', 'สูงสุด', 'จุดสั่งซื้อ',
          'วันที่รับ', 'รับเข้า', 'received', 'หมายเหตุ', 'note'
        ];

        let headerRowIndex = 0;
        let maxHeaderScore = -1;

        for (let rIdx = 0; rIdx < Math.min(30, bestRows.length); rIdx++) {
          const row = bestRows[rIdx];
          if (!row || !Array.isArray(row)) continue;
          const rowText = row.map(c => String(c || '').toLowerCase()).join(' ');
          let score = 0;
          for (const kw of headerKeywords) {
            if (rowText.includes(kw)) score++;
          }
          if (score > maxHeaderScore) {
            maxHeaderScore = score;
            headerRowIndex = rIdx;
          }
        }

        // คลีนและสร้างรายการหัวตาราง
        const headerRow = (bestRows[headerRowIndex] || []).map((h: any) => 
          String(h || '').trim().toLowerCase().replace(/[\r\n\t*]/g, ' ')
        );

        // หาตำแหน่งคอลัมน์แบบยืดหยุ่นสูง (รองรับหลายชื่อเรียกทั้งไทยและอังกฤษ พร้อมตัดคำที่อาจชนกัน)
        const findColIndex = (keywords: string[], negativeKeywords?: string[], exactTokens?: string[]) => {
          return headerRow.findIndex((col: string) => {
            if (!col) return false;
            // ตรวจสอบคำที่ไม่ต้องการก่อน
            if (negativeKeywords && negativeKeywords.some(neg => col.includes(neg.toLowerCase()))) {
              return false;
            }
            // ตรวจสอบคำย่อสั้นๆ ด้วย Word Boundary (เช่น 'er', 'ipd', 'opd') ป้องกันการชนกับคำว่า order, number, supplier
            if (exactTokens && exactTokens.some(tok => {
              const regex = new RegExp(`(^|[^a-zA-Z0-9ก-๙])${tok}([^a-zA-Z0-9ก-๙]|$)`, 'i');
              return regex.test(col);
            })) {
              return true;
            }
            // ตรวจสอบคำค้นทั่วไป
            return keywords.some(kw => col.includes(kw.toLowerCase()));
          });
        };

        const idxId = findColIndex(['รหัสยา', 'code', 'id', 'drug_id', 'item_id', 'drugcode', 'itemcode', 'รหัสสินค้า', 'รหัสเวชภัณฑ์', 'barcode']);
        const idxName = findColIndex(['ชื่อยา', 'drug', 'name', 'item', 'รายการยา', 'ชื่อสามัญ', 'generic', 'เวชภัณฑ์', 'รายการ', 'ชื่อ', 'ชื่อการค้า', 'description', 'รายการเวชภัณฑ์', 'medication', 'medicine']);
        const idxShelf = findColIndex(['shelf', 'ชั้นวาง', 'ชั้น', 'ช่อง', 'ที่เก็บ', 'location', 'ตู้', 'ตำแหน่ง', 'ช่องเก็บ', 'rack', 'bin', 'loc']);
        const idxLot = findColIndex(['lot', 'batch', 'รุ่น', 'เลขที่ผลิต', 'lot no', 'lotno', 'batch no', 'batchno', 'เลขล็อต', 'รุ่นที่ผลิต', 'lot_no', 'batch_no']);
        const idxCompany = findColIndex(['บริษัท', 'company', 'manufacturer', 'ผู้ผลิต', 'ผู้จำหน่าย', 'vendor', 'supplier', 'บ.', 'ตัวแทน', 'บจก']);
        const idxSource = findColIndex(['แหล่ง', 'source', 'ที่มา', 'จัดซื้อ', 'งบ', 'ประเภทการจัดซื้อ', 'แหล่งที่มา']);
        // สำหรับคลังย่อย: ตรวจสอบอย่างละเอียด พร้อมป้องกันการชนกับ "คงคลัง", "ยอด", "supplier", "order"
        let idxSubWh = findColIndex(
          [
            'คลังย่อย', 'คลัง', 'ประเภทคลัง', 'คลังยา', 'ห้องยา', 'แผนก', 'หน่วยงาน', 'จุดบริการ', 
            'ตึก', 'วอร์ด', 'หอผู้ป่วย', 'จุดจ่าย', 'ห้องจ่าย', 'หน่วยเบิก', 'คลังเบิก', 'จุดเบิก',
            'department', 'dept', 'sub-warehouse', 'subwarehouse', 'sub warehouse', 'sub_warehouse',
            'subwh', 'warehouse', 'opd/ipd/er', 'opd / ipd / er', 'opd/er/ipd', 'opd/ipd', 'er/opd/ipd'
          ],
          ['คงคลัง', 'ยอด', 'จำนวน', 'qty', 'quantity', 'สต็อก', 'balance', 'remain', 'shelf', 'lot', 'ราคา', 'price', 'cost', 'มูลค่า', 'company', 'บริษัท', 'supplier', 'order', 'number'],
          ['opd', 'ipd', 'er', 'wh', 'ward', 'dept']
        );
        const idxExpiry = findColIndex(['วันหมดอายุ', 'หมดอายุ', 'exp', 'expiry', 'ed', 'exp_date', 'expdate', 'expiration', 'วันที่หมดอายุ', 'วันสิ้นอายุ', 'expire']);
        const idxQty = findColIndex(['จำนวนคงเหลือ', 'คงเหลือ', 'จำนวน', 'qty', 'quantity', 'ยอดคงเหลือ', 'ยอด', 'สต็อก', 'balance', 'remain', 'on hand', 'onhand', 'ยอดรวม', 'ปริมาณ', 'คงคลัง', 'stock']);
        const idxUnit = findColIndex(['หน่วยนับย่อย', 'หน่วยย่อย', 'หน่วยนับ', 'หน่วย', 'unit', 'uom', 'หน่วยเล็ก']);
        const idxPackageUnit = findColIndex(['หน่วยบรรจุ', 'ขนาดบรรจุ', 'บรรจุ', 'package unit', 'pack size', 'packaging', 'pack', 'package', 'หน่วยแพ็ค', 'ขนาดแพ็ค', 'หน่วยใหญ่', 'ขนาดบรรจุ/กล่อง', 'แพ็ค', 'บรรจุต่อกล่อง', 'หน่วยบรรจุภัณฑ์', 'packsize']);
        const idxMin = findColIndex(['min', 'ต่ำสุด', 'ขั้นต่ำ', 'จุดสั่งซื้อ', 'min stock', 'minimum', 'เกณฑ์ต่ำ', 'เกณฑ์ min']);
        const idxMax = findColIndex(['max', 'สูงสุด', 'เกณฑ์สูง', 'max stock', 'maximum', 'เกณฑ์ max']);
        const idxReceived = findColIndex(['วันที่รับ', 'รับเข้า', 'รับ', 'received', 'date_in', 'วันที่รับเข้า', 'receive date', 'วันรับยา']);
        const idxNotes = findColIndex(['หมายเหตุ', 'note', 'remark', 'remarks', 'สถานะ', 'comment', 'รายละเอียดเพิ่มเติม']);

        // ระบบตรวจจับคอลัมน์คลังย่อยอัตโนมัติจากเนื้อหาแถว (ถ้าหัวตารางไม่ระบุชัดเจน)
        if (idxSubWh === -1 && bestRows.length > headerRowIndex + 1) {
          const sampleRows = bestRows.slice(headerRowIndex + 1, Math.min(bestRows.length, headerRowIndex + 30));
          const maxCols = Math.max(...sampleRows.map(r => Array.isArray(r) ? r.length : 0));
          let bestCol = -1;
          let bestWhCount = 0;

          for (let c = 0; c < maxCols; c++) {
            // ข้ามคอลัมน์ที่เป็นชื่อยา, id, lot, วันหมดอายุ, หรือจำนวนอยู่แล้ว
            if (c === idxName || c === idxId || c === idxLot || c === idxExpiry || c === idxQty) continue;

            let whMatches = 0;
            for (const sr of sampleRows) {
              if (!sr || !Array.isArray(sr)) continue;
              const cellStr = String(sr[c] || '').trim().toUpperCase();
              if (
                cellStr === 'OPD' || cellStr === 'IPD' || cellStr === 'ER' ||
                cellStr.includes('ผู้ป่วยนอก') || cellStr.includes('ผู้ป่วยใน') || cellStr.includes('ฉุกเฉิน') ||
                cellStr.includes('หอผู้ป่วย') || cellStr.includes('วอร์ด') || cellStr === 'WARD'
              ) {
                whMatches++;
              }
            }

            if (whMatches > bestWhCount) {
              bestWhCount = whMatches;
              bestCol = c;
            }
          }

          if (bestWhCount >= 1) {
            idxSubWh = bestCol;
          }
        }

        const parsedList: ParsedImportRow[] = [];

        for (let i = headerRowIndex + 1; i < bestRows.length; i++) {
          const row = bestRows[i];
          if (!row || row.length === 0 || !row.some((cell: any) => cell !== null && cell !== '')) {
            continue; // ข้ามแถวว่าง
          }

          // ตรวจสอบแถวสรุปยอด เช่น "รวมทั้งหมด", "Total", "Grand Total"
          const firstCellText = String(row[0] || '').trim().toLowerCase();
          if (firstCellText.startsWith('รวม') || firstCellText.startsWith('total') || firstCellText.startsWith('grand total') || firstCellText.startsWith('subtotal')) {
            continue;
          }

          // 1. ดึงชื่อยา
          let rawName = '';
          if (idxName !== -1 && row[idxName]) {
            rawName = String(row[idxName]).trim();
          } else if (idxId !== -1 && row[idxId === 0 ? 1 : 0]) {
            rawName = String(row[idxId === 0 ? 1 : 0]).trim();
          } else if (row[0]) {
            rawName = String(row[0]).trim();
          }

          // ข้ามถ้าไม่มีชื่อยา หรือเป็นคำที่ไม่ใช่ชื่อยา
          if (!rawName || rawName === '-' || rawName.toLowerCase() === 'name') continue;

          // 2. ดึงรหัสยา
          const rawId = idxId !== -1 && row[idxId] ? String(row[idxId]).trim() : undefined;

          // 3. Shelf, Lot, Company
          const rawShelf = idxShelf !== -1 && row[idxShelf] ? String(row[idxShelf]).trim() : 'ทั่วไป';
          const rawLot = idxLot !== -1 && row[idxLot] ? String(row[idxLot]).trim() : 'LOT-' + Date.now().toString().slice(-4);
          const rawCompany = idxCompany !== -1 && row[idxCompany] ? String(row[idxCompany]).trim() : 'องค์การเภสัชกรรม (GPO)';

          // 4. Source & SubWarehouse (ส่งชื่อ Sheet ด้วยเพื่อให้ตรวจสอบคลังของทั้งชีทได้)
          const rawSource = parseSource(idxSource !== -1 ? row[idxSource] : '', rawCompany);
          const rawSubWh = parseSubWarehouse(idxSubWh !== -1 ? row[idxSubWh] : '', rawShelf, row, bestSheetName);

          // 5. วันหมดอายุ
          const expCell = idxExpiry !== -1 ? row[idxExpiry] : undefined;
          const rawExpiry = parseRobustDate(expCell, 1);

          // 6. จำนวนคงเหลือ
          const rawQty = parseCleanNumber(idxQty !== -1 ? row[idxQty] : 0, 0);

          // 7. หน่วยนับย่อย และ หน่วยบรรจุ
          let directUnit = idxUnit !== -1 && row[idxUnit] ? String(row[idxUnit]).trim() : 'หน่วย';
          let directPkgUnit = idxPackageUnit !== -1 && row[idxPackageUnit] ? String(row[idxPackageUnit]).trim() : '';

          // แยกหน่วยนับและหน่วยบรรจุอัตโนมัติหากปนกัน
          const separated = parseUnitAndPackage(directUnit, directPkgUnit);
          const finalUnit = separated.unit || 'หน่วย';
          const finalPackageUnit = separated.packageUnit || directPkgUnit || '';

          // 8. Min / Max
          const rawMin = parseCleanNumber(idxMin !== -1 ? row[idxMin] : 0, 0);
          const rawMax = parseCleanNumber(idxMax !== -1 ? row[idxMax] : 0, 0);

          // 9. วันที่รับเข้า
          const recCell = idxReceived !== -1 ? row[idxReceived] : undefined;
          const rawReceived = parseRobustDate(recCell, 0);

          // 10. หมายเหตุ
          const rawNotes = idxNotes !== -1 && row[idxNotes] ? String(row[idxNotes]).trim() : '';

          const isValid = Boolean(rawName && rawExpiry);
          let validationError: string | undefined;
          if (!rawName) validationError = 'ไม่มีชื่อยา';
          else if (!rawExpiry) validationError = 'ไม่มีวันหมดอายุ';
          else if (rawQty < 0) validationError = 'จำนวนคงเหลือติดลบ';

          parsedList.push({
            id: rawId,
            name: rawName,
            shelf: rawShelf || 'ทั่วไป',
            lot: rawLot || 'N/A',
            company: rawCompany || 'ไม่ระบุ',
            source: rawSource,
            subWarehouse: rawSubWh,
            expiryDate: rawExpiry,
            quantity: rawQty,
            unit: finalUnit,
            packageUnit: finalPackageUnit,
            min: rawMin,
            max: rawMax,
            receivedDate: rawReceived,
            notes: rawNotes,
            isValid,
            validationError,
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
 * ดาวน์โหลดไฟล์ตัวอย่าง Template Excel สำหรับคลังยา (มีคอลัมน์หน่วยบรรจุ)
 */
export function downloadExcelTemplate() {
  const headers = [
    'ชื่อยา (Drug Name)',
    'Shelf (ชั้นวาง)',
    'Lot No.',
    'บริษัทผู้จัดจำหน่าย',
    'แหล่งที่มา (GPO / ไม่ใช่ GPO / รพ.พัทลุง)',
    'คลังย่อย (OPD / IPD / ER)',
    'วันหมดอายุ (YYYY-MM-DD หรือ วัน/เดือน/ปี)',
    'จำนวนคงเหลือ',
    'หน่วยนับย่อย',
    'หน่วยบรรจุ (Package Unit)',
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
      '10x10 เม็ด/กล่อง',
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
      350,
      'แคปซูล',
      '50x10 แคปซูล/กล่อง',
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
      '1 Vial/กล่อง',
      30,
      100,
      '2026-03-20',
      'ยาต้านจุลชีพ',
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  
  ws['!cols'] = [
    { wch: 30 }, // ชื่อยา
    { wch: 15 }, // shelf
    { wch: 15 }, // lot
    { wch: 25 }, // บริษัท
    { wch: 20 }, // แหล่งที่มา
    { wch: 15 }, // คลังย่อย
    { wch: 22 }, // วันหมดอายุ
    { wch: 14 }, // จำนวนคงเหลือ
    { wch: 14 }, // หน่วยนับย่อย
    { wch: 22 }, // หน่วยบรรจุ
    { wch: 12 }, // min
    { wch: 12 }, // max
    { wch: 14 }, // วันที่รับ
    { wch: 25 }, // หมายเหตุ
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template คลังยา');
  XLSX.writeFile(wb, 'แบบฟอร์มนำเข้าคลังยา_รพ_เขาชัยสน.xlsx');
}

/**
 * ส่งออกรายการยาเป็น Excel พร้อมหน่วยบรรจุ
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
    'หน่วยนับย่อย',
    'หน่วยบรรจุ (Package Unit)',
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
      d.packageUnit || '-',
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
    { wch: 12 }, // หน่วยนับย่อย
    { wch: 20 }, // หน่วยบรรจุ
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
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}
