import { Redirect } from 'wouter';
import type { ComponentType } from 'react';
import { useAuth } from '@/lib/auth';
import { useIsMobile } from '@/lib/useIsMobile';
import { desktopDefaultPath, type Role } from '@/lib/permissions';
import DriverHome from './DriverHome';
import CustomerHome from './home/CustomerHome';
import OperatorHome from './home/OperatorHome';
import DispatcherHome from './home/DispatcherHome';
import SupervisorHome from './home/SupervisorHome';
import AdminHome from './home/AdminHome';
import OwnerHome from './home/OwnerHome';
import AccountHome from './home/AccountHome';

// Per-role mobile landing screens. Roles absent from this map have no dedicated
// home and fall back to their existing default path (below).
const HOME_COMPONENTS: Partial<Record<Role, ComponentType>> = {
  client: CustomerHome,
  plant_operator: OperatorHome,
  dispatcher: DispatcherHome,
  supervisor: SupervisorHome,
  admin: AdminHome,
  plant_owner: OwnerHome,
  accountant: AccountHome,
};

export default function RoleHome() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  if (!user) return null;

  const role = user.role as Role;
  // The driver home is the driver's sole landing at every width (unchanged).
  if (role === 'driver') return <DriverHome />;

  const Home = HOME_COMPONENTS[role];
  // Desktop is intentionally unchanged: every non-driver role is sent back to
  // its existing default screen. Roles without a mobile home fall back too.
  if (!isMobile || !Home) return <Redirect to={desktopDefaultPath(role)} />;
  return <Home />;
}
