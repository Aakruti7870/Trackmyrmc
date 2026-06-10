import { Route, Switch } from 'wouter';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Orders from '@/pages/Orders';
import Dispatch from '@/pages/Dispatch';
import Clients from '@/pages/Clients';
import Vehicles from '@/pages/Vehicles';
import BatchReport from '@/pages/BatchReport';
import MixDesign from '@/pages/MixDesign';
import Reports from '@/pages/Reports';

export default function App() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/orders" component={Orders} />
        <Route path="/dispatch" component={Dispatch} />
        <Route path="/clients" component={Clients} />
        <Route path="/vehicles" component={Vehicles} />
        <Route path="/batch-report" component={BatchReport} />
        <Route path="/mix-design" component={MixDesign} />
        <Route path="/reports" component={Reports} />
      </Switch>
    </Layout>
  );
}
