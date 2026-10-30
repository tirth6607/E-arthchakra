const Enquiry = require("../models/Enquiry");
const { route, HttpError, str } = require("../lib/http");

// POST is public (contact form). GET is admin-only.
module.exports = route({ methods: ["GET", "POST"] }, async (req, res) => {
  if (req.method === "POST") {
    const b = req.body || {};
    const name = str(b.name, 120);
    const email = str(b.email, 200);
    const message = str(b.message, 3000);
    if (!name || !email || !message) throw new HttpError(400, "Name, email and message are required.");
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, "Please enter a valid email address.");

    await Enquiry.create({
      name,
      email,
      message,
      business: str(b.business, 160),
      phone: str(b.phone, 40),
      subject: str(b.subject, 200)
    });
    return res.status(201).json({ ok: true });
  }

  const { getUser } = require("../lib/auth");
  const user = await getUser(req);
  if (!user) throw new HttpError(401, "Please sign in.");
  if (user.role !== "admin") throw new HttpError(403, "You do not have access to this.");

  const enquiries = await Enquiry.find().sort({ createdAt: -1 }).limit(500);
  res.json({ enquiries });
});
