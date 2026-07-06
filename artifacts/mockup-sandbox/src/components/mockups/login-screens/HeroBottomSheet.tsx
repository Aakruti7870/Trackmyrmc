import React, { useState } from "react";
import { Truck, ChevronRight } from "lucide-react";

export function HeroBottomSheet() {
  const [phoneNumber, setPhoneNumber] = useState("");

  return (
    <div className="w-[390px] h-[844px] bg-slate-900 relative overflow-hidden flex flex-col font-sans select-none mx-auto border border-gray-200 shadow-2xl rounded-[3rem]">
      {/* Google Font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <style dangerouslySetInnerHTML={{ __html: `
        .font-plus-jakarta { font-family: 'Plus Jakarta Sans', sans-serif; }
        .hero-gradient { background: linear-gradient(180deg, rgba(15, 118, 110, 0.4) 0%, rgba(15, 118, 110, 0.8) 100%); }
      `}} />

      {/* Hero Background Image */}
      <div className="absolute top-0 left-0 w-full h-[60%]">
        <img 
          src="/__mockup/images/hero-bottom-sheet-truck.png" 
          alt="Concrete Mixer Truck" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 hero-gradient" />
      </div>

      {/* Top Branding Content */}
      <div className="relative z-10 pt-16 px-8 text-center flex flex-col items-center">
        <div className="flex items-center gap-2 mb-4 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
          <Truck className="w-6 h-6 text-white" />
          <h1 className="text-2xl font-extrabold tracking-tight font-plus-jakarta text-white">
            TrackMy<span className="text-emerald-300">RMC</span>
          </h1>
        </div>
        <p className="text-emerald-50 text-sm font-medium tracking-wide font-plus-jakarta opacity-90 max-w-[260px] leading-relaxed">
          Ready Mix Concrete. <br />On Time, Every Time.
        </p>
      </div>

      {/* Bottom Sheet */}
      <div className="absolute bottom-0 w-full bg-white rounded-t-[32px] pt-8 pb-10 px-6 flex flex-col z-20 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
        
        <h2 className="text-2xl font-bold text-gray-900 mb-2 font-plus-jakarta">
          Welcome Back
        </h2>
        <p className="text-gray-500 mb-8 font-plus-jakarta text-sm">
          Enter your mobile number to get started with your concrete deliveries.
        </p>

        {/* Phone Input Area */}
        <div className="mb-6">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 block font-plus-jakarta">
            Mobile Number
          </label>
          <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden focus-within:border-teal-600 transition-colors duration-200">
            <div className="bg-gray-50 px-4 py-4 flex items-center justify-center border-r-2 border-gray-200">
              <span className="text-gray-700 font-bold font-plus-jakarta text-lg">+91</span>
            </div>
            <input 
              type="tel"
              placeholder="98765 43210"
              className="flex-1 px-4 py-4 text-lg font-plus-jakarta font-semibold text-gray-900 outline-none w-full placeholder:text-gray-300"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
            />
          </div>
        </div>

        {/* Primary CTA */}
        <button 
          className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-plus-jakarta font-bold text-lg transition-all duration-300 ${
            phoneNumber.length >= 10 
              ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30 hover:bg-teal-700' 
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          Get OTP
          <ChevronRight className={`w-5 h-5 ${phoneNumber.length >= 10 ? 'opacity-100' : 'opacity-0'}`} />
        </button>

        {/* Trust & Legal */}
        <div className="mt-8 text-center">
          <p className="text-[11px] text-gray-400 font-plus-jakarta max-w-[280px] mx-auto leading-relaxed">
            By continuing you agree to our <a href="#" className="text-teal-600 hover:underline">Terms of Service</a> & <a href="#" className="text-teal-600 hover:underline">Privacy Policy</a>
          </p>
        </div>

        {/* Secondary Login */}
        <div className="mt-6 flex justify-center">
          <button className="text-sm text-gray-500 font-medium font-plus-jakarta hover:text-teal-700 transition-colors">
            Staff login with email
          </button>
        </div>
      </div>
    </div>
  );
}
