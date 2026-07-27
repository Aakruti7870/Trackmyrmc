import { Route, Switch, Redirect, Link } from 'wouter';
import { lazy, Suspense, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth-provider';
import { ConfigProvider } from '@/lib/config-provider';
import { useToast } from '@/lib/toast';
import { ToastProvider } from '@/lib/toast-provider';
import { ThemeProvider } from '@/lib/theme-providers';
import Layout from '@/components/Layout';
import AppBackground from '@/components/AppBackground';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import PartnerRequest from '@/pages/PartnerRequest';
import SetPassword from '@/pages/SetPassword';
import ForgotPassword from '@/pages/ForgotPassword';
import Landing from '@/pages/Landing';
import Privacy from '@/pages/Privacy';
import Terms from '@/pages/Terms';
import DeleteAccount from '@/pages/DeleteAccount';
import { canAccess, defaultPath } from '@/lib/permissions';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Orders = lazy(() => import('@/pages/Orders'));
const Dispatch = lazy(() => import('@/pages/Dispatch'));
const Clients = lazy(() => import('@/pages/Clients'));
const Vehicles = lazy(() => import('@/pages/Vehicles'));
const Drivers = lazy(() => import('@/pages/Drivers'));
const MixDesign = lazy(() => import('@/pages/MixDesign'));
const Reports = lazy(() => import('@/pages/Reports'));
const FreshnessGuard = lazy(() => import('@/pages/FreshnessGuard'));
const DemandForecast = lazy(() => import('@/pages/DemandForecast'));
const ChallanPrint = lazy(() => import('@/pages/ChallanPrint'));
const MyOrders = lazy(() => import('@/pages/MyOrders'));
const MyTrips = lazy(() => import('@/pages/MyTrips'));
const NearbyPlants = lazy(() => import('@/pages/NearbyPlants'));
const Plants = lazy(() => import('@/pages/Plants'));
const PlantAbout = lazy(() => import('@/pages/PlantAbout'));
const PlantProfileManagement = lazy(() => import('@/pages/PlantProfileManagement'));
const PlantProfileReview = lazy(() => import('@/pages/PlantProfileReview'));
const PlantPromotions = lazy(() => import('@/pages/PlantPromotions'));
const RmcPlantNetwork = lazy(() => import('@/pages/RmcPlantNetwork'));
const RecurringAdmin = lazy(() => import('@/pages/RecurringAdmin'));
const Automations = lazy(() => import('@/pages/Automations'));
const WhatsAppChat = lazy(() => import('@/pages/WhatsAppChat'));
const FuelLog = lazy(() => import('@/pages/FuelLog'));
const Users = lazy(() => import('@/pages/Users'));
const UserManagement = lazy(() => import('@/pages/UserManagement'));
const ActivityLog = lazy(() => import('@/pages/ActivityLog'));
const ProfileSettings = lazy(() => import('@/pages/ProfileSettings'));
const Kiosk = lazy(() => import('@/pages/Kiosk'));
const SsoCallback = lazy(() => import('@/pages/SsoCallback'));
const TrackTrip = lazy(() => import('@/pages/TrackTrip'));
const Attendance = lazy(() => import('@/pages/Attendance'));
const CommandCenter = lazy(() => import('@/pages/CommandCenter'));
const RoleHome = lazy(() => import('@/pages/RoleHome'));
const DriverExpenses = lazy(() => import('@/pages/DriverExpenses'));
const DriverSOS = lazy(() => import('@/pages/DriverSOS'));
const ExpenseReview = lazy(() => import('@/pages/ExpenseReview'));
const Emergencies = lazy(() => import('@/pages/Emergencies'));
const BatchSheets = lazy(() => import('@/pages/BatchSheets'));
const KycProfilePage = lazy(() => import('@/pages/KycProfile'));
const KycAdmin = lazy(() => import('@/pages/KycAdmin'));
const BatchSheetPrint = lazy(() => import('@/pages/BatchSheetPrint'));

const PageSpinner = <div style={{ minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)',color:'var(--muted)',fontSize:14 }}>Loading…</div>;
function GuardedRoute({ path, component: Component }: { path:string; component:React.ComponentType }) {
  const { user } = useAuth(); const { showToast } = useToast(); const allowed = user ? canAccess(user.role,path) : false;
  useEffect(()=>{ if(user&&!allowed) showToast('You are not authorized to view that page.','error'); },[user,allowed,showToast]);
  if(!user) return null; if(!allowed) return <Redirect to={defaultPath(user.role)}/>; return <Component/>;
}
function PlantDashboard() {
  const { user } = useAuth();
  const canManageProfile = user?.role === 'plant_owner' || (user?.role === 'admin' && user.plantId != null);
  return <>
    {canManageProfile && <div style={{ display:'flex',justifyContent:'flex-end',marginBottom:12 }}><Link href="/plant/profile-management" style={{ minHeight:44,display:'inline-flex',alignItems:'center',padding:'9px 14px',borderRadius:12,background:'var(--gold)',color:'#1a1a1a',fontWeight:800,textDecoration:'none' }}>About Plant Profile</Link></div>}
    <Dashboard/>
  </>;
}
function ProtectedRoutes(){
  const {user,loading}=useAuth(); if(loading) return PageSpinner;
  if(!user) return <Switch><Route path="/" component={Landing}/><Route><Redirect to="/login"/></Route></Switch>;
  return <Switch key={user.id}><Route path="/kiosk" component={()=> <GuardedRoute path="/kiosk" component={Kiosk}/>}/><Route><Layout><Suspense fallback={PageSpinner}><Switch>
    <Route path="/" component={()=> <GuardedRoute path="/" component={PlantDashboard}/>}/>
    <Route path="/command" component={()=> <GuardedRoute path="/command" component={CommandCenter}/>}/>
    <Route path="/rmc-plant-network" component={()=> <GuardedRoute path="/rmc-plant-network" component={RmcPlantNetwork}/>}/>
    <Route path="/my-orders" component={()=> <GuardedRoute path="/my-orders" component={MyOrders}/>}/>
    <Route path="/nearby-plants" component={()=> <GuardedRoute path="/nearby-plants" component={NearbyPlants}/>}/>
    <Route path="/plants/:plantId/about" component={()=> <GuardedRoute path="/plants" component={PlantAbout}/>}/>
    <Route path="/plant/profile-management" component={()=> <GuardedRoute path="/plant/profile-management" component={PlantProfileManagement}/>}/>
    <Route path="/admin/plant-profiles" component={()=> <GuardedRoute path="/admin/plant-profiles" component={PlantProfileReview}/>}/>
    <Route path="/admin/plant-promotions" component={()=> <GuardedRoute path="/admin/plant-promotions" component={PlantPromotions}/>}/>
    <Route path="/plants" component={()=> <GuardedRoute path="/plants" component={Plants}/>}/>
    <Route path="/my-trips" component={()=> <GuardedRoute path="/my-trips" component={MyTrips}/>}/>
    <Route path="/home" component={()=> <GuardedRoute path="/home" component={RoleHome}/>}/>
    <Route path="/expenses" component={()=> <GuardedRoute path="/expenses" component={DriverExpenses}/>}/>
    <Route path="/sos" component={()=> <GuardedRoute path="/sos" component={DriverSOS}/>}/>
    <Route path="/expense-review" component={()=> <GuardedRoute path="/expense-review" component={ExpenseReview}/>}/>
    <Route path="/kyc" component={()=> <GuardedRoute path="/kyc" component={KycProfilePage}/>}/>
    <Route path="/kyc-admin" component={()=> <GuardedRoute path="/kyc-admin" component={KycAdmin}/>}/>
    <Route path="/emergencies" component={()=> <GuardedRoute path="/emergencies" component={Emergencies}/>}/>
    <Route path="/orders" component={()=> <GuardedRoute path="/orders" component={Orders}/>}/>
    <Route path="/dispatch" component={()=> <GuardedRoute path="/dispatch" component={Dispatch}/>}/>
    <Route path="/clients" component={()=> <GuardedRoute path="/clients" component={Clients}/>}/>
    <Route path="/vehicles" component={()=> <GuardedRoute path="/vehicles" component={Vehicles}/>}/>
    <Route path="/drivers" component={()=> <GuardedRoute path="/drivers" component={Drivers}/>}/>
    <Route path="/batch-report"><Redirect to="/reports?tab=batch"/></Route>
    <Route path="/attendance" component={()=> <GuardedRoute path="/attendance" component={Attendance}/>}/>
    <Route path="/live-drivers"><Redirect to="/attendance?tab=live"/></Route>
    <Route path="/mix-design" component={()=> <GuardedRoute path="/mix-design" component={MixDesign}/>}/>
    <Route path="/batch-sheets/:id/print" component={()=> <GuardedRoute path="/batch-sheets" component={BatchSheetPrint}/>}/>
    <Route path="/batch-sheets" component={()=> <GuardedRoute path="/batch-sheets" component={BatchSheets}/>}/>
    <Route path="/reports" component={()=> <GuardedRoute path="/reports" component={Reports}/>}/>
    <Route path="/freshness" component={()=> <GuardedRoute path="/freshness" component={FreshnessGuard}/>}/>
    <Route path="/forecast" component={()=> <GuardedRoute path="/forecast" component={DemandForecast}/>}/>
    <Route path="/shift-report"><Redirect to="/reports?tab=shift"/></Route>
    <Route path="/recurring" component={()=> <GuardedRoute path="/recurring" component={RecurringAdmin}/>}/>
    <Route path="/fuel-log" component={()=> <GuardedRoute path="/fuel-log" component={FuelLog}/>}/>
    <Route path="/users" component={()=> <GuardedRoute path="/users" component={Users}/>}/>
    <Route path="/user-management" component={()=> <GuardedRoute path="/user-management" component={UserManagement}/>}/>
    <Route path="/activity-log" component={()=> <GuardedRoute path="/activity-log" component={ActivityLog}/>}/>
    <Route path="/audit-log"><Redirect to="/activity-log"/></Route>
    <Route path="/automations" component={()=> <GuardedRoute path="/automations" component={Automations}/>}/>
    <Route path="/whatsapp" component={()=> <GuardedRoute path="/whatsapp" component={WhatsAppChat}/>}/>
    <Route path="/profile" component={()=> <GuardedRoute path="/profile" component={ProfileSettings}/>}/>
    <Route path="/challans/:id/print" component={()=> <GuardedRoute path="/challans" component={ChallanPrint}/>}/>
    <Route><Redirect to={defaultPath(user.role)}/></Route>
  </Switch></Suspense></Layout></Route></Switch>;
}
function LoginRoute(){const {user}=useAuth();return user?<Redirect to={defaultPath(user.role)}/>:<Login/>;}
function RegisterRoute(){const {user}=useAuth();return user?<Redirect to={defaultPath(user.role)}/>:<Register/>;}
export default function App(){return <ThemeProvider><AppBackground/><ConfigProvider><AuthProvider><ToastProvider><Switch>
  <Route path="/login" component={LoginRoute}/><Route path="/register" component={RegisterRoute}/><Route path="/partner" component={PartnerRequest}/><Route path="/privacy" component={Privacy}/><Route path="/terms" component={Terms}/><Route path="/delete-account" component={DeleteAccount}/><Route path="/set-password" component={SetPassword}/><Route path="/forgot-password" component={ForgotPassword}/><Route path="/sso-callback" component={()=> <Suspense fallback={PageSpinner}><SsoCallback/></Suspense>}/><Route path="/track/:token" component={()=> <Suspense fallback={PageSpinner}><TrackTrip/></Suspense>}/><Route component={ProtectedRoutes}/>
</Switch></ToastProvider></AuthProvider></ConfigProvider></ThemeProvider>;}
