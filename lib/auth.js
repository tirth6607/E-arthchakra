const jwt = require("jsonwebtoken");
const User = require("../models/User");

const COOKIE = "ef_token";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set");
  return process.env.JWT_SECRET;
}

function setAuthCookie(res, user) {
  const token = jwt.sign({ sub: String(user._id), role: user.role }, secret(), {
    expiresIn: MAX_AGE
  });
  const secure = process.env.VERCEL ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`
  );
}

function clearAuthCookie(res) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`
  );
}

function readToken(req) {
  const header = req.headers.cookie || "";
  const match = header.split(";").map((s) => s.trim()).find((s) => s.startsWith(COOKIE + "="));
  return match ? match.slice(COOKIE.length + 1) : null;
}

// Returns the User document, or null.
async function getUser(req) {
  const token = readToken(req);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, secret());
    const user = await User.findById(payload.sub);
    // Sessions created before the last password reset are no longer valid.
    if (user && user.passwordChangedAt && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

module.exports = { setAuthCookie, clearAuthCookie, getUser };
