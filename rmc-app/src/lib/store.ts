import type { Client, Order, Challan, Vehicle, MixDesign, BatchRecord } from './types';

const KEYS = {
  clients: 'rmc_clients',
  orders: 'rmc_orders',
  challans: 'rmc_challans',
  vehicles: 'rmc_vehicles',
  mixDesigns: 'rmc_mix_designs',
  batchRecords: 'rmc_batch_records',
  challanSeq: 'rmc_challan_seq',
};

function load<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function save<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function nextChallan(): string {
  const seq = parseInt(localStorage.getItem(KEYS.challanSeq) || '1534', 10) + 1;
  localStorage.setItem(KEYS.challanSeq, seq.toString());
  return seq.toString();
}

function seed() {
  if (localStorage.getItem('rmc_seeded')) return;

  const clients: Client[] = [
    { id: 'c1', name: 'Nexus Infra Pvt Ltd', contactPerson: 'Amit Sharma', phone: '9820001234', email: 'amit@nexusinfra.com', address: 'Panvel, Navi Mumbai', gst: '27AABCN1234F1Z5', createdAt: '2026-01-10' },
    { id: 'c2', name: 'Skyline Developers', contactPerson: 'Priya Mehta', phone: '9821005678', email: 'priya@skylinedev.in', address: 'Kharghar, Navi Mumbai', gst: '27AADCS5678G1Z2', createdAt: '2026-01-15' },
    { id: 'c3', name: 'Marvel Realty', contactPerson: 'Rakesh Joshi', phone: '9833009012', email: 'rakesh@marvelrealty.com', address: 'Taloja, Navi Mumbai', gst: '27AABCM9012H1Z8', createdAt: '2026-02-01' },
    { id: 'c4', name: 'Hiranandani Constructions', contactPerson: 'Sneha Kulkarni', phone: '9845003456', email: 'sneha@hiranandani.in', address: 'Powai, Mumbai', gst: '27AAACH3456J1Z4', createdAt: '2026-02-20' },
    { id: 'c5', name: 'Lodha Group', contactPerson: 'Vikram Patil', phone: '9867007890', email: 'vikram@lodha.com', address: 'Thane, Mumbai', gst: '27AABCL7890K1Z1', createdAt: '2026-03-05' },
  ];

  const vehicles: Vehicle[] = [
    { id: 'v1', vehicleNo: 'MH 46 CU 0813', driver: 'Ramesh Patil', driverPhone: '9876543210', capacity: 7, status: 'active', createdAt: '2026-01-01' },
    { id: 'v2', vehicleNo: 'MH 46 CU 0914', driver: 'Suresh Yadav', driverPhone: '9823456789', capacity: 7, status: 'active', createdAt: '2026-01-01' },
    { id: 'v3', vehicleNo: 'MH 04 AB 1234', driver: 'Mahesh Thakur', driverPhone: '9834567890', capacity: 6, status: 'active', createdAt: '2026-01-01' },
    { id: 'v4', vehicleNo: 'MH 04 CD 5678', driver: 'Dinesh Sawant', driverPhone: '9845678901', capacity: 7, status: 'maintenance', createdAt: '2026-01-01' },
    { id: 'v5', vehicleNo: 'MH 46 CU 1122', driver: 'Ganesh More', driverPhone: '9856789012', capacity: 6, status: 'active', createdAt: '2026-02-15' },
  ];

  const mixDesigns: MixDesign[] = [
    { id: 'm1', grade: 'M-20', cement: 320, water: 160, sand: 780, aggregate: 1090, admixture: 1.2, wCRatio: 0.50, notes: 'Standard residential slab mix', createdAt: '2026-01-05' },
    { id: 'm2', grade: 'M-25', cement: 360, water: 158, sand: 760, aggregate: 1060, admixture: 1.5, wCRatio: 0.44, notes: 'General structural use', createdAt: '2026-01-05' },
    { id: 'm3', grade: 'M-30', cement: 400, water: 155, sand: 740, aggregate: 1040, admixture: 1.8, wCRatio: 0.39, notes: 'High-rise column mix', createdAt: '2026-01-05' },
    { id: 'm4', grade: 'M-35', cement: 440, water: 150, sand: 720, aggregate: 1020, admixture: 2.0, wCRatio: 0.34, notes: 'Heavy-duty structural elements', createdAt: '2026-02-01' },
    { id: 'm5', grade: 'M-40', cement: 480, water: 145, sand: 700, aggregate: 1000, admixture: 2.4, wCRatio: 0.30, notes: 'Bridge deck and prestressed elements', createdAt: '2026-02-01' },
  ];

  const today = new Date().toISOString().slice(0, 10);
  const orders: Order[] = [
    { id: 'o1', clientId: 'c1', clientName: 'Nexus Infra Pvt Ltd', site: 'Panvel Tower Site', grade: 'M-25', qty: 36, dispatchedQty: 30, status: 'in-progress', date: '2026-06-01', notes: 'High rise floor slab', createdAt: '2026-06-01' },
    { id: 'o2', clientId: 'c2', clientName: 'Skyline Developers', site: 'Kharghar Residency', grade: 'M-30', qty: 50, dispatchedQty: 50, status: 'completed', date: '2026-05-28', notes: 'Basement raft foundation', createdAt: '2026-05-28' },
    { id: 'o3', clientId: 'c3', clientName: 'Marvel Realty', site: 'Taloja Phase 2', grade: 'M-20', qty: 20, dispatchedQty: 0, status: 'pending', date: today, notes: 'Plinth beam', createdAt: today },
    { id: 'o4', clientId: 'c4', clientName: 'Hiranandani Constructions', site: 'Powai Lake View', grade: 'M-35', qty: 60, dispatchedQty: 0, status: 'pending', date: today, notes: 'Transfer slab', createdAt: today },
    { id: 'o5', clientId: 'c5', clientName: 'Lodha Group', site: 'Thane Central Tower', grade: 'M-40', qty: 80, dispatchedQty: 14, status: 'in-progress', date: '2026-06-08', notes: 'Core wall pour', createdAt: '2026-06-08' },
    { id: 'o6', clientId: 'c1', clientName: 'Nexus Infra Pvt Ltd', site: 'Uran Road Project', grade: 'M-25', qty: 30, dispatchedQty: 0, status: 'pending', date: today, notes: '', createdAt: today },
    { id: 'o7', clientId: 'c2', clientName: 'Skyline Developers', site: 'Sector 5 Towers', grade: 'M-30', qty: 45, dispatchedQty: 45, status: 'completed', date: '2026-06-05', notes: '', createdAt: '2026-06-05' },
  ];

  const challans: Challan[] = [
    { id: 'ch1', challanNo: '1527', orderId: 'o1', date: '2026-06-10', clientName: 'Nexus Infra Pvt Ltd', site: 'Panvel Tower Site', grade: 'M-25', qty: 6, vehicleId: 'v1', vehicleNo: 'MH 46 CU 0813', driver: 'Ramesh Patil', status: 'delivered', createdAt: '2026-06-10' },
    { id: 'ch2', challanNo: '1528', orderId: 'o1', date: '2026-06-10', clientName: 'Nexus Infra Pvt Ltd', site: 'Panvel Tower Site', grade: 'M-25', qty: 6, vehicleId: 'v2', vehicleNo: 'MH 46 CU 0914', driver: 'Suresh Yadav', status: 'delivered', createdAt: '2026-06-10' },
    { id: 'ch3', challanNo: '1529', orderId: 'o5', date: '2026-06-10', clientName: 'Lodha Group', site: 'Thane Central Tower', grade: 'M-40', qty: 7, vehicleId: 'v3', vehicleNo: 'MH 04 AB 1234', driver: 'Mahesh Thakur', status: 'delivered', createdAt: '2026-06-10' },
    { id: 'ch4', challanNo: '1530', orderId: 'o5', date: '2026-06-10', clientName: 'Lodha Group', site: 'Thane Central Tower', grade: 'M-40', qty: 7, vehicleId: 'v5', vehicleNo: 'MH 46 CU 1122', driver: 'Ganesh More', status: 'dispatched', createdAt: '2026-06-10' },
    { id: 'ch5', challanNo: '1531', orderId: 'o1', date: '2026-06-10', clientName: 'Nexus Infra Pvt Ltd', site: 'Panvel Tower Site', grade: 'M-25', qty: 6, vehicleId: 'v1', vehicleNo: 'MH 46 CU 0813', driver: 'Ramesh Patil', status: 'dispatched', createdAt: '2026-06-10' },
  ];

  const batchRecords: BatchRecord[] = [
    { id: 'b1', date: '2026-06-10', batchNo: 'B-001', grade: 'M-25', qty: 6, orderId: 'o1', clientName: 'Nexus Infra Pvt Ltd', operatorName: 'Kishore Kumar', notes: '', createdAt: '2026-06-10' },
    { id: 'b2', date: '2026-06-10', batchNo: 'B-002', grade: 'M-25', qty: 6, orderId: 'o1', clientName: 'Nexus Infra Pvt Ltd', operatorName: 'Kishore Kumar', notes: '', createdAt: '2026-06-10' },
    { id: 'b3', date: '2026-06-10', batchNo: 'B-003', grade: 'M-40', qty: 7, orderId: 'o5', clientName: 'Lodha Group', operatorName: 'Arun Desai', notes: 'Slump 120mm', createdAt: '2026-06-10' },
    { id: 'b4', date: '2026-06-10', batchNo: 'B-004', grade: 'M-40', qty: 7, orderId: 'o5', clientName: 'Lodha Group', operatorName: 'Arun Desai', notes: 'Slump 115mm', createdAt: '2026-06-10' },
    { id: 'b5', date: '2026-06-10', batchNo: 'B-005', grade: 'M-25', qty: 6, orderId: 'o1', clientName: 'Nexus Infra Pvt Ltd', operatorName: 'Kishore Kumar', notes: '', createdAt: '2026-06-10' },
  ];

  save(KEYS.clients, clients);
  save(KEYS.orders, orders);
  save(KEYS.challans, challans);
  save(KEYS.vehicles, vehicles);
  save(KEYS.mixDesigns, mixDesigns);
  save(KEYS.batchRecords, batchRecords);
  localStorage.setItem(KEYS.challanSeq, '1531');
  localStorage.setItem('rmc_seeded', '1');
}

