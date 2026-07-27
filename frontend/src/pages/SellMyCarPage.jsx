import { useState } from "react";
import {
  Bike,
  CarFront,
  CheckCircle2,
  Clock3,
  FileCheck2,
  HandCoins,
  Sailboat,
  Save,
  Send,
  ShieldCheck,
  Truck,
  Wrench
} from "lucide-react";
import { showroomImages } from "../data/visualAssets";

const categories = [
  { id: "vehicle", label: "Vehicle", icon: CarFront },
  { id: "bike", label: "Bike", icon: Bike },
  { id: "caravan", label: "Caravan", icon: Truck },
  { id: "trailer", label: "Trailer", icon: Wrench },
  { id: "boat", label: "Boat", icon: Sailboat },
  { id: "other", label: "Other", icon: FileCheck2 }
];

function SellMyCarPage() {
  const [category, setCategory] = useState("vehicle");

  return (
    <section className="sell-page">
      <header
        className="sell-hero"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(10, 16, 27, 0.88), rgba(10, 16, 27, 0.58), rgba(10, 16, 27, 0.22)), url(${showroomImages.sell})`
        }}
      >
        <div>
          <span className="eyebrow">
            <HandCoins size={16} />
            Fast valuation desk
          </span>
          <h1>
            Sell your car with a clear, professional process
          </h1>
          <p>Get a price, book a branch handover and keep the paperwork simple.</p>
        </div>
      </header>

      <div className="sell-steps">
        <div className="is-active">
          <CheckCircle2 size={18} />
          Select category
        </div>
        <div>
          <CarFront size={18} />
          Vehicle details
        </div>
        <div>
          <ShieldCheck size={18} />
          About you
        </div>
      </div>

      <div className="sell-content panel">
        <div className="sell-content__main">
          <div className="section-head">
            <span className="section-kicker">Valuation intake</span>
            <h2>What are you selling?</h2>
          </div>
          <div className="sell-categories">
            {categories.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  className={`sell-category ${category === item.id ? "is-active" : ""}`}
                  key={item.id}
                  onClick={() => setCategory(item.id)}
                  type="button"
                >
                  <span className="sell-category__icon">
                    <Icon size={24} />
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <form className="sell-form">
            <label>
              Vehicle make
              <input placeholder="Toyota" />
            </label>
            <label>
              Model
              <input placeholder="Corolla" />
            </label>
            <label>
              Year
              <input placeholder="2020" type="number" />
            </label>
            <label>
              Mileage
              <input placeholder="45000" type="number" />
            </label>
            <label>
              Your phone number
              <input placeholder="+266..." />
            </label>
            <label>
              Branch
              <select>
                <option>Maseru</option>
                <option>Germiston</option>
                <option>Midrand</option>
              </select>
            </label>
            <div className="sell-form__actions">
              <button className="btn btn--primary" type="button">
                <Send size={17} />
                Get my offer
              </button>
              <button className="btn btn--secondary" type="button">
                <Save size={17} />
                Save and continue later
              </button>
            </div>
          </form>
        </div>

        <aside className="sell-content__visual">
          <img src={showroomImages.showroom} alt="AutoWorld showroom desk" />
          <div className="sell-assurance-list">
            <span>
              <Clock3 size={17} />
              Same-day response
            </span>
            <span>
              <FileCheck2 size={17} />
              Document guidance
            </span>
            <span>
              <ShieldCheck size={17} />
              Secure handover
            </span>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default SellMyCarPage;
