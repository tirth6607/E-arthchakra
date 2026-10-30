const { HttpError } = require("./http");

const FIX_MAX_AGE_MS = 30 * 60 * 1000; // a GPS fix older than this is stale
const FIX_MAX_AHEAD_MS = 5 * 60 * 1000; // allow small clock differences

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// Validates the GPS fields sent by the browser. The client is never trusted.
// Shared by waste reports and pickup requests.
function readLocation(b) {
  const { latitude, longitude, locationAccuracy, locationTimestamp } = b;
  if (!isNum(latitude) || !isNum(longitude)) throw new HttpError(400, "Location is required. Please capture your location.");
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new HttpError(400, "That location is not valid. Please capture it again.");
  if (latitude === 0 && longitude === 0) throw new HttpError(400, "That location is not valid. Please capture it again."); // a default/blank fix

  let accuracy = null;
  if (locationAccuracy !== undefined && locationAccuracy !== null) {
    if (!isNum(locationAccuracy) || locationAccuracy < 0 || locationAccuracy > 100000) throw new HttpError(400, "Location accuracy is not valid. Please capture your location again.");
    accuracy = Math.round(locationAccuracy);
  }

  let takenAt = null;
  if (locationTimestamp !== undefined && locationTimestamp !== null) {
    if (!isNum(locationTimestamp) || locationTimestamp <= 0) throw new HttpError(400, "Location time is not valid. Please capture your location again.");
    const age = Date.now() - locationTimestamp;
    if (age > FIX_MAX_AGE_MS || age < -FIX_MAX_AHEAD_MS) throw new HttpError(400, "Your location is out of date. Please capture it again.");
    takenAt = new Date(locationTimestamp);
  }
  return { latitude, longitude, locationAccuracy: accuracy, locationTimestamp: takenAt };
}

module.exports = { readLocation };
