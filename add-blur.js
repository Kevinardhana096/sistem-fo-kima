const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.jsx')) {
            processFile(fullPath);
        }
    }
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // We match className="..." or className={`...`}
    // This simple regex looks for className strings containing bg-something/opacity
    // and adds backdrop-blur-md if missing.
    
    // Regular expression to match classNames that have transparent backgrounds
    const regex = /className=(?:\{`|["'])([^`"']*(?:bg-(?:white|black|red-\d+|emerald-\d+|blue-\d+|gold-accent)\/(?:5|10|20))[^`"']*)(?:`\}|["'])/g;

    content = content.replace(regex, (match, classString) => {
        if (!classString.includes('backdrop-blur')) {
            modified = true;
            // append backdrop-blur-md to the class string
            const newClassString = classString.trim() + ' backdrop-blur-md';
            return match.replace(classString, newClassString);
        }
        return match;
    });

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath}`);
    }
}

processDir(path.join(__dirname, 'frontend/src'));
console.log('Done.');
