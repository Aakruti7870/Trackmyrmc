import React, { useState } from "react";
import { Truck, ShieldCheck, ArrowRight, HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";

export function IndustrialBold() {
  const [phone, setPhone] = useState("");

  return (
    <div className="relative w-full h-[100dvh] max-h-[844px] max-w-[390px] mx-auto overflow-hidden bg-zinc-900 text-zinc-100 flex flex-col font-sans selection:bg-yellow-400 selection:text-zinc-900 shadow-2xl">
      {/* Custom Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Teko:wght@500;600;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <style dangerouslySetInnerHTML={{ __html: `
        .font-industrial { font-family: 'Teko', sans-serif; text-transform: uppercase; }
        .hazard-border {
          background: repeating-linear-gradient(
            -45deg,
            #facc15,
            #facc15 10px,
            #18181b 10px,
            #18181b 20px
          );
        }
      `}} />

      {/* Concrete Texture Background */}
      <div 
        className="absolute inset-0 z-0 opacity-40 mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: "url('/__mockup/images/industrial-concrete-bg.png')",
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      />

      {/* Brand Header */}
      <div className="relative z-10 pt-16 pb-8 px-6 flex flex-col items-center">
        <div className="w-16 h-16 bg-teal-600 rounded-lg flex items-center justify-center mb-4 shadow-[4px_4px_0px_#facc15] border-2 border-zinc-900 transform -rotate-3">
          <Truck className="w-10 h-10 text-white" />
        </div>
        <h1 className="font-industrial text-5xl tracking-wide flex items-center gap-1 drop-shadow-md">
          <span className="text-zinc-100">TRACKMY</span>
          <span className="text-teal-500">RMC</span>
        </h1>
        <p className="text-zinc-400 text-sm font-medium tracking-wide mt-1 uppercase">Ready Mix Concrete. On Time. Every Time.</p>
      </div>

      {/* Content Area */}
      <div className="relative z-10 flex-1 flex flex-col px-6 mt-8">
        
        <div className="mb-8">
          <h2 className="font-industrial text-4xl leading-none text-zinc-100 mb-2">SITE ACCESS</h2>
          <p className="text-zinc-400 text-sm">Enter your mobile number to view dispatches and track your concrete order.</p>
        </div>

        {/* Input Group */}
        <div className="mb-6 relative">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Mobile Number</label>
          <div className="flex items-stretch h-14 bg-zinc-800 border-2 border-zinc-700 rounded-none focus-within:border-yellow-400 transition-colors">
            <div className="flex items-center justify-center px-4 border-r-2 border-zinc-700 bg-zinc-800/50">
              <span className="font-bold text-zinc-300">+91</span>
            </div>
            <input 
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\\D/g, ''))}
              placeholder="98765 43210"
              maxLength={10}
              className="flex-1 bg-transparent border-none px-4 text-xl font-bold text-white placeholder:text-zinc-600 focus:outline-none focus:ring-0"
            />
          </div>
        </div>

        {/* CTA */}
        <button 
          className="relative w-full h-14 bg-yellow-400 text-zinc-900 font-industrial text-2xl tracking-widest flex items-center justify-center overflow-hidden group hover:bg-yellow-300 transition-colors active:scale-[0.98]"
        >
          <span className="relative z-10 flex items-center gap-2">
            GET OTP TO CONTINUE <ArrowRight className="w-6 h-6" />
          </span>
          {/* Subtle hazard stripe hover effect */}
          <div className="absolute inset-0 hazard-border opacity-0 group-hover:opacity-10 transition-opacity" />
        </button>

        {/* Trust Badge */}
        <div className="mt-8 flex items-center justify-center gap-2 text-zinc-500">
          <ShieldCheck className="w-4 h-4 text-teal-500" />
          <span className="text-xs font-medium uppercase tracking-wider">Verified Plant Network</span>
        </div>

        <div className="mt-2 flex items-center justify-center gap-2 text-zinc-500">
          <HardHat className="w-4 h-4 text-yellow-500" />
          <span className="text-xs font-medium uppercase tracking-wider">Industrial Grade Security</span>
        </div>

        <div className="mt-auto pb-6">
          <div className="h-1 w-full hazard-border mb-6 opacity-30" />
          
          <button className="w-full text-center text-teal-500 text-sm font-bold uppercase tracking-widest hover:text-teal-400 mb-6">
            Staff / Operator Login
          </button>
          
          <p className="text-center text-[10px] text-zinc-600 font-medium max-w-[280px] mx-auto uppercase tracking-wide leading-relaxed">
            By continuing, you agree to TrackMyRMC's <br/>
            <a href="#" className="text-zinc-400 underline decoration-zinc-600 underline-offset-2">Terms of Service</a> and <a href="#" className="text-zinc-400 underline decoration-zinc-600 underline-offset-2">Privacy Policy</a>.
          </p>
        </div>

      </div>
    </div>
  );
}
