import { Route, Switch, useLocation, Redirect } from 'wouter';
import { AuthProvider, useAuth } from '@/lib/auth';
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

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  useLocation();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#08111f', color: '#9fb0c7', fontSize: 14,
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
        <Route path="/" component={Dashboard} />
        <Route path="/orders" component={Orders} />
        <Route path="/dispatch" component={Dispatch} />
        <Route path="/clients" component={Clients} />
        <Route path="/vehicles" component={Vehicles} />
        <Route path="/drivers" component={Drivers} />
        <Route path="/batch-report" component={BatchReport} />
        <Route path="/mix-design" component={MixDesign} />
        <Route path="/reports" component={Reports} />
        <Route path="/challans/:id/print" component={ChallanPrint} />
        <Route><Redirect to="/" /></Route>
      </Switch>
    </Layout>
  );
}

function LoginRoute() {
  const { user } = useAuth();
  if (user) return <Redirect to="/" />;
  return <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <Switch>
        <Route path="/login" component={LoginRoute} />
        <Route component={ProtectedRoutes} />
      </Switch>
    </AuthProvider>
  );
}
