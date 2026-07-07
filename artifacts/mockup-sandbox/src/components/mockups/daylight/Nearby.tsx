import React, { useState } from 'react';
import { MapPin, Star, Clock, Navigation, Home, Search, ClipboardList, User, ShieldCheck, Factory, Info } from 'lucide-react';

export function Nearby() {
  const [radius, setRadius] = useState(40);
  const radiuses = [10, 25, 40, 100];

  return (
    <div className="daylight-wrapper" style={{ width: '390px', height: '844px', background: '#FDFBF7', position: 'relative', overflow: 'hidden', fontFamily: '"Outfit", sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        
        .daylight-wrapper * {
          box-sizing: border-box;
        }
        
        .daylight-card {
          background: #FFFFFF;
          border-radius: 24px;
          padding: 20px;
          box-shadow: 0 8px 24px rgba(67, 74, 66, 0.04);
          border: 1px solid rgba(228, 226, 219, 0.6);
          margin-bottom: 16px;
        }

        .daylight-title {
          font-weight: 600;
          font-size: 17px;
          color: #2D3A3A;
          margin-bottom: 16px;
        }

        .daylight-chip {
          background: #F4F2EC;
          color: #5B6B6B;
          border-radius: 100px;
          padding: 8px 16px;
          font-weight: 500;
          font-size: 15px;
          transition: all 0.2s ease;
          border: 2px solid transparent;
          white-space: nowrap;
        }
        
        .daylight-chip.active {
          background: #FFF2EB;
          color: #C85A32;
          border: 2px solid #E8825A;
        }

        .map-placeholder {
          background: #E8EBE4;
          height: 180px;
          border-radius: 24px;
          position: relative;
          overflow: hidden;
          background-image: radial-gradient(#C4C9C0 1px, transparent 1px);
          background-size: 20px 20px;
          background-position: -10px -10px;
          border: 1px solid rgba(228, 226, 219, 0.6);
          box-shadow: inset 0 2px 8px rgba(0,0,0,0.02);
        }
        
        /* Hide scrollbar */
        .daylight-scroll::-webkit-scrollbar {
          display: none;
        }
        .daylight-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* App Bar */}
      <div className="absolute top-0 w-full z-10 bg-[#FDFBF7]/90 backdrop-blur-md pb-2 pt-12 px-5 flex items-center justify-between">
        <h1 className="text-[22px] font-bold text-[#2D3A3A]">Nearby Plants</h1>
        <button className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm border border-[#E4E2DB] text-[#2D3A3A]">
          <Search size={20} strokeWidth={2.5} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="daylight-scroll w-full h-full overflow-y-auto pt-[90px] pb-[100px] px-5">
        
        {/* Location & Radius Control */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3 text-[#2D3A3A] font-medium px-1">
            <MapPin size={18} className="text-[#C85A32]" />
            <span className="text-[16px]">Whitefield, Bengaluru</span>
            <button className="ml-auto text-[#A3B18A] text-[13px] font-bold bg-[#EEF2E8] px-2.5 py-1 rounded-lg">
              Change
            </button>
          </div>
          
          <div className="daylight-scroll flex gap-2.5 overflow-x-auto pb-1">
            {radiuses.map(r => (
              <button 
                key={r}
                onClick={() => setRadius(r)}
                className={`daylight-chip ${radius === r ? 'active' : ''}`}
              >
                Within {r} km
              </button>
            ))}
          </div>
        </div>

        {/* Map Preview */}
        <div className="map-placeholder mb-5 flex items-center justify-center">
          {/* Mock Map Elements */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-[#A3B18A]/20 rounded-full flex items-center justify-center animate-pulse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#2D3A3A]">
            <MapPin size={24} fill="#FFFFFF" strokeWidth={2} />
          </div>
          
          {/* Plant Pins */}
          <div className="absolute top-[20%] left-[30%] text-[#C85A32]">
            <Factory size={20} fill="#FFF2EB" strokeWidth={2} className="drop-shadow-sm" />
          </div>
          <div className="absolute top-[60%] left-[70%] text-[#C85A32]">
            <Factory size={20} fill="#FFF2EB" strokeWidth={2} className="drop-shadow-sm" />
          </div>
          <div className="absolute top-[75%] left-[40%] text-[#C85A32]">
            <Factory size={20} fill="#FFF2EB" strokeWidth={2} className="drop-shadow-sm" />
          </div>
          <div className="absolute top-[30%] left-[80%] text-[#9AA6A6]">
            <Factory size={16} fill="#F4F2EC" strokeWidth={2} className="drop-shadow-sm" />
          </div>
        </div>

        {/* Plant List */}
        <div className="space-y-4">
          
          {/* Plant 1 */}
          <div className="daylight-card !mb-0 p-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <h2 className="text-[18px] font-bold text-[#2D3A3A]">Ambuja RMC</h2>
                  <ShieldCheck size={16} className="text-[#A3B18A]" fill="#EEF2E8" />
                </div>
                <div className="flex items-center gap-2 text-[13px] text-[#7A8A8A] font-medium">
                  <span className="flex items-center text-[#2D3A3A]"><MapPin size={12} className="mr-1 text-[#A3B18A]" /> 4.2 km</span>
                  <span className="w-1 h-1 rounded-full bg-[#D8D6CD]"></span>
                  <span className="flex items-center text-[#E0A75F]"><Star size={12} className="mr-1" fill="currentColor" /> 4.8 <span className="text-[#9AA6A6] ml-1">(120)</span></span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[16px] font-bold text-[#2D3A3A]">₹4,600</div>
                <div className="text-[12px] text-[#7A8A8A] font-medium">per m³</div>
              </div>
            </div>
            
            <div className="flex gap-2 mb-4">
              <span className="bg-[#F4F2EC] text-[#5B6B6B] text-[11px] font-bold px-2 py-1 rounded-md">M20–M35</span>
              <span className="bg-[#F4F2EC] text-[#5B6B6B] text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1"><Clock size={10} /> ~45 min</span>
            </div>
            
            <div className="flex gap-2">
              <button className="flex-1 bg-[#C85A32] text-white font-bold text-[15px] py-2.5 rounded-xl shadow-[0_4px_12px_rgba(200,90,50,0.2)] hover:bg-[#B64D29] transition-all">
                Place Order
              </button>
              <button className="px-4 bg-[#FFF2EB] text-[#C85A32] font-bold text-[15px] py-2.5 rounded-xl transition-all">
                View
              </button>
            </div>
          </div>

          {/* Plant 2 */}
          <div className="daylight-card !mb-0 p-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <h2 className="text-[18px] font-bold text-[#2D3A3A]">UltraTech</h2>
                  <ShieldCheck size={16} className="text-[#A3B18A]" fill="#EEF2E8" />
                </div>
                <div className="flex items-center gap-2 text-[13px] text-[#7A8A8A] font-medium">
                  <span className="flex items-center text-[#2D3A3A]"><MapPin size={12} className="mr-1 text-[#A3B18A]" /> 6.8 km</span>
                  <span className="w-1 h-1 rounded-full bg-[#D8D6CD]"></span>
                  <span className="flex items-center text-[#E0A75F]"><Star size={12} className="mr-1" fill="currentColor" /> 4.6 <span className="text-[#9AA6A6] ml-1">(85)</span></span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[16px] font-bold text-[#2D3A3A]">₹4,650</div>
                <div className="text-[12px] text-[#7A8A8A] font-medium">per m³</div>
              </div>
            </div>
            
            <div className="flex gap-2 mb-4">
              <span className="bg-[#F4F2EC] text-[#5B6B6B] text-[11px] font-bold px-2 py-1 rounded-md">M15–M40</span>
              <span className="bg-[#F4F2EC] text-[#5B6B6B] text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1"><Clock size={10} /> ~60 min</span>
            </div>
            
            <div className="flex gap-2">
              <button className="flex-1 bg-[#C85A32] text-white font-bold text-[15px] py-2.5 rounded-xl shadow-[0_4px_12px_rgba(200,90,50,0.2)] hover:bg-[#B64D29] transition-all">
                Place Order
              </button>
              <button className="px-4 bg-[#FFF2EB] text-[#C85A32] font-bold text-[15px] py-2.5 rounded-xl transition-all">
                View
              </button>
            </div>
          </div>

          {/* Plant 3 */}
          <div className="daylight-card !mb-0 p-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <h2 className="text-[18px] font-bold text-[#2D3A3A]">ACC Concrete</h2>
                  <ShieldCheck size={16} className="text-[#A3B18A]" fill="#EEF2E8" />
                </div>
                <div className="flex items-center gap-2 text-[13px] text-[#7A8A8A] font-medium">
                  <span className="flex items-center text-[#2D3A3A]"><MapPin size={12} className="mr-1 text-[#A3B18A]" /> 8.5 km</span>
                  <span className="w-1 h-1 rounded-full bg-[#D8D6CD]"></span>
                  <span className="flex items-center text-[#E0A75F]"><Star size={12} className="mr-1" fill="currentColor" /> 4.9 <span className="text-[#9AA6A6] ml-1">(200)</span></span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[16px] font-bold text-[#2D3A3A]">₹4,550</div>
                <div className="text-[12px] text-[#7A8A8A] font-medium">per m³</div>
              </div>
            </div>
            
            <div className="flex gap-2 mb-4">
              <span className="bg-[#F4F2EC] text-[#5B6B6B] text-[11px] font-bold px-2 py-1 rounded-md">M10–M35</span>
              <span className="bg-[#F4F2EC] text-[#5B6B6B] text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1"><Clock size={10} /> ~45 min</span>
            </div>
            
            <div className="flex gap-2">
              <button className="flex-1 bg-[#C85A32] text-white font-bold text-[15px] py-2.5 rounded-xl shadow-[0_4px_12px_rgba(200,90,50,0.2)] hover:bg-[#B64D29] transition-all">
                Place Order
              </button>
              <button className="px-4 bg-[#FFF2EB] text-[#C85A32] font-bold text-[15px] py-2.5 rounded-xl transition-all">
                View
              </button>
            </div>
          </div>

          {/* Plant 4 - Unverified Lead */}
          <div className="daylight-card !mb-0 p-5 border-dashed border-[#D8D6CD] bg-[#FAFAFA]">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <h2 className="text-[18px] font-bold text-[#7A8A8A]">JK Lakshmi RMC</h2>
                </div>
                <div className="flex items-center gap-2 text-[13px] text-[#9AA6A6] font-medium">
                  <span className="flex items-center text-[#7A8A8A]"><MapPin size={12} className="mr-1" /> 5.0 km</span>
                  <span className="w-1 h-1 rounded-full bg-[#E4E2DB]"></span>
                  <span>Found on Map</span>
                </div>
              </div>
              <div className="text-right flex items-center justify-end">
                <span className="bg-[#E8EBE4] text-[#7A8A8A] text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md">Lead</span>
              </div>
            </div>
            
            <div className="bg-[#F4F2EC] rounded-xl p-3 mb-4 flex items-start gap-2">
              <Info size={16} className="text-[#9AA6A6] shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#7A8A8A] leading-tight">This plant is not yet onboarded. Request them and we'll reach out to arrange ordering.</p>
            </div>
            
            <button className="w-full bg-[#E8EBE4] text-[#5B6B6B] font-bold text-[15px] py-2.5 rounded-xl transition-all border border-[#D8D6CD] shadow-sm hover:bg-[#E4E2DB]">
              Request this plant
            </button>
          </div>

        </div>
      </div>

      {/* Bottom Nav Bar */}
      <div className="absolute bottom-0 w-full bg-white border-t border-[#E4E2DB] pb-6 pt-3 px-6 shadow-[0_-8px_32px_rgba(67,74,66,0.06)] rounded-t-3xl flex justify-between items-center z-10">
        <button className="flex flex-col items-center gap-1 text-[#9AA6A6] hover:text-[#5B6B6B] transition-colors">
          <Home size={22} strokeWidth={2} />
          <span className="text-[11px] font-semibold">Home</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-[#C85A32] transition-colors">
          <Navigation size={22} strokeWidth={2.5} fill="#FFF2EB" />
          <span className="text-[11px] font-bold">Nearby</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-[#9AA6A6] hover:text-[#5B6B6B] transition-colors">
          <ClipboardList size={22} strokeWidth={2} />
          <span className="text-[11px] font-semibold">Orders</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-[#9AA6A6] hover:text-[#5B6B6B] transition-colors">
          <User size={22} strokeWidth={2} />
          <span className="text-[11px] font-semibold">Account</span>
        </button>
      </div>

    </div>
  );
}
