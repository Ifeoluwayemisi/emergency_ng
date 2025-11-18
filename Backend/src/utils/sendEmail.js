import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT || "465", 10),
  secure: process.env.MAIL_PORT === "465", // true if using SSL
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

export async function sendEmail(to, subject, html) {
  try {
    const info = await transporter.sendMail({
      from: `"EmergencyHelp NG" <${process.env.MAIL_USER}>`,
      to,
      subject,
      html,
    });

    return { success: true, response: info };
  } catch (err) {
    console.error("Email Error:", err.message);
    return { success: false, error: err.message };
  }
}
