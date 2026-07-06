import React, { useState } from "react";
import { Truck, ShieldCheck, Zap, Factory } from "lucide-react";

export function FintechClean() {
  const [phoneNumber, setPhoneNumber] = useState("");

  return (
    <div className="flex flex-col h-full w-full bg-white font-sans text-slate-900 relative overflow-hidden" style={{ width: '390px', height: '844px', margin: '0 auto', boxShadow: '0 0 20px rgba(0,0,0,0.1)' }}>
      {/* Background subtleties */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-teal-50/50 to-transparent pointer-events-none" />

      {/* Main Content */}
      <div className="flex-1 flex flex-col px-6 pt-16 pb-8 z-10">
        {/* Header / Brand */}
        <div className="flex items-center gap-2 mb-12">
          <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
            <Truck size={24} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-slate-900">TrackMy</span>
            <span className="text-teal-600">RMC</span>
          </h1>
        </div>

        {/* Hero Copy */}
        <div className="mb-10">
          <h2 className="text-3xl font-bold mb-3 text-slate-900 leading-tight">
            Ready Mix Concrete.<br />On Time, Every Time.
          </h2>
          <p className="text-slate-500 text-base">
            Enter your mobile number to start ordering and tracking deliveries.
          </p>
        </div>

        {/* Input Area */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Mobile Number
          </label>
          <div className="flex items-center rounded-2xl border-2 border-slate-200 bg-white p-2 focus-within:border-teal-500 focus-within:ring-4 focus-within:ring-teal-500/20 transition-all">
            <div className="flex items-center gap-2 px-3 text-slate-600 border-r-2 border-slate-100 font-medium">
              <span>🇮🇳</span>
              <span>+91</span>
            </div>
            <input
              type="tel"
              className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-lg font-semibold tracking-wide placeholder:text-slate-300 placeholder:font-normal"
              placeholder="98765 43210"
              maxLength={10}
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>

        {/* Primary CTA */}
        <button className="w-full bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-2xl py-4 font-semibold text-lg shadow-[0_8px_20px_-6px_rgba(15,118,110,0.4)] transition-all transform active:scale-[0.98]">
          Get OTP securely
        </button>

        {/* Trust Cues */}
        <div className="mt-12 flex justify-between items-center px-2">
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <div className="bg-slate-50 p-2.5 rounded-full text-teal-600">
              <ShieldCheck size={20} />
            </div>
            <span className="text-xs font-medium">100% Secure</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <div className="bg-slate-50 p-2.5 rounded-full text-teal-600">
              <Zap size={20} />
            </div>
            <span className="text-xs font-medium">Fast OTP</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <div className="bg-slate-50 p-2.5 rounded-full text-teal-600">
              <Factory size={20} />
            </div>
            <span className="text-xs font-medium">Verified Plants</span>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer Area */}
        <div className="flex flex-col items-center gap-4 text-center mt-auto">
          <button className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors">
            Staff login
          </button>
          
          <p className="text-[11px] text-slate-400 max-w-[280px]">
            By continuing you agree to our <a href="#" className="underline decoration-slate-300 underline-offset-2">Terms</a> & <a href="#" className="underline decoration-slate-300 underline-offset-2">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
