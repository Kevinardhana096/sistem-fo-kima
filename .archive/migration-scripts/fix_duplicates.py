import re

with open('src/pages/TenantDetailPage.jsx', 'r') as f:
    content = f.read()

pattern = r'  if \(isPlannerJalurView\) \{.*?</AppShell>\n    \);\n  \}\n'

matches = re.findall(pattern, content, flags=re.DOTALL)

if matches:
    replacement = matches[0].replace('hideSidebar={hideSidebar}', 'hideSidebar={true}')
    content = re.sub(pattern, "", content, flags=re.DOTALL)
    content = content.replace("  const tabs = [", replacement + "\n  const tabs = [", 1)

    with open('src/pages/TenantDetailPage.jsx', 'w') as f:
        f.write(content)
    print("Fixed duplicates")
else:
    print("No matches")

