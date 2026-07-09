filepath = r"c:\Users\orgsi\Desktop\areslogistica2_Deploy\index.html"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

old_p6 = """        // --- Pagina 6 ---
        let p6 = `
                <div class="my-book-page" style="${pageStyle} box-shadow: inset 10px 0 20px rgba(0,0,0,0.5);">
                <h3 style="color:#10b981; border-bottom:1px solid rgba(16, 185, 129, 0.3); padding-bottom:10px;">\U0001f4c2 Diario e File Locali</h3>
                <div style="margin-top:40px; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center; height:80%;">
                    <div style="font-size:80px; margin-bottom:20px; opacity:0.6;">\U0001f4e1</div>
                    <p style="color:#e2e8f0; font-size:18px; font-weight:600; margin-bottom:10px;">Area File & Radar</p>
                    <p style="color:#94a3b8; font-size:13px; line-height:1.6; max-width:350px;">Usa la barra strumenti in basso per trascinare foto/video nella Drop Zone, scegliere la Cartella Master o consultare l'Album.</p>
                    <div style="margin-top:25px; color:#10b981; font-size:30px; animation: pulse 2s infinite;">\u2193</div>
                </div>
                </div>
        `;"""

new_p6 = """        // --- Pagina 6 ---
        let p6 = `
                <div class="my-book-page" style="${pageStyle} box-shadow: inset 10px 0 20px rgba(0,0,0,0.5);">
                <h3 style="color:#10b981; border-bottom:1px solid rgba(16, 185, 129, 0.3); padding-bottom:10px;">\U0001f4c2 Diario e File Locali</h3>
                <div style="margin-top:10px; text-align:center;">
                    <p style="color:#94a3b8; font-size:12px; line-height:1.4;">Trascina foto e video nella zona radar o scegli la cartella master.</p>
                    
                    <div id="radar-dropzone-${fascicolo.id}" 
                         style="width: 140px; height: 140px; margin: 15px auto 8px auto; border-radius: 50%; border: 2px dashed rgba(16, 185, 129, 0.4); background:rgba(0,0,0,0.2); display:flex; justify-content:center; align-items:center; position:relative; overflow:hidden; transition:all 0.3s;">
                        <div class="radar-scan" style="position:absolute; width:100%; height:100%; border-radius:50%; transition:all 0.3s;"></div>
                        <div style="z-index:2; font-size:32px; pointer-events:none;">\U0001f4e1</div>
                        <div id="radar-text-${fascicolo.id}" style="z-index:2; position:absolute; bottom:22px; font-size:10px; font-weight:bold; color:#10b981; pointer-events:none;">DROP ZONE</div>
                    </div>
                    
                    <div id="radar-master-folder-name-${fascicolo.id}" style="color:#34d399; font-size:10px; margin-bottom:6px; font-family:monospace;"></div>
                    
                    <button onclick="pickMasterFolder(${fascicolo.id})" style="width:100%; padding:12px; background:linear-gradient(135deg, #10b981, #059669); border:none; border-radius:8px; color:#fff; font-weight:bold; font-size:13px; cursor:pointer; margin-top:8px; box-shadow:0 10px 20px rgba(16,185,129,0.2); position:relative; z-index:9999; pointer-events:auto; " onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation();">
                        \u2699\ufe0f Cambia Cartella Master
                    </button>
                    
                    <div id="radar-status-${fascicolo.id}" style="margin-top:10px; font-size:11px; color:#94a3b8; min-height:18px; font-family:monospace;">
                        In attesa di file...
                    </div>
                    
                    <div id="radar-album-btn-container-${fascicolo.id}" style="margin-top:10px; display:flex; justify-content:center; width:100%;">
                        <!-- Il bottone Consulta Album -->
                    </div>
                </div>
                </div>
        `;"""

if old_p6 in content:
    content = content.replace(old_p6, new_p6)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patch6 success - page 6 restored with controls")
else:
    print("Target not found, trying debug...")
    idx = content.find("// --- Pagina 6 ---")
    if idx >= 0:
        end_idx = content.find("return p1 + p2 + p3 + p4 + p5 + p6;", idx)
        print(f"Found pagina 6 at char {idx}, return at {end_idx}")
        print("Content between:")
        print(repr(content[idx:idx+200]))
    else:
        print("Pagina 6 section not found at all")
