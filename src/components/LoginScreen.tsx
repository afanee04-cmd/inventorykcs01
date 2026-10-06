import React, { useState } from 'react';
import { Building2, Lock, User, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (username: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    if (!trimmedUser || !trimmedPass) {
      setError('กรุณากรอกชื่อผู้ใช้งานและรหัสผ่านให้ครบถ้วน');
      return;
    }

    setIsLoading(true);

    // ตรวจสอบเงื่อนไข user: Rxkcs, pass: 1903
    setTimeout(() => {
      if (trimmedUser === 'Rxkcs' && trimmedPass === '1903') {
        onLoginSuccess(trimmedUser);
      } else {
        setError('ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
        setIsLoading(false);
      }
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background ambient medical glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-emerald-900/30 overflow-hidden relative z-10">
        
        {/* Top Header Card */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 px-8 pt-8 pb-7 text-white text-center border-b border-emerald-800/60 relative">
          
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-300 p-0.5 shadow-lg shadow-emerald-950/60 flex items-center justify-center">
            <div className="w-full h-full bg-emerald-950 rounded-[14px] flex items-center justify-center">
              <Building2 className="w-8 h-8 text-emerald-400" />
            </div>
          </div>

          <h2 className="text-xl font-bold font-['Prompt'] tracking-tight">
            ระบบคลังยานอก <span className="text-emerald-400">รพ.เขาชัยสน</span>
          </h2>
          <p className="text-xs text-emerald-200/80 mt-1">
            โรงพยาบาลเขาชัยสน อำเภอเขาชัยสน จังหวัดพัทลุง
          </p>

          <div className="mt-3 inline-flex items-center space-x-1 px-3 py-1 bg-emerald-900/90 rounded-full text-[11px] text-emerald-300 border border-emerald-700/80">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>เข้าสู่ระบบเพื่อความปลอดภัยของข้อมูลคลังยา</span>
          </div>

        </div>

        {/* Login Form Body */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5 bg-white">
          
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center space-x-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Username Input - Empty by default, user enters manually */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center space-x-1.5">
              <User className="w-3.5 h-3.5 text-emerald-700" />
              <span>ชื่อผู้ใช้งาน (Username)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                autoComplete="off"
                value={username}
                onChange={(e) => {
                  setError('');
                  setUsername(e.target.value);
                }}
                placeholder="กรอกชื่อผู้ใช้งาน..."
                className="w-full pl-4 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
              />
            </div>
          </div>

          {/* Password Input - Empty by default */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center space-x-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-700" />
              <span>รหัสผ่าน (Password)</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setError('');
                  setPassword(e.target.value);
                }}
                placeholder="กรอกรหัสผ่าน..."
                className="w-full pl-4 pr-11 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-gradient-to-r from-emerald-800 to-teal-800 hover:from-emerald-900 hover:to-teal-900 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-950/20 transition active:scale-[0.99] flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <span>กำลังตรวจสอบข้อมูล...</span>
            ) : (
              <span>เข้าสู่ระบบคลังยานอก</span>
            )}
          </button>

          {/* Hospital Footer Note */}
          <div className="pt-2 text-center text-[11px] text-slate-400 border-t border-slate-100">
            ระบบบริหารจัดการคลังยานอก • โรงพยาบาลเขาชัยสน
          </div>

        </form>

      </div>
    </div>
  );
};
