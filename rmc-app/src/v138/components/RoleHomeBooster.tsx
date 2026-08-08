import {useMemo} from 'react';
import {deriveControlTower, type FuelAlertLike, type OrderLike, type PositionAlert, type StockLike} from '../controlTower/engine';
import {ControlTowerStrip} from './ControlTowerStrip';
import {AiQuickAccess} from './AiQuickAccess';

export type RoleHomeBoosterProps = {
  role?: string;
  positionAlerts?: PositionAlert[];
  orders?: OrderLike[];
  stock?: StockLike[];
  fuelAlerts?: FuelAlertLike[];
  onNavigate?: (route:string)=>void;
  maxAlerts?: number;
  showAi?: boolean;
};

/**
 * Additive v1.38 layer for the existing RoleHome screen.
 * It contains no authentication or network calls. Feed it data already loaded
 * by TrackMyRMC's existing authorized API/query layer.
 */
export function RoleHomeBooster({
  role, positionAlerts, orders, stock, fuelAlerts,
  onNavigate, maxAlerts=4, showAi=true,
}:RoleHomeBoosterProps){
  const items=useMemo(()=>deriveControlTower({
    positionAlerts,orders,stock,fuelAlerts,limit:maxAlerts,
  }),[positionAlerts,orders,stock,fuelAlerts,maxAlerts]);

  return <>
    <ControlTowerStrip items={items} onNavigate={onNavigate}/>
    {showAi && <AiQuickAccess role={role}/>}
  </>;
}
