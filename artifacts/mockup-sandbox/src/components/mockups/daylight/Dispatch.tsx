import React, { useState } from 'react';
import { LayoutDashboard, FileText, Truck, MapPin, Search, Bell, Clock, Calendar, Check, X, FileOutput, ChevronDown } from 'lucide-react';

export function Dispatch() {
  const [activeTab, setActiveTab] = useState<'orders' | 'dispatch'>('orders');

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

        /* Hide scrollbar */
        .daylight-scroll::-webkit-scrollbar {
          display: none;
        }
        .daylight-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .mini-stat {
          background: #FFFFFF;
          border-radius: 20px;
          padding: 12px 14px;
          border: 1px solid rgba(228, 226, 219, 0.6);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          flex: 1;
        }

        .mini-stat-value {
          font-size: 24px;
          font-weight: 700;
          color: #2D3A3A;
          line-height: 1.2;
        }

        .mini-stat-label {
          font-size: 12px;
          font-weight: 500;
          color: #7A8A8A;
        }
          
        .tab-btn {
          flex: 1;
          text-align: center;
          padding: 12px;
          font-size: 15px;
          font-weight: 600;
          color: #7A8A8A;
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease;
        }
        .tab-btn.active {
          color: #C85A32;
          border-bottom: 2px solid #C85A32;
        }

        .status-pill {
          padding: 4px 10px;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .status-pill.pending { background: #FFF9E5; color: #D48806; }
        .status-pill.approved { background: #EEF2E8; color: #6B7D54; }
        .status-pill.transit { background: #E5F6FD; color: #0284C7; }

        .btn-action {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 16px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
        }
        .btn-approve {
          background: #EEF2E8;
          color: #6B7D54;
        }
        .btn-approve:active { background: #E1E8D9; }
        .btn-reject {
          background: #FDF1F0;
          color: #C0574B;
        }
        .btn-reject:active { background: #FCE1DF; }
        .btn-primary {
          background: #C85A32;
          color: white;
        }
        .btn-primary:active { background: #B64D29; }
      `}</style>

      {/* App Bar */}
      <div className="absolute top-0 w-full z-10 bg-[#FDFBF7]/90 backdrop-blur-md pb-3 pt-12 px-5 border-b border-[#E4E2DB]/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-[#FFF2EB] rounded-full text-[#C85A32]">
              <Truck size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-[19px] font-bold text-[#2D3A3A] leading-tight">Dispatch</h1>
              <p className="text-[13px] font-medium text-[#7A8A8A]">Ambuja RMC — Whitefield</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm border border-[#E4E2DB] text-[#2D3A3A]">
              <Search size={18} strokeWidth={2.5} />
            </button>
            <button className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm border border-[#E4E2DB] text-[#2D3A3A] relative">
              <Bell size={18} strokeWidth={2.5} />
              <span className="absolute top-2 right-2.5 w-2 h-2 bg-[#C85A32] rounded-full border border-white"></span>
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="daylight-scroll w-full h-full overflow-y-auto pt-[100px] pb-[100px]">
        
        {/* Stats Strip */}
        <div className="flex gap-3 px-5 py-4">
          <div className="mini-stat shadow-sm">
            <div className="mini-stat-value">6</div>
            <div className="mini-stat-label">Pending Orders</div>
          </div>
          <div className="mini-stat shadow-sm">
            <div className="mini-stat-value">4</div>
            <div className="mini-stat-label">In Transit</div>
          </div>
          <div className="mini-stat shadow-sm">
            <div className="mini-stat-value">18</div>
            <div className="mini-stat-label">Delivered Today</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-5 mb-4">
          <div className="flex w-full bg-white rounded-2xl shadow-sm border border-[#E4E2DB] p-1 overflow-hidden">
            <button 
              className={`tab-btn rounded-xl ${activeTab === 'orders' ? 'bg-[#F4F2EC] text-[#2D3A3A]' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              Orders (6)
            </button>
            <button 
              className={`tab-btn rounded-xl ${activeTab === 'dispatch' ? 'bg-[#F4F2EC] text-[#2D3A3A]' : ''}`}
              onClick={() => setActiveTab('dispatch')}
            >
              Dispatch (4)
            </button>
          </div>
        </div>

        <div className="px-5">
          {activeTab === 'orders' && (
            <div className="flex flex-col gap-4">
              {/* Order Card 1 */}
              <div className="daylight-card mb-0 p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-[12px] font-bold text-[#7A8A8A] mb-1">ORD-8902</div>
                    <h3 className="text-[16px] font-bold text-[#2D3A3A]">Prestige Lakeside</h3>
                  </div>
                  <span className="status-pill pending">Pending</span>
                </div>
                
                <div className="flex gap-4 mb-4">
                  <div className="flex flex-col">
                    <span className="text-[12px] font-medium text-[#7A8A8A]">Grade & Qty</span>
                    <span className="text-[14px] font-bold text-[#2D3A3A]">M25 • 24 m³</span>
                  </div>
                  <div className="w-[1px] bg-[#E4E2DB]"></div>
                  <div className="flex flex-col">
                    <span className="text-[12px] font-medium text-[#7A8A8A]">Requested Slot</span>
                    <span className="text-[14px] font-bold text-[#2D3A3A]">Today, 10:30 AM</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button className="flex-1 btn-action btn-reject">
                    <X size={16} strokeWidth={2.5} /> Reject
                  </button>
                  <button className="flex-1 btn-action btn-approve">
                    <Check size={16} strokeWidth={2.5} /> Approve
                  </button>
                </div>
              </div>

              {/* Order Card 2 */}
              <div className="daylight-card mb-0 p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-[12px] font-bold text-[#7A8A8A] mb-1">ORD-8901</div>
                    <h3 className="text-[16px] font-bold text-[#2D3A3A]">L&T Tech Park</h3>
                  </div>
                  <span className="status-pill approved">Approved</span>
                </div>
                
                <div className="flex gap-4 mb-4">
                  <div className="flex flex-col">
                    <span className="text-[12px] font-medium text-[#7A8A8A]">Grade & Qty</span>
                    <span className="text-[14px] font-bold text-[#2D3A3A]">M30 • 50 m³</span>
                  </div>
                  <div className="w-[1px] bg-[#E4E2DB]"></div>
                  <div className="flex flex-col">
                    <span className="text-[12px] font-medium text-[#7A8A8A]">Requested Slot</span>
                    <span className="text-[14px] font-bold text-[#2D3A3A]">Today, 11:00 AM</span>
                  </div>
                </div>

                <button className="w-full btn-action bg-[#F4F2EC] text-[#2D3A3A] hover:bg-[#E8EBE4]">
                  <FileOutput size={16} strokeWidth={2.5} /> Generate Challan
                </button>
              </div>
            </div>
          )}

          {activeTab === 'dispatch' && (
            <div className="flex flex-col gap-4">
              {/* Dispatch Card 1 */}
              <div className="daylight-card mb-0 p-4 border-[#A3B18A]/30">
                <div className="flex justify-between items-start mb-4 pb-3 border-b border-[#E4E2DB]/50">
                  <div>
                    <div className="text-[13px] font-bold text-[#A3B18A] mb-0.5">CH-4055</div>
                    <h3 className="text-[16px] font-bold text-[#2D3A3A]">Brigade Orchards</h3>
                  </div>
                  <span className="status-pill transit">In Transit</span>
                </div>
                
                <div className="grid grid-cols-2 gap-y-4 gap-x-2 mb-5">
                  <div>
                    <div className="text-[12px] font-medium text-[#7A8A8A] mb-1">Mix & Quantity</div>
                    <div className="text-[14px] font-bold text-[#2D3A3A]">M35 • 8 m³</div>
                  </div>
                  <div>
                    <div className="text-[12px] font-medium text-[#7A8A8A] mb-1">Dispatch Time</div>
                    <div className="text-[14px] font-bold text-[#2D3A3A]">09:15 AM</div>
                  </div>
                  <div>
                    <div className="text-[12px] font-medium text-[#7A8A8A] mb-1">Vehicle</div>
                    <div className="flex items-center gap-1.5 text-[14px] font-bold text-[#2D3A3A]">
                      <Truck size={14} className="text-[#A3B18A]" /> KA-01-AB-1234
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] font-medium text-[#7A8A8A] mb-1">Driver</div>
                    <div className="text-[14px] font-bold text-[#2D3A3A]">Ramesh Kumar</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className="flex-1 btn-action bg-[#F4F2EC] text-[#2D3A3A]">
                    <MapPin size={16} /> Track
                  </button>
                  <button className="flex-1 btn-action btn-approve">
                    <Check size={16} strokeWidth={2.5} /> Mark Delivered
                  </button>
                </div>
              </div>

              {/* Ready to Dispatch Card */}
              <div className="daylight-card mb-0 p-4">
                <div className="flex justify-between items-start mb-4 pb-3 border-b border-[#E4E2DB]/50">
                  <div>
                    <div className="text-[13px] font-bold text-[#C85A32] mb-0.5">Draft Challan</div>
                    <h3 className="text-[16px] font-bold text-[#2D3A3A]">L&T Tech Park</h3>
                  </div>
                  <span className="status-pill bg-[#F4F2EC] text-[#7A8A8A]">Loading</span>
                </div>
                
                <div className="grid grid-cols-2 gap-y-4 gap-x-2 mb-5">
                  <div>
                    <div className="text-[12px] font-medium text-[#7A8A8A] mb-1">Mix & Quantity</div>
                    <div className="text-[14px] font-bold text-[#2D3A3A]">M30 • 8 m³</div>
                  </div>
                  
                  <div className="col-span-2">
                    <div className="text-[12px] font-medium text-[#7A8A8A] mb-1">Assign Vehicle</div>
                    <div className="relative">
                      <select className="w-full appearance-none bg-[#F4F2EC] border border-transparent focus:border-[#A3B18A] rounded-xl px-3 py-2.5 text-[14px] font-bold text-[#2D3A3A] outline-none">
                        <option>KA-03-MK-9988</option>
                        <option>KA-51-AB-1234</option>
                        <option>KA-04-XY-5678</option>
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A8A8A] pointer-events-none" />
                    </div>
                  </div>
                </div>

                <button className="w-full btn-action btn-primary">
                  <Truck size={16} strokeWidth={2.5} /> Mark Dispatched
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Sticky Nav */}
      <div className="absolute bottom-0 w-full bg-white border-t border-[#E4E2DB] pb-6 pt-3 px-6 shadow-[0_-8px_32px_rgba(67,74,66,0.04)] rounded-t-3xl flex justify-between items-center">
        <div className="flex flex-col items-center gap-1 text-[#9AA6A6]">
          <LayoutDashboard size={22} />
          <span className="text-[10px] font-semibold">Home</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-[#9AA6A6]">
          <FileText size={22} />
          <span className="text-[10px] font-semibold">Orders</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-[#C85A32]">
          <div className="bg-[#FFF2EB] p-1.5 rounded-xl mb-[-4px]">
            <Truck size={22} strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-bold">Dispatch</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-[#9AA6A6]">
          <MapPin size={22} />
          <span className="text-[10px] font-semibold">Fleet</span>
        </div>
      </div>

    </div>
  );
}
