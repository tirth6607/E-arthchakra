const WasteReport = require("../../models/WasteReport");
const User = require("../../models/User");
const { route, HttpError, str } = require("../../lib/http");
const { removePhoto } = require("../../lib/upload");

// Partners confirm the waste on site while collecting it.
const SITE_VERIFY_FROM = ["ASSIGNED", "COLLECTING", "COLLECTED"];

// Admin override of the auto-check verdict: [fraud statuses it may start from, workflow statuses it may start from, result].
const OVERRIDES = {
  approve: { from: ["rejected", "needs-review"], statusFrom: ["NEW", "REJECTED"], to: "approved", statusTo: "VERIFIED" },
  reject: { from: ["auto-approved", "approved", "needs-review"], statusFrom: ["NEW", "VERIFIED", "ASSIGNED"], to: "rejected", statusTo: "REJECTED" }
};

// GET   /api/reports/:id  → one report (owner, admin, or the partner it's assigned to)
// PATCH /api/reports/:id  → admin: { action: verify|reject|assign|collecting|collected|recycled, partnerId? }
//                           admin: { action: "override", decision: approve|reject, reason } → audited verdict change
//                           partner: { action: "site-verify" } → confirms on site and awards the reporter's points
module.exports = route({ methods: ["GET", "PATCH", "DELETE"], auth: true, roles: ["customer", "admin", "partner"] }, async (req, res, user) => {
  const id = str(req.query.id, 40);
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new HttpError(404, "Report not found.");

  const admin = user.role === "admin";
  const partner = user.role === "partner";
  let q = WasteReport.findById(id);
  if (admin) q = q.populate("user", "name businessName email phone");
  const report = await q;
  // Other people's reports look exactly like missing ones. Partners: by their id from the JWT, never by name.
  const mine = partner
    ? user.partnerStatus === "approved" && report && report.assignedPartner && String(report.assignedPartner) === String(user._id)
    : report && (admin || String(report.user && report.user._id ? report.user._id : report.user) === String(user._id));
  if (!report || !mine) throw new HttpError(404, "Report not found.");

  if (req.method === "GET") return res.json({ report: report.toClient(admin) });

  if (req.method === "DELETE") {
    if (partner) throw new HttpError(403, "Partners can't delete reports.");
    if (!admin && report.status !== "NEW") throw new HttpError(403, "Only new reports can be deleted.");
    const urls = report.photos && report.photos.length ? report.photos.map((p) => p.url) : [report.photoUrl];
    await Promise.all(urls.filter(Boolean).map(removePhoto));
    await report.deleteOne();
    return res.json({ ok: true });
  }

  const body = req.body || {};
  const action = str(body.action, 20);

  if (partner) {
    if (action !== "site-verify") throw new HttpError(403, "Partners can only confirm a report on site.");
    if (report.siteVerifiedAt) throw new HttpError(409, "This report is already confirmed.");
    if (!SITE_VERIFY_FROM.includes(report.status)) throw new HttpError(409, `Cannot confirm while the report is ${report.status}.`);
    // Atomic, so the points are awarded exactly once even if the button is pressed twice.
    const points = report.fraud && report.fraud.status === "rejected" ? 0 : WasteReport.REPORT_POINTS;
    const updated = await WasteReport.findOneAndUpdate(
      { _id: report._id, assignedPartner: user._id, siteVerifiedAt: null, rewardedAt: null, status: { $in: SITE_VERIFY_FROM }, "fraud.status": { $ne: "rejected" } },
      {
        $set: { siteVerifiedAt: new Date(), siteVerifiedBy: user.partnerName || user.name, siteVerifiedByPartner: user._id, rewardPoints: points, rewardedAt: points ? new Date() : null },
        $push: { history: { status: "SITE_VERIFIED", by: user.partnerName || user.name } }
      },
      { new: true }
    );
    if (!updated) throw new HttpError(409, "This report is already confirmed.");
    if (points) await User.updateOne({ _id: updated.user }, { $inc: { points } });
    return res.json({ report: updated.toClient(false) });
  }

  // Role comes from the database user behind the JWT (lib/auth.js), not from anything the browser sends.
  if (!admin) throw new HttpError(403, "Only admins can change a report.");

  if (action === "override") {
    const o = OVERRIDES[str(body.decision, 10)];
    if (!o) throw new HttpError(400, "Choose approve or reject.");
    const reason = str(body.reason, 300);
    if (reason.length < 5) throw new HttpError(400, "Please give a short reason (at least 5 characters).");
    const from = report.fraud && report.fraud.status;
    if (!o.from.includes(from) || !o.statusFrom.includes(report.status)) {
      throw new HttpError(409, `Cannot ${body.decision} a report that is ${from || "not auto-checked"} / ${report.status}.`);
    }
    if (o.to === "rejected" && report.siteVerifiedAt) throw new HttpError(409, "The partner already confirmed this report on site.");
    const now = new Date();
    // Conditional update, so a partner confirming at the same moment can't race the override.
    const updated = await WasteReport.findOneAndUpdate(
      { _id: report._id, "fraud.status": from, status: report.status, ...(o.to === "rejected" ? { siteVerifiedAt: null } : {}) },
      {
        $set: { "fraud.status": o.to, status: o.statusTo, "fraud.reviewedBy": user.name, "fraud.reviewedAt": now },
        $push: {
          overrides: { by: user._id, byName: user.name, at: now, from, to: o.to, statusFrom: report.status, statusTo: o.statusTo, reason },
          history: { status: o.statusTo, by: user.name, at: now }
        }
      },
      { new: true }
    ).populate("user", "name businessName email phone");
    if (!updated) throw new HttpError(409, "This report just changed. Refresh and try again.");
    return res.json({ report: updated.toClient(true) });
  }

  // Auto-checked reports change verdict only through "override", so every decision has a reason on record.
  if ((action === "verify" || action === "reject") && report.fraud && report.fraud.status) {
    throw new HttpError(400, "Use Approve / Reject with a reason for auto-checked reports.");
  }

  const rule = WasteReport.ACTIONS[action];
  if (!rule) throw new HttpError(400, "Unknown action.");
  if (!rule.from.includes(report.status)) {
    throw new HttpError(409, `Cannot do that while the report is ${report.status}.`);
  }

  if (rule.needsCollector) {
    const partnerId = str(body.partnerId, 40);
    if (!/^[a-f0-9]{24}$/i.test(partnerId)) throw new HttpError(400, "Choose a partner to assign.");
    const p = await User.findOne({ _id: partnerId, role: "partner", partnerStatus: "approved" });
    if (!p) throw new HttpError(400, "Choose an approved partner.");
    report.assignedPartner = p._id;
    report.collector = p.partnerName || p.name; // display only
  }

  report.status = rule.to;
  report.history.push({ status: rule.to, by: user.name });
  await report.save();
  res.json({ report: report.toClient(true) });
});
