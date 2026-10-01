function cleanTitlePart(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function buildCarTitle(input = {}) {
  const year = cleanTitlePart(input.year);
  const brand = cleanTitlePart(input.brand);
  const model = cleanTitlePart(input.model);
  const titleParts = input.category === "accessory" ? [brand, model] : [year, brand, model];
  const title = titleParts.filter(Boolean).join(" ").trim();

  if (title) return title;
  return input.category === "accessory" ? "Accessory listing" : "Vehicle listing";
}

module.exports = {
  buildCarTitle
};
