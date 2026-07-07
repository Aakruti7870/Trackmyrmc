import React, { useState } from 'react';
import { ChevronLeft, MapPin, Phone, Check, Clock, Truck, FileText, Download, Navigation, Home, Search, User, Compass } from 'lucide-react';

export function MyOrders() {
  const [activeTab, setActiveTab] = useState('Active');

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
          height: 140px;
          border-radius: 16px;
          position: relative;
          overflow: hidden;
          background-image: radial-gradient(#C4C9C0 1px, transparent 1px);
          background-size: 20px 20px;
          background-position: -10px -10px;
        }
        
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
        
        .daylight-scroll::-webkit-scrollbar {
          display: none;
        }
        .daylight-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          color: #9AA6A6;
          font-size: 11px;
          font-weight: 500;
          transition: all 0.2s;
        }
        .nav-item.active {
          color: #C85A32;
        }
      `}</style>

      {/* App Bar */}
      <div className="absolute top-0 w-full z-10 bg-[#FDFBF7]/90 backdrop-blur-md pb-4 pt-12 px-5">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm border border-[#E4E2DB] text-[#2D3A3A]">
            <ChevronLeft size={22} strokeWidth={2.5} />
          </div>
          <h1 className="text-[19px] font-semibold text-[#2D3A3A]">My Orders</h1>
          <div className="w-10 h-10"></div>
        </div>
        
        {/* Segmented Control */}
        <div className="flex bg-[#F4F2EC] p-1 rounded-2xl">
          {['Active', 'History'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-[15px] font-semibold rounded-xl transition-all ${
                activeTab === tab 
                  ? 'bg-white text-[#2D3A3A] shadow-sm' 
                  : 'text-[#7A8A8A]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="daylight-scroll w-full h-full overflow-y-auto pt-[160px] pb-[100px] px-5">
        
        {/* ACTIVE ORDER (IN TRANSIT) */}
        <div className="daylight-card border-[#C85A32]/30 shadow-[0_8px_32px_rgba(200,90,50,0.08)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#C85A32]"></div>
          
          <div className="flex justify-between items-start mb-4 pt-2">
            <div>
              <div className="text-[13px] font-bold text-[#7A8A8A] mb-1">#RMC-2481</div>
              <h2 className="text-[18px] font-bold text-[#2D3A3A]">Ambuja RMC</h2>
            </div>
            <div className="bg-[#FFF2EB] text-[#C85A32] text-[12px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#C85A32] animate-pulse"></span>
              In Transit
            </div>
          </div>

          <div className="flex items-center gap-2 mb-5">
            <span className="bg-[#F4F2EC] text-[#5B6B6B] text-[13px] font-bold px-2 py-1 rounded-lg">M25</span>
            <span className="text-[#D8D6CD]">•</span>
            <span className="text-[14px] font-semibold text-[#2D3A3A]">8 m³</span>
            <span className="text-[#D8D6CD]">•</span>
            <span className="text-[14px] font-semibold text-[#2D3A3A]">₹ 38,400</span>
          </div>

          {/* Tracking Panel */}
          <div className="bg-[#FDFBF7] rounded-2xl p-4 -mx-2 mb-2 border border-[#E4E2DB]">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-[#C85A32] font-bold text-[15px]">
                <Truck size={18} />
                Arriving ~12 min
              </div>
              <div className="text-[13px] font-medium text-[#7A8A8A]">Today, 10:45 AM</div>
            </div>

            {/* Map */}
            <div className="map-placeholder mb-4">
              <div className="absolute top-1/2 left-1/3 w-[120px] h-[120px] -translate-x-1/2 -translate-y-1/2 bg-[#C85A32]/20 rounded-full flex items-center justify-center animate-pulse"></div>
              
              {/* Route line */}
              <svg className="absolute top-0 left-0 w-full h-full" style={{ strokeDasharray: '4 4' }}>
                <path d="M 40 70 Q 120 70 200 40 T 320 80" fill="none" stroke="#C85A32" strokeWidth="3" />
              </svg>
              
              {/* Truck Pin */}
              <div className="absolute top-[70px] left-[40px] -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center border-2 border-[#C85A32] z-10">
                <Truck size={14} className="text-[#C85A32]" />
              </div>
              
              {/* Destination Pin */}
              <div className="absolute top-[80px] left-[320px] -translate-x-1/2 -translate-y-[100%] z-10">
                <div className="text-[#2D3A3A]">
                  <MapPin size={24} strokeWidth={2.5} fill="white" />
                </div>
              </div>
            </div>

            {/* Driver Info */}
            <div className="flex justify-between items-center bg-white rounded-xl p-3 border border-[#E4E2DB]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#EEF2E8] rounded-full flex items-center justify-center text-[#A3B18A]">
                  <User size={20} />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-[#2D3A3A]">Ramesh K.</div>
                  <div className="text-[12px] font-medium text-[#7A8A8A]">KA-01-AB-1234</div>
                </div>
              </div>
              <button className="w-10 h-10 bg-[#FFF2EB] rounded-full flex items-center justify-center text-[#C85A32]">
                <Phone size={18} fill="currentColor" />
              </button>
            </div>

            {/* Timeline */}
            <div className="mt-5 relative">
              <div className="absolute top-2.5 left-2 right-2 h-0.5 bg-[#E4E2DB] -z-10"></div>
              <div className="absolute top-2.5 left-2 w-[70%] h-0.5 bg-[#C85A32] -z-10"></div>
              
              <div className="flex justify-between">
                {['Confirmed', 'Batching', 'Dispatched', 'In Transit', 'Delivered'].map((step, i) => {
                  const isActive = i === 3;
                  const isPast = i < 3;
                  return (
                    <div key={step} className="flex flex-col items-center">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center mb-1.5 ${
                        isActive ? 'bg-[#FFF2EB] border-2 border-[#C85A32] text-[#C85A32]' : 
                        isPast ? 'bg-[#C85A32] text-white' : 
                        'bg-[#FDFBF7] border-2 border-[#E4E2DB]'
                      }`}>
                        {isPast ? <Check size={12} strokeWidth={3} /> : isActive ? <div className="w-1.5 h-1.5 bg-[#C85A32] rounded-full"></div> : null}
                      </div>
                      <div className={`text-[9px] font-bold uppercase tracking-wider ${isActive || isPast ? 'text-[#2D3A3A]' : 'text-[#9AA6A6]'}`}>
                        {step}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* UPCOMING ORDER */}
        <div className="daylight-card">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-[13px] font-bold text-[#7A8A8A] mb-1">#RMC-2490</div>
              <h2 className="text-[17px] font-bold text-[#2D3A3A]">UltraTech Concrete</h2>
            </div>
            <div className="bg-[#FDF6E3] text-[#E0A75F] text-[12px] font-bold px-3 py-1.5 rounded-full">
              Pending
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className="bg-[#F4F2EC] text-[#5B6B6B] text-[13px] font-bold px-2 py-1 rounded-lg">M30</span>
            <span className="text-[#D8D6CD]">•</span>
            <span className="text-[14px] font-semibold text-[#2D3A3A]">12 m³</span>
            <span className="text-[#D8D6CD]">•</span>
            <span className="text-[14px] font-semibold text-[#2D3A3A]">₹ 58,800</span>
          </div>

          <div className="flex items-center gap-4 text-[13px] text-[#7A8A8A] font-medium bg-[#F4F2EC] p-3 rounded-xl">
            <div className="flex items-center gap-1.5"><Clock size={14} className="text-[#2D3A3A]" /> Tomorrow, 08:00 AM</div>
            <div className="w-1 h-1 rounded-full bg-[#D8D6CD]"></div>
            <div className="flex items-center gap-1.5"><MapPin size={14} className="text-[#2D3A3A]" /> Site B</div>
          </div>
        </div>

        {/* COMPLETED ORDER */}
        <div className="daylight-card opacity-80">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-[13px] font-bold text-[#7A8A8A] mb-1">#RMC-2412</div>
              <h2 className="text-[17px] font-bold text-[#2D3A3A]">ACC Ready Mix</h2>
            </div>
            <div className="bg-[#EEF2E8] text-[#7E9162] text-[12px] font-bold px-3 py-1.5 rounded-full">
              Delivered
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className="bg-[#F4F2EC] text-[#5B6B6B] text-[13px] font-bold px-2 py-1 rounded-lg">M20</span>
            <span className="text-[#D8D6CD]">•</span>
            <span className="text-[14px] font-semibold text-[#2D3A3A]">6 m³</span>
            <span className="text-[#D8D6CD]">•</span>
            <span className="text-[14px] font-semibold text-[#2D3A3A]">₹ 27,600</span>
          </div>

          <div className="flex items-center justify-between border-t border-[#E4E2DB] pt-4 mt-2">
            <div className="text-[13px] text-[#7A8A8A] font-medium">Oct 10, 02:30 PM</div>
            <button className="flex items-center gap-1.5 text-[#C85A32] text-[13px] font-bold bg-[#FFF2EB] px-3 py-1.5 rounded-xl">
              <Download size={14} /> Receipt
            </button>
          </div>
        </div>

      </div>

      {/* Bottom Nav */}
      <div className="absolute bottom-0 w-full bg-white border-t border-[#E4E2DB] pb-6 pt-3 px-6 rounded-t-3xl shadow-[0_-8px_32px_rgba(67,74,66,0.04)] flex justify-between">
        <div className="nav-item">
          <Home size={22} strokeWidth={2.5} />
          <span>Home</span>
        </div>
        <div className="nav-item">
          <Compass size={22} strokeWidth={2.5} />
          <span>Nearby</span>
        </div>
        <div className="nav-item active">
          <FileText size={22} strokeWidth={2.5} fill="currentColor" className="text-[#FFF2EB] stroke-[#C85A32]" />
          <span>Orders</span>
        </div>
        <div className="nav-item">
          <User size={22} strokeWidth={2.5} />
          <span>Account</span>
        </div>
      </div>

    </div>
  );
}
