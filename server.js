import express from "express";
import pkg from "pg";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const { Client } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

// create new client for each request
async function runQuery(query, params = []) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: true
  });

  await client.connect();
  const result = await client.query(query, params);
  await client.end();

  return result;
}

app.get("/", (req, res) => {
  res.send("Backend running stable");
});

// GET COUNT
app.get("/api/count/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await runQuery(
      "INSERT INTO likes (id, count) VALUES ($1, 0) ON CONFLICT (id) DO NOTHING",
      [id]
    );

    const result = await runQuery(
      "SELECT count FROM likes WHERE id = $1",
      [id]
    );

    res.json({ count: result.rows[0].count });

  } catch (err) {
    console.error("COUNT ERROR:", err);
    res.json({ count: 0 });
  }
});

// LIKE
app.post("/api/like/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await runQuery(
      "UPDATE likes SET count = count + 1 WHERE id = $1",
      [id]
    );

    res.json({ ok: true });

  } catch (err) {
    console.error("LIKE ERROR:", err);
    res.json({ ok: false });
  }
});

// UNLIKE
app.post("/api/unlike/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await runQuery(
      "UPDATE likes SET count = GREATEST(count - 1, 0) WHERE id = $1",
      [id]
    );

    res.json({ ok: true });

  } catch (err) {
    console.error("UNLIKE ERROR:", err);
    res.json({ ok: false });
  }
});

app.listen(5000, () => {
  console.log("✅ Backend running stable on http://localhost:5000");
});
