import React, { useState } from 'react';
import { ChevronLeft, Star, MapPin, Navigation, Plus, Minus, Calendar, Clock, ChevronRight, Info } from 'lucide-react';

export function Daylight() {
  const [grade, setGrade] = useState('M25');
  const [quantity, setQuantity] = useState(8);
  const [pump, setPump] = useState(false);
  const [pumpLength, setPumpLength] = useState('30');
  
  const grades = ['M10', 'M15', 'M20', 'M25', 'M30', 'M35'];
  
  // Calculate est price (e.g. ₹ 4800 per m3)
  const pricePerM3 = 4800;
  const pumpCost = pump ? 3000 : 0;
  const estimatedPrice = (quantity * pricePerM3) + pumpCost;

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
        }
        
        .daylight-chip.active {
          background: #FFF2EB;
          color: #C85A32;
          border: 2px solid #E8825A;
        }

        .daylight-input {
          background: #F4F2EC;
          border: 2px solid transparent;
          border-radius: 16px;
          padding: 16px;
          font-family: inherit;
          font-size: 16px;
          color: #2D3A3A;
          width: 100%;
          outline: none;
          transition: border-color 0.2s;
        }
        .daylight-input:focus {
          border-color: #A3B18A;
        }
        
        .daylight-input::placeholder {
          color: #9AA6A6;
        }

        .map-placeholder {
          background: #E8EBE4;
          height: 120px;
          border-radius: 16px;
          position: relative;
          overflow: hidden;
          background-image: radial-gradient(#C4C9C0 1px, transparent 1px);
          background-size: 20px 20px;
          background-position: -10px -10px;
        }
        
        /* Custom Toggle */
        .toggle-switch {
          position: relative;
          width: 52px;
          height: 32px;
          background: #F4F2EC;
          border-radius: 32px;
          cursor: pointer;
          transition: background 0.3s;
        }
        .toggle-switch.active {
          background: #A3B18A;
        }
        .toggle-switch::after {
          content: '';
          position: absolute;
          top: 4px;
          left: 4px;
          width: 24px;
          height: 24px;
          background: #FFF;
          border-radius: 50%;
          transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .toggle-switch.active::after {
          transform: translateX(20px);
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
        <button className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm border border-[#E4E2DB] text-[#2D3A3A]">
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <h1 className="text-[19px] font-semibold text-[#2D3A3A]">Place Order</h1>
        <div className="w-10 h-10"></div> {/* Spacer */}
      </div>

      {/* Scrollable Content */}
      <div className="daylight-scroll w-full h-full overflow-y-auto pt-[104px] pb-[140px] px-5">
        
        {/* Plant Card */}
        <div className="daylight-card flex items-center justify-between group">
          <div className="flex gap-4 items-center">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF2EB] flex items-center justify-center flex-shrink-0 text-[#C85A32]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10v11"/><path d="M20 10v11"/><path d="M15 21v-5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v5"/><path d="M3 10h18"/><path d="M12 2L3 10h18z"/></svg>
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-[#2D3A3A] mb-1">Ambuja RMC</h2>
              <div className="flex items-center gap-2 text-[13px] text-[#7A8A8A] font-medium">
                <span className="flex items-center text-[#A3B18A]"><MapPin size={12} className="mr-[2px]" /> 4.2 km</span>
                <span className="w-1 h-1 rounded-full bg-[#D8D6CD]"></span>
                <span className="flex items-center text-[#E0A75F]"><Star size={12} className="mr-[2px]" fill="currentColor" /> 4.8</span>
              </div>
            </div>
          </div>
          <button className="text-[#C85A32] text-[14px] font-semibold bg-[#FFF2EB] px-3 py-1.5 rounded-xl">
            Change
          </button>
        </div>

        {/* Concrete Grade */}
        <div className="daylight-card">
          <h3 className="daylight-title">Concrete Grade</h3>
          <div className="flex flex-wrap gap-2.5">
            {grades.map(g => (
              <button 
                key={g}
                onClick={() => setGrade(g)}
                className={`daylight-chip ${grade === g ? 'active' : ''}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div className="daylight-card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[17px] font-semibold text-[#2D3A3A] m-0">Quantity (m³)</h3>
            <div className="flex items-center text-[#7A8A8A] text-[13px] font-medium gap-1 bg-[#F4F2EC] px-2 py-1 rounded-lg">
              <Info size={12} /> Min 3m³
            </div>
          </div>
          
          <div className="flex items-center justify-between bg-[#F4F2EC] rounded-2xl p-2">
            <button 
              onClick={() => setQuantity(Math.max(3, quantity - 1))}
              className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-[#2D3A3A]"
            >
              <Minus size={20} strokeWidth={2.5} />
            </button>
            <div className="text-[28px] font-bold text-[#2D3A3A]">
              {quantity} <span className="text-[18px] text-[#7A8A8A] font-medium">m³</span>
            </div>
            <button 
              onClick={() => setQuantity(quantity + 1)}
              className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-[#2D3A3A]"
            >
              <Plus size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Date & Time */}
        <div className="flex gap-3 mb-4">
          <div className="daylight-card flex-1 mb-0 p-4">
            <div className="flex items-center gap-2 text-[#7A8A8A] text-[13px] font-medium mb-2">
              <Calendar size={14} /> Delivery Date
            </div>
            <div className="text-[16px] font-semibold text-[#2D3A3A]">Today, Oct 12</div>
          </div>
          <div className="daylight-card flex-1 mb-0 p-4">
            <div className="flex items-center gap-2 text-[#7A8A8A] text-[13px] font-medium mb-2">
              <Clock size={14} /> Time
            </div>
            <div className="text-[16px] font-semibold text-[#2D3A3A]">08:30 AM</div>
          </div>
        </div>

        {/* Location */}
        <div className="daylight-card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[17px] font-semibold text-[#2D3A3A] m-0">Delivery Location</h3>
            <button className="text-[#A3B18A] text-[13px] font-bold flex items-center gap-1 bg-[#EEF2E8] px-3 py-1.5 rounded-xl">
              <Navigation size={12} /> Use My Location
            </button>
          </div>
          
          <div className="map-placeholder mb-4 flex items-center justify-center">
            <div className="absolute w-[120px] h-[120px] bg-[#A3B18A]/20 rounded-full flex items-center justify-center animate-pulse">
              <div className="w-[60px] h-[60px] bg-[#A3B18A]/40 rounded-full flex items-center justify-center">
                <div className="text-[#6B7D54] relative -top-2">
                  <MapPin size={28} strokeWidth={2.5} fill="currentColor" className="drop-shadow-md" />
                </div>
              </div>
            </div>
          </div>
          
          <input 
            type="text" 
            className="daylight-input"
            defaultValue="Prestige Lakeside — Tower B"
            placeholder="Site Name / Address"
          />
        </div>

        {/* Concrete Pump */}
        <div className="daylight-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[17px] font-semibold text-[#2D3A3A] m-0">Concrete Pump</h3>
              <p className="text-[13px] text-[#7A8A8A] mt-1 font-medium">Do you need a pump at site?</p>
            </div>
            <div 
              className={`toggle-switch ${pump ? 'active' : ''}`}
              onClick={() => setPump(!pump)}
            />
          </div>
          
          {pump && (
            <div className="mt-5 pt-5 border-t border-[#E4E2DB] animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-[13px] font-medium text-[#7A8A8A] mb-2">Pump Line Length (m)</label>
              <div className="relative">
                <input 
                  type="number" 
                  className="daylight-input"
                  value={pumpLength}
                  onChange={(e) => setPumpLength(e.target.value)}
                  placeholder="e.g. 30"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9AA6A6] font-medium">meters</span>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="daylight-card">
          <h3 className="daylight-title">Additional Notes</h3>
          <textarea 
            className="daylight-input resize-none h-[100px]"
            placeholder="Anything the plant should know? (e.g. narrow road, gate entry...)"
          ></textarea>
        </div>

      </div>

      {/* Bottom Sticky Strip */}
      <div className="absolute bottom-0 w-full bg-white border-t border-[#E4E2DB] p-5 pb-8 shadow-[0_-8px_32px_rgba(67,74,66,0.06)] rounded-t-3xl">
        <div className="flex justify-between items-end mb-4 px-2">
          <div>
            <div className="text-[14px] text-[#7A8A8A] font-medium mb-1">Estimated Price</div>
            <div className="flex items-center gap-2">
              <span className="bg-[#FFF2EB] text-[#C85A32] text-[13px] font-bold px-2 py-0.5 rounded-lg">{grade}</span>
              <span className="text-[#D8D6CD]">•</span>
              <span className="font-semibold text-[#2D3A3A]">{quantity} m³</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[24px] font-bold text-[#2D3A3A]">
              ₹ {estimatedPrice.toLocaleString('en-IN')}
            </div>
            {pump && <div className="text-[12px] text-[#A3B18A] font-medium">+ ₹ 3,000 for pump</div>}
          </div>
        </div>
        
        <button className="w-full bg-[#C85A32] text-white font-bold text-[17px] py-4 rounded-2xl shadow-[0_8px_20px_rgba(200,90,50,0.25)] hover:bg-[#B64D29] hover:-translate-y-0.5 transition-all active:scale-[0.98]">
          Confirm Order
        </button>
      </div>

    </div>
  );
}
