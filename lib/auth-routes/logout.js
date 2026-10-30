const { clearAuthCookie } = require("../../lib/auth");

module.exports = (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
};
