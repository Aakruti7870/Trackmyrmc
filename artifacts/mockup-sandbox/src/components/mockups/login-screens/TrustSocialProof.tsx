import React, { useState } from 'react';
import { Star, ShieldCheck, Truck, CheckCircle2, Lock, ArrowRight, Building2 } from 'lucide-react';

export function TrustSocialProof() {
  const [phone, setPhone] = useState('');

  return (
    <div className="flex flex-col h-[844px] w-[390px] mx-auto bg-slate-50 relative overflow-hidden font-sans shadow-2xl rounded-[40px] border-[8px] border-slate-900">
      <style dangerouslySetInlineStyle={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .font-jakarta { font-family: 'Plus Jakarta Sans', sans-serif; }
      `}} />
      
      <div className="flex-1 flex flex-col px-6 pt-12 pb-8 font-jakarta">
        
        {/* Header / Brand */}
        <div className="flex flex-col items-center mt-4 mb-8">
          <div className="flex items-center gap-2 mb-3 bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100">
            <Truck className="w-6 h-6 text-teal-600" />
            <span className="text-2xl font-extrabold tracking-tight text-slate-900">
              TrackMy<span className="text-teal-600">RMC</span>
            </span>
          </div>
          <p className="text-slate-600 text-sm font-medium text-center px-4">
            India's #1 Ready-Mix Concrete Delivery Network
          </p>
        </div>

        {/* Primary Social Proof Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-teal-500"></div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className={`w-4 h-4 ${star === 5 ? 'text-teal-500 fill-teal-500/50' : 'text-amber-400 fill-amber-400'}`} />
              ))}
              <span className="ml-1 font-bold text-slate-900 text-sm">4.8/5</span>
            </div>
            <div className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-1 rounded-full">
              TrustScore™
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 divide-x divide-slate-100">
            <div className="flex flex-col">
              <span className="text-2xl font-extrabold text-slate-900">50k+</span>
              <span className="text-xs text-slate-500 font-medium mt-0.5">Successful Pours</span>
            </div>
            <div className="flex flex-col pl-4">
              <span className="text-2xl font-extrabold text-slate-900">200+</span>
              <span className="text-xs text-slate-500 font-medium mt-0.5">Verified RMC Plants</span>
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-slate-900 mb-2">
            Enter mobile number
          </label>
          <div className="flex relative focus-within:ring-2 focus-within:ring-teal-500 focus-within:ring-offset-2 rounded-xl bg-white shadow-sm border border-slate-200 transition-all">
            <div className="flex items-center justify-center pl-4 pr-3 py-4 border-r border-slate-200 bg-slate-50/50 rounded-l-xl">
              <span className="font-bold text-slate-900 text-base">+91</span>
            </div>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="98765 43210"
              className="flex-1 bg-transparent px-4 py-4 outline-none text-lg font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-medium w-full"
            />
          </div>
        </div>

        {/* Primary CTA */}
        <button 
          className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-xl py-4 font-bold text-lg shadow-lg shadow-teal-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          Get OTP Securely
          <ArrowRight className="w-5 h-5" />
        </button>

        {/* Trust Badges Row */}
        <div className="flex justify-between items-center mt-8 px-2">
          <div className="flex flex-col items-center gap-1.5">
            <div className="bg-teal-50 p-2.5 rounded-full text-teal-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold text-slate-600 text-center uppercase tracking-wider">Verified<br/>Quality</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="bg-blue-50 p-2.5 rounded-full text-blue-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold text-slate-600 text-center uppercase tracking-wider">On-Time<br/>Delivery</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="bg-emerald-50 p-2.5 rounded-full text-emerald-600">
              <Lock className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold text-slate-600 text-center uppercase tracking-wider">Secure<br/>Payments</span>
          </div>
        </div>

        <div className="mt-auto pt-6 flex flex-col items-center gap-4">
          <button className="text-sm font-semibold text-slate-500 hover:text-teal-600 transition-colors flex items-center gap-1">
            <Building2 className="w-4 h-4" />
            Staff Login
          </button>
          
          <p className="text-[11px] text-slate-400 text-center max-w-[280px] font-medium leading-relaxed">
            By continuing, you agree to our <a href="#" className="underline decoration-slate-300 underline-offset-2">Terms of Service</a> & <a href="#" className="underline decoration-slate-300 underline-offset-2">Privacy Policy</a>.
          </p>
        </div>

      </div>
    </div>
  );
}
