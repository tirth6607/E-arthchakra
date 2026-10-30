const bcrypt = require("bcryptjs");
const User = require("../../models/User");
const { setAuthCookie } = require("../../lib/auth");
const { route, HttpError, str } = require("../../lib/http");

// Compared against when the email doesn't exist, so timing doesn't reveal valid emails.
const DUMMY_HASH = bcrypt.hashSync("earthchakra-dummy-password", 10);

module.exports = route({ methods: ["POST"] }, async (req, res) => {
  const body = req.body || {};
  const email = str(body.email, 200).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const role = str(body.role, 20); // optional: the tab the user picked on the login page

  if (!email || !password) throw new HttpError(400, "Please enter your email and password.");

  const user = await User.findOne({ email }).select("+passwordHash");
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, "Incorrect email or password.");

  // If they picked the Admin/Partner tab, the account must actually have that role.
  if (role && role !== user.role) {
    throw new HttpError(403, `This account is not a ${role} account. Choose the right tab and try again.`);
  }

  setAuthCookie(res, user);
  res.json({ user: user.toClient() });
});
