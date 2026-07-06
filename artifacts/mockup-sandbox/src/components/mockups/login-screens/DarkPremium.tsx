import React, { useState } from 'react';
import { Truck, ArrowRight } from 'lucide-react';

export function DarkPremium() {
  const [phone, setPhone] = useState('');

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-950 p-4 font-sans">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        .font-outfit { font-family: 'Outfit', sans-serif; }
        
        .glass-panel {
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(16, 185, 129, 0.15);
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.05);
        }
        
        .glow-input:focus-within {
          box-shadow: 0 0 15px rgba(16, 185, 129, 0.2), inset 0 0 0 1px rgba(16, 185, 129, 0.5);
          border-color: transparent;
        }
        
        .glow-btn {
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.4);
          transition: all 0.3s ease;
        }
        .glow-btn:hover {
          box-shadow: 0 0 30px rgba(16, 185, 129, 0.6);
          transform: translateY(-1px);
        }
        
        .bg-mesh {
          background-image: 
            radial-gradient(at 0% 0%, hsla(160,100%,74%,0.15) 0px, transparent 50%),
            radial-gradient(at 100% 100%, hsla(160,100%,74%,0.1) 0px, transparent 50%);
        }
      `}} />

      {/* Mobile Device Container */}
      <div className="relative w-[390px] h-[844px] bg-[#020617] rounded-[40px] overflow-hidden shadow-2xl ring-1 ring-white/10 font-outfit bg-mesh">
        
        {/* Subtle top gradient glow */}
        <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-[#10b981]/20 to-transparent opacity-60 mix-blend-screen pointer-events-none"></div>

        {/* Status Bar Mockup */}
        <div className="absolute top-0 w-full h-12 flex justify-between items-center px-6 text-white/90 text-[15px] font-medium z-20">
          <span>9:41</span>
          <div className="flex gap-2 items-center">
            <svg width="18" height="12" viewBox="0 0 18 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 9.5C0.723858 9.5 0.5 9.72386 0.5 10C0.5 10.2761 0.723858 10.5 1 10.5V9.5ZM17 10.5C17.2761 10.5 17.5 10.2761 17.5 10C17.5 9.72386 17.2761 9.5 17 9.5V10.5ZM1 9.5H17V10.5H1V9.5Z" fill="currentColor"/><path d="M4 6.5C3.72386 6.5 3.5 6.72386 3.5 7C3.5 7.27614 3.72386 7.5 4 7.5V6.5ZM17 7.5C17.2761 7.5 17.5 7.27614 17.5 7C17.5 6.72386 17.2761 6.5 17 6.5V7.5ZM4 6.5H17V7.5H4 6.5Z" fill="currentColor"/><path d="M7 3.5C6.72386 3.5 6.5 3.72386 6.5 4C6.5 4.27614 6.72386 4.5 7 4.5V3.5ZM17 4.5C17.2761 4.5 17.5 4.27614 17.5 4C17.5 3.72386 17.2761 3.5 17 3.5V4.5ZM7 3.5H17V4.5H7 3.5Z" fill="currentColor"/><path d="M10 0.5C9.72386 0.5 9.5 0.723858 9.5 1C9.5 1.27614 9.72386 1.5 10 1.5V0.5ZM17 1.5C17.2761 1.5 17.5 1.27614 17.5 1C17.5 0.723858 17.2761 0.5 17 0.5V1.5ZM10 0.5H17V1.5H10 0.5Z" fill="currentColor"/></svg>
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 12C12.4183 12 16 8.41828 16 4C16 3.65487 15.9782 3.31481 15.9358 2.9811C15.823 2.09172 15.0118 1.48834 14.1202 1.63753C12.186 1.96131 10.1362 2.14286 8 2.14286C5.86377 2.14286 3.81404 1.96131 1.87979 1.63753C0.9882 1.48834 0.176974 2.09172 0.0642455 2.9811C0.0218175 3.31481 0 3.65487 0 4C0 8.41828 3.58172 12 8 12Z" fill="currentColor"/></svg>
            <svg width="25" height="12" viewBox="0 0 25 12" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="currentColor"/><rect x="2" y="2" width="14" height="8" rx="2" fill="currentColor"/><path d="M24 4V8" stroke="currentColor" strokeLinecap="round"/></svg>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full px-6 pt-32 pb-10">
          
          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#10b981] to-[#059669] flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                <Truck className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white">
                TrackMy<span className="text-[#10b981]">RMC</span>
              </h1>
            </div>
            
            <p className="text-[#94a3b8] text-lg leading-relaxed font-light">
              Ready Mix Concrete,<br/>
              <span className="text-white font-medium">On Time, Every Time.</span>
            </p>
          </div>

          {/* Form Card */}
          <div className="glass-panel rounded-3xl p-6 mb-8 relative overflow-hidden">
            {/* Inner top highlight */}
            <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-[#10b981]/50 to-transparent"></div>
            
            <h2 className="text-xl font-semibold text-white mb-2">Welcome back</h2>
            <p className="text-[#64748b] text-sm mb-6">Enter your mobile number to sign in or create an account.</p>

            <div className="space-y-5">
              {/* Phone Input */}
              <div className="relative group glow-input rounded-2xl bg-[#0f172a]/80 border border-[#1e293b] transition-all duration-300 flex items-center p-1.5 h-16">
                <div className="flex items-center gap-2 pl-4 pr-3 border-r border-[#1e293b] h-full text-white font-medium">
                  <span className="text-lg">🇮🇳</span>
                  <span>+91</span>
                </div>
                <input 
                  type="tel" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                  placeholder="98765 43210"
                  className="flex-1 bg-transparent border-none text-white text-lg px-4 h-full outline-none placeholder:text-[#475569] font-medium tracking-wide"
                />
                
                {phone.length === 10 && (
                  <div className="pr-4 animate-in fade-in zoom-in duration-300">
                    <div className="w-6 h-6 rounded-full bg-[#10b981]/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#10b981]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* Primary CTA */}
              <button 
                className={`w-full h-14 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all duration-300
                  ${phone.length === 10 
                    ? 'bg-[#10b981] text-[#022c22] glow-btn cursor-pointer' 
                    : 'bg-[#1e293b] text-[#64748b] cursor-not-allowed border border-[#334155]/50'
                  }`}
                disabled={phone.length !== 10}
              >
                Get OTP
                <ArrowRight className={`w-5 h-5 ${phone.length === 10 ? 'text-[#022c22]' : 'text-[#64748b]'}`} />
              </button>
            </div>
          </div>

          <div className="mt-auto space-y-6">
            {/* Secondary Link */}
            <div className="text-center">
              <button className="text-[#64748b] hover:text-white transition-colors text-sm font-medium tracking-wide">
                Staff login with email
              </button>
            </div>

            {/* Legal */}
            <div className="text-center px-4">
              <p className="text-[11px] text-[#475569] leading-relaxed">
                By continuing you agree to our <br/>
                <a href="#" className="text-[#94a3b8] hover:text-[#10b981] underline underline-offset-2 decoration-[#475569]">Terms of Service</a> & <a href="#" className="text-[#94a3b8] hover:text-[#10b981] underline underline-offset-2 decoration-[#475569]">Privacy Policy</a>
              </p>
            </div>
          </div>
        </div>

        {/* Home Indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-white/20 rounded-full z-20"></div>
      </div>
    </div>
  );
}
