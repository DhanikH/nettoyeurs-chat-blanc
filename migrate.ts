import Database from "better-sqlite3";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

console.log("DEBUG: process.env keys:", Object.keys(process.env).filter(k => k.includes("SUPABASE")));

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const db = new Database("database.sqlite");

async function migrate() {
  console.log("Starting migration from SQLite to Supabase...");

  const tables = [
    { name: "Users", sqlite: "Users" },
    { name: "Properties", sqlite: "Properties" },
    { name: "Jobs", sqlite: "Jobs" },
    { name: "CustomerNotes", sqlite: "CustomerNotes" },
    { name: "Notifications", sqlite: "Notifications" },
    { name: "Feedback", sqlite: "Feedback" },
  ];

  for (const table of tables) {
    console.log(`Migrating table: ${table.name}...`);
    
    try {
      const rows = db.prepare(`SELECT * FROM ${table.sqlite}`).all();
      
      if (rows.length === 0) {
        console.log(`No data found in ${table.sqlite}. Skipping.`);
        continue;
      }

      // Process rows to ensure they match Supabase schema
      // For example, SQLite might use 0/1 for booleans, while Postgres uses boolean type
      // But in our schema we used INTEGER for some flags to match SQLite logic
      const processedRows = rows.map((row: any) => {
        const newRow = { ...row };
        // Handle any specific mapping if needed
        return newRow;
      });

      // Insert in batches of 100 to avoid payload limits
      const batchSize = 100;
      for (let i = 0; i < processedRows.length; i += batchSize) {
        const batch = processedRows.slice(i, i + batchSize);
        const { error } = await supabase.from(table.name).insert(batch);
        
        if (error) {
          console.error(`Error migrating ${table.name} batch ${i / batchSize}:`, error);
        } else {
          console.log(`Migrated ${batch.length} rows to ${table.name}.`);
        }
      }
    } catch (err) {
      console.error(`Failed to migrate ${table.name}:`, err);
    }
  }

  console.log("Migration complete!");
}

migrate().catch(console.error);
