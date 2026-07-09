import re
import os

filepath = r"c:\Users\orgsi\Desktop\areslogistica2_Deploy\index.html"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Chunk 1: Script tag
if "page-flip.browser.js" not in content:
    content = content.replace(
        '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>',
        '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>\n    <script src="https://cdn.jsdelivr.net/npm/page-flip/dist/js/page-flip.browser.js"></script>'
    )

# Chunk 2: Modal HTML
old_modal = """        // Setup Book Modal se non esiste
        if(!document.getElementById('fascicolo-book-modal')) {
            const modalHTML = `
            <div id="fascicolo-book-modal" class="book-modal-overlay">
                <button class="book-close-btn" onclick="closeFascicoloBook()">X CHIUDI</button>
                <div class="book-container" id="fascicolo-book-element">
                    <!-- Pagine generate dinamicamente -->
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }"""
new_modal = """        // Setup Book Modal se non esiste
        if(!document.getElementById('fascicolo-book-modal')) {
            const modalHTML = `
            <div id="fascicolo-book-modal" class="book-modal-overlay">
                <button class="book-close-btn" onclick="closeFascicoloBook()" style="z-index: 100000;">X CHIUDI</button>
                <div id="book-nav-prev" onclick="fascicoloPageFlip && fascicoloPageFlip.flipPrev()" style="position:absolute; left:40px; top:50%; transform:translateY(-50%); font-size:80px; color:rgba(255,255,255,0.3); cursor:pointer; z-index:10000; transition:0.3s; user-select:none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='rgba(255,255,255,0.3)'">◀</div>
                <div class="book-container" id="fascicolo-book-element">
                    <!-- Pagine generate dinamicamente -->
                </div>
                <div id="book-nav-next" onclick="fascicoloPageFlip && fascicoloPageFlip.flipNext()" style="position:absolute; right:40px; top:50%; transform:translateY(-50%); font-size:80px; color:rgba(255,255,255,0.3); cursor:pointer; z-index:10000; transition:0.3s; user-select:none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='rgba(255,255,255,0.3)'">▶</div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }"""
content = content.replace(old_modal, new_modal)

# Chunk 3: The JS functions
pattern = re.compile(r"    let currentFascicoloPage = 0;\s*    function openFascicoloBook\(id\) \{.*?    \}\n\n    function closeFascicoloBook\(\) \{.*?    \}", re.DOTALL)

