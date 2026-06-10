import { Route, Switch, Redirect } from 'wouter';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ToastProvider, useToast } from '@/lib/toast';
import { ThemeProvider } from '@/lib/theme';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Orders from '@/pages/Orders';
import Dispatch from '@/pages/Dispatch';
import Clients from '@/pages/Clients';
import Vehicles from '@/pages/Vehicles';
import Drivers from '@/pages/Drivers';
import BatchReport from '@/pages/BatchReport';
import MixDesign from '@/pages/MixDesign';
import Reports from '@/pages/Reports';
import ChallanPrint from '@/pages/ChallanPrint';
import MyOrders from '@/pages/MyOrders';
import MyTrips from '@/pages/MyTrips';
import Users from '@/pages/Users';
import ProfileSettings from '@/pages/ProfileSettings';
import { canAccess, defaultPath } from '@/lib/permissions';

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
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', color: 'var(--muted)', fontSize: 14,
      }}>
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/"             component={() => <GuardedRoute path="/"             component={Dashboard}   />} />
        <Route path="/my-orders"    component={() => <GuardedRoute path="/my-orders"    component={MyOrders}    />} />
        <Route path="/my-trips"     component={() => <GuardedRoute path="/my-trips"     component={MyTrips}     />} />
        <Route path="/orders"       component={() => <GuardedRoute path="/orders"       component={Orders}      />} />
        <Route path="/dispatch"     component={() => <GuardedRoute path="/dispatch"     component={Dispatch}    />} />
        <Route path="/clients"      component={() => <GuardedRoute path="/clients"      component={Clients}     />} />
        <Route path="/vehicles"     component={() => <GuardedRoute path="/vehicles"     component={Vehicles}    />} />
        <Route path="/drivers"      component={() => <GuardedRoute path="/drivers"      component={Drivers}     />} />
        <Route path="/batch-report" component={() => <GuardedRoute path="/batch-report" component={BatchReport} />} />
        <Route path="/mix-design"   component={() => <GuardedRoute path="/mix-design"   component={MixDesign}   />} />
        <Route path="/reports"      component={() => <GuardedRoute path="/reports"      component={Reports}     />} />
        <Route path="/users"        component={() => <GuardedRoute path="/users"        component={Users}           />} />
        <Route path="/profile"      component={() => <GuardedRoute path="/profile"      component={ProfileSettings} />} />
        <Route path="/challans/:id/print" component={() => <GuardedRoute path="/challans" component={ChallanPrint} />} />
        <Route><Redirect to={defaultPath(user.role)} /></Route>
      </Switch>
    </Layout>
  );
}

function LoginRoute() {
  const { user } = useAuth();
  if (user) return <Redirect to={defaultPath(user.role)} />;
  return <Login />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <Switch>
            <Route path="/login" component={LoginRoute} />
            <Route component={ProtectedRoutes} />
          </Switch>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
