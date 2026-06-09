import sys
import re

def check_brackets(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Simple heuristic: remove string literals and comments to avoid false positives
    content = re.sub(r'(?<!\\)".*?(?<!\\)"', '""', content)
    content = re.sub(r"(?<!\\)'.*?(?<!\\)'", "''", content)
    content = re.sub(r'//.*', '', content)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    content = re.sub(r'`[^`]*`', '``', content)

    stack = []
    lines = content.split('\n')
    
    for line_num, line in enumerate(lines):
        for col_num, char in enumerate(line):
            if char in '{[(':
                stack.append((char, line_num + 1, col_num + 1))
            elif char in '}])':
                if not stack:
                    print(f"Unmatched {char} at line {line_num + 1}, col {col_num + 1}")
                    return
                top, _, _ = stack.pop()
                if (top == '{' and char != '}') or (top == '[' and char != ']') or (top == '(' and char != ')'):
                    print(f"Mismatched bracket at line {line_num + 1}, col {col_num + 1}. Expected match for {top}, got {char}")
                    return
    
    if stack:
        print(f"Unclosed brackets: {stack}")
    else:
        print("Brackets are perfectly balanced.")

check_brackets('/home/farafahirun/Github Repository/sistem-fo-kima/frontend/src/features/pelanggan/IspDetailPage.jsx')
