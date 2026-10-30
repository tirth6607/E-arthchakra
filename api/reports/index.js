const WasteReport = require("../../models/WasteReport");
const { route, HttpError, str } = require("../../lib/http");
const { validPhotoRef } = require("../../lib/upload");
const fraud = require("../../lib/fraud");

const MAX_PHOTOS = 5;

// Waste reports only. Pickup requests live in api/pickups/ and are never touched here.
const HOURLY_LIMIT = 5;
const DAILY_LIMIT = 20;

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const validLatLng = (lat, lng) => isNum(lat) && isNum(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);

// Auto-check verdict → where the report starts in the workflow.
const START_STATUS = { "auto-approved": "VERIFIED", "needs-review": "NEW", rejected: "REJECTED" };

// GET  /api/reports  -> my reports (customer) / reports assigned to me (partner) /
//                       all reports (admin, ?status=NEW, ?review=needs-review)
// POST /api/reports  -> submit a waste report (live camera photos + capture GPS + claimed location)
module.exports = route({ methods: ["GET", "POST"], auth: true, roles: ["customer", "admin", "partner"] }, async (req, res, user) => {
  if (req.method === "GET") {
    const admin = user.role === "admin";
    let filter = { user: user._id };
    if (admin) filter = {};
    if (user.role === "partner") {
      if (user.partnerStatus !== "approved" || !user.partnerName) return res.json({ reports: [] });
      filter = { collector: user.partnerName, status: { $in: ["ASSIGNED", "COLLECTING", "COLLECTED", "RECYCLED"] } };
    }
    const status = str(req.query.status, 20).toUpperCase();
    if (admin && WasteReport.STATUSES.includes(status)) filter.status = status;
    const review = str(req.query.review, 20);
    if (admin && WasteReport.FRAUD_STATUSES.includes(review)) filter["fraud.status"] = review;
    if (admin && review === "needs-review") filter["fraud.reviewedAt"] = null; // the open review queue

    let q = WasteReport.find(filter).sort({ createdAt: -1 }).limit(200);
    if (admin) q = q.populate("user", "name businessName email phone");
    const reports = await q;
    return res.json({ reports: reports.map((r) => r.toClient(admin)) });
  }

  if (user.role === "partner") throw new HttpError(403, "Partners can't submit waste reports.");

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

  // ---- validate the request ----
  const b = req.body || {};
  if (!Array.isArray(b.photos) || !b.photos.length) throw new HttpError(400, "Take at least one photo of the waste with the camera.");
  if (b.photos.length > MAX_PHOTOS) throw new HttpError(400, "You can add up to 5 photos.");
  const wasteType = str(b.wasteType, 20);
  if (!WasteReport.WASTE_TYPES.includes(wasteType)) throw new HttpError(400, "Please choose a waste type.");

  // Each photo: uploaded by ME via /api/reports/photos, with the GPS fix and time of the live capture.
  const photos = b.photos.map((p, i) => {
    const n = b.photos.length > 1 ? ` ${i + 1}` : "";
    if (!validPhotoRef(p, user._id) || !p.key.endsWith(".jpg")) throw new HttpError(400, `Photo${n} is not valid. Please take it again.`);
    if (!validLatLng(p.lat, p.lng) || !isNum(p.accuracy) || p.accuracy < 0 || p.accuracy > 100000) {
      throw new HttpError(400, `Photo${n} has no valid location. Allow location access and take it again.`);
    }
    if (!isNum(p.capturedAt)) throw new HttpError(400, `Photo${n} has no capture time. Please take it again.`);
    const age = now - p.capturedAt;
    if (age > fraud.MAX_CAPTURE_AGE_MS) throw new HttpError(400, `Photo${n} was taken more than 5 minutes ago. Please take it again.`);
    if (age < -fraud.MAX_CLOCK_AHEAD_MS) throw new HttpError(400, "Your phone's clock looks wrong. Please set it to automatic time and try again.");
    return {
      url: p.url, key: p.key, uploadedAt: new Date(),
      capturedAt: new Date(p.capturedAt),
      gps: { lat: p.lat, lng: p.lng, accuracy: Math.round(p.accuracy) }
    };
  });
  const keys = photos.map((p) => p.key);
  if (new Set(keys).size !== keys.length || (await WasteReport.exists({ "photos.key": { $in: keys } }))) {
    throw new HttpError(400, "One of the photos is not valid. Please take it again.");
  }

  // Where the reporter says the waste is (map pin). Defaults to where the first photo was taken.
  const first = photos[0].gps;
  const claimed = b.claimedLat === undefined && b.claimedLng === undefined ? { lat: first.lat, lng: first.lng } : { lat: b.claimedLat, lng: b.claimedLng };
  if (!validLatLng(claimed.lat, claimed.lng)) throw new HttpError(400, "That location is not valid. Please set it again.");

  // ---- server-side signals: real image bytes, perceptual hash, AI-generated score ----
  await Promise.all(photos.map(async (p, i) => {
    let buf;
    try { buf = await fraud.readPhoto(p.url); } catch (e) { throw new HttpError(400, "One of the photos could not be found. Please take it again."); }
    if (!(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) throw new HttpError(400, "One of the photos is not valid. Please take it again.");
    try { p.phash = fraud.perceptualHash(buf); } catch (e) { throw new HttpError(400, "One of the photos could not be read. Please take it again."); }
    p.aiScore = await fraud.aiGeneratedScore(buf);
  }));

  const dups = await fraud.findDuplicates(WasteReport, photos.map((p) => p.phash));
  const scores = photos.map((p) => p.aiScore), known = scores.filter((s) => s != null);
  const signals = {
    gpsAccuracy: Math.max(...photos.map((p) => p.gps.accuracy)),
    distanceM: Math.max(...photos.map((p) => fraud.distanceM(p.gps.lat, p.gps.lng, claimed.lat, claimed.lng))),
    aiScore: scores.includes(null) ? null : Math.max(...scores),
    duplicateOf: dups.length ? dups[0].reportId : null
  };
  const verdict = fraud.score(signals);
  const status = START_STATUS[verdict.status];

  const report = await WasteReport.create({
    user: user._id, // from the JWT cookie, never from the request body
    photoUrl: photos[0].url,
    photoKey: photos[0].key,
    photos,
    latitude: claimed.lat,
    longitude: claimed.lng,
    locationAccuracy: first.accuracy,
    locationTimestamp: photos[0].capturedAt,
    location: { type: "Point", coordinates: [claimed.lng, claimed.lat] }, // GeoJSON order: [lng, lat]
    wasteType,
    description: str(b.description, 500),
    status,
    history: status === "NEW" ? [{ status, by: user.name }] : [{ status: "NEW", by: user.name }, { status, by: "Auto-check" }],
    fraud: {
      status: verdict.status,
      riskScore: verdict.riskScore,
      reasons: verdict.reasons,
      gps: first,
      claimed,
      distanceM: signals.distanceM,
      aiScore: known.length ? Math.max(...known) : null, // highest score we got, even if one photo's check failed
      duplicateOf: signals.duplicateOf,
      checkedAt: new Date()
    }
  });
  // Photos stay in storage even if the report is rejected – they're the evidence for review.
  res.status(201).json({ report: report.toClient(false) });
});
