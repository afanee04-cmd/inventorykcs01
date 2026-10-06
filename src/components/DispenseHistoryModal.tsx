import React, { useState } from 'react';
import { X, History, Search, Download, Trash2, Calendar, User, Building, FileSpreadsheet } from 'lucide-react';
import { DispenseRecord } from '../types/inventory';
import { formatThaiDate } from '../utils/drugUtils';
import * as XLSX from 'xlsx';

interface DispenseHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: DispenseRecord[];
  onClearHistory?: () => void;
}

export const DispenseHistoryModal: React.FC<DispenseHistoryModalProps> = ({
  isOpen,
  onClose,
  records,
  onClearHistory,
}) => {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filteredRecords = records.filter((rec) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      rec.drugName.toLowerCase().includes(q) ||
      rec.lot.toLowerCase().includes(q) ||
      rec.toDepartment.toLowerCase().includes(q) ||
      rec.requestedBy.toLowerCase().includes(q) ||
      rec.reason.toLowerCase().includes(q)
    );
  });

  const exportHistoryExcel = () => {
    const headers = [
      'รหัสตัดยอด',
      'รหัสยา',
      'ชื่อยา',
      'Lot No.',
      'จำนวนตัดยอด',
      'หน่วย',
      'คลังต้นทาง',
      'แผนกปลายทาง',
      'ผู้ตัดยอด',
      'เหตุผล',
      'ยอดคงเหลือหลังตัด',
      'วันเวลาที่ตัดยอด',
    ];

    const rows = records.map((r) => [
      r.id,
      r.drugId,
      r.drugName,
      r.lot,
      r.amount,
      r.unit,
      r.fromWarehouse,
      r.toDepartment,
      r.requestedBy,
      r.reason,
      r.remainingAfter,
      r.dispensedAt,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ประวัติตัดยอดคลังยา');
    XLSX.writeFile(wb, `ประวัติตัดยอดคลังยา_รพ_เขาชัยสน_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-800 rounded-lg text-emerald-300">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-['Prompt'] font-bold text-base sm:text-lg">
                ประวัติการตัดยอดคลังยานอก รพ.เขาชัยสน
              </h3>
              <p className="text-xs text-emerald-200/80">
                บันทึกการเบิกจ่ายยาสู่ OPD, IPD, ER และแผนกต่างๆ
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

        {/* Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาตามชื่อยา, Lot, แผนก, ผู้เบิก..."
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={exportHistoryExcel}
              disabled={records.length === 0}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 shadow-xs transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>ส่งออก Excel</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {filteredRecords.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold">ยังไม่มีประวัติการตัดยอดคลังยา</p>
              <p className="text-xs text-slate-400 mt-1">
                เมื่อท่านกด "ตัดยอด" ในรายการยา ระบบจะบันทึกประวัติการเบิกจ่ายไว้ที่นี่อัตโนมัติ
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px]">
                  <tr>
                    <th className="p-3">วันเวลา</th>
                    <th className="p-3">รายการยา & Lot</th>
                    <th className="p-3 text-right">จำนวนตัดยอด</th>
                    <th className="p-3">คลังต้นทาง</th>
                    <th className="p-3">แผนกปลายทาง</th>
                    <th className="p-3">ผู้เบิก/ตัดยอด</th>
                    <th className="p-3">เหตุผล</th>
                    <th className="p-3 text-right">คงเหลือหลังตัด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((rec) => {
                    const d = new Date(rec.dispensedAt);
                    const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} น.`;
                    const dateFormatted = `${formatThaiDate(rec.dispensedAt)} ${timeStr}`;

                    return (
                      <tr key={rec.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 text-slate-500 whitespace-nowrap">
                          {dateFormatted}
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-slate-900 block font-['Prompt']">
                            {rec.drugName}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            Lot: {rec.lot}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold text-rose-700 whitespace-nowrap">
                          -{rec.amount.toLocaleString()} {rec.unit}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[11px] font-medium border border-emerald-200">
                            {rec.fromWarehouse}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-slate-800">
                          {rec.toDepartment}
                        </td>
                        <td className="p-3 text-slate-600">
                          {rec.requestedBy}
                        </td>
                        <td className="p-3 text-slate-500 max-w-xs truncate">
                          {rec.reason || '-'}
                        </td>
                        <td className="p-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                          {rec.remainingAfter.toLocaleString()} {rec.unit}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>รวมทั้งหมด {filteredRecords.length} รายการตัดยอด</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            ปิด
          </button>
        </div>

      </div>
    </div>
  );
};
