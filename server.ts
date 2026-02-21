import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Initialize JSON Database
const dbPath = process.env.NODE_ENV === "production" ? "/tmp/users.json" : "users.json";

// Ensure the file exists
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify([]));
}

function getUsers() {
  try {
    const data = fs.readFileSync(dbPath, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function saveUser(user: any) {
  const users = getUsers();
  const newUser = { ...user, id: Date.now(), created_at: new Date().toISOString() };
  users.push(newUser);
  fs.writeFileSync(dbPath, JSON.stringify(users, null, 2));
  return newUser.id;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Registration Endpoint
  app.post("/api/register", (req, res) => {
    const { name, email, phone } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: "Name and Email are required" });
    }

    try {
      const users = getUsers();
      if (users.find((u: any) => u.email === email)) {
        return res.status(400).json({ error: "Email already registered" });
      }
      
      const userId = saveUser({ name, email, phone });
      res.json({ success: true, userId });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV });
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    const indexPath = path.join(distPath, "index.html");
    
    console.log(`Production mode: serving static files from ${distPath}`);
    app.use(express.static(distPath));
    
    // SPA Fallback
    app.get("*", (req, res) => {
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error(`Error sending index.html: ${err.message}`);
          res.status(500).send("Application not built correctly. Please check build logs.");
        }
      });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
