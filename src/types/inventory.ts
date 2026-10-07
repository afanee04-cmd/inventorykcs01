export type SourceType = 'GPO' | 'ไม่ใช่ GPO' | 'รพ.พัทลุง' | 'อื่นๆ';

export type SubWarehouse = 'OPD' | 'IPD' | 'ER' | 'คลังใหญ่ (Main)';

export interface DrugItem {
  id: string;
  name: string;           // ชื่อยา
  shelf: string;          // ตำแหน่ง shelf / ช่องเก็บ
  lot: string;            // หมายเลข Lot
  company: string;        // บริษัทผู้ผลิต/จัดจำหน่าย
  source: SourceType;     // แหล่งที่มา: GPO, ไม่ใช่ GPO, รพ.พัทลุง
  subWarehouse: SubWarehouse; // คลังย่อย: OPD, IPD, ER, คลังใหญ่
  expiryDate: string;     // วันหมดอายุ (YYYY-MM-DD)
  quantity: number;       // ปริมาณคงเหลือ
  unit: string;           // หน่วยนับ เช่น เม็ด, แคปซูล, แผง, ขวด, หลอด
  packageUnit?: string;   // หน่วยบรรจุ เช่น 10x10 เม็ด/กล่อง, 500 เม็ด/ขวด, 10 ขวด/ลัง
  min: number;            // ปริมาณต่ำสุด (Min)
  max: number;            // ปริมาณสูงสุด (Max)
  receivedDate: string;   // วันที่รับเข้า
  notes?: string;         // หมายเหตุ
  updatedAt?: string;
}

export interface DispenseRecord {
  id: string;
  drugId: string;
  drugName: string;
  lot: string;
  amount: number;
  unit: string;
  fromWarehouse: SubWarehouse;
  toDepartment: string;
  requestedBy: string;
  dispensedAt: string;
  reason: string;
  remainingAfter: number;
}

export interface LineConfig {
  channelAccessToken: string;
  destinationId: string;       // User ID หรือ Group ID
  autoAlertEnabled: boolean;
  alertDaysBeforeExpiry: number; // 70 วัน
  lastAlertSentAt: string | null;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
  notifyOnSave: boolean;
  notifyOnDispense: boolean;
  notifyOnStatusChange: boolean;
  lastAlertSentAt: string | null;
}

export interface GasConfig {
  sheetId: string;
  scriptUrl: string;
  folderId: string;
  autoSync: boolean;
  lastSyncTime: string | null;
}

export type ExpiryStatus = 'expired' | 'near_expiry' | 'safe';
export type StockStatus = 'low' | 'normal' | 'over';

export interface DrugStatusSummary {
  daysLeft: number;
  expiryStatus: ExpiryStatus;
  stockStatus: StockStatus;
  isUrgent: boolean;
}
