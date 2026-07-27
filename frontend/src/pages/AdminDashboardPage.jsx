import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgePercent,
  BarChart3,
  CarFront,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  FileUp,
  Gauge,
  Gavel,
  LogOut,
  Pencil,
  PlusCircle,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X
} from "lucide-react";
import {
  adminLogout,
  createAdminUser,
  createCar,
  deleteCar,
  getAdminCars,
  getAdminProfile,
  getAdminStats,
  getAdminUsers,
  getAuditLogs,
  markCarAvailable,
  markCarSold,
  updateAdminUser,
  updateCar,
  uploadCarImage,
  uploadCarsCsv
} from "../services/api";
import { clearSession, getStoredAdminProfile, saveSession } from "../services/auth";
import { ADMIN_LOGIN_PATH } from "../config/adminPaths";

const emptyCarForm = {
  title: "",
  brand: "",
  model: "",
  price: "",
  mileage: "",
  fuelType: "petrol",
  location: "",
  imageUrls: "",
  description: "",
  isAuction: false,
  isSpecialOffer: false
};

const defaultFilters = { search: "", status: "all", listingType: "all", sort: "newest" };
const emptyUserForm = { username: "", name: "", password: "", role: "editor" };

function formatPrice(value) {
  return `R ${Number(value || 0).toLocaleString()}`;
}

function formatDate(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
}

