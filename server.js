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

 const resend = new Resend(process.env.RESEND_API_KEY);

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
    // ==============================
    // 1️⃣ EMAIL TO DEVELOPER
    // ==============================
    await resend.emails.send({
      from: "Portfolio <gowrishankar.dev>",
      to: ["gowrishankar.devpro@gmail.com"],
      reply_to: email,
      subject: `📩 Portfolio Message from ${name}`,
      html: `
        <h2>New Portfolio Contact</h2>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p><b>Message:</b></p>
        <p>${message}</p>
      `
    });

    // ==============================
    // 2️⃣ AUTO REPLY TO VISITOR
    // ==============================
    await resend.emails.send({
      from: "Gowrishankar <gowrishankar.dev>",
      to: [email],
      subject: `Thanks for contacting me, ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h3>Hello ${name}, 👋</h3>

          <p>
            Thank you for reaching out through my portfolio website.
          </p>

          <p>
            I’ve successfully received your message and will get back to you shortly.
          </p>

          <hr>

          <p><b>Your message:</b></p>
          <blockquote style="background:#f7f7f7;padding:10px;border-left:4px solid #4f46e5;">
            ${message}
          </blockquote>

          <br>

          <p>
            Best regards,<br>
            <b>Gowrishankar</b><br>
            Full Stack Developer | Tech Trainer
          </p>

          <p style="font-size:12px;color:#777;">
            This is an automated reply. Please do not reply to this email.
          </p>
        </div>
      `
    });

    res.json({ success: true });

  } catch (error) {
    console.error("RESEND ERROR:", error);
    res.status(500).json({ success: false });
  }
});


app.post("/api/pricing-request", async (req, res) => {
  const { plan, billing, price } = req.body;

  try {
    // Save to DB
    await pool.query(
      `INSERT INTO pricing_requests (plan, billing, price)
       VALUES ($1,$2,$3)`,
      [plan, billing, price]
    );

    // Send email to developer
    await resend.emails.send({
      from: "Portfolio <contact@gowrishankar.dev>",
      to: ["gowrishankar.devpro@gmail.com"],
      subject: `💼 New Pricing Request - ${plan}`,
      html: `
        <h2>New Pricing Inquiry</h2>
        <p><b>Plan:</b> ${plan}</p>
        <p><b>Billing:</b> ${billing}</p>
        <p><b>Price:</b> ₹${price}</p>
        <br>
        <p>Visitor clicked pricing card from portfolio.</p>
      `
    });

    res.json({ success: true });

  } catch (err) {
    console.error("PRICING ERROR:", err);
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
