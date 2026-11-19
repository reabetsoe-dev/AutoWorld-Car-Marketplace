export const showroomImages = {
  adminLogin: "/assets/admin-login-hero.png",
  about: "/assets/about-hero.png",
  hero: "/assets/home-hero-japanese-imports.png",
  showroom:
    "https://images.unsplash.com/photo-1560253414-f65d1f5a1d06?auto=format&fit=crop&w=1600&q=82",
  sell:
    "https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=1600&q=82",
  finance:
    "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&w=1600&q=82",
  locations:
    "https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=1600&q=82",
  operations:
    "https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=1600&q=82"
};

export const CAR_IMAGE_PLACEHOLDER = "/assets/car-image-placeholder.svg";

export function getGalleryImages(car) {
  const imageUrls = Array.isArray(car?.imageUrls)
    ? car.imageUrls.filter((url) => typeof url === "string" && url.trim())
    : [];
  return imageUrls.length ? [...new Set(imageUrls)] : [CAR_IMAGE_PLACEHOLDER];
}
