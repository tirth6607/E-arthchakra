// Sends email through Resend's HTTP API (https://resend.com). No SDK needed: Node 20 has fetch.
// Required env: RESEND_API_KEY, EMAIL_FROM (e.g. "E-arthchakra <no-reply@yourdomain.com>").

async function sendEmail({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    // Local testing without an email account: opt in with EMAIL_DEV_CONSOLE=1.
    // Refused on Vercel so codes never end up in production logs.
    if (process.env.EMAIL_DEV_CONSOLE === "1" && !process.env.VERCEL) {
      console.log(`\n[EMAIL_DEV_CONSOLE] To: ${to}\nSubject: ${subject}\n\n${text}\n`);
      return;
    }
    throw new Error("Email is not configured (RESEND_API_KEY / EMAIL_FROM)");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text, html })
  });

  if (!response.ok) {
    // Log the provider's status only – never the message body, which contains the code.
    throw new Error(`Email provider responded with ${response.status}`);
  }
}

module.exports = { sendEmail };
