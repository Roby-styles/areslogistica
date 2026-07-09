import re

filepath = r"c:\Users\orgsi\Desktop\areslogistica2_Deploy\index.html"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# We need to add event.stopPropagation() to all interactive elements in generateBookPages
# Let's find the function
start_idx = content.find("function generateBookPages(fascicolo) {")
if start_idx != -1:
    end_idx = content.find("return p1 + p2 + p3 + p4 + p5 + p6;", start_idx)
    if end_idx != -1:
        func_body = content[start_idx:end_idx]
        
        # Add stopPropagation to inputs, buttons, textareas, and clickable divs
        # For <input ... >
        func_body = re.sub(r'(<input[^>]+?id="fascicolo-address-[^>]+?)>', 
                           r'\1 onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation();">', func_body)
                           
        # For <button ... >
        func_body = re.sub(r'(<button[^>]+?onclick="[^"]+"[^>]*?)>', 
                           r'\1 onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation();">', func_body)
                           
        # For <textarea ... >
        func_body = re.sub(r'(<textarea[^>]+?)>', 
                           r'\1 onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation();">', func_body)
                           
        # For clickable divs (Aggiungi Task, Assegna Risorsa, etc)
        func_body = re.sub(r'(<div[^>]+?onclick="[^"]+"[^>]*?)>', 
                           r'\1 onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation();">', func_body)
                           
        # For dropzone
        func_body = re.sub(r'(<div[^>]+?id="radar-dropzone-[^"]+"[^>]*?)>', 
                           r'\1 onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation();">', func_body)

        content = content[:start_idx] + func_body + content[end_idx:]

# Also, just in case the arrows are too big and overlapping content, let's move them further out or reduce their hit area.
content = content.replace(
    'style="position:absolute; left:40px; top:50%; transform:translateY(-50%); font-size:80px;',
    'style="position:absolute; left:20px; top:50%; transform:translateY(-50%); font-size:80px; width:60px; text-align:center;'
)
content = content.replace(
    'style="position:absolute; right:40px; top:50%; transform:translateY(-50%); font-size:80px;',
    'style="position:absolute; right:20px; top:50%; transform:translateY(-50%); font-size:80px; width:60px; text-align:center;'
)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Patch3 success")
