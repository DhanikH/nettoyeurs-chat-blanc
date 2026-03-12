Object.keys(process.env).forEach(key => {
  if (key.toLowerCase().includes('supabase')) {
    console.log(`${key}: Found`);
  }
});
