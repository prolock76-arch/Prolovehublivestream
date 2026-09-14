// ============================================================
// ProLoveHub — LiveKit Token Server
// Runs on Render as a Web Service (not Static Site)
// Serves both HTML files AND the token API
// ============================================================

const express = require("express");
const cors = require("cors");
const path = require("path");
const { AccessToken } = require("livekit-server-sdk");

const app = express();

app.use(cors());
app.use(express.json());

// ---- LiveKit credentials from Render env vars ----
const LIVEKIT_API_KEY    = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL        = process.env.LIVEKIT_URL || "wss://prolovehublivestream.livekit.cloud";

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  console.error("⚠️  Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET");
  console.error("    Add them in Render → Environment tab");
}

// ============================================================
// API — HEALTH
// ============================================================
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    hasKey: !!LIVEKIT_API_KEY,
    hasSecret: !!LIVEKIT_API_SECRET,
    url: LIVEKIT_URL,
    time: new Date().toISOString(),
  });
});

// ============================================================
// API — TOKEN
// POST /api/token
// Body: { room, identity, name, role }
// role: "host" | "viewer"
// ============================================================
app.post("/api/token", async (req, res) => {
  try {
    const { room, identity, name, role } = req.body || {};

    if (!room || !identity) {
      return res.status(400).json({ error: "Missing room or identity" });
    }
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res.status(500).json({ error: "Server not configured — missing LiveKit keys" });
    }

    const isHost = role === "host";

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name: name || identity,
      ttl: "2h",
    });

    at.addGrant({
      roomJoin: true,
      room,
      canPublish: isHost,       // only hosts broadcast
      canSubscribe: true,       // everyone can watch
      canPublishData: true,     // chat
      roomAdmin: isHost,
    });

    const token = await at.toJwt();

    res.json({
      token,
      url: LIVEKIT_URL,
      room,
      role: isHost ? "host" : "viewer",
    });
  } catch (err) {
    console.error("Token error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// STATIC FILES — serves your HTML pages
// ============================================================
app.use(express.static(__dirname, {
  extensions: ["html"],
}));

// Fallback for clean URLs like /creator → creator.html
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.sendFile(path.join(__dirname, "index.html"));
});

// ============================================================
// START
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✓ ProLoveHub running on port ${PORT}`);
  console.log(`  LiveKit URL: ${LIVEKIT_URL}`);
  console.log(`  API Key set: ${!!LIVEKIT_API_KEY}`);
  console.log(`  API Secret set: ${!!LIVEKIT_API_SECRET}`);
});
