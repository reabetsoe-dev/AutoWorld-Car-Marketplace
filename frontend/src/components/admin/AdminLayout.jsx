import { NavLink, useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  CarFront,
  ClipboardList,
  FileBarChart2,
  Gauge,
  Gavel,
  LayoutDashboard,
  LogOut,
  Percent,
  PlusCircle,
  ScrollText,
  Settings,
  Shield,
  UserRound
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionContext';
import { ADMIN_BASE_PATH, ADMIN_DASHBOARD_PATH } from '../../config/adminPaths';
import { PERMISSIONS } from '../../services/api';

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard' },
  { key: 'reports', label: 'Reports', icon: FileBarChart2, requiredPermission: PERMISSIONS.ADMIN_STATS },
  { key: 'cars', label: 'Cars', icon: CarFront, requiredPermission: PERMISSIONS.CARS_VIEW },
  { key: 'add-car', label: 'Add Car', icon: PlusCircle, requiredPermission: PERMISSIONS.CARS_CREATE },
  { key: 'sell-requests', label: 'Sell Requests', icon: ClipboardList, requiredPermission: PERMISSIONS.SELL_REQUESTS_VIEW },
  { key: 'sold-cars', label: 'Sold Cars', icon: BadgeCheck, requiredPermission: PERMISSIONS.CARS_MARK_SOLD },
  { key: 'auctions', label: 'Auctions', icon: Gavel, requiredPermission: PERMISSIONS.CARS_VIEW },
  { key: 'special-offers', label: 'Special Offers', icon: Percent, requiredPermission: PERMISSIONS.CARS_VIEW },
  { key: 'admin-users', label: 'Admin Users', icon: UserRound, requiredPermission: PERMISSIONS.USERS_MANAGE },
  { key: 'audit-logs', label: 'Audit Logs', icon: ScrollText, requiredPermission: PERMISSIONS.AUDIT_VIEW },
  { key: 'settings', label: 'Settings', icon: Settings, requiredPermission: PERMISSIONS.SYSTEM_SETTINGS }
];

function buildPath(view) {
  return view === 'dashboard' ? ADMIN_DASHBOARD_PATH : `${ADMIN_BASE_PATH}/dashboard/${view}`;
}

export default function AdminLayout({ children, title, subtitle, actions }) {
  const navigate = useNavigate();
  const { profile, logout } = useAuth();
  const permissions = usePermissions();

  const visibleNavItems = navItems.filter((item) => {
    if (item.key === 'dashboard') return true;
    return permissions?.hasPermission?.(item.requiredPermission);
  });

  async function handleLogout() {
    await logout();
    navigate(ADMIN_BASE_PATH + '/login', { replace: true });
  }

  return (
    <div className="admin-shell min-h-screen bg-slate-950 text-slate-100">
      <div className="admin-frame mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        <aside className="admin-sidebar w-full border-b border-slate-800 bg-slate-950/95 p-4 lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="mb-4 px-2 lg:mb-8">
            <div className="max-w-64 rounded-3xl border border-white/10 bg-gradient-to-br from-white via-slate-100 to-slate-300 p-3 shadow-xl shadow-black/25 lg:max-w-none">
              <img
                className="h-14 w-full object-contain object-left drop-shadow-sm"
                src="/assets/autoworld-logo.png"
                alt="AutoWorld Marketplace"
              />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-400">Control Room</p>
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.key}
                  to={buildPath(item.key)}
                  end={item.key === 'dashboard'}
                  className={({ isActive }) =>
                    `flex shrink-0 items-center gap-3 whitespace-nowrap rounded-2xl px-3 py-3 text-sm font-medium transition ${
                      isActive
                        ? 'text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-8 hidden rounded-3xl border border-slate-800 bg-slate-900/80 p-4 lg:block">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <Shield className="h-4 w-4 text-brand-400" />
              Signed in as
            </div>
            <p className="text-sm font-semibold text-white">{profile?.name || profile?.username || 'Admin'}</p>
            <p className="text-sm text-slate-400">{profile?.role || 'viewer'}</p>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </aside>

        <main className="admin-main flex-1 p-4 sm:p-6 lg:p-8">
          <div className="admin-workspace-header mb-6 flex flex-col gap-4 rounded-[28px] border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/20 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-brand-400">
                <Gauge className="h-4 w-4" />
                Admin workspace
              </div>
              <h1 className="text-2xl font-semibold text-white">{title}</h1>
              <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
            </div>
            {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
