import { WHATSAPP_URL } from "../config/contact";

export function buildWhatsappEnquiryUrl(car, formatPrice) {
  const title = car?.title || "this vehicle";
  const price = car?.price ? ` listed at ${formatPrice(car.price)}` : "";
  const message = `Hi AutoWorld, I would like to enquire about ${title}${price}.`;

  return `${WHATSAPP_URL}?text=${encodeURIComponent(message)}`;
}
