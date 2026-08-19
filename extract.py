import json

with open('/Users/super_user/.gemini/antigravity/brain/2fd48feb-387b-43ee-accb-688962cc1106/.system_generated/logs/transcript_full.jsonl') as f:
    for line in f:
        data = json.loads(line)
        if data.get('type') == 'USER_INPUT':
            print(data.get('content'))
            # There are multiple USER_INPUTs, let's print all of them. 
