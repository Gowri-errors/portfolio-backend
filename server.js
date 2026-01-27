import express from "express";
import pkg from "pg";
import cors from "cors";
import dotenv from "dotenv";
import { Resend } from "resend";

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

// ============================
// DATABASE
// ============================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ============================
// RESEND SETUP
// ============================
const resend = new Resend(process.env.RESEND_API_KEY);

// ============================
// ROOT CHECK
// ============================
app.get("/", (req, res) => {
  res.send("✅ Backend API running successfully");
});

// ============================
// LIKE COUNT
// ============================
app.get("/api/count/:postId", async (req, res) => {
  try {
    const { postId } = req.params;

    const result = await pool.query(
      "SELECT COUNT(*) FROM likes WHERE post_id=$1",
      [postId]
    );

    res.json({ count: Number(result.rows[0].count) });

  } catch (err) {
    console.error("COUNT ERROR:", err);
    res.status(500).json({ count: 0 });
  }
});

// ============================
// CHECK DEVICE LIKE
// ============================
app.get("/api/liked/:postId/:deviceId", async (req, res) => {
  try {
    const { postId, deviceId } = req.params;

    const result = await pool.query(
      "SELECT 1 FROM likes WHERE post_id=$1 AND device_id=$2",
      [postId, deviceId]
    );

    res.json({ liked: result.rowCount > 0 });

  } catch (err) {
    console.error("LIKED ERROR:", err);
    res.json({ liked: false });
  }
});

// ============================
// LIKE
// ============================
app.post("/api/like", async (req, res) => {
  const { post_id, device_id } = req.body;

  try {
    await pool.query(
      "INSERT INTO likes (post_id, device_id) VALUES ($1,$2)",
      [post_id, device_id]
    );
  } catch {}

  res.json({ liked: true });
});

// ============================
// UNLIKE
// ============================
app.post("/api/unlike", async (req, res) => {
  const { post_id, device_id } = req.body;

  try {
    await pool.query(
      "DELETE FROM likes WHERE post_id=$1 AND device_id=$2",
      [post_id, device_id]
    );
  } catch {}

  res.json({ liked: false });
});

// ============================
// CONTACT FORM (DB + EMAIL)
// ============================
app.post("/api/contact", async (req, res) => {
  const { name, email, phone, message } = req.body;

  try {
    // ============================
    // SAVE TO DATABASE
    // ============================
    await pool.query(
      "INSERT INTO contact_messages (name, email, phone, message) VALUES ($1,$2,$3,$4)",
      [name, email, phone, message]
    );

    // ============================
    // EMAIL TO DEVELOPER
    // ============================
    await resend.emails.send({
      from: "Portfolio <onboarding@resend.dev>",
      to: ["gowrishankar.devpro@gmail.com"],
      reply_to: email,
      subject: `📩 New Message from ${name}`,
      html: `
        <h2>New Portfolio Contact</h2>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p><b>Message:</b></p>
        <p>${message}</p>
      `
    });

    // ============================
    // AUTO REPLY TO VISITOR
    // ============================
    await resend.emails.send({
      from: "Gowrishankar <onboarding@resend.dev>",
      to: [email],
      subject: `Thanks for contacting me, ${name}! 😊`,
      html: `
        <h3>Hello ${name}, 👋</h3>
        <p>Your message has been received successfully.</p>
        <p>I’ll get back to you shortly.</p>
        <br>
        <p><b>Your message:</b></p>
        <blockquote>${message}</blockquote>
        <br>
        <p>Regards,<br><b>Gowrishankar</b></p>
      `
    });

    res.json({ success: true });

  } catch (err) {
    console.error("CONTACT ERROR:", err);
    res.status(500).json({ success: false });
  }
});

// ============================
// RENDER PORT
// ============================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("✅ Backend running on port", PORT);
});
