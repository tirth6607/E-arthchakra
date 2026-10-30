// All /api/auth/* routes in ONE serverless function (Vercel Hobby allows max 12 per deployment).
// URLs are unchanged: /api/auth/login, /api/auth/forgot-password, ...
// Each handler lives in lib/auth-routes/ and keeps its own method checks, rate limits and errors.
const handlers = {
  login: require("../../lib/auth-routes/login"),
  logout: require("../../lib/auth-routes/logout"),
  me: require("../../lib/auth-routes/me"),
  register: require("../../lib/auth-routes/register"),
  "register-partner": require("../../lib/auth-routes/register-partner"),
  "forgot-password": require("../../lib/auth-routes/forgot-password"),
  "resend-reset-code": require("../../lib/auth-routes/resend-reset-code"),
  "verify-reset-code": require("../../lib/auth-routes/verify-reset-code"),
  "reset-password": require("../../lib/auth-routes/reset-password")
};

module.exports = (req, res) => {
  const action = String((req.query && req.query.action) || "");
  const handler = Object.prototype.hasOwnProperty.call(handlers, action) ? handlers[action] : null;
  if (!handler) return res.status(404).json({ error: "Not found." });
  return handler(req, res);
};
