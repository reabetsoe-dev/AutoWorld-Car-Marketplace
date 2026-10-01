import {
  Clock3,
  Mail,
  MessageCircle,
  Phone,
} from "lucide-react";
import { showroomImages } from "../data/visualAssets";

const primaryContacts = [
  {
    icon: Phone,
    title: "Main phone",
    value: "+266 6384 2459",
    detail: "General calls, branch help and urgent follow-up.",
    href: "tel:+26663842459"
  },
  {
    icon: MessageCircle,
    title: "WhatsApp",
    value: "+266 6384 2459",
    detail: "Fast enquiries, valuation updates and document questions.",
    href: "https://wa.me/26663842459"
  },
  {
    icon: Mail,
    title: "Email",
    value: "sales@autoworld.co.ls",
    detail: "Listings, appointments, finance and after-sales support.",
    href: "mailto:sales@autoworld.co.ls"
  },
  {
    icon: Clock3,
    title: "Business hours",
    value: "24/7",
    detail: "Available anytime for enquiries, bookings and urgent follow-up."
  }
];

function ContactPage() {
  return (
    <section className="contact-page">
      <section
        className="contact-hero"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(8, 14, 24, 0.92), rgba(8, 14, 24, 0.68), rgba(8, 14, 24, 0.18)), url(${showroomImages.about})`
        }}
      >
        <div className="contact-hero__content">
          <span className="eyebrow">
            <Mail size={16} />
            Contact AutoWorld
          </span>
          <h1>Every way to reach the right AutoWorld team.</h1>
          <p>
            Sales, valuations, finance, after-sales and marketplace support are
            all routed through one clear contact hub.
          </p>
        </div>
        <div className="contact-hero__panel">
          <MessageCircle size={22} />
          <span>Fastest response</span>
          <strong>WhatsApp the AutoWorld team for quick help.</strong>
        </div>
      </section>

      <section className="contact-primary-grid">
        {primaryContacts.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <Icon size={23} />
              <div>
                <span>{item.title}</span>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </div>
            </>
          );

          return item.href ? (
            <a className="panel contact-primary-card" href={item.href} key={item.title} target={item.href.startsWith("http") ? "_blank" : undefined} rel={item.href.startsWith("http") ? "noreferrer" : undefined}>
              {content}
            </a>
          ) : (
            <article className="panel contact-primary-card" key={item.title}>
              {content}
            </article>
          );
        })}
      </section>

    </section>
  );
}

export default ContactPage;
