const mongoose = require("mongoose");

const enquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    business: { type: String, trim: true, maxlength: 160, default: "" },
    phone: { type: String, trim: true, maxlength: 40, default: "" },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    subject: { type: String, trim: true, maxlength: 200, default: "" },
    message: { type: String, required: true, trim: true, maxlength: 3000 }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Enquiry || mongoose.model("Enquiry", enquirySchema);
