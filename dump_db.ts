import Database from "better-sqlite3";
const db = new Database("database.sqlite");

console.log("--- Users ---");
console.log(db.prepare("SELECT * FROM Users").all());

console.log("--- Feedback ---");
console.log(db.prepare("SELECT * FROM Feedback").all());

console.log("--- Notifications ---");
console.log(db.prepare("SELECT * FROM Notifications").all());

console.log("--- Jobs ---");
console.log(db.prepare("SELECT * FROM Jobs").all());
