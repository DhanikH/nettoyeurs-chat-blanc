import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

async function testUpdate() {
  const { error } = await supabase
    .from('properties')
    .update({
        preferred_time: 'test',
        has_pets: true
    })
    .eq('id', '00000000-0000-0000-0000-000000000000'); 
    
  if (error) {
    console.error("Update error:", error);
  } else {
    console.log("Update successful (or no rows affected)");
  }
}

testUpdate();
