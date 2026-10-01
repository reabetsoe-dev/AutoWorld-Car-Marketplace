import { lazy, Suspense } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import {
  Building2,
  CircleDollarSign,
  Handshake,
  Home,
  Info,
  Landmark,
  Mail,
  MapPinned,
} from "lucide-react";
import ProtectedRoute from "./components/ProtectedRoute";
import { ADMIN_DASHBOARD_PATH, ADMIN_LOGIN_PATH } from "./config/adminPaths";
import { showroomImages } from "./data/visualAssets";

const HomePage = lazy(() => import("./pages/HomePage"));
const BuyCarsPage = lazy(() => import("./pages/BuyCarsPage"));
const SellMyCarPage = lazy(() => import("./pages/SellMyCarPage"));
const CarDetailPage = lazy(() => import("./pages/CarDetailPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const AdminLoginPage = lazy(() => import("./pages/AdminLoginPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));

const navItems = [
  { to: "/about", label: "About", icon: Info },
  { to: "/contact-us", label: "Contact", icon: Mail }
];

const infoPages = {
  finance: {
    icon: CircleDollarSign,
    image: showroomImages.finance,
    kicker: "Finance and services",
    title: "Flexible ownership support",
    text: "Finance, insurance, tracking and warranty options arranged around the way you drive.",
    points: ["Vehicle finance", "Warranty cover", "Tracking and protection"]
  },
  locations: {
    icon: MapPinned,
    image: showroomImages.locations,
    kicker: "AutoWorld branches",
    title: "Showrooms close to your next drive",
    text: "Visit our sales teams for valuations, test drives and handovers across our branch network.",
    points: ["Maseru showroom", "Midrand partner desk", "Germiston operations"]
  },
  about: {
    icon: Building2,
    image: showroomImages.about,
    kicker: "About AutoWorld",
    title: "A sharper way to buy and sell",
    text: "AutoWorld combines inspected stock, clear pricing and responsive support for a calmer car journey.",
    points: ["Inspected vehicles", "Transparent listings", "Fast sales support"]
  },
  contact: {
    icon: Mail,
    image: showroomImages.operations,
    kicker: "Contact us",
    title: "Talk to a real vehicle specialist",
    text: "Reach the AutoWorld team for listing questions, valuations, finance support and branch bookings.",
    points: ["Sales enquiries", "Valuation support", "After-sales guidance"]
  },
  investors: {
    icon: Landmark,
    image: showroomImages.showroom,
    kicker: "Investor relations",
    title: "Marketplace growth with operational discipline",
    text: "A modern inventory platform built for retail visibility, workflow control and measurable demand.",
    points: ["Digital inventory", "Admin controls", "Marketplace analytics"]
  }
};

function InfoStubPage({ pageKey }) {
  const page = infoPages[pageKey] || infoPages.about;
  const Icon = page.icon;

  return (
    <section className="info-page">
      <div
        className="info-hero"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(11, 18, 32, 0.82), rgba(11, 18, 32, 0.48)), url(${page.image})`
        }}
      >
        <div className="info-hero__content">
          <span className="eyebrow">
            <Icon size={16} />
            {page.kicker}
          </span>
          <h1>{page.title}</h1>
          <p>{page.text}</p>
        </div>
      </div>
      <div className="info-grid">
        {page.points.map((point) => (
          <article className="panel info-card" key={point}>
            <Handshake size={22} />
            <span>{point}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function RouteFallback() {
  return (
    <div className="route-loading" role="status">
      Loading page...
    </div>
  );
}

function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__brand">
          <NavLink to="/" className="aw-logo" aria-label="AutoWorld">
            <img src="/assets/autoworld-logo.png" alt="AutoWorld Marketplace" />
          </NavLink>
        </div>
        <nav className="topbar__nav">
          <NavLink to="/" end>
            <Home size={15} />
            Home
          </NavLink>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to}>
                <Icon size={15} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </header>

      <main className="page-wrap">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/buy-a-car" element={<BuyCarsPage />} />
            <Route path="/sell-my-car" element={<SellMyCarPage />} />
            <Route
              path="/finance-services"
              element={<InfoStubPage pageKey="finance" />}
            />
            <Route path="/locations" element={<InfoStubPage pageKey="locations" />} />
            <Route path="/about" element={<InfoStubPage pageKey="about" />} />
            <Route path="/contact-us" element={<ContactPage />} />
            <Route path="/investors" element={<InfoStubPage pageKey="investors" />} />
            <Route path="/cars/:id" element={<CarDetailPage />} />
            <Route path={ADMIN_LOGIN_PATH} element={<AdminLoginPage />} />
            <Route
              path={`${ADMIN_DASHBOARD_PATH}/*`}
              element={
                <ProtectedRoute>
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="/admin" element={<Navigate to="/" replace />} />
            <Route path="/admin/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default App;
