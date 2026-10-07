import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  FileSpreadsheet, 
  Download, 
  ArrowUpDown, 
  Edit3, 
  Trash2, 
  MinusCircle, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  HelpCircle,
  FileText,
  Copy,
  Check
} from 'lucide-react';
import { DrugItem, SubWarehouse, SourceType } from '../types/inventory';
import { getDrugStatus, getSimpleDrugStatus, formatThaiDate, getDaysLeftBadge } from '../utils/drugUtils';

interface InventoryTableProps {
  drugs: DrugItem[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  onAddDrug: () => void;
  onEditDrug: (drug: DrugItem) => void;
  onDeleteDrug: (drug: DrugItem) => void;
  onDispenseDrug: (drug: DrugItem) => void;
  onOpenImportModal: () => void;
  onExportExcel: () => void;
  onDownloadTemplate: () => void;
  sheetId?: string;
}

export const InventoryTable: React.FC<InventoryTableProps> = ({
  drugs,
  activeFilter,
  onFilterChange,
  onAddDrug,
  onEditDrug,
  onDeleteDrug,
  onDispenseDrug,
  onOpenImportModal,
  onExportExcel,
  onDownloadTemplate,
  sheetId = '17Ja3Q7hKMt01AxGDhYbCkpE9RMHHCjIbf_aVEvqFROc',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [subWarehouseFilter, setSubWarehouseFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'name' | 'expiryDate' | 'quantity' | 'daysLeft'>('daysLeft');
  const [sortAsc, setSortAsc] = useState(true);
  const [copiedSheetNotice, setCopiedSheetNotice] = useState(false);

  // กรองข้อมูล
  const filteredDrugs = useMemo(() => {
    return drugs.filter((drug) => {
      const status = getDrugStatus(drug);

      // กรองจาก search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = drug.name.toLowerCase().includes(query);
        const matchesShelf = drug.shelf.toLowerCase().includes(query);
        const matchesLot = drug.lot.toLowerCase().includes(query);
        const matchesCompany = drug.company.toLowerCase().includes(query);
        const matchesNotes = (drug.notes || '').toLowerCase().includes(query);
        const matchesPackage = (drug.packageUnit || '').toLowerCase().includes(query);
        if (!matchesName && !matchesShelf && !matchesLot && !matchesCompany && !matchesNotes && !matchesPackage) {
          return false;
        }
      }

      // กรองตาม activeFilter จาก Dashboard
      if (activeFilter === 'expired' && status.expiryStatus !== 'expired') return false;
      if (activeFilter === 'near_expiry' && status.expiryStatus !== 'near_expiry') return false;
      if (activeFilter === 'low_stock' && status.stockStatus !== 'low') return false;
      if (activeFilter === 'sub_OPD' && drug.subWarehouse !== 'OPD') return false;
      if (activeFilter === 'sub_IPD' && drug.subWarehouse !== 'IPD') return false;
      if (activeFilter === 'sub_ER' && drug.subWarehouse !== 'ER') return false;
      if (activeFilter === 'src_GPO' && drug.source !== 'GPO') return false;
      if (activeFilter === 'src_NON_GPO' && drug.source !== 'ไม่ใช่ GPO') return false;
      if (activeFilter === 'src_PTL' && drug.source !== 'รพ.พัทลุง') return false;

      // กรองคลังย่อยจาก dropdown
      if (subWarehouseFilter !== 'all' && drug.subWarehouse !== subWarehouseFilter) {
        return false;
      }

      // กรองแหล่งที่มาจาก dropdown
      if (sourceFilter !== 'all' && drug.source !== sourceFilter) {
        return false;
      }

      return true;
    });
  }, [drugs, searchQuery, activeFilter, subWarehouseFilter, sourceFilter]);

  // เรียงลำดับ
  const sortedDrugs = useMemo(() => {
    return [...filteredDrugs].sort((a, b) => {
      const statusA = getDrugStatus(a);
      const statusB = getDrugStatus(b);

      let valA: any = a[sortField as keyof DrugItem];
      let valB: any = b[sortField as keyof DrugItem];

      if (sortField === 'daysLeft') {
        valA = statusA.daysLeft;
        valB = statusB.daysLeft;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredDrugs, sortField, sortAsc]);

  const toggleSort = (field: 'name' | 'expiryDate' | 'quantity' | 'daysLeft') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const copyForGoogleSheet = () => {
    const headers = [
      'รหัสยา',
      'ชื่อยา',
      'Shelf',
      'Lot No.',
      'บริษัทผู้ผลิต/จัดจำหน่าย',
      'แหล่งที่มา',
      'คลังย่อย',
      'วันหมดอายุ',
      'สถานะยา',
      'จำนวนคงเหลือ',
      'หน่วยนับ',
      'หน่วยบรรจุ',
      'Min',
      'Max',
      'สถานะสต็อก',
      'วันที่รับเข้า',
      'สถานะ (ปลอดภัย/ใกล้หมดอายุ/หมดอายุ/สต็อกถึงเกณฑ์ min)',
    ];

    const lines = [headers.join('\t')];
    drugs.forEach((d) => {
      const st = getDrugStatus(d);
      const simpleSt = getSimpleDrugStatus(d);
      let statusText = 'ปกติ';
      if (st.expiryStatus === 'expired') {
        statusText = `หมดอายุแล้ว (เลยมา ${Math.abs(st.daysLeft)} วัน)`;
      } else if (st.expiryStatus === 'near_expiry') {
        statusText = `ใกล้หมดอายุ (เหลือ ${st.daysLeft} วัน)`;
      } else if (st.stockStatus === 'low') {
        statusText = `สต็อกต่ำกว่า Min (${d.quantity}/${d.min})`;
      } else {
        statusText = `ปกติ (เหลือ ${st.daysLeft} วัน)`;
      }

      let stockText = d.quantity <= d.min ? `ถึงเกณฑ์ Min (เหลือ ${d.quantity}/${d.min})` : 'ปกติ';

      lines.push([
        d.id,
        d.name,
        d.shelf,
        d.lot,
        d.company,
        d.source,
        d.subWarehouse,
        d.expiryDate,
        statusText,
        d.quantity,
        d.unit,
        d.packageUnit || '-',
        d.min,
        d.max,
        stockText,
        d.receivedDate,
        simpleSt.text,
      ].join('\t'));
    });

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedSheetNotice(true);
    setTimeout(() => setCopiedSheetNotice(false), 3000);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      
      {/* Header & Toolbars */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50 space-y-4">
        
        {/* Title & Primary Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold font-['Prompt'] text-slate-800 flex items-center gap-2">
              <span>ทะเบียนรายการคลังยานอก รพ.เขาชัยสน</span>
              <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                {sortedDrugs.length} รายการ
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              แสดงสถานะยา: หมดอายุ, ใกล้หมดอายุ (≤ 70 วัน) และสต็อกต่ำกว่า Min พร้อมส่งออกลง Google Sheet
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={onAddDrug}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มรายการยา</span>
            </button>

            <button
              onClick={onOpenImportModal}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium shadow-sm transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>นำเข้า Excel / PDF</span>
            </button>

            {/* Copy for Google Sheet Button */}
            <button
              onClick={copyForGoogleSheet}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition cursor-pointer"
              title="คัดลอกตารางพร้อมสถานะยา เพื่อนำไปกดวาง (Ctrl+V) ใน Google Sheet ทันที"
            >
              {copiedSheetNotice ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>คัดลอกพร้อมวางใน Sheet แล้ว!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-emerald-700" />
                  <span>คัดลอกลง Sheet (พร้อมสถานะ)</span>
                </>
              )}
            </button>

            <button
              onClick={onExportExcel}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium shadow-sm transition cursor-pointer"
              title="ส่งออกรายการยาเป็น Excel พร้อมคอลัมน์สถานะยา"
            >
              <Download className="w-4 h-4 text-teal-700" />
              <span className="hidden sm:inline">ส่งออก Excel</span>
            </button>

            <button
              onClick={onDownloadTemplate}
              className="inline-flex items-center space-x-1 px-2.5 py-2 text-slate-500 hover:text-slate-800 text-xs rounded-xl hover:bg-slate-200/60 transition cursor-pointer"
              title="ดาวน์โหลดแบบฟอร์ม Template Excel"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden md:inline">Template</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อยา, Lot, Shelf, บริษัท..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sub-Warehouse Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-xs text-slate-500 whitespace-nowrap hidden sm:inline">คลัง:</span>
            <select
              value={subWarehouseFilter}
              onChange={(e) => setSubWarehouseFilter(e.target.value)}
              className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-sm text-slate-700"
            >
              <option value="all">คลังย่อยทั้งหมด (All Sub-Warehouses)</option>
              <option value="OPD">คลังย่อย OPD (ผู้ป่วยนอก)</option>
              <option value="IPD">คลังย่อย IPD (ผู้ป่วยใน)</option>
              <option value="ER">คลังย่อย ER (อุบัติเหตุฉุกเฉิน)</option>
              <option value="คลังใหญ่ (Main)">คลังใหญ่ (Main)</option>
            </select>
          </div>

          {/* Source Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-xs text-slate-500 whitespace-nowrap hidden sm:inline">แหล่ง:</span>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-sm text-slate-700"
            >
              <option value="all">แหล่งที่มาทั้งหมด (All Sources)</option>
              <option value="GPO">องค์การเภสัชกรรม (GPO)</option>
              <option value="ไม่ใช่ GPO">ไม่ใช่ GPO (Non-GPO)</option>
              <option value="รพ.พัทลุง">โรงพยาบาลพัทลุง</option>
              <option value="อื่นๆ">อื่นๆ</option>
            </select>
          </div>

          {/* Status Quick Filter */}
          <div className="flex items-center space-x-1.5">
            <select
              value={activeFilter}
              onChange={(e) => onFilterChange(e.target.value)}
              className="w-full py-2 px-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-sm text-emerald-950 font-medium"
            >
              <option value="all">สถานะทั้งหมด</option>
              <option value="near_expiry">⏳ ใกล้หมดอายุ (≤ 70 วัน)</option>
              <option value="expired">🚨 ยาหมดอายุแล้ว</option>
              <option value="low_stock">📉 สต็อกต่ำกว่า Min</option>
            </select>
          </div>

        </div>

        {/* Active Filter Notice */}
        {activeFilter !== 'all' && (
          <div className="flex items-center justify-between bg-emerald-100/70 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs text-emerald-900">
            <span>
              กำลังกรอง: <strong className="font-semibold">{activeFilter}</strong> ({sortedDrugs.length} รายการ)
            </span>
            <button
              onClick={() => onFilterChange('all')}
              className="text-emerald-700 hover:text-emerald-950 underline font-medium"
            >
              ล้างตัวกรอง
            </button>
          </div>
        )}

      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px] sm:text-xs tracking-wider border-b border-slate-200">
            <tr>
              <th className="py-3 px-3.5 sm:px-4 cursor-pointer hover:bg-slate-200/60 transition" onClick={() => toggleSort('name')}>
                <div className="flex items-center space-x-1">
                  <span>ชื่อยา / รายละเอียด</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-3 sm:px-3">Shelf</th>
              <th className="py-3 px-3 sm:px-3">Lot No.</th>
              <th className="py-3 px-3 sm:px-3">คลังย่อย</th>
              <th className="py-3 px-3 sm:px-3">แหล่งที่มา</th>
              <th className="py-3 px-3 sm:px-3 cursor-pointer hover:bg-slate-200/60 transition" onClick={() => toggleSort('quantity')}>
                <div className="flex items-center space-x-1">
                  <span>คงเหลือ / Min-Max</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-3 sm:px-3 font-semibold text-emerald-950">หน่วยบรรจุ</th>
              <th className="py-3 px-3.5 sm:px-4 cursor-pointer hover:bg-slate-200/60 transition" onClick={() => toggleSort('daysLeft')}>
                <div className="flex items-center space-x-1">
                  <span>วันหมดอายุ</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-3.5 sm:px-4 text-center font-bold">สถานะ</th>
              <th className="py-3 px-3.5 sm:px-4 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedDrugs.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <HelpCircle className="w-8 h-8 text-slate-400" />
                    <p className="text-sm font-medium">ไม่พบรายการยาที่ตรงกับเงื่อนไขการค้นหา</p>
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSubWarehouseFilter('all');
                        setSourceFilter('all');
                        onFilterChange('all');
                      }}
                      className="text-xs text-emerald-700 hover:underline"
                    >
                      ล้างตัวกรองทั้งหมด
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              sortedDrugs.map((drug) => {
                const status = getDrugStatus(drug);
                const simpleStatus = getSimpleDrugStatus(drug);
                const daysBadge = getDaysLeftBadge(status.daysLeft);
                const isLow = status.stockStatus === 'low';

                // Source badge color
                let sourceBadgeClass = 'bg-teal-50 text-teal-800 border-teal-200';
                if (drug.source === 'ไม่ใช่ GPO') {
                  sourceBadgeClass = 'bg-indigo-50 text-indigo-800 border-indigo-200';
                } else if (drug.source === 'รพ.พัทลุง') {
                  sourceBadgeClass = 'bg-cyan-50 text-cyan-800 border-cyan-200';
                }

                // Sub-warehouse badge color
                let subBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                if (drug.subWarehouse === 'IPD') {
                  subBadgeClass = 'bg-blue-50 text-blue-800 border-blue-200';
                } else if (drug.subWarehouse === 'ER') {
                  subBadgeClass = 'bg-rose-50 text-rose-800 border-rose-200 font-semibold';
                }

                return (
                  <tr 
                    key={drug.id} 
                    className={`hover:bg-slate-50/80 transition ${daysBadge.borderClass}`}
                  >
                    {/* Drug Name & Info */}
                    <td className="py-3 px-3.5 sm:px-4">
                      <div>
                        <div className="font-semibold text-slate-900 text-xs sm:text-sm font-['Prompt']">
                          {drug.name}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            {drug.id}
                          </span>
                          <span>• {drug.company}</span>
                        </div>
                      </div>
                    </td>

                    {/* Shelf */}
                    <td className="py-3 px-3 sm:px-3 whitespace-nowrap">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                        {drug.shelf}
                      </span>
                    </td>

                    {/* Lot */}
                    <td className="py-3 px-3 sm:px-3 whitespace-nowrap">
                      <span className="font-mono text-xs px-2 py-0.5 bg-slate-50 text-slate-700 rounded border border-slate-200">
                        {drug.lot}
                      </span>
                    </td>

                    {/* Sub Warehouse */}
                    <td className="py-3 px-3 sm:px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${subBadgeClass}`}>
                        {drug.subWarehouse}
                      </span>
                    </td>

                    {/* Source */}
                    <td className="py-3 px-3 sm:px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${sourceBadgeClass}`}>
                        {drug.source}
                      </span>
                    </td>

                    {/* Quantity & Min/Max */}
                    <td className="py-3 px-3 sm:px-3 whitespace-nowrap">
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className={`font-bold text-sm ${isLow ? 'text-orange-600' : 'text-slate-800'}`}>
                            {drug.quantity.toLocaleString()}
                          </span>
                          <span className="text-xs text-slate-500">{drug.unit}</span>
                          {isLow && (
                            <span className="inline-flex items-center px-1.5 py-0.2 text-[10px] font-bold bg-orange-100 text-orange-800 rounded border border-orange-200">
                              ≤ Min
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center space-x-1 mt-0.5">
                          <span>Min: {drug.min}</span>
                          <span>|</span>
                          <span>Max: {drug.max}</span>
                        </div>
                      </div>
                    </td>

                    {/* หน่วยบรรจุ (Package Unit) */}
                    <td className="py-3 px-3 sm:px-3 whitespace-nowrap">
                      {drug.packageUnit ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-2xs">
                          {drug.packageUnit}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>

                    {/* Expiry Date */}
                    <td className="py-3 px-3.5 sm:px-4 whitespace-nowrap">
                      <div className="text-xs font-semibold text-slate-800">
                        {formatThaiDate(drug.expiryDate)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {drug.expiryDate}
                      </div>
                    </td>

                    {/* สถานะ (ปลอดภัย / ใกล้หมดอายุ / หมดอายุ / สต็อกถึงเกณฑ์ min) */}
                    <td className="py-3 px-3.5 sm:px-4 whitespace-nowrap text-center">
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {simpleStatus.badges.map((badge, bIdx) => (
                          <span
                            key={bIdx}
                            className={`inline-block px-2.5 py-1 text-xs rounded-lg font-bold shadow-2xs ${badge.badgeClass}`}
                          >
                            {badge.text}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3.5 sm:px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center space-x-1">
                        
                        {/* ตัดยอด Button */}
                        <button
                          onClick={() => onDispenseDrug(drug)}
                          className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-medium shadow-sm transition active:scale-95 flex items-center space-x-1"
                          title="ตัดยอดจ่ายยา / เบิกจ่าย"
                        >
                          <MinusCircle className="w-3.5 h-3.5" />
                          <span>ตัดยอด</span>
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => onEditDrug(drug)}
                          className="p-1.5 text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition"
                          title="แก้ไขข้อมูลยา"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => onDeleteDrug(drug)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="ลบรายการยา"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Summary */}
      <div className="p-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div>
          แสดง {sortedDrugs.length} จากทั้งหมด {drugs.length} รายการยา
        </div>
        <div className="flex items-center space-x-3 text-[11px]">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> ปลอดภัย
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> ใกล้หมดอายุ (≤ 70 วัน)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block"></span> หมดอายุ
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span> สต็อกถึงเกณฑ์ min
          </span>
        </div>
      </div>

    </div>
  );
};
