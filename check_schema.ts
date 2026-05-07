import Database from "better-sqlite3";
const db = new Database("database.sqlite");
const tableInfo = db.prepare("PRAGMA table_info(Jobs)").all();
console.log(tableInfo);
