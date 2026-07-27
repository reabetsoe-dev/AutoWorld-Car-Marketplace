const WHATSAPP_NUMBER = "26663842459";

export function buildWhatsappEnquiryUrl(car, formatPrice) {
  const title = car?.title || "this vehicle";
  const price = car?.price ? ` listed at ${formatPrice(car.price)}` : "";
  const message = `Hi AutoWorld, I would like to enquire about ${title}${price}.`;

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
