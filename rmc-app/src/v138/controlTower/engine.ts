export type Severity = 'danger' | 'warning' | 'info';
export type ControlTowerItem = {
  id: string;
  severity: Severity;
  title: string;
  detail?: string;
  route?: string;
  metric?: string;
  source: 'position' | 'order' | 'quality' | 'stock' | 'fuel';
};

export type PositionAlert = {
  id?: number|string; vehicleNo?: string; truckNo?: string; type?: string; alertType?: string;
  message?: string; minutes?: number; durationMin?: number; open?: boolean;
};
export type OrderLike = {
  id?: number|string; orderNo?: string; status?: string; grade?: string; clientName?: string;
  siteName?: string; promisedAt?: string; expectedAt?: string; scheduledAt?: string; createdAt?: string;
  qcMissing?: boolean; slump?: number|null; delayMinutes?: number;
};
export type StockLike = { name?: string; material?: string; availableQty?: number; unit?: string; hoursRemaining?: number };
export type FuelAlertLike = { id?: number|string; vehicleNo?: string; variancePct?: number; message?: string; open?: boolean };

const n=(v:unknown)=> typeof v==='number' && Number.isFinite(v) ? v : Number(v);
const slug=(v:unknown)=>String(v ?? '').toLowerCase().replace(/\s+/g,'_');

export function deriveControlTower(input:{
  positionAlerts?: PositionAlert[];
  orders?: OrderLike[];
  stock?: StockLike[];
  fuelAlerts?: FuelAlertLike[];
  now?: Date;
  limit?: number;
}):ControlTowerItem[] {
  const now=input.now ?? new Date();
  const items:ControlTowerItem[]=[];

  for (const a of input.positionAlerts ?? []) {
    if (a.open === false) continue;
    const minutes=n(a.durationMin ?? a.minutes);
    const typ=slug(a.alertType ?? a.type);
    const vehicle=a.vehicleNo ?? a.truckNo ?? 'Transit mixer';
    const severe=typ.includes('route') || typ.includes('sos') || minutes >= 30;
    items.push({
      id:`pos:${a.id ?? vehicle}:${typ}`,
      severity: severe ? 'danger' : 'warning',
      title: a.message || `${vehicle} needs attention`,
      detail: Number.isFinite(minutes) && minutes>0 ? `${minutes} min` : undefined,
      route:'/live-fleet-map', metric:Number.isFinite(minutes)&&minutes>0?`${minutes} min`:undefined, source:'position'
    });
  }

  for (const o of input.orders ?? []) {
    const status=slug(o.status);
    if (['delivered','completed','cancelled','rejected'].includes(status)) continue;
    let delay=n(o.delayMinutes);
    if (!Number.isFinite(delay)) {
      const due=o.promisedAt ?? o.expectedAt ?? o.scheduledAt;
      if (due) delay=Math.floor((now.getTime()-new Date(due).getTime())/60000);
    }
    const label=o.orderNo ? `Order ${o.orderNo}` : `Order #${o.id ?? ''}`.trim();
    if (Number.isFinite(delay) && delay >= 10) {
      items.push({
        id:`order-delay:${o.id ?? o.orderNo}`,
        severity:delay>=30?'danger':'warning',
        title:`${label} is ${delay} min late`,
        detail:[o.grade,o.siteName ?? o.clientName].filter(Boolean).join(' · '),
        route:'/orders', metric:`${delay} min`, source:'order'
      });
    }
    if (o.qcMissing || (status==='dispatched' && o.slump == null)) {
      items.push({
        id:`order-qc:${o.id ?? o.orderNo}`,
        severity:'warning', title:`QC value missing on ${label}`,
        detail:[o.grade,o.siteName].filter(Boolean).join(' · '), route:'/challans', metric:'QC', source:'quality'
      });
    }
  }

  for (const s of input.stock ?? []) {
    const hrs=n(s.hoursRemaining);
    if (Number.isFinite(hrs) && hrs <= 6) {
      items.push({
        id:`stock:${s.material ?? s.name}`, severity:hrs<=2?'danger':'warning',
        title:`${s.material ?? s.name ?? 'Material'} stock is running low`, detail:`Estimated ${hrs.toFixed(1)} hours remaining`,
        route:'/mix-design', metric:`${hrs.toFixed(1)} h`, source:'stock'
      });
    }
  }

  for (const f of input.fuelAlerts ?? []) {
    if (f.open===false) continue;
    const v=n(f.variancePct);
    if ((Number.isFinite(v) && Math.abs(v)>=8) || f.message) {
      items.push({
        id:`fuel:${f.id ?? f.vehicleNo}`, severity:Number.isFinite(v)&&Math.abs(v)>=15?'danger':'warning',
        title:f.message || `Diesel usage variance on ${f.vehicleNo ?? 'vehicle'}`,
        detail:Number.isFinite(v)?`${v>0?'+':''}${v.toFixed(1)}% vs expected`:undefined,
        route:'/fuel-log', metric:Number.isFinite(v)?`${v>0?'+':''}${v.toFixed(0)}%`:undefined, source:'fuel'
      });
    }
  }

  const weight:Record<Severity,number>={danger:0,warning:1,info:2};
  return items.sort((a,b)=>weight[a.severity]-weight[b.severity]).slice(0,input.limit ?? 5);
}
