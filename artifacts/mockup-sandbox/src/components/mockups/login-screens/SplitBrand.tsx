import React, { useState } from 'react';
import { Truck, ShieldCheck, ArrowRight, ChevronRight, Lock } from 'lucide-react';

export function SplitBrand() {
  const [phone, setPhone] = useState('');

  return (
    <div className="w-[390px] h-[844px] bg-white mx-auto relative overflow-hidden shadow-2xl flex flex-col">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        .font-nunito { font-family: 'Nunito', sans-serif; }
        
        .custom-shape-divider-bottom {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            overflow: hidden;
            line-height: 0;
            transform: translateY(99%);
        }
        .custom-shape-divider-bottom svg {
            position: relative;
            display: block;
            width: calc(100% + 1.3px);
            height: 40px;
        }
        .custom-shape-divider-bottom .shape-fill {
            fill: #ffffff;
        }
      `}} />

      {/* Top Brand Panel */}
      <div className="relative bg-teal-700 pt-16 pb-12 px-6 shrink-0 z-10 flex flex-col items-center text-center">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
        
        {/* Logo */}
        <div className="relative z-10 flex items-center justify-center gap-2 mb-4 mt-6">
          <div className="bg-white p-2 rounded-xl shadow-sm">
            <Truck className="w-8 h-8 text-teal-600" />
          </div>
          <div className="text-3xl font-nunito font-extrabold tracking-tight">
            <span className="text-white">TrackMy</span>
            <span className="text-teal-300">RMC</span>
          </div>
        </div>

        {/* Tagline */}
        <p className="relative z-10 text-teal-50 font-nunito text-base font-medium max-w-[260px] mx-auto leading-snug">
          Ready Mix Concrete,<br />On Time, Every Time.
        </p>

        {/* Curved Divider */}
        <div className="custom-shape-divider-bottom z-20">
          <svg data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
              <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z" opacity=".25" className="shape-fill"></path>
              <path d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-23.84V0Z" opacity=".5" className="shape-fill"></path>
              <path d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z" className="shape-fill"></path>
          </svg>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 bg-white px-6 pt-12 pb-8 flex flex-col font-nunito relative z-10">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h2>
          <p className="text-gray-500 font-medium">Enter your mobile number to continue</p>
        </div>

        {/* Phone Input */}
        <div className="mb-6 group">
          <label className="block text-sm font-bold text-gray-700 mb-2">Mobile Number</label>
          <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden focus-within:border-teal-600 transition-colors bg-white">
            <div className="flex items-center gap-2 px-4 py-3.5 bg-gray-50 border-r-2 border-gray-200 text-gray-700 font-bold">
              <span className="text-lg">🇮🇳</span>
              <span className="text-base">+91</span>
            </div>
            <input
              type="tel"
              maxLength={10}
              placeholder="98765 43210"
              className="flex-1 px-4 py-3.5 text-lg font-bold text-gray-900 placeholder:text-gray-300 focus:outline-none w-full bg-transparent tracking-wide"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>

        {/* Primary CTA */}
        <button 
          className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-teal-600/20 mb-6"
        >
          Get OTP
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Trust Indicators */}
        <div className="flex items-center justify-center gap-6 mt-2 mb-auto">
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">100% Secure</span>
          </div>
          <div className="w-px h-8 bg-gray-200"></div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-600">
              <Truck className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Live Tracking</span>
          </div>
        </div>

        {/* Bottom Links */}
        <div className="mt-8 flex flex-col items-center gap-6">
          <button className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-teal-600 transition-colors">
            <Lock className="w-4 h-4" />
            Staff Login
          </button>
          
          <p className="text-[11px] text-gray-400 text-center max-w-[280px] leading-relaxed font-medium">
            By continuing, you agree to TrackMyRMC's{' '}
            <a href="#" className="text-teal-600 hover:underline font-bold">Terms of Service</a>{' '}
            and{' '}
            <a href="#" className="text-teal-600 hover:underline font-bold">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
