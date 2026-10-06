import React, { useState } from 'react';
import { X, MinusCircle, AlertCircle, CheckCircle2, User, Building, FileText } from 'lucide-react';
import { DrugItem, DispenseRecord } from '../types/inventory';
import { formatThaiDate } from '../utils/drugUtils';

interface DispenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  drug: DrugItem | null;
  onConfirmDispense: (record: DispenseRecord) => void;
}

export const DispenseModal: React.FC<DispenseModalProps> = ({
  isOpen,
  onClose,
  drug,
  onConfirmDispense,
}) => {
  if (!isOpen || !drug) return null;

  const [amount, setAmount] = useState<number>(10);
  const [toDepartment, setToDepartment] = useState<string>('แผนกผู้ป่วยนอก (OPD)');
  const [requestedBy, setRequestedBy] = useState<string>('');
  const [reason, setReason] = useState<string>('เบิกจ่ายตามใบสั่งยาประจำวัน');
  const [error, setError] = useState<string>('');

  const currentQty = Number(drug.quantity || 0);
  const remainingAfter = currentQty - (Number(amount) || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      setError('กรุณาระบุจำนวนที่ต้องการตัดยอดให้ถูกต้อง (> 0)');
      return;
    }
    if (amount > currentQty) {
      setError(`จำนวนตัดยอดเกินกว่าสต็อกคงเหลือ (${currentQty.toLocaleString()} ${drug.unit})`);
      return;
    }
    if (!requestedBy.trim()) {
      setError('กรุณาระบุชื่อผู้เบิก / เภสัชกร / เจ้าหน้าที่');
      return;
    }

    const record: DispenseRecord = {
      id: `DISP-${Date.now().toString().slice(-6)}`,
      drugId: drug.id,
      drugName: drug.name,
      lot: drug.lot,
      amount: Number(amount),
      unit: drug.unit,
      fromWarehouse: drug.subWarehouse,
      toDepartment: toDepartment.trim(),
      requestedBy: requestedBy.trim(),
      dispensedAt: new Date().toISOString(),
      reason: reason.trim(),
      remainingAfter: remainingAfter,
    };

    onConfirmDispense(record);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-800 rounded-lg text-emerald-300">
              <MinusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-['Prompt'] font-bold text-base sm:text-lg">
                ตัดยอดคลังยานอก รพ.เขาชัยสน
              </h3>
              <p className="text-xs text-emerald-200/80">บันทึกการเบิกจ่ายและหักยอดสต็อก</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-emerald-300 hover:text-white hover:bg-emerald-800/80 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drug Summary Card */}
        <div className="bg-slate-50 border-b border-slate-200 p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-bold text-slate-800 font-['Prompt'] text-sm">
                {drug.name}
              </div>
              <div className="text-xs text-slate-500 mt-0.5 space-x-2">
                <span>Lot: <strong>{drug.lot}</strong></span>
                <span>• Shelf: <strong>{drug.shelf}</strong></span>
                <span>• คลัง: <strong>{drug.subWarehouse}</strong></span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                วันหมดอายุ: {formatThaiDate(drug.expiryDate)}
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">คงเหลือปัจจุบัน</span>
              <span className="text-xl font-bold text-emerald-800 font-['Prompt']">
                {currentQty.toLocaleString()}
              </span>
              <span className="text-xs text-slate-600 ml-1">{drug.unit}</span>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Amount to Dispense */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              จำนวนที่ต้องการตัดยอด ({drug.unit}) <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="1"
                max={currentQty}
                value={amount || ''}
                onChange={(e) => {
                  setError('');
                  setAmount(Math.max(0, Number(e.target.value)));
                }}
                className="w-full px-3.5 py-2.5 text-base font-bold text-slate-800 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                placeholder="ระบุจำนวน"
              />
              <span className="text-xs font-semibold text-slate-600 px-3 py-2.5 bg-slate-100 rounded-xl border border-slate-200">
                {drug.unit}
              </span>
            </div>

            {/* Quick Amount Buttons */}
            <div className="flex items-center space-x-1.5 mt-2">
              {[10, 50, 100, 500].map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => setAmount(Math.min(currentQty, quick))}
                  className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                >
                  +{quick}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAmount(currentQty)}
                className="px-2.5 py-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg transition"
              >
                ตัดทั้งหมด ({currentQty})
              </button>
            </div>
          </div>

          {/* Destination Department */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              <span>แผนก / จุดบริการที่เบิกไปใช้งาน</span>
              <span className="text-rose-500">*</span>
            </label>
            <select
              value={toDepartment}
              onChange={(e) => setToDepartment(e.target.value)}
              className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
            >
              <option value="แผนกผู้ป่วยนอก (OPD)">แผนกผู้ป่วยนอก (OPD)</option>
              <option value="แผนกผู้ป่วยใน (IPD)">แผนกผู้ป่วยใน (IPD)</option>
              <option value="ห้องฉุกเฉินและอุบัติเหตุ (ER)">ห้องฉุกเฉินและอุบัติเหตุ (ER)</option>
              <option value="ห้องคลอดและทารกแรกเกิด">ห้องคลอดและทารกแรกเกิด</option>
              <option value="แผนกทันตกรรม">แผนกทันตกรรม</option>
              <option value="กลุ่มงานบริการปฐมภูมิ / รพ.สต. เครือข่าย">กลุ่มงานบริการปฐมภูมิ / รพ.สต. เครือข่าย</option>
              <option value="ตึกผู้ป่วยพิเศษ">ตึกผู้ป่วยพิเศษ</option>
              <option value="ส่งคืน/ทำลายยาหมดอายุ">ส่งคืน/ทำลายยาหมดอายุ</option>
            </select>
          </div>

          {/* Requested By */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>ชื่อผู้เบิก / เภสัชกร / เจ้าหน้าที่ผู้ตัดยอด</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={requestedBy}
              onChange={(e) => setRequestedBy(e.target.value)}
              placeholder="เช่น ภญ.สมพร (เภสัชกรชำนาญการ)"
              className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {/* Reason / Reference */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>เหตุผลการตัดยอด / เลขที่ใบสั่งยา</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น จ่ายยาผู้ป่วย OPD, เติมสต็อกรถเข็นฉุกเฉิน ER"
              className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {/* Remaining Balance Summary Preview */}
          <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
            <span className="text-emerald-900 font-medium">ยอดคงเหลือหลังการตัดยอด:</span>
            <span className={`text-base font-bold ${remainingAfter <= drug.min ? 'text-orange-700' : 'text-emerald-800'}`}>
              {remainingAfter.toLocaleString()} {drug.unit}
              {remainingAfter <= drug.min && (
                <span className="text-[10px] ml-1 text-orange-600 font-semibold">(จะถึงเกณฑ์ Min)</span>
              )}
            </span>
          </div>

          {/* Form Actions */}
          <div className="pt-2 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="inline-flex items-center space-x-1.5 px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition active:scale-95"
            >
              <MinusCircle className="w-4 h-4" />
              <span>ยืนยันการตัดยอด</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
