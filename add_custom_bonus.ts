import Database from "better-sqlite3";
const db = new Database("database.sqlite");
try {
  db.prepare("ALTER TABLE Jobs ADD COLUMN custom_bonus REAL DEFAULT 0").run();
  console.log("Added custom_bonus column to Jobs table.");
} catch (e) {
  console.error("Error adding column:", e);
}
