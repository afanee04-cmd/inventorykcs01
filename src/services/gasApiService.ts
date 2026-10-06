import { DrugItem, DispenseRecord, GasConfig } from '../types/inventory';
import { getDrugStatus, getSimpleDrugStatus } from '../utils/drugUtils';

export const GasApiService = {
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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.status === 'success' && Array.isArray(data.items)) {
        return { success: true, items: data.items };
      } else {
        return { success: false, error: data.message || 'ไม่พบรายการข้อมูลใน Sheet' };
      }
    } catch (err: any) {
      console.warn('GAS fetch error (may require Web App deploy with "Anyone" access):', err);
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

        return {
          ...item,
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
      let resJson: any;
      try {
        resJson = JSON.parse(resText);
      } catch {
        resJson = { status: 'success' };
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

      const enrichedItem = {
        ...item,
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

      await fetch(config.scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
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

      await fetch(config.scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
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

      await fetch(config.scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
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
