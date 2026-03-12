
const Database = require('better-sqlite3');
const db = new Database('database.sqlite');
const cleaners = db.prepare("SELECT id, contact_email, is_approved FROM Users WHERE role_designation = 'cleaner'").all();
console.log(JSON.stringify(cleaners, null, 2));
