// Creates (or updates) the admin account.
// Partners register themselves on partner-register.html and are approved by the admin.
//   1) copy .env.example to .env and fill it in
//   2) npm install && npm run seed
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function upsert({ email, password, name, role }) {
  if (!email || !password) {
    console.log(`Skipping ${role}: email/password not set in .env`);
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { name, email: email.toLowerCase(), passwordHash, role },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`✔ ${role} ready: ${email}`);
}

(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(process.env.MONGODB_URI);

  await upsert({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    name: "E-arthchakra Admin",
    role: "admin"
  });

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
