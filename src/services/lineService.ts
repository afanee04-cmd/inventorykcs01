import { DrugItem, LineConfig, GasConfig } from '../types/inventory';
import { getDrugStatus, formatThaiDate } from '../utils/drugUtils';
import { GasApiService } from './gasApiService';

export interface AlertSummary {
  expiredList: { drug: DrugItem; daysLeft: number }[];
  nearExpiryList: { drug: DrugItem; daysLeft: number }[];
  lowStockList: { drug: DrugItem }[];
  totalAlerts: number;
}

export const LineService = {
  /**
   * สรุปรายการยาที่ต้องแจ้งเตือนตามเงื่อนไข:
   * 1. ยาใกล้หมดอายุ 70 วัน
   * 2. ยาหมดอายุ
   * 3. ยาที่ถึง min หรือต่ำกว่า
   */
  getAlertSummary(drugs: DrugItem[], daysThreshold: number = 70): AlertSummary {
    const expiredList: { drug: DrugItem; daysLeft: number }[] = [];
    const nearExpiryList: { drug: DrugItem; daysLeft: number }[] = [];
    const lowStockList: { drug: DrugItem }[] = [];

    drugs.forEach((drug) => {
      const status = getDrugStatus(drug);

      if (status.expiryStatus === 'expired') {
        expiredList.push({ drug, daysLeft: status.daysLeft });
      } else if (status.expiryStatus === 'near_expiry' && status.daysLeft <= daysThreshold) {
        nearExpiryList.push({ drug, daysLeft: status.daysLeft });
      }

      if (status.stockStatus === 'low') {
        lowStockList.push({ drug });
      }
    });

    return {
      expiredList,
      nearExpiryList,
      lowStockList,
      totalAlerts: expiredList.length + nearExpiryList.length + lowStockList.length,
    };
  },

  /**
   * สร้างข้อความแจ้งเตือนสำหรับ LINE
   */
  buildAlertMessage(drugs: DrugItem[], daysThreshold: number = 70): string {
    const summary = this.getAlertSummary(drugs, daysThreshold);
    const now = new Date();
    const dateFormatted = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear() + 543} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} น.`;

    if (summary.totalAlerts === 0) {
      return `🏥 [รายงานคลังยานอก รพ.เขาชัยสน]\n📅 ${dateFormatted}\n\n✅ สภาพสต็อกยาปกติ ไม่มีรายการยาหมดอายุ ใกล้หมดอายุ หรือต่ำกว่า Min`;
    }

    let msg = `🏥 [แจ้งเตือนคลังยานอก รพ.เขาชัยสน]\n📅 ประจำวันที่ ${dateFormatted}\n`;
    msg += `⚠️ พบรายการที่ต้องดำเนินการ ${summary.totalAlerts} รายการ\n`;

    // 1. ยาหมดอายุแล้ว
    if (summary.expiredList.length > 0) {
      msg += `\n🚨 ยาหมดอายุแล้ว (${summary.expiredList.length} รายการ):\n`;
      summary.expiredList.forEach((item, index) => {
        if (index < 6) {
          msg += `${index + 1}. ${item.drug.name} (Lot: ${item.drug.lot})\n   - คลัง: ${item.drug.subWarehouse} | แหล่ง: ${item.drug.source}\n   - หมดอายุ: ${formatThaiDate(item.drug.expiryDate)} (เลยมา ${Math.abs(item.daysLeft)} วัน)\n`;
        }
      });
      if (summary.expiredList.length > 6) {
        msg += `   ...และอีก ${summary.expiredList.length - 6} รายการ\n`;
      }
    }

    // 2. ยาใกล้หมดอายุ (<= 70 วัน)
    if (summary.nearExpiryList.length > 0) {
      msg += `\n⏳ ยาใกล้หมดอายุ <= 70 วัน (${summary.nearExpiryList.length} รายการ):\n`;
      summary.nearExpiryList.forEach((item, index) => {
        if (index < 6) {
          msg += `${index + 1}. ${item.drug.name} (Lot: ${item.drug.lot})\n   - Shelf: ${item.drug.shelf} | คลัง: ${item.drug.subWarehouse}\n   - คงเหลือ: ${item.drug.quantity} ${item.drug.unit}\n   - หมดอายุ: ${formatThaiDate(item.drug.expiryDate)} [เหลืออีก ${item.daysLeft} วัน]\n`;
        }
      });
      if (summary.nearExpiryList.length > 6) {
        msg += `   ...และอีก ${summary.nearExpiryList.length - 6} รายการ\n`;
      }
    }

    // 3. ยาที่ถึงเกณฑ์ Min
    if (summary.lowStockList.length > 0) {
      msg += `\n📉 ยาถึงเกณฑ์ Min หรือต่ำกว่า (${summary.lowStockList.length} รายการ):\n`;
      summary.lowStockList.forEach((item, index) => {
        if (index < 6) {
          msg += `${index + 1}. ${item.drug.name}\n   - คลัง: ${item.drug.subWarehouse} | คงเหลือ: ${item.drug.quantity} ${item.drug.unit} (Min: ${item.drug.min})\n`;
        }
      });
      if (summary.lowStockList.length > 6) {
        msg += `   ...และอีก ${summary.lowStockList.length - 6} รายการ\n`;
      }
    }

    msg += `\n📋 ตรวจสอบและตัดยอดได้ที่ระบบคลังยานอก รพ.เขาชัยสน`;
    return msg;
  },

  /**
   * ส่งข้อความแจ้งเตือนผ่าน Google Apps Script (หรือ Direct API)
   */
  async sendAlert(
    lineConfig: LineConfig,
    gasConfig: GasConfig,
    drugs: DrugItem[],
    customMessage?: string
  ): Promise<{ success: boolean; message: string }> {
    const textToSend = customMessage || this.buildAlertMessage(drugs, lineConfig.alertDaysBeforeExpiry || 70);

    // ส่งผ่าน Google Apps Script Backend (แนะนำสำหรับ CORS ใน Browser)
    if (gasConfig.scriptUrl) {
      try {
        const gasResult = await GasApiService.triggerLineAlertViaGas(
          gasConfig,
          lineConfig.channelAccessToken,
          lineConfig.destinationId,
          textToSend
        );
        if (gasResult.success) {
          return { success: true, message: 'ส่งการแจ้งเตือนผ่าน LINE Messaging API สำเร็จ' };
        }
      } catch (e: any) {
        console.warn('Error sending line through GAS, trying direct:', e);
      }
    }

    // หากไม่มี GAS หรือ GAS ล้มเหลวและมีการตั้ง Token ส่งแบบ Direct Fetch (ถ้ามี CORS proxy หรือ Browser อนุญาต)
    if (lineConfig.channelAccessToken && lineConfig.destinationId) {
      try {
        const res = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${lineConfig.channelAccessToken}`,
          },
          body: JSON.stringify({
            to: lineConfig.destinationId,
            messages: [{ type: 'text', text: textToSend }],
          }),
        });

        if (res.ok) {
          return { success: true, message: 'ส่งการแจ้งเตือน LINE สำเร็จ' };
        } else {
          const errData = await res.text();
          return { success: false, message: `LINE API ตอบกลับ: ${errData}` };
        }
      } catch (err: any) {
        return {
          success: false,
          message: `ไม่สามารถส่งตรงจากเบราว์เซอร์ได้ (ติด CORS): แนะนำให้กดส่งผ่าน Google Apps Script หรือใช้งานฟังก์ชัน createDailyTrigger ใน Apps Script เพื่อให้อัตโนมัติทุกเช้า 08:00 น.`,
        };
      }
    }

    return {
      success: false,
      message: 'กรุณาระบุ Channel Access Token และ User/Group ID ในเมนูตั้งค่า LINE',
    };
  },
};
