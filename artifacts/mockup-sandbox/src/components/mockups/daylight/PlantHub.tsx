import React, { useState } from 'react';
import { 
  ChevronLeft, LayoutDashboard, ShoppingCart, Truck, Activity, 
  MapPin, Star, Beaker, FileText, Users, Search, 
  Droplet, Layers, Construction, Calculator, ShieldCheck,
  ChevronRight
} from 'lucide-react';

export function PlantHub() {
  const [activeTab, setActiveTab] = useState('Mix Design');
  const [grade, setGrade] = useState('M25');
  const [activeNav, setActiveNav] = useState('Fleet');
  
  const tabs = ['Clients', 'Fleet', 'Mix Design', 'Batches'];
  const grades = ['M10', 'M15', 'M20', 'M25', 'M30', 'M35'];

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

        .tab-button {
          padding: 8px 0;
          font-weight: 600;
          font-size: 15px;
          color: #9AA6A6;
          position: relative;
          transition: color 0.2s;
        }
        .tab-button.active {
          color: #2D3A3A;
        }
        .tab-button.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 3px;
          background: #C85A32;
          border-radius: 3px 3px 0 0;
        }
        
        .progress-track {
          width: 100%;
          height: 10px;
          background: #F4F2EC;
          border-radius: 10px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          border-radius: 10px;
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
      <div className="absolute top-0 w-full z-10 bg-[#FDFBF7]/90 backdrop-blur-md pb-0 pt-12 flex flex-col border-b border-[#E4E2DB]">
        <div className="px-5 flex items-center justify-between mb-4">
          <button className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm border border-[#E4E2DB] text-[#2D3A3A]">
            <ChevronLeft size={22} strokeWidth={2.5} />
          </button>
          <h1 className="text-[19px] font-semibold text-[#2D3A3A]">Plant Data</h1>
          <button className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm border border-[#E4E2DB] text-[#2D3A3A]">
            <Search size={18} strokeWidth={2.5} />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex px-5 gap-6 overflow-x-auto daylight-scroll">
          {tabs.map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`tab-button whitespace-nowrap ${activeTab === tab ? 'active' : ''}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="daylight-scroll w-full h-full overflow-y-auto pt-[140px] pb-[100px] px-5">
        
        {/* Concrete Grade */}
        <div className="daylight-card">
          <h3 className="daylight-title">Select Grade</h3>
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

        {/* Mix Design Proportions */}
        <div className="daylight-card">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-[17px] font-semibold text-[#2D3A3A] m-0 flex items-center gap-2">
                <Beaker size={18} className="text-[#A3B18A]" />
                {grade} Proportions
              </h3>
              <p className="text-[13px] text-[#7A8A8A] mt-1 font-medium">Standard recipe per m³</p>
            </div>
            <div className="bg-[#EEF2E8] text-[#6B7D54] px-3 py-1.5 rounded-xl font-bold text-[13px] border border-[#A3B18A]/20">
              W/C: 0.45
            </div>
          </div>
          
          <div className="space-y-5">
            {/* Cement */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <div className="flex items-center gap-2 text-[14px] font-semibold text-[#2D3A3A]">
                  <div className="w-6 h-6 rounded-md bg-[#F4F2EC] flex items-center justify-center text-[#7A8A8A]">
                    <Layers size={12} />
                  </div>
                  Cement
                </div>
                <div className="text-[14px] font-bold text-[#2D3A3A]">320 <span className="text-[#7A8A8A] font-medium text-[12px]">kg</span></div>
              </div>
              <div className="progress-track">
                <div className="progress-fill bg-[#7A8A8A]" style={{ width: '35%' }}></div>
              </div>
            </div>

            {/* Water */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <div className="flex items-center gap-2 text-[14px] font-semibold text-[#2D3A3A]">
                  <div className="w-6 h-6 rounded-md bg-[#EEF2E8] flex items-center justify-center text-[#A3B18A]">
                    <Droplet size={12} />
                  </div>
                  Water
                </div>
                <div className="text-[14px] font-bold text-[#2D3A3A]">145 <span className="text-[#7A8A8A] font-medium text-[12px]">kg</span></div>
              </div>
              <div className="progress-track">
                <div className="progress-fill bg-[#A3B18A]" style={{ width: '15%' }}></div>
              </div>
            </div>

            {/* Sand */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <div className="flex items-center gap-2 text-[14px] font-semibold text-[#2D3A3A]">
                  <div className="w-6 h-6 rounded-md bg-[#FFF2EB] flex items-center justify-center text-[#E0A75F]">
                    <MapPin size={12} />
                  </div>
                  Sand
                </div>
                <div className="text-[14px] font-bold text-[#2D3A3A]">780 <span className="text-[#7A8A8A] font-medium text-[12px]">kg</span></div>
              </div>
              <div className="progress-track">
                <div className="progress-fill bg-[#E0A75F]" style={{ width: '75%' }}></div>
              </div>
            </div>

            {/* Aggregate */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <div className="flex items-center gap-2 text-[14px] font-semibold text-[#2D3A3A]">
                  <div className="w-6 h-6 rounded-md bg-[#F4F2EC] flex items-center justify-center text-[#5B6B6B]">
                    <Construction size={12} />
                  </div>
                  Aggregate (20mm)
                </div>
                <div className="text-[14px] font-bold text-[#2D3A3A]">1150 <span className="text-[#7A8A8A] font-medium text-[12px]">kg</span></div>
              </div>
              <div className="progress-track">
                <div className="progress-fill bg-[#5B6B6B]" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-8 mb-4">
          <h2 className="text-[18px] font-bold text-[#2D3A3A]">Recent Activity</h2>
          <span className="text-[#C85A32] text-[13px] font-semibold">View All</span>
        </div>

        {/* Compact Previews */}
        
        {/* Batch Preview */}
        <div className="daylight-card p-4">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <div className="bg-[#FFF2EB] text-[#C85A32] text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide">
                Batch Log
              </div>
              <span className="text-[#7A8A8A] text-[12px] font-medium">10 mins ago</span>
            </div>
            <span className="text-[#A3B18A] text-[12px] font-bold">#BT-4921</span>
          </div>
          
          <div className="flex justify-between items-center">
            <div>
              <div className="font-semibold text-[#2D3A3A] text-[15px]">M25 • 8.5 m³</div>
              <div className="text-[#7A8A8A] text-[13px] font-medium flex items-center gap-1 mt-1">
                <ShieldCheck size={12} /> Opr: Ramesh K.
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#F4F2EC] flex items-center justify-center text-[#2D3A3A]">
              <ChevronRight size={16} />
            </div>
          </div>
        </div>

        {/* Fleet Preview */}
        <div className="daylight-card p-4">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <div className="bg-[#EEF2E8] text-[#6B7D54] text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide">
                Fleet Status
              </div>
            </div>
            <span className="bg-[#A3B18A] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              Available
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F4F2EC] flex items-center justify-center text-[#5B6B6B]">
                <Truck size={18} />
              </div>
              <div>
                <div className="font-bold text-[#2D3A3A] text-[15px]">KA-01-AB-1234</div>
                <div className="text-[#7A8A8A] text-[13px] font-medium mt-0.5">Driver: Sunil D.</div>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#F4F2EC] flex items-center justify-center text-[#2D3A3A]">
              <ChevronRight size={16} />
            </div>
          </div>
        </div>

        {/* Client Preview */}
        <div className="daylight-card p-4">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <div className="bg-[#F4F2EC] text-[#5B6B6B] text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide">
                Client Profile
              </div>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFF2EB] flex items-center justify-center text-[#C85A32] font-bold">
                UT
              </div>
              <div>
                <div className="font-bold text-[#2D3A3A] text-[15px]">UltraTech Const.</div>
                <div className="text-[#7A8A8A] text-[13px] font-medium mt-0.5">GST: 29ABCDE1234F1Z5</div>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#F4F2EC] flex items-center justify-center text-[#2D3A3A]">
              <ChevronRight size={16} />
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Navigation */}
      <div className="absolute bottom-0 w-full bg-white border-t border-[#E4E2DB] pb-6 pt-3 px-6 rounded-t-3xl shadow-[0_-8px_32px_rgba(67,74,66,0.04)]">
        <div className="flex justify-between items-center">
          {[
            { id: 'Dashboard', icon: LayoutDashboard },
            { id: 'Orders', icon: ShoppingCart },
            { id: 'Dispatch', icon: Activity },
            { id: 'Fleet', icon: Truck },
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className="flex flex-col items-center gap-1.5 relative"
            >
              {item.id === activeNav && (
                <div className="absolute -top-3 w-8 h-1 bg-[#C85A32] rounded-b-full"></div>
              )}
              <item.icon 
                size={22} 
                className={item.id === activeNav ? 'text-[#C85A32]' : 'text-[#9AA6A6]'} 
                strokeWidth={item.id === activeNav ? 2.5 : 2}
              />
              <span className={`text-[11px] font-semibold ${item.id === activeNav ? 'text-[#C85A32]' : 'text-[#9AA6A6]'}`}>
                {item.id}
              </span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
