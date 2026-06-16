const fs = require('fs');

const files = [
    'frontend/src/features/activity/ActivityLogPage.jsx',
    'frontend/src/features/dashboard/DashboardPage.jsx',
    'frontend/src/features/monitoring/MonitoringSpreadsheetPage.jsx',
    'frontend/src/features/pelanggan/CustomerWorkspacePage.jsx',
    'frontend/src/features/pelanggan/IspAdminFormPage.jsx',
    'frontend/src/features/pelanggan/IspDetailPage.jsx',
    'frontend/src/features/pelanggan/TenantAdminFormPage.jsx',
    'frontend/src/features/pelanggan/TenantDetailPage.jsx',
    'frontend/src/features/todos/TodoListPage.jsx',
    'frontend/src/features/trash/TrashPage.jsx'
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');
    
    // Remove import AppShell
    content = content.replace(/import AppShell from "[^"]+";\n/, '');
    
    // Replace <AppShell ...> with <>
    content = content.replace(/<AppShell[^>]*>/g, '<>');
    
    // Replace </AppShell> with </>
    content = content.replace(/<\/AppShell>/g, '</>');
    
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
}
