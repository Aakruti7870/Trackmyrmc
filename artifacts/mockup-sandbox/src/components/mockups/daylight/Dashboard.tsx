import React, { useState } from 'react';
import { Home, ClipboardList, Map as MapIcon, Truck, BarChart3, TrendingUp, TrendingDown, DollarSign, Package, Activity, ArrowUpRight, CheckCircle2 } from 'lucide-react';

export function Dashboard() {
  const [dateRange, setDateRange] = useState('7d');

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
          padding: 6px 14px;
          font-weight: 500;
          font-size: 13px;
          transition: all 0.2s ease;
          border: 2px solid transparent;
        }
        
        .daylight-chip.active {
          background: #FFF2EB;
          color: #C85A32;
          border: 2px solid #E8825A;
        }

        /* Hide scrollbar */
        .daylight-scroll::-webkit-scrollbar {
          display: none;
        }
        .daylight-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .bar-chart-container {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          height: 120px;
          margin-top: 20px;
          padding-top: 10px;
          border-bottom: 2px solid #EEF2E8;
        }
        
        .bar-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        .bar {
          width: 100%;
          background: #C85A32;
          border-radius: 6px 6px 0 0;
          min-height: 4px;
          transition: height 0.3s ease;
        }

        .bar-label {
          font-size: 11px;
          color: #9AA6A6;
          font-weight: 500;
        }
          
        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          color: #9AA6A6;
          text-decoration: none;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
        }
        .nav-item.active {
          color: #C85A32;
        }
        .nav-label {
          font-size: 11px;
          font-weight: 600;
        }
      `}</style>

      {/* App Bar */}
      <div className="absolute top-0 w-full z-10 bg-[#FDFBF7]/90 backdrop-blur-md pb-4 pt-12 px-5 border-b border-[#E4E2DB]/50">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-[22px] font-bold text-[#2D3A3A] flex items-center gap-2">
            Dashboard
          </h1>
          <div className="w-10 h-10 rounded-full bg-[#EEF2E8] flex items-center justify-center text-[#A3B18A]">
            <Activity size={20} />
          </div>
        </div>
        <div className="flex gap-2">
          {['Today', '7d', '30d'].map(range => (
            <button 
              key={range}
              onClick={() => setDateRange(range)}
              className={`daylight-chip ${dateRange === range ? 'active' : ''}`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="daylight-scroll w-full h-full overflow-y-auto pt-[130px] pb-[100px] px-5">
        
        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="daylight-card !p-4 !mb-0">
            <div className="flex justify-between items-start mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFF2EB] text-[#C85A32] flex items-center justify-center">
                <BarChart3 size={20} />
              </div>
              <div className="flex items-center gap-1 text-[12px] font-bold text-[#A3B18A] bg-[#EEF2E8] px-2 py-0.5 rounded-md">
                <TrendingUp size={12} /> 12%
              </div>
            </div>
            <div className="text-[13px] font-medium text-[#7A8A8A] mb-1">Volume Dispatched</div>
            <div className="text-[22px] font-bold text-[#2D3A3A]">342 <span className="text-[14px] text-[#9AA6A6]">m³</span></div>
          </div>
          
          <div className="daylight-card !p-4 !mb-0">
            <div className="flex justify-between items-start mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#EEF2E8] text-[#A3B18A] flex items-center justify-center">
                <Package size={20} />
              </div>
              <div className="flex items-center gap-1 text-[12px] font-bold text-[#A3B18A] bg-[#EEF2E8] px-2 py-0.5 rounded-md">
                <TrendingUp size={12} /> 8%
              </div>
            </div>
            <div className="text-[13px] font-medium text-[#7A8A8A] mb-1">Orders</div>
            <div className="text-[22px] font-bold text-[#2D3A3A]">58</div>
          </div>

          <div className="daylight-card !p-4 !mb-0">
            <div className="flex justify-between items-start mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#F4F2EC] text-[#5B6B6B] flex items-center justify-center">
                <DollarSign size={20} />
              </div>
              <div className="flex items-center gap-1 text-[12px] font-bold text-[#C0574B] bg-[#FCE8E6] px-2 py-0.5 rounded-md">
                <TrendingDown size={12} /> 3%
              </div>
            </div>
            <div className="text-[13px] font-medium text-[#7A8A8A] mb-1">Revenue</div>
            <div className="text-[22px] font-bold text-[#2D3A3A]">₹ 16.4L</div>
          </div>

          <div className="daylight-card !p-4 !mb-0">
            <div className="flex justify-between items-start mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#EEF2E8] text-[#A3B18A] flex items-center justify-center">
                <Truck size={20} />
              </div>
              <div className="flex items-center gap-1 text-[12px] font-bold text-[#9AA6A6] bg-[#F4F2EC] px-2 py-0.5 rounded-md">
                <CheckCircle2 size={12} /> Active
              </div>
            </div>
            <div className="text-[13px] font-medium text-[#7A8A8A] mb-1">Active Trucks</div>
            <div className="text-[22px] font-bold text-[#2D3A3A]">7<span className="text-[14px] text-[#9AA6A6]">/10</span></div>
          </div>
        </div>

        {/* Dispatch Trend */}
        <div className="daylight-card">
          <div className="flex justify-between items-center">
            <h3 className="daylight-title !mb-0">Daily Dispatch</h3>
            <span className="text-[13px] font-medium text-[#A3B18A]">m³</span>
          </div>
          
          <div className="bar-chart-container">
            {[45, 60, 35, 70, 85, 40, 55].map((val, i) => (
              <div className="bar-wrapper" key={i}>
                <div className="bar" style={{ height: `${val}%`, opacity: i === 6 ? 1 : 0.6 }}></div>
                <div className="bar-label">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Grade Breakdown */}
        <div className="daylight-card">
          <h3 className="daylight-title">Grade Breakdown</h3>
          <div className="space-y-4">
            {[
              { grade: 'M25', vol: 145, pct: 42, color: '#C85A32', bg: '#FFF2EB' },
              { grade: 'M30', vol: 98, pct: 28, color: '#A3B18A', bg: '#EEF2E8' },
              { grade: 'M20', vol: 65, pct: 19, color: '#E0A75F', bg: '#FDF1E1' },
              { grade: 'M35', vol: 34, pct: 11, color: '#7A8A8A', bg: '#F4F2EC' },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex justify-between items-end mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-[#2D3A3A]">{item.grade}</span>
                    <span className="text-[12px] font-medium text-[#7A8A8A]">{item.vol} m³</span>
                  </div>
                  <span className="text-[13px] font-bold text-[#2D3A3A]">{item.pct}%</span>
                </div>
                <div className="w-full h-2.5 bg-[#F4F2EC] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.color }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Clients */}
        <div className="daylight-card mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="daylight-title !mb-0">Top Clients</h3>
            <button className="text-[#C85A32] text-[13px] font-bold flex items-center gap-1">
              View All <ArrowUpRight size={14} />
            </button>
          </div>
          
          <div className="space-y-4">
            {[
              { name: 'Prestige Group', vol: 180, pct: 85 },
              { name: 'Sobha Developers', vol: 95, pct: 45 },
              { name: 'Brigade Enterprises', vol: 67, pct: 30 },
            ].map((client, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#F4F2EC] flex items-center justify-center text-[12px] font-bold text-[#7A8A8A]">
                  #{i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-[14px] font-semibold text-[#2D3A3A]">{client.name}</span>
                    <span className="text-[13px] font-bold text-[#C85A32]">{client.vol} m³</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#EEF2E8] rounded-full overflow-hidden">
                    <div className="h-full bg-[#A3B18A] rounded-full" style={{ width: `${client.pct}%` }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Bottom Nav */}
      <div className="absolute bottom-0 w-full bg-white border-t border-[#E4E2DB] pb-safe pt-2 px-6 flex justify-between items-center shadow-[0_-8px_32px_rgba(67,74,66,0.04)] z-20 h-[80px]">
        <button className="nav-item active">
          <Home size={22} strokeWidth={2.5} />
          <span className="nav-label">Dashboard</span>
        </button>
        <button className="nav-item">
          <ClipboardList size={22} strokeWidth={2.5} />
          <span className="nav-label">Orders</span>
        </button>
        <button className="nav-item">
          <MapIcon size={22} strokeWidth={2.5} />
          <span className="nav-label">Dispatch</span>
        </button>
        <button className="nav-item">
          <Truck size={22} strokeWidth={2.5} />
          <span className="nav-label">Fleet</span>
        </button>
      </div>

    </div>
  );
}
