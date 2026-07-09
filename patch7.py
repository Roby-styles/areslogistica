import re

filepath = r"c:\Users\orgsi\Desktop\areslogistica2_Deploy\index.html"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

changes = 0

# =====================================================
# 1. Add global variables after fascicoloPageFlip
# =====================================================
old_globals = "    let fascicoloPageFlip = null;"
new_globals = """    let fascicoloPageFlip = null;
    let currentFascicoloPhotos = [];
    let currentFascicoloData = null;"""

if "currentFascicoloPhotos" not in content:
    content = content.replace(old_globals, new_globals, 1)
    changes += 1
    print("[1] Aggiunte variabili globali foto")

# =====================================================
# 2. Replace openFascicoloBook entirely
# =====================================================
old_open_start = "    function openFascicoloBook(id) {"
old_open_end = "        setupFileToolbar(fascicolo.id);\n        }, 100);\n    }"

idx_start = content.find(old_open_start)
idx_end = content.find(old_open_end)
if idx_start >= 0 and idx_end >= 0:
    idx_end += len(old_open_end)
    
    new_open = """    function openFascicoloBook(id) {
        const fascicolo = aresFascicoli.find(f => f.id === id);
        if(!fascicolo) return;
        
        currentFascicoloData = fascicolo;
        currentFascicoloPhotos = [];
        
        const modal = document.getElementById('fascicolo-book-modal');
        let wrapper = document.getElementById('fascicolo-book-wrapper');
        
        if (!wrapper && document.getElementById('fascicolo-book-element')) {
            const oldBook = document.getElementById('fascicolo-book-element');
            wrapper = document.createElement('div');
            wrapper.id = 'fascicolo-book-wrapper';
            wrapper.style.cssText = "display:flex; justify-content:center; align-items:center; width:100%; height:calc(100% - 110px); transition: transform 0.5s;";
            oldBook.parentNode.insertBefore(wrapper, oldBook);
            wrapper.appendChild(oldBook);
        }
        
        modal.classList.add('active');
        
        if (fascicoloPageFlip) {
            try { fascicoloPageFlip.destroy(); } catch(e) {}
            fascicoloPageFlip = null;
        }
        
        wrapper.innerHTML = '<div class="book-container" id="fascicolo-book-element"></div>';
        const book = document.getElementById('fascicolo-book-element');
        wrapper.style.transform = "rotateX(0deg) scale(1)";
        book.innerHTML = generateBookPages(fascicolo, []);
        
        setTimeout(() => {
            initPageFlip(fascicolo);
            setupFileToolbar(fascicolo.id);
            loadFascicoloPhotos(fascicolo.id);
        }, 100);
    }
    
    function initPageFlip(fascicolo) {
        const book = document.getElementById('fascicolo-book-element');
        if (!book) return;
        
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
            flippingTime: 800,
            clickEventForward: true,
            disableFlipByClick: true
        });
        fascicoloPageFlip.loadFromHTML(book.querySelectorAll('.my-book-page'));
        
        fascicoloPageFlip.on('flip', (e) => {
            playFlipSound();
            if(e.data === 0) buildInteractiveGraph(fascicolo);
            const toolbar = document.getElementById('fascicolo-file-toolbar');
            if(toolbar) {
                const totalPages = fascicoloPageFlip.getPageCount();
                if(e.data >= totalPages - 4) { toolbar.style.opacity='1'; toolbar.style.pointerEvents='all'; }
                else { toolbar.style.opacity='0'; toolbar.style.pointerEvents='none'; }
            }
        });
        
        buildInteractiveGraph(fascicolo);
    }
    
    async function loadFascicoloPhotos(fascicoloId) {
        try {
            const masterHandle = await getVerifyRadarHandle();
            if (!masterHandle) return;
            
            let fascicoloFolder;
            try {
                fascicoloFolder = await masterHandle.getDirectoryHandle('FAS-' + fascicoloId);
            } catch(e) { return; }
            
            const photos = [];
            for await (const entry of fascicoloFolder.values()) {
                if (entry.kind === 'file') {
                    const file = await entry.getFile();
                    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                        const url = URL.createObjectURL(file);
                        photos.push({ name: file.name, url: url, type: file.type, size: file.size });
                    }
                }
            }
            
            if (photos.length > 0) {
                currentFascicoloPhotos = photos;
                rebuildFascicoloBook();
            }
            
            // Aggiorna lo status nella toolbar
            const statusEl = document.querySelector('[id^="radar-status-"]');
            if (statusEl && photos.length > 0) {
                statusEl.innerHTML = "<span style='color:#10b981'>\\u2705 " + photos.length + " foto caricate</span>";
            }
        } catch(e) {
            console.log("Caricamento foto:", e);
        }
    }
    
    function rebuildFascicoloBook() {
        if (!currentFascicoloData) return;
        
        const wrapper = document.getElementById('fascicolo-book-wrapper');
        if (!wrapper) return;
        
        if (fascicoloPageFlip) {
            try { fascicoloPageFlip.destroy(); } catch(e) {}
            fascicoloPageFlip = null;
        }
        
        wrapper.innerHTML = '<div class="book-container" id="fascicolo-book-element"></div>';
        const book = document.getElementById('fascicolo-book-element');
        book.innerHTML = generateBookPages(currentFascicoloData, currentFascicoloPhotos);
        
        setTimeout(() => {
            initPageFlip(currentFascicoloData);
        }, 50);
    }
    
    function showPhotoLightbox(url, name) {
        let lb = document.getElementById('photo-lightbox');
        if (!lb) {
            lb = document.createElement('div');
            lb.id = 'photo-lightbox';
            lb.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.95); z-index:999999; display:flex; align-items:center; justify-content:center; flex-direction:column; cursor:pointer; opacity:0; transition:opacity 0.3s;';
            lb.onclick = () => { lb.style.opacity = '0'; setTimeout(() => { lb.style.display = 'none'; }, 300); };
            document.body.appendChild(lb);
        }
        lb.innerHTML = '<img src="' + url + '" style="max-width:90vw; max-height:85vh; object-fit:contain; border-radius:8px; box-shadow:0 20px 60px rgba(0,0,0,0.8);">' +
            '<div style="color:#fff; font-size:14px; margin-top:15px; opacity:0.7;">' + name + ' \\u2014 Clicca ovunque per chiudere</div>';
        lb.style.display = 'flex';
        setTimeout(() => { lb.style.opacity = '1'; }, 10);
    }"""
    
    content = content[:idx_start] + new_open + content[idx_end:]
    changes += 1
    print("[2] Sostituita openFascicoloBook + aggiunte nuove funzioni")

