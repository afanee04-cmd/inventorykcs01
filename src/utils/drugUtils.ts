import { DrugItem, DrugStatusSummary } from '../types/inventory';

/**
 * คำนวณสถานะวันหมดอายุและสต็อกของยา
 * - ใกล้หมดอายุ: <= 70 วัน
 * - หมดอายุแล้ว: < 0 วัน
 * - สต็อกต่ำ: quantity <= min
 */
export function getDrugStatus(drug: DrugItem, customCurrentDate?: Date): DrugStatusSummary {
  const now = customCurrentDate || new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const expiry = new Date(drug.expiryDate);
  const expiryOnly = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  
  const diffTime = expiryOnly.getTime() - today.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let expiryStatus: 'expired' | 'near_expiry' | 'safe' = 'safe';
  if (daysLeft < 0) {
    expiryStatus = 'expired';
  } else if (daysLeft <= 70) {
    expiryStatus = 'near_expiry';
  }

  let stockStatus: 'low' | 'normal' | 'over' = 'normal';
  if (drug.quantity <= drug.min) {
    stockStatus = 'low';
  } else if (drug.max > 0 && drug.quantity > drug.max) {
    stockStatus = 'over';
  }

  const isUrgent = expiryStatus === 'expired' || expiryStatus === 'near_expiry' || stockStatus === 'low';

  return {
    daysLeft,
    expiryStatus,
    stockStatus,
    isUrgent,
  };
}

/**
 * ฟอร์แมตวันที่เป็นภาษาไทย พ.ศ.
 */
export function formatThaiDate(dateString: string | undefined): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = d.getDate();
    const months = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const month = months[d.getMonth()];
    const thaiYear = d.getFullYear() + 543;
    return `${day} ${month} ${thaiYear}`;
  } catch {
    return dateString;
  }
}

/**
 * แปลงจำนวนวันคงเหลือเป็นข้อความแสดงผล
 */
export function getDaysLeftBadge(daysLeft: number): {
  text: string;
  badgeClass: string;
  borderClass: string;
} {
  if (daysLeft < 0) {
    return {
      text: `หมดอายุแล้ว (${Math.abs(daysLeft)} วัน)`,
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-semibold',
      borderClass: 'border-l-4 border-rose-600',
    };
  }
  if (daysLeft === 0) {
    return {
      text: 'หมดอายุวันนี้',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold animate-pulse',
      borderClass: 'border-l-4 border-rose-600',
    };
  }
  if (daysLeft <= 70) {
    return {
      text: `ใกล้หมดอายุ (เหลือ ${daysLeft} วัน)`,
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-semibold',
      borderClass: 'border-l-4 border-amber-500',
    };
  }
  return {
    text: `เหลือ ${daysLeft} วัน`,
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    borderClass: 'border-l-4 border-emerald-500',
  };
}

export interface DrugStatusBadge {
  text: string;
  badgeClass: string;
  key: 'safe' | 'near_expiry' | 'expired' | 'low_stock';
}

/**
 * คำนวณสถานะแสดงในตารางและ Sheet ตาม chart สถานะวันหมดอายุ:
 * 1. ปลอดภัย (> 70 วัน)
 * 2. ใกล้หมดอายุ (≤ 70 วัน)
 * 3. หมดอายุ (หมดอายุแล้ว)
 * 4. สต็อกถึงเกณฑ์ min (quantity <= min)
 */
export function getSimpleDrugStatus(drug: DrugItem): {
  text: string;
  badgeClass: string;
  badges: DrugStatusBadge[];
  type: 'expired' | 'near_expiry' | 'safe' | 'low_stock';
} {
  const status = getDrugStatus(drug);
  const isExpired = status.expiryStatus === 'expired';
  const isNearExpiry = status.expiryStatus === 'near_expiry';
  const isBelowMin = Number(drug.quantity || 0) <= Number(drug.min || 0);

  const badges: DrugStatusBadge[] = [];

  // 1. สถานะวันหมดอายุ: หมดอายุ / ใกล้หมดอายุ / ปลอดภัย
  if (isExpired) {
    badges.push({
      text: 'หมดอายุ',
      badgeClass: 'bg-rose-100 text-rose-800 border border-rose-300 font-bold',
      key: 'expired',
    });
  } else if (isNearExpiry) {
    badges.push({
      text: 'ใกล้หมดอายุ',
      badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300 font-bold',
      key: 'near_expiry',
    });
  } else {
    badges.push({
      text: 'ปลอดภัย',
      badgeClass: 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold',
      key: 'safe',
    });
  }

  // 2. สถานะสต็อก: สต็อกถึงเกณฑ์ min
  if (isBelowMin) {
    badges.push({
      text: 'สต็อกถึงเกณฑ์ min',
      badgeClass: 'bg-orange-100 text-orange-900 border border-orange-300 font-bold',
      key: 'low_stock',
    });
  }

  const text = badges.map((b) => b.text).join(', ');

  let primaryBadgeClass = badges[0].badgeClass;
  if (isExpired) {
    primaryBadgeClass = 'bg-rose-100 text-rose-800 border border-rose-300 font-bold';
  } else if (isNearExpiry) {
    primaryBadgeClass = 'bg-amber-100 text-amber-900 border border-amber-300 font-bold';
  } else if (isBelowMin) {
    primaryBadgeClass = 'bg-orange-100 text-orange-900 border border-orange-300 font-bold';
  }

  return {
    text,
    badgeClass: primaryBadgeClass,
    badges,
    type: isExpired ? 'expired' : (isNearExpiry ? 'near_expiry' : (isBelowMin ? 'low_stock' : 'safe')),
  };
}

