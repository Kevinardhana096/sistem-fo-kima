const fs = require('fs');

const file = 'frontend/src/App.jsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const startIndex = lines.findIndex(line => line.includes('if (!hasCheckedAuth || (!isLoggedIn && !PUBLIC_ROUTE_TYPES.has(route.type)) || (isLoggedIn && route.type === "login")) {'));
const endIndex = lines.findIndex(line => line.includes('function requestAppNavigationFallback'));

// The end of App is the `}` just before requestAppNavigationFallback
let appEndIndex = endIndex - 1;
while (appEndIndex > 0 && lines[appEndIndex].trim() !== '}') {
    appEndIndex--;
}

const beforeLines = lines.slice(0, startIndex);
const routingLines = lines.slice(startIndex, appEndIndex);
const afterLines = lines.slice(appEndIndex + 1);

let newRouting = [
    '    const renderRouteContent = () => {'
];

for (const line of routingLines) {
    newRouting.push('    ' + line); // Indent by 4 spaces
}

newRouting.push('    };');
newRouting.push('');
newRouting.push('    const content = renderRouteContent();');
newRouting.push('    const needsAppShell = !["login", "admin-register", "redirect", "monitoring-fullscreen", "customer-jalur-fullscreen"].includes(route.type);');
newRouting.push('');
newRouting.push('    if (needsAppShell) {');
newRouting.push('        return (');
newRouting.push('            <AppShell activeSection={activeSection} currentRole={currentRole} onNavigate={handleNavigate} onNavigatePath={navigateTo} onLogout={handleLogout} hideSidebar={currentRole === "isp"}>');
newRouting.push('                {content}');
newRouting.push('            </AppShell>');
newRouting.push('        );');
newRouting.push('    }');
newRouting.push('');
newRouting.push('    return content;');
newRouting.push('}'); // end of App

const newContent = [...beforeLines, ...newRouting, ...afterLines].join('\n');
fs.writeFileSync(file, newContent);
console.log('App.jsx refactored successfully.');