# =====================================================
# 3. Replace generateBookPages - remove page 6 content, add photos param
# =====================================================
old_gen_sig = "    function generateBookPages(fascicolo) {"
new_gen_sig = "    function generateBookPages(fascicolo, photos) {"
content = content.replace(old_gen_sig, new_gen_sig, 1)
changes += 1
print("[3] Aggiornata firma generateBookPages")

# Replace page 6 and return statement
old_p6_block = content[content.find("        // --- Pagina 6 ---"):content.find("        return p1 + p2 + p3 + p4 + p5 + p6;") + len("        return p1 + p2 + p3 + p4 + p5 + p6;")]

new_p6_block = """        // --- Pagine Galleria Fotografica (dinamiche) ---
        let photoPages = '';
        if (photos && photos.length > 0) {
            const photosPerPage = 4;
            const numPhotoPages = Math.ceil(photos.length / photosPerPage);
            
            for (let pg = 0; pg < numPhotoPages; pg++) {
                const pagePhotos = photos.slice(pg * photosPerPage, (pg + 1) * photosPerPage);
                const pageIdx = 5 + pg;
                const shadowSide = (pageIdx % 2 === 0) ? 'inset -10px 0 20px rgba(0,0,0,0.5)' : 'inset 10px 0 20px rgba(0,0,0,0.5)';
                
                let photoCells = '';
                pagePhotos.forEach((photo, i) => {
                    const rot = ((Math.random() * 6) - 3).toFixed(1);
                    const safeUrl = photo.url;
                    const safeName = photo.name.replace(/'/g, "\\\\'");
                    photoCells += `
                        <button onclick="showPhotoLightbox('${safeUrl}', '${safeName}')" style="background:#fff; padding:6px 6px 20px 6px; border:none; border-radius:3px; cursor:pointer; box-shadow:0 4px 15px rgba(0,0,0,0.4); transform:rotate(${rot}deg); transition:all 0.3s; text-align:center;" onmouseover="this.style.transform='rotate(0deg) scale(1.05)'" onmouseout="this.style.transform='rotate(${rot}deg) scale(1)'">
                            <img src="${safeUrl}" style="width:100%; height:130px; object-fit:cover; border-radius:2px;" onerror="this.style.display='none'">
                            <div style="color:#555; font-size:8px; margin-top:4px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; font-family:'Outfit',sans-serif;">${photo.name}</div>
                        </button>
                    `;
                });
                
                photoPages += `
                    <div class="my-book-page" style="${pageStyle} box-shadow: ${shadowSide};">
                    <h3 style="color:#ec4899; border-bottom:1px solid rgba(236,72,153,0.3); padding-bottom:8px;">📸 Galleria (${pg+1}/${numPhotoPages})</h3>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:8px; padding:5px;">
                        ${photoCells}
                    </div>
                    </div>
                `;
            }
        } else {
            photoPages = `
                <div class="my-book-page" style="${pageStyle} box-shadow: inset 10px 0 20px rgba(0,0,0,0.5);">
                <h3 style="color:#10b981; border-bottom:1px solid rgba(16, 185, 129, 0.3); padding-bottom:10px;">📸 Galleria Fotografica</h3>
                <div style="margin-top:60px; text-align:center;">
                    <div style="font-size:60px; opacity:0.2; margin-bottom:15px;">📷</div>
                    <p style="color:#94a3b8; font-size:15px; font-weight:500;">Nessuna foto presente.</p>
                    <p style="color:#64748b; font-size:12px; margin-top:10px;">Usa la barra strumenti in basso<br>per aggiungere file al fascicolo.</p>
                    <div style="margin-top:30px; color:#10b981; font-size:24px; animation: pulse 2s infinite;">↓</div>
                </div>
                </div>
            `;
        }

        return p1 + p2 + p3 + p4 + p5 + photoPages;"""

