import { DrugItem, DispenseRecord, GasConfig } from '../types/inventory';
import { getDrugStatus, getSimpleDrugStatus, parseUnitAndPackage, formatUnitForSheet } from '../utils/drugUtils';

/**
 * วิเคราะห์และตรวจสอบผลการตอบกลับจาก Google Apps Script อย่างละเอียด
 * ป้องกันการแสดงผลว่าสำเร็จทั้งที่ Google ตอบกลับเป็น Error HTML / Script function not found
 */
export function parseGasResponse(resText: string): { success: boolean; data?: any; error?: string } {
  if (!resText || !resText.trim()) {
    return { success: false, error: 'ไม่ได้รับการตอบกลับจากเซิร์ฟเวอร์ Google Apps Script' };
  }

  // 1. ตรวจสอบกรณี Google Apps Script แจ้งว่าไม่พบฟังก์ชัน doGet หรือ doPost
  if (resText.includes('Script function not found: doGet') || resText.includes('Script function not found: doPost')) {
    return {
      success: false,
      error: 'Google Apps Script แจ้ง: "Script function not found (doGet/doPost)" — โค้ดใน Code.gs ยังไม่ได้ถูกบันทึก หรือยังไม่ได้กด Deploy เวอร์ชันใหม่ (Manage deployments > Edit > New version)',
    };
  }

  if (resText.includes('Script function not found')) {
    return {
      success: false,
      error: 'Google Apps Script แจ้ง: "Script function not found" — กรุณานำโค้ด Code.gs ไปวางใน Apps Script และกด Deploy -> New version',
    };
  }

  // 2. ตรวจสอบกรณีสิทธิ์การเข้าถึง (ต้องตั้ง Deploy เป็น Anyone)
  if (
    resText.includes('accounts.google.com') ||
    resText.includes('Sign in') ||
    resText.includes('Authorization is required') ||
    resText.includes('Sign in with Google')
  ) {
    return {
      success: false,
      error: 'Google Apps Script แจ้งสิทธิ์เข้าถึง: กรุณาตั้งค่า Deploy Web App ตรง "Who has access" (ผู้มีสิทธิ์เข้าถึง) ให้เป็น "Anyone" (ทุกคน)',
    };
  }

  // 3. ตรวจสอบ JSON ปกติ
  try {
    const json = JSON.parse(resText);
    if (json.status === 'success') {
      return { success: true, data: json };
    }
    return { success: false, error: json.message || 'Google Apps Script รายงานข้อผิดพลาด' };
  } catch {
    // 4. กรณีเป็นหน้า HTML ผิดพลาดของ Google
    if (resText.startsWith('<!DOCTYPE html>') || resText.includes('<html')) {
      const titleMatch = resText.match(/<title>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : 'Google Error';
      return {
        success: false,
        error: `Google Apps Script ตอบกลับเป็นหน้าข้อผิดพลาด (${title}) — กรุณาตรวจสอบว่าวางโค้ดใน Code.gs ครบถ้วนและ Deploy New Version หรือยัง`,
      };
    }
    return { success: false, error: resText.slice(0, 150) };
  }
}

export const GasApiService = {
  /**
   * ทดสอบการเชื่อมต่อ Google Apps Script อย่างละเอียด
   */
  async testConnection(config: GasConfig): Promise<{ success: boolean; message: string; details?: any }> {
    if (!config.scriptUrl) {
      return { success: false, message: 'ยังไม่ได้ระบุ Web App URL ของ Google Apps Script' };
    }

    try {
      const url = `${config.scriptUrl}${config.scriptUrl.includes('?') ? '&' : '?'}action=test&sheetId=${encodeURIComponent(config.sheetId)}&t=${Date.now()}`;
      const res = await fetch(url, { method: 'GET', redirect: 'follow' });
      const text = await res.text();
      const parsed = parseGasResponse(text);

      if (!parsed.success) {
        return { success: false, message: parsed.error || 'ทดสอบเชื่อมต่อไม่สำเร็จ' };
      }

      return {
        success: true,
        message: 'เชื่อมต่อ Google Apps Script สำเร็จสมบูรณ์ พร้อมรับส่งข้อมูลกับ Google Sheet',
        details: parsed.data,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `เชื่อมต่อไม่สำเร็จ (${err.message || 'Network/CORS error'}): กรุณาตรวจสอบว่าเปิด Deploy เป็น Anyone (ทุกคน) หรือยัง`,
      };
    }
  },

  /**
   * ดึงข้อมูลยาจาก Google Apps Script (doGet)
   */
  async fetchDrugs(config: GasConfig): Promise<{ success: boolean; items?: DrugItem[]; error?: string }> {
    if (!config.scriptUrl) {
      return { success: false, error: 'ยังไม่ได้ระบุ Web App URL ของ Google Apps Script' };
    }

    try {
      const url = `${config.scriptUrl}${config.scriptUrl.includes('?') ? '&' : '?'}action=getItems&sheetId=${encodeURIComponent(config.sheetId)}&t=${Date.now()}`;
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
      });

      const resText = await response.text();
      const parsed = parseGasResponse(resText);

      if (!parsed.success) {
        return { success: false, error: parsed.error };
      }

      const data = parsed.data;
      if (Array.isArray(data?.items)) {
        const normalizedItems: DrugItem[] = data.items.map((i: any) => {
          const { unit, packageUnit } = parseUnitAndPackage(i.unit, i.packageUnit);
          return {
            ...i,
            unit,
            packageUnit: packageUnit || i.packageUnit || '',
          };
        });
        return { success: true, items: normalizedItems };
      } else {
        return { success: false, error: data?.message || 'ไม่พบรายการข้อมูลใน Sheet' };
      }
    } catch (err: any) {
      console.warn('GAS fetch error:', err);
      return {
        success: false,
        error: `การเชื่อมต่อขัดข้อง: ${err.message || 'CORS/Network error'} (กรุณาตรวจสอบว่าตั้งสิทธิ์ Deploy เป็น Anyone หรือยัง)`,
      };
    }
  },

  /**
   * ส่งข้อมูลยาขึ้น Google Sheet ทั้งหมด (doPost syncAll)
   */
  async syncAllToGas(config: GasConfig, items: DrugItem[]): Promise<{ success: boolean; error?: string }> {
    if (!config.scriptUrl) {
      return { success: false, error: 'ยังไม่ได้ระบุ Web App URL' };
    }

    try {
      const enrichedItems = items.map((item) => {
        const st = getDrugStatus(item);
        let expText = '✅ ปลอดภัย';
        if (st.expiryStatus === 'expired') {
          expText = `🚨 หมดอายุแล้ว (เลยมา ${Math.abs(st.daysLeft)} วัน)`;
        } else if (st.expiryStatus === 'near_expiry') {
          expText = `⏳ ใกล้หมดอายุ (เหลือ ${st.daysLeft} วัน)`;
        } else {
          expText = `✅ ปลอดภัย (เหลือ ${st.daysLeft} วัน)`;
        }

        let stockText = '✅ สต็อกปกติ';
        if (item.quantity <= 0) {
          stockText = '🔴 สต็อกหมด (0)';
        } else if (item.quantity <= item.min) {
          stockText = `⚠️ ถึงเกณฑ์ Min หรือต่ำกว่า (${item.quantity}/${item.min})`;
        } else if (item.max > 0 && item.quantity > item.max) {
          stockText = `📦 สต็อกเกิน Max (${item.quantity}/${item.max})`;
        } else {
          stockText = `✅ สต็อกปกติ (${item.quantity})`;
        }

        let alertSummaryText = '🟢 ปกติ';
        if (st.expiryStatus === 'expired') {
          alertSummaryText = '🔴 หมดอายุแล้ว (ต้องทำลาย/ส่งคืน)';
        } else if (st.expiryStatus === 'near_expiry' && st.stockStatus === 'low') {
          alertSummaryText = '⚡ วิกฤต: ใกล้หมดอายุ & ต่ำกว่า Min';
        } else if (st.expiryStatus === 'near_expiry') {
          alertSummaryText = '🟡 ใกล้หมดอายุ (≤ 70 วัน)';
        } else if (st.stockStatus === 'low') {
          alertSummaryText = '🟠 ถึงเกณฑ์ Min (ต้องสั่งเพิ่ม)';
        }

        // ปรับหมายเหตุให้เป็นสถานะตาม chart: ปลอดภัย, ใกล้หมดอายุ, หมดอายุ, สต็อกถึงเกณฑ์ min
        const simpleStatus = getSimpleDrugStatus(item);
        const statusText = simpleStatus.text;

        const formattedUnit = formatUnitForSheet(item.unit, item.packageUnit);

        return {
          ...item,
          unit: formattedUnit,
          packageUnit: item.packageUnit || '',
          notes: statusText,
          expiryStatusText: expText,
          stockStatusText: stockText,
          alertSummaryText: alertSummaryText,
          daysLeft: st.daysLeft,
        };
      });

      const payload = {
        action: 'syncAll',
        sheetId: config.sheetId,
        items: enrichedItems,
      };

      // ใช้ text/plain เพื่อป้องกัน CORS preflight issue ใน Google Apps Script
      const response = await fetch(config.scriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      const resText = await response.text();
      const parsed = parseGasResponse(resText);
      if (!parsed.success) {
        return { success: false, error: parsed.error };
      }

      return { success: true };
    } catch (err: any) {
      console.warn('Sync to GAS error:', err);
      return { success: false, error: err.message || 'เกิดข้อผิดพลาดในการส่งข้อมูล' };
    }
  },

  /**
   * บันทึกรายการเดี่ยว (เพิ่มหรือแก้ไข)
   */
  async saveItemToGas(config: GasConfig, item: DrugItem): Promise<{ success: boolean; error?: string }> {
    if (!config.scriptUrl) return { success: false, error: 'URL not set' };

    try {
      const st = getDrugStatus(item);
      let expText = '✅ ปลอดภัย';
      if (st.expiryStatus === 'expired') {
        expText = `🚨 หมดอายุแล้ว (เลยมา ${Math.abs(st.daysLeft)} วัน)`;
      } else if (st.expiryStatus === 'near_expiry') {
        expText = `⏳ ใกล้หมดอายุ (เหลือ ${st.daysLeft} วัน)`;
      } else {
        expText = `✅ ปลอดภัย (เหลือ ${st.daysLeft} วัน)`;
      }

      let stockText = '✅ สต็อกปกติ';
      if (item.quantity <= 0) {
        stockText = '🔴 สต็อกหมด (0)';
      } else if (item.quantity <= item.min) {
        stockText = `⚠️ ถึงเกณฑ์ Min หรือต่ำกว่า (${item.quantity}/${item.min})`;
      } else if (item.max > 0 && item.quantity > item.max) {
        stockText = `📦 สต็อกเกิน Max (${item.quantity}/${item.max})`;
      } else {
        stockText = `✅ สต็อกปกติ (${item.quantity})`;
      }

      const simpleStatus = getSimpleDrugStatus(item);
      const statusText = simpleStatus.text;
      const formattedUnit = formatUnitForSheet(item.unit, item.packageUnit);

      const enrichedItem = {
        ...item,
        unit: formattedUnit,
        packageUnit: item.packageUnit || '',
        notes: statusText,
        expiryStatusText: expText,
        stockStatusText: stockText,
        daysLeft: st.daysLeft,
      };

      const payload = {
        action: 'saveItem',
        sheetId: config.sheetId,
        item: enrichedItem,
      };

      const res = await fetch(config.scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });

      const resText = await res.text();
      const parsed = parseGasResponse(resText);
      if (!parsed.success) {
        return { success: false, error: parsed.error };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * ลบรายการยา
   */
  async deleteItemFromGas(config: GasConfig, id: string): Promise<{ success: boolean; error?: string }> {
    if (!config.scriptUrl) return { success: false, error: 'URL not set' };

    try {
      const payload = {
        action: 'deleteItem',
        sheetId: config.sheetId,
        id: id,
      };

      const res = await fetch(config.scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });

      const resText = await res.text();
      const parsed = parseGasResponse(resText);
      if (!parsed.success) {
        return { success: false, error: parsed.error };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * ลบหลายรายการพร้อมกัน (Bulk Delete)
   */
  async deleteMultipleItemsFromGas(config: GasConfig, ids: string[]): Promise<{ success: boolean; error?: string; count?: number }> {
    if (!config.scriptUrl) return { success: false, error: 'URL not set' };

    try {
      const payload = {
        action: 'deleteMultiple',
        sheetId: config.sheetId,
        ids: ids,
      };

      const res = await fetch(config.scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });

      const resText = await res.text();
      const parsed = parseGasResponse(resText);
      if (!parsed.success) {
        return { success: false, error: parsed.error };
      }
      return { success: true, count: parsed.data?.deletedCount ?? ids.length };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * อัปเดตหัวตารางในชีทให้เป็น 19 คอลัมน์ (เพิ่มหน่วยบรรจุ)
   */
  async initHeadersInGas(config: GasConfig): Promise<{ success: boolean; error?: string }> {
    if (!config.scriptUrl) return { success: false, error: 'URL not set' };

    try {
      const payload = {
        action: 'initHeaders',
        sheetId: config.sheetId,
      };

      const res = await fetch(config.scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });

      const resText = await res.text();
      const parsed = parseGasResponse(resText);
      if (!parsed.success) {
        return { success: false, error: parsed.error };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * บันทึกการตัดยอดลง Google Sheet
   */
  async dispenseItemToGas(config: GasConfig, record: DispenseRecord): Promise<{ success: boolean; error?: string }> {
    if (!config.scriptUrl) return { success: false, error: 'URL not set' };

    try {
      const payload = {
        action: 'dispense',
        sheetId: config.sheetId,
        record: record,
      };

      const res = await fetch(config.scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });

      const resText = await res.text();
      const parsed = parseGasResponse(resText);
      if (!parsed.success) {
        return { success: false, error: parsed.error };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * อัปโหลดไฟล์ PDF หรือ Excel ขึ้น Google Drive Folder ID: 1O8MiCSQ43f2aoI7HvcPPY4EM97szYqlb
   */
  async uploadFileToDrive(
    config: GasConfig,
    fileName: string,
    base64Data: string,
    mimeType: string
  ): Promise<{ success: boolean; fileUrl?: string; fileId?: string; error?: string }> {
    if (!config.scriptUrl) return { success: false, error: 'URL not set' };

    try {
      const payload = {
        action: 'uploadFile',
        folderId: config.folderId,
        fileName: fileName,
        base64Data: base64Data,
        mimeType: mimeType,
      };

      const res = await fetch(config.scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (json.status === 'success') {
          return { success: true, fileUrl: json.fileUrl, fileId: json.fileId };
        }
        return { success: false, error: json.message || 'ไม่สามารถอัปโหลดไฟล์ได้' };
      } catch {
        return { success: true, fileUrl: `https://drive.google.com/drive/folders/${config.folderId}` };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * ยิง LINE แจ้งเตือนผ่าน Google Apps Script
   */
  async triggerLineAlertViaGas(
    config: GasConfig,
    token: string,
    to: string,
    messageText: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!config.scriptUrl) return { success: false, error: 'URL not set' };

    try {
      const payload = {
        action: 'sendLineAlert',
        token: token,
        to: to,
        messageText: messageText,
      };

      const res = await fetch(config.scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch {}

      if (json.status === 'success') {
        return { success: true };
      }
      return { success: false, error: json.message || 'ส่งข้อความไม่สำเร็จ' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
