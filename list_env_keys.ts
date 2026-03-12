console.log("Environment Variable Keys:");
Object.keys(process.env).sort().forEach(key => {
  console.log(key);
});
