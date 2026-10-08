import { DrugItem, DispenseRecord, TelegramConfig } from '../types/inventory';
import { getDrugStatus, getSimpleDrugStatus } from '../utils/drugUtils';

export const DEFAULT_TELEGRAM_CONFIG: TelegramConfig = {
  botToken: '8611276269:AAE2EurSH1eFfydkNRaDTYfZoJk1v1YLkBc',
  chatId: '-1003988336306', // กลุ่ม Inventory kcs รพ.เขาชัยสน (ปลายทางหลัก)
  groupId: '-1003988336306', // กลุ่ม Inventory kcs รพ.เขาชัยสน
  enabled: true,
  notifyOnSave: true,
  notifyOnDispense: true,
  notifyOnStatusChange: true,
  notifyGroup: true,
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
   * รวมรายชื่อห้องแชทและกลุ่มทั้งหมดที่ต้องส่งข้อความไปหา
   * กำหนดให้กลุ่ม Telegram (-1003988336306 : Inventory kcs) เป็นเป้าหมายหลักเสมอ
   */
  getTargetChatIds(config: TelegramConfig): string[] {
    const list: string[] = [];

    // 1. กลุ่ม Telegram (-1003988336306) ให้ความสำคัญเป็นเป้าหมายหลักอันดับ 1
    const targetGroup = (config.groupId && config.groupId.trim()) || '-1003988336306';
    if (!list.includes(targetGroup)) {
      list.push(targetGroup);
    }

    // 2. Chat ID อื่นๆ (ถ้าผู้ใช้กำหนดเพิ่มเติม และไม่ซ้ำกับกลุ่ม)
    if (config.chatId && config.chatId.trim() && config.chatId.trim() !== targetGroup) {
      config.chatId.split(',').forEach((c) => {
        const trimmed = c.trim();
        if (trimmed && !list.includes(trimmed)) list.push(trimmed);
      });
    }

    return list;
  },

  /**
   * ส่งข้อความไปยัง Telegram Bot (ส่งทั้งแชทส่วนตัว และกลุ่มเป้าหมาย)
   */
  async sendMessage(
    config: TelegramConfig,
    message: string
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!config.enabled) {
      return { success: false, error: 'Telegram notification is disabled' };
    }
    if (!config.botToken) {
      return { success: false, error: 'Telegram Bot Token is missing' };
    }

    const targets = this.getTargetChatIds(config);
    if (targets.length === 0) {
      return { success: false, error: 'Telegram Chat ID or Group ID is missing' };
    }

    let anySuccess = false;
    let lastError = '';
    let lastMsgId: number | undefined;

    for (const targetId of targets) {
      try {
        const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
        const payload = {
          chat_id: targetId,
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
          anySuccess = true;
          lastMsgId = data.result?.message_id;
        } else {
          lastError = data.description || 'Failed to send to Telegram';
        }
      } catch (err: any) {
        lastError = err.message || 'Network error';
      }
    }

    if (anySuccess) {
      return { success: true, messageId: lastMsgId };
    }
    return { success: false, error: lastError };
  },

  /**
   * ทดสอบการเชื่อมต่อ Telegram Bot
   */
  async testConnection(config: TelegramConfig): Promise<{ success: boolean; message: string }> {
    const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const targets = this.getTargetChatIds(config);
    const targetInfo = targets.includes('-1003988336306')
      ? 'กลุ่ม Inventory kcs (-1003988336306) และแชทเป้าหมาย'
      : `${targets.length} แชทเป้าหมาย`;

    const text = `🏥 <b>ระบบคลังยานอก รพ.เขาชัยสน</b>\n\n` +
      `✅ <b>ทดสอบการเชื่อมต่อ Telegram Bot สำเร็จ</b>\n` +
      `• <b>วันเวลา:</b> ${timeStr} น.\n` +
      `• <b>ห้องแชท/กลุ่ม:</b> ${targetInfo}\n` +
      `• <b>สถานะ:</b> ระบบพร้อมรับส่งข้อมูลและแจ้งเตือนอัตโนมัติเมื่อกรอกข้อมูลบนเว็บและซิงค์ลง Google Sheet`;

    const res = await this.sendMessage(config, text);
    if (res.success) {
      return { success: true, message: `ส่งข้อความทดสอบไปยัง Telegram (${targetInfo}) สำเร็จแล้ว!` };
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

    const status = simpleSt.text;
    let statusEmoji = '✅';
    if (status === 'หมดอายุ') statusEmoji = '❌';
    else if (status === 'ใกล้หมดอายุ') statusEmoji = '⚠️';
    else if (status === 'สต็อกถึงเกณฑ์ min') statusEmoji = '🔔';

    // ถ้าไม่ใช่สถานะปลอดภัย ให้เน้นหัวข้อแจ้งเตือนสถานะความเสี่ยงเข้ากลุ่ม Telegram
    const header = status !== 'ปลอดภัย'
      ? `${statusEmoji} <b>[แจ้งเตือนสถานะยา] ${status}</b>`
      : (isEdit ? '✏️ <b>อัปเดตข้อมูลยาในคลัง</b>' : '➕ <b>เพิ่มรายการยาใหม่เข้าคลัง</b>');

    const message = `${header}\n\n` +
      `${statusEmoji} <b>สถานะ:</b> ${status}\n` +
      `• <b>ชื่อยา:</b> ${escapeHtml(drug.name)}\n` +
      `• <b>Lot:</b> ${escapeHtml(drug.lot)}\n` +
      `• <b>Shelf (ชั้นวาง):</b> ${escapeHtml(drug.shelf)}\n` +
      `• <b>คลังยาย่อย:</b> ${escapeHtml(drug.subWarehouse)}\n` +
      `• <b>แหล่งที่มา:</b> ${escapeHtml(drug.source)}\n` +
      `• <b>คงเหลือ:</b> ${drug.quantity.toLocaleString()} ${escapeHtml(drug.unit)}` +
      (drug.packageUnit ? ` (${escapeHtml(drug.packageUnit)})` : '') + `\n` +
      `• <b>วันหมดอายุ:</b> ${escapeHtml(drug.expiryDate)} (เหลือ ${st.daysLeft} วัน)\n` +
      `• <b>Min / Max:</b> ${drug.min} / ${drug.max || '-'}\n` +
      `• <b>ปลายทาง:</b> กลุ่ม Telegram Inventory kcs`;

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

  /**
   * ตรวจจับการเปลี่ยนแปลงสถานะยาอัตโนมัติ (เช่น จาก ปลอดภัย -> ใกล้หมดอายุ/หมดอายุ/ถึงเกณฑ์ min)
   * แล้วส่งแจ้งเตือนเข้ากลุ่ม Telegram ทันทีโดยไม่ต้องกดปุ่มส่งรายงาน
   */
  async checkAndNotifyStatusChangesAutomatically(
    config: TelegramConfig,
    drugs: DrugItem[]
  ): Promise<{ sentCount: number; changedItems: string[] }> {
    if (!config.enabled || !config.notifyOnStatusChange) {
      return { sentCount: 0, changedItems: [] };
    }

    const STORAGE_STATUS_CACHE_KEY = 'kcs_pharmacy_status_cache_v1';
    let previousMap: Record<string, string> = {};

    try {
      const raw = localStorage.getItem(STORAGE_STATUS_CACHE_KEY);
      if (raw) previousMap = JSON.parse(raw);
    } catch (e) {
      previousMap = {};
    }

    const currentMap: Record<string, string> = {};
    const alertMessages: string[] = [];
    const changedItems: string[] = [];

    for (let i = 0; i < drugs.length; i++) {
      const drug = drugs[i];
      const simpleSt = getSimpleDrugStatus(drug);
      const currentStatus = simpleSt.text;
      const key = `${drug.id || drug.name}_${drug.lot}`;

      currentMap[key] = currentStatus;
      const prevStatus = previousMap[key];

      // ตรวจสอบว่ามีสถานะเปลี่ยนจากเดิมหรือไม่
      // 1. ถ้ามีประวัติเดิมและสถานะเปลี่ยนมาเป็นไม่ปลอดภัย
      // 2. หรือถ้ามีแคชเดิมอยู่แล้ว และมีรายการใหม่เพิ่มเข้ามาที่มีสถานะไม่ปลอดภัย
      const hasPreviousCache = Object.keys(previousMap).length > 0;
      const isStatusChanged = prevStatus !== undefined && prevStatus !== currentStatus;
      const isNewUnsafeItem = prevStatus === undefined && hasPreviousCache && currentStatus !== 'ปลอดภัย';

      if ((isStatusChanged || isNewUnsafeItem) && currentStatus !== 'ปลอดภัย' && !currentStatus.includes('ปลอดภัย')) {
        let emoji = '⚠️';
        if (currentStatus.includes('หมดอายุ')) emoji = '❌';
        else if (currentStatus.includes('ใกล้หมดอายุ')) emoji = '⚠️';
        else if (currentStatus.includes('สต็อกถึงเกณฑ์ min') || currentStatus.includes('Min')) emoji = '🔔';

        const prevLabel = prevStatus ? ` (เดิม: ${prevStatus})` : ' (ตรวจพบใหม่)';
        const msg = `${emoji} <b>[สถานะเปลี่ยนอัตโนมัติ] ${currentStatus}</b>${prevLabel}\n` +
          `• <b>ชื่อยา:</b> ${escapeHtml(drug.name)}\n` +
          `• <b>Lot:</b> ${escapeHtml(drug.lot)}\n` +
          `• <b>คลังยาย่อย:</b> ${escapeHtml(drug.subWarehouse)}\n` +
          `• <b>แหล่งที่มา:</b> ${escapeHtml(drug.source)}\n` +
          `• <b>คงเหลือ:</b> ${drug.quantity.toLocaleString()} ${escapeHtml(drug.unit)}`;

        alertMessages.push(msg);
        changedItems.push(drug.name);
      }
    }

    // อัปเดตแคชสถานะล่าสุด
    try {
      localStorage.setItem(STORAGE_STATUS_CACHE_KEY, JSON.stringify(currentMap));
    } catch (e) {}

    // หากพบรายการที่สถานะเปลี่ยนและไม่ปลอดภัย ส่งเข้ากลุ่ม Telegram ทันที
    let sentCount = 0;
    if (alertMessages.length > 0) {
      const header = `<b>⚡ ตรวจพบการเปลี่ยนแปลงสถานะยา (แจ้งเตือนอัตโนมัติ)</b>\n\n`;
      const batchSize = 10;

      for (let j = 0; j < alertMessages.length; j += batchSize) {
        const chunk = alertMessages.slice(j, j + batchSize);
        const fullMessage = header + chunk.join('\n\n-------------------\n\n');
        const res = await this.sendMessage(config, fullMessage);
        if (res.success) {
          sentCount += chunk.length;
        }
      }
    }

    return { sentCount, changedItems };
  },

  /**
   * แจ้งเตือนเมื่อมีการลบรายการยาออกจากคลัง
   */
  async notifyDrugDeleted(
    config: TelegramConfig,
    drugName: string,
    lot: string,
    count?: number
  ): Promise<{ success: boolean; error?: string }> {
    if (!config.enabled || !config.notifyOnSave) return { success: false };

    const message = count && count > 1
      ? `🗑️ <b>ลบรายการยาออกจากคลัง (${count} รายการ)</b>\n\n• ระบบได้อัปเดตและซิงค์ข้อมูลกับ Google Sheet เรียบร้อยแล้ว`
      : `🗑️ <b>ลบรายการยาออกจากคลัง</b>\n\n• <b>ชื่อยา:</b> ${escapeHtml(drugName)}\n• <b>Lot:</b> ${escapeHtml(lot)}\n• ระบบได้อัปเดตและซิงค์ข้อมูลกับ Google Sheet เรียบร้อยแล้ว`;

    return this.sendMessage(config, message);
  },
};
