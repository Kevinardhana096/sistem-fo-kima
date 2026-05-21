import re

with open('src/pages/TenantDetailPage.jsx', 'r') as f:
    code = f.read()

# Make sure sidebar is hidden
code = code.replace('<AppShell activeSection="customers" onNavigate={onNavigate} hideSidebar={hideSidebar}>', '<AppShell activeSection="customers" onNavigate={onNavigate} hideSidebar={true}>', 1)

with open('src/pages/TenantDetailPage.jsx', 'w') as f:
    f.write(code)