seed();

export const clientStore = {
  getAll: (): Client[] => load(KEYS.clients),
  getById: (id: string): Client | undefined => load<Client>(KEYS.clients).find(c => c.id === id),
  add: (data: Omit<Client, 'id' | 'createdAt'>): Client => {
    const clients = load<Client>(KEYS.clients);
    const c: Client = { ...data, id: uid(), createdAt: new Date().toISOString().slice(0, 10) };
    save(KEYS.clients, [...clients, c]);
    return c;
  },
  update: (id: string, data: Partial<Client>): void => {
    const clients = load<Client>(KEYS.clients).map(c => c.id === id ? { ...c, ...data } : c);
    save(KEYS.clients, clients);
  },
  remove: (id: string): void => {
    save(KEYS.clients, load<Client>(KEYS.clients).filter(c => c.id !== id));
  },
};

export const orderStore = {
  getAll: (): Order[] => load(KEYS.orders),
  getById: (id: string): Order | undefined => load<Order>(KEYS.orders).find(o => o.id === id),
  add: (data: Omit<Order, 'id' | 'createdAt' | 'dispatchedQty'>): Order => {
    const orders = load<Order>(KEYS.orders);
    const o: Order = { ...data, id: uid(), dispatchedQty: 0, createdAt: new Date().toISOString().slice(0, 10) };
    save(KEYS.orders, [...orders, o]);
    return o;
  },
  update: (id: string, data: Partial<Order>): void => {
    const orders = load<Order>(KEYS.orders).map(o => o.id === id ? { ...o, ...data } : o);
    save(KEYS.orders, orders);
  },
  remove: (id: string): void => {
    save(KEYS.orders, load<Order>(KEYS.orders).filter(o => o.id !== id));
  },
};

