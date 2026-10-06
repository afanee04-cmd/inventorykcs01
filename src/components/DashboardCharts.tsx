import React from 'react';
import { 
  BarChart3, 
  PieChart as PieIcon, 
  Layers, 
  Activity, 
  AlertTriangle,
  TrendingDown,
  Building,
  CheckCircle2,
  Package
} from 'lucide-react';
import { DrugItem, SubWarehouse, SourceType } from '../types/inventory';
import { getDrugStatus } from '../utils/drugUtils';

interface DashboardChartsProps {
  drugs: DrugItem[];
  onSelectFilter: (filter: string) => void;
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  drugs,
  onSelectFilter,
}) => {
  // 1. คำนวณข้อมูลตามคลังย่อย
  const subWarehouseData: Record<string, { count: number; totalQty: number; color: string; bg: string; filterKey: string }> = {
    'OPD': { count: 0, totalQty: 0, color: '#047857', bg: 'bg-emerald-700', filterKey: 'sub_OPD' },
    'IPD': { count: 0, totalQty: 0, color: '#1d4ed8', bg: 'bg-blue-700', filterKey: 'sub_IPD' },
    'ER': { count: 0, totalQty: 0, color: '#e11d48', bg: 'bg-rose-700', filterKey: 'sub_ER' },
    'คลังใหญ่ (Main)': { count: 0, totalQty: 0, color: '#0f766e', bg: 'bg-teal-700', filterKey: 'all' },
  };

  // 2. คำนวณข้อมูลตามแหล่งที่มา
  const sourceData: Record<string, { count: number; totalQty: number; color: string; filterKey: string }> = {
    'GPO': { count: 0, totalQty: 0, color: '#059669', filterKey: 'src_GPO' },
    'ไม่ใช่ GPO': { count: 0, totalQty: 0, color: '#6366f1', filterKey: 'src_NON_GPO' },
    'รพ.พัทลุง': { count: 0, totalQty: 0, color: '#0891b2', filterKey: 'src_PTL' },
    'อื่นๆ': { count: 0, totalQty: 0, color: '#94a3b8', filterKey: 'all' },
  };

  // 3. คำนวณสถานะความปลอดภัย/หมดอายุ
  let safeCount = 0;
  let nearExpiryCount = 0; // <= 70 วัน
  let expiredCount = 0;
  let lowStockCount = 0;

  drugs.forEach((drug) => {
    const sub = drug.subWarehouse || 'OPD';
    if (subWarehouseData[sub]) {
      subWarehouseData[sub].count += 1;
      subWarehouseData[sub].totalQty += Number(drug.quantity || 0);
    } else {
      subWarehouseData['OPD'].count += 1;
      subWarehouseData['OPD'].totalQty += Number(drug.quantity || 0);
    }

    const src = drug.source || 'GPO';
    if (sourceData[src]) {
      sourceData[src].count += 1;
      sourceData[src].totalQty += Number(drug.quantity || 0);
    } else {
      sourceData['อื่นๆ'].count += 1;
      sourceData['อื่นๆ'].totalQty += Number(drug.quantity || 0);
    }

    const st = getDrugStatus(drug);
    if (st.expiryStatus === 'expired') expiredCount++;
    else if (st.expiryStatus === 'near_expiry') nearExpiryCount++;
    else safeCount++;

    if (st.stockStatus === 'low') lowStockCount++;
  });

  const totalDrugsCount = drugs.length || 1;
  const maxSubQty = Math.max(...Object.values(subWarehouseData).map((d) => d.totalQty), 100);

  // SVG Donut Chart Calculation for Sources
  const totalSourceCount = drugs.length || 1;
  let cumulativePercent = 0;

  const donutSegments = Object.entries(sourceData)
    .filter(([_, data]) => data.count > 0)
    .map(([key, data]) => {
      const percentage = (data.count / totalSourceCount) * 100;
      const strokeDasharray = `${percentage} ${100 - percentage}`;
      const strokeDashoffset = -cumulativePercent;
      cumulativePercent += percentage;
      return {
        key,
        count: data.count,
        totalQty: data.totalQty,
        color: data.color,
        percentage,
        strokeDasharray,
        strokeDashoffset,
        filterKey: data.filterKey,
      };
    });

  // Top Low Stock Items for Visual Progress Bars
  const lowStockDrugs = drugs
    .filter((d) => Number(d.quantity) <= Number(d.min) || (Number(d.quantity) <= Number(d.min) * 1.5))
    .sort((a, b) => (Number(a.quantity) / (a.min || 1)) - (Number(b.quantity) / (b.min || 1)))
    .slice(0, 4);

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-5">
      
      {/* Chart Section Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold font-['Prompt'] text-slate-800">
              แผนภูมิและกราฟวิเคราะห์คลังยานอก รพ.เขาชัยสน
            </h3>
            <p className="text-xs text-slate-500">
              สัดส่วนคลังย่อย แหล่งจัดซื้อ และความปลอดภัยของสต็อกยา
            </p>
          </div>
        </div>
      </div>

      {/* Grid of 3 Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Chart 1: Bar Chart - ปริมาณยาตามคลังย่อย (OPD / IPD / ER) */}
        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold font-['Prompt'] text-slate-700 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-emerald-700" />
                <span>ปริมาณสต็อกตามคลังย่อย (หน่วยชิ้น)</span>
              </span>
              <span className="text-[11px] text-slate-400">คลิกที่แท่งเพื่อกรอง</span>
            </div>

            <div className="space-y-3 pt-1">
              {Object.entries(subWarehouseData).map(([key, data]) => {
                const percentage = Math.round((data.totalQty / maxSubQty) * 100);
                return (
                  <button
                    key={key}
                    onClick={() => onSelectFilter(data.filterKey)}
                    className="w-full text-left group transition hover:opacity-90 cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-700 group-hover:text-emerald-800 flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: data.color }}
                        />
                        <span>{key}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({data.count} รายการ)
                        </span>
                      </span>
                      <span className="font-mono font-bold text-slate-800">
                        {data.totalQty.toLocaleString()} ชิ้น
                      </span>
                    </div>

                    {/* Bar track */}
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.max(percentage, 4)}%`,
                          backgroundColor: data.color,
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
            <span>รวมทั้งหมด: {drugs.reduce((sum, d) => sum + Number(d.quantity || 0), 0).toLocaleString()} ชิ้น</span>
            <span className="text-emerald-700 font-medium">OPD / IPD / ER</span>
          </div>
        </div>

        {/* Chart 2: Donut Chart - สัดส่วนตามแหล่งที่มา (GPO, ไม่ใช่ GPO, รพ.พัทลุง) */}
        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold font-['Prompt'] text-slate-700 flex items-center gap-1.5">
                <PieIcon className="w-4 h-4 text-teal-700" />
                <span>สัดส่วนแหล่งที่มา (Sources)</span>
              </span>
              <span className="text-[11px] text-slate-400">GPO / อื่นๆ</span>
            </div>

            {/* Circular Donut Graphic */}
            <div className="flex items-center justify-center py-2 relative">
              <div className="relative w-36 h-36">
                <svg viewBox="0 0 42 42" className="w-full h-full -rotate-90">
                  <circle
                    cx="21"
                    cy="21"
                    r="15.91549430918954"
                    fill="transparent"
                    stroke="#e2e8f0"
                    strokeWidth="4"
                  />
                  {donutSegments.map((segment) => (
                    <circle
                      key={segment.key}
                      cx="21"
                      cy="21"
                      r="15.91549430918954"
                      fill="transparent"
                      stroke={segment.color}
                      strokeWidth="5"
                      strokeDasharray={segment.strokeDasharray}
                      strokeDashoffset={segment.strokeDashoffset}
                      className="transition-all duration-700 hover:opacity-80 cursor-pointer"
                      onClick={() => onSelectFilter(segment.filterKey)}
                    />
                  ))}
                </svg>

                {/* Center count in Donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-xl font-bold font-['Prompt'] text-slate-800 leading-none">
                    {drugs.length}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">รายการ</span>
                </div>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              {donutSegments.map((seg) => (
                <button
                  key={seg.key}
                  onClick={() => onSelectFilter(seg.filterKey)}
                  className="flex items-center space-x-1.5 text-xs text-left p-1.5 rounded-lg hover:bg-slate-200/50 transition cursor-pointer"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <div className="truncate">
                    <span className="font-semibold text-slate-700 block truncate text-[11px]">
                      {seg.key}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {seg.count} รายการ ({seg.percentage.toFixed(0)}%)
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 text-[10px] text-slate-400 text-center">
            * สัดส่วนยาองค์การเภสัชกรรม (GPO) และ รพ.พัทลุง
          </div>
        </div>

        {/* Chart 3: Expiry & Stock Health Summary */}
        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold font-['Prompt'] text-slate-700 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-700" />
                <span>สถานะวันหมดอายุ & ความปลอดภัย</span>
              </span>
              <span className="text-[11px] text-slate-400">เกณฑ์ 70 วัน</span>
            </div>

            <div className="space-y-2.5">
              
              {/* Safe Drugs */}
              <button
                onClick={() => onSelectFilter('all')}
                className="w-full p-2.5 bg-white rounded-xl border border-emerald-200 flex items-center justify-between hover:bg-emerald-50/40 transition text-left cursor-pointer"
              >
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-slate-700">ปลอดภัย (&gt; 70 วัน)</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-700 font-mono">
                    {safeCount} รายการ
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1">
                    ({((safeCount / totalDrugsCount) * 100).toFixed(0)}%)
                  </span>
                </div>
              </button>

              {/* Near Expiry (<= 70 days) */}
              <button
                onClick={() => onSelectFilter('near_expiry')}
                className="w-full p-2.5 bg-white rounded-xl border border-amber-300 flex items-center justify-between hover:bg-amber-50/40 transition text-left cursor-pointer"
              >
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-xs font-semibold text-amber-900">ใกล้หมดอายุ (≤ 70 วัน)</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-amber-700 font-mono">
                    {nearExpiryCount} รายการ
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1">
                    ({((nearExpiryCount / totalDrugsCount) * 100).toFixed(0)}%)
                  </span>
                </div>
              </button>

              {/* Expired */}
              <button
                onClick={() => onSelectFilter('expired')}
                className="w-full p-2.5 bg-white rounded-xl border border-rose-300 flex items-center justify-between hover:bg-rose-50/40 transition text-left cursor-pointer"
              >
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                  <span className="text-xs font-semibold text-rose-900">หมดอายุแล้ว</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-rose-700 font-mono">
                    {expiredCount} รายการ
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1">
                    ({((expiredCount / totalDrugsCount) * 100).toFixed(0)}%)
                  </span>
                </div>
              </button>

              {/* Below Min */}
              <button
                onClick={() => onSelectFilter('low_stock')}
                className="w-full p-2.5 bg-white rounded-xl border border-orange-300 flex items-center justify-between hover:bg-orange-50/40 transition text-left cursor-pointer"
              >
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  <span className="text-xs font-semibold text-orange-950">สต็อกถึงเกณฑ์ Min</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-orange-700 font-mono">
                    {lowStockCount} รายการ
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1">
                    ({((lowStockCount / totalDrugsCount) * 100).toFixed(0)}%)
                  </span>
                </div>
              </button>

            </div>
          </div>

          <div className="mt-3 text-[11px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-200/60">
            <span>สถานะเฝ้าระวังรวม:</span>
            <span className="font-bold text-amber-700">
              {nearExpiryCount + expiredCount + lowStockCount} รายการ
            </span>
          </div>
        </div>

      </div>

      {/* Progress Bars: Top Critical Min Items */}
      {lowStockDrugs.length > 0 && (
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold font-['Prompt'] text-slate-700 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-orange-600" />
              <span>รายการยาที่สต็อกถึงเกณฑ์ Min (ต้องสั่งเพิ่มเร่งด่วน)</span>
            </span>
            <button
              onClick={() => onSelectFilter('low_stock')}
              className="text-[11px] text-emerald-700 hover:underline"
            >
              ดูทั้งหมด ({lowStockCount}) →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {lowStockDrugs.map((d) => {
              const current = Number(d.quantity || 0);
              const minVal = Number(d.min || 1);
              const percentOfMin = Math.round((current / minVal) * 100);

              return (
                <div
                  key={d.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5"
                >
                  <div className="flex items-start justify-between">
                    <span className="font-semibold text-slate-800 truncate pr-2" title={d.name}>
                      {d.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 font-semibold flex-shrink-0">
                      คลัง {d.subWarehouse}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">คงเหลือ:</span>
                    <span className={`font-bold ${current <= minVal ? 'text-rose-600' : 'text-slate-800'}`}>
                      {current} / Min {minVal} {d.unit}
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        percentOfMin <= 100 ? 'bg-rose-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(percentOfMin, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
