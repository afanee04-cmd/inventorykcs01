import React, { useState } from 'react';
import { 
  X, 
  Bell, 
  Send, 
  Save, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Key, 
  User, 
  HelpCircle,
  Copy,
  Check,
  Calendar,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { DrugItem, LineConfig, GasConfig } from '../types/inventory';
import { LineService } from '../services/lineService';

interface LineNotifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  drugs: DrugItem[];
  lineConfig: LineConfig;
  gasConfig: GasConfig;
  onSaveConfig: (config: LineConfig) => void;
}

export const LineNotifyModal: React.FC<LineNotifyModalProps> = ({
  isOpen,
  onClose,
  drugs,
  lineConfig,
  gasConfig,
  onSaveConfig,
}) => {
  const [token, setToken] = useState(lineConfig.channelAccessToken || '');
  const [destinationId, setDestinationId] = useState(lineConfig.destinationId || '');
  const [alertDays, setAlertDays] = useState(lineConfig.alertDaysBeforeExpiry || 70);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedMsg, setCopiedMsg] = useState(false);

  if (!isOpen) return null;

  const currentSummary = LineService.getAlertSummary(drugs, alertDays);
  const previewMessage = LineService.buildAlertMessage(drugs, alertDays);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      ...lineConfig,
      channelAccessToken: token.trim(),
      destinationId: destinationId.trim(),
      alertDaysBeforeExpiry: Number(alertDays) || 70,
    });
    setSendResult({ success: true, message: 'บันทึกการตั้งค่า LINE สำเร็จเรียบร้อย' });
  };

  const handleSendNow = async () => {
    if (!token && !gasConfig.scriptUrl) {
      setSendResult({
        success: false,
        message: 'กรุณาระบุ Channel Access Token หรือตั้งค่า Google Apps Script Web App URL ก่อนกดส่ง',
      });
      return;
    }

    setIsSending(true);
    setSendResult(null);

    const tempConfig: LineConfig = {
      ...lineConfig,
      channelAccessToken: token.trim(),
      destinationId: destinationId.trim(),
      alertDaysBeforeExpiry: alertDays,
    };

    const res = await LineService.sendAlert(tempConfig, gasConfig, drugs, previewMessage);
    setSendResult(res);
    setIsSending(false);
  };

  const copyPreview = () => {
    navigator.clipboard.writeText(previewMessage);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-800 rounded-lg text-amber-300">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-['Prompt'] font-bold text-base sm:text-lg">
                ระบบแจ้งเตือนผ่าน LINE Messaging API
              </h3>
              <p className="text-xs text-emerald-200/80">
                แจ้งเตือนอัตโนมัติ: ยาใกล้หมดอายุ 70 วัน, ยาหมดอายุ และสต็อกต่ำกว่า Min
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

        {/* Content Body */}
        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* Status Alert Banner */}
          {sendResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
                sendResult.success
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : 'bg-rose-50 text-rose-900 border-rose-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                {sendResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                )}
                <span>{sendResult.message}</span>
              </div>
              <button
                onClick={() => setSendResult(null)}
                className="text-xs opacity-60 hover:opacity-100 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Alert Criteria Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs">
              <span className="font-bold text-rose-900 block font-['Prompt']">1. ยาหมดอายุแล้ว</span>
              <span className="text-rose-700 text-sm font-extrabold mt-0.5 block">
                {currentSummary.expiredList.length} รายการ
              </span>
              <span className="text-[11px] text-rose-600">เกินวันหมดอายุ</span>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs">
              <span className="font-bold text-amber-900 block font-['Prompt']">2. ยาใกล้หมดอายุ (≤ 70 วัน)</span>
              <span className="text-amber-800 text-sm font-extrabold mt-0.5 block">
                {currentSummary.nearExpiryList.length} รายการ
              </span>
              <span className="text-[11px] text-amber-700">เกณฑ์ 70 วัน รพ.เขาชัยสน</span>
            </div>

            <div className="p-3 bg-orange-50 rounded-xl border border-orange-200 text-xs">
              <span className="font-bold text-orange-950 block font-['Prompt']">3. ยาถึงเกณฑ์ Min</span>
              <span className="text-orange-700 text-sm font-extrabold mt-0.5 block">
                {currentSummary.lowStockList.length} รายการ
              </span>
              <span className="text-[11px] text-orange-600">คงเหลือ ≤ Min ที่กำหนด</span>
            </div>
          </div>

          {/* Form Settings */}
          <form onSubmit={handleSave} className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 font-['Prompt'] flex items-center justify-between">
              <span>ตั้งค่า LINE Messaging API Credentials</span>
              <a
                href="https://developers.line.biz/console/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1 font-normal"
              >
                <span>LINE Developers Console</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </h4>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Key className="w-3.5 h-3.5 text-slate-400" />
                <span>Channel Access Token (Long-lived)</span>
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="วาง Channel Access Token จาก LINE Developers..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Destination User ID หรือ Group ID</span>
                </label>
                <input
                  type="text"
                  value={destinationId}
                  onChange={(e) => setDestinationId(e.target.value)}
                  placeholder="เช่น U123456... หรือ C123456... (กลุ่มห้องยา)"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>เกณฑ์วันใกล้หมดอายุ (วัน)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={alertDays}
                  onChange={(e) => setAlertDays(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                />
                <span className="text-[10px] text-slate-500">กำหนดไว้ที่ 70 วันตามที่ต้องการ</span>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                * ข้อมูลจะถูกจัดเก็บอย่างปลอดภัยในเครื่องและซิงค์กับ Apps Script
              </span>
              <button
                type="submit"
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition"
              >
                <Save className="w-3.5 h-3.5" />
                <span>บันทึกการตั้งค่า</span>
              </button>
            </div>
          </form>

          {/* Message Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 font-['Prompt'] flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-emerald-700" />
                <span>ตัวอย่างข้อความที่จะส่งไปยัง LINE ({currentSummary.totalAlerts} รายการ)</span>
              </label>
              <button
                onClick={copyPreview}
                className="text-xs text-emerald-800 hover:underline inline-flex items-center space-x-1"
              >
                {copiedMsg ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedMsg ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}</span>
              </button>
            </div>

            <div className="bg-slate-900 text-emerald-400 p-3.5 rounded-xl font-mono text-xs whitespace-pre-wrap max-h-48 overflow-y-auto border border-slate-800 shadow-inner">
              {previewMessage}
            </div>
          </div>

          {/* Automated Schedule Info (Google Apps Script Time Trigger) */}
          <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 text-xs space-y-1.5">
            <h5 className="font-bold text-emerald-950 font-['Prompt'] flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-800" />
              <span>ระบบส่งแจ้งเตือนอัตโนมัติทุกเช้า 08:00 น. ผ่าน Google Apps Script</span>
            </h5>
            <p className="text-emerald-900/90 leading-relaxed text-[11px]">
              ฟังก์ชัน <code>createDailyTrigger()</code> ในโค้ด Google Apps Script จะทำการสแกน Sheet ID <code>{gasConfig.sheetId}</code> ทุกวันเวลา 08:00 - 09:00 น. และยิง Push Message ไปยัง LINE ของเจ้าหน้าที่โดยอัตโนมัติ แม้ไม่ได้เปิดหน้าเว็บทิ้งไว้!
            </p>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              ปิดหน้าต่าง
            </button>
            <button
              type="button"
              onClick={handleSendNow}
              disabled={isSending}
              className="inline-flex items-center space-x-1.5 px-5 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-400 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition active:scale-95"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังส่งข้อมูลไปยัง LINE...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>ส่งการแจ้งเตือน LINE เดี๋ยวนี้</span>
                </>
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
