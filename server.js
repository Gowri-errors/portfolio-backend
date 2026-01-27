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
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// ============================
// RESEND
// ============================
const resend = new Resend(process.env.RESEND_API_KEY);

// ============================
// ROOT
// ============================
app.get("/", (req, res) => {
  res.send("✅ Backend API running successfully");
});

// ============================
// GET ALL COUNTS (FAST)
// ============================
app.get("/api/counts", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT post_id, COUNT(*)::int AS count
      FROM likes
      GROUP BY post_id
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("COUNTS ERROR:", err);
    res.json([]);
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
  } catch {
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
      `INSERT INTO likes (post_id, device_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [post_id, device_id]
    );

    res.json({ liked: true });
  } catch (err) {
    console.error("LIKE ERROR:", err);
    res.status(500).json({ liked: false });
  }
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

    res.json({ liked: false });
  } catch (err) {
    console.error("UNLIKE ERROR:", err);
    res.status(500).json({ liked: false });
  }
});

// ============================
// CONTACT FORM
// ============================
app.post("/api/contact", async (req, res) => {
  const { name, email, phone, message } = req.body;

  try {
    // SAVE TO DB
    await pool.query(
      `INSERT INTO contact_messages (name,email,phone,message)
       VALUES ($1,$2,$3,$4)`,
      [name, email, phone, message]
    );

    // EMAIL TO DEVELOPER
    await resend.emails.send({
      from: "Portfolio <onboarding@resend.dev>",
      to: ["gowrishankar.devpro@gmail.com"],
      reply_to: email,
      subject: `📩 New Contact from ${name}`,
      html: `
        <h2>Portfolio Contact</h2>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p><b>Message:</b></p>
        <p>${message}</p>
      `
    });

    // AUTO REPLY
    await resend.emails.send({
      from: "Gowrishankar <onboarding@resend.dev>",
      to: [email],
      subject: `Thanks for contacting me, ${name}! 😊`,
      html: `
        <h3>Hello ${name}, 👋</h3>
        <p>Thank you for reaching out.</p>
        <p>I’ve received your message and will contact you shortly.</p>
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
// PORT (RENDER)
// ============================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("✅ Backend running on port", PORT);
});
