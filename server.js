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
  const { postId } = req.params;

  const result = await pool.query(
    "SELECT COUNT(*) FROM likes WHERE post_id=$1",
    [postId]
  );

  res.json({ count: Number(result.rows[0].count) });
});

// ============================
// CHECK DEVICE LIKE
// ============================
app.get("/api/liked/:postId/:deviceId", async (req, res) => {
  const { postId, deviceId } = req.params;

  const result = await pool.query(
    "SELECT 1 FROM likes WHERE post_id=$1 AND device_id=$2",
    [postId, deviceId]
  );

  res.json({ liked: result.rowCount > 0 });
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

  await pool.query(
    "DELETE FROM likes WHERE post_id=$1 AND device_id=$2",
    [post_id, device_id]
  );

  res.json({ liked: false });
});

// ============================
// CONTACT EMAIL (RESEND)
// ============================
app.post("/api/contact", async (req, res) => {
  const { name, email, phone, message } = req.body;

  try {
    await resend.emails.send({
      from: "Portfolio <onboarding@resend.dev>",
      to: ["gowrishankar1142003@gmail.com"],
      reply_to: email,
      subject: `📩 New Message from ${name}`,
      html: `
        <h2>Portfolio Contact</h2>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p><b>Message:</b></p>
        <p>${message}</p>
      `
    });

    res.json({ success: true });

  } catch (err) {
    console.error("EMAIL ERROR:", err);
    res.status(500).json({ success: false });
  }
});

app.listen(5000, () => {
  console.log("✅ Backend running");
});
