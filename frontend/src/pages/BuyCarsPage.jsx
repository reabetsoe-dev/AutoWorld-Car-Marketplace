import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownUp,
  BadgePercent,
  Bike,
  CarFront,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Fuel,
  Gauge,
  Gavel,
  MapPin,
  MessageCircle,
  Search,
  SlidersHorizontal,
  Truck,
  Wrench,
  X
} from "lucide-react";
import { getCars } from "../services/api";
import { getGalleryImages } from "../data/visualAssets";
import { CAR_CATEGORY_OPTIONS } from "../constants/carCategories";
import { getAccessoryAvailabilityLabel } from "../constants/accessoryAvailability";
import { buildWhatsappEnquiryUrl } from "../utils/whatsapp";

const defaultQuery = {
  search: "",
  brand: "",
  fuelType: "",
  maxPrice: "",
  maxMileage: "",
  sort: "newest"
};

const topTabs = [
  { id: "all", label: "All", icon: CarFront },
  { id: "auctions", label: "Auctions", icon: Gavel },
  { id: "special", label: "Special Offers", icon: BadgePercent }
];

const segments = [
  { id: "car", label: "Cars", icon: CarFront },
  { id: "bakkie", label: "Bakkies", icon: Truck },
  { id: "motorcycle", label: "Motorcycles", icon: Bike },
  { id: "commercial", label: "Commercial", icon: Truck },
  { id: "accessory", label: "Accessories", icon: Wrench }
];

const validCategories = new Set(CAR_CATEGORY_OPTIONS.map((category) => category.value));

const filterSections = [
  "Sort",
  "Promotions",
  "Price",
  "Installment",
  "Kilometres",
  "Year",
  "Make",
  "Model",
  "Variant",
  "Province",
  "Branch",
  "Body Type",
  "Gearbox",
  "Fuel Type",
  "Colour",
  "Number of seats",
  "Rating",
  "Condition Rating",
  "Ownership Status"
];

const sortGroups = [
  {
    title: "Recommended",
    options: [{ id: "newest", label: "Recommended" }]
  },
  {
    title: "Price",
    options: [
      { id: "priceDesc", label: "Highest to Lowest" },
      { id: "priceAsc", label: "Lowest to Highest" }
    ]
  },
  {
    title: "Kilometres",
    options: [
      { id: "mileageDesc", label: "Highest to Lowest" },
      { id: "mileageAsc", label: "Lowest to Highest" }
    ]
  },
  {
    title: "Year",
    options: [
      { id: "newest", label: "Newest to Oldest" },
      { id: "oldest", label: "Oldest to Newest" }
    ]
  },
  {
    title: "Fuel Consumption",
    options: [
      { id: "fuelDesc", label: "Highest to Lowest", disabled: true },
      { id: "fuelAsc", label: "Lowest to Highest", disabled: true }
    ]
  }
];

function formatPrice(value) {
  return `R ${Number(value || 0).toLocaleString()}`;
}

function formatCount(value) {
  return Number(value || 0).toLocaleString();
}

function getListingTypeQuery(tabId) {
  if (tabId === "auctions") return { listingType: "auction" };
  if (tabId === "special") return { listingType: "special" };
  return {};
}

function getCategoryQuery(categoryId) {
  return validCategories.has(categoryId) ? { category: categoryId } : {};
}

