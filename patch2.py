import re
import os

filepath = r"c:\Users\orgsi\Desktop\areslogistica2_Deploy\index.html"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update modal HTML
old_modal = """        // Setup Book Modal se non esiste
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
        
new_modal = """        // Setup Book Modal se non esiste
        if(!document.getElementById('fascicolo-book-modal')) {
            const modalHTML = `
            <div id="fascicolo-book-modal" class="book-modal-overlay">
                <button class="book-close-btn" onclick="closeFascicoloBook()" style="z-index: 100000;">X CHIUDI</button>
                <div id="book-nav-prev" onclick="fascicoloPageFlip && fascicoloPageFlip.flipPrev()" style="position:absolute; left:40px; top:50%; transform:translateY(-50%); font-size:80px; color:rgba(255,255,255,0.3); cursor:pointer; z-index:10000; transition:0.3s; user-select:none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='rgba(255,255,255,0.3)'">◀</div>
                <div id="fascicolo-book-wrapper" style="display:flex; justify-content:center; align-items:center; width:100%; height:100%; transition: transform 0.5s;">
                    <div class="book-container" id="fascicolo-book-element">
                        <!-- Pagine generate dinamicamente -->
                    </div>
                </div>
                <div id="book-nav-next" onclick="fascicoloPageFlip && fascicoloPageFlip.flipNext()" style="position:absolute; right:40px; top:50%; transform:translateY(-50%); font-size:80px; color:rgba(255,255,255,0.3); cursor:pointer; z-index:10000; transition:0.3s; user-select:none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='rgba(255,255,255,0.3)'">▶</div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }"""
content = content.replace(old_modal, new_modal)

# 2. Update openFascicoloBook
old_open = """    function openFascicoloBook(id) {
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
        book.innerHTML = generateBookPages(fascicolo);"""
        
new_open = """    function openFascicoloBook(id) {
        const fascicolo = aresFascicoli.find(f => f.id === id);
        if(!fascicolo) return;
        
        const modal = document.getElementById('fascicolo-book-modal');
        let wrapper = document.getElementById('fascicolo-book-wrapper');
        
        // Se il modal è stato creato prima della patch, aggiorniamolo
        if (!wrapper && document.getElementById('fascicolo-book-element')) {
            const oldBook = document.getElementById('fascicolo-book-element');
            wrapper = document.createElement('div');
            wrapper.id = 'fascicolo-book-wrapper';
            wrapper.style.cssText = "display:flex; justify-content:center; align-items:center; width:100%; height:100%; transition: transform 0.5s;";
            oldBook.parentNode.insertBefore(wrapper, oldBook);
            wrapper.appendChild(oldBook);
        }
        
        modal.classList.add('active');
        
        if (fascicoloPageFlip) {
            try { fascicoloPageFlip.destroy(); } catch(e) {}
            fascicoloPageFlip = null;
        }
        
        // Ricrea in modo pulito l'elemento interno per evitare problemi con la libreria
        wrapper.innerHTML = '<div class="book-container" id="fascicolo-book-element"></div>';
        const book = document.getElementById('fascicolo-book-element');
        
        wrapper.style.transform = "rotateX(0deg) scale(1)";
        book.innerHTML = generateBookPages(fascicolo);"""
content = content.replace(old_open, new_open)

# 3. Update closeFascicoloBook
old_close = """    function closeFascicoloBook() {
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
    
new_close = """    function closeFascicoloBook() {
        playFlipSound();
        const modal = document.getElementById('fascicolo-book-modal');
        const wrapper = document.getElementById('fascicolo-book-wrapper');
        
        if (wrapper) wrapper.style.transform = "rotateX(5deg) scale(0.8)";
        if (modal) modal.classList.remove('active');
        
        let fBtn = document.getElementById('floating-radar-album-btn');
        if (fBtn) fBtn.remove();
        
        if (fascicoloPageFlip) {
            setTimeout(() => {
                try { fascicoloPageFlip.destroy(); } catch(e) {}
                fascicoloPageFlip = null;
                if (wrapper) wrapper.innerHTML = '<div class="book-container" id="fascicolo-book-element"></div>';
            }, 300);
        }
    }"""
content = content.replace(old_close, new_close)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Patch2 success")
