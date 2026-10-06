import React from 'react';
import { 
  Package, 
  AlertTriangle, 
  Clock, 
  TrendingDown, 
  Send,
  Building,
  CheckCircle2,
  Layers,
  ArrowRight
} from 'lucide-react';
import { DrugItem, SubWarehouse, SourceType } from '../types/inventory';
import { getDrugStatus } from '../utils/drugUtils';

interface DashboardStatsProps {
  drugs: DrugItem[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({
  drugs,
  activeFilter,
  onFilterChange,
}) => {
  // คำนวณสถิติ
  let expiredCount = 0;
  let nearExpiryCount = 0; // <= 70 วัน
  let lowStockCount = 0;   // quantity <= min
  let safeCount = 0;
  let totalQuantity = 0;

  const subWarehouseCount: Record<string, number> = {
    'OPD': 0,
    'IPD': 0,
    'ER': 0,
    'คลังใหญ่ (Main)': 0,
  };

  const sourceCount: Record<string, number> = {
    'GPO': 0,
    'ไม่ใช่ GPO': 0,
    'รพ.พัทลุง': 0,
    'อื่นๆ': 0,
  };

  drugs.forEach((drug) => {
    totalQuantity += Number(drug.quantity || 0);
    const status = getDrugStatus(drug);

    if (status.expiryStatus === 'expired') {
      expiredCount++;
    } else if (status.expiryStatus === 'near_expiry') {
      nearExpiryCount++;
    } else {
      safeCount++;
    }

    if (status.stockStatus === 'low') {
      lowStockCount++;
    }

    if (subWarehouseCount[drug.subWarehouse] !== undefined) {
      subWarehouseCount[drug.subWarehouse]++;
    } else {
      subWarehouseCount['OPD']++;
    }

    if (sourceCount[drug.source] !== undefined) {
      sourceCount[drug.source]++;
    } else {
      sourceCount['อื่นๆ']++;
    }
  });

  const totalUrgent = expiredCount + nearExpiryCount + lowStockCount;

  return (
    <div className="space-y-4">
      
      {/* Urgent Warning Banner if any urgent items exist */}
      {totalUrgent > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-emerald-500/10 border-l-4 border-amber-500 bg-white rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start sm:items-center space-x-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-700 flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 font-['Prompt']">
                แจ้งเตือนเร่งด่วนคลังยา: พบ {totalUrgent} รายการที่ต้องตรวจสอบ
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                {expiredCount > 0 && <span className="text-rose-600 font-semibold mr-2">• หมดอายุแล้ว {expiredCount} รายการ</span>}
                {nearExpiryCount > 0 && <span className="text-amber-700 font-semibold mr-2">• ใกล้หมดอายุ (≤ 70 วัน) {nearExpiryCount} รายการ</span>}
                {lowStockCount > 0 && <span className="text-orange-700 font-semibold">• สต็อกต่ำกว่า Min {lowStockCount} รายการ</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 self-end sm:self-center">
            <button
              onClick={() => onFilterChange(expiredCount > 0 ? 'expired' : (nearExpiryCount > 0 ? 'near_expiry' : 'low_stock'))}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition active:scale-95 cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>กรองดูรายการด่วน ({totalUrgent})</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Total Drugs Card */}
        <button
          onClick={() => onFilterChange('all')}
          className={`p-4 rounded-xl border text-left transition relative overflow-hidden group shadow-sm ${
            activeFilter === 'all'
              ? 'bg-emerald-900 text-white border-emerald-950 ring-2 ring-emerald-600'
              : 'bg-white hover:bg-emerald-50/50 text-slate-800 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${activeFilter === 'all' ? 'text-emerald-200' : 'text-slate-500'}`}>
              รายการยาทั้งหมด
            </span>
            <div className={`p-2 rounded-lg ${activeFilter === 'all' ? 'bg-emerald-800 text-emerald-300' : 'bg-emerald-100 text-emerald-800'}`}>
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-bold font-['Prompt']">{drugs.length}</span>
            <span className={`text-xs ${activeFilter === 'all' ? 'text-emerald-200' : 'text-slate-500'}`}>รายการ</span>
          </div>
          <p className={`text-[11px] mt-1 ${activeFilter === 'all' ? 'text-emerald-300' : 'text-slate-500'}`}>
            รวม {totalQuantity.toLocaleString()} ชิ้นในระบบ
          </p>
        </button>

        {/* Expired Drugs Card */}
        <button
          onClick={() => onFilterChange('expired')}
          className={`p-4 rounded-xl border text-left transition relative overflow-hidden group shadow-sm ${
            activeFilter === 'expired'
              ? 'bg-rose-900 text-white border-rose-950 ring-2 ring-rose-500'
              : 'bg-white hover:bg-rose-50/40 text-slate-800 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${activeFilter === 'expired' ? 'text-rose-200' : 'text-rose-700'}`}>
              ยาหมดอายุแล้ว
            </span>
            <div className={`p-2 rounded-lg ${activeFilter === 'expired' ? 'bg-rose-800 text-rose-200' : 'bg-rose-100 text-rose-700'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className={`text-2xl sm:text-3xl font-bold font-['Prompt'] ${activeFilter === 'expired' ? 'text-white' : 'text-rose-600'}`}>
              {expiredCount}
            </span>
            <span className={`text-xs ${activeFilter === 'expired' ? 'text-rose-200' : 'text-rose-600'}`}>รายการ</span>
          </div>
          <p className={`text-[11px] mt-1 ${activeFilter === 'expired' ? 'text-rose-200' : 'text-slate-500'}`}>
            ต้องแยกทำลาย/ส่งคืนทันที
          </p>
        </button>

        {/* Near Expiry Card (<= 70 days) */}
        <button
          onClick={() => onFilterChange('near_expiry')}
          className={`p-4 rounded-xl border text-left transition relative overflow-hidden group shadow-sm ${
            activeFilter === 'near_expiry'
              ? 'bg-amber-900 text-white border-amber-950 ring-2 ring-amber-500'
              : 'bg-white hover:bg-amber-50/40 text-slate-800 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${activeFilter === 'near_expiry' ? 'text-amber-200' : 'text-amber-800'}`}>
              ใกล้หมดอายุ (≤ 70 วัน)
            </span>
            <div className={`p-2 rounded-lg ${activeFilter === 'near_expiry' ? 'bg-amber-800 text-amber-200' : 'bg-amber-100 text-amber-800'}`}>
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className={`text-2xl sm:text-3xl font-bold font-['Prompt'] ${activeFilter === 'near_expiry' ? 'text-white' : 'text-amber-700'}`}>
              {nearExpiryCount}
            </span>
            <span className={`text-xs ${activeFilter === 'near_expiry' ? 'text-amber-200' : 'text-amber-700'}`}>รายการ</span>
          </div>
          <p className={`text-[11px] mt-1 ${activeFilter === 'near_expiry' ? 'text-amber-200' : 'text-slate-500'}`}>
            เตือนตามเกณฑ์ 70 วัน
          </p>
        </button>

        {/* Low Stock Card (<= min) */}
        <button
          onClick={() => onFilterChange('low_stock')}
          className={`p-4 rounded-xl border text-left transition relative overflow-hidden group shadow-sm ${
            activeFilter === 'low_stock'
              ? 'bg-orange-950 text-white border-orange-900 ring-2 ring-orange-500'
              : 'bg-white hover:bg-orange-50/40 text-slate-800 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${activeFilter === 'low_stock' ? 'text-orange-200' : 'text-orange-800'}`}>
              สต็อกถึงเกณฑ์ Min
            </span>
            <div className={`p-2 rounded-lg ${activeFilter === 'low_stock' ? 'bg-orange-800 text-orange-200' : 'bg-orange-100 text-orange-800'}`}>
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className={`text-2xl sm:text-3xl font-bold font-['Prompt'] ${activeFilter === 'low_stock' ? 'text-white' : 'text-orange-600'}`}>
              {lowStockCount}
            </span>
            <span className={`text-xs ${activeFilter === 'low_stock' ? 'text-orange-200' : 'text-orange-600'}`}>รายการ</span>
          </div>
          <p className={`text-[11px] mt-1 ${activeFilter === 'low_stock' ? 'text-orange-200' : 'text-slate-500'}`}>
            ปริมาณถึงจุดสั่งซื้อเพิ่ม
          </p>
        </button>

      </div>

      {/* Sub-Warehouse and Source Breakdown Badges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        
        {/* คลังย่อย: OPD / IPD / ER */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-700 font-['Prompt']">คลังย่อย (Sub-warehouse)</span>
              <p className="text-[11px] text-slate-500">จำแนกตามจุดเก็บ</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onFilterChange('sub_OPD')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                activeFilter === 'sub_OPD' 
                  ? 'bg-emerald-800 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              OPD ({subWarehouseCount['OPD'] || 0})
            </button>
            <button
              onClick={() => onFilterChange('sub_IPD')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                activeFilter === 'sub_IPD' 
                  ? 'bg-blue-800 text-white shadow-sm'
                  : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              IPD ({subWarehouseCount['IPD'] || 0})
            </button>
            <button
              onClick={() => onFilterChange('sub_ER')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                activeFilter === 'sub_ER' 
                  ? 'bg-rose-800 text-white shadow-sm'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              ER ({subWarehouseCount['ER'] || 0})
            </button>
          </div>
        </div>

        {/* แหล่งที่มา: GPO / ไม่ใช่ GPO / รพ.พัทลุง */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-teal-100 text-teal-800 rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-700 font-['Prompt']">แหล่งที่มา (Source)</span>
              <p className="text-[11px] text-slate-500">GPO / ไม่ใช่ GPO / รพ.พัทลุง</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onFilterChange('src_GPO')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                activeFilter === 'src_GPO' 
                  ? 'bg-teal-800 text-white shadow-sm'
                  : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200'
              }`}
            >
              GPO ({sourceCount['GPO'] || 0})
            </button>
            <button
              onClick={() => onFilterChange('src_NON_GPO')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                activeFilter === 'src_NON_GPO' 
                  ? 'bg-indigo-800 text-white shadow-sm'
                  : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200'
              }`}
            >
              ไม่ใช่ GPO ({sourceCount['ไม่ใช่ GPO'] || 0})
            </button>
            <button
              onClick={() => onFilterChange('src_PTL')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                activeFilter === 'src_PTL' 
                  ? 'bg-cyan-800 text-white shadow-sm'
                  : 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100 border border-cyan-200'
              }`}
            >
              รพ.พัทลุง ({sourceCount['รพ.พัทลุง'] || 0})
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
