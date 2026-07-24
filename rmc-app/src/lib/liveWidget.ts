import { Capacitor, registerPlugin } from '@capacitor/core'

type WidgetRole = 'driver' | 'customer' | 'client' | 'staff' | 'admin' | 'plant_owner' | 'authority'

type WidgetData = {
  role: WidgetRole
  title: string
  line1: string
  line2?: string
  line3?: string
  deepLink?: string
}

type TrackingOptions = {
  endpoint: string
  authToken: string
  actorId: string
  role: WidgetRole
  intervalMs?: number
}

type TrackingState = {
  active: boolean
  latitude: string
  longitude: string
  accuracy: number
  lastLocationAt: number
}

interface LiveWidgetPlugin {
  setWidgetData(data: WidgetData): Promise<void>
  startTracking(options: TrackingOptions): Promise<void>
  stopTracking(): Promise<void>
  getTrackingState(): Promise<TrackingState>
  requestPermissions(options: { permissions: Array<'location' | 'backgroundLocation' | 'notifications'> }): Promise<void>
}

const NativeLiveWidget = registerPlugin<LiveWidgetPlugin>('LiveWidget')

export const liveWidgetAvailable = () => Capacitor.getPlatform() === 'android'

export async function updateLiveWidget(data: WidgetData) {
  if (!liveWidgetAvailable()) return
  await NativeLiveWidget.setWidgetData(data)
}

/** Call immediately after a successful check-in. Driver tracking starts by default. */
export async function startCheckedInTracking(options: TrackingOptions) {
  if (!liveWidgetAvailable()) return
  await NativeLiveWidget.requestPermissions({
    permissions: ['location', 'backgroundLocation', 'notifications'],
  })
  await NativeLiveWidget.startTracking({ ...options, intervalMs: options.intervalMs ?? 30_000 })
}

/** Call on check-out, delivered, suspended session, or explicit tracking stop. */
export async function stopCheckedInTracking() {
  if (!liveWidgetAvailable()) return
  await NativeLiveWidget.stopTracking()
}

export async function getCheckedInTrackingState(): Promise<TrackingState | null> {
  if (!liveWidgetAvailable()) return null
  return NativeLiveWidget.getTrackingState()
}

export function driverOrderWidget(order: {
  orderNo: string
  customer: string
  quantity: number | string
  grade: string
  destination: string
}) {
  return updateLiveWidget({
    role: 'driver',
    title: `Order ${order.orderNo}`,
    line1: `${order.customer} • ${order.grade} • ${order.quantity} m³`,
    line2: order.destination,
    line3: 'Tap to open GPS map and delivery details',
    deepLink: '/my-trips',
  })
}

export function customerOrderWidget(order: {
  orderNo: string
  status: string
  quantity: number | string
  grade: string
  challanNo?: string
}) {
  return updateLiveWidget({
    role: 'customer',
    title: `Order ${order.orderNo}`,
    line1: `${order.grade} • ${order.quantity} m³`,
    line2: `Status: ${order.status}`,
    line3: order.challanNo ? `Challan: ${order.challanNo}` : 'Challan pending',
    deepLink: '/my-orders',
  })
}

export function plantSummaryWidget(summary: {
  plantName: string
  productionM3: number | string
  tmOnRoute: number
  activeOrders: number
}) {
  return updateLiveWidget({
    role: 'staff',
    title: summary.plantName,
    line1: `Today: ${summary.productionM3} m³ production`,
    line2: `${summary.tmOnRoute} TM on route`,
    line3: `${summary.activeOrders} active orders`,
    deepLink: '/',
  })
}
