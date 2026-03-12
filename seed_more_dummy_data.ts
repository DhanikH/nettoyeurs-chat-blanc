import Database from "better-sqlite3";
import crypto from "crypto";

const db = new Database("database.sqlite");

// Create another cleaner
const cleaner2Id = crypto.randomUUID();
db.prepare("INSERT INTO Users (id, role_designation, contact_email, full_name, phone_number, password, is_approved) VALUES (?, 'cleaner', 'alice@cleaners.com', 'Alice Cleaner', '(555) 111-2222', 'password', 1)").run(cleaner2Id);

// Create another cleaner
const cleaner3Id = crypto.randomUUID();
db.prepare("INSERT INTO Users (id, role_designation, contact_email, full_name, phone_number, password, is_approved) VALUES (?, 'cleaner', 'bob@cleaners.com', 'Bob Cleaner', '(555) 333-4444', 'password', 1)").run(cleaner3Id);

// Create some jobs for Alice
const job4Id = crypto.randomUUID();
db.prepare("INSERT INTO Jobs (id, property_id, homeowner_id, cleaner_id, scheduled_date, calculated_base_price, final_transaction_price, job_lifecycle_status, rating, review_comment) VALUES (?, NULL, NULL, ?, ?, 150, 150, 'completed', 5, 'Perfect!')").run(
  job4Id, cleaner2Id, new Date(Date.now() - 86400000 * 5).toISOString()
);

const job5Id = crypto.randomUUID();
db.prepare("INSERT INTO Jobs (id, property_id, homeowner_id, cleaner_id, scheduled_date, calculated_base_price, final_transaction_price, job_lifecycle_status, rating, review_comment) VALUES (?, NULL, NULL, ?, ?, 150, 150, 'completed', 5, 'Amazing!')").run(
  job5Id, cleaner2Id, new Date(Date.now() - 86400000 * 6).toISOString()
);

// Create some jobs for Bob
const job6Id = crypto.randomUUID();
db.prepare("INSERT INTO Jobs (id, property_id, homeowner_id, cleaner_id, scheduled_date, calculated_base_price, final_transaction_price, job_lifecycle_status, rating, review_comment) VALUES (?, NULL, NULL, ?, ?, 150, 150, 'completed', 3, 'Okay.')").run(
  job6Id, cleaner3Id, new Date(Date.now() - 86400000 * 7).toISOString()
);

console.log("More dummy data created successfully.");
