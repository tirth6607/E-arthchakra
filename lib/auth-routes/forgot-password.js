const { route } = require("../../lib/http");
const { requestResetCode } = require("../../lib/passwordReset");

module.exports = route({ methods: ["POST"] }, requestResetCode);
