import { Link } from "react-router-dom";
import {
  HandCoins,
  Search,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { showroomImages } from "../data/visualAssets";

function HomePage() {
  return (
    <section className="landing-page">
      <section
        className="landing-hero"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(8, 14, 24, 0.9), rgba(8, 14, 24, 0.48), rgba(8, 14, 24, 0.18)), url(${showroomImages.hero})`
        }}
      >
        <div className="landing-hero__content">
          <span className="eyebrow">
            <Sparkles size={16} />
            Trusted vehicle marketplace
          </span>
          <h1>AutoWorld Marketplace</h1>
          <p>
            Buy with confidence. Sell with ease.
            <br />
            Find inspected vehicles or list your car on one trusted marketplace.
          </p>
          <div className="landing-hero__actions">
            <Link className="btn btn--primary" to="/sell-my-car">
              <HandCoins size={18} />
              Sell my car
            </Link>
            <Link className="btn btn--light" to="/buy-a-car">
              <Search size={18} />
              Buy a car
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-highlights">
        <article className="panel landing-highlight-card">
          <Search size={24} />
          <h3>Fresh cars</h3>
          <p>Find inspected cars ready for viewing.</p>
        </article>
        <article className="panel landing-highlight-card">
          <HandCoins size={24} />
          <h3>Quick Selling</h3>
          <p>Submit your vehicle details and our team gets back fast.</p>
        </article>
        <article className="panel landing-highlight-card">
          <ShieldCheck size={24} />
          <h3>Trusted Support</h3>
          <p>Finance, tracking and warranty options under one roof.</p>
        </article>
      </section>
    </section>
  );
}

export default HomePage;
