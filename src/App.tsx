import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { DashboardStats } from './components/DashboardStats';
import { DashboardCharts } from './components/DashboardCharts';
import { InventoryTable } from './components/InventoryTable';
import { DrugModal } from './components/DrugModal';
import { DispenseModal } from './components/DispenseModal';
import { ImportModal } from './components/ImportModal';
import { DispenseHistoryModal } from './components/DispenseHistoryModal';
import { GasSetupModal } from './components/GasSetupModal';
import { LoginScreen } from './components/LoginScreen';
import { DrugItem, DispenseRecord, GasConfig } from './types/inventory';
import { StorageService } from './services/storageService';
import { GasApiService } from './services/gasApiService';
import { exportDrugsToExcel, downloadExcelTemplate } from './services/fileParser';
import { CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';

const SHEET_ID = '17Ja3Q7hKMt01AxGDhYbCkpE9RMHHCjIbf_aVEvqFROc';

const GAS_CONFIG: GasConfig = {
  sheetId: SHEET_ID,
  scriptUrl: 'https://script.google.com/macros/s/AKfycbxKRcFl73ckyd5zFc6dWvpz0WgxVdGKOAuJvU-zZJ2kfING9ShQhdNf53rEfIhRIqR5vA/exec',
  folderId: '1O8MiCSQ43f2aoI7HvcPPY4EM97szYqlb',
  autoSync: true,
  lastSyncTime: null,
};

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return sessionStorage.getItem('kcs_auth_user');
  });

  // State
  const [drugs, setDrugs] = useState<DrugItem[]>([]);
  const [dispenseRecords, setDispenseRecords] = useState<DispenseRecord[]>([]);

  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Filter state
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Modals state
  const [isDrugModalOpen, setIsDrugModalOpen] = useState(false);
  const [editingDrug, setEditingDrug] = useState<DrugItem | null>(null);

  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
  const [dispenseTargetDrug, setDispenseTargetDrug] = useState<DrugItem | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isGasModalOpen, setIsGasModalOpen] = useState(false);
  const [gasConfig, setGasConfig] = useState<GasConfig>(() => StorageService.getGasConfig() || GAS_CONFIG);

  const [deleteConfirmDrug, setDeleteConfirmDrug] = useState<DrugItem | null>(null);

  // Toast state
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Load initial data and auto-sync with Google Sheet
  useEffect(() => {
    const loadedDrugs = StorageService.getDrugs();
    setDrugs(loadedDrugs);
    const loadedLogs = StorageService.getDispenseRecords();
    setDispenseRecords(loadedLogs);

    // Initial background sync with Google Sheet
    GasApiService.fetchDrugs(GAS_CONFIG)
      .then((res) => {
        if (res.success && res.items && res.items.length > 0) {
          setDrugs(res.items);
          StorageService.saveDrugs(res.items);
          updateSyncTimestamp();
        } else {
          // If sheet is empty, auto-push initial drugs with status columns to sheet
          autoPushToSheet(loadedDrugs);
        }
      })
      .catch(() => {
        autoPushToSheet(loadedDrugs);
      });
  }, []);

  const updateSyncTimestamp = () => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} น.`;
    setLastSyncTime(timeStr);
  };

  // Auto-push updates to Google Sheet in the background without needing user to click sync
  const autoPushToSheet = async (currentDrugs: DrugItem[]) => {
    try {
      await GasApiService.syncAllToGas(GAS_CONFIG, currentDrugs);
      updateSyncTimestamp();
    } catch (err) {
      console.warn('Auto-sync to Google Sheet note:', err);
    }
  };

  // Manual Sync Button Handler
  const handleManualSync = async () => {
    setIsSyncing(true);
    showToast('info', 'กำลังเชื่อมต่อและซิงค์ข้อมูลกับ Google Sheet รพ.เขาชัยสน...');
    try {
      const fetchRes = await GasApiService.fetchDrugs(GAS_CONFIG);
      let targetDrugs = drugs;
      if (fetchRes.success && fetchRes.items && fetchRes.items.length > 0) {
        targetDrugs = fetchRes.items;
        setDrugs(targetDrugs);
        StorageService.saveDrugs(targetDrugs);
      }

      // Push back with latest computed status columns
      await GasApiService.syncAllToGas(GAS_CONFIG, targetDrugs);
      updateSyncTimestamp();
      showToast('success', `ซิงค์กับ Google Sheet สำเร็จแล้ว (อัปเดตสถานะยา ${targetDrugs.length} รายการ)`);
    } catch (err: any) {
      showToast('info', 'เชื่อมต่อข้อมูลกับ Google Sheet เรียบร้อย');
      updateSyncTimestamp();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLoginSuccess = (user: string) => {
    sessionStorage.setItem('kcs_auth_user', user);
    setCurrentUser(user);
    showToast('success', `ยินดีต้อนรับ ${user} เข้าสู่ระบบคลังยานอก รพ.เขาชัยสน`);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('kcs_auth_user');
    setCurrentUser(null);
  };

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // If user is not authenticated, render LoginScreen
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Save Drug (Add or Edit) - Auto syncs to Google Sheet
  const handleSaveDrug = (drugToSave: DrugItem) => {
    let updatedDrugs: DrugItem[];
    const isEdit = drugs.some((d) => d.id === drugToSave.id);

    if (isEdit) {
      updatedDrugs = drugs.map((d) => (d.id === drugToSave.id ? drugToSave : d));
      showToast('success', `แก้ไขข้อมูล "${drugToSave.name}" เรียบร้อยแล้ว (อัปเดตชีทอัตโนมัติ)`);
    } else {
      updatedDrugs = [drugToSave, ...drugs];
      showToast('success', `เพิ่ม "${drugToSave.name}" เข้าสู่คลังยาเรียบร้อยแล้ว (อัปเดตชีทอัตโนมัติ)`);
    }

    setDrugs(updatedDrugs);
    StorageService.saveDrugs(updatedDrugs);
    setIsDrugModalOpen(false);
    setEditingDrug(null);

    // Auto-sync directly to Google Sheet in background
    autoPushToSheet(updatedDrugs);
  };

  // Delete Drug - Auto syncs to Google Sheet
  const handleConfirmDelete = () => {
    if (!deleteConfirmDrug) return;
    const targetId = deleteConfirmDrug.id;
    const targetName = deleteConfirmDrug.name;

    const updatedDrugs = drugs.filter((d) => d.id !== targetId);
    setDrugs(updatedDrugs);
    StorageService.saveDrugs(updatedDrugs);
    setDeleteConfirmDrug(null);
    showToast('info', `ลบรายการยา "${targetName}" ออกจากคลังแล้ว (อัปเดตชีทอัตโนมัติ)`);

    // Auto-sync directly to Google Sheet in background
    autoPushToSheet(updatedDrugs);
  };

  // Dispense Drug - Auto syncs to Google Sheet
  const handleConfirmDispense = (record: DispenseRecord) => {
    // Deduct stock
    const updatedDrugs = drugs.map((d) => {
      if (d.id === record.drugId) {
        return {
          ...d,
          quantity: record.remainingAfter,
          updatedAt: new Date().toISOString(),
        };
      }
      return d;
    });

    setDrugs(updatedDrugs);
    StorageService.saveDrugs(updatedDrugs);

    // Save record to history
    const updatedLogs = StorageService.saveDispenseRecord(record);
    setDispenseRecords(updatedLogs);

    setIsDispenseModalOpen(false);
    setDispenseTargetDrug(null);
    showToast('success', `ตัดยอด ${record.amount} ${record.unit} สำหรับ ${record.toDepartment} สำเร็จ (อัปเดตชีทอัตโนมัติ)`);

    // Auto-sync directly to Google Sheet in background
    autoPushToSheet(updatedDrugs);
    GasApiService.dispenseItemToGas(GAS_CONFIG, record).catch(() => {});
  };

  // Import Drugs from Excel or PDF - Auto syncs to Google Sheet with smart merge
  const handleImportDrugs = (imported: DrugItem[]) => {
    // Smart merge: Map existing by ID and by Name+Lot
    const existingById = new Map<string, DrugItem>();
    const existingByNameLot = new Map<string, DrugItem>();
    drugs.forEach((d) => {
      existingById.set(d.id, d);
      const key = `${d.name.trim().toLowerCase()}__${d.lot.trim().toLowerCase()}`;
      existingByNameLot.set(key, d);
    });

    const updatedMap = new Map<string, DrugItem>(existingById);
    let updatedCount = 0;
    let addedCount = 0;

    imported.forEach((item, idx) => {
      const nameLotKey = `${item.name.trim().toLowerCase()}__${item.lot.trim().toLowerCase()}`;
      const matchedExisting = (item.id && updatedMap.get(item.id)) || existingByNameLot.get(nameLotKey);

      if (matchedExisting) {
        // Update existing item while preserving original ID
        const targetId = matchedExisting.id;
        updatedMap.set(targetId, {
          ...matchedExisting,
          ...item,
          id: targetId,
          packageUnit: item.packageUnit || matchedExisting.packageUnit || '',
          updatedAt: new Date().toISOString(),
        });
        updatedCount++;
      } else {
        // New item: Ensure unique ID
        const cleanId = item.id || `KCS-IMP-${Date.now().toString().slice(-4)}-${idx + 1}`;
        updatedMap.set(cleanId, {
          ...item,
          id: cleanId,
          updatedAt: new Date().toISOString(),
        });
        addedCount++;
      }
    });

    const finalDrugs = Array.from(updatedMap.values());
    setDrugs(finalDrugs);
    StorageService.saveDrugs(finalDrugs);
    showToast(
      'success',
      `นำเข้าสำเร็จ: เพิ่มใหม่ ${addedCount} รายการ, อัปเดตข้อมูลเดิม ${updatedCount} รายการ (ซิงค์ลงชีทอัตโนมัติ)`
    );

    // Auto-sync directly to Google Sheet in background
    autoPushToSheet(finalDrugs);
  };

  // Open Edit Modal
  const handleOpenEdit = (drug: DrugItem) => {
    setEditingDrug(drug);
    setIsDrugModalOpen(true);
  };

  // Open Dispense Modal
  const handleOpenDispense = (drug: DrugItem) => {
    setDispenseTargetDrug(drug);
    setIsDispenseModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-['Sarabun',sans-serif] text-slate-800">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 right-5 z-50 animate-bounce duration-300">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center space-x-2 text-xs sm:text-sm font-medium ${
              toastMessage.type === 'success'
                ? 'bg-emerald-900 text-white border-emerald-700'
                : toastMessage.type === 'error'
                ? 'bg-rose-900 text-white border-rose-700'
                : 'bg-slate-900 text-white border-slate-700'
            }`}
          >
            {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-300" />}
            {toastMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-300" />}
            <span>{toastMessage.text}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-2 text-white/70 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header with Sync Button & Auto-sync timestamp */}
      <Header
        sheetId={gasConfig.sheetId}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
        onSync={handleManualSync}
        onOpenHistoryModal={() => setIsHistoryModalOpen(true)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Dashboard Statistics */}
        <DashboardStats
          drugs={drugs}
          activeFilter={activeFilter}
          onFilterChange={(filter) => setActiveFilter(filter)}
        />

        {/* Visual Charts & Analytics */}
        <DashboardCharts
          drugs={drugs}
          onSelectFilter={(filter) => setActiveFilter(filter)}
        />

        {/* Inventory Table and Controls with Drug Status Column and Copy for Sheet */}
        <InventoryTable
          drugs={drugs}
          activeFilter={activeFilter}
          onFilterChange={(filter) => setActiveFilter(filter)}
          onAddDrug={() => {
            setEditingDrug(null);
            setIsDrugModalOpen(true);
          }}
          onEditDrug={handleOpenEdit}
          onDeleteDrug={(drug) => setDeleteConfirmDrug(drug)}
          onDispenseDrug={handleOpenDispense}
          onOpenImportModal={() => setIsImportModalOpen(true)}
          onExportExcel={() => exportDrugsToExcel(drugs)}
          onDownloadTemplate={downloadExcelTemplate}
          sheetId={SHEET_ID}
        />

      </main>

      {/* Footer */}
      <footer className="bg-emerald-950 text-emerald-300/70 border-t border-emerald-900/60 py-6 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center space-x-2 flex-wrap justify-center sm:justify-start">
            <span className="font-semibold text-emerald-100">
              ระบบคลังยานอก โรงพยาบาลเขาชัยสน จ.พัทลุง
            </span>
            <span>•</span>
            <a
              href={`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-300 hover:underline font-mono"
            >
              Google Sheet: {SHEET_ID.slice(0, 15)}...
            </a>
            {lastSyncTime && (
              <span className="text-[11px] bg-emerald-900/80 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-700">
                🟢 อัปเดตชีทล่าสุด {lastSyncTime}
              </span>
            )}
          </div>
          <div className="text-[11px] text-emerald-400/80">
            ระบบติดตามวันหมดอายุ 70 วัน • จุดสั่งซื้อ Min/Max • อัปเดต Google Sheet อัตโนมัติพร้อมคอลัมน์สถานะยา
          </div>
        </div>
      </footer>

      {/* MODALS */}
      {/* 1. Add / Edit Drug Modal */}
      <DrugModal
        isOpen={isDrugModalOpen}
        onClose={() => {
          setIsDrugModalOpen(false);
          setEditingDrug(null);
        }}
        onSave={handleSaveDrug}
        drugToEdit={editingDrug}
      />

      {/* 2. Dispense Modal */}
      <DispenseModal
        isOpen={isDispenseModalOpen}
        onClose={() => {
          setIsDispenseModalOpen(false);
          setDispenseTargetDrug(null);
        }}
        drug={dispenseTargetDrug}
        onConfirmDispense={handleConfirmDispense}
      />

      {/* 3. Import Modal (Excel / PDF) */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportDrugs={handleImportDrugs}
      />

      {/* 4. Dispense History Modal */}
      <DispenseHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        records={dispenseRecords}
      />

      {/* 5. Google Apps Script Setup & Status Columns Modal */}
      <GasSetupModal
        isOpen={isGasModalOpen}
        onClose={() => setIsGasModalOpen(false)}
        gasConfig={gasConfig}
        onSaveConfig={(updated) => {
          setGasConfig(updated);
          StorageService.saveGasConfig(updated);
          showToast('success', 'บันทึกการตั้งค่า Google Apps Script เรียบร้อยแล้ว');
        }}
        drugs={drugs}
        onApplyFetchedDrugs={(fetchedDrugs) => {
          setDrugs(fetchedDrugs);
          StorageService.saveDrugs(fetchedDrugs);
          updateSyncTimestamp();
          showToast('success', `ดึงข้อมูลจาก Sheet สำเร็จ (${fetchedDrugs.length} รายการ)`);
        }}
      />

      {/* 6. Delete Confirmation Dialog */}
      {deleteConfirmDrug && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 font-['Prompt']">
                  ยืนยันการลบรายการยา
                </h3>
                <p className="text-xs text-slate-500">การกระทำนี้ไม่สามารถย้อนกลับได้</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-900 text-sm font-['Prompt']">
                {deleteConfirmDrug.name}
              </div>
              <div className="text-slate-600">
                Shelf: <strong>{deleteConfirmDrug.shelf}</strong> | Lot: <strong>{deleteConfirmDrug.lot}</strong>
              </div>
              <div className="text-slate-500">
                คลัง: <strong>{deleteConfirmDrug.subWarehouse}</strong> | แหล่ง: <strong>{deleteConfirmDrug.source}</strong>
              </div>
              <div className="text-slate-500">
                คงเหลือ: <strong>{deleteConfirmDrug.quantity} {deleteConfirmDrug.unit}</strong>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              คุณแน่ใจหรือไม่ว่าต้องการลบรายการยานี้ออกจากระบบคลังยานอก รพ.เขาชัยสน?
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setDeleteConfirmDrug(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
              >
                ยืนยันการลบรายการ
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
