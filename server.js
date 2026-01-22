import express from "express";
import pkg from "pg";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ===========================
// GET LIKE COUNT
// ===========================
app.get("/api/count/:postId", async (req, res) => {
  const { postId } = req.params;

  const result = await pool.query(
    "SELECT COUNT(*) FROM likes WHERE post_id = $1",
    [postId]
  );

  res.json({ count: Number(result.rows[0].count) });
});

// ===========================
// CHECK IF DEVICE LIKED
// ===========================
app.get("/api/liked/:postId/:deviceId", async (req, res) => {
  const { postId, deviceId } = req.params;

  const result = await pool.query(
    "SELECT 1 FROM likes WHERE post_id=$1 AND device_id=$2",
    [postId, deviceId]
  );

  res.json({ liked: result.rowCount > 0 });
});

// ===========================
// LIKE
// ===========================
app.post("/api/like", async (req, res) => {
  const { post_id, device_id } = req.body;

  try {
    await pool.query(
      "INSERT INTO likes (post_id, device_id) VALUES ($1,$2)",
      [post_id, device_id]
    );
    res.json({ liked: true });
  } catch {
    res.json({ liked: true }); // already liked
  }
});

// ===========================
// UNLIKE
// ===========================
app.post("/api/unlike", async (req, res) => {
  const { post_id, device_id } = req.body;

  await pool.query(
    "DELETE FROM likes WHERE post_id=$1 AND device_id=$2",
    [post_id, device_id]
  );

  res.json({ liked: false });
});

app.listen(5000, () => {
  console.log("✅ Backend running");
});
