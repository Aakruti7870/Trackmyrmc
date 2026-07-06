import React, { useState } from "react";
import { Truck, ArrowRight, CheckCircle2 } from "lucide-react";

export function MinimalWhite() {
  const [phoneNumber, setPhoneNumber] = useState("");

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#f9fafb] p-4 font-sans">
      {/* Mobile container - 390x844 aspect ratio wrapper */}
      <div className="relative w-full max-w-[390px] h-[844px] max-h-[100dvh] bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col items-center px-8 py-16">
        
        {/* Top spacer for extreme whitespace */}
        <div className="flex-1" />

        {/* Branding */}
        <div className="flex flex-col items-center justify-center space-y-4 w-full">
          <div className="flex items-center justify-center gap-1.5">
            <Truck className="w-5 h-5 text-teal-600" strokeWidth={2.5} />
            <span className="text-xl font-medium tracking-tight text-gray-900">
              TrackMy<span className="text-teal-600 font-semibold">RMC</span>
            </span>
          </div>
          <p className="text-[13px] text-gray-400 font-medium tracking-wide uppercase">
            Ready Mix Concrete, On Time
          </p>
        </div>

        <div className="h-16" /> {/* Generous spacer */}

        {/* Input Area */}
        <div className="w-full max-w-[280px] space-y-6">
          <div className="relative group">
            <div className="absolute left-0 top-0 bottom-0 flex items-center pl-4 pointer-events-none">
              <span className="text-gray-900 font-medium text-lg">+91</span>
            </div>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="98765 43210"
              className="w-full h-14 pl-14 pr-4 bg-gray-50/50 border border-gray-100 rounded-2xl text-lg font-medium text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500/30 transition-all"
              maxLength={10}
            />
          </div>

          <button className="w-full h-14 bg-gray-900 hover:bg-black text-white rounded-2xl font-medium text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
            Get OTP
            <ArrowRight className="w-4 h-4 opacity-50" />
          </button>
        </div>

        {/* Bottom spacer */}
        <div className="flex-1" />

        {/* Trust cues & Legal */}
        <div className="w-full flex flex-col items-center space-y-8 mt-auto">
          <div className="flex items-center gap-2 text-gray-400 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-500/70" />
            <span>Trusted by 500+ Indian construction sites</span>
          </div>

          <button className="text-[13px] font-medium text-gray-400 hover:text-gray-600 transition-colors">
            Staff login
          </button>

          <p className="text-[11px] text-gray-300 text-center max-w-[240px] leading-relaxed">
            By continuing you agree to our{" "}
            <a href="#" className="underline decoration-gray-200 underline-offset-2">Terms</a>{" "}
            &{" "}
            <a href="#" className="underline decoration-gray-200 underline-offset-2">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
