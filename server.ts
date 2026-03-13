import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config();

console.log("Server script starting...");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("tasks.db");
console.log("Database connected.");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    deadline DATETIME,
    scheduled_date DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
console.log("Database schema initialized.");

// Migration: Add impact, urgency, effort if they don't exist
const columns = db.prepare("PRAGMA table_info(tasks)").all();
const columnNames = columns.map((c: any) => c.name);

if (!columnNames.includes("impact")) {
  db.exec("ALTER TABLE tasks ADD COLUMN impact INTEGER DEFAULT 1");
}
if (!columnNames.includes("urgency")) {
  db.exec("ALTER TABLE tasks ADD COLUMN urgency INTEGER DEFAULT 1");
}
if (!columnNames.includes("effort")) {
  db.exec("ALTER TABLE tasks ADD COLUMN effort INTEGER DEFAULT 30");
}
if (!columnNames.includes("is_locked")) {
  db.exec("ALTER TABLE tasks ADD COLUMN is_locked INTEGER DEFAULT 0");
}
if (!columnNames.includes("parent_id")) {
  db.exec("ALTER TABLE tasks ADD COLUMN parent_id INTEGER DEFAULT NULL");
}
if (!columnNames.includes("priority_score")) {
  db.exec("ALTER TABLE tasks ADD COLUMN priority_score REAL DEFAULT NULL");
}
if (!columnNames.includes("doc_url")) {
  db.exec("ALTER TABLE tasks ADD COLUMN doc_url TEXT DEFAULT NULL");
}
if (!columnNames.includes("google_event_id")) {
  db.exec("ALTER TABLE tasks ADD COLUMN google_event_id TEXT DEFAULT NULL");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Google OAuth2 client (Calendar 연동)
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/google/callback";

  const oauth2Client =
    GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
      ? new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)
      : null;

  let googleTokens: any | null = null;

  // API Routes
  app.get("/api/tasks", (req, res) => {
    try {
      // Use stored priority_score if exists, otherwise calculate using the formula
      // Formula: Inverted so lower is better (Rank 1 is top)
      // Automatic range: 10 + (25 - (impact * 3 + urgency * 2)) -> 10 to 30
      const tasks = db.prepare(`
        SELECT *, 
        COALESCE(priority_score, 10 + (25 - (COALESCE(impact, 1) * 3 + COALESCE(urgency, 1) * 2))) as priority_score 
        FROM tasks 
        ORDER BY scheduled_date ASC, priority_score ASC
      `).all();
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.post("/api/tasks", (req, res) => {
    const { title, category, deadline, scheduled_date, notes, impact, urgency, effort, parent_id, priority_score, doc_url, google_event_id } = req.body;
    const sched = scheduled_date || null;
    const sameSlot = sched
      ? db.prepare("SELECT id FROM tasks WHERE scheduled_date = ? AND category = ? LIMIT 1").get(sched, category)
      : db.prepare("SELECT id FROM tasks WHERE scheduled_date IS NULL AND category = ? LIMIT 1").get(category);
    if (sameSlot) {
      return res.status(400).json({ error: `해당 날짜에 이미 ${category === 'Part 1' ? '제조' : category === 'Part 2' ? '영업' : '마케팅'} 업무가 있습니다. (하루 1건씩)` });
    }
    const info = db.prepare(
      "INSERT INTO tasks (title, category, deadline, scheduled_date, notes, impact, urgency, effort, parent_id, priority_score, doc_url, google_event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(title, category, deadline, scheduled_date, notes, impact || 1, urgency || 1, effort || 30, parent_id || null, priority_score || null, doc_url || null, google_event_id || null);
    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    const { title, status, scheduled_date, deadline, notes, impact, urgency, effort, category, is_locked, parent_id, priority_score, doc_url, google_event_id } = req.body;
    
    if (scheduled_date !== undefined || category) {
      const current = db.prepare("SELECT scheduled_date, category FROM tasks WHERE id = ?").get(id) as { scheduled_date: string | null; category: string } | undefined;
      const newSched = scheduled_date !== undefined ? scheduled_date : current?.scheduled_date ?? null;
      const newCat = category || current?.category;
      const conflict = newSched
        ? db.prepare("SELECT id FROM tasks WHERE scheduled_date = ? AND category = ? AND id != ? LIMIT 1").get(newSched, newCat, id)
        : db.prepare("SELECT id FROM tasks WHERE scheduled_date IS NULL AND category = ? AND id != ? LIMIT 1").get(newCat, id);
      if (conflict) {
        return res.status(400).json({ error: `해당 날짜에 이미 ${newCat === 'Part 1' ? '제조' : newCat === 'Part 2' ? '영업' : '마케팅'} 업무가 있습니다. (하루 1건씩)` });
      }
    }
    
    const updates = [];
    const params = [];
    
    if (title) { updates.push("title = ?"); params.push(title); }
    if (status) { updates.push("status = ?"); params.push(status); }
    if (scheduled_date) { updates.push("scheduled_date = ?"); params.push(scheduled_date); }
    if (deadline !== undefined) { updates.push("deadline = ?"); params.push(deadline); }
    if (notes !== undefined) { updates.push("notes = ?"); params.push(notes); }
    if (impact !== undefined) { updates.push("impact = ?"); params.push(impact); }
    if (urgency !== undefined) { updates.push("urgency = ?"); params.push(urgency); }
    if (effort !== undefined) { updates.push("effort = ?"); params.push(effort); }
    if (category) { updates.push("category = ?"); params.push(category); }
    if (is_locked !== undefined) { updates.push("is_locked = ?"); params.push(is_locked); }
    if (parent_id !== undefined) { updates.push("parent_id = ?"); params.push(parent_id); }
    if (priority_score !== undefined) { updates.push("priority_score = ?"); params.push(priority_score); }
    if (doc_url !== undefined) { updates.push("doc_url = ?"); params.push(doc_url); }
    if (google_event_id !== undefined) { updates.push("google_event_id = ?"); params.push(google_event_id); }
    
    params.push(id);
    
    if (updates.length > 0) {
      db.prepare(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    }
    res.json({ success: true });
  });

  app.delete("/api/tasks/:id", (req, res) => {
    db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // --- Google Calendar OAuth & Sync ---
  app.get("/api/google/auth-url", (req, res) => {
    if (!oauth2Client) {
      return res.status(400).json({ error: "Google OAuth가 설정되지 않았습니다. .env를 확인하세요." });
    }
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/calendar.events"],
      prompt: "consent",
    });
    res.json({ url });
  });

  app.get("/api/google/callback", async (req, res) => {
    try {
      if (!oauth2Client) {
        return res.status(400).send("Google OAuth가 설정되지 않았습니다.");
      }
      const code = req.query.code as string | undefined;
      if (!code) return res.status(400).send("code 없음");

      const { tokens } = await oauth2Client.getToken(code);
      googleTokens = tokens;
      oauth2Client.setCredentials(tokens);

      res.send("<script>window.close();</script> Google Calendar 연동이 완료되었습니다. 창을 닫아주세요.");
    } catch (err: any) {
      console.error("Google OAuth callback error", err);
      res.status(500).send("Google 연동 실패");
    }
  });

  app.post("/api/google/sync", async (req, res) => {
    try {
      if (!oauth2Client || !googleTokens) {
        return res.status(400).json({ error: "먼저 Google Calendar 연동을 완료하세요." });
      }
      oauth2Client.setCredentials(googleTokens);
      const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      const tasks = db
        .prepare(
          "SELECT * FROM tasks WHERE scheduled_date IS NOT NULL ORDER BY scheduled_date ASC"
        )
        .all() as any[];

      const promises = tasks.map(async (t: any) => {
        const date = t.scheduled_date as string;
        const start = new Date(date);
        const end = new Date(date);
        end.setHours(end.getHours() + 1);

        if (t.google_event_id) {
          await calendar.events.update({
            calendarId: "primary",
            eventId: t.google_event_id,
            requestBody: {
              summary: t.title,
              description: t.notes || "",
              start: { dateTime: start.toISOString() },
              end: { dateTime: end.toISOString() },
            },
          });
          return;
        }

        const created = await calendar.events.insert({
          calendarId: "primary",
          requestBody: {
            summary: t.title,
            description: t.notes || "",
            start: { dateTime: start.toISOString() },
            end: { dateTime: end.toISOString() },
          },
        });

        if (created.data.id) {
          db.prepare("UPDATE tasks SET google_event_id = ? WHERE id = ?").run(
            created.data.id,
            t.id
          );
        }
      });

      await Promise.all(promises);
      res.json({ success: true, count: tasks.length });
    } catch (err: any) {
      console.error("Google Calendar sync error", err);
      res.status(500).json({ error: "Google Calendar 동기화 실패", message: err.message });
    }
  });

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
