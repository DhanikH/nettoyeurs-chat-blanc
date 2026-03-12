import Database from "better-sqlite3";
import crypto from "crypto";

const db = new Database("database.sqlite");

const email = "test@test.com";
const fullName = "Test Cleaner";
const phoneNumber = "(555) 123-4567";
const password = "test";
const role = "cleaner";
const id = crypto.randomUUID();

try {
  const existingUser = db.prepare("SELECT * FROM Users WHERE contact_email = ?").get(email);
  if (existingUser) {
    db.prepare("UPDATE Users SET role_designation = ?, password = ?, is_approved = 1, full_name = ?, phone_number = ? WHERE contact_email = ?")
      .run(role, password, fullName, phoneNumber, email);
    console.log("Test user updated successfully.");
  } else {
    db.prepare("INSERT INTO Users (id, role_designation, contact_email, full_name, phone_number, password, is_approved) VALUES (?, ?, ?, ?, ?, ?, 1)")
      .run(id, role, email, fullName, phoneNumber, password);
    console.log("Test user created successfully.");
  }
} catch (err) {
  console.error("Error creating test user:", err);
}
