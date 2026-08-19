import re
with open('first-prompt.txt') as f:
    text = f.read()

matches = re.finditer(r'## P1-\d{3}.*?(?=## P[01]-\d{3}|$)', text, re.DOTALL)
for m in matches:
    print(m.group(0))
    print("="*40)
