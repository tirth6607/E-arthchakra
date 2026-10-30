const WasteReport = require("../../models/WasteReport");
const { route, HttpError, str } = require("../../lib/http");
const { storePhoto, removePhoto, validPhotoRef } = require("../../lib/upload");
const { readLocation } = require("../../lib/location");

const MAX_PHOTOS = 5;

// Waste reports only. Pickup requests live in api/pickups/ and are never touched here.
const HOURLY_LIMIT = 5;
const DAILY_LIMIT = 20;

// GET  /api/reports  -> my reports (customer) / all reports (admin, ?status=NEW)
// POST /api/reports  -> submit a waste report (photo + GPS)
module.exports = route({ methods: ["GET", "POST"], auth: true, roles: ["customer", "admin"] }, async (req, res, user) => {
  if (req.method === "GET") {
    const admin = user.role === "admin";
    const filter = admin ? {} : { user: user._id };
    const status = str(req.query.status, 20).toUpperCase();
    if (admin && WasteReport.STATUSES.includes(status)) filter.status = status;

    let q = WasteReport.find(filter).sort({ createdAt: -1 }).limit(200);
    if (admin) q = q.populate("user", "name businessName email phone");
    const reports = await q;
    return res.json({ reports: reports.map((r) => r.toClient(admin)) });
  }

  // ---- abuse protection (login is already required) ----
  if (Number(req.headers["content-length"] || 0) > 4 * 1024 * 1024) throw new HttpError(413, "Upload is too large.");
  const now = Date.now();
  const [lastHour, lastDay] = await Promise.all([
    WasteReport.countDocuments({ user: user._id, createdAt: { $gt: new Date(now - 3600e3) } }),
    WasteReport.countDocuments({ user: user._id, createdAt: { $gt: new Date(now - 86400e3) } })
  ]);
  if (lastHour >= HOURLY_LIMIT || lastDay >= DAILY_LIMIT) {
    throw new HttpError(429, "You've sent several reports recently. Please try again a little later.");
  }

  // ---- validate everything BEFORE touching storage ----
  const b = req.body || {};
  const hasList = Array.isArray(b.photos);
  if (!hasList && !b.photo) throw new HttpError(400, "A photo of the waste is required.");
  if (hasList && !b.photos.length) throw new HttpError(400, "A photo of the waste is required.");
  if (hasList && b.photos.length > MAX_PHOTOS) throw new HttpError(400, "You can add up to 5 photos.");
  const wasteType = str(b.wasteType, 20);
  if (!WasteReport.WASTE_TYPES.includes(wasteType)) throw new HttpError(400, "Please choose a waste type.");
  const loc = readLocation(b);

  // ---- photos: already uploaded via /api/reports/photos (checked to be MINE), or one legacy base64 photo ----
  let photos;
  if (hasList) {
    photos = b.photos.map((p) => {
      if (!validPhotoRef(p, user._id)) throw new HttpError(400, "One of the photos is not valid. Please add it again.");
      return { url: p.url, key: p.key, uploadedAt: new Date() };
    });
    const keys = photos.map((p) => p.key);
    if (new Set(keys).size !== keys.length || (await WasteReport.exists({ "photos.key": { $in: keys } }))) {
      throw new HttpError(400, "One of the photos is not valid. Please add it again.");
    }
  } else {
    const s = await storePhoto(b.photo, user._id);
    photos = [{ url: s.url, key: s.key, uploadedAt: new Date() }];
  }

  try {
    const report = await WasteReport.create({
      user: user._id, // from the JWT cookie, never from the request body
      photoUrl: photos[0].url,
      photoKey: photos[0].key,
      photos,
      ...loc,
      location: { type: "Point", coordinates: [loc.longitude, loc.latitude] }, // GeoJSON order: [lng, lat]
      wasteType,
      description: str(b.description, 500),
      status: "NEW",
      history: [{ status: "NEW", by: user.name }]
    });
    res.status(201).json({ report: report.toClient(false) });
  } catch (err) {
    console.error("[reports] saving failed, removing uploaded photos:", err && err.message);
    await Promise.all(photos.map((p) => removePhoto(p.url))); // no orphaned files
    throw err;
  }
});
