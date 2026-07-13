let spazioClienteInizializzato = false;
function initSpazioCliente() {
    if(spazioClienteInizializzato) return;
    spazioClienteInizializzato = true;

// Simulatore IoT - Ares Smart Green
    
    // Stato Globale
    const state = {
        role: 'admin', // 'admin' o 'client'
        env: {
            temp: 24.5,
            humidity: 60,
            soilMoisture: 45,
            rain: false
        },
        controls: {
            pumpActive: false,
            autoIrrigation: true,
            lightsActive: false,
            soilThreshold: 30
        },
        client: {
            waterSaved: 1240 // litri
        }
    };
    
    // Elementi DOM
    const elRoleToggle = document.getElementById('role-toggle');
    const elRoleAdmin = document.getElementById('role-label-admin');
    const elRoleClient = document.getElementById('role-label-client');
    
    const elValTemp = document.getElementById('val-temp');
    const elValRain = document.getElementById('val-rain');
    const elValWind = document.getElementById('val-wind');
    const elValAqi = document.getElementById('val-aqi');
    const elValHumidity = document.getElementById('val-humidity');
    const elValIce = document.getElementById('val-ice');
    const elValClouds = document.getElementById('val-clouds');
    const elAlertBanner = document.getElementById('alert-banner');
    const elAlertText = document.getElementById('alert-text');
    const elValSavings = document.getElementById('val-savings');
    
    const btnPump = document.getElementById('btn-pump');
    const btnLights = document.getElementById('btn-lights');
    const btnClientLights = document.getElementById('btn-client-lights');
    const checkAuto = document.getElementById('auto-irrigation');
    const sliderThreshold = document.getElementById('soil-threshold');
    const valThreshold = document.getElementById('threshold-val');
    const sprinklersLayer = document.getElementById('sprinklers-layer');
    const pinValve = document.getElementById('pin-valve');
    const logContent = document.getElementById('log-content');
    
    // Nuovi elementi Illuminazione & BMS
    const cardLights = document.getElementById('card-lights');
    const valLightsStatus = document.getElementById('val-lights-status');
    const bmsModal = document.getElementById('bms-modal');
    const btnCloseBms = document.getElementById('btn-close-bms');
    const bmsVolt = document.getElementById('bms-volt');
    const bmsAmp = document.getElementById('bms-amp');
    const barAmp = document.getElementById('bar-amp');
    const bmsWatt = document.getElementById('bms-watt');
    const barWatt = document.getElementById('bar-watt');
    const bmsBreaker = document.getElementById('bms-breaker');
    const wires = [
        document.getElementById('wire-main'),
        document.getElementById('wire-sub'),
        document.getElementById('wire-l1'),
        document.getElementById('wire-l2')
    ];
    let bmsInterval = null;
    
    // Gestione Ruoli (Admin vs Client)
    if(elRoleToggle) {
        elRoleToggle.addEventListener('change', (e) => {
            state.role = e.target.checked ? 'admin' : 'client';
            
            if (state.role === 'client') {
                document.body.classList.add('client-mode');
                if(elRoleClient) elRoleClient.classList.add('active');
                if(elRoleAdmin) elRoleAdmin.classList.remove('active');
                logMsg("Passaggio a vista Cliente effettuato.", "info");
            } else {
                document.body.classList.remove('client-mode');
                if(elRoleAdmin) elRoleAdmin.classList.add('active');
                if(elRoleClient) elRoleClient.classList.remove('active');
                logMsg("Passaggio a vista Admin effettuato.", "info");
            }
        });
    }
    
    // Utilities
    function logMsg(msg, type = "info") {
        const time = new Date().toLocaleTimeString();
        const div = document.createElement('div');
        div.className = `log-entry ${type}`;
        div.innerText = `[${time}] ${msg}`;
        logContent.appendChild(div);
        logContent.scrollTop = logContent.scrollHeight;
    }
    
    // Funzione per il meteo reale di Penna in Teverina (TR)
    async function fetchRealWeather() {
        // Main Weather
        try {
            const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=42.4939&longitude=12.3361&current=temperature_2m,relative_humidity_2m,wind_speed_10m,cloud_cover,weather_code&daily=precipitation_probability_max&timezone=Europe%2FRome');
            const data = await res.json();
            if (data && data.current) {
                state.env.temp = data.current.temperature_2m;
                state.env.wind = data.current.wind_speed_10m;
                state.env.humidity = data.current.relative_humidity_2m;
                state.env.clouds = data.current.cloud_cover;
                state.env.weatherCode = data.current.weather_code;
                
                if(data.daily && data.daily.precipitation_probability_max && data.daily.precipitation_probability_max.length > 0) {
                    state.env.rainProb = data.daily.precipitation_probability_max[0];
                } else {
                    state.env.rainProb = 0;
                }
            }
        } catch (e) {
            console.error("Errore meteo reale (Main API):", e);
        }

        // Air Quality
        try {
            const aqiRes = await fetch('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=42.4939&longitude=12.3361&current=european_aqi');
            const aqiData = await aqiRes.json();
            if (aqiData && aqiData.current) {
                state.env.aqi = aqiData.current.european_aqi;
            }
        } catch (e) {
            console.error("Errore meteo reale (AQI API):", e);
        }
        
        updateUI();
    }
    
    // Aggiornamento meteo reale (una volta all'avvio e poi ogni 15 minuti)
    fetchRealWeather();
    setInterval(fetchRealWeather, 15 * 60 * 1000);

    // Simulazione Temporale (Loop di aggiornamento sensori interni)
    setInterval(() => {
        // La temperatura e il meteo ora sono reali e gestiti da Open-Meteo
    
        // Aggiornamento UI
        updateUI();
    
    }, 1500); // Ogni 1.5s per accelerare la simulazione
    
    // Azioni
    function togglePump(forceState = null) {
        state.controls.pumpActive = forceState !== null ? forceState : !state.controls.pumpActive;
        
        if (state.controls.pumpActive) {
            btnPump.innerText = "Ferma Elettrovalvola";
            btnPump.classList.add('active');
            sprinklersLayer.classList.add('active'); // Attiva gli innaffiatori
            pinValve.classList.add('pulse-fast');
            logMsg("Elettrovalvola APERTA. Avvio innaffiatori a pioggia.", "info");
        } else {
            btnPump.innerText = "Avvia Elettrovalvola (Manuale)";
            btnPump.classList.remove('active');
            sprinklersLayer.classList.remove('active'); // Ferma gli innaffiatori
            pinValve.classList.remove('pulse-fast');
            logMsg("Elettrovalvola CHIUSA. Innaffiatori fermati.", "info");
        }
    }
    
    function toggleLights() {
        state.controls.lightsActive = !state.controls.lightsActive;
        if(state.controls.lightsActive) {
            btnLights.innerText = "Spegni Luci";
            btnLights.classList.add('active');
            btnClientLights.innerText = "Spegni Luci Notturne";
            btnClientLights.classList.add('active');
            document.querySelector('.terrain-base').style.boxShadow = "0 0 50px rgba(255, 255, 100, 0.2)";
            
            if (cardLights) cardLights.classList.add('glow-active');
            if (valLightsStatus) valLightsStatus.innerText = "Accesa";
            if (valLightsStatus) valLightsStatus.style.color = "#fde047";
            if (valLightsStatus) valLightsStatus.style.textShadow = "0 0 10px #fde047";
            
            logMsg("Illuminazione ACCESA.", "info");
        } else {
            btnLights.innerText = "Accendi Luci";
            btnLights.classList.remove('active');
            btnClientLights.innerText = "Test Luci Notturne";
            btnClientLights.classList.remove('active');
            document.querySelector('.terrain-base').style.boxShadow = "20px 20px 50px rgba(0,0,0,0.5)";
            
            if (cardLights) cardLights.classList.remove('glow-active');
            if (valLightsStatus) valLightsStatus.innerText = "Spenta";
            if (valLightsStatus) valLightsStatus.style.color = "#fff";
            if (valLightsStatus) valLightsStatus.style.textShadow = "none";
            
            logMsg("Illuminazione SPENTA.", "info");
        }
    }
    
    // Event Listeners
    if (btnPump) {
        btnPump.addEventListener('click', () => {
            if(state.controls.autoIrrigation) {
                logMsg("Attenzione: Sistema in Auto. Forza manuale inserita.", "warn");
            }
            togglePump();
        });
    }
    
    if (btnLights) btnLights.addEventListener('click', toggleLights);
    if (btnClientLights) btnClientLights.addEventListener('click', toggleLights);
    
    if (checkAuto) {
        checkAuto.addEventListener('change', (e) => {
            state.controls.autoIrrigation = e.target.checked;
            logMsg(`Modalità Auto: ${state.controls.autoIrrigation ? 'ON' : 'OFF'}`, "warn");
        });
    }
    
    if (sliderThreshold) {
        sliderThreshold.addEventListener('input', (e) => {
            state.controls.soilThreshold = e.target.value;
            if (valThreshold) valThreshold.innerText = `${state.controls.soilThreshold}%`;
        });
        
        sliderThreshold.addEventListener('change', (e) => {
            logMsg(`Nuova soglia umidità impostata a: ${e.target.value}%`, "info");
        });
    }
    
    if (cardLights) {
        cardLights.addEventListener('click', () => {
            bmsModal.style.display = 'flex';
            setTimeout(() => {
                bmsModal.classList.add('visible');
            }, 10);
        });
    }
    
    // Update UI Function
    function updateUI() {
        if(elValTemp) elValTemp.innerText = state.env.temp !== undefined ? state.env.temp.toFixed(1) : '--';
        if(elValRain) elValRain.innerText = state.env.rainProb !== undefined ? state.env.rainProb : 0;
        if(elValWind) elValWind.innerText = state.env.wind !== undefined ? state.env.wind : 0;
        if(elValAqi) elValAqi.innerText = state.env.aqi !== undefined ? state.env.aqi : '--';
        if(elValHumidity) elValHumidity.innerText = state.env.humidity !== undefined ? state.env.humidity : '--';
        if(elValClouds) elValClouds.innerText = state.env.clouds !== undefined ? state.env.clouds : '--';
        
        // Calcolo Rischio Gelo (Ice/Snow)
        let iceRisk = "Basso";
        if (state.env.temp !== undefined) {
            if (state.env.temp <= 3 && state.env.rainProb > 20) iceRisk = "Alto ❄️";
            else if (state.env.temp <= 0) iceRisk = "Alto ❄️";
            else if (state.env.temp <= 4) iceRisk = "Medio";
        }
        if(elValIce) elValIce.innerText = iceRisk;

        // Gestione Alert Banner
        let alertMessage = null;
        if (state.env.wind > 40) alertMessage = `Vento Forte (${state.env.wind} km/h) - Assicurare carichi e attrezzature!`;
        if (iceRisk === "Alto ❄️") alertMessage = `Allerta Gelo/Neve - Rischio scivolamento per mezzi pesanti!`;
        if (state.env.weatherCode >= 95) alertMessage = `Allerta Temporale in corso (Fulmini)!`; // WMO 95-99: Thunderstorms

        if (elAlertBanner && elAlertText) {
            if (alertMessage) {
                elAlertText.innerText = alertMessage;
                elAlertBanner.style.display = 'flex';
            } else {
                elAlertBanner.style.display = 'none';
            }
        }
    
    }
    
    // Init
    logMsg("Ares Smart Green IoT Engine v1.0", "info");
    updateUI();
    
    // ----------------------------------------------------
    // Interactive Map Rotation (Drag to rotate)
    // ----------------------------------------------------
    const mapRotator = document.getElementById('map-rotator');
    const pins = document.querySelectorAll('.iso-pin');
    let isDragging = false;
    let startX = 0;
    let currentAngle = -45; // Angolo iniziale Z
    let currentScale = 1;   // Zoom iniziale
    
    mapRotator.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        mapRotator.style.transition = 'none'; // Rimuove il delay per un drag fluido
        pins.forEach(pin => pin.style.transition = 'none');
    });
    
    // Aggiunta Zoom con la Rotellina
    const isoContainer = document.getElementById('iso-container');
    isoContainer.addEventListener('wheel', (e) => {
        e.preventDefault(); // Evita che la pagina scorra
        if (e.deltaY < 0) {
            currentScale += 0.1; // Zoom In
        } else {
            currentScale -= 0.1; // Zoom Out
        }
        
        // Limiti di zoom
        if (currentScale < 0.4) currentScale = 0.4;
        if (currentScale > 3.0) currentScale = 3.0;
        
        mapRotator.style.transition = 'transform 0.1s ease-out';
        mapRotator.style.transform = `scale(${currentScale}) rotateX(60deg) rotateZ(${currentAngle}deg)`;
    }, { passive: false });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        startX = e.clientX;
        
        currentAngle += deltaX * 0.4; // Sensibilità
        
        // Ruota e mantiene lo zoom attuale
        mapRotator.style.transform = `scale(${currentScale}) rotateX(60deg) rotateZ(${currentAngle}deg)`;
        
        // Contro-ruota magicamente i pin per farli rimanere verticali e guardare la telecamera
        pins.forEach(pin => {
            pin.style.transform = `translate(-50%, -100%) rotateZ(${-currentAngle}deg) rotateX(-60deg)`;
        });
    });
    
    document.addEventListener('mouseup', () => {
        if(isDragging) {
            isDragging = false;
            mapRotator.style.transition = 'transform 0.1s linear';
            pins.forEach(pin => pin.style.transition = 'transform 0.1s linear');
        }
    });
    // ----------------------------------------------------
    // Modal & Edit Mode Logic
    // ----------------------------------------------------
    const btnEditMode = document.getElementById('btn-edit-mode');
    const modal = document.getElementById('device-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const terrainBase = document.querySelector('.terrain-base');
    
    let editMode = false;
    let selectedPin = null;
    
    // Toggle Edit Mode
    btnEditMode.addEventListener('click', () => {
        editMode = !editMode;
        if (editMode) {
            document.body.classList.add('edit-mode');
            btnEditMode.innerText = "💾 Salva Posizioni";
            btnEditMode.classList.add('active');
            logMsg("Modalità Modifica Posizioni: ATTIVA. Seleziona un Pin e clicca sulla mappa.", "warn");
            
            // Ferma l'animazione di fluttuazione per facilitare il posizionamento
            isoContainer.style.animation = 'none';
            
        } else {
            document.body.classList.remove('edit-mode');
            btnEditMode.innerText = "Attiva Modifica Posizioni";
            btnEditMode.classList.remove('active');
            if (selectedPin) selectedPin.classList.remove('selected');
            selectedPin = null;
            logMsg("Modalità Modifica Posizioni: CHIUSA. Posizioni salvate.", "success");
            
            // Riattiva l'animazione
            isoContainer.style.animation = 'floatAndTilt 8s ease-in-out infinite';
        }
    });
    
    // Pin Click (Seleziona per muovere o Apri Modale)
    pins.forEach(pin => {
        pin.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita di far scattare il click sulla mappa
            if (editMode) {
                if (selectedPin) selectedPin.classList.remove('selected');
                selectedPin = pin;
                selectedPin.classList.add('selected');
                logMsg(`Selezionato: ${pin.dataset.title}. Ora clicca sulla mappa per posizionarlo.`, "info");
            } else {
                openDeviceModal(pin);
            }
        });
    });
    
    // Click on Map to Move Selected Pin
    terrainBase.addEventListener('click', (e) => {
        if (editMode && selectedPin) {
            // Grazie all'astuzia di usare offsetX/Y sull'elemento nativo distanziato in CSS, non serve trigonometria!
            const xPercent = (e.offsetX / terrainBase.offsetWidth) * 100;
            const yPercent = 100 - ((e.offsetY / terrainBase.offsetHeight) * 100); // CSS bottom = 100 - top
            
            selectedPin.style.left = `${xPercent.toFixed(1)}%`;
            selectedPin.style.bottom = `${yPercent.toFixed(1)}%`;
            logMsg(`Pin spostato a X:${xPercent.toFixed(1)}%, Y:${yPercent.toFixed(1)}%`, "info");
        }
    });
    
    // Open Modal Logic
    window.openDeviceModal = function(pin) {
        const type = pin.dataset.type;
        const title = pin.dataset.title;
        
        modalTitle.innerText = title;
        
        let html = "";
        if (type === 'sensor') {
            html = `
                <div style="text-align:center;">
                    <div style="font-size:40px; margin-bottom:10px;">💧</div>
                    <h4 style="color:#38bdf8;">Umidità Corrente</h4>
                    <div style="font-size:30px; font-weight:bold; margin-bottom:20px;">${Math.round(state.env.soilMoisture)}%</div>
                    <p style="color:#94a3b8; font-size:12px;">Stato: Ottimale<br>Ultimo aggiornamento: Adesso</p>
                </div>
            `;
        } else if (type === 'valve') {
            html = `
                <div style="text-align:center;">
                    <div style="font-size:40px; margin-bottom:10px;">🚰</div>
                    <h4 style="color:#10b981;">Stato Valvola</h4>
                    <div style="font-size:20px; font-weight:bold; margin-bottom:20px; color:${state.controls.pumpActive ? '#10b981' : '#f59e0b'}">${state.controls.pumpActive ? 'APERTA' : 'CHIUSA'}</div>
                    <button class="btn btn-action" onclick="togglePump(); document.getElementById('btn-close-modal').click();" style="width:100%;">${state.controls.pumpActive ? 'Chiudi' : 'Apri'} Valvola</button>
                </div>
            `;
        } else if (type === 'camera') {
            html = `
                <div>
                    <div style="width:100%; height:180px; background:#000; border-radius:10px; display:flex; align-items:center; justify-content:center; border: 1px solid #334155; position:relative; overflow:hidden;">
                        <video style="background: #333;" autoplay loop muted style="width:100%; height:100%; object-fit:cover; position:absolute; top:0; left:0;"></video>
                        <div style="position:absolute; top:10px; left:10px; color:red; font-weight:bold; animation: fast-pulse 2s infinite; z-index:2; text-shadow: 0 0 5px black;">● REC</div>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-top:15px;">
                        <button class="btn" style="background:#334155; width:48%; color:#fff;">Pan/Tilt</button>
                        <button class="btn" style="background:#334155; width:48%; color:#fff;">Zoom</button>
                    </div>
                </div>
            `;
        }
        
        modalContent.innerHTML = html;
        modal.classList.add('active');
    }
    
    // Close Modal Logic
    btnCloseModal.addEventListener('click', () => {
        modal.classList.remove('active');
    });
    
    modal.addEventListener('click', (e) => {
        if(e.target === modal) modal.classList.remove('active');
    });
    
    // ----------------------------------------------------
    // BMS Modal Logic
    // ----------------------------------------------------
    if (cardLights) {
        cardLights.addEventListener('click', () => {
        bmsModal.classList.add('active');
        
        // Inizializza stato UI basato sulle luci
        if (state.controls.lightsActive) {
            bmsBreaker.innerText = "ON";
            bmsBreaker.style.color = "var(--success)";
            wires.forEach(w => w.classList.add('active'));
        } else {
            bmsBreaker.innerText = "OFF";
            bmsBreaker.style.color = "var(--danger)";
            wires.forEach(w => w.classList.remove('active'));
        }
        
        // Avvia simulatore Dati Real-Time
        bmsInterval = setInterval(() => {
            const volt = (230 + (Math.random() * 2 - 1)).toFixed(1);
            bmsVolt.innerText = `${volt} V`;
            
            if (state.controls.lightsActive) {
                const amp = (12.5 + (Math.random() * 0.8)).toFixed(2);
                const watt = ((volt * amp) / 1000).toFixed(2);
                
                bmsAmp.innerText = amp;
                barAmp.style.width = `${(amp / 20) * 100}%`;
                
                bmsWatt.innerText = watt;
                barWatt.style.width = `${(watt / 5) * 100}%`;
            } else {
                bmsAmp.innerText = "0.00";
                barAmp.style.width = "0%";
                bmsWatt.innerText = "0.00";
                barWatt.style.width = "0%";
            }
        }, 500);
    });
    }
    
    if (btnCloseBms) {
        btnCloseBms.addEventListener('click', () => {
            bmsModal.classList.remove('active');
            clearInterval(bmsInterval);
        });
    }
    
    if (bmsModal) {
        bmsModal.addEventListener('click', (e) => {
            if(e.target === bmsModal) {
                bmsModal.classList.remove('active');
                clearInterval(bmsInterval);
            }
        });
    }
    
}

