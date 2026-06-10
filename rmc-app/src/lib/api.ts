const BASE = '/api';

function getToken() {
  return localStorage.getItem('rmc_token') || '';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('rmc_token');
    localStorage.removeItem('rmc_user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export type User = {
  id: number; name: string; email: string; role: string;
  linkedClientId?: number | null;
  linkedDriverId?: number | null;
};

export interface Client {
  id: number; name: string; contactPerson: string; phone: string;
  email?: string; gstNo?: string; address?: string; city?: string;
  creditLimit: string; outstandingAmount: string; createdAt: string;
}

export interface Site {
  id: number; clientId: number; name: string; address?: string; city?: string; createdAt: string;
}

export interface Order {
  id: number; orderNo: string; clientId: number; siteId?: number;
  grade: string; quantity: string; pumpRequired: boolean;
  deliveryDate?: string; deliveryTime?: string; notes?: string;
  status: string; createdAt: string;
  clientName?: string; siteName?: string;
}

export interface Challan {
  id: number; challanNo: string; orderId?: number;
  clientId: number; siteId?: number; vehicleId?: number; driverId?: number;
  grade: string; quantity: string; pumpRequired: boolean;
  dispatchTime?: string; deliveryTime?: string;
  status: string; notes?: string; createdAt: string;
  clientName?: string; siteName?: string;
  vehicleNo?: string; driverName?: string; driverPhone?: string;
}

export interface Vehicle {
  id: number; vehicleNo: string; type: string; capacity: string;
  driverId?: number; insuranceExpiry?: string; lastService?: string;
  status: string; createdAt: string;
  driverName?: string; driverPhone?: string;
}

export interface Driver {
  id: number; name: string; phone: string;
  licenseNo?: string; licenseExpiry?: string; isActive: boolean; createdAt: string;
}

export interface BatchRecord {
  id: number; batchNo: string; grade: string; quantity: string;
  cementBags?: number; waterLiters?: number; sandKg?: number; aggregateKg?: number;
  operator?: string; remarks?: string; createdAt: string;
}

export interface LedgerEntry {
  id: number; clientId: number; type: string; amount: string;
  description: string; referenceNo?: string; createdAt: string;
  runningBalance?: number;
}

export interface DashboardKPIs {
  todayProduction: number; todayBatches: number;
  todayDispatch: number; todayChallans: number;
  activeOrders: number; pendingOrders: number; inProgressOrders: number;
  totalVehicles: number; activeVehicles: number; maintenanceVehicles: number;
  outstandingAmount: number; totalClients: number;
}
