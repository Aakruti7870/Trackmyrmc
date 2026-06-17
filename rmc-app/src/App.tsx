import { Route, Switch, Redirect } from 'wouter';
import { lazy, Suspense, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth-provider';
import { useToast } from '@/lib/toast';
import { ToastProvider } from '@/lib/toast-provider';
import { ThemeProvider } from '@/lib/theme-providers';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import SetPassword from '@/pages/SetPassword';
import Landing from '@/pages/Landing';
import { canAccess, defaultPath } from '@/lib/permissions';

const Dashboard      = lazy(() => import('@/pages/Dashboard'));
const Orders         = lazy(() => import('@/pages/Orders'));
const Dispatch       = lazy(() => import('@/pages/Dispatch'));
const Clients        = lazy(() => import('@/pages/Clients'));
const Vehicles       = lazy(() => import('@/pages/Vehicles'));
const Drivers        = lazy(() => import('@/pages/Drivers'));
const BatchReport    = lazy(() => import('@/pages/BatchReport'));
const MixDesign      = lazy(() => import('@/pages/MixDesign'));
const Reports        = lazy(() => import('@/pages/Reports'));
const FreshnessGuard = lazy(() => import('@/pages/FreshnessGuard'));
const DemandForecast = lazy(() => import('@/pages/DemandForecast'));
const ShiftReport    = lazy(() => import('@/pages/ShiftReport'));
const ChallanPrint   = lazy(() => import('@/pages/ChallanPrint'));
const MyOrders       = lazy(() => import('@/pages/MyOrders'));
const MyTrips        = lazy(() => import('@/pages/MyTrips'));
const NearbyPlants   = lazy(() => import('@/pages/NearbyPlants'));
const Plants         = lazy(() => import('@/pages/Plants'));
const RecurringAdmin = lazy(() => import('@/pages/RecurringAdmin'));
const FuelLog        = lazy(() => import('@/pages/FuelLog'));
const Users          = lazy(() => import('@/pages/Users'));
const ActivityLog    = lazy(() => import('@/pages/ActivityLog'));
const AuditLog       = lazy(() => import('@/pages/AuditLog'));
const ProfileSettings = lazy(() => import('@/pages/ProfileSettings'));
const Kiosk          = lazy(() => import('@/pages/Kiosk'));
const SsoCallback    = lazy(() => import('@/pages/SsoCallback'));

const PageSpinner = (
  <div style={{
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg)', color: 'var(--muted)', fontSize: 14,
  }}>
    Loading…
  </div>
);

function GuardedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: React.ComponentType;
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const allowed = user ? canAccess(user.role, path) : false;

  useEffect(() => {
    if (user && !allowed) {
      showToast('You are not authorized to view that page.', 'error');
    }
  }, [user, allowed, showToast]);

  if (!user) return null;
  if (!allowed) return <Redirect to={defaultPath(user.role)} />;
  return <Component />;
}

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return PageSpinner;
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        {/* Nearby-plant discovery is gated behind login: customers register,
            then use their GPS location to find the plants we've onboarded. */}
        <Route><Redirect to="/login" /></Route>
      </Switch>
    );
  }

  return (
    // Keying on user.id forces a full remount on cross-tab account switch,
    // so protected pages refetch and never render the previous user's data.
    <Switch key={user.id}>
      {/* Kiosk renders fullscreen, outside the sidebar Layout */}
      <Route path="/kiosk" component={() => <GuardedRoute path="/kiosk" component={Kiosk} />} />
      <Route>
        <Layout>
          <Suspense fallback={PageSpinner}>
            <Switch>
        <Route path="/"             component={() => <GuardedRoute path="/"             component={Dashboard}   />} />
        <Route path="/my-orders"    component={() => <GuardedRoute path="/my-orders"    component={MyOrders}    />} />
        <Route path="/nearby-plants" component={() => <GuardedRoute path="/nearby-plants" component={NearbyPlants} />} />
        <Route path="/plants"       component={() => <GuardedRoute path="/plants"       component={Plants}      />} />
        <Route path="/my-trips"     component={() => <GuardedRoute path="/my-trips"     component={MyTrips}     />} />
        <Route path="/orders"       component={() => <GuardedRoute path="/orders"       component={Orders}      />} />
        <Route path="/dispatch"     component={() => <GuardedRoute path="/dispatch"     component={Dispatch}    />} />
        <Route path="/clients"      component={() => <GuardedRoute path="/clients"      component={Clients}     />} />
        <Route path="/vehicles"     component={() => <GuardedRoute path="/vehicles"     component={Vehicles}    />} />
        <Route path="/drivers"      component={() => <GuardedRoute path="/drivers"      component={Drivers}     />} />
        <Route path="/batch-report" component={() => <GuardedRoute path="/batch-report" component={BatchReport} />} />
        <Route path="/mix-design"   component={() => <GuardedRoute path="/mix-design"   component={MixDesign}   />} />
        <Route path="/reports"      component={() => <GuardedRoute path="/reports"      component={Reports}     />} />
        <Route path="/freshness"    component={() => <GuardedRoute path="/freshness"    component={FreshnessGuard}  />} />
        <Route path="/forecast"     component={() => <GuardedRoute path="/forecast"     component={DemandForecast}  />} />
        <Route path="/shift-report" component={() => <GuardedRoute path="/shift-report" component={ShiftReport} />} />
        <Route path="/recurring"    component={() => <GuardedRoute path="/recurring"    component={RecurringAdmin}  />} />
        <Route path="/fuel-log"     component={() => <GuardedRoute path="/fuel-log"     component={FuelLog}         />} />
        <Route path="/users"        component={() => <GuardedRoute path="/users"        component={Users}           />} />
        <Route path="/activity-log" component={() => <GuardedRoute path="/activity-log" component={ActivityLog}      />} />
        <Route path="/audit-log"    component={() => <GuardedRoute path="/audit-log"    component={AuditLog}        />} />
        <Route path="/profile"      component={() => <GuardedRoute path="/profile"      component={ProfileSettings} />} />
        <Route path="/challans/:id/print" component={() => <GuardedRoute path="/challans" component={ChallanPrint} />} />
        <Route><Redirect to={defaultPath(user.role)} /></Route>
            </Switch>
          </Suspense>
        </Layout>
      </Route>
    </Switch>
  );
}

function LoginRoute() {
  const { user } = useAuth();
  if (user) return <Redirect to={defaultPath(user.role)} />;
  return <Login />;
}

function RegisterRoute() {
  const { user } = useAuth();
  if (user) return <Redirect to={defaultPath(user.role)} />;
  return <Register />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <Switch>
            <Route path="/login" component={LoginRoute} />
            <Route path="/register" component={RegisterRoute} />
            <Route path="/set-password" component={SetPassword} />
            <Route path="/sso-callback" component={() => (
              <Suspense fallback={PageSpinner}><SsoCallback /></Suspense>
            )} />
            <Route component={ProtectedRoutes} />
          </Switch>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
