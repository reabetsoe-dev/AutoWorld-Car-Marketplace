function formatErrorForLog(error) {
  if (!error) return "Unknown error.";

  const parts = [];
  if (error.code) parts.push(`code ${error.code}`);
  if (error.message) parts.push(error.message);

  if (Array.isArray(error.errors) && error.errors.length > 0) {
    const nested = error.errors
      .map((item) => [item.code, item.message].filter(Boolean).join(": "))
      .filter(Boolean)
      .join("; ");
    if (nested) parts.push(nested);
  }

  return parts.join(" - ") || String(error);
}

module.exports = {
  formatErrorForLog
};
