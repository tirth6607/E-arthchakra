// One-time: link existing waste reports to partners by id (assignedPartner) instead of by typed name (collector).
// A report is linked only when its collector name matches exactly ONE partner's partnerName (case and spacing
// must match too). Everything else is listed for an admin to fix by re-assigning in admin.html – nothing is guessed.
//
//   npm run migrate:report-partners            → dry run: shows what would change, writes nothing
//   npm run migrate:report-partners -- --apply → writes the matches
const mongoose = require("mongoose");
const User = require("../models/User");
const WasteReport = require("../models/WasteReport");

const APPLY = process.argv.includes("--apply");

(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set (see .env.example)");
  await mongoose.connect(process.env.MONGODB_URI);

  const partners = await User.find({ role: "partner" }, { partnerName: 1, name: 1, partnerStatus: 1 }).lean();
  const byName = new Map();
  for (const p of partners) {
    if (!p.partnerName) continue;
    byName.set(p.partnerName, [...(byName.get(p.partnerName) || []), p]);
  }

  const reports = await WasteReport.find(
    { assignedPartner: null, collector: { $nin: [null, ""] } },
    { collector: 1, status: 1, createdAt: 1 }
  ).lean();

  const matched = [], unmatched = [];
  for (const r of reports) {
    const hits = byName.get(r.collector) || [];
    if (hits.length === 1) matched.push({ r, p: hits[0] });
    else unmatched.push({ r, why: hits.length ? `${hits.length} partners share this name` : "no partner has this exact name" });
  }

  console.log(`${reports.length} report(s) have a collector name but no assignedPartner.`);
  console.log(`\n✔ ${matched.length} exact match(es)${APPLY ? "" : " (dry run – nothing written)"}:`);
  for (const { r, p } of matched) {
    console.log(`  ${r._id}  "${r.collector}" → ${p._id}${p.partnerStatus !== "approved" ? `  (partner is ${p.partnerStatus})` : ""}`);
  }
  console.log(`\n✘ ${unmatched.length} could not be matched – re-assign these in admin.html:`);
  for (const { r, why } of unmatched) console.log(`  ${r._id}  "${r.collector}"  [${r.status}]  ${why}`);

  if (APPLY && matched.length) {
    // assignedPartner: null in the filter, so running this twice changes nothing.
    const res = await WasteReport.bulkWrite(matched.map(({ r, p }) => ({
      updateOne: { filter: { _id: r._id, assignedPartner: null, collector: r.collector }, update: { $set: { assignedPartner: p._id } } }
    })));
    console.log(`\nUpdated ${res.modifiedCount} report(s).`);
  } else if (!APPLY) {
    console.log("\nRun again with --apply to write the matches.");
  }
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
