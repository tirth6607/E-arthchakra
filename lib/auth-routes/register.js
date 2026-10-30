const bcrypt = require("bcryptjs");
const User = require("../../models/User");
const { setAuthCookie } = require("../../lib/auth");
const { route, HttpError, str } = require("../../lib/http");

module.exports = route({ methods: ["POST"] }, async (req, res) => {
  const body = req.body || {};
  const name = str(body.name, 120);
  const email = str(body.email, 200).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  if (!name || !email || !password) throw new HttpError(400, "Please complete name, email and password.");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, "Please enter a valid email address.");
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters.");

  if (await User.exists({ email })) {
    throw new HttpError(409, "An account with this email already exists. Please sign in.");
  }

  // role is NEVER taken from the request – public sign-ups are always customers.
  const user = await User.create({
    name,
    email,
    businessName: str(body.businessName, 160),
    phone: str(body.phone, 40),
    businessType: str(body.businessType, 60),
    city: str(body.city, 80),
    passwordHash: await bcrypt.hash(password, 10),
    role: "customer"
  });

  setAuthCookie(res, user);
  res.status(201).json({ user: user.toClient() });
});