export const challanStore = {
  getAll: (): Challan[] => load(KEYS.challans),
  getByOrderId: (orderId: string): Challan[] => load<Challan>(KEYS.challans).filter(c => c.orderId === orderId),
  add: (data: Omit<Challan, 'id' | 'createdAt' | 'challanNo'>): Challan => {
    const challans = load<Challan>(KEYS.challans);
    const ch: Challan = { ...data, id: uid(), challanNo: nextChallan(), createdAt: new Date().toISOString().slice(0, 10) };
    save(KEYS.challans, [...challans, ch]);
    const order = orderStore.getById(data.orderId);
    if (order) {
      const newDispatched = order.dispatchedQty + data.qty;
      const status = newDispatched >= order.qty ? 'completed' : 'in-progress';
      orderStore.update(data.orderId, { dispatchedQty: newDispatched, status });
    }
    return ch;
  },
  update: (id: string, data: Partial<Challan>): void => {
    const challans = load<Challan>(KEYS.challans).map(c => c.id === id ? { ...c, ...data } : c);
    save(KEYS.challans, challans);
  },
  remove: (id: string): void => {
    save(KEYS.challans, load<Challan>(KEYS.challans).filter(c => c.id !== id));
  },
};

export const vehicleStore = {
  getAll: (): Vehicle[] => load(KEYS.vehicles),
  getActive: (): Vehicle[] => load<Vehicle>(KEYS.vehicles).filter(v => v.status === 'active'),
  add: (data: Omit<Vehicle, 'id' | 'createdAt'>): Vehicle => {
    const vehicles = load<Vehicle>(KEYS.vehicles);
    const v: Vehicle = { ...data, id: uid(), createdAt: new Date().toISOString().slice(0, 10) };
    save(KEYS.vehicles, [...vehicles, v]);
    return v;
  },
  update: (id: string, data: Partial<Vehicle>): void => {
    const vehicles = load<Vehicle>(KEYS.vehicles).map(v => v.id === id ? { ...v, ...data } : v);
    save(KEYS.vehicles, vehicles);
  },
  remove: (id: string): void => {
    save(KEYS.vehicles, load<Vehicle>(KEYS.vehicles).filter(v => v.id !== id));
  },
};