function splitImages(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function AdminDashboardPage() {
  const navigate = useNavigate();
  const imageFileRef = useRef(null);
  const csvFileRef = useRef(null);

  const [adminProfile, setAdminProfile] = useState(getStoredAdminProfile());
  const [cars, setCars] = useState([]);
  const [stats, setStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [users, setUsers] = useState([]);

  const [carForm, setCarForm] = useState(emptyCarForm);
  const [editingCarId, setEditingCarId] = useState(null);
  const [uploadImageFile, setUploadImageFile] = useState(null);
  const [importCsvFile, setImportCsvFile] = useState(null);
  const [newUserForm, setNewUserForm] = useState(emptyUserForm);

  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
    limit: 10
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [importSummary, setImportSummary] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingCar, setIsSavingCar] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const role = adminProfile?.role || "viewer";
  const canEditCars = role === "manager" || role === "editor";
  const canDeleteCars = role === "manager";
  const canImportCars = role === "manager" || role === "editor";
  const canViewAudit = role === "manager" || role === "editor";
  const canManageUsers = role === "manager";

  const previewImages = useMemo(() => splitImages(carForm.imageUrls), [carForm.imageUrls]);

  useEffect(() => {
    async function bootstrap() {
      try {
        const profileResponse = await getAdminProfile();
        setAdminProfile(profileResponse.admin);
        saveSession(undefined, undefined, profileResponse.admin);
      } catch (_error) {
        clearSession();
        navigate(ADMIN_LOGIN_PATH);
      } finally {
        setIsBootstrapping(false);
      }
    }
    bootstrap();
  }, [navigate]);

  useEffect(() => {
    if (!adminProfile) return;
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminProfile, appliedFilters, page]);

  async function loadDashboardData() {
    setError("");
    setIsLoading(true);
    try {
      const query = {
        page,
        limit: pagination.limit,
        sort: appliedFilters.sort,
        search: appliedFilters.search,
        status: appliedFilters.status === "all" ? "" : appliedFilters.status,
        listingType: appliedFilters.listingType === "all" ? "" : appliedFilters.listingType
      };
      const [inventory, statsResponse] = await Promise.all([
        getAdminCars(query),
        getAdminStats()
      ]);
      setCars(inventory.data || []);
      setPagination((prev) => ({ ...prev, ...(inventory.pagination || prev) }));
      setStats(statsResponse || null);

      if (canViewAudit) {
        const logsResponse = await getAuditLogs({ page: 1, limit: 8 });
        setAuditLogs(logsResponse.data || []);
      } else {
        setAuditLogs([]);
      }

      if (canManageUsers) {
        const usersResponse = await getAdminUsers();
        setUsers(usersResponse.data || []);
      } else {
        setUsers([]);
      }
    } catch (err) {
      setError(err.message || "Could not load admin dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }

  function resetCarForm() {
    setCarForm(emptyCarForm);
    setEditingCarId(null);
    setUploadImageFile(null);
    if (imageFileRef.current) imageFileRef.current.value = "";
  }

  function applyFilters(event) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  }

  function clearFilters() {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setPage(1);
  }

  function editCar(car) {
    if (!canEditCars) return;
    setEditingCarId(car._id);
    setCarForm({
      title: car.title || "",
      brand: car.brand || "",
      model: car.model || "",
      price: car.price || "",
      mileage: car.mileage || "",
      fuelType: car.fuelType || "other",
      location: car.location || "",
      imageUrls: (car.imageUrls || []).join(", "),
      description: car.description || "",
      isAuction: Boolean(car.isAuction),
      isSpecialOffer: Boolean(car.isSpecialOffer)
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveCar(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!canEditCars) {
      setError("Your role cannot create or edit listings.");
      return;
    }
    setIsSavingCar(true);
    try {
      const payload = {
        ...carForm,
        price: Number(carForm.price),
        mileage: Number(carForm.mileage)
      };
      if (editingCarId) {
        await updateCar(editingCarId, payload);
        setSuccess("Listing updated.");
      } else {
        await createCar(payload);
        setSuccess("Listing created.");
      }
      resetCarForm();
      await loadDashboardData();
    } catch (err) {
      setError(err.message || "Could not save listing.");
    } finally {
      setIsSavingCar(false);
    }
  }

  async function uploadImage() {
    setError("");
    setSuccess("");
    if (!canImportCars) return setError("Your role cannot upload images.");
    if (!uploadImageFile) return setError("Select an image file first.");
    setIsUploadingImage(true);
    try {
      const uploaded = await uploadCarImage(uploadImageFile);
      setCarForm((prev) => ({
        ...prev,
        imageUrls: prev.imageUrls ? `${prev.imageUrls}, ${uploaded.url}` : uploaded.url
      }));
      setUploadImageFile(null);
      if (imageFileRef.current) imageFileRef.current.value = "";
      setSuccess("Image uploaded.");
    } catch (err) {
      setError(err.message || "Could not upload image.");
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function importCsv() {
    setError("");
    setSuccess("");
    if (!canImportCars) return setError("Your role cannot run bulk imports.");
    if (!importCsvFile) return setError("Select a CSV file first.");
    setIsImporting(true);
    try {
      const result = await uploadCarsCsv(importCsvFile);
      setImportSummary(result);
      setImportCsvFile(null);
      if (csvFileRef.current) csvFileRef.current.value = "";
      setSuccess(
        `Import done: ${result.createdCount || 0} created, ${result.failedCount || 0} failed.`
      );
      await loadDashboardData();
    } catch (err) {
      setError(err.message || "Could not import CSV.");
    } finally {
      setIsImporting(false);
    }
  }

  async function markSold(id) {
    if (!canEditCars) return;
    try {
      await markCarSold(id);
      await loadDashboardData();
    } catch (err) {
      setError(err.message || "Could not update sold status.");
    }
  }

  async function markAvailable(id) {
    if (!canEditCars) return;
    try {
      await markCarAvailable(id);
      await loadDashboardData();
    } catch (err) {
      setError(err.message || "Could not update sold status.");
    }
  }

  async function removeCar(id) {
    if (!canDeleteCars) return setError("Only manager can delete listings.");
    const confirmed = window.confirm("Delete this listing permanently?");
    if (!confirmed) return;
    try {
      await deleteCar(id);
      await loadDashboardData();
    } catch (err) {
      setError(err.message || "Could not delete listing.");
    }
  }

  async function createUser(event) {
    event.preventDefault();
    if (!canManageUsers) return;
    setIsCreatingUser(true);
    setError("");
    try {
      await createAdminUser(newUserForm);
      setNewUserForm(emptyUserForm);
      await loadDashboardData();
    } catch (err) {
      setError(err.message || "Could not create user.");
    } finally {
      setIsCreatingUser(false);
    }
  }

  async function patchUser(id, patch) {
    if (!canManageUsers) return;
    setError("");
    try {
      await updateAdminUser(id, patch);
      await loadDashboardData();
    } catch (err) {
      setError(err.message || "Could not update user.");
    }
  }

  async function logout() {
    await adminLogout(false);
    navigate(ADMIN_LOGIN_PATH);
  }

  if (isBootstrapping) {
    return <p>Loading admin session...</p>;
  }

  const summary = stats?.summary || {};
  const statCards = [
    {
      label: "Total",
      value: summary.totalCars || 0,
      icon: CarFront,
      tone: "blue"
    },
    {
      label: "Available",
      value: summary.availableCars || 0,
      icon: CheckCircle2,
      tone: "green"
    },
    {
      label: "Sold",
      value: summary.soldCars || 0,
      icon: ShieldCheck,
      tone: "red"
    },
    {
      label: "Inventory Value",
      value: formatPrice(summary.totalInventoryValue),
      icon: CircleDollarSign,
      tone: "gold"
    },
    {
      label: "Avg Price",
      value: formatPrice(summary.averagePrice),
      icon: BarChart3,
      tone: "blue"
    },
    {
      label: "Avg Mileage",
      value: `${Math.round(summary.averageMileage || 0)} km`,
      icon: Gauge,
      tone: "slate"
    }
  ];

  return (
    <section className="admin-page">
      <div className="admin-header panel">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">
            Signed in as {adminProfile?.name || adminProfile?.username || "Admin"} ({role})
          </p>
        </div>
        <button className="btn btn--secondary" onClick={logout} type="button">
          <LogOut size={17} />
          Logout
        </button>
      </div>

      {error ? <p className="notice notice--error">{error}</p> : null}
      {success ? <p className="notice notice--success">{success}</p> : null}

      <div className="stats-grid">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <article className={`stat-card panel stat-card--${card.tone}`} key={card.label}>
              <div className="stat-card__icon">
                <Icon size={20} />
              </div>
              <div>
                <div className="stat-card__label">{card.label}</div>
                <div className="stat-card__value">{card.value}</div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="admin-layout admin-layout--wide">
        <div className="panel panel-body">
          <div className="section-head">
            <span className="section-kicker">Inventory editor</span>
            <h2>
              {editingCarId ? <Pencil size={20} /> : <PlusCircle size={20} />}
              {editingCarId ? "Edit listing" : "Add listing"}
            </h2>
          </div>
          <form onSubmit={saveCar}>
            <div className="field-group"><label>Title</label><input required disabled={!canEditCars} value={carForm.title} onChange={(e) => setCarForm((p) => ({ ...p, title: e.target.value }))} /></div>
            <div className="field-group"><label>Brand</label><input required disabled={!canEditCars} value={carForm.brand} onChange={(e) => setCarForm((p) => ({ ...p, brand: e.target.value }))} /></div>
            <div className="field-group"><label>Model</label><input disabled={!canEditCars} value={carForm.model} onChange={(e) => setCarForm((p) => ({ ...p, model: e.target.value }))} /></div>
            <div className="field-group"><label>Price</label><input type="number" required disabled={!canEditCars} value={carForm.price} onChange={(e) => setCarForm((p) => ({ ...p, price: e.target.value }))} /></div>
            <div className="field-group"><label>Mileage</label><input type="number" required disabled={!canEditCars} value={carForm.mileage} onChange={(e) => setCarForm((p) => ({ ...p, mileage: e.target.value }))} /></div>
            <div className="field-group"><label>Fuel</label><select disabled={!canEditCars} value={carForm.fuelType} onChange={(e) => setCarForm((p) => ({ ...p, fuelType: e.target.value }))}><option value="petrol">Petrol</option><option value="diesel">Diesel</option><option value="hybrid">Hybrid</option><option value="electric">Electric</option><option value="other">Other</option></select></div>
            <div className="field-group"><label>Location</label><input disabled={!canEditCars} value={carForm.location} onChange={(e) => setCarForm((p) => ({ ...p, location: e.target.value }))} /></div>
            <div className="field-group"><label>Image URLs</label><input disabled={!canEditCars} value={carForm.imageUrls} onChange={(e) => setCarForm((p) => ({ ...p, imageUrls: e.target.value }))} /></div>
            <div className="field-group"><label>Description</label><textarea disabled={!canEditCars} value={carForm.description} onChange={(e) => setCarForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <div className="field-group">
              <label>Listing controls</label>
              <div className="listing-toggle-row">
                <label className="listing-toggle">
                  <input
                    checked={carForm.isAuction}
                    disabled={!canEditCars}
                    type="checkbox"
                    onChange={(e) => setCarForm((p) => ({ ...p, isAuction: e.target.checked }))}
                  />
                  <Gavel size={16} />
                  Auction
                </label>
                <label className="listing-toggle">
                  <input
                    checked={carForm.isSpecialOffer}
                    disabled={!canEditCars}
                    type="checkbox"
                    onChange={(e) => setCarForm((p) => ({ ...p, isSpecialOffer: e.target.checked }))}
                  />
                  <BadgePercent size={16} />
                  Special offer
                </label>
              </div>
            </div>
            <div className="field-group"><label>Upload Image</label><input ref={imageFileRef} type="file" accept="image/*" disabled={!canImportCars} onChange={(e) => setUploadImageFile(e.target.files?.[0] || null)} /></div>
            <div className="button-row">
              <button className="btn btn--secondary" type="button" disabled={!canImportCars || isUploadingImage} onClick={uploadImage}><Upload size={16} />{isUploadingImage ? "Uploading..." : "Upload image"}</button>
              <button className="btn btn--primary" type="submit" disabled={!canEditCars || isSavingCar}><Save size={16} />{isSavingCar ? "Saving..." : editingCarId ? "Save changes" : "Create listing"}</button>
              {editingCarId ? <button className="btn btn--secondary" type="button" onClick={resetCarForm}><X size={16} />Cancel</button> : null}
            </div>
          </form>
          {previewImages.length > 0 ? (
            <div className="image-preview-grid">{previewImages.slice(0, 4).map((url) => <img key={url} src={url} alt="Preview" />)}</div>
          ) : null}
          <hr />
          <div className="section-head section-head--compact">
            <span className="section-kicker">Bulk tools</span>
            <h3>
              <FileUp size={18} />
              Bulk CSV Import
            </h3>
          </div>
          <div className="field-group"><label>CSV File</label><input ref={csvFileRef} type="file" accept=".csv,text/csv" disabled={!canImportCars} onChange={(e) => setImportCsvFile(e.target.files?.[0] || null)} /></div>
          <button className="btn btn--secondary" type="button" disabled={!canImportCars || isImporting} onClick={importCsv}><FileUp size={16} />{isImporting ? "Importing..." : "Import CSV"}</button>
          {importSummary ? <p className="page-subtitle">Created {importSummary.createdCount || 0}, failed {importSummary.failedCount || 0}</p> : null}
        </div>

        <div className="panel panel-body">
          <div className="section-head">
            <span className="section-kicker">Marketplace stock</span>
            <h2>
              <ClipboardList size={20} />
              Inventory
            </h2>
          </div>
          <form className="inventory-filter-row" onSubmit={applyFilters}>
            <input placeholder="Search title/brand/model" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} />
            <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}><option value="all">All</option><option value="available">Available</option><option value="sold">Sold</option></select>
            <select value={filters.listingType} onChange={(e) => setFilters((p) => ({ ...p, listingType: e.target.value }))}><option value="all">All listings</option><option value="auction">Auctions</option><option value="special">Special offers</option><option value="standard">Standard</option></select>
            <select value={filters.sort} onChange={(e) => setFilters((p) => ({ ...p, sort: e.target.value }))}><option value="newest">Newest</option><option value="priceAsc">Price low-high</option><option value="priceDesc">Price high-low</option><option value="mileageAsc">Mileage low-high</option><option value="mileageDesc">Mileage high-low</option></select>
            <button className="btn btn--secondary" type="submit"><Search size={16} />Apply</button>
            <button className="btn btn--secondary" type="button" onClick={clearFilters}><RotateCcw size={16} />Reset</button>
          </form>
          {isLoading ? <p>Loading inventory...</p> : null}
          {cars.length > 0 ? (
            <table className="inventory-table">
              <thead><tr><th>Car</th><th>Price</th><th>Status</th><th>Listing</th><th>Actions</th></tr></thead>
              <tbody>
                {cars.map((car) => (
                  <tr key={car._id}>
                    <td><strong>{car.title}</strong><div>{car.brand} - {car.mileage?.toLocaleString()} km</div></td>
                    <td>{formatPrice(car.price)}</td>
                    <td><span className={`status-pill ${car.isSold ? "status-pill--sold" : "status-pill--available"}`}>{car.isSold ? "Sold" : "Available"}</span></td>
                    <td>
                      <div className="listing-badge-row">
                        {car.isAuction ? <span className="listing-badge listing-badge--auction"><Gavel size={13} />Auction</span> : null}
                        {car.isSpecialOffer ? <span className="listing-badge listing-badge--special"><BadgePercent size={13} />Special</span> : null}
                        {!car.isAuction && !car.isSpecialOffer ? <span className="listing-badge">Standard</span> : null}
                      </div>
                    </td>
                    <td>
                      <div className="button-row">
                        <button className="btn btn--secondary" type="button" disabled={!canEditCars} onClick={() => editCar(car)}><Pencil size={15} />Edit</button>
                        {car.isSold ? <button className="btn btn--secondary" type="button" disabled={!canEditCars} onClick={() => markAvailable(car._id)}><CheckCircle2 size={15} />Mark available</button> : <button className="btn btn--secondary" type="button" disabled={!canEditCars} onClick={() => markSold(car._id)}><ShieldCheck size={15} />Mark sold</button>}
                        <button className="btn btn--danger" type="button" disabled={!canDeleteCars} onClick={() => removeCar(car._id)}><Trash2 size={15} />Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <div className="pagination">
            <button className="btn btn--secondary" type="button" disabled={pagination.page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Previous</button>
            <span>Page {pagination.page} of {pagination.totalPages} ({pagination.total} cars)</span>
            <button className="btn btn--secondary" type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}>Next</button>
          </div>
        </div>
      </div>

      {canViewAudit ? (
        <section className="panel panel-body admin-section">
          <div className="section-head">
            <span className="section-kicker">Governance</span>
            <h2>
              <ClipboardList size={20} />
              Recent Audit Activity
            </h2>
          </div>
          <div className="audit-list">
            {auditLogs.map((log) => (
              <article className="audit-item" key={log._id}>
                <div><strong>{log.action}</strong> by {log.actorUsername || "system"}</div>
                <div>{log.entityType || "n/a"} {log.entityId || ""}</div>
                <small>{formatDate(log.createdAt)}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {canManageUsers ? (
        <section className="panel panel-body admin-section">
          <div className="section-head">
            <span className="section-kicker">Access control</span>
            <h2>
              <Users size={20} />
              Admin Team
            </h2>
          </div>
          <form className="user-create-form" onSubmit={createUser}>
            <input placeholder="Username" value={newUserForm.username} onChange={(e) => setNewUserForm((p) => ({ ...p, username: e.target.value }))} required />
            <input placeholder="Full name" value={newUserForm.name} onChange={(e) => setNewUserForm((p) => ({ ...p, name: e.target.value }))} required />
            <input type="password" placeholder="Password (min 8 chars)" value={newUserForm.password} onChange={(e) => setNewUserForm((p) => ({ ...p, password: e.target.value }))} required />
            <select value={newUserForm.role} onChange={(e) => setNewUserForm((p) => ({ ...p, role: e.target.value }))}><option value="manager">Manager</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select>
            <button className="btn btn--primary" type="submit" disabled={isCreatingUser}><UserPlus size={16} />{isCreatingUser ? "Creating..." : "Create user"}</button>
          </form>
          {users.length > 0 ? (
            <table className="inventory-table" style={{ marginTop: 12 }}>
              <thead><tr><th>Name</th><th>Role</th><th>Active</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.name}</strong><div>{user.username}</div></td>
                    <td>{user.role}</td>
                    <td>{user.isActive ? "Yes" : "No"}</td>
                    <td>
                      <div className="button-row">
                        <select value={user.role} onChange={(e) => patchUser(user.id, { role: e.target.value })}><option value="manager">Manager</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select>
                        <button className="btn btn--secondary" type="button" onClick={() => patchUser(user.id, { isActive: !user.isActive })}><ShieldCheck size={15} />{user.isActive ? "Deactivate" : "Activate"}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}

export default AdminDashboardPage;
