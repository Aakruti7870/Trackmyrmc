import React, { useState } from "react";
import { Truck, ArrowRight, ShieldCheck, Clock } from "lucide-react";

export function GradientVibrant() {
  const [phoneNumber, setPhoneNumber] = useState("");

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] w-full bg-slate-900 font-['Outfit',sans-serif] overflow-hidden">
      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Mobile viewport container */}
      <div className="relative w-full max-w-[390px] h-[844px] bg-gradient-to-br from-teal-500 via-emerald-400 to-teal-700 overflow-hidden shadow-2xl sm:rounded-[40px] sm:border-[8px] sm:border-slate-800">
        
        {/* Animated background blobs for depth */}
        <div className="absolute top-[-10%] left-[-20%] w-[300px] h-[300px] bg-teal-300 rounded-full mix-blend-overlay filter blur-[60px] opacity-70 animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[350px] h-[350px] bg-emerald-300 rounded-full mix-blend-overlay filter blur-[80px] opacity-60"></div>
        <div className="absolute top-[40%] left-[30%] w-[200px] h-[200px] bg-teal-200 rounded-full mix-blend-overlay filter blur-[50px] opacity-40"></div>

        {/* Content Container */}
        <div className="relative z-10 flex flex-col h-full px-6 pt-16 pb-8">
          
          {/* Header */}
          <div className="flex flex-col items-center mb-10 text-center text-white">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 shadow-lg border border-white/30">
              <Truck className="w-8 h-8 text-white" strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center drop-shadow-sm">
              <span className="text-white">TrackMy</span>
              <span className="text-teal-900 bg-white/90 px-1.5 rounded ml-1">RMC</span>
            </h1>
            <p className="text-emerald-50 text-base font-medium opacity-90">Ready Mix Concrete, On Time, Every Time.</p>
          </div>

          {/* Frosted Glass Card */}
          <div className="flex-1 flex flex-col justify-center w-full">
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
              {/* Subtle inner top highlight */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
              
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
                <p className="text-teal-50/80 text-sm">Enter your mobile number to securely sign in or register.</p>
              </div>

              <div className="space-y-5">
                {/* Phone Input Group */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-emerald-50 uppercase tracking-wider ml-1">Mobile Number</label>
                  <div className="flex relative items-center">
                    <div className="absolute left-0 top-0 bottom-0 flex items-center justify-center px-4 bg-white/10 border-r border-white/10 rounded-l-xl backdrop-blur-sm z-10">
                      <span className="text-white font-semibold">+91</span>
                    </div>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="98765 43210"
                      className="w-full h-14 pl-[76px] pr-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-white/30 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-emerald-300/50 focus:border-transparent transition-all backdrop-blur-md"
                    />
                  </div>
                </div>

                {/* Primary CTA */}
                <button 
                  className="w-full h-14 bg-white text-teal-900 hover:bg-emerald-50 rounded-xl font-bold text-lg shadow-[0_8px_20px_-4px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_24px_-6px_rgba(0,0,0,0.25)] transition-all flex items-center justify-center gap-2 group relative overflow-hidden"
                >
                  <span className="relative z-10">Get OTP</span>
                  <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-100 to-white opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </button>
              </div>

              {/* Trust Cues within card */}
              <div className="mt-8 flex items-center justify-center gap-4 text-xs font-medium text-teal-50/60">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-300" />
                  <span>Verified Plants</span>
                </div>
                <div className="w-1 h-1 bg-white/20 rounded-full"></div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-emerald-300" />
                  <span>Live Tracking</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Area */}
          <div className="mt-auto flex flex-col items-center space-y-6">
            <button className="text-white/70 hover:text-white text-sm font-medium transition-colors border-b border-white/20 pb-0.5">
              Staff login
            </button>
            
            <p className="text-center text-[11px] text-white/50 px-4 leading-relaxed">
              By continuing you agree to our <a href="#" className="underline decoration-white/30 hover:text-white/80 transition-colors">Terms of Service</a> & <a href="#" className="underline decoration-white/30 hover:text-white/80 transition-colors">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
