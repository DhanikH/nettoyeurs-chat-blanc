import Database from "better-sqlite3";
import crypto from "crypto";

const db = new Database("database.sqlite");

const cleanerEmail = "test";
const cleaner = db.prepare("SELECT * FROM Users WHERE contact_email = ?").get(cleanerEmail);

if (!cleaner) {
  console.log("Cleaner not found");
  process.exit(1);
}

// Create a homeowner
const homeownerId = crypto.randomUUID();
db.prepare("INSERT INTO Users (id, role_designation, contact_email, full_name, phone_number, password, is_approved) VALUES (?, 'homeowner', 'homeowner@test.com', 'Test Homeowner', '(555) 987-6543', 'password', 1)").run(homeownerId);

// Create a property
const propertyId = crypto.randomUUID();
db.prepare("INSERT INTO Properties (id, owner_id, square_feet, bedrooms, bathrooms, living_rooms, windows, offices) VALUES (?, ?, 2000, 3, 2, 1, 10, 1)").run(propertyId, homeownerId);

// Create some jobs
const job1Id = crypto.randomUUID();
const job2Id = crypto.randomUUID();
const job3Id = crypto.randomUUID();

// Job 1: Completed and rated
db.prepare("INSERT INTO Jobs (id, property_id, homeowner_id, cleaner_id, scheduled_date, calculated_base_price, final_transaction_price, job_lifecycle_status, rating, review_comment) VALUES (?, ?, ?, ?, ?, 150, 150, 'completed', 5, 'Great job, very thorough!')").run(
  job1Id, propertyId, homeownerId, cleaner.id, new Date(Date.now() - 86400000 * 2).toISOString()
);

// Job 2: Claimed and scheduled (upcoming)
db.prepare("INSERT INTO Jobs (id, property_id, homeowner_id, cleaner_id, scheduled_date, calculated_base_price, final_transaction_price, job_lifecycle_status) VALUES (?, ?, ?, ?, ?, 120, 120, 'claimed_scheduled')").run(
  job2Id, propertyId, homeownerId, cleaner.id, new Date(Date.now() + 86400000 * 2).toISOString()
);

// Job 3: Completed and rated (another one)
db.prepare("INSERT INTO Jobs (id, property_id, homeowner_id, cleaner_id, scheduled_date, calculated_base_price, final_transaction_price, job_lifecycle_status, rating, review_comment) VALUES (?, ?, ?, ?, ?, 200, 200, 'completed', 4, 'Good work, but missed a spot in the kitchen.')").run(
  job3Id, propertyId, homeownerId, cleaner.id, new Date(Date.now() - 86400000 * 10).toISOString()
);

console.log("Dummy data created successfully.");
