import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  CarFront,
  ClipboardList,
  Download,
  FileBarChart2,
  Gauge,
  Image as ImageIcon,
  ListOrdered,
  Mail,
  MapPin,
  Phone,
  PlusCircle,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  Wrench
} from 'lucide-react';
import AdminLayout from '../components/admin/AdminLayout';
import { ADMIN_LOGIN_PATH } from '../config/adminPaths';
import { isAuthenticated } from '../services/auth';
import {
  createAdminUser,
  createCar,
  deleteCar,
  getAdminCarById,
  getAdminCars,
  getAdminStats,
  getAdminUsers,
  getAuditLogs,
  getSellers,
  getSellRequests,
  markCarAvailable,
  markCarSold,
  PERMISSIONS,
  updateAdminUser,
  updateCar,
  updateSellRequest,
  uploadCarImage
} from '../services/api';
import { usePermissions } from '../contexts/PermissionContext';
import { ADMIN_BASE_PATH } from '../config/adminPaths';
import { CAR_CATEGORY_OPTIONS, DEFAULT_CAR_CATEGORY, getCarCategoryLabel } from '../constants/carCategories';
import {
  ACCESSORY_AVAILABILITY_OPTIONS,
  DEFAULT_ACCESSORY_AVAILABILITY,
  getAccessoryAvailabilityLabel
} from '../constants/accessoryAvailability';

const phoneRegex = /^\+?[\d\s().-]{7,24}$/;
const sellerDefaults = {
  sellerType: 'dealer',
  dealershipName: '',
  ownerName: '',
  contactPerson: '',
  primaryPhone: '',
  whatsappNumber: '',
  email: '',
  districtTown: '',
  physicalAddress: '',
  privateNotes: ''
};

const carCategoryValues = CAR_CATEGORY_OPTIONS.map((category) => category.value);
const accessoryAvailabilityValues = ACCESSORY_AVAILABILITY_OPTIONS.map((item) => item.value);

const carFormSchema = z.object({
  brand: z.string().trim().min(1, 'Brand is required.'),
  model: z.string().optional(),
  category: z.enum(carCategoryValues).default(DEFAULT_CAR_CATEGORY),
  availabilityStatus: z.enum(accessoryAvailabilityValues).default(DEFAULT_ACCESSORY_AVAILABILITY),
  year: z.string().optional(),
  price: z.string().min(1, 'Price is required.'),
  mileage: z.string().optional(),
  fuelType: z.string(),
  transmission: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  isAuction: z.boolean().default(false),
  isSpecialOffer: z.boolean().default(false),
  imageUrls: z.array(z.string()).optional().default([]),
  sellerMode: z.enum(['new', 'existing']).default('new'),
  sellerId: z.string().optional(),
  seller: z.object({
    sellerType: z.enum(['dealer', 'individual'], {
      required_error: 'Seller type is required.'
    }),
    dealershipName: z.string().optional(),
    ownerName: z.string().optional(),
    contactPerson: z.string().optional(),
    primaryPhone: z.string().trim().min(1, 'Primary phone number is required.'),
    whatsappNumber: z.string().optional(),
    email: z.string().optional(),
    districtTown: z.string().trim().min(1, 'District/town is required.'),
    physicalAddress: z.string().optional(),
    privateNotes: z.string().optional()
  })
}).superRefine((values, ctx) => {
  if (values.category === 'accessory' && !values.model?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['model'],
      message: 'Accessory name is required.'
    });
  }

  if (values.category !== 'accessory' && !values.mileage?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['mileage'],
      message: 'Mileage is required.'
    });
  }

  if (values.sellerMode === 'existing' && !values.sellerId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sellerId'],
      message: 'Select an existing seller or switch to create new.'
    });
  }

  if (values.seller.sellerType === 'dealer' && !values.seller.dealershipName?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['seller', 'dealershipName'],
      message: 'Dealership name is required for dealer sellers.'
    });
  }

  if (values.seller.sellerType === 'individual' && !values.seller.ownerName?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['seller', 'ownerName'],
      message: "Owner's full name is required for individual sellers."
    });
  }

  if (values.seller.primaryPhone && !phoneRegex.test(values.seller.primaryPhone.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['seller', 'primaryPhone'],
      message: 'Enter a valid primary phone number.'
    });
  }

  if (values.seller.whatsappNumber?.trim() && !phoneRegex.test(values.seller.whatsappNumber.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['seller', 'whatsappNumber'],
      message: 'Enter a valid WhatsApp number.'
    });
  }

  if (values.seller.email?.trim() && !z.string().email().safeParse(values.seller.email.trim()).success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['seller', 'email'],
      message: 'Enter a valid email address.'
    });
  }
});

const defaultUserForm = {
  username: '',
  email: '',
  name: '',
  password: '',
  role: 'viewer',
  isActive: true
};

const sellRequestStatusOptions = [
  { value: 'new', label: 'New' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'converted', label: 'Converted' },
  { value: 'declined', label: 'Declined' }
];

function formatCurrency(value) {
  if (value === undefined || value === null || value === '') return 'N/A';
  return `R ${Number(value || 0).toLocaleString()}`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatSellRequestStatus(status) {
  return sellRequestStatusOptions.find((item) => item.value === status)?.label || 'New';
}

function sellRequestStatusClass(status) {
  const classes = {
    new: 'bg-brand-500/15 text-brand-200',
    reviewing: 'bg-sky-500/15 text-sky-300',
    contacted: 'bg-amber-500/15 text-amber-300',
    converted: 'bg-emerald-500/15 text-emerald-300',
    declined: 'bg-slate-700/70 text-slate-300'
  };
  return classes[status] || classes.new;
}

function dashboardPath(view) {
  return `${ADMIN_BASE_PATH}/dashboard/${view}`;
}

const auditTimeFilterOptions = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' }
];

function buildAuditTimeQuery(timeFilter) {
  const now = new Date();
  if (timeFilter === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { createdFrom: start.toISOString(), createdTo: now.toISOString() };
  }

  const ranges = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };

  if (!ranges[timeFilter]) return {};
  return {
    createdFrom: new Date(now.getTime() - ranges[timeFilter]).toISOString(),
    createdTo: now.toISOString()
  };
}

function buildDateRangeQuery(dateFrom, dateTo) {
  const query = {};

  if (dateFrom) {
    const start = new Date(`${dateFrom}T00:00:00`);
    if (!Number.isNaN(start.getTime())) {
      query.createdFrom = start.toISOString();
    }
  }

  if (dateTo) {
    const end = new Date(`${dateTo}T23:59:59.999`);
    if (!Number.isNaN(end.getTime())) {
      query.createdTo = end.toISOString();
    }
  }

  return query;
}

function auditDownloadSuffix(timeFilter, dateFrom, dateTo) {
  if (dateFrom || dateTo) {
    return `${dateFrom || 'start'}-to-${dateTo || 'today'}`;
  }
  return timeFilter;
}

