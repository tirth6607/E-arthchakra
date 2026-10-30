const WasteReport = require("../../models/WasteReport");
const { route, HttpError } = require("../../lib/http");
const { storePhoto, removePhoto, validPhotoRef } = require("../../lib/upload");

// POST   /api/reports/photos  { photo: "data:image/...;base64,..." } -> { photo: { url, key } }
// DELETE /api/reports/photos  { url, key }  -> removes one of MY photos that is not yet attached to a report
module.exports = route({ methods: ["POST", "DELETE"], auth: true, roles: ["customer", "admin"] }, async (req, res, user) => {
  if (Number(req.headers["content-length"] || 0) > 4 * 1024 * 1024) throw new HttpError(413, "Photo is too large.");
  const b = req.body || {};

  if (req.method === "DELETE") {
    const ref = { url: String(b.url || ""), key: String(b.key || "") };
    if (!validPhotoRef(ref, user._id)) throw new HttpError(404, "Photo not found.");
    if (await WasteReport.exists({ "photos.key": ref.key })) throw new HttpError(409, "That photo is already part of a report.");
    await removePhoto(ref.url);
    return res.json({ ok: true });
  }

  const p = await storePhoto(b.photo, user._id); // checks real bytes (JPEG/PNG/WebP) and size
  res.status(201).json({ photo: { url: p.url, key: p.key, uploadedAt: new Date() } });
});