/**
 * แยกหน่วยนับย่อยและหน่วยบรรจุอย่างชาญฉลาดและเสถียร
 */
export function parseUnitAndPackage(unitRaw?: string, packageRaw?: string): { unit: string; packageUnit: string } {
  let pkgClean = (packageRaw || '').trim().replace(/^(?:หน่วยบรรจุ|ขนาดบรรจุ|บรรจุ|package|pack)[:\s]*/i, '').trim();
  let uClean = (unitRaw || '').trim();

  // หาก uClean มีข้อมูลบรรจุซ่อนอยู่ในวงเล็บ เช่น "เม็ด (บรรจุ: 10x10 เม็ด/กล่อง)" หรือ "แคปซูล [500 เม็ด/ขวด]"
  const bracketMatch = uClean.match(/^([^(|\[]+)(?:[(|\[]\s*(?:บรรจุ[:\s]*|package[:\s]*|pack[:\s]*)?([^)|\]]+)[)|\]])?/i);
  if (bracketMatch) {
    const extractedUnit = bracketMatch[1].trim();
    const extractedPkg = bracketMatch[2] ? bracketMatch[2].replace(/^(?:บรรจุ|package|pack)[:\s]*/i, '').trim() : '';
    if (extractedPkg && !pkgClean) {
      pkgClean = extractedPkg;
    }
    if (extractedUnit) {
      uClean = extractedUnit;
    }
  }

  // ป้องกันกรณีสลับคอลัมน์: ถ้าหน่วยนับมีเครื่องหมาย x หรือ slash เช่น "10x10 เม็ด/กล่อง" หรือ "100 tab/bot"
  // ให้สลับเป็น packageUnit อัตโนมัติ
  if (!pkgClean && (uClean.includes('x') || uClean.includes('X') || uClean.includes('/') || uClean.includes("'s") || uClean.includes('กล่อง') || uClean.includes('ลัง'))) {
    // ถ้าดูเหมือนหน่วยบรรจุมากกว่าหน่วยนับเดี่ยว
    if (uClean.match(/\d+\s*(?:x|\*|\/)\s*\d+/i) || uClean.includes('/กล่อง') || uClean.includes('/ขวด') || uClean.includes('/ลัง')) {
      pkgClean = uClean;
      // พยายามเดา unit ย่อย เช่น เม็ด, แคปซูล, แอมพูล
      if (uClean.includes('แคปซูล')) uClean = 'แคปซูล';
      else if (uClean.includes('เม็ด') || uClean.includes('tab')) uClean = 'เม็ด';
      else if (uClean.includes('vial') || uClean.includes('ไวยัล')) uClean = 'Vial';
      else if (uClean.includes('amp') || uClean.includes('แอมพูล')) uClean = 'Ampoule';
      else if (uClean.includes('ขวด')) uClean = 'ขวด';
      else if (uClean.includes('หลอด')) uClean = 'หลอด';
      else uClean = 'หน่วย';
    }
  }

  return {
    unit: uClean || 'หน่วย',
    packageUnit: pkgClean || '',
  };
}

/**
 * ฟอร์แมตหน่วยนับสำหรับบันทึกลง Google Sheet
 */
export function formatUnitForSheet(unit: string, packageUnit?: string): string {
  const u = (unit || '').trim() || 'หน่วย';
  return u;
}

/**
 * ข้อมูลตั้งต้นสำหรับตัวอย่างระบบคลังยานอก รพ.เขาชัยสน
 */
