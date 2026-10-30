const connectDB = require("./db");
const { getUser } = require("./auth");

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Wraps a handler with: method check, DB connection, optional auth/role check,
 * and uniform JSON error handling.
 *
 *   route({ methods: ["GET","POST"], auth: true, roles: ["admin"] }, async (req, res, user) => {...})
 */
function route(options, handler) {
  const { methods = ["GET"], auth = false, roles = null } = options;

  return async (req, res) => {
    try {
      if (!methods.includes(req.method)) {
        res.setHeader("Allow", methods.join(", "));
        throw new HttpError(405, "Method not allowed");
      }

      await connectDB();

      let user = null;
      if (auth) {
        user = await getUser(req);
        if (!user) throw new HttpError(401, "Please sign in.");
        if (roles && !roles.includes(user.role)) throw new HttpError(403, "You do not have access to this.");
      }

      await handler(req, res, user);
    } catch (err) {
      if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.message });
      }
      if (err && err.name === "ValidationError") {
        return res.status(400).json({ error: Object.values(err.errors)[0].message });
      }
      console.error(err);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  };
}

const str = (v, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");

module.exports = { route, HttpError, str };
