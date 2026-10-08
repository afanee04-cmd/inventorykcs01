import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  ExternalLink, 
  RefreshCw, 
  Upload, 
  Download, 
  Copy, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  FileCode, 
  Folder, 
  Table, 
  Loader2,
  Send,
  Bell
} from 'lucide-react';
import { GasConfig, DrugItem, TelegramConfig } from '../types/inventory';
import { generateGoogleAppsScriptCode } from '../services/gasCodeTemplate';
import { GasApiService } from '../services/gasApiService';
import { TelegramService } from '../services/telegramService';

interface GasSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  gasConfig: GasConfig;
  onSaveConfig: (config: GasConfig) => void;
  drugs: DrugItem[];
  onApplyFetchedDrugs: (drugs: DrugItem[]) => void;
  telegramConfig: TelegramConfig;
  onSaveTelegramConfig: (config: TelegramConfig) => void;
  initialTab?: 'config' | 'code' | 'telegram' | 'guide';
}

export const GasSetupModal: React.FC<GasSetupModalProps> = ({
  isOpen,
  onClose,
  gasConfig,
  onSaveConfig,
  drugs,
  onApplyFetchedDrugs,
  telegramConfig,
  onSaveTelegramConfig,
  initialTab = 'config',
}) => {
  const [activeTab, setActiveTab] = useState<'config' | 'code' | 'telegram' | 'guide'>('config');
  const [sheetId, setSheetId] = useState(gasConfig.sheetId || '');
  const [scriptUrl, setScriptUrl] = useState(gasConfig.scriptUrl || '');
  const [folderId, setFolderId] = useState(gasConfig.folderId || '');
  
  // Telegram state
  const [botToken, setBotToken] = useState(telegramConfig.botToken || '');
  const [chatId, setChatId] = useState(telegramConfig.chatId || '');
  const [groupId, setGroupId] = useState(telegramConfig.groupId || '-1003988336306');
  const [telegramEnabled, setTelegramEnabled] = useState(telegramConfig.enabled ?? true);
  const [notifyOnSave, setNotifyOnSave] = useState(telegramConfig.notifyOnSave ?? true);
  const [notifyOnDispense, setNotifyOnDispense] = useState(telegramConfig.notifyOnDispense ?? true);
  const [notifyOnStatusChange, setNotifyOnStatusChange] = useState(telegramConfig.notifyOnStatusChange ?? true);
  const [notifyGroup, setNotifyGroup] = useState(telegramConfig.notifyGroup ?? true);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [isSendingStatusReport, setIsSendingStatusReport] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [isSyncingUp, setIsSyncingUp] = useState(false);
  const [isSyncingDown, setIsSyncingDown] = useState(false);
  const [isUpdatingHeaders, setIsUpdatingHeaders] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  if (!isOpen) return null;

  const gasCode = generateGoogleAppsScriptCode(sheetId, folderId);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: GasConfig = {
      ...gasConfig,
      sheetId: sheetId.trim(),
      scriptUrl: scriptUrl.trim(),
      folderId: folderId.trim(),
    };
    onSaveConfig(updated);
    setStatusMessage({ success: true, text: 'บันทึกการตั้งค่า Google Apps Script เรียบร้อยแล้ว' });
  };

  const handleSaveTelegram = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: TelegramConfig = {
      botToken: botToken.trim(),
      chatId: chatId.trim(),
      groupId: groupId.trim(),
      enabled: telegramEnabled,
      notifyOnSave,
      notifyOnDispense,
      notifyOnStatusChange,
      notifyGroup,
      lastAlertSentAt: telegramConfig.lastAlertSentAt,
    };
    onSaveTelegramConfig(updated);
    setStatusMessage({ success: true, text: 'บันทึกการตั้งค่า Telegram Bot และกลุ่มแจ้งเตือนสำเร็จ' });
  };

  // ทดสอบส่งข้อความ Telegram
  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    setStatusMessage(null);
    try {
      const res = await TelegramService.testConnection({
        botToken: botToken.trim(),
        chatId: chatId.trim(),
        groupId: groupId.trim(),
        enabled: true,
        notifyOnSave,
        notifyOnDispense,
        notifyOnStatusChange,
        notifyGroup,
        lastAlertSentAt: null,
      });
      setStatusMessage({ success: res.success, text: res.message });
    } catch (err: any) {
      setStatusMessage({ success: false, text: `ส่งไม่สำเร็จ: ${err.message}` });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  // ส่งรายงานสถานะยาทั้งหมดเข้า Telegram ตอนนี้
  const handleSendTelegramStatusReport = async () => {
    setIsSendingStatusReport(true);
    setStatusMessage(null);
    try {
      const res = await TelegramService.notifyInventoryStatusAlerts(
        {
          botToken: botToken.trim(),
          chatId: chatId.trim(),
          groupId: groupId.trim(),
          enabled: true,
          notifyOnSave,
          notifyOnDispense,
          notifyOnStatusChange,
          notifyGroup,
          lastAlertSentAt: new Date().toISOString(),
        },
        drugs
      );
      if (res.sentCount > 0) {
        setStatusMessage({
          success: true,
          text: `ส่งรายงานสถานะยาที่มีปัญหา ${res.sentCount} รายการ เข้า Telegram (แชทส่วนตัว และกลุ่ม ${groupId}) สำเร็จแล้ว!`,
        });
      } else {
        setStatusMessage({ success: true, text: 'คลังยาปกติ ไม่มีรายการที่ต้องแจ้งเตือน (ทุกรายการปลอดภัย)' });
      }
    } catch (err: any) {
      setStatusMessage({ success: false, text: `ส่งไม่สำเร็จ: ${err.message}` });
    } finally {
      setIsSendingStatusReport(false);
    }
  };

  // ทดสอบการเชื่อมต่ออย่างละเอียด
  const handleTestConnection = async () => {
    setIsTesting(true);
    setStatusMessage(null);
    try {
      const res = await GasApiService.testConnection({
        sheetId: sheetId.trim(),
        scriptUrl: scriptUrl.trim(),
        folderId: folderId.trim(),
        autoSync: true,
        lastSyncTime: null,
      });
      if (res.success) {
        setStatusMessage({ success: true, text: res.message });
      } else {
        setStatusMessage({ success: false, text: res.message });
      }
    } catch (err: any) {
      setStatusMessage({
        success: false,
        text: `ทดสอบเชื่อมต่อล้มเหลว (${err.message || 'CORS/Network error'}) กรุณาตรวจสอบว่า Deploy Web App เป็น 'Anyone' (ทุกคน) หรือยัง`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // อัปเดตหัวตารางในชีทให้เป็น 19 คอลัมน์ (เพิ่มหน่วยบรรจุ)
  const handleInitHeaders = async () => {
    setIsUpdatingHeaders(true);
    setStatusMessage(null);
    try {
      const res = await GasApiService.initHeadersInGas({
        sheetId: sheetId.trim(),
        scriptUrl: scriptUrl.trim(),
        folderId: folderId.trim(),
        autoSync: true,
        lastSyncTime: null,
      });
      if (res.success) {
        setStatusMessage({ success: true, text: 'อัปเดตหัวตารางใน Google Sheet เป็น 19 คอลัมน์ (เพิ่มคอลัมน์ "หน่วยบรรจุ") สำเร็จแล้ว!' });
      } else {
        setStatusMessage({ success: false, text: res.error || 'ไม่สามารถอัปเดตหัวตารางได้' });
      }
    } catch (err: any) {
      setStatusMessage({ success: false, text: `เกิดข้อผิดพลาด: ${err.message}` });
    } finally {
      setIsUpdatingHeaders(false);
    }
  };

  // ดึงข้อมูลจาก Google Sheet
  const handleFetchFromSheet = async () => {
    setIsSyncingDown(true);
    setStatusMessage(null);
    const res = await GasApiService.fetchDrugs({
      sheetId: sheetId.trim(),
      scriptUrl: scriptUrl.trim(),
      folderId: folderId.trim(),
      autoSync: true,
      lastSyncTime: null,
    });

    if (res.success && res.items) {
      if (res.items.length === 0) {
        setStatusMessage({ success: true, text: 'ดึงข้อมูลสำเร็จ แต่ยังไม่มีรายการยาใน Google Sheet' });
      } else {
        onApplyFetchedDrugs(res.items);
        setStatusMessage({ success: true, text: `ดึงข้อมูลสำเร็จ! อัปเดต ${res.items.length} รายการจาก Google Sheet เข้าสู่ระบบ` });
      }
    } else {
      setStatusMessage({ success: false, text: res.error || 'ดึงข้อมูลไม่สำเร็จ' });
    }
    setIsSyncingDown(false);
  };

  // ส่งข้อมูลทั้งหมดในเว็บขึ้น Google Sheet
  const handleUploadAllToSheet = async () => {
    setIsSyncingUp(true);
    setStatusMessage(null);
    const res = await GasApiService.syncAllToGas(
      { sheetId: sheetId.trim(), scriptUrl: scriptUrl.trim(), folderId: folderId.trim(), autoSync: true, lastSyncTime: null },
      drugs
    );

    if (res.success) {
      setStatusMessage({ success: true, text: `ส่งข้อมูลยา ${drugs.length} รายการขึ้น Google Sheet พร้อมคอลัมน์หน่วยบรรจุเรียบร้อยแล้ว` });
    } else {
      setStatusMessage({ success: false, text: res.error || 'ส่งข้อมูลไม่สำเร็จ' });
    }
    setIsSyncingUp(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(gasCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-800 rounded-lg text-emerald-300">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-['Prompt'] font-bold text-base sm:text-lg">
                การเชื่อมต่อ Google Apps Script & Google Sheet
              </h3>
              <p className="text-xs text-emerald-200/80">
                คลังยานอก โรงพยาบาลเขาชัยสน จ.พัทลุง
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-emerald-300 hover:text-white hover:bg-emerald-800/80 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3">
          <button
            onClick={() => setActiveTab('config')}
            className={`pb-3 px-4 text-xs sm:text-sm font-semibold flex items-center space-x-2 border-b-2 transition ${
              activeTab === 'config'
                ? 'border-emerald-700 text-emerald-900 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Table className="w-4 h-4 text-emerald-700" />
            <span>การตั้งค่าและซิงค์ข้อมูล</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`pb-3 px-4 text-xs sm:text-sm font-semibold flex items-center space-x-2 border-b-2 transition ${
              activeTab === 'code'
                ? 'border-emerald-700 text-emerald-900 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileCode className="w-4 h-4 text-teal-700" />
            <span>โค้ด Google Apps Script (Code.gs)</span>
          </button>

          <button
            onClick={() => setActiveTab('telegram')}
            className={`pb-3 px-4 text-xs sm:text-sm font-semibold flex items-center space-x-2 border-b-2 transition ${
              activeTab === 'telegram'
                ? 'border-sky-600 text-sky-900 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Send className="w-4 h-4 text-sky-600" />
            <span>Telegram Bot (@pharmkcsbot)</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`pb-3 px-4 text-xs sm:text-sm font-semibold flex items-center space-x-2 border-b-2 transition ${
              activeTab === 'guide'
                ? 'border-emerald-700 text-emerald-900 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>คู่มือการติดตั้ง 3 ขั้นตอน</span>
          </button>
        </div>

        {/* Tab 1: CONFIG & SYNC */}
        {activeTab === 'config' && (
          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            
            {statusMessage && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
                  statusMessage.success
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : 'bg-rose-50 text-rose-900 border-rose-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {statusMessage.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
                <button
                  onClick={() => setStatusMessage(null)}
                  className="text-xs opacity-60 hover:opacity-100 font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Quick Action Sync Box */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition flex flex-col justify-between cursor-pointer"
              >
                <div className="flex items-center justify-between text-slate-700">
                  <span className="text-xs font-bold font-['Prompt']">1. ทดสอบการเชื่อมต่อ</span>
                  {isTesting ? <Loader2 className="w-4 h-4 animate-spin text-emerald-700" /> : <RefreshCw className="w-4 h-4 text-slate-400" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  ตรวจว่า Web App URL เชื่อมต่อได้หรือไม่
                </p>
              </button>

              <button
                type="button"
                onClick={handleInitHeaders}
                disabled={isUpdatingHeaders}
                className="p-3 bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200 rounded-xl text-left transition flex flex-col justify-between cursor-pointer"
              >
                <div className="flex items-center justify-between text-blue-900">
                  <span className="text-xs font-bold font-['Prompt']">2. เพิ่มคอลัมน์หน่วยบรรจุ</span>
                  {isUpdatingHeaders ? <Loader2 className="w-4 h-4 animate-spin text-blue-700" /> : <Table className="w-4 h-4 text-blue-700" />}
                </div>
                <p className="text-[11px] text-blue-800/80 mt-2">
                  อัปเดตหัวตาราง 19 คอลัมน์ลงใน Sheet
                </p>
              </button>

              <button
                type="button"
                onClick={handleUploadAllToSheet}
                disabled={isSyncingUp}
                className="p-3 bg-teal-50/70 hover:bg-teal-100/70 border border-teal-200 rounded-xl text-left transition flex flex-col justify-between cursor-pointer"
              >
                <div className="flex items-center justify-between text-teal-900">
                  <span className="text-xs font-bold font-['Prompt']">3. ส่งข้อมูลขึ้น Sheet</span>
                  {isSyncingUp ? <Loader2 className="w-4 h-4 animate-spin text-teal-700" /> : <Upload className="w-4 h-4 text-teal-700" />}
                </div>
                <p className="text-[11px] text-teal-800/80 mt-2">
                  ส่ง {drugs.length} รายการ (พร้อมหน่วยบรรจุ) ขึ้นชีท
                </p>
              </button>

              <button
                type="button"
                onClick={handleFetchFromSheet}
                disabled={isSyncingDown}
                className="p-3 bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200 rounded-xl text-left transition flex flex-col justify-between cursor-pointer"
              >
                <div className="flex items-center justify-between text-emerald-900">
                  <span className="text-xs font-bold font-['Prompt']">4. ดึงข้อมูลจาก Sheet</span>
                  {isSyncingDown ? <Loader2 className="w-4 h-4 animate-spin text-emerald-700" /> : <Download className="w-4 h-4 text-emerald-700" />}
                </div>
                <p className="text-[11px] text-emerald-800/80 mt-2">
                  โหลดรายการยาจาก Google Sheet ลงเว็บ
                </p>
              </button>
            </div>

            {/* Status Columns Notice Banner */}
            <div className="p-3.5 bg-emerald-50/80 border border-emerald-300 rounded-xl text-xs space-y-1.5">
              <span className="font-bold text-emerald-950 font-['Prompt'] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>คอลัมน์ใน Google Sheet (โครงสร้าง 19 คอลัมน์สมบูรณ์):</span>
              </span>
              <ul className="list-disc list-inside text-emerald-900 text-[11px] space-y-0.5 pl-1">
                <li><strong>หน่วยบรรจุ (Package Unit)</strong>: บันทึกขนาดบรรจุ เช่น "10x10 เม็ด", "1 ขวด/กล่อง", "10 แผง/กล่อง" (คอลัมน์ L)</li>
                <li><strong>สถานะวันหมดอายุ (Expiry Status)</strong>: "หมดอายุแล้ว", "ใกล้หมดอายุ (เหลือ X วัน)", หรือ "ปลอดภัย"</li>
                <li><strong>สถานะสต็อก (Stock Status)</strong>: "ถึงเกณฑ์ Min หรือต่ำกว่า", "สต็อกปกติ", หรือ "สต็อกเกิน Max"</li>
                <li><strong>สรุปการแจ้งเตือน (Alert Summary)</strong>: สรุปภาพรวมสถานะความเร่งด่วนของยาแต่ละรายการ</li>
              </ul>
            </div>

            {/* Config Form */}
            <form onSubmit={handleSave} className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
              
              {/* Sheet ID */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Table className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Google Sheet ID</span>
                  </label>
                  {sheetId && (
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1"
                    >
                      <span>เปิด Sheet ในแท็บใหม่</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <input
                  type="text"
                  value={sheetId}
                  onChange={(e) => setSheetId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                  placeholder="เช่น 17Ja3Q7hKMt01AxGDhYbCkpE9RMHHCjIbf_aVEvqFROc"
                />
              </div>

              {/* Apps Script URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-teal-700" />
                  <span>Google Apps Script Web App URL</span>
                </label>
                <input
                  type="text"
                  value={scriptUrl}
                  onChange={(e) => setScriptUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                  placeholder="https://script.google.com/macros/s/.../exec"
                />
              </div>

              {/* Folder ID */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-cyan-700" />
                    <span>Google Drive Folder ID (สำหรับจัดเก็บเอกสาร PDF คลังยา)</span>
                  </label>
                  {folderId && (
                    <a
                      href={`https://drive.google.com/drive/folders/${folderId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-teal-700 hover:underline flex items-center gap-1"
                    >
                      <span>เปิด Google Drive Folder</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <input
                  type="text"
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                  placeholder="เช่น 1O8MiCSQ43f2aoI7HvcPPY4EM97szYqlb"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-xl shadow-xs transition"
                >
                  <Check className="w-4 h-4" />
                  <span>บันทึกการตั้งค่า</span>
                </button>
              </div>

            </form>

          </div>
        )}

        {/* Tab 2: APPS SCRIPT CODE */}
        {activeTab === 'code' && (
          <div className="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-800 font-['Prompt']">
                  ซอร์สโค้ด Google Apps Script (Code.gs)
                </h4>
                <p className="text-[11px] text-slate-500">
                  คัดลอกโค้ดนี้ไปวางใน Google Apps Script ของท่าน เพื่อให้รองรับการเชื่อมต่อกับระบบคลังยานอก รพ.เขาชัยสน
                </p>
              </div>

              <button
                type="button"
                onClick={copyToClipboard}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold shadow-xs transition"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode ? 'คัดลอกโค้ดแล้ว!' : 'คัดลอกโค้ด Code.gs ทั้งหมด'}</span>
              </button>
            </div>

            <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-xs max-h-96 overflow-y-auto border border-slate-800 leading-relaxed shadow-inner">
              <pre>{gasCode}</pre>
            </div>
          </div>
        )}

        {/* Tab 3: TELEGRAM BOT SETTINGS */}
        {activeTab === 'telegram' && (
          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs text-slate-700">
            {/* Status Message */}
            {statusMessage && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
                  statusMessage.success
                    ? 'bg-sky-50 text-sky-900 border-sky-300'
                    : 'bg-rose-50 text-rose-900 border-rose-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {statusMessage.success ? (
                    <CheckCircle2 className="w-4 h-4 text-sky-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
                <button
                  onClick={() => setStatusMessage(null)}
                  className="text-xs opacity-60 hover:opacity-100 font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Telegram Bot Connection Status Card */}
            <div className="p-4 bg-gradient-to-r from-sky-500/10 via-blue-500/10 to-indigo-500/10 border border-sky-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-sky-600 text-white rounded-xl shadow-xs">
                  <Send className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-['Prompt'] font-bold text-sm text-sky-950 flex items-center gap-2">
                    <span>Telegram Bot (@pharmkcsbot)</span>
                    <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold border border-emerald-300">
                      🟢 เชื่อมต่อแล้ว
                    </span>
                  </h4>
                  <p className="text-xs text-sky-800 mt-0.5">
                    แชทปลายทาง: Chat ID <code>{chatId}</code> | กลุ่ม <code>{groupId || '-1003988336306'}</code> (Inventory kcs)
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleTestTelegram}
                  disabled={isTestingTelegram}
                  className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isTestingTelegram ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>{isTestingTelegram ? 'กำลังทดสอบ...' : 'ทดสอบส่งข้อความ'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendTelegramStatusReport}
                  disabled={isSendingStatusReport}
                  className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="ส่งสรุปยาใกล้หมดอายุ/หมดอายุ/ต่ำกว่า Min เข้า Telegram ทันที"
                >
                  {isSendingStatusReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4 text-emerald-300" />}
                  <span>{isSendingStatusReport ? 'กำลังส่ง...' : 'ส่งรายงานสถานะยาทันที'}</span>
                </button>
              </div>
            </div>

            {/* Telegram Configuration Form */}
            <form onSubmit={handleSaveTelegram} className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h5 className="font-bold text-slate-800 font-['Prompt'] text-xs flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-sky-700" />
                <span>การตั้งค่า Telegram Bot & เงื่อนไขการแจ้งเตือน</span>
              </h5>

              {/* Bot Token */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Telegram Bot Token
                </label>
                <input
                  type="text"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 bg-white"
                  placeholder="เช่น 8611276269:AAE2EurSH1eFfydkNRaDTYfZoJk1v1YLkBc"
                />
              </div>

              {/* Chat ID & Group ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telegram Chat ID (แชทส่วนตัว)
                  </label>
                  <input
                    type="text"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 bg-white"
                    placeholder="เช่น 8912234135"
                  />
                  <p className="text-[11px] text-slate-600 mt-1">
                    ไอดีผู้ใช้ส่วนตัว สำหรับรับการแจ้งเตือนเดี่ยว
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Telegram Group ID (กลุ่มงาน)</span>
                    <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300">
                      Inventory kcs
                    </span>
                  </label>
                  <input
                    type="text"
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 bg-white"
                    placeholder="เช่น -1003988336306"
                  />
                  <p className="text-[11px] text-slate-600 mt-1">
                    ไอดีกลุ่ม Telegram สำหรับแจ้งเตือนเจ้าหน้าที่ในกลุ่ม
                  </p>
                </div>
              </div>

              {/* Notification Checkboxes */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="text-xs font-semibold text-slate-700 block">
                  ตัวเลือกการแจ้งเตือนอัตโนมัติ:
                </label>

                <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-800">
                  <input
                    type="checkbox"
                    checked={telegramEnabled}
                    onChange={(e) => setTelegramEnabled(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span className="font-semibold">เปิดใช้งานการแจ้งเตือน Telegram</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-700 pl-4">
                  <input
                    type="checkbox"
                    checked={notifyGroup}
                    onChange={(e) => setNotifyGroup(e.target.checked)}
                    disabled={!telegramEnabled}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span className="font-medium text-emerald-900">
                    ส่งแจ้งเตือนเข้า <strong>กลุ่ม Telegram (Group ID: {groupId || '-1003988336306'})</strong> ด้วย
                  </span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-700 pl-4">
                  <input
                    type="checkbox"
                    checked={notifyOnSave}
                    onChange={(e) => setNotifyOnSave(e.target.checked)}
                    disabled={!telegramEnabled}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>แจ้งเตือนเมื่อ <strong>เพิ่มหรือแก้ไขข้อมูลยา</strong> ในคลัง</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-700 pl-4">
                  <input
                    type="checkbox"
                    checked={notifyOnDispense}
                    onChange={(e) => setNotifyOnDispense(e.target.checked)}
                    disabled={!telegramEnabled}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>แจ้งเตือนเมื่อ <strong>บันทึกการตัดยอดจ่ายยา</strong> ไปยังแผนกต่างๆ</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-700 pl-4">
                  <input
                    type="checkbox"
                    checked={notifyOnStatusChange}
                    onChange={(e) => setNotifyOnStatusChange(e.target.checked)}
                    disabled={!telegramEnabled}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>แจ้งเตือนเมื่อ <strong>สถานะยาเปลี่ยน (หมดอายุ, ใกล้หมดอายุ, สต็อกถึงเกณฑ์ min)</strong></span>
                </label>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>บันทึกการตั้งค่า Telegram</span>
                </button>
              </div>
            </form>

            {/* Explanation of Integration */}
            <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl space-y-2">
              <span className="font-bold text-sky-950 block text-xs">
                🔄 การเชื่อมต่อแบบ 2 ทาง (Web ➡️ Sheet ➡️ Telegram):
              </span>
              <ul className="list-disc list-inside text-sky-900 text-[11px] sm:text-xs space-y-1 pl-1">
                <li><strong>เมื่อกรอกข้อมูลบนเว็บ:</strong> ข้อมูลจะถูกบันทึกและส่งเข้า Google Sheet อัตโนมัติ พร้อมส่งข้อความแจ้งเตือนเข้าทั้งแชทส่วนตัว (Chat ID: {chatId}) และกลุ่ม Telegram (Group ID: {groupId || '-1003988336306'} : Inventory kcs) ทันที</li>
                <li><strong>เมื่อแก้ไขใน Google Sheet:</strong> ในไฟล์ <code>Code.gs</code> มีฟังก์ชัน <code>checkInventoryAndNotifyTelegram()</code> ตรวจจับการเปลี่ยนแปลงของคอลัมน์สถานะ (ยกเว้นสถานะ "ปลอดภัย") แล้วส่งเข้าทั้งแชทและกลุ่ม Telegram อัตโนมัติ</li>
                <li><strong>การตั้งเวลาอัตโนมัติ:</strong> ใน Apps Script สามารถรันฟังก์ชัน <code>createTelegramTrigger()</code> เพื่อให้ระบบตรวจเช็คและแจ้งเตือนเข้า Telegram ทุก 1 ชั่วโมงได้</li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab 4: SETUP GUIDE */}
        {activeTab === 'guide' && (
          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs text-slate-700 leading-relaxed">
            
            {/* Urgent Status Column Solution Banner */}
            <div className="p-4 bg-amber-500/10 border-2 border-amber-500/60 rounded-xl text-amber-950 space-y-2">
              <div className="flex items-center space-x-2 text-amber-900 font-bold font-['Prompt'] text-sm">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>ทำไมใน Google Sheet ยังไม่แสดงคอลัมน์สถานะยา? &amp; วิธีแก้ด่วน</span>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">
                เนื่องจากตัวสคริปต์ที่ Deploy อยู่ใน Google Drive ของท่านในขณะนี้ยังเป็นเวอร์ชันเก่า (15 คอลัมน์เดิม) 
                ดังนั้นเมื่อระบบทำการซิงค์ ตัวสคริปต์เดิมจึงเขียนเฉพาะ 15 คอลัมน์เดิมลงใน Sheet
              </p>
              <div className="bg-white/80 p-3 rounded-lg border border-amber-300 text-xs space-y-1 font-medium">
                <div className="font-bold text-amber-950">วิธีแก้ใน 1 นาที:</div>
                <ol className="list-decimal list-inside space-y-1 text-slate-800">
                  <li>ไปที่แท็บ <strong>"โค้ด Google Apps Script (Code.gs)"</strong> แล้วกดปุ่ม <strong>"คัดลอกโค้ด Code.gs ทั้งหมด"</strong></li>
                  <li>เปิด Google Sheet (ID: <code>{sheetId}</code>) ไปที่เมนู <strong>ส่วนขยาย (Extensions) &gt; Apps Script</strong></li>
                  <li>ลบโค้ดเดิมทั้งหมดในไฟล์ <code>Code.gs</code> แล้ววางโค้ดที่คัดลอกมา จากนั้นกด <strong>บันทึก (💾)</strong></li>
                  <li>กดปุ่ม <strong>ทำให้ใช้งานได้ (Deploy) &gt; จัดการการทำให้ใช้งานได้ (Manage deployments)</strong> กดรูปดินสอ ✏️ (แก้ไข) แล้วเลือกเวอร์ชันเป็น <strong>"เวอร์ชันใหม่" (New version)</strong> แล้วกด <strong>ทำให้ใช้งานได้ (Deploy)</strong></li>
                  <li>กลับมากดปุ่ม <strong>"ส่งข้อมูลขึ้น Google Sheet ทั้งหมด"</strong> ที่แท็บแรก คอลัมน์สถานะยาจะปรากฏใน Google Sheet ทันที!</li>
                </ol>
              </div>
            </div>

            <h4 className="text-sm font-bold text-slate-800 font-['Prompt'] pt-2">
              รายละเอียดขั้นตอนการติดตั้ง &amp; เชื่อมต่อระบบ
            </h4>

            <div className="space-y-3">
              <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200">
                <span className="font-bold text-emerald-950 block text-xs mb-1">
                  ขั้นตอนที่ 1: วางโค้ดใน Google Apps Script
                </span>
                <p className="text-slate-600">
                  1. เปิด Google Sheet (ID: <code>{sheetId}</code>)<br />
                  2. ไปที่เมนู <strong>ส่วนขยาย (Extensions)</strong> &gt; <strong>Apps Script</strong><br />
                  3. ลบโค้ดเดิมออกทั้งหมด แล้วกดปุ่ม <strong>"คัดลอกโค้ด Code.gs"</strong> จากแท็บโค้ดมาวางแทนที่
                </p>
              </div>

              <div className="p-3.5 bg-teal-50/60 rounded-xl border border-teal-200">
                <span className="font-bold text-teal-950 block text-xs mb-1">
                  ขั้นตอนที่ 2: Deploy เป็น Web App
                </span>
                <p className="text-slate-600">
                  1. กดปุ่มสีน้ำเงิน <strong>"การทำให้ใช้งานได้ใหม่" (Deploy)</strong> &gt; <strong>การทำให้ใช้งานได้ใหม่ (New deployment)</strong><br />
                  2. เลือกประเภทเป็น <strong>เว็บแอป (Web App)</strong><br />
                  3. ตรง <strong>"ผู้ที่มีสิทธิ์เข้าถึง" (Who has access)</strong> ให้เลือกเป็น <strong>"ทุกคน" (Anyone)</strong> (สำคัญมาก เพื่อให้เว็ปแอปนี้ส่งข้อมูลเข้าออกได้โดยไม่ติดสิทธิ์)<br />
                  4. กด Deploy แล้วคัดลอก Web App URL (ลงท้ายด้วย <code>/exec</code>) มาใส่ในช่อง URL ของระบบ
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-900 block text-xs mb-1">
                  💡 ทางเลือกเพิ่มเติม: สูตรคำนวณสถานะยาใน Google Sheet โดยตรง
                </span>
                <p className="text-slate-600 mb-2">
                  หากต้องการใส่สูตรลงในชีทโดยตรง สามารถใส่สูตรนี้ที่แถวที่ 2 ของแต่ละคอลัมน์ได้:
                </p>
                <div className="space-y-1.5 font-mono text-[11px] bg-slate-100 p-2.5 rounded-lg border border-slate-300">
                  <div>
                    <span className="font-bold text-emerald-800">คอลัมน์ I (สถานะวันหมดอายุ):</span><br />
                    <code>=IF(H2="","-", IF(H2&lt;TODAY(),"🚨 หมดอายุแล้ว", IF(H2-TODAY()&lt;=70,"⏳ ใกล้หมดอายุ ("&amp;(H2-TODAY())&amp;" วัน)","✅ ปลอดภัย ("&amp;(H2-TODAY())&amp;" วัน)")) )</code>
                  </div>
                  <div className="pt-1 border-t border-slate-200">
                    <span className="font-bold text-teal-800">คอลัมน์ N (สถานะสต็อก Min):</span><br />
                    <code>=IF(J2&lt;=0,"🔴 สต็อกหมด", IF(J2&lt;=L2,"⚠️ ถึงเกณฑ์ Min ("&amp;J2&amp;"/"&amp;L2&amp;")", "✅ สต็อกปกติ ("&amp;J2&amp;")"))</code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
};