content = content.replace(old_p6_block, new_p6_block)
changes += 1
print("[4] Sostituita pagina 6 con galleria polaroid dinamica")

# =====================================================
# 4. Modify loadRadarGallery - remove floating button, trigger rebuild instead
# =====================================================
# Find the section that creates the floating button and replace it
old_gallery_success = """            if(fileCount > 0) {
                if(statusEl) statusEl.innerHTML = `<span style='color:#10b981'>\u2705 Trovati ${fileCount} file in locale</span>`;
                
                const mbSize = (totalSizeBytes / (1024 * 1024)).toFixed(1);
                
                btnContainerEl.innerHTML = `<div style="color:#10b981; font-weight:bold; font-size:14px; text-align:center; margin-top:20px;">\U0001f4f8 Album pronto.<br>Usa il pulsante fluttuante a destra per aprirlo.</div>`;
                
                let oldBtn = document.getElementById('floating-radar-album-btn');
                if (oldBtn) oldBtn.remove();
                
                const floatingBtn = document.createElement('button');
                floatingBtn.id = 'floating-radar-album-btn';
                floatingBtn.onclick = () => openRadarAlbum(fascicoloId, masterHandle.name || '');
                floatingBtn.style.cssText = `
                    position: absolute;
                    top: 50%;
                    right: 30px;
                    transform: translateY(-50%);
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.3);
                    padding: 20px 30px;
                    border-radius: 16px;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    box-shadow: 0 15px 35px rgba(0,0,0,0.6), 0 0 20px rgba(59, 130, 246, 0.4);
                    transition: all 0.2s ease;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    z-index: 100000;
                    pointer-events: auto;
                `;
                floatingBtn.onmouseover = () => { floatingBtn.style.transform = 'translateY(-50%) scale(1.05)'; floatingBtn.style.boxShadow = '0 20px 40px rgba(0,0,0,0.7), 0 0 30px rgba(59, 130, 246, 0.6)'; };
                floatingBtn.onmouseout = () => { floatingBtn.style.transform = 'translateY(-50%) scale(1)'; floatingBtn.style.boxShadow = '0 15px 35px rgba(0,0,0,0.6), 0 0 20px rgba(59, 130, 246, 0.4)'; };
                floatingBtn.innerHTML = `
                    <span style="font-size: 32px; margin-bottom: 10px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">\U0001f4f8</span>
                    <span style="font-size: 20px; margin-bottom: 6px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">Consulta Album</span>
                    <span style="font-size: 12px; font-weight: normal; opacity: 0.9;">FAS-${fascicoloId} | ${fileCount} file (${mbSize} MB)</span>
                `;
                
                const modalOverlay = document.getElementById('fascicolo-book-modal');
                if (modalOverlay) {
                    modalOverlay.appendChild(floatingBtn);
                }

                
            } else {"""

new_gallery_success = """            if(fileCount > 0) {
                if(statusEl) statusEl.innerHTML = `<span style='color:#10b981'>\u2705 ${fileCount} file trovati in locale</span>`;
                if(btnContainerEl) btnContainerEl.innerHTML = '';
            } else {"""

if old_gallery_success in content:
    content = content.replace(old_gallery_success, new_gallery_success)
    changes += 1
    print("[5] Rimosso bottone fluttuante Consulta Album da loadRadarGallery")
else:
    print("[5] WARN: bottone fluttuante non trovato per sostituzione")

# =====================================================
# 5. Remove floating-radar-album-btn from closeFascicoloBook
# =====================================================
old_close_btn = """        let fBtn = document.getElementById('floating-radar-album-btn');
        if (fBtn) fBtn.remove();"""
new_close_btn = ""
content = content.replace(old_close_btn, new_close_btn)
changes += 1
print("[6] Rimosso riferimento floating-radar-album-btn da closeFascicoloBook")

# =====================================================
# 6. Make toolbar visible only on final pages (already handled by flip event)
#    But ensure it starts hidden
# =====================================================
# Already handled - toolbar starts with opacity:0 and shows on e.data >= totalPages - 4

# =====================================================
# SAVE
# =====================================================
with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\n=== COMPLETATO: {changes} modifiche applicate ===")