// Funzioni globali per la pulsantiera Azioni Rapide
// ─────────────────────────────────────────────────────────────
// SISTEMA DOCUMENTI — Supabase Storage  (bucket: ares-documenti)
// ─────────────────────────────────────────────────────────────

window.openDocModal = function(title) {
    const modal   = document.getElementById('spaziocliente-doc-modal');
    const titleEl = document.getElementById('spaziocliente-doc-title');
    const bodyEl  = document.getElementById('spaziocliente-doc-body');
    if (!modal || !titleEl || !bodyEl) return;

    titleEl.innerText = title;
    modal.style.display = 'flex';
    setTimeout(() => { modal.classList.add('visible'); }, 10);

    if (title === 'Galleria (Foto/Filmati)') {
        bodyEl.innerHTML = `
            <div style="padding: 10px; color: #94a3b8; height: 100%; display: flex; flex-direction: column;">
                <p style="margin-bottom: 20px; color: white; text-align: center;">Seleziona un elemento per visualizzarlo.</p>
                <div class="media-gallery-grid">
                    <div class="media-card" onclick="playMedia('https://ypjmouwytrubedowkjci.supabase.co/storage/v1/object/public/galleria-lavori/video1.mp4', 'Sopralluogo')">
                        <div class="media-thumb"><span class="play-overlay">▶</span></div>
                        <div class="media-info"><h4>Sopralluogo</h4><p>Caricato: Oggi, 18:30</p></div>
                    </div>
                </div>
            </div>`;
    } else if (title === 'Documenti Ordinari / Straordinari') {
        renderDocumentiPanel(bodyEl, 'Documenti');
    } else if (title === 'Fatture & Pagamenti') {
        renderDocumentiPanel(bodyEl, 'Fatture');
    } else if (title === 'Rapportini Intervento') {
        renderDocumentiPanel(bodyEl, 'Rapportini');
    } else {
        renderDocumentiPanel(bodyEl, title);
    }
};

