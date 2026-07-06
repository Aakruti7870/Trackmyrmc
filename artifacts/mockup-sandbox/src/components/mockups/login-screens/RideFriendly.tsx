import React, { useState } from "react";
import { Truck, ChevronRight } from "lucide-react";

export function RideFriendly() {
  const [phone, setPhone] = useState("");

  return (
    <div 
      className="w-full h-full min-h-[844px] max-w-[390px] mx-auto bg-white relative overflow-hidden flex flex-col font-sans"
      style={{ fontFamily: "'Quicksand', sans-serif" }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700;800&display=swap');
        
        .shadow-chunky {
          box-shadow: 0 4px 0 0 rgba(15, 118, 110, 1);
        }
        
        .shadow-chunky-yellow {
          box-shadow: 0 4px 0 0 rgba(234, 179, 8, 1);
        }
        
        .active-chunky:active {
          transform: translateY(4px);
          box-shadow: 0 0 0 0 transparent;
        }
      `}} />

      {/* Header / Logo */}
      <div className="pt-12 px-6 pb-4 flex items-center gap-2">
        <div className="bg-teal-100 p-2 rounded-xl text-teal-600">
          <Truck size={24} strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">
          TrackMy<span className="text-teal-600">RMC</span>
        </h1>
      </div>

      {/* Illustration Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-4">
        <div className="relative w-full max-w-[280px] aspect-square flex items-center justify-center mb-6">
          {/* Decorative background blobs */}
          <div className="absolute inset-0 bg-yellow-100 rounded-full scale-90 -translate-y-4 translate-x-4 opacity-50 blur-xl"></div>
          <div className="absolute inset-0 bg-teal-100 rounded-full scale-90 translate-y-4 -translate-x-4 opacity-50 blur-xl"></div>
          
          <img 
            src="/__mockup/images/friendly-truck.png" 
            alt="Friendly Concrete Truck" 
            className="w-full h-full object-contain relative z-10 animate-bounce"
            style={{ animationDuration: '3s' }}
          />
        </div>

        <div className="text-center space-y-3 mb-8 w-full">
          <h2 className="text-3xl font-extrabold text-slate-800 leading-tight">
            Ready Mix Concrete,
            <br />
            <span className="text-teal-600">On Time. Every Time.</span>
          </h2>
          <p className="text-slate-500 font-medium text-lg">
            Track your deliveries instantly.
          </p>
        </div>
      </div>

      {/* Bottom Action Area */}
      <div className="px-6 pb-12 pt-6 bg-white rounded-t-3xl border-t-2 border-slate-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] relative z-20">
        
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Enter mobile number</label>
            <div className="flex bg-slate-50 rounded-2xl border-2 border-slate-200 focus-within:border-teal-500 focus-within:bg-white transition-colors overflow-hidden">
              <div className="flex items-center justify-center pl-4 pr-3 py-4 border-r-2 border-slate-200 bg-slate-100">
                <span className="font-bold text-slate-700 text-lg">+91</span>
              </div>
              <input 
                type="tel"
                placeholder="98765 43210"
                className="flex-1 bg-transparent px-4 py-4 outline-none font-bold text-lg text-slate-800 placeholder:text-slate-400 w-full"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
              />
            </div>
          </div>

          <button className="w-full bg-yellow-400 hover:bg-yellow-300 text-slate-900 text-xl font-extrabold py-4 px-6 rounded-2xl flex items-center justify-between shadow-chunky-yellow active-chunky transition-all group">
            <span>Get OTP</span>
            <div className="bg-white/30 rounded-full p-1 group-hover:translate-x-1 transition-transform">
              <ChevronRight size={24} />
            </div>
          </button>
        </div>

        <div className="mt-8 flex flex-col items-center gap-6">
          <button className="text-slate-500 font-bold text-sm hover:text-teal-600 transition-colors">
            Staff login instead?
          </button>

          <p className="text-xs text-slate-400 text-center font-medium px-4">
            By continuing you agree to our <a href="#" className="underline decoration-slate-300 underline-offset-2">Terms</a> & <a href="#" className="underline decoration-slate-300 underline-offset-2">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
