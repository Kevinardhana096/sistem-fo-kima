const fs = require('fs');

const files = [
  'frontend/src/components/layout/AppShell.jsx',
  'frontend/src/features/pelanggan/TenantAdminFormPage.jsx',
  'frontend/src/features/pelanggan/IspDetailPage.jsx',
  'frontend/src/features/pelanggan/IspAdminFormPage.jsx',
  'frontend/src/features/todos/TodoListPage.jsx'
];

for(let file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Find cases where backdrop-blur-md got appended before quotes inside a ternary
  // e.g. ${notification.readAt ? backdrop-blur-md"opacity-70" : "bg-gold-accent/5"}
  // We want to move backdrop-blur-md before the ${
  content = content.replace(/(\s*)\$\{([^?]+)\?\s*backdrop-blur-md"([^"]+)"\s*:\s*"([^"]*)"\}/g, (match, space, cond, trueStr, falseStr) => {
      return ` backdrop-blur-md${space}\${${cond}? "${trueStr}" : "${falseStr}"}`;
  });

  // What about if error ? backdrop-blur-md"border-..." : "border-..."
  
  fs.writeFileSync(file, content);
}
console.log('Fixed syntax errors.');
