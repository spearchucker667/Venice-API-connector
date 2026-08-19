import re
with open('first-prompt.txt') as f:
    text = f.read()
match = re.search(r'## P1-003.*?## P1-004', text, re.DOTALL)
if match:
    print(match.group(0))