replacement = """    let fascicoloPageFlip = null;

    function openFascicoloBook(id) {
        const fascicolo = aresFascicoli.find(f => f.id === id);
        if(!fascicolo) return;
        
        const modal = document.getElementById('fascicolo-book-modal');
        const book = document.getElementById('fascicolo-book-element');
        modal.classList.add('active');
        
        if (fascicoloPageFlip) {
            fascicoloPageFlip.destroy();
            fascicoloPageFlip = null;
        }
        
        book.style.transform = "rotateX(0deg) scale(1)";
        book.innerHTML = generateBookPages(fascicolo);
        
        setTimeout(() => {
            fascicoloPageFlip = new St.PageFlip(book, {
                width: 500,
                height: 650,
                size: "stretch",
                minWidth: 400,
                maxWidth: 600,
                minHeight: 500,
                maxHeight: 800,
                showCover: false,
                useMouseEvents: true,
                drawShadow: true,
                flippingTime: 800
            });
            fascicoloPageFlip.loadFromHTML(book.querySelectorAll('.my-book-page'));
            
            fascicoloPageFlip.on('flip', (e) => {
                playFlipSound();
                if(e.data === 0) buildInteractiveGraph(fascicolo);
                if(e.data === 5 && typeof loadRadarGallery === 'function') loadRadarGallery(fascicolo.id);
            });
            
            buildInteractiveGraph(fascicolo); // Per la prima pagina all'apertura
            if(typeof loadRadarGallery === 'function') loadRadarGallery(fascicolo.id);
        }, 100);
    }

    function generateBookPages(fascicolo) {
        // Stili inline per le pagine, rimossa class "book-page" per evitare conflitti con vecchi stili absolute
        const pageStyle = "background:#0f172a; padding:30px; overflow-y:auto; overflow-x:hidden; position:relative; font-family:'Outfit', sans-serif;";
        
        // --- Pagina 1 ---
        let p1 = `
                <div class="my-book-page" style="${pageStyle} box-shadow: inset -10px 0 20px rgba(0,0,0,0.5);">
                <h3 style="color:#38bdf8; margin-top:0;">Dossier Tecnico #${fascicolo.id}</h3>
                <h1 style="color:#fff; font-size:28px;">${fascicolo.titolo_commessa || 'Commessa'}</h1>
                
                <div id="kg-render-target" style="width: 100%; height: 250px; background: #0f172a; border-radius: 8px; margin: 15px 0; overflow: hidden; position: relative; border: 1px solid rgba(56, 189, 248, 0.2); box-shadow: inset 0 0 20px rgba(0,0,0,0.5);">
                    <div style="color:#38bdf8; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-family:monospace; font-size:10px; animation: pulse 1.5s infinite;">INITIALIZING INTELLIGENCE PROTOCOL...</div>
                </div>

                <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:8px;">
                    <p style="color:#a5b4fc; font-size:12px; margin:0 0 5px 0;">📍 Location Geocoding</p>
                    <div style="display:flex; gap:10px; position:relative;">
                        <input type="text" id="fascicolo-address-${fascicolo.id}" value="${fascicolo.indirizzo || ''}" placeholder="Cerca indirizzo (es. Via Roma 1, Milano)" style="flex:1; padding:10px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.3); color:#fff; font-size:14px; outline:none;" onkeyup="handleFascicoloAddressSearch(this.value, ${fascicolo.id})">
                        <button onclick="geocodeFascicoloAddress(${fascicolo.id})" style="padding:10px 15px; background:linear-gradient(135deg, #10b981, #059669); border:none; border-radius:6px; color:#fff; font-weight:bold; cursor:pointer;">🔍 Salva</button>
                        
                        <div id="fascicolo-address-results-${fascicolo.id}" style="display:none; position:absolute; top:45px; left:0; width:calc(100% - 95px); background:#1e293b; border:1px solid rgba(255,255,255,0.1); border-radius:6px; box-shadow:0 10px 25px rgba(0,0,0,0.5); z-index:9999; max-height:150px; overflow-y:auto;"></div>
                    </div>
                </div>
                </div>
        `;
        
        // --- Pagina 2 ---
        let p2 = `
                <div class="my-book-page" style="${pageStyle} box-shadow: inset 10px 0 20px rgba(0,0,0,0.5);">
                <h3 style="color:#f59e0b; border-bottom:1px solid rgba(245, 158, 11, 0.3); padding-bottom:10px;">Diario Operativo & Note</h3>
                <textarea id="note-fascicolo-${fascicolo.id}" style="width:100%; height:300px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; padding:15px; font-family:monospace; resize:none;" placeholder="Scrivi qui gli appunti della commessa...">${fascicolo.note_diario || ''}</textarea>
                <div style="display:flex; justify-content:space-between; margin-top:15px;">
                    <button onclick="saveFascicoloNote(${fascicolo.id})" style="padding:10px 20px; background:#3b82f6; border:none; border-radius:8px; color:#fff; font-weight:bold; cursor:pointer;">💾 Salva Diario</button>
                </div>
                </div>
        `;

        // --- Pagina 3 ---
        let planningEventsHTML = "";
        let localEvents = JSON.parse(localStorage.getItem('planning_events') || "[]");
        let fEvents = localEvents.filter(e => e.fascicolo_id === fascicolo.id);
        if(fEvents.length === 0) {
            planningEventsHTML = `<div style="color:#94a3b8; font-size:12px; font-style:italic; padding:10px;">Nessuna scadenza pianificata per questo cantiere.</div>`;
        } else {
            fEvents.forEach(e => {
                planningEventsHTML += `
                    <div style="background:rgba(139, 92, 246, 0.1); border:1px solid rgba(139, 92, 246, 0.2); padding:12px; border-radius:8px;">
                        <span style="font-size:11px; color:#c4b5fd; font-weight:bold;">SCADENZA ATTIVA</span>
                        <div style="color:#fff; font-size:14px; margin-top:4px;">${e.desc}</div>
                        <div style="color:#8b5cf6; font-size:12px; margin-top:4px;">🗓️ ${e.date.replace('T', ' - ')}</div>
                    </div>`;
            });
        }
        
        let p3 = `
                <div class="my-book-page" style="${pageStyle} box-shadow: inset -10px 0 20px rgba(0,0,0,0.5);">
                <h3 style="color:#8b5cf6; border-bottom:1px solid rgba(139, 92, 246, 0.3); padding-bottom:10px;">📅 Planning & Scadenze</h3>
                <div style="margin-top:20px; display:flex; flex-direction:column; gap:12px; height: 260px; overflow-y: auto; scrollbar-width: none;">
                    <div id="fascicolo-planning-list" style="display:flex; flex-direction:column; gap:10px;">
                        ${planningEventsHTML}
                        <div onclick="addFascicoloTask(${fascicolo.id})" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); padding:12px; border-radius:8px; display:flex; align-items:center; justify-content:center; border-style:dashed; cursor:pointer;">
                            <span style="color:#94a3b8; font-size:13px;">+ Aggiungi Task / Scadenza</span>
                        </div>
                    </div>
                </div>
                <div style="margin-top:20px; display:flex; justify-content:space-between;">
                    <button onclick="show('planning'); closeFascicoloBook();" style="padding:10px 20px; background:linear-gradient(135deg, #8b5cf6, #6d28d9); border:none; border-radius:8px; color:#fff; font-weight:bold; cursor:pointer;">Apri Calendario</button>
                </div>
                </div>
        `;
        
        // --- Pagina 4 ---
        let resourcesHTML = "";
        let allocPersone = typeof resources !== 'undefined' && resources.persone ? resources.persone.filter(p => p.fascicolo_id === fascicolo.id) : [];
        let allocMezzi = typeof resources !== 'undefined' && resources.mezzi ? resources.mezzi.filter(m => m.fascicolo_id === fascicolo.id) : [];

        if(allocPersone.length === 0 && allocMezzi.length === 0) {
            resourcesHTML = `<div style="color:#94a3b8; font-size:12px; font-style:italic; padding:10px;">Nessuna risorsa assegnata.</div>`;
        } else {
            allocPersone.forEach(p => {
                resourcesHTML += `
                    <div style="background:rgba(249, 115, 22, 0.1); border:1px solid rgba(249, 115, 22, 0.2); padding:12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="color:#fff; font-size:14px; font-weight:bold;">${p.nome} ${p.cognome}</div>
                            <div style="color:#fdba74; font-size:11px; margin-top:2px;">Personale</div>
                        </div>
                        <span style="background:rgba(16, 185, 129, 0.2); color:#10b981; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold;">Allocato</span>
                    </div>`;
            });
            allocMezzi.forEach(m => {
                resourcesHTML += `
                    <div style="background:rgba(249, 115, 22, 0.1); border:1px solid rgba(249, 115, 22, 0.2); padding:12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="color:#fff; font-size:14px; font-weight:bold;">${m.tipo}</div>
                            <div style="color:#fdba74; font-size:11px; margin-top:2px;">Targa: ${m.targa}</div>
                        </div>
                        <span style="background:rgba(16, 185, 129, 0.2); color:#10b981; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold;">Allocato</span>
                    </div>`;
            });
        }
        
        let p4 = `
                <div class="my-book-page" style="${pageStyle} box-shadow: inset 10px 0 20px rgba(0,0,0,0.5);">
                <h3 style="color:#f97316; border-bottom:1px solid rgba(249, 115, 22, 0.3); padding-bottom:10px;">👷 Squadra & Risorse</h3>
                <div style="margin-top:20px; display:flex; flex-direction:column; gap:12px; height: 260px; overflow-y: auto; scrollbar-width: none;">
                    <div id="fascicolo-risorse-list" style="display:flex; flex-direction:column; gap:10px;">
                        ${resourcesHTML}
                        <div onclick="assignFascicoloResource(${fascicolo.id})" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); padding:12px; border-radius:8px; display:flex; align-items:center; justify-content:center; border-style:dashed; cursor:pointer;">
                            <span style="color:#94a3b8; font-size:13px;">+ Assegna Risorsa</span>
                        </div>
                    </div>
                </div>
                </div>
        `;

        // --- Pagina 5 ---
        let gisHTML = "";
        if(fascicolo.lat && fascicolo.lng) {
            gisHTML = `
                <div style="font-size:30px; margin-bottom:10px;">🛰️</div>
                <div style="color:#fff; font-size:16px; font-weight:bold;">Cantiere Attivo</div>
                <div style="color:#7dd3fc; font-size:12px; font-family:monospace; margin-top:5px;">LAT: ${fascicolo.lat.toFixed(5)} | LNG: ${fascicolo.lng.toFixed(5)}</div>
            `;
        } else {
            gisHTML = `
                <div style="font-size:30px; margin-bottom:10px; opacity:0.5;">🛰️</div>
                <div style="color:#94a3b8; font-size:16px; font-weight:bold;">Posizione Ignota</div>
                <div style="color:#475569; font-size:11px; margin-top:5px;">Nessuna coordinata salvata</div>
            `;
        }
        let p5 = `
                <div class="my-book-page" style="${pageStyle} box-shadow: inset -10px 0 20px rgba(0,0,0,0.5);">
                <h3 style="color:#0ea5e9; border-bottom:1px solid rgba(14, 165, 233, 0.3); padding-bottom:10px;">🗺️ Geolocalizzazione GIS</h3>
                <div style="margin-top:20px;">
                    <div style="background:rgba(14, 165, 233, 0.05); border:1px solid rgba(14, 165, 233, 0.2); padding:15px; border-radius:8px; text-align:center;">
                        ${gisHTML}
                    </div>
                    ${(fascicolo.lat && fascicolo.lng) ? `
                    <button onclick="focusFascicoloOnGIS(${fascicolo.lat}, ${fascicolo.lng})" style="width:100%; padding:15px; background:linear-gradient(135deg, #0ea5e9, #0284c7); border:none; border-radius:8px; color:#fff; font-weight:bold; font-size:14px; cursor:pointer; margin-top:15px; box-shadow:0 10px 20px rgba(14,165,233,0.2);">
                        🎯 Centra in Sala Operativa
                    </button>
                    ` : ''}
                    <button onclick="setFascicoloCoordinates(${fascicolo.id})" style="width:100%; padding:10px; background:transparent; border:1px solid rgba(14,165,233,0.3); border-radius:8px; color:#38bdf8; font-size:12px; cursor:pointer; margin-top:10px;">
                        📍 Imposta Coordinate Manuali
                    </button>
                </div>
                </div>
        `;
        
        // --- Pagina 6 ---
        let p6 = `
                <div class="my-book-page" style="${pageStyle} box-shadow: inset 10px 0 20px rgba(0,0,0,0.5);">
                <h3 style="color:#10b981; border-bottom:1px solid rgba(16, 185, 129, 0.3); padding-bottom:10px;">Diario e File Locali</h3>
                <div style="margin-top:20px; text-align:center;">
                    <p style="color:#94a3b8; font-size:13px; line-height:1.4;">Trascina qui foto e video. Verranno salvati nel locale/NAS.</p>
                    
                    <div id="radar-dropzone-${fascicolo.id}" 
                         ondragover="handleRadarDragOver(event, ${fascicolo.id})" 
                         ondragleave="handleRadarDragLeave(event, ${fascicolo.id})" 
                         ondrop="handleRadarDrop(event, ${fascicolo.id})"
                         style="width: 180px; height: 180px; margin: 30px auto 10px auto; border-radius: 50%; border: 2px dashed rgba(16, 185, 129, 0.4); background:rgba(0,0,0,0.2); display:flex; justify-content:center; align-items:center; position:relative; overflow:hidden; transition:all 0.3s;">
                        <div class="radar-scan" style="position:absolute; width:100%; height:100%; border-radius:50%; transition:all 0.3s;"></div>
                        <div style="z-index:2; font-size:40px; pointer-events:none;">📡</div>
                        <div id="radar-text-${fascicolo.id}" style="z-index:2; position:absolute; bottom:30px; font-size:12px; font-weight:bold; color:#10b981; pointer-events:none;">DROP ZONE</div>
                    </div>
                    
                    <div id="radar-master-folder-name-${fascicolo.id}" style="color:#34d399; font-size:11px; margin-bottom:10px; font-family:monospace;"></div>
                    
                    <button onclick="pickMasterFolder(${fascicolo.id})" style="padding:10px 15px; background:rgba(255,255,255,0.05); border:1px solid rgba(16,185,129,0.3); border-radius:8px; color:#34d399; font-size:12px; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                        ⚙️ Cambia Cartella Master
                    </button>
                    
                    <div id="radar-status-${fascicolo.id}" style="margin-top:15px; font-size:13px; color:#94a3b8; min-height:20px; font-family:monospace;">
                        In attesa di file...
                    </div>
                    
                    <div id="radar-album-btn-container-${fascicolo.id}" style="margin-top:20px; display:flex; justify-content:center; width:100%;">
                        <!-- Il bottone Consulta Album verrà inserito qui da loadRadarGallery -->
                    </div>
                </div>
                </div>
        `;

        return p1 + p2 + p3 + p4 + p5 + p6;
    }

    async function buildInteractiveGraph(fascicolo) {
        const container = document.getElementById('kg-render-target');
        if(!container) return;
        
        const nodes = [];
        const links = [];
        
        // NODO CENTRALE
        nodes.push({ id: 'Nucleo', name: 'Commessa #' + fascicolo.id, group: 0, color: '#38bdf8', icon: '📁' });

        // Cerca Preventivo
        const localPrev = JSON.parse(localStorage.getItem('ares_preventivi') || "[]");
        const prev = localPrev.find(p => p.id === fascicolo.preventivo_id);
        
        if (prev) {
            nodes.push({ id: 'Prev', name: 'Prev. €' + (prev.totale_preventivo || 0), group: 1, color: '#f59e0b', icon: '💶' });
            links.push({ source: 'Nucleo', target: 'Prev' });
            
            if (prev.cliente) {
                nodes.push({ id: 'Cliente', name: prev.cliente, group: 2, color: '#10b981', icon: '🏢' });
                links.push({ source: 'Prev', target: 'Cliente' });
                
                const localCRM = JSON.parse(localStorage.getItem('ares_crm') || "{}");
                if (localCRM[prev.cliente]) {
                    const info = localCRM[prev.cliente];
                    if (info.phone) {
                        nodes.push({ id: 'Telefono', name: info.phone, group: 2, color: '#94a3b8', icon: '📞' });
                        links.push({ source: 'Cliente', target: 'Telefono' });
                    }
                }
                
                const localPlan = JSON.parse(localStorage.getItem('planning_events') || "[]");
                const clientEvents = localPlan.filter(e => e.desc && e.desc.toLowerCase().includes(prev.cliente.toLowerCase()));
                clientEvents.forEach((evt, i) => {
                    if(i > 3) return; // Limita a 4 appuntamenti
                    const evtId = 'Evt'+i;
                    nodes.push({ id: evtId, name: evt.date, group: 3, color: '#8b5cf6', icon: '📅' });
                    links.push({ source: 'Cliente', target: evtId });
                });
            }
            
            if (prev.operatore) {
                nodes.push({ id: 'Operatore', name: prev.operatore, group: 4, color: '#f43f5e', icon: '👤' });
                links.push({ source: 'Prev', target: 'Operatore' });
            }
        }
        
        // Cerca file nel Radar
        try {
            const handle = await AresRadarDB.getHandle('radar_master');
            if (handle) {
                if ((await handle.queryPermission({ mode: 'read' })) === 'granted') {
                    const fascicoloFolder = await handle.getDirectoryHandle(`FAS-${fascicolo.id}`);
                    let mediaCount = 0;
                    for await (const entry of fascicoloFolder.values()) {
                        if (entry.kind === 'file') {
                            mediaCount++;
                            if(mediaCount <= 10) {
                                const fId = 'File_'+mediaCount;
                                nodes.push({ id: fId, name: entry.name, group: 5, color: '#ec4899', icon: '🖼️' });
                                links.push({ source: 'Nucleo', target: fId });
                            }
                        }
                    }
                }
            }
        } catch(e) {}
        
        container.innerHTML = ''; // Rimuovi il loading
        
        const Graph = ForceGraph()(container)
            .width(container.clientWidth)
            .height(container.clientHeight)
            .backgroundColor('#0f172a')
            .nodeRelSize(6)
            .linkDirectionalParticles(2)
            .linkDirectionalParticleSpeed(0.01)
            .linkColor(() => 'rgba(56, 189, 248, 0.3)')
            .linkWidth(1)
            .nodeCanvasObject((node, ctx, globalScale) => {
                const label = node.icon + ' ' + node.name;
                const fontSize = 12/globalScale;
                ctx.font = `${fontSize}px Sans-Serif`;
                const textWidth = ctx.measureText(label).width;
                const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

                ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
                ctx.beginPath();
                ctx.roundRect(node.x - bckgDimensions[0]/2, node.y - bckgDimensions[1]/2, bckgDimensions[0], bckgDimensions[1], 4);
                ctx.fill();

                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = node.color;
                ctx.fillText(label, node.x, node.y);
                
                node.__bckgDimensions = bckgDimensions;
            })
            .nodePointerAreaPaint((node, color, ctx) => {
                ctx.fillStyle = color;
                const bckgDimensions = node.__bckgDimensions;
                bckgDimensions && ctx.fillRect(node.x - bckgDimensions[0]/2, node.y - bckgDimensions[1]/2, bckgDimensions[0], bckgDimensions[1]);
            })
            .graphData({ nodes, links });
            
        setTimeout(() => {
            Graph.zoomToFit(600, 30);
        }, 800);
    }

    function closeFascicoloBook() {
        playFlipSound();
        const modal = document.getElementById('fascicolo-book-modal');
        const book = document.getElementById('fascicolo-book-element');
        book.style.transform = "rotateX(5deg) scale(0.8)";
        modal.classList.remove('active');
        let fBtn = document.getElementById('floating-radar-album-btn');
        if (fBtn) fBtn.remove();
        if (fascicoloPageFlip) {
            setTimeout(() => {
                fascicoloPageFlip.destroy();
                fascicoloPageFlip = null;
                book.innerHTML = '';
            }, 300);
        }
    }"""
content = re.sub(pattern, replacement, content)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Patch success")
