import express from "express";
import pkg from "pg";
import cors from "cors";
import dotenv from "dotenv";
 
import nodemailer from "nodemailer";
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
// ROOT
// ============================
app.get("/", (req, res) => {
  res.send("✅ Backend API running successfully");
});

// =================================================
// 🔥 GET ALL COUNTS (USED BY FRONTEND ON REFRESH)
// =================================================
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

// =================================================
// 🔥 SINGLE COUNT (BACKUP ROUTE)
// =================================================
app.get("/api/count/:postId", async (req, res) => {
  try {
    const { postId } = req.params;

    const result = await pool.query(
      "SELECT COUNT(*) FROM likes WHERE post_id=$1",
      [postId]
    );

    res.json({ count: Number(result.rows[0].count) });
  } catch (err) {
    res.json({ count: 0 });
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
      `
      INSERT INTO likes (post_id, device_id)
      VALUES ($1,$2)
      ON CONFLICT DO NOTHING
      `,
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
// CONTACT FORM EMAIL (FREE)
// ============================
app.post("/api/contact", async (req, res) => {
  const { name, email, phone, message } = req.body;

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: `"Portfolio Contact" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      replyTo: email,
      subject: `📩 New Portfolio Message from ${name}`,
      html: `
        <h2>New Contact Message</h2>
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


// ============================
// PORT
// ============================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("✅ Backend running on port", PORT);
});
