const User = require("../models/User");
const Pickup = require("../models/Pickup");
const { route, HttpError, str } = require("../lib/http");

const STATUSES = ["pending", "approved", "suspended"];

// GET   /api/partners           → admin: every partner account, with pickup counts
// PATCH /api/partners?id=<id>   → admin: { partnerStatus: pending|approved|suspended }
module.exports = route({ methods: ["GET", "PATCH"], auth: true, roles: ["admin"] }, async (req, res) => {
  if (req.method === "GET") {
    const partners = await User.find({ role: "partner" }).sort({ createdAt: -1 });

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const counts = await Pickup.aggregate([
      { $match: { partner: { $ne: null } } },
      {
        $group: {
          _id: "$partner",
          active: { $sum: { $cond: [{ $in: ["$status", ["Assigned", "In Progress"]] }, 1, 0] } },
          completedThisMonth: {
            $sum: { $cond: [{ $and: [{ $eq: ["$status", "Completed"] }, { $gte: ["$updatedAt", monthStart] }] }, 1, 0] }
          }
        }
      }
    ]);
    const byName = new Map(counts.map((c) => [c._id, c]));

    return res.json({
      partners: partners.map((p) => {
        const c = byName.get(p.partnerName) || {};
        return {
          ...p.toClient(),
          loggedIn: undefined,
          activePickups: c.active || 0,
          completedThisMonth: c.completedThisMonth || 0
        };
      })
    });
  }

  const id = str(req.query.id, 40);
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new HttpError(404, "Partner not found.");
  const status = str((req.body || {}).partnerStatus, 20);
  if (!STATUSES.includes(status)) throw new HttpError(400, "Invalid partner status.");

  const partner = await User.findOneAndUpdate(
    { _id: id, role: "partner" },
    { $set: { partnerStatus: status } },
    { new: true }
  );
  if (!partner) throw new HttpError(404, "Partner not found.");
  res.json({ partner: partner.toClient() });
});
