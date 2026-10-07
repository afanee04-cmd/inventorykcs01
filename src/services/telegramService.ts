import { DrugItem, DispenseRecord, TelegramConfig } from '../types/inventory';
import { getDrugStatus, getSimpleDrugStatus } from '../utils/drugUtils';

export const DEFAULT_TELEGRAM_CONFIG: TelegramConfig = {
  botToken: '8611276269:AAE2EurSH1eFfydkNRaDTYfZoJk1v1YLkBc',
  chatId: '8912234135',
  enabled: true,
  notifyOnSave: true,
  notifyOnDispense: true,
  notifyOnStatusChange: true,
  lastAlertSentAt: null,
};

function escapeHtml(text: any): string {
  if (text === null || text === undefined || text === '') return '-';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const TelegramService = {
  /**
   * ส่งข้อความไปยัง Telegram Bot
   */
  async sendMessage(
    config: TelegramConfig,
    message: string
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!config.enabled) {
      return { success: false, error: 'Telegram notification is disabled' };
    }
    if (!config.botToken || !config.chatId) {
      return { success: false, error: 'Telegram Bot Token or Chat ID is missing' };
    }

    try {
      const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
      const payload = {
        chat_id: config.chatId,
        text: message,
        parse_mode: 'HTML',
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.ok) {
        return { success: true, messageId: data.result?.message_id };
      }
      return { success: false, error: data.description || 'Failed to send to Telegram' };
    } catch (err: any) {
      console.warn('Telegram send error:', err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  /**
   * ทดสอบการเชื่อมต่อ Telegram Bot
   */
  async testConnection(config: TelegramConfig): Promise<{ success: boolean; message: string }> {
    const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const text = `🏥 <b>ระบบคลังยานอก รพ.เขาชัยสน</b>\n\n` +
      `✅ <b>ทดสอบการเชื่อมต่อ Telegram Bot สำเร็จ</b>\n` +
      `• <b>วันเวลา:</b> ${timeStr} น.\n` +
      `• <b>สถานะ:</b> ระบบพร้อมรับส่งข้อมูลและแจ้งเตือนอัตโนมัติเมื่อกรอกข้อมูลบนเว็บและซิงค์ลง Google Sheet`;

    const res = await this.sendMessage(config, text);
    if (res.success) {
      return { success: true, message: 'ส่งข้อความทดสอบไปยัง Telegram สำเร็จแล้ว!' };
    }
    return { success: false, message: `ส่งไม่สำเร็จ: ${res.error}` };
  },

  /**
   * แจ้งเตือนเมื่อมีการกรอก / เพิ่ม / แก้ไขข้อมูลยาบนเว็บ
   */
  async notifyDrugSaved(
    config: TelegramConfig,
    drug: DrugItem,
    isEdit: boolean
  ): Promise<{ success: boolean; error?: string }> {
    if (!config.enabled || !config.notifyOnSave) return { success: false };

    const st = getDrugStatus(drug);
    const simpleSt = getSimpleDrugStatus(drug);

    let statusEmoji = '✅';
    if (simpleSt.text === 'หมดอายุ') statusEmoji = '❌';
    else if (simpleSt.text === 'ใกล้หมดอายุ') statusEmoji = '⚠️';
    else if (simpleSt.text === 'สต็อกถึงเกณฑ์ min') statusEmoji = '🔔';

    const header = isEdit ? '✏️ <b>อัปเดตข้อมูลยาในคลัง</b>' : '➕ <b>เพิ่มรายการยาใหม่เข้าคลัง</b>';

    const message = `${header}\n\n` +
      `${statusEmoji} <b>สถานะ:</b> ${simpleSt.text}\n` +
      `• <b>ชื่อยา:</b> ${escapeHtml(drug.name)}\n` +
      `• <b>Lot:</b> ${escapeHtml(drug.lot)}\n` +
      `• <b>Shelf (ชั้นวาง):</b> ${escapeHtml(drug.shelf)}\n` +
      `• <b>คลังยาย่อย:</b> ${escapeHtml(drug.subWarehouse)}\n` +
      `• <b>แหล่งที่มา:</b> ${escapeHtml(drug.source)}\n` +
      `• <b>คงเหลือ:</b> ${drug.quantity.toLocaleString()} ${escapeHtml(drug.unit)}` +
      (drug.packageUnit ? ` (${escapeHtml(drug.packageUnit)})` : '') + `\n` +
      `• <b>วันหมดอายุ:</b> ${escapeHtml(drug.expiryDate)} (เหลือ ${st.daysLeft} วัน)\n` +
      `• <b>Min / Max:</b> ${drug.min} / ${drug.max || '-'}\n` +
      `• <b>ซิงค์ Google Sheet:</b> สำเร็จ`;

    return this.sendMessage(config, message);
  },

  /**
   * แจ้งเตือนเมื่อมีการตัดยอดจ่ายยาบนเว็บ
   */
  async notifyDrugDispensed(
    config: TelegramConfig,
    record: DispenseRecord
  ): Promise<{ success: boolean; error?: string }> {
    if (!config.enabled || !config.notifyOnDispense) return { success: false };

    const message = `📤 <b>บันทึกการตัดยอดจ่ายยา</b>\n\n` +
      `• <b>ชื่อยา:</b> ${escapeHtml(record.drugName)}\n` +
      `• <b>Lot:</b> ${escapeHtml(record.lot)}\n` +
      `• <b>จำนวนที่ตัด:</b> <b>${record.amount.toLocaleString()}</b> ${escapeHtml(record.unit)}\n` +
      `• <b>คลังต้นทาง:</b> ${escapeHtml(record.fromWarehouse)} ➡️ <b>แผนกปลายทาง:</b> <b>${escapeHtml(record.toDepartment)}</b>\n` +
      `• <b>ผู้ตัดยอด:</b> ${escapeHtml(record.requestedBy)}\n` +
      `• <b>เหตุผล:</b> ${escapeHtml(record.reason || 'เบิกใช้ตามปกติ')}\n` +
      `• <b>ยอดคงเหลือหลังตัด:</b> <b>${record.remainingAfter.toLocaleString()}</b> ${escapeHtml(record.unit)}\n` +
      `• <b>ซิงค์ Google Sheet:</b> สำเร็จ`;

    return this.sendMessage(config, message);
  },

  /**
   * แจ้งเตือนเมื่อนำเข้าข้อมูลจาก Excel / PDF
   */
  async notifyImportSuccess(
    config: TelegramConfig,
    addedCount: number,
    updatedCount: number
  ): Promise<{ success: boolean; error?: string }> {
    if (!config.enabled || !config.notifyOnSave) return { success: false };

    const total = addedCount + updatedCount;
    const message = `📥 <b>นำเข้าข้อมูลคลังยาสำเร็จ</b>\n\n` +
      `• <b>เพิ่มรายการใหม่:</b> ${addedCount} รายการ\n` +
      `• <b>อัปเดตข้อมูลเดิม:</b> ${updatedCount} รายการ\n` +
      `• <b>รวมทั้งสิ้น:</b> ${total} รายการ\n` +
      `• ซิงค์ลง Google Sheet และคลังยานอก รพ.เขาชัยสน เรียบร้อยแล้ว`;

    return this.sendMessage(config, message);
  },

  /**
   * แจ้งเตือนสถานะยา (หมดอายุ, ใกล้หมดอายุ, สต็อกถึงเกณฑ์ min) ตามรูปแบบของโรงพยาบาล
   */
  async notifyInventoryStatusAlerts(
    config: TelegramConfig,
    drugs: DrugItem[]
  ): Promise<{ success: boolean; sentCount: number }> {
    if (!config.enabled || !config.notifyOnStatusChange) return { success: false, sentCount: 0 };

    const alertMessages: string[] = [];

    for (let i = 0; i < drugs.length; i++) {
      const drug = drugs[i];
      const simpleSt = getSimpleDrugStatus(drug);
      const status = simpleSt.text;

      // แจ้งเตือนทุกสถานะ ยกเว้น "ปลอดภัย"
      if (status !== 'ปลอดภัย') {
        let emoji = '⚠️';
        if (status === 'หมดอายุ') emoji = '❌';
        else if (status === 'ใกล้หมดอายุ') emoji = '⚠️';
        else if (status === 'สต็อกถึงเกณฑ์ min') emoji = '🔔';

        const msg = `${emoji} <b>สถานะ:</b> ${status}\n` +
          `• <b>ชื่อยา:</b> ${escapeHtml(drug.name)}\n` +
          `• <b>Lot:</b> ${escapeHtml(drug.lot)}\n` +
          `• <b>คลังยาย่อย:</b> ${escapeHtml(drug.subWarehouse)}\n` +
          `• <b>แหล่งที่มา:</b> ${escapeHtml(drug.source)}\n` +
          `• <b>คงเหลือ:</b> ${drug.quantity.toLocaleString()} ${escapeHtml(drug.unit)}`;

        alertMessages.push(msg);
      }
    }

    if (alertMessages.length === 0) {
      return { success: true, sentCount: 0 };
    }

    const header = `<b>📦 รายงานสถานะยาและเวชภัณฑ์ (รพ.เขาชัยสน)</b>\n\n`;
    const batchSize = 10;
    let sentCount = 0;

    for (let j = 0; j < alertMessages.length; j += batchSize) {
      const chunk = alertMessages.slice(j, j + batchSize);
      const fullMessage = header + chunk.join('\n\n-------------------\n\n');
      const res = await this.sendMessage(config, fullMessage);
      if (res.success) {
        sentCount += chunk.length;
      }
    }

    return { success: true, sentCount };
  },
};
