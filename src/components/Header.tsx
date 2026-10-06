import React from 'react';
import { 
  Building2, 
  History, 
  ExternalLink, 
  LogOut,
  UserCheck,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';

interface HeaderProps {
  sheetId: string;
  isSyncing: boolean;
  lastSyncTime: string | null;
  onSync: () => void;
  onOpenGasModal?: () => void;
  onOpenHistoryModal: () => void;
  currentUser?: string | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  sheetId,
  isSyncing,
  lastSyncTime,
  onSync,
  onOpenHistoryModal,
  currentUser,
  onLogout,
}) => {
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
                  : 'bg-emerald-800/90 hover:bg-emerald-700 text-emerald-100 hover:text-white border border-emerald-600/80'
              }`}
              title="กดซิงค์ข้อมูลกับ Google Sheet ได้ทันที (ระบบมี Auto-sync ในตัว)"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-300 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'กำลังซิงค์...' : 'ซิงค์กับ Sheet'}</span>
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
              <span>เปิด Google Sheet</span>
              <ExternalLink className="w-3.5 h-3.5 text-emerald-300" />
            </a>

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
