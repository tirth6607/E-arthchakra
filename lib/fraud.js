const fs = require("fs");
const path = require("path");
const jpeg = require("jpeg-js");

// Anti-fraud signals for waste reports. Everything the browser sends (GPS, capture time) is a claim,
// so these only add friction and route suspicious reports to a human – they are not proof.

const MAX_CAPTURE_AGE_MS = 5 * 60 * 1000; // photo must be taken in the last 5 minutes
const MAX_CLOCK_AHEAD_MS = 2 * 60 * 1000; // tolerate small phone/server clock differences
const LOW_ACCURACY_M = 100;
const FAR_M = 200;
const VERY_FAR_M = 1000;
const DUP_MAX_BITS = 6;                   // dHash: ≤ 6 of 64 bits different = same picture
const DUP_LOOKBACK = 5000;                // newest reports compared for duplicates

// Haversine distance in metres.
function distanceM(lat1, lng1, lat2, lng2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

// The stored photo, read back from Blob (or local disk in dev). Fails if the photo doesn't exist.
async function readPhoto(url) {
  if (url.startsWith("/uploads/")) return fs.readFileSync(path.join(process.cwd(), "public", url));
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error("photo fetch " + r.status);
  return Buffer.from(await r.arrayBuffer());
}

// 64-bit difference hash (dHash) as 16 hex chars: grayscale, shrink to 9×8, compare neighbours.
// Survives re-compression and resizing, so a re-uploaded copy of an old photo still matches.
function perceptualHash(buf) {
  const img = jpeg.decode(buf, { useTArray: true, maxResolutionInMP: 30, maxMemoryUsageInMB: 256 });
  const W = 9, H = 8, gray = new Float64Array(W * H);
  for (let gy = 0; gy < H; gy++) {
    const y0 = Math.floor((gy * img.height) / H), y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * img.height) / H));
    for (let gx = 0; gx < W; gx++) {
      const x0 = Math.floor((gx * img.width) / W), x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * img.width) / W));
      let sum = 0, n = 0;
      for (let y = y0; y < y1; y += 2) {            // every 2nd pixel is plenty for an 8×9 average
        for (let x = x0; x < x1; x += 2) {
          const i = (y * img.width + x) * 4;
          sum += 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]; n++;
        }
      }
      gray[gy * W + gx] = sum / n;
    }
  }
  let bits = 0n;
  for (let y = 0; y < H; y++) for (let x = 0; x < W - 1; x++) bits = (bits << 1n) | (gray[y * W + x] > gray[y * W + x + 1] ? 1n : 0n);
  return bits.toString(16).padStart(16, "0");
}

function hammingHex(a, b) {
  let v = BigInt("0x" + a) ^ BigInt("0x" + b), n = 0;
  while (v) { n += Number(v & 1n); v >>= 1n; }
  return n;
}

// One Sightengine call with two models: "genai" (type.ai_generated) and "recapture" (recapture.score,
// a photo of a screen or print). Both are 0–1; null when the check couldn't run.
const NO_SCORES = { aiScore: null, recaptureScore: null };
async function imageScores(buf) {
  const user = process.env.SIGHTENGINE_USER, secret = process.env.SIGHTENGINE_SECRET;
  if (!user || !secret) return NO_SCORES;
  try {
    const form = new FormData();
    form.append("media", new Blob([buf], { type: "image/jpeg" }), "photo.jpg");
    form.append("models", "genai,recapture");
    form.append("api_user", user);
    form.append("api_secret", secret);
    const r = await fetch("https://api.sightengine.com/1.0/check.json", { method: "POST", body: form, signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    if (!j || j.status !== "success") {
      console.error("[fraud] Sightengine check failed:", j && j.error ? j.error.message : r.status);
      return NO_SCORES;
    }
    const num = (v) => (typeof v === "number" ? v : null);
    return { aiScore: num(j.type && j.type.ai_generated), recaptureScore: num(j.recapture && j.recapture.score) };
  } catch (e) {
    console.error("[fraud] Sightengine check failed:", e && e.message);
    return NO_SCORES;
  }
}

// Previous reports with a photo that looks like one of `hashes`. Returns [{hash, reportId, bits}].
async function findDuplicates(WasteReport, hashes) {
  const prev = await WasteReport.find({ "photos.phash": { $ne: null } }, { "photos.phash": 1 })
    .sort({ createdAt: -1 }).limit(DUP_LOOKBACK).lean();
  const hits = [];
  for (const h of hashes) {
    for (const r of prev) {
      const p = (r.photos || []).find((x) => x.phash && hammingHex(h, x.phash) <= DUP_MAX_BITS);
      if (p) { hits.push({ hash: h, reportId: r._id, bits: hammingHex(h, p.phash) }); break; }
    }
  }
  return hits;
}

// Weights for the combined 0–100 risk score.
const RISK = [
  // [reason code, points, human text]
  ["ai_high", 70, (s) => `Photo looks AI-generated (score ${s.aiScore.toFixed(2)})`],
  ["ai_medium", 40, (s) => `Photo may be AI-generated (score ${s.aiScore.toFixed(2)})`],
  ["ai_low", 10, (s) => `Slight AI-generation signal (score ${s.aiScore.toFixed(2)})`],
  ["ai_unavailable", 25, () => "AI-image check could not run"],
  ["recapture_very_high", 70, (s) => `Photo looks like a picture of a screen or print (recapture ${s.recaptureScore.toFixed(2)})`],
  ["recapture_high", 30, (s) => `Photo may be a picture of a screen or print (recapture ${s.recaptureScore.toFixed(2)})`],
  ["recapture_unavailable", 25, () => "Screen-photo check could not run"],
  ["duplicate", 60, () => "Photo matches a previous report"],
  ["very_far", 50, (s) => `Photo taken ${s.distanceM} m from the reported location`],
  ["far", 30, (s) => `Photo taken ${s.distanceM} m from the reported location`],
  ["low_accuracy", 25, (s) => `GPS accuracy is low (±${s.gpsAccuracy} m)`]
];
const REVIEW_AT = 25, REJECT_AT = 70;

function score(s) {
  const codes = [];
  if (s.aiScore == null) codes.push("ai_unavailable");
  else if (s.aiScore >= 0.9) codes.push("ai_high");
  else if (s.aiScore >= 0.5) codes.push("ai_medium");
  else if (s.aiScore >= 0.2) codes.push("ai_low");
  if (s.recaptureScore == null) { if (s.aiScore != null) codes.push("recapture_unavailable"); } // one "couldn't run" is enough
  else if (s.recaptureScore >= 0.85) codes.push("recapture_very_high");
  else if (s.recaptureScore >= 0.5) codes.push("recapture_high");                                   // Sightengine: > 0.5 = likely recapture
  if (s.duplicateOf) codes.push("duplicate");
  if (s.distanceM > VERY_FAR_M) codes.push("very_far");
  else if (s.distanceM > FAR_M) codes.push("far");
  if (s.gpsAccuracy > LOW_ACCURACY_M) codes.push("low_accuracy");

  const rules = RISK.filter(([c]) => codes.includes(c));
  const riskScore = Math.min(100, rules.reduce((n, [, pts]) => n + pts, 0));
  const status = riskScore >= REJECT_AT ? "rejected" : riskScore >= REVIEW_AT ? "needs-review" : "auto-approved";
  return { riskScore, status, reasons: rules.map(([code, , text]) => ({ code, text: text(s) })) };
}

module.exports = {
  MAX_CAPTURE_AGE_MS, MAX_CLOCK_AHEAD_MS,
  distanceM, readPhoto, perceptualHash, hammingHex, imageScores, findDuplicates, score
};