function BuyCarsPage() {
  const [activeTopTab, setActiveTopTab] = useState("all");
  const [activeSegment, setActiveSegment] = useState("car");
  const [queryForm, setQueryForm] = useState(defaultQuery);
  const [appliedQuery, setAppliedQuery] = useState(defaultQuery);
  const [cars, setCars] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1
  });
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cardImageIndexes, setCardImageIndexes] = useState({});

  useEffect(() => {
    async function loadCars() {
      setIsLoading(true);
      setError("");
      try {
        const response = await getCars({
          ...appliedQuery,
          ...getListingTypeQuery(activeTopTab),
          ...getCategoryQuery(activeSegment),
          page,
          limit: pagination.limit
        });
        const liveCars = response.data || [];
        setCars(liveCars);
        setPagination((prev) => ({ ...prev, ...(response.pagination || prev) }));
      } catch (err) {
        setCars([]);
        setPagination((prev) => ({
          ...prev,
          page: 1,
          total: 0,
          totalPages: 1
        }));
        setError(err.message || "Live inventory is reconnecting.");
      } finally {
        setIsLoading(false);
      }
    }

    loadCars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedQuery, page, activeTopTab, activeSegment]);

  const activeFilterCount = useMemo(() => {
    return [
      appliedQuery.search,
      appliedQuery.brand,
      appliedQuery.fuelType,
      appliedQuery.maxPrice,
      appliedQuery.maxMileage
    ].filter(Boolean).length;
  }, [appliedQuery]);

  const totalPages = Math.max(1, pagination.totalPages || 1);
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const pageNumbers = Array.from({ length: Math.min(6, totalPages) }, (_, index) => index + 1);
  const resultStart = cars.length ? (currentPage - 1) * pagination.limit + 1 : 0;
  const resultEnd = cars.length ? resultStart + cars.length - 1 : 0;
  const marketLayoutClassName = [
    "market-layout",
    showFilters ? "market-layout--with-filter" : "",
    showSort ? "market-layout--with-sort" : ""
  ].filter(Boolean).join(" ");

  function applyField(name, value) {
    setQueryForm((prev) => ({ ...prev, [name]: value }));
    setAppliedQuery((prev) => ({ ...prev, [name]: value }));
    setPage(1);
  }

  function submitSearch(event) {
    event.preventDefault();
    setPage(1);
    setAppliedQuery(queryForm);
  }

  function clearFilters() {
    const reset = { ...queryForm, search: "", brand: "", fuelType: "", maxPrice: "", maxMileage: "" };
    setQueryForm(reset);
    setAppliedQuery((prev) => ({ ...prev, search: "", brand: "", fuelType: "", maxPrice: "", maxMileage: "" }));
    setPage(1);
  }

  function clearSort() {
    setQueryForm((prev) => ({ ...prev, sort: "newest" }));
    setAppliedQuery((prev) => ({ ...prev, sort: "newest" }));
    setPage(1);
  }

  function toggleFilters() {
    setShowFilters((value) => {
      const nextValue = !value;
      if (nextValue) setShowSort(false);
      return nextValue;
    });
  }

  function toggleSort() {
    setShowSort((value) => {
      const nextValue = !value;
      if (nextValue) setShowFilters(false);
      return nextValue;
    });
  }

  function selectTopTab(tabId) {
    setActiveTopTab(tabId);
    setPage(1);
  }

  function showCardImage(car, direction) {
    const images = getGalleryImages(car);
    if (images.length <= 1) return;

    setCardImageIndexes((prev) => ({
      ...prev,
      [car._id]: ((prev[car._id] || 0) + direction + images.length) % images.length
    }));
  }

  function renderFilterControl(sectionLabel) {
    if (sectionLabel === "Price") {
      return (
        <div className="filter-control">
          <label htmlFor="max-price">Maximum price</label>
          <input
            id="max-price"
            type="number"
            value={queryForm.maxPrice}
            onChange={(event) => applyField("maxPrice", event.target.value)}
            placeholder="200000"
          />
        </div>
      );
    }

    if (sectionLabel === "Kilometres") {
      return (
        <div className="filter-control">
          <label htmlFor="max-mileage">Maximum kilometres</label>
          <input
            id="max-mileage"
            type="number"
            value={queryForm.maxMileage}
            onChange={(event) => applyField("maxMileage", event.target.value)}
            placeholder="90000"
          />
        </div>
      );
    }

    if (sectionLabel === "Make") {
      return (
        <div className="filter-control">
          <label htmlFor="brand-filter">Brand</label>
          <input
            id="brand-filter"
            value={queryForm.brand}
            onChange={(event) => applyField("brand", event.target.value)}
            placeholder="Toyota"
          />
        </div>
      );
    }

    if (sectionLabel === "Fuel Type") {
      return (
        <div className="filter-control">
          <label htmlFor="fuel-filter">Fuel type</label>
          <select
            id="fuel-filter"
            value={queryForm.fuelType}
            onChange={(event) => applyField("fuelType", event.target.value)}
          >
            <option value="">Any</option>
            <option value="petrol">Petrol</option>
            <option value="diesel">Diesel</option>
            <option value="hybrid">Hybrid</option>
            <option value="electric">Electric</option>
          </select>
        </div>
      );
    }

    return <div className="filter-control-placeholder">Select options</div>;
  }

  return (
    <section className="market-page">
      <div className="market-top-tabs panel">
        {topTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              className={`market-top-tab ${activeTopTab === tab.id ? "is-active" : ""}`}
              key={tab.id}
              type="button"
              onClick={() => selectTopTab(tab.id)}
            >
              <Icon size={17} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="market-segments">
        {segments.map((segment) => {
          const Icon = segment.icon;
          return (
            <button
              className={`market-segment ${activeSegment === segment.id ? "is-active" : ""}`}
              key={segment.id}
              type="button"
              onClick={() => {
                setActiveSegment(segment.id);
                setPage(1);
              }}
            >
              <Icon size={19} />
              <span>{segment.label}</span>
            </button>
          );
        })}
      </div>

      <form className="market-search-row panel" onSubmit={submitSearch}>
        <label className="market-search-input">
          <Search size={18} />
          <input
            placeholder="Search make, model, year..."
            value={queryForm.search}
            onChange={(event) =>
              setQueryForm((prev) => ({ ...prev, search: event.target.value }))
            }
          />
        </label>
        <button className="btn btn--primary" type="submit">
          <Search size={17} />
          Search
        </button>
      </form>

      <div className="market-controls-row">
        <div className="market-controls-row__left">
          <button className="market-chip-btn" onClick={toggleFilters} type="button">
            <SlidersHorizontal size={17} />
            Filter and sort
          </button>
          {activeFilterCount > 0 ? (
            <button className="market-clear-inline" onClick={clearFilters} type="button">
              Clear all selections
            </button>
          ) : null}
        </div>

        <div className="market-controls-row__center">
          <button
            className="page-arrow"
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            <ChevronLeft size={17} />
          </button>
          {pageNumbers.map((pageNumber) => (
            <button
              className={`page-number ${currentPage === pageNumber ? "is-active" : ""}`}
              key={pageNumber}
              type="button"
              onClick={() => setPage(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
          <button
            className="page-arrow"
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          >
            <ChevronRight size={17} />
          </button>
          <span className="market-results-caption">
            (Showing {resultStart} - {resultEnd} of {formatCount(pagination.total)})
          </span>
        </div>

        <button className="market-chip-btn market-sort-trigger" onClick={toggleSort} type="button">
          <ArrowDownUp size={17} />
          Sort
        </button>
      </div>

      <div className={marketLayoutClassName}>
        {showFilters ? (
          <aside className="market-filter panel">
            <div className="filter-panel-head">
              <h3>FILTER AND SORT</h3>
              <button type="button" onClick={() => setShowFilters(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="order-filters-by">
              <span>Order filters by:</span>
              <select value={queryForm.sort} onChange={(event) => applyField("sort", event.target.value)}>
                <option value="newest">Recommended</option>
                <option value="priceDesc">Price high to low</option>
                <option value="priceAsc">Price low to high</option>
                <option value="mileageAsc">Lowest kilometres</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>

            <div className="market-accordion">
              {filterSections.map((section) => (
                <details key={section}>
                  <summary>{section}</summary>
                  {renderFilterControl(section)}
                </details>
              ))}
            </div>

            <div className="panel-actions-col">
              <button className="btn btn--secondary" type="button" onClick={clearFilters}>
                <X size={16} />
                Clear filters
              </button>
              <button className="btn btn--dark" type="button" onClick={() => setShowFilters(false)}>
                Close filters
              </button>
            </div>
          </aside>
        ) : null}

        <div className="market-results">
          {error ? (
            <p className="notice notice--error">{error}</p>
          ) : null}
          {isLoading ? <p>Loading inventory...</p> : null}
          {!isLoading && !error && cars.length === 0 ? (
            <p>No listings available{activeFilterCount ? " for your filters" : ""}. Please check back soon.</p>
          ) : null}

          <div className="market-grid">
            {cars.map((car) => {
              const cardImages = getGalleryImages(car);
              const isAccessory = car.category === "accessory";
              const cardImageIndex = Math.min(
                cardImageIndexes[car._id] || 0,
                cardImages.length - 1
              );

              return (
                <article className="market-card" key={car._id}>
                  <div className="market-card__media">
                    <Link to={`/cars/${car._id}`} className="market-card__image">
                      <img src={cardImages[cardImageIndex]} alt={car.title} />
                    </Link>
                    {cardImages.length > 1 ? (
                      <>
                        <button
                          aria-label={`Show previous image for ${car.title}`}
                          className="market-card__image-arrow market-card__image-arrow--prev"
                          title="Previous image"
                          type="button"
                          onClick={() => showCardImage(car, -1)}
                        >
                          <ChevronLeft size={19} />
                        </button>
                        <button
                          aria-label={`Show next image for ${car.title}`}
                          className="market-card__image-arrow market-card__image-arrow--next"
                          title="Next image"
                          type="button"
                          onClick={() => showCardImage(car, 1)}
                        >
                          <ChevronRight size={19} />
                        </button>
                      </>
                    ) : null}
                  </div>
                  <div className="market-card__body">
                    <h3>{car.title}</h3>
                    <div className="market-card__price">{formatPrice(car.price)}</div>
                    <div className="market-card__chips">
                      {isAccessory ? (
                        <>
                          <span>
                            <Wrench size={14} />
                            Accessory
                          </span>
                          <span>
                            <CheckCircle2 size={14} />
                            {getAccessoryAvailabilityLabel(car.availabilityStatus)}
                          </span>
                        </>
                      ) : (
                        <>
                          <span>
                            <Gauge size={14} />
                            {formatCount(car.mileage)} km
                          </span>
                          <span>
                            <Fuel size={14} />
                            {car.fuelType || "Petrol"}
                          </span>
                        </>
                      )}
                      <span>
                        <MapPin size={14} />
                        {car.location || "Maseru"}
                      </span>
                    </div>
                    {car.isAuction || car.isSpecialOffer ? (
                      <div className="listing-badge-row market-card__badges">
                        {car.isAuction ? <span className="listing-badge listing-badge--auction"><Gavel size={13} />Auction</span> : null}
                        {car.isSpecialOffer ? <span className="listing-badge listing-badge--special"><BadgePercent size={13} />Special</span> : null}
                      </div>
                    ) : null}
                    <div className="market-card__actions">
                      <a
                        className="btn btn--primary"
                        href={buildWhatsappEnquiryUrl(car, formatPrice)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <MessageCircle size={16} />
                        Enquire on WhatsApp
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {!isLoading && cars.length > 0 ? (
            <div className="market-bottom-controls market-bottom-controls--pagination-only">
              <div className="market-bottom-pagination">
                <div className="market-bottom-pagination__pages">
                  {pageNumbers.map((pageNumber) => (
                    <button
                      className={`bottom-page-number ${currentPage === pageNumber ? "is-active" : ""}`}
                      key={pageNumber}
                      type="button"
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  ))}
                  <button
                    className="bottom-page-arrow"
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    <ChevronRight size={20} />
                  </button>
                  <button
                    className="bottom-page-arrow"
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage(totalPages)}
                    aria-label="Last page"
                  >
                    &gt;|
                  </button>
                </div>
                <div className="market-bottom-pagination__caption">
                  (Showing {resultStart} - {resultEnd} of {formatCount(pagination.total)})
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {showSort ? (
          <aside className="market-sort panel">
            <div className="sort-panel-head">
              <h3>SORT MY SEARCH</h3>
              <button type="button" onClick={() => setShowSort(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="market-sort-list">
              {sortGroups.map((group) => (
                <section className="sort-group" key={group.title}>
                  <h4>{group.title}</h4>
                  {group.options.map((option) => (
                    <label key={option.id}>
                      <input
                        type="radio"
                        name="sort"
                        checked={appliedQuery.sort === option.id}
                        disabled={option.disabled}
                        onChange={() => applyField("sort", option.id)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </section>
              ))}
            </div>

            <div className="panel-actions-col">
              <button className="btn btn--secondary" type="button" onClick={clearSort}>
                <X size={16} />
                Clear sort
              </button>
              <button className="btn btn--dark" type="button" onClick={() => setShowSort(false)}>
                Close sort
              </button>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

export default BuyCarsPage;
