import { DrugItem, DispenseRecord, GasConfig, LineConfig, TelegramConfig } from '../types/inventory';
import { INITIAL_DRUGS } from '../utils/drugUtils';
import { DEFAULT_TELEGRAM_CONFIG } from './telegramService';

const STORAGE_KEYS = {
  DRUGS: 'kcs_pharmacy_drugs_v1',
  DISPENSE_LOGS: 'kcs_pharmacy_dispense_logs_v1',
  GAS_CONFIG: 'kcs_pharmacy_gas_config_v1',
  LINE_CONFIG: 'kcs_pharmacy_line_config_v1',
  TELEGRAM_CONFIG: 'kcs_pharmacy_telegram_config_v1',
};

export const DEFAULT_GAS_CONFIG: GasConfig = {
  sheetId: '17Ja3Q7hKMt01AxGDhYbCkpE9RMHHCjIbf_aVEvqFROc',
  scriptUrl: 'https://script.google.com/macros/s/AKfycbxKRcFl73ckyd5zFc6dWvpz0WgxVdGKOAuJvU-zZJ2kfING9ShQhdNf53rEfIhRIqR5vA/exec',
  folderId: '1O8MiCSQ43f2aoI7HvcPPY4EM97szYqlb',
  autoSync: true,
  lastSyncTime: null,
};

export const DEFAULT_LINE_CONFIG: LineConfig = {
  channelAccessToken: '',
  destinationId: '',
  autoAlertEnabled: true,
  alertDaysBeforeExpiry: 70, // 70 วันก่อนหมดอายุ
  lastAlertSentAt: null,
};

export const StorageService = {
  getDrugs(): DrugItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DRUGS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to read drugs from localStorage', e);
    }
    // ใช้ข้อมูลตั้งต้นหากยังไม่มีข้อมูล
    localStorage.setItem(STORAGE_KEYS.DRUGS, JSON.stringify(INITIAL_DRUGS));
    return INITIAL_DRUGS;
  },

  saveDrugs(drugs: DrugItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.DRUGS, JSON.stringify(drugs));
    } catch (e) {
      console.error('Failed to save drugs to localStorage', e);
    }
  },

  getDispenseRecords(): DispenseRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DISPENSE_LOGS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to read dispense logs', e);
    }
    return [];
  },

  saveDispenseRecord(record: DispenseRecord): DispenseRecord[] {
    const list = this.getDispenseRecords();
    const updated = [record, ...list];
    try {
      localStorage.setItem(STORAGE_KEYS.DISPENSE_LOGS, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save dispense record', e);
    }
    return updated;
  },

  getGasConfig(): GasConfig {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.GAS_CONFIG);
      if (data) {
        return { ...DEFAULT_GAS_CONFIG, ...JSON.parse(data) };
      }
    } catch (e) {
      console.error('Failed to read GAS config', e);
    }
    return DEFAULT_GAS_CONFIG;
  },

  saveGasConfig(config: GasConfig): void {
    try {
      localStorage.setItem(STORAGE_KEYS.GAS_CONFIG, JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save GAS config', e);
    }
  },

  getLineConfig(): LineConfig {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LINE_CONFIG);
      if (data) {
        return { ...DEFAULT_LINE_CONFIG, ...JSON.parse(data) };
      }
    } catch (e) {
      console.error('Failed to read LINE config', e);
    }
    return DEFAULT_LINE_CONFIG;
  },

  saveLineConfig(config: LineConfig): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LINE_CONFIG, JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save LINE config', e);
    }
  },

  getTelegramConfig(): TelegramConfig {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TELEGRAM_CONFIG);
      if (data) {
        return { ...DEFAULT_TELEGRAM_CONFIG, ...JSON.parse(data) };
      }
    } catch (e) {
      console.error('Failed to read Telegram config', e);
    }
    return DEFAULT_TELEGRAM_CONFIG;
  },

  saveTelegramConfig(config: TelegramConfig): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TELEGRAM_CONFIG, JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save Telegram config', e);
    }
  },
};
