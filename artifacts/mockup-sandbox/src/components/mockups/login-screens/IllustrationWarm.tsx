import React, { useState } from "react";
import { Truck, ArrowRight } from "lucide-react";

export function IllustrationWarm() {
  const [phone, setPhone] = useState("");

  return (
    <div className="relative w-full h-[844px] max-w-[390px] mx-auto bg-[#Fdfbf7] overflow-hidden font-sans text-[#1c1917] flex flex-col items-center justify-between">
      {/* Google Font for warm friendly vibe */}
      <style dangerouslySetInlineStyle={{
        __html: `
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap');
          .font-outfit { font-family: 'Outfit', sans-serif; }
        `
      }} />

      <div className="w-full flex-1 flex flex-col font-outfit">
        {/* Header / Brand */}
        <div className="pt-12 px-6 flex items-center justify-center gap-2 z-10">
          <Truck className="w-7 h-7 text-[#0f766e]" />
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-slate-800">TrackMy</span>
            <span className="text-[#0f766e]">RMC</span>
          </h1>
        </div>

        {/* Illustration Area */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 w-full relative z-0 mt-4 mb-4">
          <div className="relative w-full max-w-[320px] aspect-square flex items-center justify-center">
            {/* Soft background shape */}
            <div className="absolute inset-0 bg-[#f0fdfa] rounded-[3rem] transform -rotate-3 scale-95 opacity-70"></div>
            <div className="absolute inset-0 bg-[#fffbeb] rounded-[3rem] transform rotate-3 scale-95 opacity-70"></div>
            <img 
              src="/__mockup/images/warm-concrete-illustration.png" 
              alt="Friendly concrete delivery" 
              className="relative z-10 w-full h-full object-contain drop-shadow-sm mix-blend-multiply"
            />
          </div>
        </div>

        {/* Bottom Card */}
        <div className="bg-white w-full rounded-t-[2.5rem] p-8 shadow-[0_-8px_30px_rgba(15,118,110,0.04)] z-20 flex flex-col relative">
          
          <div className="mb-8">
            <h2 className="text-[28px] font-bold text-[#1c1917] mb-2 leading-tight">
              Ready Mix Concrete,<br/>
              <span className="text-[#0f766e]">On Time, Every Time.</span>
            </h2>
            <p className="text-[#78716c] text-[15px] font-medium">
              Enter your mobile number to get started.
            </p>
          </div>

          <div className="space-y-4 mb-8">
            <div className="relative flex items-center">
              <div className="absolute left-1.5 top-1.5 bottom-1.5 flex items-center justify-center bg-[#f0fdfa] px-3.5 rounded-xl border border-[#ccfbf1]">
                <span className="text-[#0f766e] font-semibold text-base">+91</span>
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\\D/g, '').slice(0, 10))}
                placeholder="98765 43210"
                className="w-full pl-[84px] pr-4 py-4 rounded-2xl border-2 border-[#f5f5f4] bg-[#fafaf9] text-lg font-semibold text-slate-800 placeholder:text-[#a8a29e] focus:outline-none focus:border-[#10b981] focus:bg-white transition-all shadow-sm"
              />
            </div>

            <button 
              className="w-full bg-[#0f766e] hover:bg-[#115e59] active:scale-[0.98] text-white rounded-2xl py-4 font-semibold text-lg flex items-center justify-center gap-2 transition-all shadow-[0_8px_20px_rgba(15,118,110,0.2)]"
            >
              Get OTP
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-auto flex flex-col items-center gap-5">
            <button className="text-[#78716c] font-medium text-[15px] hover:text-[#0f766e] transition-colors underline-offset-4 hover:underline">
              Staff login with email
            </button>
            <p className="text-[#a8a29e] text-[13px] text-center max-w-[260px] leading-relaxed">
              By continuing you agree to our <button className="text-[#0f766e] hover:underline font-medium">Terms</button> & <button className="text-[#0f766e] hover:underline font-medium">Privacy Policy</button>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
