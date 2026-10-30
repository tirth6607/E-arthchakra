const WasteReport = require("../../models/WasteReport");
const { route, HttpError, str } = require("../../lib/http");
const { removePhoto } = require("../../lib/upload");

// GET   /api/reports/:id  → one report (owner or admin)
// PATCH /api/reports/:id  → admin only: { action: verify|reject|assign|collecting|collected|recycled, collector? }
module.exports = route({ methods: ["GET", "PATCH", "DELETE"], auth: true, roles: ["customer", "admin"] }, async (req, res, user) => {
  const id = str(req.query.id, 40);
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new HttpError(404, "Report not found.");

  const admin = user.role === "admin";
  let q = WasteReport.findById(id);
  if (admin) q = q.populate("user", "name businessName email phone");
  const report = await q;
  // Other people's reports look exactly like missing ones.
  if (!report || (!admin && String(report.user) !== String(user._id))) throw new HttpError(404, "Report not found.");

  if (req.method === "GET") return res.json({ report: report.toClient(admin) });

  if (req.method === "DELETE") {
    if (!admin && report.status !== "NEW") throw new HttpError(403, "Only new reports can be deleted.");
    const urls = report.photos && report.photos.length ? report.photos.map((p) => p.url) : [report.photoUrl];
    await Promise.all(urls.filter(Boolean).map(removePhoto));
    await report.deleteOne();
    return res.json({ ok: true });
  }

  if (!admin) throw new HttpError(403, "Only admins can change a report.");

  const body = req.body || {};
  const rule = WasteReport.ACTIONS[str(body.action, 20)];
  if (!rule) throw new HttpError(400, "Unknown action.");
  if (!rule.from.includes(report.status)) {
    throw new HttpError(409, `Cannot do that while the report is ${report.status}.`);
  }

  if (rule.needsCollector) {
    const collector = str(body.collector, 120);
    if (!collector) throw new HttpError(400, "Enter the collector to assign.");
    report.collector = collector;
  }

  report.status = rule.to;
  report.history.push({ status: rule.to, by: user.name });
  await report.save();
  res.json({ report: report.toClient(true) });
});
