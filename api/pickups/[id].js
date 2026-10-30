const Pickup = require("../../models/Pickup");
const User = require("../../models/User");
const { route, HttpError, str } = require("../../lib/http");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

module.exports = route({ methods: ["PATCH"], auth: true, roles: ["admin", "partner"] }, async (req, res, user) => {
  const code = str(req.query.id, 60);
  const body = req.body || {};

  if (user.role === "partner" && body.accept === true) {
    // Accept an open request. Atomic, so two partners can't both claim it.
    if (user.partnerStatus !== "approved" || !user.partnerName) {
      throw new HttpError(403, "Your partner account is waiting for admin approval.");
    }
    const accepted = await Pickup.findOneAndUpdate(
      { code, status: "Pending", partner: null },
      { $set: { partner: user.partnerName, status: "Assigned" } },
      { new: true }
    );
    if (!accepted) throw new HttpError(409, "This request has already been taken by another partner.");
    return res.json({ pickup: accepted.toClient() });
  }

  const pickup = await Pickup.findOne({ code });
  if (!pickup) throw new HttpError(404, "Pickup request could not be found.");

  if (user.role === "partner") {
    // Partners can only touch pickups assigned to them, and only change the status.
    if (user.partnerStatus === "suspended") throw new HttpError(403, "Your partner account is suspended.");
    if (!user.partnerName || pickup.partner !== user.partnerName) {
      throw new HttpError(403, "This pickup is not assigned to you.");
    }
    if (body.status !== undefined) {
      if (!["In Progress", "Completed"].includes(body.status)) {
        throw new HttpError(400, "Partners can set a pickup to In Progress or Completed.");
      }
      pickup.status = body.status;
    }
  } else {
    // Admin
    if (body.status !== undefined) {
      if (!Pickup.STATUSES.includes(body.status)) throw new HttpError(400, "Invalid status.");
      pickup.status = body.status;
    }

    if (body.partner !== undefined) {
      const partner = str(body.partner, 120) || null;
      const changed = partner !== pickup.partner;
      if (partner && changed && !(await User.exists({ role: "partner", partnerName: partner, partnerStatus: "approved" }))) {
        throw new HttpError(400, "Choose an approved partner.");
      }
      pickup.partner = partner;
      // Assigning a (new) partner moves a Pending request to "Assigned".
      if (partner && changed && pickup.status === "Pending") pickup.status = "Assigned";
    }

    if (body.scheduledDate !== undefined) {
      const d = str(body.scheduledDate, 10);
      if (d && !DATE_RE.test(d)) throw new HttpError(400, "Invalid date.");
      pickup.scheduledDate = d || null;
    }
    if (body.scheduledTime !== undefined) {
      const t = str(body.scheduledTime, 5);
      if (t && !TIME_RE.test(t)) throw new HttpError(400, "Invalid time.");
      pickup.scheduledTime = t || null;
    }
  }

  await pickup.save();
  res.json({ pickup: pickup.toClient() });
});
