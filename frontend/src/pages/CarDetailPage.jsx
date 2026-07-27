import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CarFront,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Fuel,
  Gauge,
  MapPin,
  MessageCircle,
  Sparkles,
  Wrench
} from "lucide-react";
import { getCarById } from "../services/api";
import { findFallbackCar, getGalleryImages } from "../data/visualAssets";
import { buildWhatsappEnquiryUrl } from "../utils/whatsapp";

function formatPrice(value) {
  return `R ${Number(value || 0).toLocaleString()}`;
}

function monthlyEstimate(price) {
  return Math.max(1, Math.round((Number(price || 0) * 1.18) / 48));
}

function CarDetailPage() {
  const { id } = useParams();
  const [car, setCar] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    async function loadCar() {
      setIsLoading(true);
      setError("");
      try {
        const response = await getCarById(id);
        setCar(response);
      } catch (err) {
        const fallbackCar = findFallbackCar(id);
        if (fallbackCar) {
          setCar(fallbackCar);
        } else {
          setError(err.message || "Could not load car details.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadCar();
  }, [id]);

  const gallery = useMemo(() => {
    return getGalleryImages(car);
  }, [car]);

  const whatsappUrl = useMemo(() => {
    return buildWhatsappEnquiryUrl(car, formatPrice);
  }, [car]);

  function showGalleryImage(direction) {
    setActiveImageIndex((currentIndex) => {
      return (currentIndex + direction + gallery.length) % gallery.length;
    });
  }

  if (isLoading) return <p>Loading car details...</p>;

  if (error) {
    return (
      <section>
        <p className="notice notice--error">{error}</p>
        <Link to="/buy-a-car" className="car-link">
          Back to search
        </Link>
      </section>
    );
  }

  if (!car) return <p>Car not found.</p>;

  return (
    <section className="detail-page">
      <Link className="detail-back-link" to="/buy-a-car">
        <ArrowLeft size={17} />
        Back to search
      </Link>

      <div className="detail-hero-grid">
        <article className="panel detail-gallery-card">
          <div className="detail-main-media">
            <img
              alt={car.title}
              className="detail-main-image"
              src={gallery[activeImageIndex]}
            />
            <button
              aria-label="Previous vehicle image"
              className="detail-gallery-arrow detail-gallery-arrow--prev"
              title="Previous image"
              type="button"
              onClick={() => showGalleryImage(-1)}
            >
              <ChevronLeft size={22} />
            </button>
            <button
              aria-label="Next vehicle image"
              className="detail-gallery-arrow detail-gallery-arrow--next"
              title="Next image"
              type="button"
              onClick={() => showGalleryImage(1)}
            >
              <ChevronRight size={22} />
            </button>
          </div>
          <div className="detail-thumb-strip">
            {gallery.slice(0, 6).map((imageUrl, index) => (
              <button
                className={`detail-thumb ${activeImageIndex === index ? "is-active" : ""}`}
                key={imageUrl}
                onClick={() => setActiveImageIndex(index)}
                type="button"
              >
                <img alt={`thumb-${index + 1}`} src={imageUrl} />
              </button>
            ))}
          </div>
        </article>

        <aside className="panel detail-summary-card">
          <h1>{car.title}</h1>
          <div className="detail-price">{formatPrice(car.price)}</div>
          
          <div className="detail-info-chips">
           
            <span>
              <CheckCircle2 size={15} />
              Ready
            </span>
           
          </div>

          <div className="detail-quick-spec-grid">
            <div>
              <strong>
                <Gauge size={15} />
                Mileage
              </strong>
              <span>{Number(car.mileage || 0).toLocaleString()} km</span>
            </div>
            <div>
              <strong>
                <CarFront size={15} />
                Drive Type
              </strong>
              <span>4x2</span>
            </div>
            <div>
              <strong>
                <Wrench size={15} />
                Transmission
              </strong>
              <span>{car.transmission || "Manual"}</span>
            </div>
            <div>
              <strong>
                <Fuel size={15} />
                Fuel
              </strong>
              <span>{car.fuelType || "Petrol"}</span>
            </div>
            <div>
              <strong>
                <Gauge size={15} />
                Consumption
              </strong>
              <span>5.2 l/100km</span>
            </div>
            <div>
              <strong>
                <Wrench size={15} />
                Engine Cap
              </strong>
              <span>1198 cc</span>
            </div>
          </div>

          <div className="button-row">
            <a
              className="btn btn--primary"
              href={whatsappUrl}
              rel="noreferrer"
              target="_blank"
            >
              <MessageCircle size={18} />
              WhatsApp enquiry
            </a>
          </div>
        </aside>
      </div>

      <div className="detail-lower-grid">
        <div className="detail-main-content">
          <section className="panel detail-spec-card">
            <h2>VEHICLE DETAILS</h2>
            <ul>
              <li>
                <span>Make:</span>
                <strong>{car.brand || "Datsun"}</strong>
              </li>
              <li>
                <span>Model:</span>
                <strong>{car.model || "GO"}</strong>
              </li>
              <li>
                <span>Mileage:</span>
                <strong>{Number(car.mileage || 0).toLocaleString()} KM</strong>
              </li>
              <li>
                <span>Transmission:</span>
                <strong>{car.transmission || "Manual"}</strong>
              </li>
              <li>
                <span>Fuel Type:</span>
                <strong>{car.fuelType || "Petrol"}</strong>
              </li>
            </ul>
          </section>
        </div>

      </div>
    </section>
  );
}

export default CarDetailPage;
