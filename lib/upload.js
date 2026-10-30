const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { HttpError } = require("./http");

const MAX_BYTES = 3 * 1024 * 1024; // decoded image limit (the browser compresses to ~0.5–1 MB first)

// Decide the file type from the bytes, never from what the client claims.
function sniff(b) {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", type: "image/png" };
  if (b.length > 12 && b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return { ext: "webp", type: "image/webp" };
  return null;
}

function decodeDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") throw new HttpError(400, "A photo is required.");
  const m = /^data:image\/(?:jpeg|png|webp);base64,/.exec(dataUrl.slice(0, 40));
  if (!m) throw new HttpError(400, "Photo must be a JPEG, PNG or WebP image.");
  const b64 = dataUrl.slice(m[0].length);
  if (b64.length * 0.75 > MAX_BYTES * 1.02) throw new HttpError(413, "Photo is too large (max 3 MB).");
  const buf = Buffer.from(b64, "base64");
  if (buf.length > MAX_BYTES) throw new HttpError(413, "Photo is too large (max 3 MB).");
  const kind = sniff(buf);
  if (!kind) throw new HttpError(400, "That file is not a valid JPEG, PNG or WebP image.");
  return { buf, ...kind };
}

// Returns { url, key }. Vercel Blob in production; local disk when LOCAL_UPLOADS=1 (dev only).
async function storePhoto(dataUrl, owner = "anon") {
  const { buf, ext, type } = decodeDataUrl(dataUrl);
  const key = `waste-reports/${String(owner)}/${Date.now()}-${crypto.randomBytes(16).toString("hex")}.${ext}`; // unguessable

  if (process.env.LOCAL_UPLOADS === "1") {
    const file = path.join(process.cwd(), "public", "uploads", key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buf);
    return { url: "/uploads/" + key, key };
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new HttpError(503, "Photo storage is not configured yet.");
  const { put } = await import("@vercel/blob");
  const blob = await put(key, buf, { access: "public", contentType: type, addRandomSuffix: false });
  return { url: blob.url, key };
}

async function removePhoto(url) {
  try {
    if (process.env.LOCAL_UPLOADS === "1") return fs.unlinkSync(path.join(process.cwd(), "public", url));
    const { del } = await import("@vercel/blob");
    await del(url);
  } catch (e) { /* best effort */ }
}

// A photo reference is valid only if the key sits under THIS user's folder and the URL points at that key.
function validPhotoRef(p, owner) {
  if (!p || typeof p.key !== "string" || typeof p.url !== "string") return false;
  if (!new RegExp("^waste-reports/" + String(owner).replace(/[^A-Za-z0-9]/g, "") + "/\\d+-[a-f0-9]{32}\\.(jpg|png|webp)$").test(p.key)) return false;
  return p.url === "/uploads/" + p.key || (/^https:\/\/[a-z0-9.-]+\.blob\.vercel-storage\.com\//.test(p.url) && p.url.endsWith("/" + p.key));
}

module.exports = { storePhoto, removePhoto, validPhotoRef };