// ── Helper: icona per estensione ──────────────────────────────
function _docIcon(name) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf')                       return '#f43f5e';
    if (['doc','docx'].includes(ext))        return '#3b82f6';
    if (['xls','xlsx'].includes(ext))        return '#22c55e';
    if (['jpg','jpeg','png','webp'].includes(ext)) return '#a855f7';
    return '#64748b';
}
function _docEmoji(name) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf')                       return '📄';
    if (['doc','docx'].includes(ext))        return '📝';
    if (['xls','xlsx'].includes(ext))        return '📊';
    if (['jpg','jpeg','png','webp'].includes(ext)) return '🖼️';
    return '📎';
}
function _fmtSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
    return (bytes/1024/1024).toFixed(2) + ' MB';
}

// ── Render pannello documenti ─────────────────────────────────
async function renderDocumentiPanel(bodyEl, categoria) {
    const sb = window.supabaseClient;
    const user = typeof getLoggedUser === 'function' ? getLoggedUser() : null;
    const isAdmin = !!sessionStorage.getItem('ares_admin_origin');

    // --- Stato di caricamento ---
    bodyEl.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:160px;gap:14px;color:#94a3b8;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite;">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <span style="font-size:14px;">Recupero documenti...</span>
        </div>
        <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;

    if (!user || !sb) {
        bodyEl.innerHTML = `<div style="padding:30px;text-align:center;color:#f43f5e;font-size:13px;">⚠️ Connessione non disponibile. Riprova tra qualche secondo.</div>`;
        return;
    }

    const folderPath = `${user.username}/${categoria}`;

    const { data: rawFiles, error } = await sb.storage
        .from('ares-documenti')
        .list(folderPath, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

    if (error) {
        bodyEl.innerHTML = `<div style="padding:30px;text-align:center;color:#f43f5e;font-size:13px;">⚠️ Errore: ${error.message}</div>`;
        return;
    }

    // filtra solo i file reali (non le cartelle placeholder)
    const files = (rawFiles || []).filter(f => f.id && f.metadata);

    // ── Pulsante upload (solo admin) ──
    const uploadBtnHtml = isAdmin ? `
        <div style="margin-bottom:18px;">
            <label for="sc-doc-file-input" style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#fff;border-radius:10px;cursor:pointer;font-size:13px;font-weight:700;transition:opacity 0.2s;" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Carica documento
            </label>
            <input type="file" id="sc-doc-file-input" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                style="display:none"
                onchange="uploadDocumento(this, '${categoria}', '${user.username}')">
            <span id="sc-upload-status" style="margin-left:12px;font-size:12px;color:#94a3b8;"></span>
        </div>` : '';

    // ── Lista file ──
    let listHtml;
    if (files.length === 0) {
        listHtml = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:50px 20px;color:#4a5568;gap:12px;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <div style="font-size:14px;color:#64748b;font-weight:600;">Nessun documento presente</div>
                ${isAdmin ? '<div style="font-size:12px;color:#475569;">Carica il primo documento con il pulsante sopra</div>' : '<div style="font-size:12px;color:#475569;">I Suoi documenti appariranno qui non appena caricati</div>'}
            </div>`;
    } else {
        listHtml = `<div style="display:flex;flex-direction:column;gap:10px;">` +
            files.map(f => {
                const path = `${folderPath}/${f.name}`;
                const pubUrl = sb.storage.from('ares-documenti').getPublicUrl(path).data.publicUrl;
                const size  = _fmtSize(f.metadata?.size);
                const dateStr = f.created_at
                    ? new Date(f.created_at).toLocaleDateString('it-IT', {day:'2-digit',month:'long',year:'numeric'})
                    : '';
                const color = _docIcon(f.name);
                const emoji = _docEmoji(f.name);
                const deleteBtnHtml = isAdmin ? `
                    <button onclick="deleteDocumento('${path.replace(/'/g,"\\'")}', '${categoria}', '${user.username}')"
                        style="padding:7px 14px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:#f87171;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.2s;white-space:nowrap;"
                        onmouseover="this.style.background='rgba(239,68,68,0.25)'" onmouseout="this.style.background='rgba(239,68,68,0.1)'">
                        Elimina
                    </button>` : '';
                return `
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:12px;transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.07)'" onmouseout="this.style.background='rgba(255,255,255,0.04)'">
                        <div style="display:flex;align-items:center;gap:14px;min-width:0;">
                            <div style="width:40px;height:40px;border-radius:10px;background:${color}20;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px;">${emoji}</div>
                            <div style="min-width:0;">
                                <div style="font-size:13px;font-weight:600;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px;" title="${f.name}">${f.name}</div>
                                <div style="font-size:11px;color:#64748b;margin-top:2px;">${dateStr}${size ? ' · ' + size : ''}</div>
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                            <a href="${pubUrl}" target="_blank" download="${f.name}"
                                style="padding:7px 16px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:#818cf8;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;text-decoration:none;transition:all 0.2s;white-space:nowrap;"
                                onmouseover="this.style.background='rgba(99,102,241,0.3)'" onmouseout="this.style.background='rgba(99,102,241,0.15)'">
                                Scarica
                            </a>
                            ${deleteBtnHtml}
                        </div>
                    </div>`;
            }).join('') + `</div>`;
    }

    bodyEl.innerHTML = `
        <div style="padding:4px 2px;">
            ${uploadBtnHtml}
            ${listHtml}
        </div>`;
}

// ── Upload documento ──────────────────────────────────────────
window.uploadDocumento = async function(inputEl, categoria, username) {
    const file = inputEl.files[0];
    if (!file) return;

    const sb = window.supabaseClient;
    const statusEl = document.getElementById('sc-upload-status');
    if (statusEl) statusEl.textContent = 'Caricamento in corso...';

    // Sanitizza il nome: rimuovi caratteri problematici
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_àèéìòùÀÈÉÌÒÙ ]/g, '_');
    const path = `${username}/${categoria}/${Date.now()}_${safeName}`;

    const { error } = await sb.storage.from('ares-documenti').upload(path, file, {
        cacheControl: '3600',
        upsert: false
    });

    // Reset input per permettere di caricare lo stesso file di nuovo
    inputEl.value = '';

    if (error) {
        if (statusEl) statusEl.textContent = '⚠️ Errore: ' + error.message;
        console.error('Upload error:', error);
        return;
    }

    if (statusEl) statusEl.textContent = '✓ Caricato!';
    setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);

    // Aggiorna la lista
    const bodyEl = document.getElementById('spaziocliente-doc-body');
    if (bodyEl) renderDocumentiPanel(bodyEl, categoria);
};

// ── Elimina documento ─────────────────────────────────────────
window.deleteDocumento = async function(path, categoria, username) {
    if (!confirm('Eliminare definitivamente questo documento?')) return;

    const sb = window.supabaseClient;
    const { error } = await sb.storage.from('ares-documenti').remove([path]);

    if (error) {
        alert('Errore eliminazione: ' + error.message);
        return;
    }

    const bodyEl = document.getElementById('spaziocliente-doc-body');
    if (bodyEl) renderDocumentiPanel(bodyEl, categoria);
};


window.playMedia = function(url, title, type = 'video') {
    const bodyEl = document.getElementById('spaziocliente-doc-body');
    if(!bodyEl) return;
    
    // Salva lo stato precedente per il pulsante indietro (un po' finto ma funzionale per la demo)
    const backBtnHtml = `<button class="back-to-gallery-btn" onclick="openDocModal('Galleria (Foto/Filmati)')">← Torna alla Galleria</button>`;
    
    let mediaContent = '';
    if (type === 'video') {
        mediaContent = `
            <div style="flex: 1; border-radius: 12px; overflow: hidden; background: #000; box-shadow: 0 10px 30px rgba(0,0,0,0.5); min-height: 400px;">
                <video controls autoplay style="width: 100%; height: 100%; object-fit: contain;">
                    <source src="${url}" type="video/mp4">
                    Il tuo browser non supporta la riproduzione di video.
                </video>
            </div>
        `;
    } else {
        mediaContent = `
            <div style="flex: 1; border-radius: 12px; overflow: hidden; background: #000; box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; min-height: 400px;">
                <img src="${url}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
            </div>
        `;
    }
    
    bodyEl.innerHTML = `
        <div style="padding: 10px; color: #94a3b8; height: 100%; display: flex; flex-direction: column;">
            ${backBtnHtml}
            <p style="margin-bottom: 15px; color: white; font-weight: bold; font-size: 16px; text-align: center;">${title}</p>
            ${mediaContent}
        </div>
    `;
};

window.closeDocModal = function() {
    const modal = document.getElementById('spaziocliente-doc-modal');
    if(modal) {
        modal.classList.remove('visible');
        setTimeout(() => {
            modal.style.display = 'none';
            // Ferma il video quando chiudi
            const bodyEl = document.getElementById('spaziocliente-doc-body');
            if(bodyEl) bodyEl.innerHTML = '';
        }, 300);
    }
};

// Inizializzazione Mappa Telemetrica 3D Nativa (MapLibre GL)
window.addEventListener('load', () => {
    setTimeout(() => {
        if(typeof maplibregl !== 'undefined' && document.getElementById('telemetry-map')) {
            const map = new maplibregl.Map({
                container: 'telemetry-map',
                style: {
                    version: 8,
                    sources: {
                        'esri-satellite': {
                            type: 'raster',
                            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                            tileSize: 256,
                            maxzoom: 19 // Permette l'overzoom (non fa sparire la mappa se zoomi troppo)
                        }
                    },
                    layers: [{
                        id: 'satellite-layer',
                        type: 'raster',
                        source: 'esri-satellite',
                        minzoom: 0,
                        maxzoom: 22
                    }]
                },
                center: [12.376391, 42.495363], // [lng, lat]
                zoom: 18,
                pitch: 60, // Inclinazione 3D
                bearing: -20, // Rotazione
                dragRotate: true,
                pitchWithRotate: true,
                attributionControl: false
            });

            // Controlli di navigazione (Zoom e Bussola)
            map.addControl(new maplibregl.NavigationControl({
                visualizePitch: true
            }), 'top-right');

            map.on('load', () => {
                const lat = 42.495363;
                const lng = 12.376391;

                // Esempio POI Interattivo (Sensore/Telecamera)
                const el = document.createElement('div');
                el.className = 'map-crosshair'; // Usiamo il mirino come marker di prova
                el.style.position = 'relative'; // Sovrascriviamo l'absolute del CSS
                el.style.top = '0'; el.style.left = '0'; el.style.transform = 'none';
                
                new maplibregl.Marker(el)
                    .setLngLat([lng, lat])
                    .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML('<div style="color: black; font-family: sans-serif;"><h3>Telecamera PTZ</h3><p>Sensore attivo.</p></div>'))
                    .addTo(map);
            });
        }
    }, 500); 
});