export const mixDesignStore = {
  getAll: (): MixDesign[] => load(KEYS.mixDesigns),
  getByGrade: (grade: string): MixDesign | undefined => load<MixDesign>(KEYS.mixDesigns).find(m => m.grade === grade),
  add: (data: Omit<MixDesign, 'id' | 'createdAt'>): MixDesign => {
    const mixes = load<MixDesign>(KEYS.mixDesigns);
    const m: MixDesign = { ...data, id: uid(), createdAt: new Date().toISOString().slice(0, 10) };
    save(KEYS.mixDesigns, [...mixes, m]);
    return m;
  },
  update: (id: string, data: Partial<MixDesign>): void => {
    const mixes = load<MixDesign>(KEYS.mixDesigns).map(m => m.id === id ? { ...m, ...data } : m);
    save(KEYS.mixDesigns, mixes);
  },
  remove: (id: string): void => {
    save(KEYS.mixDesigns, load<MixDesign>(KEYS.mixDesigns).filter(m => m.id !== id));
  },
};

export const batchStore = {
  getAll: (): BatchRecord[] => load(KEYS.batchRecords),
  add: (data: Omit<BatchRecord, 'id' | 'createdAt'>): BatchRecord => {
    const records = load<BatchRecord>(KEYS.batchRecords);
    const r: BatchRecord = { ...data, id: uid(), createdAt: new Date().toISOString().slice(0, 10) };
    save(KEYS.batchRecords, [...records, r]);
    return r;
  },
  update: (id: string, data: Partial<BatchRecord>): void => {
    const records = load<BatchRecord>(KEYS.batchRecords).map(r => r.id === id ? { ...r, ...data } : r);
    save(KEYS.batchRecords, records);
  },
  remove: (id: string): void => {
    save(KEYS.batchRecords, load<BatchRecord>(KEYS.batchRecords).filter(r => r.id !== id));
  },
};