function downloadCsv(filename, rows) {
  const blob = new Blob([rows.map((row) => row.map(csvCell).join(',')).join('\n')], {
    type: 'text/csv;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function StatCard({ label, value, icon: Icon, tone = 'default' }) {
  const tones = {
    default: 'from-slate-800 to-slate-700 text-slate-100',
    green: 'from-emerald-900/70 to-emerald-800/70 text-emerald-100',
    blue: 'from-sky-900/70 to-sky-800/70 text-sky-100',
    amber: 'from-amber-900/70 to-amber-800/70 text-amber-100'
  };

  return (
    <div className={`rounded-[24px] bg-gradient-to-br ${tones[tone]} p-4 shadow-lg`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-300">{label}</p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-2">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function DashboardHome() {
  const { data: statsData, isLoading: statsLoading } = useQuery({ queryKey: ['adminStats'], queryFn: getAdminStats });

  const stats = statsData?.summary || {};
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {statsLoading ? Array.from({ length: 4 }).map((_, idx) => <div key={idx} className="h-24 animate-pulse rounded-[24px] bg-slate-800" />) : (
        <>
          <StatCard label="Total Cars" value={stats.totalCars ?? 0} icon={CarFront} />
          <StatCard label="Available Cars" value={stats.availableCars ?? 0} icon={BadgeCheck} tone="green" />
          <StatCard label="Sold Cars" value={stats.soldCars ?? 0} icon={ListOrdered} tone="blue" />
          <StatCard label="Inventory Value" value={`R ${Number(stats.totalInventoryValue || 0).toLocaleString()}`} icon={BarChart3} tone="amber" />
        </>
      )}
    </div>
  );
  const cars = inventoryData?.data || [];
  const users = usersData?.data || [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statsLoading ? Array.from({ length: 4 }).map((_, idx) => <div key={idx} className="h-24 animate-pulse rounded-[24px] bg-slate-800" />) : (
          <>
            <StatCard label="Total Cars" value={stats.totalCars ?? 0} icon={CarFront} />
            <StatCard label="Available Cars" value={stats.availableCars ?? 0} icon={BadgeCheck} tone="green" />
            <StatCard label="Sold Cars" value={stats.soldCars ?? 0} icon={ListOrdered} tone="blue" />
            <StatCard label="Inventory Value" value={`R ${Number(stats.totalInventoryValue || 0).toLocaleString()}`} icon={BarChart3} tone="amber" />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Inventory snapshot</h2>
              <p className="text-sm text-slate-400">Recent inventory entries and pricing.</p>
            </div>
          </div>
          {inventoryLoading ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, idx) => <div key={idx} className="h-14 animate-pulse rounded-2xl bg-slate-800" />)}</div> : (
            <div className="space-y-3">
              {cars.map((car) => (
                <div key={car._id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                  <div>
                    <p className="font-medium text-white">{car.title}</p>
                    <p className="text-sm text-slate-400">{car.brand} • {car.model || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-brand-400">R {Number(car.price || 0).toLocaleString()}</p>
                    <p className="text-sm text-slate-400">{car.isSold ? 'Sold' : 'Available'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-5">
          <div>
            <h2 className="text-lg font-semibold text-white">Recent activity</h2>
            <p className="text-sm text-slate-400">Open the audit trail when you need activity history.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(dashboardPath('audit-logs'))}
            disabled={!canViewAuditLogs}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-white transition hover:border-brand-500 hover:bg-brand-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ClipboardList className="h-4 w-4" />
            View audit logs
          </button>
          {/*
            <div className="space-y-3">
              {auditItems.map((item) => (
                <div key={item._id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-sm font-semibold text-white">{item.action}</p>
                  <p className="mt-1 text-sm text-slate-400">{item.actorUsername || 'System'} • {new Date(item.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          */}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-5">
          <h2 className="text-lg font-semibold text-white">Performance metrics</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-sm text-slate-400">Average price</p>
              <p className="mt-2 text-xl font-semibold text-white">R {Number(stats.averagePrice || 0).toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-sm text-slate-400">Average mileage</p>
              <p className="mt-2 text-xl font-semibold text-white">{Number(stats.averageMileage || 0).toLocaleString()} km</p>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-5">
          <h2 className="text-lg font-semibold text-white">Team access</h2>
          {usersLoading ? <div className="mt-4 space-y-3">{Array.from({ length: 3 }).map((_, idx) => <div key={idx} className="h-12 animate-pulse rounded-2xl bg-slate-800" />)}</div> : (
            <div className="mt-4 space-y-3">
              {users.slice(0, 4).map((user) => (
                <div key={user.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                  <div>
                    <p className="font-medium text-white">{user.name || user.username}</p>
                    <p className="text-sm text-slate-400">{user.role}</p>
                  </div>
                  <div className="rounded-full bg-brand-500/15 px-3 py-1 text-sm text-brand-300">{user.isActive ? 'Active' : 'Inactive'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InventoryPage({
  title = 'Vehicle inventory',
  description = 'Search, filter, and manage your stock.',
  query = {},
  defaultStatus = 'all',
  lockStatus = false,
  emptyMessage = 'No vehicles found for this view.'
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(defaultStatus);
  const [selectedCar, setSelectedCar] = useState(null);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['inventoryPage', title, search, status, query],
    queryFn: () => getAdminCars({ page: 1, limit: 12, sort: 'newest', search, status, ...query })
  });

  const cars = data?.data || [];

  async function toggleSold(car) {
    try {
      if (car.isSold) {
        await markCarAvailable(car._id);
      } else {
        await markCarSold(car._id);
      }
      await refetch();
    } catch (error) {
      window.alert(error.message || 'Unable to update status.');
    }
  }

  async function removeCar(id) {
    if (!window.confirm('Remove this listing permanently?')) return;
    try {
      await deleteCar(id);
      await refetch();
    } catch (error) {
      window.alert(error.message || 'Unable to delete listing.');
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="text-sm text-slate-400">{description}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
              <Search className="h-4 w-4 text-slate-500" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title or brand" className="bg-transparent outline-none" />
            </label>
            {lockStatus ? (
              <div className="rounded-2xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
                {defaultStatus === 'sold' ? 'Sold only' : 'Filtered view'}
              </div>
            ) : (
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-2xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
                <option value="all">All status</option>
                <option value="available">Available</option>
                <option value="sold">Sold</option>
              </select>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-slate-800 bg-slate-900/70">
        {isLoading ? <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, idx) => <div key={idx} className="h-14 animate-pulse rounded-2xl bg-slate-800" />)}</div> : (
          cars.length === 0 ? (
            <div className="p-6 text-sm text-slate-400">{emptyMessage}</div>
          ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-950/80 text-left text-slate-400">
                <tr>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Brand</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Mileage</th>
                  <th className="px-4 py-3">Listing</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {cars.map((car) => (
                  <tr key={car._id} className="bg-slate-900/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{car.title}</div>
                      <div className="text-slate-400">{car.model || 'N/A'}</div>
                    </td>
                    <td className="px-4 py-3">{car.brand}</td>
                    <td className="px-4 py-3">{getCarCategoryLabel(car.category)}</td>
                    <td className="px-4 py-3">R {Number(car.price || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {car.category === 'accessory'
                        ? getAccessoryAvailabilityLabel(car.availabilityStatus)
                        : `${Number(car.mileage || 0).toLocaleString()} km`}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {car.isAuction ? <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-xs text-sky-300">Auction</span> : null}
                        {car.isSpecialOffer ? <span className="rounded-full bg-brand-500/15 px-2.5 py-1 text-xs text-brand-200">Special</span> : null}
                        {!car.isAuction && !car.isSpecialOffer ? <span className="rounded-full bg-slate-700/60 px-2.5 py-1 text-xs text-slate-300">Standard</span> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs ${car.isSold ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{car.isSold ? 'Sold' : 'Available'}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setSelectedCar(car)} className="rounded-xl border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200">View</button>
                        <button type="button" onClick={() => navigate(`${dashboardPath('add-car')}?edit=${car._id}`)} className="rounded-xl border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200">Edit</button>
                        <button type="button" onClick={() => toggleSold(car)} className="rounded-xl border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200">{car.isSold ? 'Make available' : 'Mark sold'}</button>
                        <button type="button" onClick={() => removeCar(car._id)} className="rounded-xl border border-red-600/40 px-2.5 py-1.5 text-xs text-red-300">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )
        )}
      </div>

      {selectedCar ? (
        <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-5">
          <h3 className="text-lg font-semibold text-white">Selected listing</h3>
          <p className="mt-2 text-sm text-slate-400">{selectedCar.title} • {selectedCar.brand}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-5">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-sm text-slate-400">Price</p>
              <p className="mt-1 font-semibold text-white">R {Number(selectedCar.price || 0).toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-sm text-slate-400">Category</p>
              <p className="mt-1 font-semibold text-white">{getCarCategoryLabel(selectedCar.category)}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-sm text-slate-400">{selectedCar.category === 'accessory' ? 'Availability' : 'Mileage'}</p>
              <p className="mt-1 font-semibold text-white">
                {selectedCar.category === 'accessory'
                  ? getAccessoryAvailabilityLabel(selectedCar.availabilityStatus)
                  : `${Number(selectedCar.mileage || 0).toLocaleString()} km`}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-sm text-slate-400">Location</p>
              <p className="mt-1 font-semibold text-white">{selectedCar.location || 'N/A'}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-sm text-slate-400">Listing type</p>
              <p className="mt-1 font-semibold text-white">{selectedCar.isAuction ? 'Auction' : selectedCar.isSpecialOffer ? 'Special offer' : 'Standard'}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SellRequestsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [notice, setNotice] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sellRequests', search, status],
    queryFn: () => getSellRequests({ page: 1, limit: 20, search, status })
  });

  const requests = data?.data || [];

  function selectRequest(request) {
    setSelectedRequest(request);
    setAdminNotes(request.adminNotes || '');
    setNotice('');
  }

  async function updateRequest(request, payload) {
    try {
      setNotice('');
      const response = await updateSellRequest(request._id, payload);
      const updated = response?.request || request;
      setSelectedRequest(updated);
      setAdminNotes(updated.adminNotes || '');
      await refetch();
      setNotice('Sell request updated.');
    } catch (error) {
      setNotice(error.message || 'Could not update sell request.');
    }
  }

  async function updateStatus(request, nextStatus) {
    await updateRequest(request, {
      status: nextStatus,
      adminNotes: selectedRequest?._id === request._id ? adminNotes : request.adminNotes || ''
    });
  }

  async function saveNotes() {
    if (!selectedRequest) return;
    await updateRequest(selectedRequest, { adminNotes });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Sell requests</h2>
            <p className="text-sm text-slate-400">Customer valuation submissions from the Sell My Car page.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
              <Search className="h-4 w-4 text-slate-500" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search requests" className="bg-transparent outline-none" />
            </label>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-2xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
              <option value="all">All status</option>
              {sellRequestStatusOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="overflow-hidden rounded-[28px] border border-slate-800 bg-slate-900/70">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-800" />)}
            </div>
          ) : requests.length === 0 ? (
            <div className="p-6 text-sm text-slate-400">No sell requests found.</div>
          ) : (
            <div className="divide-y divide-slate-800">
              {requests.map((request) => (
                <button
                  key={request._id}
                  type="button"
                  onClick={() => selectRequest(request)}
                  className={`grid w-full gap-3 bg-slate-900/60 p-4 text-left transition hover:bg-slate-800/70 md:grid-cols-[1fr_auto] ${selectedRequest?._id === request._id ? 'ring-1 ring-brand-500/70' : ''}`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-white">{request.year} {request.make} {request.model}</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs ${sellRequestStatusClass(request.status)}`}>{formatSellRequestStatus(request.status)}</span>
                    </div>
                    <div className="mt-2 grid gap-2 text-sm text-slate-400 sm:grid-cols-3">
                      <span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />{request.ownerName}</span>
                      <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{request.location}</span>
                      <span className="inline-flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" />{request.images?.length || 0} images</span>
                    </div>
                  </div>
                  <div className="text-sm text-slate-400 md:text-right">
                    <p>{Number(request.mileage || 0).toLocaleString()} km</p>
                    <p>{formatCurrency(request.expectedPrice)}</p>
                    <p>{new Date(request.createdAt).toLocaleString()}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-5">
          {selectedRequest ? (
            <div className="space-y-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">{selectedRequest.year} {selectedRequest.make} {selectedRequest.model}</h3>
                  <span className={`rounded-full px-2.5 py-1 text-xs ${sellRequestStatusClass(selectedRequest.status)}`}>{formatSellRequestStatus(selectedRequest.status)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-400">Submitted {new Date(selectedRequest.createdAt).toLocaleString()}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-sm text-slate-400">Mileage</p>
                  <p className="mt-1 font-semibold text-white">{Number(selectedRequest.mileage || 0).toLocaleString()} km</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-sm text-slate-400">Expected price</p>
                  <p className="mt-1 font-semibold text-white">{formatCurrency(selectedRequest.expectedPrice)}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-sm text-slate-400">Condition</p>
                  <p className="mt-1 font-semibold text-white">{String(selectedRequest.condition || '').replace('_', ' ') || 'N/A'}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-sm text-slate-400">Fuel and gearbox</p>
                  <p className="mt-1 font-semibold text-white">{selectedRequest.fuelType || 'N/A'} | {selectedRequest.transmission || 'N/A'}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <h4 className="font-semibold text-white">Seller</h4>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  <p className="flex items-center gap-2"><UserRound className="h-4 w-4 text-slate-500" />{selectedRequest.ownerName}</p>
                  <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-500" />{selectedRequest.phone}</p>
                  {selectedRequest.email ? <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-500" />{selectedRequest.email}</p> : null}
                  <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-500" />{selectedRequest.location}</p>
                </div>
              </div>

              {selectedRequest.notes ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <h4 className="font-semibold text-white">Customer notes</h4>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{selectedRequest.notes}</p>
                </div>
              ) : null}

              <div>
                <h4 className="mb-3 font-semibold text-white">Vehicle images</h4>
                <div className="grid grid-cols-2 gap-3">
                  {(selectedRequest.images || []).map((image) => (
                    <a key={image.filename} href={image.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
                      <img src={image.url} alt={image.originalName || 'Vehicle upload'} className="h-28 w-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>

              <div className="grid gap-3">
                <label className="text-sm text-slate-300">
                  <span className="mb-1 block">Status</span>
                  <select value={selectedRequest.status || 'new'} onChange={(event) => updateStatus(selectedRequest, event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
                    {sellRequestStatusOptions.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-300">
                  <span className="mb-1 block">Admin notes</span>
                  <textarea value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} rows="4" className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
                </label>
                <button type="button" onClick={saveNotes} className="rounded-2xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white">Save notes</button>
              </div>

              {notice ? <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-300">{notice}</div> : null}
            </div>
          ) : (
            <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
              Select a sell request to view its details and images.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function sellerDisplayName(seller) {
  if (!seller) return 'No seller linked';
  if (seller.sellerType === 'dealer') {
    return seller.dealershipName || seller.contactPerson || 'Dealer seller';
  }
  return seller.ownerName || 'Individual seller';
}

function sellerTypeLabel(type) {
  return type === 'individual' ? 'Individual' : 'Dealer';
}

function cleanListingPart(value) {
  return String(value || '').trim();
}

function buildListingTitle(values) {
  const titleParts = values.category === 'accessory'
    ? [cleanListingPart(values.brand), cleanListingPart(values.model)]
    : [
        cleanListingPart(values.year),
        cleanListingPart(values.brand),
        cleanListingPart(values.model)
      ];
  const title = titleParts.filter(Boolean).join(' ');

  return title || (values.category === 'accessory' ? 'Accessory listing' : getCarCategoryLabel(values.category));
}

function sellerToFormValues(seller) {
  return {
    sellerType: seller?.sellerType || 'dealer',
    dealershipName: seller?.dealershipName || '',
    ownerName: seller?.ownerName || '',
    contactPerson: seller?.contactPerson || '',
    primaryPhone: seller?.primaryPhone || '',
    whatsappNumber: seller?.whatsappNumber || '',
    email: seller?.email || '',
    districtTown: seller?.districtTown || '',
    physicalAddress: seller?.physicalAddress || '',
    privateNotes: seller?.privateNotes || ''
  };
}

function AddCarPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editingId = searchParams.get('edit');
  const [notice, setNotice] = useState('');
  const [uploadedImages, setUploadedImages] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const defaultValues = {
    brand: '',
    model: '',
    category: DEFAULT_CAR_CATEGORY,
    availabilityStatus: DEFAULT_ACCESSORY_AVAILABILITY,
    year: '',
    price: '',
    mileage: '',
    fuelType: 'petrol',
    transmission: 'automatic',
    description: '',
    location: '',
    isAuction: false,
    isSpecialOffer: false,
    imageUrls: [],
    sellerMode: 'new',
    sellerId: '',
    seller: sellerDefaults
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm({ resolver: zodResolver(carFormSchema), defaultValues });
  const sellerMode = watch('sellerMode');
  const sellerType = watch('seller.sellerType');
  const selectedSellerId = watch('sellerId');
  const selectedCategory = watch('category') || DEFAULT_CAR_CATEGORY;
  const isAccessory = selectedCategory === 'accessory';
  const { data: sellersData, refetch: refetchSellers } = useQuery({
    queryKey: ['sellerOptions'],
    queryFn: () => getSellers({ limit: 200 })
  });
  const sellers = sellersData?.data || [];

  useEffect(() => {
    if (!editingId) {
      reset(defaultValues);
      setUploadedImages([]);
      return;
    }

    let isMounted = true;
    async function loadCar() {
      try {
        const car = await getAdminCarById(editingId);
        if (!isMounted) return;
        const nextValues = {
          brand: car.brand || '',
          model: car.model || '',
          category: car.category || DEFAULT_CAR_CATEGORY,
          availabilityStatus: car.availabilityStatus || DEFAULT_ACCESSORY_AVAILABILITY,
          year: car.year ? String(car.year) : '',
          price: car.price ? String(car.price) : '',
          mileage: car.mileage ? String(car.mileage) : '',
          fuelType: car.fuelType || 'petrol',
          transmission: car.transmission || 'automatic',
          description: car.description || '',
          location: car.location || '',
          isAuction: Boolean(car.isAuction),
          isSpecialOffer: Boolean(car.isSpecialOffer),
          imageUrls: car.imageUrls || [],
          sellerMode: car.seller?._id ? 'existing' : 'new',
          sellerId: car.seller?._id || '',
          seller: sellerToFormValues(car.seller)
        };
        reset(nextValues);
        setUploadedImages(car.imageUrls || []);
      } catch (error) {
        setNotice(error.message || 'Could not load listing.');
      }
    }

    loadCar();
    return () => {
      isMounted = false;
    };
  }, [editingId, reset]);

  useEffect(() => {
    if (!isAccessory) return;
    setValue('year', '');
    setValue('mileage', '');
    setValue('fuelType', 'other');
    setValue('transmission', 'other');
  }, [isAccessory, setValue]);

  async function onUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await uploadCarImage(file);
      const nextImages = [...uploadedImages, result.url];
      setUploadedImages(nextImages);
      setValue('imageUrls', nextImages);
      setNotice('Image uploaded.');
    } catch (error) {
      setNotice(error.message || 'Image upload failed.');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  }

  function applySellerSelection(sellerId) {
    setValue('sellerId', sellerId);
    if (!sellerId) {
      setValue('sellerMode', 'new');
      setValue('seller', sellerDefaults);
      return;
    }

    const seller = sellers.find((item) => item._id === sellerId);
    if (seller) {
      setValue('sellerMode', 'existing');
      setValue('seller', sellerToFormValues(seller));
      setValue('location', seller.districtTown || '');
    }
  }

  async function onSubmit(values) {
    setIsSaving(true);
    setNotice('');
    try {
      const isAccessorySubmission = values.category === 'accessory';
      const listingLabel = isAccessorySubmission ? 'Accessory' : 'Vehicle';
      const payload = {
        ...values,
        title: buildListingTitle(values),
        price: Number(values.price),
        category: values.category || DEFAULT_CAR_CATEGORY,
        availabilityStatus: isAccessorySubmission ? values.availabilityStatus : DEFAULT_ACCESSORY_AVAILABILITY,
        mileage: isAccessorySubmission ? 0 : Number(values.mileage),
        year: isAccessorySubmission ? null : values.year ? Number(values.year) : undefined,
        fuelType: isAccessorySubmission ? 'other' : values.fuelType,
        transmission: isAccessorySubmission ? 'other' : values.transmission,
        imageUrls: uploadedImages,
        sellerId: values.sellerMode === 'existing' ? values.sellerId : undefined,
        seller: {
          ...values.seller,
          sellerType: values.seller.sellerType,
          email: values.seller.email?.trim() || '',
          primaryPhone: values.seller.primaryPhone?.trim() || '',
          whatsappNumber: values.seller.whatsappNumber?.trim() || '',
          districtTown: values.seller.districtTown?.trim() || ''
        },
        location: values.seller.districtTown
      };
      if (editingId) {
        await updateCar(editingId, payload);
        setNotice(`${listingLabel} updated.`);
        await refetchSellers();
      } else {
        await createCar(payload);
        setNotice(`${listingLabel} created.`);
        reset(defaultValues);
        setUploadedImages([]);
        await refetchSellers();
      }
    } catch (error) {
      setNotice(error.message || 'Could not save listing.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">{editingId ? `Edit ${isAccessory ? 'accessory' : 'vehicle'}` : `Create ${isAccessory ? 'accessory' : 'vehicle'}`}</h2>
          <p className="text-sm text-slate-400">Populate the form and upload images directly to the backend.</p>
        </div>
        <button type="button" onClick={() => navigate(dashboardPath('cars'))} className="rounded-2xl border border-slate-700 px-3 py-2 text-sm text-slate-200">Back to inventory</button>
      </div>

      {notice ? <div className="mb-4 rounded-2xl border border-brand-500/30 bg-brand-500/10 p-3 text-sm text-brand-200">{notice}</div> : null}

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">{isAccessory ? 'Accessory details' : 'Vehicle details'}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm text-slate-300">
                <span className="mb-1 block">Category</span>
                <select {...register('category')} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">
                  {CAR_CATEGORY_OPTIONS.map((category) => (
                    <option key={category.value} value={category.value}>{category.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-1 block">{isAccessory ? 'Accessory brand' : 'Brand'}</span>
                <input {...register('brand')} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
                {errors.brand ? <span className="mt-1 block text-xs text-red-400">{errors.brand.message}</span> : null}
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-1 block">{isAccessory ? 'Accessory name' : 'Model'}</span>
                <input {...register('model')} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
                {errors.model ? <span className="mt-1 block text-xs text-red-400">{errors.model.message}</span> : null}
              </label>
              {!isAccessory ? (
                <label className="text-sm text-slate-300">
                  <span className="mb-1 block">Year</span>
                  <input type="number" {...register('year')} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
                </label>
              ) : null}
              <label className="text-sm text-slate-300">
                <span className="mb-1 block">Price</span>
                <input type="number" {...register('price')} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
                {errors.price ? <span className="mt-1 block text-xs text-red-400">{errors.price.message}</span> : null}
              </label>
              {isAccessory ? (
                <label className="text-sm text-slate-300">
                  <span className="mb-1 block">Availability</span>
                  <select {...register('availabilityStatus')} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">
                    {ACCESSORY_AVAILABILITY_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <>
                  <label className="text-sm text-slate-300">
                    <span className="mb-1 block">Mileage</span>
                    <input type="number" {...register('mileage')} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
                    {errors.mileage ? <span className="mt-1 block text-xs text-red-400">{errors.mileage.message}</span> : null}
                  </label>
                  <label className="text-sm text-slate-300">
                    <span className="mb-1 block">Fuel Type</span>
                    <select {...register('fuelType')} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">
                      <option value="petrol">Petrol</option>
                      <option value="diesel">Diesel</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="electric">Electric</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="text-sm text-slate-300">
                    <span className="mb-1 block">Transmission</span>
                    <select {...register('transmission')} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">
                      <option value="automatic">Automatic</option>
                      <option value="manual">Manual</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                </>
              )}
              <label className="text-sm text-slate-300 md:col-span-2">
                <span className="mb-1 block">Description</span>
                <textarea rows="4" {...register('description')} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Seller and listing location</h3>
              <p className="mt-1 text-xs text-slate-500">Private admin-only contact details. Public users only see the district/town.</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm text-slate-300">
                <span className="mb-1 block">Seller record</span>
                <select
                  {...register('sellerMode')}
                  onChange={(event) => {
                    const mode = event.target.value;
                    setValue('sellerMode', mode);
                    if (mode === 'new') {
                      setValue('sellerId', '');
                      setValue('seller', sellerDefaults);
                    }
                  }}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  <option value="new">Create new seller</option>
                  <option value="existing">Use existing seller</option>
                </select>
              </label>

              {sellerMode === 'existing' ? (
                <label className="text-sm text-slate-300">
                  <span className="mb-1 block">Existing seller</span>
                  <select
                    value={selectedSellerId || ''}
                    onChange={(event) => applySellerSelection(event.target.value)}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    <option value="">Select seller</option>
                    {sellers.map((seller) => (
                      <option key={seller._id} value={seller._id}>
                        {sellerDisplayName(seller)} - {sellerTypeLabel(seller.sellerType)} - {seller.districtTown || 'No location'}
                      </option>
                    ))}
                  </select>
                  {errors.sellerId ? <span className="mt-1 block text-xs text-red-400">{errors.sellerId.message}</span> : null}
                </label>
              ) : null}

              <label className="text-sm text-slate-300">
                <span className="mb-1 block">Seller type</span>
                <select {...register('seller.sellerType')} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">
                  <option value="dealer">Dealer</option>
                  <option value="individual">Individual</option>
                </select>
                {errors.seller?.sellerType ? <span className="mt-1 block text-xs text-red-400">{errors.seller.sellerType.message}</span> : null}
              </label>

              {sellerType === 'individual' ? (
                <label className="text-sm text-slate-300">
                  <span className="mb-1 block">Owner's full name</span>
                  <input {...register('seller.ownerName')} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
                  {errors.seller?.ownerName ? <span className="mt-1 block text-xs text-red-400">{errors.seller.ownerName.message}</span> : null}
                </label>
              ) : (
                <label className="text-sm text-slate-300">
                  <span className="mb-1 block">Dealership name</span>
                  <input {...register('seller.dealershipName')} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
                  {errors.seller?.dealershipName ? <span className="mt-1 block text-xs text-red-400">{errors.seller.dealershipName.message}</span> : null}
                </label>
              )}

              {sellerType === 'dealer' ? (
                <label className="text-sm text-slate-300">
                  <span className="mb-1 block">Contact person</span>
                  <input {...register('seller.contactPerson')} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
                </label>
              ) : null}

              <label className="text-sm text-slate-300">
                <span className="mb-1 block">Primary phone number</span>
                <input {...register('seller.primaryPhone')} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
                {errors.seller?.primaryPhone ? <span className="mt-1 block text-xs text-red-400">{errors.seller.primaryPhone.message}</span> : null}
              </label>

              <label className="text-sm text-slate-300">
                <span className="mb-1 block">WhatsApp number</span>
                <input {...register('seller.whatsappNumber')} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
                {errors.seller?.whatsappNumber ? <span className="mt-1 block text-xs text-red-400">{errors.seller.whatsappNumber.message}</span> : null}
              </label>

              <label className="text-sm text-slate-300">
                <span className="mb-1 block">Email address</span>
                <input type="email" {...register('seller.email')} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
                {errors.seller?.email ? <span className="mt-1 block text-xs text-red-400">{errors.seller.email.message}</span> : null}
              </label>

              <label className="text-sm text-slate-300">
                <span className="mb-1 block">District/town</span>
                <input {...register('seller.districtTown')} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
                {errors.seller?.districtTown ? <span className="mt-1 block text-xs text-red-400">{errors.seller.districtTown.message}</span> : null}
              </label>

              <label className="text-sm text-slate-300 md:col-span-2">
                <span className="mb-1 block">Physical address</span>
                <input {...register('seller.physicalAddress')} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
              </label>

              <label className="text-sm text-slate-300 md:col-span-2">
                <span className="mb-1 block">Private admin notes</span>
                <textarea rows="3" {...register('seller.privateNotes')} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Listing flags</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
                <input type="checkbox" {...register('isAuction')} />
                Auction listing
              </label>
              <label className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
                <input type="checkbox" {...register('isSpecialOffer')} />
                Special offer
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Images</h3>
            <input type="file" accept="image/*" onChange={onUpload} className="w-full rounded-2xl border border-dashed border-slate-700 bg-slate-900 px-3 py-3 text-sm text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">{isUploading ? 'Uploading image...' : 'Images are uploaded to Cloudinary through the admin API.'}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {uploadedImages.map((url) => (
                <div key={url} className="rounded-2xl border border-slate-700 bg-slate-900/80 p-2">
                  <img src={url} alt="Uploaded listing" className="h-20 w-28 rounded-xl object-cover" />
                  <button type="button" onClick={() => { const next = uploadedImages.filter((item) => item !== url); setUploadedImages(next); setValue('imageUrls', next); }} className="mt-2 text-xs text-red-300">Remove</button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={isSaving} className="rounded-2xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white" >{isSaving ? 'Saving...' : editingId ? `Save ${isAccessory ? 'accessory' : 'vehicle'}` : `Create ${isAccessory ? 'accessory' : 'vehicle'}`}</button>
            <button type="button" onClick={() => navigate(dashboardPath('cars'))} className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm text-slate-200">Cancel</button>
          </div>
        </div>
      </form>
    </div>
  );
}

function AdminUsersPage() {
  const { hasPermission } = usePermissions();
  const [form, setForm] = useState(defaultUserForm);
  const [editingUser, setEditingUser] = useState(null);
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { data, isLoading, refetch } = useQuery({ queryKey: ['adminUserList'], queryFn: getAdminUsers, enabled: hasPermission(PERMISSIONS.USERS_MANAGE) });
  const users = data?.data || [];

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function startEdit(user) {
    setEditingUser(user);
    setNotice('');
    setForm({
      username: user.username || '',
      email: user.email || '',
      name: user.name || '',
      password: '',
      role: user.role || 'viewer',
      isActive: Boolean(user.isActive)
    });
  }

  function resetForm() {
    setEditingUser(null);
    setForm(defaultUserForm);
  }

  async function saveUser(event) {
    event.preventDefault();
    setIsSaving(true);
    setNotice('');

    try {
      if (editingUser) {
        const payload = {
          name: form.name,
          role: form.role,
          isActive: form.isActive
        };
        if (form.password) payload.password = form.password;
        await updateAdminUser(editingUser.id, payload);
        setNotice('Admin user updated.');
      } else {
        await createAdminUser({
          username: form.username,
          email: form.email,
          name: form.name,
          password: form.password,
          role: form.role
        });
        setNotice('Admin user created.');
      }
      resetForm();
      await refetch();
    } catch (error) {
      setNotice(error?.response?.data?.message || error.message || 'Could not save admin user.');
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleUserStatus(user) {
    try {
      await updateAdminUser(user.id, { isActive: !user.isActive });
      await refetch();
    } catch (error) {
      window.alert(error?.response?.data?.message || error.message || 'Could not update user status.');
    }
  }

  if (!hasPermission(PERMISSIONS.USERS_MANAGE)) {
    return (
      <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-5 text-sm text-slate-300">
        You do not have permission to manage admin users.
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <form onSubmit={saveUser} className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">{editingUser ? 'Edit admin user' : 'Create admin user'}</h2>
          <p className="text-sm text-slate-400">Create staff access, adjust roles, and deactivate accounts.</p>
        </div>

        {notice ? <div className="mb-4 rounded-2xl border border-brand-500/30 bg-brand-500/10 p-3 text-sm text-brand-200">{notice}</div> : null}

        <div className="grid gap-3">
          <label className="text-sm text-slate-300">
            <span className="mb-1 block">Username</span>
            <input value={form.username} disabled={Boolean(editingUser)} onChange={(event) => updateForm('username', event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white disabled:opacity-60" required />
          </label>
          <label className="text-sm text-slate-300">
            <span className="mb-1 block">Email</span>
            <input type="email" value={form.email} disabled={Boolean(editingUser)} onChange={(event) => updateForm('email', event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white disabled:opacity-60" required={!editingUser} />
          </label>
          <label className="text-sm text-slate-300">
            <span className="mb-1 block">Name</span>
            <input value={form.name} onChange={(event) => updateForm('name', event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" required />
          </label>
          <label className="text-sm text-slate-300">
            <span className="mb-1 block">{editingUser ? 'New password (optional)' : 'Password'}</span>
            <input type="password" value={form.password} onChange={(event) => updateForm('password', event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" required={!editingUser} minLength={8} />
          </label>
          <label className="text-sm text-slate-300">
            <span className="mb-1 block">Role</span>
            <select value={form.role} onChange={(event) => updateForm('role', event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="manager">Manager</option>
            </select>
          </label>
          {editingUser ? (
            <label className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
              <input type="checkbox" checked={form.isActive} onChange={(event) => updateForm('isActive', event.target.checked)} />
              Account active
            </label>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button type="submit" disabled={isSaving} className="rounded-2xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white">{isSaving ? 'Saving...' : editingUser ? 'Save user' : 'Create user'}</button>
          {editingUser ? <button type="button" onClick={resetForm} className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm text-slate-200">Cancel edit</button> : null}
        </div>
      </form>

      <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Admin users</h2>
          <p className="text-sm text-slate-400">Control team access and account states.</p>
        </div>
        {isLoading ? <div className="h-24 animate-pulse rounded-2xl bg-slate-800" /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-950/80 text-left text-slate-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {users.map((user) => (
                  <tr key={user.id} className="bg-slate-900/60">
                    <td className="px-4 py-3">{user.name}</td>
                    <td className="px-4 py-3">{user.username}</td>
                    <td className="px-4 py-3">{user.role}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs ${user.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>{user.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => startEdit(user)} className="rounded-xl border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200">Edit</button>
                        <button type="button" onClick={() => toggleUserStatus(user)} className="rounded-xl border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200">{user.isActive ? 'Deactivate' : 'Activate'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AuditLogsPage() {
  const navigate = useNavigate();
  const [timeFilter, setTimeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const auditQuery = useMemo(
    () => ({
      page: 1,
      limit: 50,
      ...(dateFrom || dateTo ? {} : buildAuditTimeQuery(timeFilter)),
      ...buildDateRangeQuery(dateFrom, dateTo)
    }),
    [timeFilter, dateFrom, dateTo]
  );
  const { data, isLoading } = useQuery({
    queryKey: ['auditLogs', timeFilter, dateFrom, dateTo],
    queryFn: () => getAuditLogs(auditQuery)
  });
  const logs = data?.data || [];
  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(dashboardPath('dashboard'));
  };
  const downloadAuditLogs = () => {
    const rows = [
      ['Action', 'Actor', 'Role', 'Entity type', 'Entity id', 'Created at'],
      ...logs.map((log) => [
        log.action,
        log.actorUsername || 'system',
        log.actorRole || '',
        log.entityType || '',
        log.entityId || '',
        new Date(log.createdAt).toLocaleString()
      ])
    ];
    downloadCsv(`audit-history-${auditDownloadSuffix(timeFilter, dateFrom, dateTo)}.csv`, rows);
  };
  const handleTimeFilterChange = (value) => {
    setTimeFilter(value);
    setDateFrom('');
    setDateTo('');
  };
  const handleDateFromChange = (value) => {
    setTimeFilter('all');
    setDateFrom(value);
    if (dateTo && value && value > dateTo) {
      setDateTo(value);
    }
  };
  const handleDateToChange = (value) => {
    setTimeFilter('all');
    setDateTo(value);
    if (dateFrom && value && value < dateFrom) {
      setDateFrom(value);
    }
  };

  return (
    <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-5">
      <div className="mb-5 rounded-[24px] border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={goBack}
            aria-label="Go back"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950/80 text-slate-200 transition hover:border-brand-500 hover:bg-brand-500/15 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">Audit history</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">Operational activity, account actions, and system changes.</p>
          </div>
        </div>
        <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(150px,180px)_minmax(150px,1fr)_minmax(150px,1fr)_auto] xl:w-auto">
          <label className="grid gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-slate-500">
            Period
            <select
              value={timeFilter}
              onChange={(event) => handleTimeFilterChange(event.target.value)}
              className="h-11 rounded-2xl border border-slate-700 bg-slate-950/80 px-3 text-sm font-semibold normal-case tracking-normal text-slate-100 outline-none transition focus:border-brand-500"
              aria-label="Filter audit logs by time"
            >
              {auditTimeFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-slate-500">
            From
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => handleDateFromChange(event.target.value)}
              className="h-11 rounded-2xl border border-slate-700 bg-slate-950/80 px-3 text-sm font-semibold normal-case tracking-normal text-slate-100 outline-none transition focus:border-brand-500"
            />
          </label>
          <label className="grid gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-slate-500">
            To
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => handleDateToChange(event.target.value)}
              className="h-11 rounded-2xl border border-slate-700 bg-slate-950/80 px-3 text-sm font-semibold normal-case tracking-normal text-slate-100 outline-none transition focus:border-brand-500"
            />
          </label>
          <button
            type="button"
            onClick={downloadAuditLogs}
            disabled={isLoading || logs.length === 0}
            className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-2xl border border-slate-700 bg-slate-950/80 px-5 text-sm font-semibold text-slate-100 transition hover:border-brand-500 hover:bg-brand-500/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2 lg:col-span-1"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>
        </div>
      </div>
      {isLoading ? <div className="h-24 animate-pulse rounded-2xl bg-slate-800" /> : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log._id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{log.action}</p>
                  <p className="text-sm text-slate-400">{log.actorUsername || 'system'} • {log.entityType || 'system'}</p>
                </div>
                <p className="text-sm text-slate-400">{new Date(log.createdAt).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportsPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const reportQuery = useMemo(() => buildDateRangeQuery(dateFrom, dateTo), [dateFrom, dateTo]);
  const { data: statsData } = useQuery({ queryKey: ['reportStats', dateFrom, dateTo], queryFn: () => getAdminStats(reportQuery) });
  const { data: inventoryData } = useQuery({
    queryKey: ['reportInventory', dateFrom, dateTo],
    queryFn: () => getAdminCars({ page: 1, limit: 50, sort: 'newest', ...reportQuery })
  });

  const stats = statsData?.summary || {};
  const brandBreakdown = statsData?.brandBreakdown || [];
  const cars = inventoryData?.data || [];
  const reportDate = new Date().toLocaleString();
  const periodLabel = dateFrom || dateTo ? `${dateFrom || 'Start'} to ${dateTo || 'Today'}` : 'All dates';
  const statusRows = [
    ['Available', stats.availableCars ?? 0],
    ['Sold', stats.soldCars ?? 0],
    ['Total listed', stats.totalCars ?? 0]
  ];

  function exportCsv() {
    const rows = [
      ['Title', 'Brand', 'Model', 'Category', 'Date added', 'Price', 'Mileage / Availability', 'Status'],
      ...cars.map((car) => [
        car.title,
        car.brand,
        car.model || '',
        getCarCategoryLabel(car.category),
        car.createdAt ? new Date(car.createdAt).toLocaleDateString() : '',
        Number(car.price || 0),
        car.category === 'accessory'
          ? getAccessoryAvailabilityLabel(car.availabilityStatus)
          : Number(car.mileage || 0),
        car.isSold ? 'Sold' : 'Available'
      ])
    ];
    downloadCsv(`inventory-report-${auditDownloadSuffix('all', dateFrom, dateTo)}.csv`, rows);
  }
  const handleDateFromChange = (value) => {
    setDateFrom(value);
    if (dateTo && value && value > dateTo) {
      setDateTo(value);
    }
  };
  const handleDateToChange = (value) => {
    setDateTo(value);
    if (dateFrom && value && value < dateFrom) {
      setDateFrom(value);
    }
  };

  return (
    <div className="report-page space-y-5">
      <div className="report-actions rounded-[24px] border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <p className="text-sm text-slate-400">Prepare inventory reports for management review.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_auto_auto]">
            <label className="grid gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-slate-500">
              From
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => handleDateFromChange(event.target.value)}
                className="h-11 rounded-2xl border border-slate-700 bg-slate-950/80 px-3 text-sm font-semibold normal-case tracking-normal text-slate-100 outline-none transition focus:border-brand-500"
              />
            </label>
            <label className="grid gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-slate-500">
              To
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => handleDateToChange(event.target.value)}
                className="h-11 rounded-2xl border border-slate-700 bg-slate-950/80 px-3 text-sm font-semibold normal-case tracking-normal text-slate-100 outline-none transition focus:border-brand-500"
              />
            </label>
            <button type="button" onClick={exportCsv} className="h-11 self-end rounded-2xl border border-slate-700 px-4 text-sm font-semibold text-slate-200 transition hover:border-brand-500 hover:bg-brand-500/15">Download CSV</button>
            <button type="button" onClick={() => window.print()} className="h-11 self-end rounded-2xl bg-brand-500 px-4 text-sm font-semibold text-white transition hover:bg-brand-600">Print / Save PDF</button>
          </div>
        </div>
      </div>

      <article className="report-document rounded-[28px] border border-slate-800 bg-slate-900/70 p-6 text-slate-100">
        <header className="report-header flex flex-col gap-5 border-b border-slate-800 pb-5 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="report-logo-box inline-flex w-fit rounded-2xl border border-slate-800 bg-white p-3">
              <img className="h-12 w-44 object-contain" src="/assets/autoworld-logo.png" alt="AutoWorld Marketplace" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-400">AutoWorld Marketplace</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">Inventory Report</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Stock position, valuation, status mix, and current listings prepared for management review.</p>
            </div>
          </div>
          <dl className="grid min-w-56 gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm">
            <div>
              <dt className="text-slate-500">Prepared</dt>
              <dd className="mt-1 font-semibold text-white">{reportDate}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Scope</dt>
              <dd className="mt-1 font-semibold text-white">Inventory overview</dd>
            </div>
            <div>
              <dt className="text-slate-500">Period</dt>
              <dd className="mt-1 font-semibold text-white">{periodLabel}</dd>
            </div>
          </dl>
        </header>

        <section className="report-section mt-6">
          <h3 className="text-lg font-semibold text-white">Executive Summary</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="report-kpi rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Total stock</p>
              <p className="mt-2 text-2xl font-semibold text-white">{stats.totalCars ?? 0}</p>
            </div>
            <div className="report-kpi rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Available</p>
              <p className="mt-2 text-2xl font-semibold text-white">{stats.availableCars ?? 0}</p>
            </div>
            <div className="report-kpi rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Inventory value</p>
              <p className="mt-2 text-2xl font-semibold text-white">R {Number(stats.totalInventoryValue || 0).toLocaleString()}</p>
            </div>
            <div className="report-kpi rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Average price</p>
              <p className="mt-2 text-2xl font-semibold text-white">R {Number(stats.averagePrice || 0).toLocaleString()}</p>
            </div>
          </div>
        </section>

        <section className="report-section mt-6 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="report-card rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <h3 className="text-base font-semibold text-white">Status Summary</h3>
            <table className="report-table mt-3 w-full text-left text-sm">
              <tbody>
                {statusRows.map(([label, value]) => (
                  <tr key={label} className="border-t border-slate-800">
                    <th className="py-3 font-medium text-slate-400">{label}</th>
                    <td className="py-3 text-right font-semibold text-white">{Number(value || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="report-card rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <h3 className="text-base font-semibold text-white">Brand Mix</h3>
            <div className="mt-4 grid gap-3">
              {brandBreakdown.length ? brandBreakdown.map((brand) => (
                <div key={brand.brand}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-white">{brand.brand}</span>
                    <span className="text-slate-400">{brand.total} listings</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-800">
                    <div className="h-2 rounded-full bg-brand-500" style={{ width: `${Math.min(100, Math.max(8, brand.total * 10))}%` }} />
                  </div>
                </div>
              )) : <p className="text-sm text-slate-400">No brand data available.</p>}
            </div>
          </div>
        </section>

        <section className="report-section mt-6">
          <h3 className="text-lg font-semibold text-white">Current Inventory</h3>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-800">
            <table className="report-table w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-950/80 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Listing</th>
                  <th className="px-4 py-3">Brand</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Date added</th>
                  <th className="px-4 py-3">Mileage / Availability</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {cars.length ? cars.map((car) => (
                  <tr key={car._id}>
                    <td className="px-4 py-3 font-medium text-white">{car.title}</td>
                    <td className="px-4 py-3 text-slate-300">{car.brand}</td>
                    <td className="px-4 py-3 text-slate-300">{getCarCategoryLabel(car.category)}</td>
                    <td className="px-4 py-3 text-slate-300">{car.createdAt ? new Date(car.createdAt).toLocaleDateString() : 'N/A'}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {car.category === 'accessory'
                        ? getAccessoryAvailabilityLabel(car.availabilityStatus)
                        : `${Number(car.mileage || 0).toLocaleString()} km`}
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">R {Number(car.price || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-300">{car.isSold ? 'Sold' : 'Available'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td className="px-4 py-5 text-slate-400" colSpan="7">No inventory records available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </article>
    </div>
  );
}

function SettingsPage() {
  const [settings, setSettings] = useState(() => {
    const defaults = {
      companyName: 'AutoWorld',
      logo: '',
      phone: '',
      email: '',
      whatsapp: '',
      address: '',
      socials: ''
    };

    const saved = window.localStorage.getItem('autoworld-admin-settings');
    if (!saved) return defaults;

    try {
      return { ...defaults, ...JSON.parse(saved) };
    } catch (_error) {
      return defaults;
    }
  });

  function saveSettings(event) {
    event.preventDefault();
    window.localStorage.setItem('autoworld-admin-settings', JSON.stringify(settings));
    window.alert('Settings updated.');
  }

  return (
    <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">System settings</h2>
        <p className="text-sm text-slate-400">Manage the main company profile used throughout the dashboard.</p>
      </div>

      <form onSubmit={saveSettings} className="grid gap-4 lg:grid-cols-2">
        <label className="text-sm text-slate-300">
          <span className="mb-1 block">Company name</span>
          <input value={settings.companyName} onChange={(event) => setSettings((prev) => ({ ...prev, companyName: event.target.value }))} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
        </label>
        <label className="text-sm text-slate-300">
          <span className="mb-1 block">Logo URL</span>
          <input value={settings.logo} onChange={(event) => setSettings((prev) => ({ ...prev, logo: event.target.value }))} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
        </label>
        <label className="text-sm text-slate-300">
          <span className="mb-1 block">Phone</span>
          <input value={settings.phone} onChange={(event) => setSettings((prev) => ({ ...prev, phone: event.target.value }))} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
        </label>
        <label className="text-sm text-slate-300">
          <span className="mb-1 block">Email</span>
          <input value={settings.email} onChange={(event) => setSettings((prev) => ({ ...prev, email: event.target.value }))} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
        </label>
        <label className="text-sm text-slate-300">
          <span className="mb-1 block">WhatsApp</span>
          <input value={settings.whatsapp} onChange={(event) => setSettings((prev) => ({ ...prev, whatsapp: event.target.value }))} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
        </label>
        <label className="text-sm text-slate-300">
          <span className="mb-1 block">Address</span>
          <input value={settings.address} onChange={(event) => setSettings((prev) => ({ ...prev, address: event.target.value }))} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
        </label>
        <label className="text-sm text-slate-300 lg:col-span-2">
          <span className="mb-1 block">Social links</span>
          <textarea value={settings.socials} onChange={(event) => setSettings((prev) => ({ ...prev, socials: event.target.value }))} rows="3" className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
        </label>
        <div className="lg:col-span-2">
          <button type="submit" className="rounded-2xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white">Save settings</button>
        </div>
      </form>
    </div>
  );
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();

  if (!isAuthenticated()) {
    return <Navigate to={ADMIN_LOGIN_PATH} replace />;
  }

  return (
    <AdminLayout
      title="Admin dashboard"
      subtitle="Manage inventory, operations, and team access from a single control room."
      actions={[
        <button key="new" type="button" onClick={() => navigate(dashboardPath('add-car'))} className="flex items-center gap-2 rounded-2xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600">
          <PlusCircle className="h-4 w-4" />
          Add vehicle
        </button>
      ]}
    >
      <Routes>
        <Route index element={<DashboardHome />} />
        <Route path="cars" element={<InventoryPage title="All cars" description="Manage every active, sold, auction, and special-offer listing." emptyMessage="No cars found in inventory." />} />
        <Route path="add-car" element={<AddCarPage />} />
        <Route path="sell-requests" element={<SellRequestsPage />} />
        <Route path="sold-cars" element={<InventoryPage title="Sold cars" description="Review sold vehicles and move them back to available stock when needed." defaultStatus="sold" lockStatus emptyMessage="No sold vehicles found." />} />
        <Route path="auctions" element={<InventoryPage title="Auctions" description="Manage listings marked for auction workflows." query={{ listingType: 'auction' }} emptyMessage="No auction listings found." />} />
        <Route path="special-offers" element={<InventoryPage title="Special offers" description="Manage discounted, promoted, and featured offer listings." query={{ listingType: 'special' }} emptyMessage="No special offer listings found." />} />
        <Route path="admin-users" element={<AdminUsersPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Routes>
    </AdminLayout>
  );
}
