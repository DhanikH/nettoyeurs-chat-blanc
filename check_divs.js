
const fs = require('fs');
const content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

let balance = 0;
const lines = content.split('\n');
lines.forEach((line, i) => {
  const opens = (line.match(/<div/g) || []).length;
  const closes = (line.match(/<\/div/g) || []).length;
  if (opens > 0 || closes > 0) {
    balance += opens - closes;
    console.log(`${i + 1}: ${line.trim()} | Balance: ${balance}`);
  }
});
