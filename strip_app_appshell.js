const fs = require('fs');

const file = 'frontend/src/App.jsx';
let content = fs.readFileSync(file, 'utf8');

// The 4 helper components at the bottom
content = content.replace(/<AppShell[^>]*>/g, '<>');
content = content.replace(/<\/AppShell>/g, '</>');

fs.writeFileSync(file, content);
console.log(`Updated ${file}`);
