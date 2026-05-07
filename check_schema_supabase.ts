import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

async function checkSchema() {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error("Error fetching properties:", error);
  } else {
    console.log("Properties table columns:", data && data.length > 0 ? Object.keys(data[0]) : "No data");
  }
}

checkSchema();
