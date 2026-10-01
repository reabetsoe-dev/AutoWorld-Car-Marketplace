import { useEffect, useState } from "react";
import {
  Camera,
  CarFront,
  CheckCircle2,
  FileCheck2,
  ImagePlus,
  Send,
  ShieldCheck,
  Trash2,
  UserRound
} from "lucide-react";
import { buildErrorMessage, submitSellRequest } from "../services/api";

const initialForm = {
  make: "",
  model: "",
  year: "",
  mileage: "",
  expectedPrice: "",
  condition: "Good",
  fuelType: "Petrol",
  transmission: "Automatic",
  location: "",
  ownerName: "",
  phone: "",
  notes: ""
};

const requiredFields = [
  "make",
  "model",
  "year",
  "mileage",
  "location",
  "ownerName",
  "phone"
];

function SellMyCarPage() {
  const [form, setForm] = useState(initialForm);
  const [images, setImages] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [imagePreviews, setImagePreviews] = useState([]);

  useEffect(() => {
    const previews = images.map((file) => ({
      file,
      url: URL.createObjectURL(file)
    }));

    setImagePreviews(previews);

    return () => {
      previews.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, [images]);

  function updateField(field, value) {
    setSuccess("");
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function onImagesSelected(event) {
    setSuccess("");
    setError("");
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) {
      event.target.value = "";
      return;
    }
    const imageFiles = selectedFiles.filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length !== selectedFiles.length) {
      setError("Only image files can be uploaded.");
    }
    if (imageFiles.length > 0) {
      setImages((prev) => [...prev, ...imageFiles]);
    }
    event.target.value = "";
  }

  function removeImage(fileName, lastModified) {
    setSuccess("");
    setImages((prev) =>
      prev.filter((file) => file.name !== fileName || file.lastModified !== lastModified)
    );
  }

  async function submitToAdmin(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const missingField = requiredFields.find((field) => !String(form[field] || "").trim());
    if (missingField) {
      setError("Please complete the required car and contact details.");
      return;
    }

    if (images.length === 0) {
      setError("Please add at least one vehicle image.");
      return;
    }

    try {
      setIsSubmitting(true);
      await submitSellRequest(form, images);
      setSuccess("Your car details and images were sent to the AutoWorld admin system.");
      setForm(initialForm);
      setImages([]);
    } catch (requestError) {
      setError(buildErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="sell-page">
      <header className="sell-intake-header panel">
        <div>
          <span className="section-kicker">
            Admin valuation intake
          </span>
          <h1>Vehicle sell request</h1>
          <p>Submit the vehicle record, owner contact details, and photos for admin review.</p>
        </div>
        <div className="sell-intake-status" aria-label="Sell request status">
          <FileCheck2 size={20} />
          <div>
            <strong>Admin review queue</strong>
            <span>{images.length} images attached</span>
          </div>
        </div>
      </header>

      <div className="sell-steps">
        <div className="is-active">
          <CarFront size={18} />
          Vehicle
        </div>
        <div className="is-active">
          <Camera size={18} />
          Photos
        </div>
        <div className="is-active">
          <Send size={18} />
          Submit
        </div>
      </div>

      <div className="sell-content">
        <form className="sell-intake-form" onSubmit={submitToAdmin}>
          <section className="sell-form-section">
            <div className="sell-form-section__head">
              <CarFront size={18} />
              <div>
                <h2>Vehicle details</h2>
                <p>Core information used by the buying team.</p>
              </div>
            </div>
            <div className="sell-form-grid">
              <label>
                Make *
                <input value={form.make} onChange={(event) => updateField("make", event.target.value)} placeholder="Honda" required />
              </label>
              <label>
                Model *
                <input value={form.model} onChange={(event) => updateField("model", event.target.value)} placeholder="Fit Hybrid" required />
              </label>
              <label>
                Year *
                <input value={form.year} onChange={(event) => updateField("year", event.target.value)} placeholder="2020" type="number" min="1900" max="2100" required />
              </label>
              <label>
                Mileage *
                <input value={form.mileage} onChange={(event) => updateField("mileage", event.target.value)} placeholder="45000" type="number" min="0" required />
              </label>
              <label>
                Expected price
                <input value={form.expectedPrice} onChange={(event) => updateField("expectedPrice", event.target.value)} placeholder="160000" type="number" min="0" />
              </label>
              <label>
                Condition
                <select value={form.condition} onChange={(event) => updateField("condition", event.target.value)}>
                  <option>Excellent</option>
                  <option>Good</option>
                  <option>Fair</option>
                  <option>Needs work</option>
                </select>
              </label>
              <label>
                Fuel type
                <select value={form.fuelType} onChange={(event) => updateField("fuelType", event.target.value)}>
                  <option>Petrol</option>
                  <option>Diesel</option>
                  <option>Hybrid</option>
                  <option>Electric</option>
                </select>
              </label>
              <label>
                Transmission
                <select value={form.transmission} onChange={(event) => updateField("transmission", event.target.value)}>
                  <option>Automatic</option>
                  <option>Manual</option>
                </select>
              </label>
            </div>
          </section>

          <section className="sell-form-section">
            <div className="sell-form-section__head">
              <UserRound size={18} />
              <div>
                <h2>Owner contact</h2>
                <p>Contact details for admin follow-up.</p>
              </div>
            </div>
            <div className="sell-form-grid">
              <label>
                Your name *
                <input value={form.ownerName} onChange={(event) => updateField("ownerName", event.target.value)} placeholder="Full name" autoComplete="name" required />
              </label>
              <label>
                WhatsApp number *
                <input value={form.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="+266..." type="tel" autoComplete="tel" required />
              </label>
              <label>
                District *
                <input value={form.location} onChange={(event) => updateField("location", event.target.value)} placeholder="Maseru" required />
              </label>
            </div>
          </section>

          <section className="sell-form-section">
            <div className="sell-form-section__head">
              <Camera size={18} />
              <div>
                <h2>Photos and notes</h2>
                <p>Images and context attached to the admin request.</p>
              </div>
            </div>
            <label className="sell-notes-field">
              Notes
              <textarea value={form.notes} onChange={(event) => updateField("notes", event.target.value)} placeholder="Service history, accident notes, settlement amount, or anything the buyer should know." rows="4" />
            </label>

            <div className="sell-upload-row">
              <label className="sell-upload">
                <ImagePlus size={22} />
                <span>Add vehicle images</span>
                <input type="file" accept="image/*" multiple onChange={onImagesSelected} />
              </label>
              <div className="sell-upload-summary">
                <strong>{images.length} images selected</strong>
                <span>Exterior, interior, dashboard, license disc, and visible damage.</span>
              </div>
            </div>

            {imagePreviews.length > 0 ? (
              <div className="sell-image-preview-grid">
                {imagePreviews.map(({ file, url }) => (
                  <div className="sell-image-preview" key={`${file.name}-${file.lastModified}`}>
                    <img src={url} alt={file.name} />
                    <button type="button" onClick={() => removeImage(file.name, file.lastModified)} aria-label={`Remove ${file.name}`}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          {error ? <div className="notice notice--error">{error}</div> : null}
          {success ? <div className="notice notice--success">{success}</div> : null}

          <div className="sell-form__actions">
            <button className="btn btn--primary" type="submit" disabled={isSubmitting}>
              <Send size={17} />
              {isSubmitting ? "Submitting..." : "Submit"}
            </button>
            <button className="btn btn--secondary" type="button" onClick={() => { setForm(initialForm); setImages([]); setError(""); setSuccess(""); }} disabled={isSubmitting}>
              Clear form
            </button>
          </div>
        </form>

        <aside className="sell-content__summary">
          <div className="sell-summary-panel">
            <span className="section-kicker">Admin handoff</span>
            <h2>Ready for review</h2>
            <p>Submissions are saved for the buying team with photos and contact details in one record.</p>
            <dl>
              <div>
                <dt>Required fields</dt>
                <dd>{requiredFields.length}</dd>
              </div>
              <div>
                <dt>Images selected</dt>
                <dd>{images.length}</dd>
              </div>
            </dl>
          </div>
          <div className="sell-assurance-list">
            <span>
              <CheckCircle2 size={17} />
              Car details reviewed by admin
            </span>
            <span>
              <FileCheck2 size={17} />
              Images checked before valuation
            </span>
            <span>
              <ShieldCheck size={17} />
              Secure handover guidance
            </span>
            <span>
              <UserRound size={17} />
              Admin follow-up
            </span>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default SellMyCarPage;
