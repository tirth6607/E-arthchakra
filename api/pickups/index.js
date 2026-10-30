const Pickup = require("../../models/Pickup");
const { route, HttpError, str } = require("../../lib/http");
const { readLocation } = require("../../lib/location");

const WASTE_OPTIONS_MAX = 20;

module.exports = route({ methods: ["GET", "POST"], auth: true }, async (req, res, user) => {
  // ---------- LIST ----------
  if (req.method === "GET") {
    let filter;
    if (user.role === "admin") filter = {};
    else if (user.role === "partner") {
      const mine = { partner: user.partnerName || "__none__" };
      // Approved partners also see open (unassigned) requests so they can accept them.
      filter = user.partnerStatus === "approved"
        ? { $or: [mine, { status: "Pending", partner: null }] }
        : mine;
    }
    else filter = { user: user._id };

    const pickups = await Pickup.find(filter).sort({ createdAt: -1 }).limit(1000);
    return res.json({ pickups: pickups.map((p) => p.toClient()) });
  }

  // ---------- CREATE (customers; admins may also create on behalf of a customer later) ----------
  if (user.role !== "customer" && user.role !== "admin") {
    throw new HttpError(403, "Only customers can request pickups.");
  }

  const body = req.body || {};
  const waste = (Array.isArray(body.waste) ? body.waste : [])
    .map((w) => str(w, 60))
    .filter(Boolean)
    .slice(0, WASTE_OPTIONS_MAX);
  if (!waste.length) throw new HttpError(400, "Please select at least one waste category.");
  const loc = readLocation(body);
  // A pin placed by hand has no GPS accuracy or fix time to check.
  const locationSource = Pickup.LOCATION_SOURCES.includes(body.locationSource) ? body.locationSource : "gps";
  if (locationSource === "manual") { loc.locationAccuracy = null; loc.locationTimestamp = null; }

  const pickup = await Pickup.create({
    code: "EF-" + Date.now() + Math.floor(Math.random() * 100),
    user: user._id,
    customerName: user.name,
    businessName: str(body.businessName, 160) || user.businessName || "Business",
    name: str(body.name, 120) || user.name,
    phone: str(body.phone, 40) || user.phone,
    email: str(body.email, 200) || user.email,
    city: str(body.city, 80) || user.city,
    businessType: str(body.businessType, 60) || user.businessType,
    waste,
    quantity: str(body.quantity, 30) || "0",
    frequency: str(body.frequency, 40) || "One-time",
    message: str(body.message, 2000),
    ...loc,
    locationSource,
    location: { type: "Point", coordinates: [loc.longitude, loc.latitude] }, // GeoJSON order: [lng, lat]
    status: "Pending"
  });

  res.status(201).json({ pickup: pickup.toClient() });
});
