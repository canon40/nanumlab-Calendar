import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
    const { title, category, deadline, scheduled_date, notes, impact, urgency, effort, parent_id, priority_score } = req.body;
    const info = db.prepare(
      "INSERT INTO tasks (title, category, deadline, scheduled_date, notes, impact, urgency, effort, parent_id, priority_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(title, category, deadline, scheduled_date, notes, impact || 1, urgency || 1, effort || 30, parent_id || null, priority_score || null);
    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    const { title, status, scheduled_date, deadline, notes, impact, urgency, effort, category, is_locked, parent_id, priority_score } = req.body;
    
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
