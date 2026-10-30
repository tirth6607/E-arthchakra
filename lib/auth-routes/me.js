const { route } = require("../../lib/http");

module.exports = route({ methods: ["GET"], auth: true }, async (req, res, user) => {
  res.json({ user: user.toClient() });
});
