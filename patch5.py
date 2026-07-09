import re

filepath = r"c:\Users\orgsi\Desktop\areslogistica2_Deploy\index.html"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# We will search for all elements with onpointerdown="event.stopPropagation();" and add z-index
# Find the start of generateBookPages
start_idx = content.find("function generateBookPages(fascicolo) {")
if start_idx != -1:
    end_idx = content.find("return p1 + p2 + p3 + p4 + p5 + p6;", start_idx)
    if end_idx != -1:
        func_body = content[start_idx:end_idx]
        
        # Replace existing style="X" with style="X; position:relative; z-index:9999;" for elements that have stopPropagation
        # A simpler way is to just inject position:relative; z-index:9999; pointer-events:auto; to the styles of these elements
        
        # For <input ... >
        func_body = re.sub(r'(<input[^>]+?style=")([^"]+)("[^>]*?onpointerdown="event.stopPropagation\(\);"[^>]*?>)', 
                           r'\1\2 position:relative; z-index:9999; pointer-events:auto; \3', func_body)
                           
        # For <button ... >
        func_body = re.sub(r'(<button[^>]+?style=")([^"]+)("[^>]*?onpointerdown="event.stopPropagation\(\);"[^>]*?>)', 
                           r'\1\2 position:relative; z-index:9999; pointer-events:auto; \3', func_body)
                           
        # For <textarea ... >
        func_body = re.sub(r'(<textarea[^>]+?style=")([^"]+)("[^>]*?onpointerdown="event.stopPropagation\(\);"[^>]*?>)', 
                           r'\1\2 position:relative; z-index:9999; pointer-events:auto; \3', func_body)
                           
        # For clickable divs (Aggiungi Task, Assegna Risorsa, etc)
        func_body = re.sub(r'(<div[^>]+?style=")([^"]+)("[^>]*?onclick="[^"]+"[^>]*?onpointerdown="event.stopPropagation\(\);"[^>]*?>)', 
                           r'\1\2 position:relative; z-index:9999; pointer-events:auto; \3', func_body)
                           
        # For dropzone
        func_body = re.sub(r'(<div[^>]+?id="radar-dropzone-[^"]+"[^>]*?style=")([^"]+)("[^>]*?onpointerdown="event.stopPropagation\(\);"[^>]*?>)', 
                           r'\1\2 position:relative; z-index:9999; pointer-events:auto; \3', func_body)

        content = content[:start_idx] + func_body + content[end_idx:]

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Patch5 success")