export const INITIAL_DRUGS: DrugItem[] = [
  {
    id: 'KCS-001',
    name: 'Paracetamol 500 mg Tablet',
    shelf: 'A1-02',
    lot: 'GPO67012',
    company: 'องค์การเภสัชกรรม (GPO)',
    source: 'GPO',
    subWarehouse: 'OPD',
    expiryDate: '2026-11-20',
    quantity: 1500,
    unit: 'เม็ด',
    packageUnit: '10x10 เม็ด/กล่อง',
    min: 2000,
    max: 10000,
    receivedDate: '2026-01-15',
    notes: 'ใกล้หมดอายุ, สต็อกถึงเกณฑ์ min',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'KCS-002',
    name: 'Amoxicillin 500 mg Capsule',
    shelf: 'B2-01',
    lot: 'LOT-AMX26B',
    company: 'บริษัท เบอร์ลินฟาร์มาซูติคอลฯ จำกัด',
    source: 'ไม่ใช่ GPO',
    subWarehouse: 'ER',
    expiryDate: '2026-10-18',
    quantity: 350,
    unit: 'แคปซูล',
    packageUnit: '50x10 แคปซูล/กล่อง',
    min: 500,
    max: 3000,
    receivedDate: '2026-03-10',
    notes: 'ใกล้หมดอายุ, สต็อกถึงเกณฑ์ min',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'KCS-003',
    name: 'Ceftriaxone 1g Injection Vial',
    shelf: 'C1-ตู้เย็น',
    lot: 'PTL-26089',
    company: 'โรงพยาบาลพัทลุง (เบิกแลกเปลี่ยน)',
    source: 'รพ.พัทลุง',
    subWarehouse: 'IPD',
    expiryDate: '2026-09-28',
    quantity: 20,
    unit: 'Vial',
    packageUnit: '1 Vial/กล่อง',
    min: 30,
    max: 100,
    receivedDate: '2026-02-01',
    notes: 'หมดอายุ, สต็อกถึงเกณฑ์ min',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'KCS-004',
    name: 'Omeprazole 20 mg Capsule',
    shelf: 'A2-03',
    lot: 'GPO-OM25A',
    company: 'องค์การเภสัชกรรม (GPO)',
    source: 'GPO',
    subWarehouse: 'OPD',
    expiryDate: '2027-04-15',
    quantity: 4500,
    unit: 'แคปซูล',
    packageUnit: '14 แคปซูล/แผง (10 แผง/กล่อง)',
    min: 1000,
    max: 8000,
    receivedDate: '2026-04-10',
    notes: 'ปลอดภัย',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'KCS-005',
    name: 'Morphine Injection 10 mg/mL',
    shelf: 'ตู้ยาเสพติด-ER',
    lot: 'GPO-M109',
    company: 'องค์การเภสัชกรรม (GPO)',
    source: 'GPO',
    subWarehouse: 'ER',
    expiryDate: '2026-11-05',
    quantity: 15,
    unit: 'Ampoule',
    packageUnit: '10 Ampoules/กล่อง',
    min: 20,
    max: 50,
    receivedDate: '2026-05-12',
    notes: 'ใกล้หมดอายุ, สต็อกถึงเกณฑ์ min',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'KCS-006',
    name: 'Furosemide 40 mg Tablet',
    shelf: 'A3-01',
    lot: 'SIL-FUR66',
    company: 'บริษัท ซิลลิคฟาร์มา จำกัด',
    source: 'ไม่ใช่ GPO',
    subWarehouse: 'IPD',
    expiryDate: '2027-08-30',
    quantity: 2800,
    unit: 'เม็ด',
    packageUnit: '500 เม็ด/ขวด',
    min: 800,
    max: 5000,
    receivedDate: '2026-06-01',
    notes: 'ปลอดภัย',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'KCS-007',
    name: 'Normal Saline Solution (NSS) 0.9% 1000 mL',
    shelf: 'Pallet-W01',
    lot: 'PTL-NSS-98',
    company: 'รพ.พัทลุง (คลังยาใหญ่)',
    source: 'รพ.พัทลุง',
    subWarehouse: 'ER',
    expiryDate: '2027-12-31',
    quantity: 85,
    unit: 'ขวด',
    packageUnit: '10 ขวด/ลัง',
    min: 100,
    max: 400,
    receivedDate: '2026-07-20',
    notes: 'ปลอดภัย, สต็อกถึงเกณฑ์ min',
    updatedAt: new Date().toISOString(),
  }
];
