export type OrderStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled';
export type DispatchStatus = 'dispatched' | 'delivered';
export type VehicleStatus = 'active' | 'inactive' | 'maintenance';

export interface Client {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  gst: string;
  createdAt: string;
}

export interface Order {
  id: string;
  clientId: string;
  clientName: string;
  site: string;
  grade: string;
  qty: number;
  dispatchedQty: number;
  status: OrderStatus;
  date: string;
  notes: string;
  createdAt: string;
}

export interface Challan {
  id: string;
  challanNo: string;
  orderId: string;
  date: string;
  clientName: string;
  site: string;
  grade: string;
  qty: number;
  vehicleId: string;
  vehicleNo: string;
  driver: string;
  status: DispatchStatus;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  vehicleNo: string;
  driver: string;
  driverPhone: string;
  capacity: number;
  status: VehicleStatus;
  createdAt: string;
}

export interface MixDesign {
  id: string;
  grade: string;
  cement: number;
  water: number;
  sand: number;
  aggregate: number;
  admixture: number;
  wCRatio: number;
  notes: string;
  createdAt: string;
}

export interface BatchRecord {
  id: string;
  date: string;
  batchNo: string;
  grade: string;
  qty: number;
  orderId: string;
  clientName: string;
  operatorName: string;
  notes: string;
  createdAt: string;
}
