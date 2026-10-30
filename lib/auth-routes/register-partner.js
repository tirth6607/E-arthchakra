const bcrypt = require("bcryptjs");
const User = require("../../models/User");
const { setAuthCookie } = require("../../lib/auth");
const { route, HttpError, str } = require("../../lib/http");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Public sign-up for collection partners. The account can sign in straight away,
// but only sees open pickup requests once an admin approves it (partnerStatus).
module.exports = route({ methods: ["POST"] }, async (req, res) => {
  const body = req.body || {};
  const name = str(body.name, 120);
  const partnerName = str(body.partnerName, 120);
  const email = str(body.email, 200).toLowerCase();
  const phone = str(body.phone, 40);
  const city = str(body.city, 80);
  const password = typeof body.password === "string" ? body.password : "";

  if (!name || !partnerName || !email || !phone || !city || !password) {
    throw new HttpError(400, "Please complete every field.");
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, "Please enter a valid email address.");
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters.");

  if (await User.exists({ email })) {
    throw new HttpError(409, "An account with this email already exists. Please sign in.");
  }
  // Pickups are assigned by partner name, so it must be unique.
  if (await User.exists({ role: "partner", partnerName: new RegExp("^" + escapeRegex(partnerName) + "$", "i") })) {
    throw new HttpError(409, "A partner with this company name is already registered.");
  }

  const user = await User.create({
    name,
    email,
    phone,
    city,
    businessName: partnerName,
    passwordHash: await bcrypt.hash(password, 10),
    role: "partner",
    partnerName,
    partnerStatus: "pending"
  });

  setAuthCookie(res, user);
  res.status(201).json({ user: user.toClient() });
});
