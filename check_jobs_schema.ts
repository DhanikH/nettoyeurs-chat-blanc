import Database from "better-sqlite3";
const db = new Database("database.sqlite");
const columns = db.prepare("PRAGMA table_info(Jobs)").all();
console.log(columns);
