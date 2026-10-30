const WasteReport = require("../../models/WasteReport");
const User = require("../../models/User");
const { route, HttpError, str } = require("../../lib/http");
const { removePhoto } = require("../../lib/upload");

// Partners confirm the waste on site while collecting it.
const SITE_VERIFY_FROM = ["ASSIGNED", "COLLECTING", "COLLECTED"];

// GET   /api/reports/:id  → one report (owner, admin, or the partner it's assigned to)
// PATCH /api/reports/:id  → admin: { action: verify|reject|assign|collecting|collected|recycled, collector? }
//                           partner: { action: "site-verify" } → confirms on site and awards the reporter's points
module.exports = route({ methods: ["GET", "PATCH", "DELETE"], auth: true, roles: ["customer", "admin", "partner"] }, async (req, res, user) => {
  const id = str(req.query.id, 40);
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new HttpError(404, "Report not found.");

  const admin = user.role === "admin";
  const partner = user.role === "partner";
  let q = WasteReport.findById(id);
  if (admin) q = q.populate("user", "name businessName email phone");
  const report = await q;
  // Other people's reports look exactly like missing ones.
  const mine = partner
    ? user.partnerStatus === "approved" && !!user.partnerName && report && report.collector === user.partnerName
    : report && (admin || String(report.user) === String(user._id));
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
      { _id: report._id, collector: user.partnerName, siteVerifiedAt: null, rewardedAt: null, status: { $in: SITE_VERIFY_FROM } },
      {
        $set: { siteVerifiedAt: new Date(), siteVerifiedBy: user.partnerName, rewardPoints: points, rewardedAt: points ? new Date() : null },
        $push: { history: { status: "SITE_VERIFIED", by: user.partnerName } }
      },
      { new: true }
    );
    if (!updated) throw new HttpError(409, "This report is already confirmed.");
    if (points) await User.updateOne({ _id: updated.user }, { $inc: { points } });
    return res.json({ report: updated.toClient(false) });
  }

  if (!admin) throw new HttpError(403, "Only admins can change a report.");

  const rule = WasteReport.ACTIONS[action];
  if (!rule) throw new HttpError(400, "Unknown action.");
  if (!rule.from.includes(report.status)) {
    throw new HttpError(409, `Cannot do that while the report is ${report.status}.`);
  }

  if (rule.needsCollector) {
    const collector = str(body.collector, 120);
    if (!collector) throw new HttpError(400, "Enter the collector to assign.");
    report.collector = collector;
  }

  // An admin decision on a flagged report closes its review.
  if ((action === "verify" || action === "reject") && report.fraud && report.fraud.status === "needs-review" && !report.fraud.reviewedAt) {
    report.fraud.reviewedBy = user.name;
    report.fraud.reviewedAt = new Date();
  }

  report.status = rule.to;
  report.history.push({ status: rule.to, by: user.name });
  await report.save();
  res.json({ report: report.toClient(true) });
});
