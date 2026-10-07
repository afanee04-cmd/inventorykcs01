import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Calendar, Package, Layers, MapPin } from 'lucide-react';
import { DrugItem, SourceType, SubWarehouse } from '../types/inventory';

interface DrugModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (drug: DrugItem) => void;
  drugToEdit: DrugItem | null;
}

export const DrugModal: React.FC<DrugModalProps> = ({
  isOpen,
  onClose,
  onSave,
  drugToEdit,
}) => {
  const [formData, setFormData] = useState<Partial<DrugItem>>({
    name: '',
    shelf: '',
    lot: '',
    company: '',
    source: 'GPO',
    subWarehouse: 'OPD',
    expiryDate: '',
    quantity: 100,
    unit: 'เม็ด',
    packageUnit: '10x10 เม็ด/กล่อง',
    min: 50,
    max: 1000,
    receivedDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (drugToEdit) {
      setFormData({ ...drugToEdit });
    } else {
      setFormData({
        id: `KCS-${Date.now().toString().slice(-5)}`,
        name: '',
        shelf: '',
        lot: '',
        company: 'องค์การเภสัชกรรม (GPO)',
        source: 'GPO',
        subWarehouse: 'OPD',
        expiryDate: '',
        quantity: 100,
        unit: 'เม็ด',
        packageUnit: '10x10 เม็ด/กล่อง',
        min: 50,
        max: 1000,
        receivedDate: new Date().toISOString().split('T')[0],
        notes: '',
      });
    }
    setErrors({});
  }, [drugToEdit, isOpen]);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name?.trim()) newErrors.name = 'กรุณาระบุชื่อยา';
    if (!formData.shelf?.trim()) newErrors.shelf = 'กรุณาระบุตำแหน่ง Shelf';
    if (!formData.lot?.trim()) newErrors.lot = 'กรุณาระบุ Lot No.';
    if (!formData.company?.trim()) newErrors.company = 'กรุณาระบุบริษัท';
    if (!formData.expiryDate) newErrors.expiryDate = 'กรุณาระบุวันหมดอายุ';
    if (Number(formData.quantity) < 0 || isNaN(Number(formData.quantity))) {
      newErrors.quantity = 'จำนวนต้องไม่ติดลบ';
    }
    if (Number(formData.min) < 0 || isNaN(Number(formData.min))) {
      newErrors.min = 'Min ต้องไม่ติดลบ';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const drugToSave: DrugItem = {
      id: formData.id || `KCS-${Date.now().toString().slice(-5)}`,
      name: formData.name!.trim(),
      shelf: formData.shelf!.trim(),
      lot: formData.lot!.trim(),
      company: formData.company!.trim(),
      source: (formData.source as SourceType) || 'GPO',
      subWarehouse: (formData.subWarehouse as SubWarehouse) || 'OPD',
      expiryDate: formData.expiryDate!,
      quantity: Number(formData.quantity || 0),
      unit: formData.unit?.trim() || 'หน่วย',
      packageUnit: formData.packageUnit?.trim() || '',
      min: Number(formData.min || 0),
      max: Number(formData.max || 0),
      receivedDate: formData.receivedDate || new Date().toISOString().split('T')[0],
      notes: formData.notes?.trim() || '',
      updatedAt: new Date().toISOString(),
    };

    onSave(drugToSave);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-800 rounded-lg text-emerald-300">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-['Prompt'] font-bold text-base sm:text-lg">
                {drugToEdit ? 'แก้ไขข้อมูลยาคลังนอก' : 'เพิ่มรายการยาใหม่เข้าคลัง'}
              </h3>
              <p className="text-xs text-emerald-200/80">โรงพยาบาลเขาชัยสน จ.พัทลุง</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-emerald-300 hover:text-white hover:bg-emerald-800/80 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          
          {/* Row 1: ชื่อยา (Drug Name) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ชื่อยา / ขนาดความแรง <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="เช่น Paracetamol 500 mg Tablet, Amoxicillin 500 mg Cap"
              className={`w-full px-3.5 py-2 text-xs sm:text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                errors.name ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
              }`}
            />
            {errors.name && <p className="text-[11px] text-rose-500 mt-1">{errors.name}</p>}
          </div>

          {/* Row 2: Shelf & Lot */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>ตำแหน่ง Shelf (ชั้นวาง/ตู้ยา)</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.shelf || ''}
                onChange={(e) => setFormData({ ...formData, shelf: e.target.value })}
                placeholder="เช่น A1-02, ตู้เย็นช่อง 2, D-05"
                className={`w-full px-3.5 py-2 text-xs sm:text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                  errors.shelf ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                }`}
              />
              {errors.shelf && <p className="text-[11px] text-rose-500 mt-1">{errors.shelf}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                หมายเลข Lot / Batch <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.lot || ''}
                onChange={(e) => setFormData({ ...formData, lot: e.target.value })}
                placeholder="เช่น GPO67012, LOT-26B"
                className={`w-full px-3.5 py-2 text-xs sm:text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                  errors.lot ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                }`}
              />
              {errors.lot && <p className="text-[11px] text-rose-500 mt-1">{errors.lot}</p>}
            </div>
          </div>

          {/* Row 3: บริษัท (Company) & แหล่งที่มา (Source) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                บริษัทผู้จัดจำหน่าย / ผู้ผลิต <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.company || ''}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="เช่น องค์การเภสัชกรรม (GPO), บ. เบอร์ลินฟาร์มาฯ"
                className={`w-full px-3.5 py-2 text-xs sm:text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                  errors.company ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                }`}
              />
              {errors.company && <p className="text-[11px] text-rose-500 mt-1">{errors.company}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>แหล่งที่มา (Source)</span>
                <span className="text-[10px] text-slate-400">GPO / ไม่ใช่ GPO / รพ.พัทลุง</span>
              </label>
              <select
                value={formData.source || 'GPO'}
                onChange={(e) => {
                  const val = e.target.value as SourceType;
                  setFormData({
                    ...formData,
                    source: val,
                    company: val === 'GPO' ? 'องค์การเภสัชกรรม (GPO)' : (val === 'รพ.พัทลุง' ? 'โรงพยาบาลพัทลุง' : formData.company),
                  });
                }}
                className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              >
                <option value="GPO">องค์การเภสัชกรรม (GPO)</option>
                <option value="ไม่ใช่ GPO">ไม่ใช่ GPO (Non-GPO)</option>
                <option value="รพ.พัทลุง">โรงพยาบาลพัทลุง (คลังยาใหญ่)</option>
                <option value="อื่นๆ">อื่นๆ</option>
              </select>
            </div>
          </div>

          {/* Row 4: คลังย่อย (Sub-warehouse: OPD, IPD, ER) */}
          <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
            <label className="block text-xs font-bold text-emerald-950 mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-800" />
              <span>คลังย่อยประจำจุดบริการ (Sub-warehouse)</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['OPD', 'IPD', 'ER', 'คลังใหญ่ (Main)'] as SubWarehouse[]).map((sub) => (
                <label
                  key={sub}
                  className={`flex items-center justify-center p-2.5 rounded-xl border cursor-pointer text-xs font-semibold transition ${
                    formData.subWarehouse === sub
                      ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-emerald-100/60 border-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="subWarehouse"
                    value={sub}
                    checked={formData.subWarehouse === sub}
                    onChange={(e) => setFormData({ ...formData, subWarehouse: e.target.value as SubWarehouse })}
                    className="sr-only"
                  />
                  <span>{sub}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Row 5: วันหมดอายุ & วันที่รับเข้า */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>วันหมดอายุ (Expiry Date)</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={formData.expiryDate || ''}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                className={`w-full px-3.5 py-2 text-xs sm:text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                  errors.expiryDate ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                }`}
              />
              <p className="text-[10px] text-amber-700 mt-1">
                * ระบบจะแจ้งเตือนอัตโนมัติเมื่อเหลือ ≤ 70 วัน
              </p>
              {errors.expiryDate && <p className="text-[11px] text-rose-500 mt-1">{errors.expiryDate}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                วันที่รับเข้าคลัง (Received Date)
              </label>
              <input
                type="date"
                value={formData.receivedDate || ''}
                onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
                className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Row 6: จำนวนคงเหลือ, หน่วยนับย่อย & หน่วยบรรจุ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                จำนวนคงเหลือปัจจุบัน <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                value={formData.quantity ?? ''}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                className={`w-full px-3.5 py-2 text-xs sm:text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 font-semibold ${
                  errors.quantity ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                }`}
              />
              {errors.quantity && <p className="text-[11px] text-rose-500 mt-1">{errors.quantity}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                หน่วยนับย่อย (Unit)
              </label>
              <input
                type="text"
                value={formData.unit || ''}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="เม็ด, แคปซูล, Vial, ขวด, หลอด"
                className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>หน่วยบรรจุ (Package Unit)</span>
                <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1 rounded">บรรจุ</span>
              </label>
              <input
                type="text"
                value={formData.packageUnit || ''}
                onChange={(e) => setFormData({ ...formData, packageUnit: e.target.value })}
                placeholder="เช่น 10x10 เม็ด/กล่อง, 50 แอมพูล/กล่อง, 500 เม็ด/ขวด"
                className="w-full px-3.5 py-2 text-xs sm:text-sm border border-emerald-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-emerald-50/30"
              />
            </div>
          </div>

          {/* Row 7: Min & Max */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-orange-900 mb-1">
                จุดสั่งซื้อขั้นต่ำ (Min Stock) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                value={formData.min ?? ''}
                onChange={(e) => setFormData({ ...formData, min: Number(e.target.value) })}
                className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              />
              <p className="text-[10px] text-slate-500 mt-1">เตือนเมื่อคงเหลือ ≤ Min</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ปริมาณสูงสุด (Max Stock)
              </label>
              <input
                type="number"
                min="0"
                value={formData.max ?? ''}
                onChange={(e) => setFormData({ ...formData, max: Number(e.target.value) })}
                className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              />
              <p className="text-[10px] text-slate-500 mt-1">สำหรับคำนวณอัตราเติมสต็อก</p>
            </div>
          </div>

          {/* Row 8: หมายเหตุ (Notes) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              หมายเหตุ / การใช้งานเฉพาะ
            </label>
            <textarea
              rows={2}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="ระบุเงื่อนไขพิเศษ เช่น เก็บในตู้เย็น 2-8°C, ยาควบคุมพิเศษ..."
              className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
            />
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2.5">
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
              <Save className="w-4 h-4" />
              <span>{drugToEdit ? 'บันทึกการแก้ไข' : 'บันทึกเข้าคลัง'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
