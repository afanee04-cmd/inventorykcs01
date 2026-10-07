import React from 'react';
import { 
  Building2, 
  History, 
  ExternalLink, 
  LogOut,
  UserCheck,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  Settings,
  AlertCircle,
  Send
} from 'lucide-react';

interface HeaderProps {
  sheetId: string;
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncStatus?: {
    status: 'idle' | 'syncing' | 'success' | 'error';
    errorText?: string;
    lastTime?: string | null;
  };
  onSync: () => void;
  onOpenGasModal: (tab?: 'config' | 'code' | 'telegram' | 'guide') => void;
  onOpenHistoryModal: () => void;
  currentUser?: string | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  sheetId,
  isSyncing,
  lastSyncTime,
  syncStatus,
  onSync,
  onOpenGasModal,
  onOpenHistoryModal,
  currentUser,
  onLogout,
}) => {
  const isError = syncStatus?.status === 'error';

  return (
    <header className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white shadow-lg border-b border-emerald-800/60 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & Hospital Name */}
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-md shadow-emerald-950/40 flex items-center justify-center flex-shrink-0">
              <div className="w-full h-full bg-emerald-950 rounded-[10px] flex items-center justify-center">
                <Building2 className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-['Prompt'] text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                  ระบบคลังยานอก <span className="text-emerald-400 font-extrabold">รพ.เขาชัยสน</span>
                </span>
                <span className="bg-emerald-800/80 text-emerald-200 text-xs px-2.5 py-0.5 rounded-full border border-emerald-700 font-medium">
                  จ.พัทลุง
                </span>
              </div>
              <p className="text-xs text-emerald-200/80 font-normal">
                Khao Chaison Hospital Out-Warehouse Pharmacy Inventory System
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 sm:space-x-2.5">
            
            {/* Auto-sync indicator & Manual Sync Button */}
            <button
              onClick={onSync}
              disabled={isSyncing}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition shadow-sm cursor-pointer ${
                isSyncing 
                  ? 'bg-emerald-800/60 text-emerald-300 cursor-not-allowed'
                  : isError
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold border border-amber-400'
                  : 'bg-emerald-800/90 hover:bg-emerald-700 text-emerald-100 hover:text-white border border-emerald-600/80'
              }`}
              title={isError ? syncStatus?.errorText || 'Google Sheet ยังไม่เชื่อมต่อ คลิกเพื่อซิงค์ใหม่' : 'กดซิงค์ข้อมูลกับ Google Sheet ได้ทันที (ระบบมี Auto-sync ในตัว)'}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-emerald-300' : isError ? 'text-slate-950' : 'text-emerald-300'}`} />
              <span>
                {isSyncing 
                  ? 'กำลังซิงค์...' 
                  : isError 
                  ? '⚠️ ชีทยังไม่ sync (ลองใหม่)' 
                  : lastSyncTime 
                  ? `ซิงค์แล้ว (${lastSyncTime})` 
                  : 'ซิงค์กับ Sheet'}
              </span>
            </button>

            {/* GAS / Google Sheet Setup & Diagnostics */}
            <button
              onClick={() => onOpenGasModal('config')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition shadow-sm cursor-pointer ${
                isError
                  ? 'bg-rose-700 hover:bg-rose-800 text-white font-bold animate-pulse border border-rose-500'
                  : 'bg-emerald-900/80 hover:bg-emerald-800 text-emerald-100 hover:text-white border border-emerald-700/80'
              }`}
              title="ตั้งค่าการเชื่อมต่อ Google Apps Script & คัดลอกโค้ด Code.gs"
            >
              {isError ? (
                <AlertCircle className="w-4 h-4 text-white" />
              ) : (
                <Settings className="w-4 h-4 text-emerald-300" />
              )}
              <span>{isError ? 'แก้โค้ด Apps Script' : 'ตั้งค่าเชื่อมต่อ'}</span>
            </button>

            {/* Direct Google Sheet Button */}
            <a
              href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 hover:text-white border border-emerald-700/80 transition shadow-sm"
              title="เปิด Google Sheet คลังยา รพ.เขาชัยสน ในแท็บใหม่"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>Google Sheet</span>
              <ExternalLink className="w-3.5 h-3.5 text-emerald-300" />
            </a>

            {/* Telegram Bot Button */}
            <button
              onClick={() => onOpenGasModal('telegram')}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-sky-900/80 hover:bg-sky-800 text-sky-200 hover:text-white border border-sky-700/80 transition shadow-sm cursor-pointer"
              title="Telegram Bot (@pharmkcsbot) - เชื่อมต่อแล้ว คลิกเพื่อทดสอบหรือตั้งค่าการแจ้งเตือน"
            >
              <Send className="w-4 h-4 text-sky-300" />
              <span className="hidden xl:inline">Telegram (@pharmkcsbot)</span>
              <span className="xl:hidden">Telegram</span>
            </button>

            {/* Dispense History */}
            <button
              onClick={onOpenHistoryModal}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium bg-emerald-900/80 hover:bg-emerald-800 text-emerald-100 hover:text-white border border-emerald-700 transition shadow-sm cursor-pointer"
              title="ประวัติการตัดยอดคลังยา"
            >
              <History className="w-4 h-4 text-teal-300" />
              <span className="hidden md:inline">ประวัติตัดยอด</span>
            </button>

            {/* Logged in User & Logout button */}
            {currentUser && (
              <div className="flex items-center pl-1 sm:pl-2 border-l border-emerald-800/80 space-x-2">
                <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-900/60 border border-emerald-700 text-xs text-emerald-200">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-semibold text-white">{currentUser}</span>
                </div>

                <button
                  onClick={onLogout}
                  className="flex items-center space-x-1 px-2.5 py-2 rounded-lg text-xs font-medium text-rose-200 hover:text-white bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 transition shadow-sm cursor-pointer"
                  title="ออกจากระบบคลังยา"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">ออกจากระบบ</span>
                </button>
              </div>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
