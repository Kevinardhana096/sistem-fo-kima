import re

with open('src/components/routes/FoRoutePlanner.jsx', 'r') as f:
    code = f.read()

# Increase height of map container inside FoRoutePlanner since it's a full page now
code = code.replace('className="h-[620px] w-full bg-slate-100"', 'className="h-full min-h-[750px] w-full bg-slate-100"')

with open('src/components/routes/FoRoutePlanner.jsx', 'w') as f:
    f.write(code)
print("Updated height.")
