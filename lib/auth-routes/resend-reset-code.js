const { route } = require("../../lib/http");
const { requestResetCode } = require("../../lib/passwordReset");

// Same rules as forgot-password: the new code invalidates the old one, 60s cooldown, 3 per 15 min.
module.exports = route({ methods: ["POST"] }, requestResetCode);
