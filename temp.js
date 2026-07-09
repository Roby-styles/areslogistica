







    // --- ACCESSIBILITÀ: REGOLAZIONE DIMENSIONE CARATTERI ---
    function changeFontSize(delta) {
        let currentSize = parseInt(localStorage.getItem('ares-font-size') || '19');
        let newSize = currentSize + delta;
        if (newSize < 14) newSize = 14;
        if (newSize > 26) newSize = 26;
        localStorage.setItem('ares-font-size', newSize);
        document.documentElement.style.setProperty('--base-font-size', newSize + 'px');
        updateSidebarWidth(newSize);
    }

    function resetFontSize() {
        localStorage.setItem('ares-font-size', '19');
        document.documentElement.style.setProperty('--base-font-size', '19px');
        updateSidebarWidth(19);
    }

    function updateSidebarWidth(fontSize) {
        let sidebarWidth = 290 + (fontSize - 19) * 15;
        if (sidebarWidth < 290) sidebarWidth = 290;
        document.documentElement.style.setProperty('--sidebar-width', sidebarWidth + 'px');
    }

    // --- ZOOM INTERFACCIA GLOBALE ---
    function changeZoom(delta) {
        let currentZoom = parseFloat(localStorage.getItem('ares-ui-zoom') || '1.0');
        let newZoom = currentZoom + delta;
        if (newZoom < 0.5) newZoom = 0.5;
        if (newZoom > 1.5) newZoom = 1.5;
        localStorage.setItem('ares-ui-zoom', newZoom);
        document.body.style.zoom = newZoom;
    }

    function resetZoom() {
        localStorage.setItem('ares-ui-zoom', '1.0');
        document.body.style.zoom = '1.0';
    }

    // Inizializza lo zoom al caricamento
    document.addEventListener('DOMContentLoaded', () => {
        let savedZoom = localStorage.getItem('ares-ui-zoom');
        if (savedZoom) {
            document.body.style.zoom = savedZoom;
        }
    });

    // Applica le dimensioni salvate all'avvio
    (function() {
        let savedSize = localStorage.getItem('ares-font-size') || '19';
        document.documentElement.style.setProperty('--base-font-size', savedSize + 'px');
        updateSidebarWidth(parseInt(savedSize));
    })();

    // --- STATO SOS EMERGENZA (Sincronizzazione Globale) ---
    let isSosActive = false;
    let activeSosWorker = null;
    let isSosMuted = false;
    let lastSosActivationTime = 0;

    // ----------------------------------------------------
    // INIZIALIZZAZIONE SUPABASE CLOUD SYNC ENGINE
    // ----------------------------------------------------
    const supabaseUrl = 'https://ypjmouwytrubedowkjci.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwam1vdXd5dHJ1YmVkb3dramNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMDAzNDIsImV4cCI6MjA5NjU3NjM0Mn0.-dmyNf08xQqR3gbeCbptqat0Bl-4SlTZ5YnmSUspU9I';
    let supabaseClient = null;
    try {
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
            // Test diagnostico di connessione immediato
            supabaseClient.from('ares_presence').select('username').limit(1).then(({data, error}) => {
                if (error) {
                    console.error("Test di connessione Supabase fallito:", error);
                    showCloudStatus("Errore Connessione Cloud: " + error.message, "error");
                } else {
                    console.log("Test di connessione Supabase riuscito!");
                }
            });
        }
    } catch (err) {
        console.error("Errore inizializzazione Supabase client:", err);
        showCloudStatus("Errore Inizializzazione Cloud", "error");
    }

    function showCloudStatus(text, type) {
        const dot = document.getElementById('cloud-sync-status-dot');
        const txt = document.getElementById('cloud-sync-status-text');
        const widget = document.getElementById('cloud-sync-widget');
        if (!dot || !txt || !widget) return;
        
        txt.innerText = text;
        
        if (type === 'success') {
            dot.style.background = '#10b981';
            dot.style.boxShadow = '0 0 8px #10b981';
            txt.style.color = '#10b981';
            widget.style.background = 'rgba(16, 185, 129, 0.05)';
            widget.style.borderColor = 'rgba(16, 185, 129, 0.1)';
        } else if (type === 'syncing') {
            dot.style.background = '#3b82f6';
            dot.style.boxShadow = '0 0 8px #3b82f6';
            txt.style.color = '#3b82f6';
            widget.style.background = 'rgba(59, 130, 246, 0.05)';
            widget.style.borderColor = 'rgba(59, 130, 246, 0.1)';
        } else if (type === 'error') {
            dot.style.background = '#ef4444';
            dot.style.boxShadow = '0 0 8px #ef4444';
            txt.style.color = '#ef4444';
            widget.style.background = 'rgba(239, 68, 68, 0.05)';
            widget.style.borderColor = 'rgba(239, 68, 68, 0.1)';
        }
    }

    async function syncLocalToCloud() {
        if (!supabaseClient) return;
        if (localStorage.getItem('ares_cloud_synced') === 'true') return;
        
        try {
            showCloudStatus("Prima migrazione in corso...", "syncing");
            
            // 1. Migrazione CRM
            const localCRM = JSON.parse(localStorage.getItem('crm_inputs') || "{}");
            const rowsCRM = Object.keys(localCRM).map(name => {
                const info = localCRM[name];
                return {
                    name: name,
                    zone: info.zone || "",
                    appuntamento: info.date || "",
                    preventivo: parseFloat(info.prev) || 0,
                    spesa: parseFloat(info.cost) || 0,
                    note: info.note || ""
                };
            });
            if (rowsCRM.length > 0) {
                const { error } = await supabaseClient.from('ares_crm').upsert(rowsCRM, { onConflict: 'name' });
                if (error) throw error;
            }
            
            // 2. Migrazione Risorse
            const localResStr = localStorage.getItem('ares_resources');
            if (localResStr) {
                const localRes = JSON.parse(localResStr);
                const rowsRes = [];
                
                if (localRes.persone) {
                    localRes.persone.forEach(p => {
                        rowsRes.push({
                            id: p.id,
                            tipo: 'persone',
                            nome_modello: p.nome || "",
                            cognome_targa: p.cognome || "",
                            foto: p.foto || "",
                            scadenza_1: p.ciScadenza || null,
                            scadenza_2: p.patenteScadenza || null,
                            scadenza_3: p.abilScadenza || null,
                            file_1: p.ciFile || "",
                            file_2: p.patenteFile || "",
                            file_3: p.abilFile || "",
                            repairs: []
                        });
                    });
                }
                if (localRes.mezzi) {
                    localRes.mezzi.forEach(m => {
                        rowsRes.push({
                            id: m.id,
                            tipo: 'mezzi',
                            nome_modello: m.tipo || "",
                            cognome_targa: m.targa || "",
                            foto: m.foto || "",
                            scadenza_1: m.assScadenza || null,
                            scadenza_2: m.revScadenza || null,
                            scadenza_3: null,
                            file_1: m.assFile || "",
                            file_2: m.revFile || "",
                            file_3: "",
                            repairs: m.repairs || []
                        });
                    });
                }
                if (localRes.attrezzature) {
                    localRes.attrezzature.forEach(a => {
                        rowsRes.push({
                            id: a.id,
                            tipo: 'attrezzature',
                            nome_modello: a.modello || "",
                            cognome_targa: "",
                            foto: a.foto || "",
                            scadenza_1: null,
                            scadenza_2: null,
                            scadenza_3: null,
                            file_1: "",
                            file_2: "",
                            file_3: "",
                            repairs: a.repairs || []
                        });
                    });
                }
                
                if (rowsRes.length > 0) {
                    const { error } = await supabaseClient.from('ares_resources').upsert(rowsRes, { onConflict: 'id' });
                    if (error) throw error;
                }
            }
            
            // 3. Migrazione Planning
            const localPlanning = JSON.parse(localStorage.getItem('planning_events') || "[]");
            const rowsPlanning = localPlanning.map(e => ({
                id: e.id,
                data_scadenza: e.date,
                descrizione: 'PLAN:' + e.desc,
                importante: false
            }));
            
            // Note del calendario e critical days
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('note_')) {
                    const dateKey = key.substring(5);
                    const notes = JSON.parse(localStorage.getItem(key) || "[]");
                    notes.forEach(n => {
                        rowsPlanning.push({
                            id: n.id,
                            data_scadenza: dateKey + 'T' + n.time,
                            descrizione: 'NOTE:' + n.txt,
                            importante: !!n.important
                        });
                    });
                } else if (key && key.startsWith('critical_day_')) {
                    const dateKey = key.substring(13);
                    const isCritical = localStorage.getItem(key) === 'true';
                    if (isCritical) {
                        let hash = 0;
                        for (let j = 0; j < dateKey.length; j++) {
                            hash = dateKey.charCodeAt(j) + ((hash << 5) - hash);
                        }
                        rowsPlanning.push({
                            id: Math.abs(hash),
                            data_scadenza: dateKey,
                            descrizione: 'CRITICAL',
                            importante: true
                        });
                    }
                }
            }
            
            if (rowsPlanning.length > 0) {
                const { error } = await supabaseClient.from('ares_planning').upsert(rowsPlanning, { onConflict: 'id' });
                if (error) throw error;
            }
            
            // 4. Migrazione Preventivi
            const localPrev = JSON.parse(localStorage.getItem('ares_preventivi') || "[]");
            const rowsPrev = localPrev.map(p => ({
                id: p.id,
                protocollo: p.protocollo,
                cliente: p.cliente,
                cantiere: p.cantiere,
                referente: p.referente,
                telefono: p.telefono,
                servizio: p.servizio,
                provincia: p.provincia,
                operatore: p.operatore,
                segnalatore: p.segnalatore,
                note_logistica: p.noteLogistica,
                note_contorno: p.noteContorno,
                distanza_km: p.distanzaKM,
                pedaggi: p.pedaggi,
                costo_chilometrico: p.costoChilometrico,
                staff_trasferta: p.staffTrasferta,
                costo_trasferta: p.costoTrasferta,
                costo_camera: p.costoCamera,
                persone_hotel: p.personeHotel,
                notti_hotel: p.nottiHotel,
                costo_alloggio: p.costoAlloggio,
                spese_presunte: p.spesePresunte,
                voci: p.voci,
                totale_preventivo: p.totalePreventivo,
                canvas_data: p.canvasData,
                stato: p.stato,
                data_creazione: p.dataCreazione
            }));
            if (rowsPrev.length > 0) {
                const { error } = await supabaseClient.from('ares_preventivi').upsert(rowsPrev, { onConflict: 'id' });
                if (error) throw error;
            }
            
            // 5. Migrazione Telecamere
            const localCams = JSON.parse(localStorage.getItem('ares_cameras') || "[]");
            const rowsCams = localCams.map(c => ({
                id: c.id,
                name: c.name,
                sourcetype: c.sourceType,
                url: c.url,
                lat: c.lat,
                lng: c.lng,
                status: c.status
            }));
            if (rowsCams.length > 0) {
                const { error } = await supabaseClient.from('ares_cameras').upsert(rowsCams, { onConflict: 'id' });
                if (error) throw error;
            }
            
            localStorage.setItem('ares_cloud_synced', 'true');
            showCloudStatus("Dati migrati in Cloud!", "success");
        } catch (err) {
            console.error("Errore migrazione:", err);
            showCloudStatus("Errore Migrazione Locale", "error");
        }
    }

    const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    let barChart, doughChart, cashFlowChart;

    function show(id) {
        document.querySelectorAll('.view-section').forEach(s => s.style.display='none');
        document.getElementById('view-'+id).style.display='block';
        if(id === 'planning') { renderAllCalendars(); renderPlanning(); }
        if(id === 'grafana') updateAll();
        if(id === 'dashboard') refreshDashboard();
        if(id === 'risorse') renderResources();
        if(id === 'preventivatore') renderPreventivi();
        if(id === 'fascicoli') renderFascicoli();
        if(id === 'utenti') renderUsers();
        if(id === 'operativa') initGisMap();
        if(id === 'videomanager') renderCameraManager();
    }

    // ----------------------------------------------------
    // SISTEMA DI AUTENTICAZIONE E SICUREZZA (CLOUD + LOCAL)
    // ----------------------------------------------------
    let usersList = [];
    const DEFAULT_USERS = [
        { id: 1, username: 'Massimo', password: 'ares2026!', role: 'super_admin' },
        { id: 2, username: 'Roberto', password: 'ares2026!', role: 'super_admin' },
        { id: 3, username: 'Utente 3', password: 'ares2026!', role: 'user' },
        { id: 4, username: 'Utente 4', password: 'ares2026!', role: 'user' },
        { id: 5, username: 'Utente 5', password: 'ares2026!', role: 'user' }
    ];

    async function initAuthSystem() {
        usersList = await loadUsersFromCloud();
        
        if (checkSessionActive()) {
            setupUserSessionUI();
            await completeAppInitialization();
        } else {
            const overlay = document.getElementById('login-overlay');
            if (overlay) overlay.style.display = 'flex';
        }
    }

    async function loadUsersFromCloud() {
        let loadedUsers = [];
        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient.from('ares_users').select('*');
                if (!error && data && data.length > 0) {
                    loadedUsers = data.map(row => ({
                        id: Number(row.id),
                        username: row.username,
                        password: row.password,
                        role: row.role
                    }));
                    console.log("Utenti caricati da Supabase con successo!");
                    return loadedUsers;
                } else {
                    console.warn("Tabella ares_users vuota o errore. Tenta l'inserimento degli utenti di default.");
                    await createUsersTableAndInsertDefaults();
                }
            } catch (err) {
                console.error("Errore lettura utenti da Supabase:", err);
            }
        }
        
        const localUsers = localStorage.getItem('ares_local_users');
        if (localUsers) {
            try {
                return JSON.parse(localUsers);
            } catch (e) {
                console.error("Errore parsing utenti locali:", e);
            }
        }
        
        localStorage.setItem('ares_local_users', JSON.stringify(DEFAULT_USERS));
        return DEFAULT_USERS;
    }

    async function createUsersTableAndInsertDefaults() {
        if (!supabaseClient) return;
        try {
            const rowsToInsert = DEFAULT_USERS.map(u => ({
                id: u.id,
                username: u.username,
                password: u.password,
                role: u.role
            }));
            const { error } = await supabaseClient.from('ares_users').insert(rowsToInsert);
            if (!error) {
                console.log("Utenti di default inseriti con successo su Supabase!");
            }
        } catch (err) {
            console.error("Errore nell'inserimento degli utenti di default in cloud:", err);
        }
    }

    function checkSessionActive() {
        const loggedUserStr = localStorage.getItem('ares_logged_user') || sessionStorage.getItem('ares_logged_user');
        if (loggedUserStr) {
            try {
                const loggedUser = JSON.parse(loggedUserStr);
                const exists = usersList.find(u => u.username === loggedUser.username);
                if (exists) {
                    return true;
                }
            } catch (e) {
                console.error("Errore lettura sessione:", e);
            }
        }
        return false;
    }

    function getLoggedUser() {
        const loggedUserStr = localStorage.getItem('ares_logged_user') || sessionStorage.getItem('ares_logged_user');
        if (loggedUserStr) {
            try {
                return JSON.parse(loggedUserStr);
            } catch (e) {}
        }
        return null;
    }

    async function handleLogin() {
        const usernameInput = document.getElementById('login-username');
        const passwordInput = document.getElementById('login-password');
        const errorMsg = document.getElementById('login-error-msg');
        
        if (!usernameInput || !passwordInput) return;
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        
        if (!username || !password) {
            showLoginError("Inserisci sia il nome utente che la password!");
            return;
        }
        
        const user = usersList.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
        
        if (user) {
            sessionStorage.setItem('ares_logged_user', JSON.stringify(user));
            localStorage.setItem('ares_logged_user', JSON.stringify(user));
            
            showLoginError("");
            usernameInput.value = "";
            passwordInput.value = "";
            
            setupUserSessionUI();
            await completeAppInitialization();
        } else {
            showLoginError("Credenziali errate! Riprova.");
        }
    }

    function showLoginError(msg) {
        const errorMsg = document.getElementById('login-error-msg');
        if (!errorMsg) return;
        if (msg) {
            errorMsg.innerText = msg;
            errorMsg.style.display = 'block';
        } else {
            errorMsg.style.display = 'none';
        }
    }

    async function logout() {
        const user = getLoggedUser();
        if (user && user.username && supabaseClient) {
            try {
                // Segnala offline istantaneo nel cloud
                await supabaseClient.from('ares_presence').upsert({
                    username: user.username,
                    last_seen: new Date(0).toISOString(),
                    device: 'Offline'
                }, { onConflict: 'username' });
            } catch (e) {
                console.error("Errore disconnessione presenza:", e);
            }
        }
        localStorage.removeItem('ares_logged_user');
        sessionStorage.removeItem('ares_logged_user');
        window.location.reload();
    }

    function setupUserSessionUI() {
        const user = getLoggedUser();
        if (!user) return;
        
        const nameSpan = document.getElementById('logged-user-name');
        if (nameSpan) nameSpan.innerText = user.username;
        
        const adminBtn = document.getElementById('btn-nav-utenti');
        if (adminBtn) {
            if (user.role === 'super_admin') {
                adminBtn.style.display = 'block';
            } else {
                adminBtn.style.display = 'none';
            }
        }
    }

    // ----------------------------------------------------
    // GEOLOCALIZZAZIONE AVANZATA (WATCH POSITION & DIAGNOSTICA)
    // ----------------------------------------------------
    let userLatitude = null;
    let userLongitude = null;
    let userSpeed = 0;
    let userBatteryLevel = null;
    let gpsWatchId = null;
    let gpsStatus = "not_requested"; // "not_requested", "loading", "active", "error"
    let gpsErrorMsg = "";

    function updateGpsStatus(status, message) {
        gpsStatus = status;
        gpsErrorMsg = message;

        // 1. Aggiorna il badge nella Sidebar
        const badge = document.getElementById('gps-status-badge');
        if (badge) {
            if (status === 'active') {
                badge.innerText = "🛰️ ATTIVO";
                badge.style.color = "#10b981";
            } else if (status === 'loading') {
                badge.innerText = "🛰️ RICERCA...";
                badge.style.color = "#3b82f6";
            } else if (status === 'error') {
                badge.innerText = "❌ ERRORE";
                badge.style.color = "#ef4444";
            } else {
                badge.innerText = "🔍 SPENTO";
                badge.style.color = "#94a3b8";
            }
        }

        // 2. Aggiorna il pannello in Dashboard
        const textDeck = document.getElementById('gps-status-text-deck');
        const badgeDeck = document.getElementById('gps-deck-badge');
        const triggerBtn = document.getElementById('btn-gps-trigger');
        const troubleshoot = document.getElementById('gps-troubleshoot-board');
        const errorMsgEl = document.getElementById('gps-error-detailed-msg');

        if (textDeck) textDeck.innerText = `Stato GPS: ${message}`;
        
        if (badgeDeck) {
            if (status === 'active') {
                badgeDeck.innerText = "GPS Attivo";
                badgeDeck.style.background = "rgba(16, 185, 129, 0.15)";
                badgeDeck.style.color = "#10b981";
                badgeDeck.style.borderColor = "rgba(16, 185, 129, 0.25)";
            } else if (status === 'loading') {
                badgeDeck.innerText = "GPS In Ricerca";
                badgeDeck.style.background = "rgba(59, 130, 246, 0.15)";
                badgeDeck.style.color = "#3b82f6";
                badgeDeck.style.borderColor = "rgba(59, 130, 246, 0.25)";
            } else if (status === 'error') {
                badgeDeck.innerText = "GPS Bloccato";
                badgeDeck.style.background = "rgba(239, 68, 68, 0.15)";
                badgeDeck.style.color = "#ef4444";
                badgeDeck.style.borderColor = "rgba(239, 68, 68, 0.25)";
            }
        }

        if (triggerBtn) {
            if (status === 'active') {
                triggerBtn.innerHTML = "<span style='font-size:20px;'>🛰️</span> GPS ATTIVO - AGGIORNA";
                triggerBtn.style.background = "linear-gradient(135deg, #10b981, #059669)";
                triggerBtn.style.boxShadow = "0 8px 30px rgba(16, 185, 129, 0.4)";
            } else if (status === 'error') {
                triggerBtn.innerHTML = "<span style='font-size:20px;'>⚠️</span> RIPROVA L'ATTIVAZIONE";
                triggerBtn.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
                triggerBtn.style.boxShadow = "0 8px 30px rgba(239, 68, 68, 0.4)";
            } else if (status === 'loading') {
                triggerBtn.innerHTML = "<span style='font-size:20px;'>🛰️</span> CONNESSIONE IN CORSO...";
                triggerBtn.style.background = "linear-gradient(135deg, #3b82f6, #2563eb)";
                triggerBtn.style.boxShadow = "0 8px 30px rgba(59, 130, 246, 0.4)";
            }
        }

        if (troubleshoot && errorMsgEl) {
            if (status === 'error') {
                errorMsgEl.innerText = message;
                troubleshoot.style.display = 'block';
            } else {
                troubleshoot.style.display = 'none';
            }
        }

        // 3. Aggiorna badge e messaggi anche sulla versione mobile PWA
        const mBadge = document.getElementById('mobile-gps-badge');
        const mBtn = document.getElementById('mobile-btn-gps-trigger');
        const mText = document.getElementById('mobile-gps-status-text');
        const mTroubleshoot = document.getElementById('mobile-gps-troubleshoot');
        const mErrorMsg = document.getElementById('mobile-gps-error-msg');
        
        if (mBadge) {
            if (status === 'active') {
                mBadge.innerText = "ATTIVO";
                mBadge.style.background = "rgba(16, 185, 129, 0.15)";
                mBadge.style.color = "#10b981";
                mBadge.style.borderColor = "rgba(16, 185, 129, 0.25)";
            } else if (status === 'loading') {
                mBadge.innerText = "RICERCA";
                mBadge.style.background = "rgba(59, 130, 246, 0.15)";
                mBadge.style.color = "#3b82f6";
                mBadge.style.borderColor = "rgba(59, 130, 246, 0.25)";
            } else if (status === 'error') {
                mBadge.innerText = "BLOCCATO";
                mBadge.style.background = "rgba(239, 68, 68, 0.15)";
                mBadge.style.color = "#ef4444";
                mBadge.style.borderColor = "rgba(239, 68, 68, 0.25)";
            }
        }
        
        if (mBtn) {
            if (status === 'active') {
                mBtn.innerHTML = "🛰️ GPS ATTIVO - AGGIORNA";
                mBtn.style.background = "linear-gradient(135deg, #10b981, #059669)";
            } else if (status === 'error') {
                mBtn.innerHTML = "⚠️ RIPROVA ATTIVAZIONE";
                mBtn.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
            } else if (status === 'loading') {
                mBtn.innerHTML = "🛰️ RILEVAMENTO SEGNALE...";
                mBtn.style.background = "linear-gradient(135deg, #3b82f6, #2563eb)";
            }
        }
        
        if (mText) {
            mText.innerText = `Stato GPS: ${message}`;
        }
        
        if (mTroubleshoot && mErrorMsg) {
            if (status === 'error') {
                mErrorMsg.innerText = message;
                mTroubleshoot.style.display = 'block';
            } else {
                mTroubleshoot.style.display = 'none';
            }
        }
    }

    function startGpsTracking(explicitClick = false) {
        if (!navigator.geolocation) {
            updateGpsStatus("error", "La geolocalizzazione non è supportata da questo browser.");
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        updateGpsStatus("loading", "Acquisizione segnale satellitare...");

        if (gpsWatchId) {
            navigator.geolocation.clearWatch(gpsWatchId);
        }

        // Recupero livello batteria reale (HTML5 Battery Status API)
        if (navigator.getBattery) {
            navigator.getBattery().then(battery => {
                userBatteryLevel = Math.round(battery.level * 100);
                battery.addEventListener('levelchange', () => {
                    userBatteryLevel = Math.round(battery.level * 100);
                    sendHeartbeat(); // Aggiorna istantaneamente lo stato in Cloud
                });
            }).catch(e => console.log("Battery Status API bloccato o non supportato"));
        }

        gpsWatchId = navigator.geolocation.watchPosition(
            (position) => {
                userLatitude = position.coords.latitude;
                userLongitude = position.coords.longitude;
                userSpeed = position.coords.speed || 0;
                
                const accuracy = position.coords.accuracy ? Math.round(position.coords.accuracy) : 0;
                updateGpsStatus("active", `Connesso (Precisione: ${accuracy}m)`);
                
                // Invia subito un heartbeat per allineare la mappa all'istante
                sendHeartbeat();
            },
            (error) => {
                console.error("Errore Geolocation watch:", error);
                let msg = "Impossibile ottenere la geolocalizzazione.";
                if (error.code === 1) {
                    msg = "Permesso negato. Hai bloccato l'accesso alla posizione nelle impostazioni del telefono o del browser.";
                } else if (error.code === 2) {
                    msg = "Posizione non disponibile. Assicurati che il GPS/Posizione del telefono sia acceso nelle impostazioni di sistema.";
                } else if (error.code === 3) {
                    msg = "Tempo scaduto per il rilevamento del segnale GPS. Spostati all'esterno.";
                }
                
                // Controlla navigazione in incognito su Safari/iOS
                const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
                const isMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
                if (isSafari && isMobile) {
                    msg += " NOTA SPECIALE: Su Apple iOS Safari, la geolocalizzazione è bloccata di default se stai usando la Navigazione in Incognito (scheda privata). Riapri il portale ARES in una scheda normale.";
                }

                updateGpsStatus("error", msg);
            },
            options
        );
    }

    async function sendHeartbeat() {
        const loggedUserStr = localStorage.getItem('ares_logged_user') || sessionStorage.getItem('ares_logged_user');
        if (!loggedUserStr) return;
        
        try {
            const user = JSON.parse(loggedUserStr);
            if (!user || !user.username) return;
            
            if (supabaseClient) {
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                let deviceType = isMobile ? "📱 Mobile" : "💻 PC";
                if (typeof isSosActive !== 'undefined' && isSosActive) {
                    deviceType = "🚨 SOS - " + deviceType;
                }
                
                const payload = {
                    username: user.username,
                    last_seen: new Date().toISOString(),
                    device: deviceType,
                    battery_level: userBatteryLevel
                };
                
                if (userLatitude !== null && userLongitude !== null) {
                    payload.latitude = userLatitude;
                    payload.longitude = userLongitude;
                    payload.speed = userSpeed;
                }
                
                const startTime = Date.now();
                try {
                    await supabaseClient.from('ares_presence').upsert(payload, { onConflict: 'username' });
                    const latency = Date.now() - startTime;
                    const pingStatusEl = document.getElementById('cloud-ping-status');
                    if (pingStatusEl) {
                        pingStatusEl.innerHTML = `🟢 ONLINE (<span style="color:#10b981; font-family: monospace; font-weight:700;">${latency}ms</span>)`;
                    }
                    
                    // Aggiorna indicatori anche su PWA mobile
                    const mPingEl = document.getElementById('mobile-cloud-ping');
                    if (mPingEl) mPingEl.innerHTML = `🟢 ONLINE (<span style="color:#10b981; font-family: monospace;">${latency}ms</span>)`;
                } catch (dbErr) {
                    console.error("Errore scrittura coordinate/heartbeat DB:", dbErr);
                    const pingStatusEl = document.getElementById('cloud-ping-status');
                    if (pingStatusEl) {
                        pingStatusEl.innerHTML = `<span style="color:#ef4444;">🔴 ERRORE DB</span>`;
                    }
                    const mPingEl = document.getElementById('mobile-cloud-ping');
                    if (mPingEl) mPingEl.innerHTML = `<span style="color:#ef4444;">🔴 ERRORE DB</span>`;
                }
                
                // Aggiorna visualizzazione batteria mobile
                const mBatteryEl = document.getElementById('mobile-device-battery');
                if (mBatteryEl) {
                    mBatteryEl.innerText = userBatteryLevel !== null ? `${userBatteryLevel}%` : "N/D (Limite iOS/Privacy 🛡️)";
                    mBatteryEl.style.color = userBatteryLevel !== null ? "#10b981" : "#ef4444";
                }
            }
        } catch (e) {
            console.error("Errore heartbeat globale:", e);
            const pingStatusEl = document.getElementById('cloud-ping-status');
            if (pingStatusEl) {
                pingStatusEl.innerHTML = `<span style="color:#ef4444;">🔴 DISCONNESSO</span>`;
            }
            const mPingEl = document.getElementById('mobile-cloud-ping');
            if (mPingEl) mPingEl.innerHTML = `<span style="color:#ef4444;">🔴 DISCONNESSO</span>`;
        }
    }

    async function updateOnlineUsersList() {
        const presenceSection = document.getElementById('online-presence-section');
        const usersListEl = document.getElementById('online-users-list');
        const activeCount = document.getElementById('active-count');
        
        const loggedUserStr = localStorage.getItem('ares_logged_user') || sessionStorage.getItem('ares_logged_user');
        if (!loggedUserStr) {
            if (presenceSection) presenceSection.style.display = 'none';
            return;
        }
        
        if (presenceSection) presenceSection.style.display = 'block';
        
        let activeUsers = [];
        
        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient.from('ares_presence').select('*');
                if (error) throw error;
                
                if (data) {
                    // Controlla se la sala operativa ha risolto il nostro SOS (mobile)
                    const loggedUserStr = localStorage.getItem('ares_logged_user') || sessionStorage.getItem('ares_logged_user');
                    if (loggedUserStr) {
                        try {
                            const currentUserObj = JSON.parse(loggedUserStr);
                            if (currentUserObj && currentUserObj.username) {
                                const myDbRecord = data.find(row => row.username === currentUserObj.username);
                                if (myDbRecord) {
                                    const hasSosInDb = myDbRecord.device && myDbRecord.device.includes("🚨 SOS");
                                    const elapsed = Date.now() - lastSosActivationTime;
                                    // Evita falsi positivi nei primi 15 secondi (latenza di propagazione del database)
                                    if (typeof isSosActive !== 'undefined' && isSosActive && !hasSosInDb && elapsed > 15000) {
                                        isSosActive = false;
                                        const btn = document.getElementById('mobile-btn-sos');
                                        if (btn) {
                                            btn.innerHTML = "🆘 INVIA SOS EMERGENZA";
                                            btn.classList.remove('btn-sos-active');
                                        }
                                        alert("L'allarme SOS è stato contrassegnato come RISOLTO dalla sala operativa.");
                                    }
                                }
                            }
                        } catch (err) { console.error(err); }
                    }

                    // --- GESTIONE SOS GLOBALE (LATO PC / SALA OPERATIVA) ---
                    // Cerca se c'è un allarme SOS attivo tra gli utenti online (attivi negli ultimi 5 minuti)
                    const nowTime = new Date().getTime();
                    const currentSosWorkerObj = data.find(row => {
                        const lastSeenTime = new Date(row.last_seen).getTime();
                        return Math.abs(nowTime - lastSeenTime) < 300000 && row.device && row.device.includes("🚨 SOS");
                    });
                    
                    const isPcDisplay = window.innerWidth >= 768;
                    const sosOverlay = document.getElementById('pc-sos-overlay');
                    const sosNameEl = document.getElementById('pc-sos-worker-name');
                    
                    if (currentSosWorkerObj && isPcDisplay) {
                        // Reset tacitazione se è un nuovo allarme SOS o se cambia la risorsa
                        if (!activeSosWorker || activeSosWorker.username !== currentSosWorkerObj.username) {
                            isSosMuted = false;
                            const muteBtn = document.getElementById('pc-btn-sos-mute');
                            if (muteBtn) {
                                muteBtn.innerHTML = '🔇 Silenzia';
                                muteBtn.style.opacity = '1';
                            }
                        }
                        
                        activeSosWorker = currentSosWorkerObj;
                        if (sosOverlay && sosNameEl) {
                            sosNameEl.innerText = activeSosWorker.username;
                            sosOverlay.style.display = 'flex';
                        }
                        
                        if (typeof isSosMuted !== 'undefined' && !isSosMuted) {
                            // Suona se è il primo beep, oppure se sono passati 8 secondi dall'ultimo (ripetizione continua)
                            if (!window.lastSosBeep || (Date.now() - window.lastSosBeep > 8000)) {
                                window.lastSosBeep = Date.now();
                                
                                // 1. Sintesi Vocale Femminile in Italiano (HTML5 Web Speech API)
                                if ('speechSynthesis' in window) {
                                    try {
                                        const msgText = `Attenzione! Allarme S O S. La risorsa ${activeSosWorker.username} richiede assistenza immediata!`;
                                        const utterance = new SpeechSynthesisUtterance(msgText);
                                        utterance.lang = 'it-IT';
                                        utterance.rate = 0.92; // Ritmo naturale e comprensibile
                                        utterance.pitch = 1.15; // Tonalità leggermente più acuta per renderla più femminile
                                        
                                        // Cerca una voce italiana non-maschile
                                        const voices = window.speechSynthesis.getVoices();
                                        const femaleVoice = voices.find(v => v.lang.startsWith('it') && !v.name.toLowerCase().includes('google it') && !v.name.toLowerCase().includes('cosimo'));
                                        if (femaleVoice) {
                                            utterance.voice = femaleVoice;
                                        }
                                        
                                        window.speechSynthesis.speak(utterance);
                                    } catch (speechErr) {
                                        console.error("Errore sintesi vocale SOS:", speechErr);
                                    }
                                }
                                
                                // 2. Beep Sonar di Fallback (conferma acustica)
                                try {
                                    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                                    const osc = audioCtx.createOscillator();
                                    const gain = audioCtx.createGain();
                                    osc.connect(gain);
                                    gain.connect(audioCtx.destination);
                                    osc.type = 'sawtooth';
                                    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
                                    gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
                                    osc.start();
                                    osc.stop(audioCtx.currentTime + 0.3);
                                } catch(e) { console.log(e); }
                            }
                        }
                    } else {
                        if (sosOverlay && isPcDisplay) {
                            sosOverlay.style.display = 'none';
                        }
                        if (isPcDisplay) {
                            activeSosWorker = null;
                            isSosMuted = false; // Reset per prossime emergenze
                            window.lastSosBeep = null; // Reset per permettere un nuovo allarme in futuro
                        }
                    }
                    // --------------------------------------------------------

                    const now = new Date().getTime();
                    activeUsers = data.filter(row => {
                        const lastSeenTime = new Date(row.last_seen).getTime();
                        return Math.abs(now - lastSeenTime) < 300000; // timeout di 5 minuti (assorbe fino a 5 minuti di sfasamento di orologio)
                    }).map(row => ({
                        username: row.username,
                        device: row.device
                    }));
                }
            } catch (e) {
                console.error("Errore nel caricamento presenze:", e);
                // Fallback locale: mostra se stessi
                const user = JSON.parse(loggedUserStr);
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                const deviceType = isMobile ? "📱 Mobile" : "💻 PC";
                activeUsers = [{ username: user.username, device: deviceType }];
            }
        } else {
            // Fallback senza cloud
            const user = JSON.parse(loggedUserStr);
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            const deviceType = isMobile ? "📱 Mobile" : "💻 PC";
            activeUsers = [{ username: user.username, device: deviceType }];
        }
        
        if (usersListEl) {
            usersListEl.innerHTML = "";
            activeUsers.forEach(u => {
                const item = document.createElement('div');
                item.style.display = 'flex';
                item.style.alignItems = 'center';
                item.style.justifyContent = 'space-between';
                item.style.fontSize = '11px';
                item.style.color = '#e2e8f0';
                item.style.padding = '5px 8px';
                item.style.background = 'rgba(255,255,255,0.03)';
                item.style.borderRadius = '6px';
                item.style.border = '1px solid rgba(255,255,255,0.05)';
                
                item.innerHTML = `
                    <span style="font-weight:600; display:flex; align-items:center; gap:5px;">
                        <span style="width: 5px; height: 5px; border-radius: 50%; background: #10b981; display: inline-block; box-shadow: 0 0 5px #10b981;"></span>
                        👤 ${u.username}
                    </span>
                    <span style="font-size: 9px; color: #94a3b8;">${u.device}</span>
                `;
                usersListEl.appendChild(item);
            });
        }
        
        if (activeCount) {
            activeCount.innerText = activeUsers.length;
        }
    }

    async function completeAppInitialization() {
        const overlay = document.getElementById('login-overlay');
        if (overlay) overlay.style.display = 'none';
        
        // 1. Prima esecuzione: migrazione automatica da locale a Supabase Cloud
        await syncLocalToCloud();
        
        // 2. Caricamento sequenziale dei dati sincronizzati
        await loadResources();
        await loadCRMData();
        await loadPlanning();
        await loadPreventivi();
        await loadCamerasFromCloud();
        
        // 3. Rinfresca dashboard e visualizzazioni globali
        updateAll();

        // 4. Sistema di Presenza in Tempo Reale
        try {
            // Mostriamo la diagnostica GPS a tutti gli utenti loggati per controllo trasparente
            const gpsCard = document.getElementById('gps-activation-card');
            if (gpsCard) gpsCard.style.display = 'block';

            // Avvio automatico silenziato del tracciamento (se i permessi sono già stati concessi)
            startGpsTracking(false);

            await sendHeartbeat();
            await updateOnlineUsersList();
            setInterval(sendHeartbeat, 10000);
            setInterval(updateOnlineUsersList, 10000);
        } catch (e) {
            console.error("Errore inizializzazione presenza:", e);
        }

        // 5. Inizializzazione Interfaccia Mobile PWA
        try {
            updateMobileInterface();
        } catch (mobErr) {
            console.error("Errore avvio mobile UI:", mobErr);
        }
    }

    // ----------------------------------------------------
    // SISTEMA GIS & CENTRALE OPERATIVA (LEAFLET.JS)
    // ----------------------------------------------------
    let mapInstance = null;
    let darkLayer = null;
    let greyLightLayer = null;
    let trafficLayer = null;
    let weatherLayer = null;
    let satelliteLayer = null;
    let markersGroup = null;
    let selectedWorker = null;
    let mapMarkers = {}; // Mappa dei marker attivi (chiave: username)
    let autoUpdateGisInterval = null;
    
    // VARIABILI PER MASTERPLAN: BAVETTA E DISPATCHER
    let mapTrails = {}; 
    let mapPolylines = {}; 
    let trailLength = 20; 
    let activeMissions = {};

    function updateTrailLength(val) {
        trailLength = parseInt(val);
        document.getElementById('trail-length-val').innerText = val;
        // Aggiorna visivamente tutte le polilinee istantaneamente
        Object.keys(mapPolylines).forEach(username => {
            if (trailLength === 0) {
                mapPolylines[username].setStyle({opacity: 0});
            } else {
                mapPolylines[username].setStyle({opacity: 0.7});
                // Troncamento immediato visivo se ridotto
                if (mapTrails[username] && mapTrails[username].length > trailLength) {
                    mapTrails[username] = mapTrails[username].slice(-trailLength);
                    mapPolylines[username].setLatLngs(mapTrails[username]);
                }
            }
        });
    }

    function initGisMap() {
        if (mapInstance) {
            // Rinfresca il layout se già inizializzato
            setTimeout(() => { mapInstance.invalidateSize(); }, 200);
            return;
        }

        try {
            // Centra la mappa su Roma di default
            mapInstance = L.map('gis-map', {
                center: [41.8902, 12.4922],
                zoom: 12,
                zoomControl: true
            });

            // Layer di Base stradale (OSM standard con contrasto scuro premium)
            darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20,
                crossOrigin: 'anonymous'
            });

            // Layer Grigio Chiaro Premium ("Grey Light" Positron)
            greyLightLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20,
                crossOrigin: 'anonymous'
            });

            // Aggiungiamo di default il layer scuro
            darkLayer.addTo(mapInstance);

            // Layer Satellitare (ArcGIS) - spento di default
            satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri',
                crossOrigin: 'anonymous'
            });

            // Layer Traffico Live (Google Maps Real-Time) - spettacolare e in tempo reale!
            trafficLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}', {
                attribution: '&copy; Google Maps',
                crossOrigin: 'anonymous'
            });

            // Layer Meteo Radar Live (RainViewer API) - spento di default
            weatherLayer = L.tileLayer('', {
                attribution: 'Meteo &copy; RainViewer',
                opacity: 0.65,
                maxZoom: 20
            });
            
            // Carica dinamicamente il radar meteo in tempo reale da RainViewer
            fetch('https://api.rainviewer.com/public/weather-maps.json')
                .then(res => res.json())
                .then(data => {
                    if (data && data.radar && data.radar.past && data.radar.past.length > 0) {
                        const lastRadar = data.radar.past[data.radar.past.length - 1];
                        const tileUrl = `${data.host}${lastRadar.path}/256/{z}/{x}/{y}/2/1_1.png`;
                        weatherLayer.setUrl(tileUrl);
                    }
                })
                .catch(err => console.error("Errore caricamento radar meteo RainViewer:", err));

            markersGroup = L.layerGroup().addTo(mapInstance);

            // Avvia la sincronizzazione automatica delle risorse sulla mappa
            updateGisWorkers();
            if (autoUpdateGisInterval) clearInterval(autoUpdateGisInterval);
            autoUpdateGisInterval = setInterval(updateGisWorkers, 10000);

            setTimeout(() => { mapInstance.invalidateSize(); }, 200);
            initRadarPipResizer();
        } catch (e) {
            console.error("Errore inizializzazione mappa GIS:", e);
        }
    }

    let fascicoliLayerGroup = null;

    async function toggleAttivitaLayer() {
        if (!mapInstance) return;
        const cb = document.getElementById('layer-attivita');
        if(!fascicoliLayerGroup) {
            fascicoliLayerGroup = L.layerGroup();
        }
        if (cb && cb.checked) {
            await fetchFascicoli(); // Assicura che i dati siano sempre freschi
            fascicoliLayerGroup.clearLayers();
            aresFascicoli.forEach(fascicolo => {
                if (fascicolo.lat && fascicolo.lng) {
                    const icon = L.divIcon({
                        className: 'custom-leaflet-icon', 
                        html: `<div style="width:20px;height:20px;background:#38bdf8;border-radius:50%;border:2px solid #fff;box-shadow:0 0 15px #38bdf8; display:flex; justify-content:center; align-items:center; color:#0f172a; font-weight:bold; font-size:10px;">${fascicolo.id}</div>`
                    });
                    const marker = L.marker([fascicolo.lat, fascicolo.lng], {icon: icon});
                    marker.bindTooltip(`<b>#FAS-${fascicolo.id}</b><br>${fascicolo.titolo_commessa || 'Cantiere'}`, {
                        className: 'neon-glass-tooltip',
                        direction: 'top',
                        offset: [0, -10]
                    });
                    marker.on('click', () => {
                        openFascicoloBook(fascicolo.id);
                    });
                    marker.addTo(fascicoliLayerGroup);
                }
            });
            fascicoliLayerGroup.addTo(mapInstance);
        } else {
            mapInstance.removeLayer(fascicoliLayerGroup);
        }
    }

    function toggleTrafficLayer() {
        if (!mapInstance) return;
        const cb = document.getElementById('layer-traffic');
        if (cb.checked) {
            trafficLayer.addTo(mapInstance);
        } else {
            mapInstance.removeLayer(trafficLayer);
        }
    }

    function toggleWeatherLayer() {
        if (!mapInstance) return;
        const cb = document.getElementById('layer-weather');
        if (cb.checked) {
            weatherLayer.addTo(mapInstance);
        } else {
            mapInstance.removeLayer(weatherLayer);
        }
    }

    function toggleSatelliteLayer() {
        if (!mapInstance) return;
        const cb = document.getElementById('layer-satellite');
        if (cb.checked) {
            satelliteLayer.addTo(mapInstance);
        } else {
            mapInstance.removeLayer(satelliteLayer);
        }
    }

    function toggleGreyLightLayer() {
        if (!mapInstance) return;
        const cb = document.getElementById('layer-greylight');
        if (cb.checked) {
            if (darkLayer) mapInstance.removeLayer(darkLayer);
            greyLightLayer.addTo(mapInstance);
        } else {
            if (greyLightLayer) mapInstance.removeLayer(greyLightLayer);
            darkLayer.addTo(mapInstance);
        }
    }

    function toggleRadarPip() {
        const cb = document.getElementById('layer-radar-pip');
        const widget = document.getElementById('radar-pip-widget');
        if (!cb || !widget) return;
        
        if (cb.checked) {
            widget.style.display = 'flex';
        } else {
            widget.style.display = 'none';
        }
    }

    function closeRadarPip() {
        const cb = document.getElementById('layer-radar-pip');
        const widget = document.getElementById('radar-pip-widget');
        if (cb) cb.checked = false;
        if (widget) widget.style.display = 'none';
    }

    function toggleRadarPipSize() {
        const widget = document.getElementById('radar-pip-widget');
        const btn = document.getElementById('btn-radar-pip-size');
        if (!widget || !btn) return;
        
        // Ripristina la transizione CSS per l'animazione di ingrandimento/riduzione al clic
        widget.style.transition = 'all 0.3s ease';
        
        const currentWidth = widget.getBoundingClientRect().width;
        if (currentWidth < 500) {
            // Ingrandisci a una dimensione monitor ottimale per widescreen
            widget.style.width = '800px';
            widget.style.height = '580px';
            btn.innerText = '🗗';
            btn.title = 'Ripristina Mini Radar';
        } else {
            // Ripristina alla dimensione PiP compatta in basso a destra
            widget.style.width = '340px';
            widget.style.height = '260px';
            btn.innerText = '🗖';
            btn.title = 'Ingrandisci';
        }
    }

    function initRadarPipResizer() {
        const widget = document.getElementById('radar-pip-widget');
        const handle = document.getElementById('radar-pip-resize-handle');
        if (!widget || !handle) return;

        let startX, startY, startWidth, startHeight;
        let shield = null;

        // Gestione doppio clic sull'header per ingrandire/ripristinare come su Windows!
        const header = widget.querySelector('div[style*="background: rgba(99, 102, 241"]');
        if (header) {
            header.style.cursor = 'zoom-in';
            header.title = 'Doppio clic per ingrandire/ripristinare';
            header.addEventListener('dblclick', (e) => {
                e.preventDefault();
                toggleRadarPipSize();
            });
        }

        handle.addEventListener('mousedown', startResize);
        handle.addEventListener('touchstart', startResize, { passive: false });

        function startResize(e) {
            e.preventDefault();
            e.stopPropagation();

            // Disattiva le transizioni CSS durante il trascinamento per la massima fluidità e reattività
            widget.style.transition = 'none';

            const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
            const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

            startX = clientX;
            startY = clientY;
            
            const rect = widget.getBoundingClientRect();
            startWidth = rect.width;
            startHeight = rect.height;

            // Aggiunge lo schermo trasparente sopra l'iframe per evitare che catturi gli eventi del mouse
            if (!shield) {
                shield = document.createElement('div');
                shield.id = 'radar-resize-shield';
                shield.style.position = 'absolute';
                shield.style.top = '0';
                shield.style.left = '0';
                shield.style.width = '100%';
                shield.style.height = '100%';
                shield.style.zIndex = '1000';
                shield.style.cursor = 'nwse-resize';
                shield.style.background = 'transparent';
                widget.appendChild(shield);
            }

            document.addEventListener('mousemove', resize);
            document.addEventListener('touchmove', resize, { passive: false });
            document.addEventListener('mouseup', stopResize);
            document.addEventListener('touchend', stopResize);
        }

        function resize(e) {
            const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
            const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

            // Calcola la variazione dal punto di partenza.
            // Essendo ancorato in basso a destra, muovere il cursore a SINISTRA (X minore) aumenta la larghezza.
            // Muovere il cursore in ALTO (Y minore) aumenta l'altezza.
            const dx = startX - clientX;
            const dy = startY - clientY;

            let newWidth = startWidth + dx;
            let newHeight = startHeight + dy;

            // Limiti dimensionali minimi e massimi (proporzioni operative)
            const minWidth = 280;
            const minHeight = 220;
            const maxWidth = window.innerWidth - 40;
            const maxHeight = window.innerHeight - 40;

            if (newWidth < minWidth) newWidth = minWidth;
            if (newWidth > maxWidth) newWidth = maxWidth;
            if (newHeight < minHeight) newHeight = minHeight;
            if (newHeight > maxHeight) newHeight = maxHeight;

            widget.style.width = newWidth + 'px';
            widget.style.height = newHeight + 'px';

            // Aggiorna l'icona del pulsante di ingrandimento in tempo reale
            const btn = document.getElementById('btn-radar-pip-size');
            if (btn) {
                if (newWidth > 500) {
                    btn.innerText = '🗗';
                    btn.title = 'Ripristina Mini Radar';
                } else {
                    btn.innerText = '🗖';
                    btn.title = 'Ingrandisci';
                }
            }
        }

        function stopResize() {
            if (shield && shield.parentNode) {
                shield.parentNode.removeChild(shield);
                shield = null;
            }

            // Ripristina la transizione per i clic sui pulsanti predefiniti
            widget.style.transition = 'all 0.3s ease';

            document.removeEventListener('mousemove', resize);
            document.removeEventListener('touchmove', resize);
            document.removeEventListener('mouseup', stopResize);
            document.removeEventListener('touchend', stopResize);
        }
    }

    async function updateGisWorkers() {
        if (!supabaseClient || !mapInstance) return;

        try {
            const { data, error } = await supabaseClient.from('ares_presence').select('*');
            if (error) throw error;

            if (data) {
                const now = new Date().getTime();
                const activeWorkers = data.filter(row => {
                    const lastSeenTime = new Date(row.last_seen).getTime();
                    return Math.abs(now - lastSeenTime) < 300000 && row.latitude && row.longitude;
                });

                // Nudging/Jittering per evitare sovrapposizioni esatte
                const coordsMap = {};
                activeWorkers.forEach(w => {
                    let lat = parseFloat(w.latitude);
                    let lon = parseFloat(w.longitude);
                    const coordKey = `${lat.toFixed(5)},${lon.toFixed(5)}`;
                    
                    if (coordsMap[coordKey]) {
                        const angle = (coordsMap[coordKey] * 2 * Math.PI) / 8;
                        const offset = 0.00015; // circa 15-20 metri di dispersione
                        lat += Math.sin(angle) * offset;
                        lon += Math.cos(angle) * offset;
                        coordsMap[coordKey]++;
                    } else {
                        coordsMap[coordKey] = 1;
                    }
                    w.nudgedLat = lat;
                    w.nudgedLon = lon;
                });

                // Rimuovi i marker degli utenti non più attivi
                const activeUsernames = activeWorkers.map(w => w.username);
                Object.keys(mapMarkers).forEach(username => {
                    if (!activeUsernames.includes(username)) {
                        markersGroup.removeLayer(mapMarkers[username]);
                        delete mapMarkers[username];
                    }
                });

                let currentSosWorkerObj = null;

                // Aggiungi o aggiorna i marker per ciascuna risorsa attiva
                activeWorkers.forEach(w => {
                    const lat = w.nudgedLat;
                    const lon = w.nudgedLon;
                    const speed = w.speed ? Math.round(parseFloat(w.speed) * 3.6) : 0; // km/h

                    const initial = w.username.substring(0, 2).toUpperCase();
                    
                    const isWorkerSos = w.device && w.device.includes("🚨 SOS");
                    if (isWorkerSos) {
                        currentSosWorkerObj = w;
                    }
                    
                    const markerColor = isWorkerSos ? '#ef4444' : (w.username.toLowerCase() === 'massimo' || w.username.toLowerCase() === 'roberto' ? '#818cf8' : '#10b981');
                    const glowShadow = isWorkerSos ? 'rgba(239, 68, 68, 0.8)' : (w.username.toLowerCase() === 'massimo' || w.username.toLowerCase() === 'roberto' ? 'rgba(129, 140, 248, 0.6)' : 'rgba(16, 185, 129, 0.6)');
                    const animPulse = isWorkerSos ? 'pulse-radar 1s infinite' : 'pulse-radar 2s infinite ease-out';

                    const customIcon = L.divIcon({
                        className: 'custom-leaflet-icon',
                        html: `
                            <div style="position: relative; width: 36px; height: 36px;">
                                <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: ${glowShadow}; animation: ${animPulse}; opacity: 0.8; z-index: 1;"></div>
                                <div style="position: absolute; top: 3px; left: 3px; width: 30px; height: 30px; border-radius: 50%; background: #131520; border: 2px solid ${markerColor}; color: #fff; font-weight: 800; font-size: 11px; display: flex; align-items: center; justify-content: center; z-index: 2; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                                    ${initial}
                                </div>
                                <div style="position: absolute; bottom: -2px; left: 15px; width: 6px; height: 6px; background: ${markerColor}; transform: rotate(45deg); z-index: 2;"></div>
                            </div>
                        `,
                        iconSize: [36, 36],
                        iconAnchor: [18, 36]
                    });

                    if (mapMarkers[w.username]) {
                        mapMarkers[w.username].setLatLng([lat, lon]);
                        mapMarkers[w.username].setIcon(customIcon);
                    } else {
                        const marker = L.marker([lat, lon], { icon: customIcon }).addTo(markersGroup);
                        // Rimosso il popup nativo banale a favore del Widget Operatore integrato a destra
                        marker.on('click', () => {
                            selectGisWorker(w);
                        });
                        mapMarkers[w.username] = marker;
                    }

                    // --- BAVETTA (Snail Trail) LOGIC ---
                    if (!mapTrails[w.username]) mapTrails[w.username] = [];
                    const history = mapTrails[w.username];
                    const newPoint = [lat, lon];
                    
                    if (history.length === 0 || (Math.abs(history[history.length-1][0]-lat) > 0.00002 || Math.abs(history[history.length-1][1]-lon) > 0.00002)) {
                        history.push(newPoint);
                        if (history.length > trailLength) history.shift();
                    }
                    
                    if (!mapPolylines[w.username]) {
                        mapPolylines[w.username] = L.polyline(history, {
                            color: '#0ea5e9',
                            weight: 5,
                            opacity: trailLength > 0 ? 0.7 : 0,
                            dashArray: '5, 10',
                            lineCap: 'round',
                            lineJoin: 'round'
                        }).addTo(mapInstance);
                    } else {
                        mapPolylines[w.username].setLatLngs(history);
                    }

                    // --- MISSION TRACKING & ETA ---
                    if (activeMissions[w.username]) {
                        checkMissionArrival(w.username, lat, lon);
                    }

                    if (selectedWorker && selectedWorker.username === w.username) {
                        selectedWorker = w;
                        updateWorkerCardUI();
                    }
                });
                
                // Gestione stato locale SOS per il focus mappa
                // (L'overlay e l'audio globali sono gestiti da updateOnlineUsersList)
                if (currentSosWorkerObj) {
                    activeSosWorker = currentSosWorkerObj;
                } else {
                    activeSosWorker = null;
                }
            }
        } catch (e) {
            console.error("Errore aggiornamento risorse sulla mappa:", e);
        }
    }

    function selectGisWorker(worker) {
        selectedWorker = worker;
        document.getElementById('gis-no-worker-msg').style.display = 'none';
        document.getElementById('gis-worker-card').style.display = 'flex';
        updateWorkerCardUI();
    }

    function updateWorkerCardUI() {
        if (!selectedWorker) return;

        const lat = parseFloat(selectedWorker.latitude);
        const lon = parseFloat(selectedWorker.longitude);
        const speed = selectedWorker.speed ? Math.round(parseFloat(selectedWorker.speed) * 3.6) : 0;
        // Lettura dinamica della percentuale batteria reale ricevuta dal cellulare
        const hasBattery = selectedWorker.battery_level !== null && selectedWorker.battery_level !== undefined && selectedWorker.battery_level !== '';
        const batteryVal = hasBattery ? `${selectedWorker.battery_level}%` : (selectedWorker.device && selectedWorker.device.includes("Mobile") ? "N/D (Limite iOS/Privacy 🛡️)" : "N/D (PC/Non supp.)");
        
        document.getElementById('gis-worker-name').innerText = selectedWorker.username;
        document.getElementById('gis-worker-coords').innerText = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        document.getElementById('gis-worker-battery').innerText = batteryVal;
        document.getElementById('gis-worker-speed').innerText = `${speed} km/h`;
        
        // Refresh mission UI se l'utente selezionato ha una missione in corso
        const missionBox = document.getElementById('mission-status-box');
        if (activeMissions[selectedWorker.username]) {
            missionBox.style.display = 'block';
            missionBox.style.background = 'rgba(245, 158, 11, 0.1)';
            missionBox.style.borderColor = 'rgba(245, 158, 11, 0.3)';
            missionBox.innerHTML = `
                🚀 In rotta verso: <b id="mission-target-name">${activeMissions[selectedWorker.username].target}</b><br>
                ⏱️ ETA stimato: <span id="mission-eta" style="font-weight: 800;">${activeMissions[selectedWorker.username].etaMinutes || '?'} minuti</span><br>
                <button onclick="cancelMission()" style="margin-top: 6px; background: transparent; border: 1px solid #f43f5e; color: #f43f5e; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 9px;">Annulla Rotta</button>
            `;
        } else {
            missionBox.style.display = 'none';
        }

        // Calcolo tempo reale trascorso dall'ultimo segnale ricevuto
        let lastSeenText = "N/D";
        if (selectedWorker.last_seen) {
            const diffMs = new Date() - new Date(selectedWorker.last_seen);
            const diffSec = Math.round(diffMs / 1000);
            if (diffSec < 0) {
                lastSeenText = "In questo istante";
            } else if (diffSec < 15) {
                lastSeenText = "In tempo reale ⚡";
            } else if (diffSec < 60) {
                lastSeenText = `Da ${diffSec} secondi`;
            } else {
                const diffMin = Math.round(diffSec / 60);
                lastSeenText = `Da ${diffMin} min fa`;
            }
        }
        const lastSeenEl = document.getElementById('gis-worker-last-seen');
        if (lastSeenEl) lastSeenEl.innerText = lastSeenText;

        const statusDiv = document.getElementById('gis-worker-status');
        if (selectedWorker.device.includes("Mobile")) {
            statusDiv.innerHTML = "🟢 In Servizio Attivo (📱 Mobile)";
            statusDiv.style.color = "#10b981";
        } else {
            statusDiv.innerHTML = "🔵 Connesso da Centrale (💻 PC)";
            statusDiv.style.color = "#818cf8";
        }
    }

    // Ticker globale ogni secondo per aggiornare i contatori d'inattività live nella Centrale
    setInterval(() => {
        const card = document.getElementById('gis-worker-card');
        if (selectedWorker && card && card.style.display === 'flex') {
            updateWorkerCardUI();
        }
    }, 1000);

    function focusMapOnSelectedWorker() {
        if (!selectedWorker || !mapInstance) return;
        const lat = parseFloat(selectedWorker.latitude);
        const lon = parseFloat(selectedWorker.longitude);
        if (lat && lon) {
            mapInstance.flyTo([lat, lon], 16, {
                animate: true,
                duration: 1.5
            });
        }
    }

    // --- FUNZIONI WIDGET DISPATCHER E MISSIONI ---

    async function assignMissionToSelected() {
        if (!selectedWorker) return;
        const address = document.getElementById('mission-target-address').value;
        if (!address) return;
        
        const missionBox = document.getElementById('mission-status-box');
        missionBox.style.display = 'block';
        missionBox.style.background = 'rgba(245, 158, 11, 0.1)';
        missionBox.style.borderColor = 'rgba(245, 158, 11, 0.3)';
        missionBox.innerHTML = `
            🚀 In rotta verso: <b id="mission-target-name">${address}</b><br>
            ⏱️ ETA: <span id="mission-eta" style="font-weight: 800;">Ricerca coordinate...</span><br>
            <button onclick="cancelMission()" style="margin-top: 6px; background: transparent; border: 1px solid #f43f5e; color: #f43f5e; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 9px;">Annulla Rotta</button>
        `;
        
        try {
            // Geocoding via Nominatim
            const geocodeRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
            const geocodeData = await geocodeRes.json();
            if (!geocodeData || geocodeData.length === 0) {
                document.getElementById('mission-eta').innerText = 'Indirizzo non trovato!';
                return;
            }
            
            const targetLat = parseFloat(geocodeData[0].lat);
            const targetLon = parseFloat(geocodeData[0].lon);
            
            cancelMission(selectedWorker.username, true); // pulizia precedente
            
            activeMissions[selectedWorker.username] = {
                target: address,
                coords: [targetLat, targetLon],
                startTime: Date.now()
            };
            
            // OSRM Routing
            const startLon = parseFloat(selectedWorker.longitude);
            const startLat = parseFloat(selectedWorker.latitude);
            
            document.getElementById('mission-eta').innerText = 'Calcolo rotta...';
            const osrmRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${targetLon},${targetLat}?overview=full&geometries=geojson`);
            const osrmData = await osrmRes.json();
            
            if (osrmData && osrmData.routes && osrmData.routes.length > 0) {
                const route = osrmData.routes[0];
                const durationMinutes = Math.max(1, Math.round(route.duration / 60));
                document.getElementById('mission-eta').innerText = `${durationMinutes} minuti (${(route.distance/1000).toFixed(1)} km)`;
                
                // Draw route
                const latlngs = route.geometry.coordinates.map(c => [c[1], c[0]]);
                const routeLine = L.polyline(latlngs, {
                    color: '#f59e0b',
                    weight: 4,
                    dashArray: '10, 15',
                    opacity: 0.8
                }).addTo(mapInstance);
                
                activeMissions[selectedWorker.username].routeLine = routeLine;
                activeMissions[selectedWorker.username].etaMinutes = durationMinutes;
                
                // Draw target marker
                const targetIcon = L.divIcon({
                    className: 'custom-leaflet-icon',
                    html: `<div style="font-size:28px; filter: drop-shadow(0 0 10px rgba(245,158,11,0.8));">🎯</div>`,
                    iconSize: [28, 28], iconAnchor: [14, 14]
                });
                activeMissions[selectedWorker.username].targetMarker = L.marker([targetLat, targetLon], {icon: targetIcon}).addTo(mapInstance);
                
                // Optional: update Supabase device string to show mission globally
                if (supabaseClient) {
                    const cleanDevice = selectedWorker.device ? selectedWorker.device.split(' [MISSION')[0] : 'Sconosciuto';
                    await supabaseClient.from('ares_presence').update({ 
                        device: `${cleanDevice} [MISSION: ${address}]` 
                    }).eq('username', selectedWorker.username);
                }
            }
        } catch (e) {
            console.error("Errore routing:", e);
            document.getElementById('mission-eta').innerText = 'Errore API di rotta.';
        }
    }

    function cancelMission(usernameOverride, isSilent) {
        const uname = usernameOverride || (selectedWorker ? selectedWorker.username : null);
        if (!uname) return;
        
        if (activeMissions[uname]) {
            if (activeMissions[uname].routeLine) mapInstance.removeLayer(activeMissions[uname].routeLine);
            if (activeMissions[uname].targetMarker) mapInstance.removeLayer(activeMissions[uname].targetMarker);
            delete activeMissions[uname];
        }
        
        if (!isSilent && selectedWorker && uname === selectedWorker.username) {
            document.getElementById('mission-status-box').style.display = 'none';
            document.getElementById('mission-target-address').value = '';
            
            // Ripristina nome device pulito su Supabase
            if (supabaseClient) {
                const cleanDevice = selectedWorker.device ? selectedWorker.device.split(' [MISSION')[0] : 'Sconosciuto';
                supabaseClient.from('ares_presence').update({ device: cleanDevice }).eq('username', selectedWorker.username).then();
            }
        }
    }

    function checkMissionArrival(username, currentLat, currentLon) {
        const mission = activeMissions[username];
        if (!mission) return;
        const targetLat = mission.coords[0];
        const targetLon = mission.coords[1];
        
        // Haversine formula
        const R = 6371e3;
        const f1 = currentLat * Math.PI/180;
        const f2 = targetLat * Math.PI/180;
        const df = (targetLat-currentLat) * Math.PI/180;
        const dl = (targetLon-currentLon) * Math.PI/180;
        const a = Math.sin(df/2) * Math.sin(df/2) + Math.cos(f1) * Math.cos(f2) * Math.sin(dl/2) * Math.sin(dl/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        if (distance < 50) { // ARRIVATO (sotto 50 metri)
            const elapsedMins = Math.max(1, Math.round((Date.now() - mission.startTime) / 60000));
            
            // Rimuovi rotte visive
            if (mission.routeLine) mapInstance.removeLayer(mission.routeLine);
            if (mission.targetMarker) mapInstance.removeLayer(mission.targetMarker);
            delete activeMissions[username];
            
            // Seleziona il widget se è quello visibile
            if (selectedWorker && selectedWorker.username === username) {
                const missionBox = document.getElementById('mission-status-box');
                missionBox.style.background = 'rgba(16, 185, 129, 0.2)';
                missionBox.style.borderColor = '#10b981';
                missionBox.innerHTML = `
                    🎉 <b style="color: #10b981; font-size:14px;">ARRIVATO A DESTINAZIONE!</b><br>
                    <span style="color: #fff;">L'operatore ha completato la rotta in <b style="color:#34d399;">${elapsedMins} minuti</b>.</span><br>
                    <button onclick="document.getElementById('mission-status-box').style.display='none';" style="margin-top:8px; background:rgba(16,185,129,0.3); border:none; color:#10b981; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:700;">Chiudi Log</button>
                `;
            }
            
            // Aggiorna device su DB
            if (supabaseClient) {
                const cleanDevice = selectedWorker ? (selectedWorker.device ? selectedWorker.device.split(' [MISSION')[0] : 'Sconosciuto') : 'Mobile';
                supabaseClient.from('ares_presence').update({ device: cleanDevice }).eq('username', username).then();
            }
        }
    }

    let missionSearchTimeout = null;

    function handleMissionSearch(query) {
        query = query.trim();
        const resultsBox = document.getElementById('mission-search-results');
        if (!resultsBox) return;

        clearTimeout(missionSearchTimeout);
        
        if (query.length < 3) {
            resultsBox.style.display = 'none';
            return;
        }

        resultsBox.innerHTML = '<div style="padding: 8px 10px; color: #818cf8; font-size: 11px; text-align: center;">Ricerca in corso... ⏳</div>';
        resultsBox.style.display = 'block';

        missionSearchTimeout = setTimeout(() => {
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=it`)
                .then(r => r.json())
                .then(data => {
                    if (data.length === 0) {
                        resultsBox.innerHTML = '<div style="padding: 8px 10px; color: #f43f5e; font-size: 11px;">Nessun risultato trovato</div>';
                    } else {
                        resultsBox.innerHTML = data.map(item => `
                            <div style="padding: 8px 10px; color: #cbd5e1; font-size: 10px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05);" 
                                 onclick="selectMissionAddress('${item.display_name.replace(/'/g, "\\'")}')"
                                 onmouseover="this.style.background='rgba(99,102,241,0.2)'"
                                 onmouseout="this.style.background='transparent'">
                                📍 ${item.display_name}
                            </div>
                        `).join('');
                    }
                })
                .catch(err => {
                    console.error('Geocoding error:', err);
                    resultsBox.innerHTML = '<div style="padding: 8px 10px; color: #f43f5e; font-size: 11px;">Errore API mappe</div>';
                });
        }, 600);
    }

    function selectMissionAddress(address) {
        document.getElementById('mission-target-address').value = address;
        document.getElementById('mission-search-results').style.display = 'none';
    }

    function openWaLink() {
        if (!selectedWorker) return;
        
        const resources = JSON.parse(localStorage.getItem('ares_resources') || "{}");
        let phone = "";
        
        if (resources.persone) {
            const persona = resources.persone.find(p => p.nome.toLowerCase().includes(selectedWorker.username.toLowerCase()) || selectedWorker.username.toLowerCase().includes(p.nome.toLowerCase()));
            if (persona) {
                phone = persona.telefono || "";
            }
        }
        
        if (!phone) {
            if (selectedWorker.username.toLowerCase() === 'massimo') phone = "393331234567";
            else if (selectedWorker.username.toLowerCase() === 'roberto') phone = "393347654321";
            else phone = "393339999999";
        }

        const msg = encodeURIComponent(`Centrale Operativa ARES: Ciao ${selectedWorker.username}, ti vedo posizionato sul GIS. Come procedono le lavorazioni?`);
        window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
    }

    function openCallLink() {
        if (!selectedWorker) return;
        let phone = selectedWorker.username.toLowerCase() === 'massimo' ? "3331234567" : "3347654321";
        window.open(`tel:${phone}`);
    }

    function openVideoLink() {
        if (!selectedWorker) return;
        let phone = selectedWorker.username.toLowerCase() === 'massimo' ? "3331234567" : "3347654321";
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS) {
            window.open(`facetime:${phone}`);
        } else {
            window.open(`https://wa.me/${phone}`);
        }
    }

    function captureMapScreenshot() {
        const mapContainer = document.getElementById('gis-map');
        if (!mapContainer) return;

        // Effetto Flash Visivo dello scatto
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100vw';
        flash.style.height = '100vh';
        flash.style.background = '#fff';
        flash.style.zIndex = '99999';
        flash.style.opacity = '1';
        flash.style.transition = 'opacity 0.4s ease-out';
        document.body.appendChild(flash);
        
        setTimeout(() => {
            flash.style.opacity = '0';
            setTimeout(() => { flash.remove(); }, 400);
        }, 50);

        // Nascondi temporaneamente i controlli UI della mappa per lo scatto pulito
        const captureBtn = mapContainer.querySelector('button');
        if (captureBtn) captureBtn.style.visibility = 'hidden';
        const controls = mapContainer.querySelector('.leaflet-control-container');
        if (controls) controls.style.visibility = 'hidden';

        // Avvia la cattura del DOM tramite html2canvas con supporto CORS
        html2canvas(mapContainer, {
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#0c0d12'
        }).then(mapCanvas => {
            // Ripristina i controlli UI sulla mappa
            if (captureBtn) captureBtn.style.visibility = 'visible';
            if (controls) controls.style.visibility = 'visible';

            // Crea il canvas finale del Report/Rilievo Operativo
            const canvas = document.createElement('canvas');
            canvas.width = 800;
            canvas.height = 600;
            const ctx = canvas.getContext('2d');

            // Sfondo scuro premium
            ctx.fillStyle = "#0c0d12";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Grid decorativo hi-tech sullo sfondo (stile radar)
            ctx.strokeStyle = "rgba(99, 102, 241, 0.05)";
            ctx.lineWidth = 1;
            for (let x = 0; x < canvas.width; x += 40) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
            }
            for (let y = 0; y < canvas.height; y += 40) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
            }

            // Intestazioni
            ctx.fillStyle = "#818cf8";
            ctx.font = "bold 15px Outfit, Arial";
            ctx.fillText("ARES ERP - CENTRALE OPERATIVA E GIS", 30, 45);
            
            ctx.fillStyle = "#ffffff";
            ctx.font = "900 22px Outfit, Arial";
            ctx.fillText("RILIEVO FOTOGRAFICO & GEOLOCALIZZAZIONE LIVE", 30, 75);

            // Box Informazioni Operatore/Cantiere
            ctx.fillStyle = "rgba(255,255,255,0.03)";
            ctx.fillRect(30, 95, 740, 85);
            ctx.strokeStyle = "rgba(255,255,255,0.08)";
            ctx.lineWidth = 1;
            ctx.strokeRect(30, 95, 740, 85);

            ctx.fillStyle = "#a5b4fc";
            ctx.font = "bold 11px Outfit, Arial";
            ctx.fillText("OPERATORE RILEVATO:", 50, 125);
            ctx.fillText("COORDINATE GPS:", 310, 125);
            ctx.fillText("DATA & ORA ACQUISIZIONE:", 560, 125);

            const name = selectedWorker ? selectedWorker.username : "TUTTO LO STAFF";
            const coords = selectedWorker ? `${parseFloat(selectedWorker.latitude).toFixed(5)}, ${parseFloat(selectedWorker.longitude).toFixed(5)}` : "CENTRO DI COMANDO ROMA";
            const timestamp = new Date().toLocaleString('it-IT');

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 15px Outfit, Arial";
            ctx.fillText(name, 50, 155);
            ctx.fillText(coords, 310, 155);
            ctx.fillText(timestamp, 560, 155);

            // Disegna lo screenshot reale della mappa (mapCanvas) nella sezione centrale
            ctx.drawImage(mapCanvas, 30, 200, 740, 340);

            // Bordo azzurrato premium attorno allo screenshot della mappa
            ctx.strokeStyle = "rgba(99, 102, 241, 0.35)";
            ctx.lineWidth = 2;
            ctx.strokeRect(30, 200, 740, 340);

            // Footer
            ctx.fillStyle = "#64748b";
            ctx.font = "10px monospace";
            ctx.fillText("ARES OPERATIVE ROOM // SECURE LAYER IPV4 // LATENCY: 24ms // SUPABASE ACTIVE SYNC", 30, 575);

            // Trigger del download automatico dell'immagine
            const dataUrl = canvas.toDataURL("image/png");
            const link = document.createElement('a');
            link.download = `rilievo_cantiere_${name.replace(" ", "_")}.png`;
            link.href = dataUrl;
            link.click();
        }).catch(err => {
            console.error("Errore durante la cattura dello screenshot della mappa:", err);
            // Ripristina i controlli anche in caso di errore
            if (captureBtn) captureBtn.style.visibility = 'visible';
            if (controls) controls.style.visibility = 'visible';
        });
    }

    // ----------------------------------------------------
    // FUNZIONI DI GESTIONE UTENTI (SUPER ADMIN VIEW)
    // ----------------------------------------------------
    function renderUsers() {
        const listBody = document.getElementById('utenti-list-body');
        if (!listBody) return;
        
        listBody.innerHTML = "";
        
        const totalSpan = document.getElementById('kpi-users-total');
        const adminsSpan = document.getElementById('kpi-users-admins');
        const standardSpan = document.getElementById('kpi-users-standard');
        
        let total = usersList.length;
        let admins = usersList.filter(u => u.role === 'super_admin').length;
        let standard = total - admins;
        
        if (totalSpan) totalSpan.innerText = total;
        if (adminsSpan) adminsSpan.innerText = admins;
        if (standardSpan) standardSpan.innerText = standard;
        
        usersList.forEach(u => {
            const isSuper = u.role === 'super_admin';
            const roleBadge = isSuper 
                ? `<span class="crm-status status-scheduled" style="background:rgba(99, 102, 241, 0.15); color:#818cf8; border-color:rgba(99,102,241,0.25);">👑 Super Admin</span>`
                : `<span class="crm-status status-prospect" style="background:rgba(148, 163, 184, 0.1); color:#94a3b8; border-color:rgba(148, 163, 184, 0.2);">👤 Standard User</span>`;
            
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(255,255,255,0.04)';
            tr.innerHTML = `
                <td style="padding:12px 8px; color: #94a3b8; font-weight: 600;">#${u.id}</td>
                <td style="padding:12px 8px; font-weight: 700; color:#fff;">${u.username}</td>
                <td style="padding:12px 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="password" id="pw-field-${u.id}" value="${u.password}" readonly style="background:transparent; border:none; color:#cbd5e1; font-family: inherit; font-size:13px; width: 120px; outline:none; padding:0;">
                        <button onclick="togglePasswordVisibility(${u.id})" style="background: transparent; border: none; color: #818cf8; font-size: 11px; cursor: pointer; padding: 2px 6px; font-weight:600;">👁️ Mostra</button>
                    </div>
                </td>
                <td style="padding:12px 8px;">${roleBadge}</td>
                <td style="padding:12px 8px; text-align:right;">
                    <div style="display:flex; gap:6px; justify-content:flex-end;">
                        <button class="btn-delete-appt" onclick="editUser(${u.id})" style="color: #818cf8; background: rgba(99, 102, 241, 0.1); padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight:600;">✏️ Modifica</button>
                        <button class="btn-delete-appt" onclick="deleteUser(${u.id})" style="color: #f43f5e; background: rgba(244, 63, 94, 0.1); padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight:600;">✖ Elimina</button>
                    </div>
                </td>
            `;
            listBody.appendChild(tr);
        });
    }

    function togglePasswordVisibility(userId) {
        const field = document.getElementById(`pw-field-${userId}`);
        const btn = event.target;
        if (!field || !btn) return;
        
        if (field.type === 'password') {
            field.type = 'text';
            btn.innerText = '🙈 Nascondi';
        } else {
            field.type = 'password';
            btn.innerText = '👁️ Mostra';
        }
    }

    function editUser(userId) {
        const user = usersList.find(u => u.id === userId);
        if (!user) return;
        
        document.getElementById('user-edit-id').value = user.id;
        document.getElementById('u-username').value = user.username;
        document.getElementById('u-password').value = user.password;
        document.getElementById('u-role').value = user.role;
        
        document.getElementById('form-user-title').innerText = `✏️ Modifica Utente #${user.id}`;
        document.getElementById('btn-cancel-user-edit').style.display = 'inline-block';
        document.getElementById('form-user-title').scrollIntoView({ behavior: 'smooth' });
    }

    function resetUserForm() {
        document.getElementById('user-edit-id').value = "";
        document.getElementById('u-username').value = "";
        document.getElementById('u-password').value = "";
        document.getElementById('u-role').value = "user";
        
        document.getElementById('form-user-title').innerText = `👤 Nuovo Utente / Modifica Password`;
        document.getElementById('btn-cancel-user-edit').style.display = 'none';
    }

    async function saveUser() {
        const editId = document.getElementById('user-edit-id').value;
        const username = document.getElementById('u-username').value.trim();
        const password = document.getElementById('u-password').value.trim();
        const role = document.getElementById('u-role').value;
        
        if (!username || !password) {
            alert("Nome Utente e Password sono obbligatori!");
            return;
        }
        
        let targetId = editId ? Number(editId) : Date.now();
        
        if (!editId) {
            const dup = usersList.find(u => u.username.toLowerCase() === username.toLowerCase());
            if (dup) {
                alert("Questo Nome Utente è già esistente!");
                return;
            }
        }
        
        const userObj = {
            id: targetId,
            username: username,
            password: password,
            role: role
        };
        
        if (editId) {
            usersList = usersList.map(u => u.id === targetId ? userObj : u);
        } else {
            usersList.push(userObj);
        }
        
        localStorage.setItem('ares_local_users', JSON.stringify(usersList));
        
        if (supabaseClient) {
            try {
                const { error } = await supabaseClient.from('ares_users').upsert(userObj);
                if (error) throw error;
            } catch (err) {
                console.error("Impossibile salvare utente su Supabase:", err);
            }
        }
        
        resetUserForm();
        renderUsers();
        alert("Utente salvato correttamente!");
    }

    async function deleteUser(userId) {
        const currentUser = getLoggedUser();
        if (currentUser && currentUser.id === userId) {
            alert("Non puoi eliminare l'utente con cui sei attualmente connesso!");
            return;
        }
        
        if (!confirm("Sei sicuro di voler eliminare questo utente? L'accesso gli verrà negato immediatamente.")) return;
        
        usersList = usersList.filter(u => u.id !== userId);
        localStorage.setItem('ares_local_users', JSON.stringify(usersList));
        
        if (supabaseClient) {
            try {
                const { error } = await supabaseClient.from('ares_users').delete().eq('id', userId);
                if (error) throw error;
            } catch (err) {
                console.error("Errore eliminazione utente da Supabase:", err);
            }
        }
        
        renderUsers();
        alert("Utente eliminato correttamente!");
    }

    // DETTAGLIO FESTIVITA ITALIANE E PASQUA
    function getEaster(year) {
        let a = year % 19;
        let b = Math.floor(year / 100);
        let c = year % 100;
        let d = Math.floor(b / 4);
        let e = b % 4;
        let f = Math.floor((b + 8) / 25);
        let g = Math.floor((b - f + 1) / 3);
        let h = (19 * a + b - d - g + 15) % 30;
        let i = Math.floor(c / 4);
        let k = c % 4;
        let L = (32 + 2 * e + 2 * i - h - k) % 7;
        let m = Math.floor((a + 11 * h + 22 * L) / 451);
        let month = Math.floor((h + L - 7 * m + 114) / 31);
        let day = ((h + L - 7 * m + 114) % 31) + 1;
        return new Date(year, month - 1, day);
    }

    function getItalianHoliday(date) {
        const y = date.getFullYear();
        const m = date.getMonth() + 1;
        const d = date.getDate();
        
        // Date Fisse Italiane
        if (m === 1 && d === 1) return "Capodanno";
        if (m === 1 && d === 6) return "Epifania";
        if (m === 4 && d === 25) return "Liberazione";
        if (m === 5 && d === 1) return "Festa del Lavoro";
        if (m === 6 && d === 2) return "Festa della Repubblica";
        if (m === 8 && d === 15) return "Ferragosto";
        if (m === 11 && d === 1) return "Tutti i Santi";
        if (m === 12 && d === 8) return "Immacolata";
        if (m === 12 && d === 25) return "Natale";
        if (m === 12 && d === 26) return "Santo Stefano";
        
        // Pasqua e Pasquetta dinamiche
        const easter = getEaster(y);
        const pasquetta = new Date(easter);
        pasquetta.setDate(easter.getDate() + 1);
        
        if (m === (easter.getMonth() + 1) && d === easter.getDate()) return "Pasqua";
        if (m === (pasquetta.getMonth() + 1) && d === pasquetta.getDate()) return "Lunedì dell'Angelo";
        
        return null;
    }

    // AGENDA VISIVA (2 SETTIMANE REVAMPED)
    async function addNote(dateKey) {
        let txtInput = document.getElementById(`in_${dateKey}`);
        let timeInput = document.getElementById(`time_${dateKey}`);
        let impCheck = document.getElementById(`imp_${dateKey}`);
        
        if(!txtInput.value.trim()) { alert("Inserisci il testo della nota!"); return; }
        
        let timeVal = timeInput.value || "09:00";
        let isImportant = impCheck ? impCheck.checked : false;
        
        const noteId = Date.now();
        const txtTrimmed = txtInput.value.trim();
        
        let notes = JSON.parse(localStorage.getItem(`note_${dateKey}`) || "[]");
        notes.push({
            id: noteId, 
            txt: txtTrimmed, 
            time: timeVal,
            important: isImportant
        });
        localStorage.setItem(`note_${dateKey}`, JSON.stringify(notes));
        
        txtInput.value = "";
        if (impCheck) impCheck.checked = false;
        
        renderAllCalendars();
        refreshDashboard();
        
        // Sincronizzazione in Cloud
        if (supabaseClient) {
            try {
                const { error } = await supabaseClient.from('ares_planning').insert({
                    id: noteId,
                    data_scadenza: dateKey + 'T' + timeVal,
                    descrizione: 'NOTE:' + txtTrimmed,
                    importante: isImportant
                });
                if (error) throw error;
            } catch (err) {
                console.error("Errore salvataggio nota su Cloud:", err);
            }
        }
    }

    async function deleteNote(dateKey, id) {
        let notes = JSON.parse(localStorage.getItem(`note_${dateKey}`) || "[]");
        notes = notes.filter(n => n.id !== id);
        localStorage.setItem(`note_${dateKey}`, JSON.stringify(notes));
        renderAllCalendars();
        refreshDashboard();
        
        // Cancellazione in Cloud
        if (supabaseClient) {
            try {
                const { error } = await supabaseClient.from('ares_planning').delete().eq('id', id);
                if (error) throw error;
            } catch (err) {
                console.error("Errore eliminazione nota su Cloud:", err);
            }
        }
    }

    // FUNZIONI DI GESTIONE DEL MODAL PLANNING (MODIFICA / ELIMINAZIONE)
    function openPlanningModal(dateKey, appt) {
        const modal = document.getElementById('planning-modal');
        if (!modal) return;

        document.getElementById('modal-appt-id').value = appt.id;
        document.getElementById('modal-appt-date').value = dateKey;
        document.getElementById('modal-appt-type').value = appt.type;
        document.getElementById('modal-appt-time').value = appt.time;
        document.getElementById('modal-appt-txt').value = appt.txt;
        document.getElementById('modal-appt-important').checked = !!appt.important;

        const warning = document.getElementById('modal-appt-warning');
        const txtInput = document.getElementById('modal-appt-txt');
        const timeInput = document.getElementById('modal-appt-time');
        const impInput = document.getElementById('modal-appt-important');
        const saveBtn = document.getElementById('btn-modal-save');
        const deleteBtn = document.getElementById('btn-modal-delete');

        if (appt.type === 'crm') {
            warning.style.display = 'block';
            txtInput.disabled = true;
            timeInput.disabled = true;
            impInput.disabled = true;
            saveBtn.style.display = 'none';
            deleteBtn.style.display = 'none';
        } else {
            warning.style.display = 'none';
            txtInput.disabled = false;
            timeInput.disabled = false;
            impInput.disabled = false;
            saveBtn.style.display = 'block';
            deleteBtn.style.display = 'block';
        }

        modal.style.display = 'flex';
    }

    function closePlanningModal() {
        const modal = document.getElementById('planning-modal');
        if (modal) modal.style.display = 'none';
    }

    async function saveNoteFromModal() {
        const id = Number(document.getElementById('modal-appt-id').value);
        const dateKey = document.getElementById('modal-appt-date').value;
        const time = document.getElementById('modal-appt-time').value;
        const txt = document.getElementById('modal-appt-txt').value.trim();
        const important = document.getElementById('modal-appt-important').checked;

        if (!time || !txt) {
            alert("Orario e descrizione sono obbligatori!");
            return;
        }

        // 1. Aggiorna in localStorage locale
        let notes = JSON.parse(localStorage.getItem(`note_${dateKey}`) || "[]");
        let idx = notes.findIndex(n => n.id === id);
        if (idx !== -1) {
            notes[idx].time = time;
            notes[idx].txt = txt;
            notes[idx].important = important;
            localStorage.setItem(`note_${dateKey}`, JSON.stringify(notes));
        }

        // 2. Sincronizza in Supabase Cloud
        if (supabaseClient) {
            try {
                const { error } = await supabaseClient.from('ares_planning').upsert({
                    id: id,
                    data_scadenza: dateKey + 'T' + time,
                    descrizione: 'NOTE:' + txt,
                    importante: important
                }, { onConflict: 'id' });
                
                if (error) throw error;
            } catch (err) {
                console.error("Errore sincronizzazione modifica nota in Cloud:", err);
            }
        }

        closePlanningModal();
        renderAllCalendars();
        refreshDashboard();
    }

    async function deleteNoteFromModal() {
        const id = Number(document.getElementById('modal-appt-id').value);
        const dateKey = document.getElementById('modal-appt-date').value;
        
        if (confirm("Sei sicuro di voler eliminare questo appuntamento?")) {
            closePlanningModal();
            await deleteNote(dateKey, id);
        }
    }

    async function toggleCriticalDay(dateKey, btn) {
        let isCritical = localStorage.getItem(`critical_day_${dateKey}`) === 'true';
        isCritical = !isCritical;
        localStorage.setItem(`critical_day_${dateKey}`, isCritical);
        renderAllCalendars();
        refreshDashboard();
        
        // Sincronizzazione in Cloud
        if (supabaseClient) {
            try {
                let hash = 0;
                for (let j = 0; j < dateKey.length; j++) {
                    hash = dateKey.charCodeAt(j) + ((hash << 5) - hash);
                }
                const criticalId = Math.abs(hash);
                
                if (isCritical) {
                    const { error } = await supabaseClient.from('ares_planning').insert({
                        id: criticalId,
                        data_scadenza: dateKey,
                        descrizione: 'CRITICAL',
                        importante: true
                    });
                    if (error) throw error;
                } else {
                    const { error } = await supabaseClient.from('ares_planning').delete().eq('id', criticalId);
                    if (error) throw error;
                }
            } catch (err) {
                console.error("Errore salvataggio giorno critico su Cloud:", err);
            }
        }
    }

    let planningWeekOffset = 0;

    function navigatePlanning(weeks) {
        planningWeekOffset += weeks;
        renderAllCalendars();
    }

    function resetPlanningNavigation() {
        planningWeekOffset = 0;
        renderAllCalendars();
    }

    function renderAllCalendars() {
        const currentOffset = planningWeekOffset * 7;
        const nextOffset = (planningWeekOffset * 7) + 7;
        
        buildWeek('cal-current', currentOffset);
        buildWeek('cal-next', nextOffset);
        
        updatePlanningRangeText();
        
        // Aggiorna le scritte delle testate dei due blocchi settimanali
        const t1 = document.getElementById('planning-week-title-1');
        const t2 = document.getElementById('planning-week-title-2');
        if (t1 && t2) {
            if (planningWeekOffset === 0) {
                t1.innerHTML = `📅 Settimana Corrente <span class="badge">In Corso</span>`;
                t2.innerHTML = `📅 Settimana Prossima <span class="badge" style="background:rgba(245, 158, 11, 0.1); color:#f59e0b; border-color:rgba(245, 158, 11, 0.2);">Pianificazione</span>`;
            } else if (planningWeekOffset > 0) {
                t1.innerHTML = `📅 Settimana Futura (+${planningWeekOffset}) <span class="badge" style="background:rgba(99, 102, 241, 0.15); color:#818cf8; border-color:rgba(99,102,241,0.2);">Consultazione</span>`;
                t2.innerHTML = `📅 Settimana Futura (+${planningWeekOffset + 1}) <span class="badge" style="background:rgba(245, 158, 11, 0.15); color:#f59e0b; border-color:rgba(245, 158, 11, 0.25);">Pianificazione</span>`;
            } else {
                t1.innerHTML = `📅 Settimana Passata (${planningWeekOffset}) <span class="badge" style="background:rgba(148, 163, 184, 0.15); color:#94a3b8; border-color:rgba(148, 163, 184, 0.2);">Storico</span>`;
                t2.innerHTML = `📅 Settimana Passata (${planningWeekOffset + 1 >= 0 ? '+' + (planningWeekOffset + 1) : planningWeekOffset + 1}) <span class="badge" style="background:rgba(148, 163, 184, 0.15); color:#94a3b8; border-color:rgba(148, 163, 184, 0.25);">${planningWeekOffset + 1 === 0 ? 'In Corso' : 'Storico'}</span>`;
            }
        }
    }

    function updatePlanningRangeText() {
        const rangeEl = document.getElementById('planning-current-range');
        if (!rangeEl) return;

        // Calcola il lunedì della prima settimana correntemente visualizzata
        let d = new Date();
        let day = d.getDay();
        let diff = d.getDate() - day + (day == 0 ? -6 : 1);
        d.setDate(diff + (planningWeekOffset * 7));

        const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
        const currentMonth = months[d.getMonth()];
        const currentYear = d.getFullYear();

        // Calcola il mese/anno della fine del blocco bisettimanale (13 giorni dopo)
        let dEnd = new Date(d);
        dEnd.setDate(dEnd.getDate() + 13);
        const endMonth = months[dEnd.getMonth()];
        const endYear = dEnd.getFullYear();

        let label = "";
        if (currentMonth === endMonth && currentYear === endYear) {
            label = `${currentMonth} ${currentYear}`;
        } else {
            label = `${currentMonth} ${currentYear} / ${endMonth} ${endYear}`;
        }

        if (planningWeekOffset === 0) {
            rangeEl.innerHTML = `📆 Periodo: ${label} <span style="background: rgba(99,102,241,0.2); color:#818cf8; padding: 2px 6px; border-radius:4px; margin-left: 6px; font-size: 10px;">OGGI</span>`;
        } else {
            const direction = planningWeekOffset > 0 ? `+${planningWeekOffset} sett.` : `${planningWeekOffset} sett.`;
            rangeEl.innerHTML = `📆 Periodo: ${label} <span style="background: rgba(245,158,11,0.2); color:#f59e0b; padding: 2px 6px; border-radius:4px; margin-left: 6px; font-size: 10px;">${direction}</span>`;
        }
    }

    // GESTIONE ZOOM GIORNALIERO DEL PLANNING (GIGANTE & LEGGIBILE)
    let currentZoomDateKey = "";

    function openPlanningDayZoomModal(dateKey) {
        currentZoomDateKey = dateKey;
        const modal = document.getElementById('planning-day-zoom-modal');
        const titleEl = document.getElementById('zoom-day-title');
        const badgeEl = document.getElementById('zoom-day-status-badge');
        const listCont = document.getElementById('zoom-appointments-list');
        if (!modal || !titleEl || !listCont) return;

        // Resetta gli input nel form gigante
        document.getElementById('zoom-add-txt').value = "";
        document.getElementById('zoom-add-imp').checked = false;
        document.getElementById('zoom-add-time').value = "09:00";

        // Costruisci data leggibile in Italiano
        const dateObj = new Date(dateKey + "T00:00:00");
        const daysOfWeek = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
        const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
        titleEl.innerText = `${daysOfWeek[dateObj.getDay()]} ${dateObj.getDate()} ${months[dateObj.getMonth()]}`;

        const holidayName = getItalianHoliday(dateObj);
        const isSunday = (dateObj.getDay() === 0);
        const isCritical = localStorage.getItem(`critical_day_${dateKey}`) === 'true';

        let statusText = "Giornata Standard";
        badgeEl.style.color = "#a5b4fc";
        if (isCritical) {
            statusText = "🔴 GIORNATA CRITICA / URGENTE";
            badgeEl.style.color = "#f87171";
        } else if (holidayName) {
            statusText = `🎉 FESTIVITÀ: ${holidayName.toUpperCase()}`;
            badgeEl.style.color = "#34d399";
        } else if (isSunday) {
            statusText = "🎉 DOMENICA - RIPOSO SETTIMANALE";
            badgeEl.style.color = "#60a5fa";
        }
        badgeEl.innerText = statusText;

        // Renderizza la lista ingrandita di appuntamenti
        renderZoomAppointments();

        modal.style.display = 'flex';
    }

    function renderZoomAppointments() {
        const listCont = document.getElementById('zoom-appointments-list');
        if (!listCont || !currentZoomDateKey) return;
        listCont.innerHTML = "";

        const crmData = JSON.parse(localStorage.getItem('crm_inputs') || "{}");
        const notes = JSON.parse(localStorage.getItem(`note_${currentZoomDateKey}`) || "[]");
        const combinedAppts = [];

        // Note manuali
        notes.forEach(n => {
            combinedAppts.push({
                id: n.id,
                time: n.time || "09:00",
                txt: n.txt || "",
                important: !!n.important,
                type: 'manual'
            });
        });

        // Appuntamenti da CRM
        for (let contactName in crmData) {
            let appt = crmData[contactName];
            if (appt.date && appt.date.split('T')[0] === currentZoomDateKey) {
                let time = appt.date.split('T')[1] || "09:00";
                combinedAppts.push({
                    id: 'crm_' + contactName,
                    time: time,
                    txt: `📞 CRM: Contatto Commerciale per ${contactName}`,
                    important: false,
                    type: 'crm'
                });
            }
        }

        combinedAppts.sort((a,b) => a.time.localeCompare(b.time));

        if (combinedAppts.length === 0) {
            listCont.innerHTML = `
                <div style="text-align: center; color: #94a3b8; font-size: 18px; padding: 40px; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.06);">
                    📭 Nessuna attività programmata per questo giorno.
                </div>`;
            return;
        }

        combinedAppts.forEach(n => {
            const div = document.createElement('div');
            div.style.background = 'rgba(30, 32, 50, 0.6)';
            div.style.border = '1px solid rgba(255, 255, 255, 0.08)';
            div.style.borderRadius = '12px';
            div.style.padding = '18px 24px';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            div.style.boxShadow = '0 4px 15px rgba(0,0,0,0.15)';

            if (n.important) {
                div.style.borderLeft = '6px solid #ef4444';
                div.style.background = 'rgba(239, 68, 68, 0.06)';
            } else if (n.type === 'crm') {
                div.style.borderLeft = '6px solid #3b82f6';
                div.style.background = 'rgba(59, 130, 246, 0.06)';
            } else {
                div.style.borderLeft = '6px solid #818cf8';
            }

            let deleteBtn = '';
            if (n.type === 'manual') {
                deleteBtn = `<button class="btn-delete-appt" title="Elimina" onclick="deleteNoteFromZoom(${n.id})" style="padding: 10px 18px; font-size: 14px; font-weight: 700; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.25); color: #f87171; border-radius: 8px; cursor: pointer; transition: all 0.2s;">Elimina ✖</button>`;
            } else {
                deleteBtn = `<span style="font-size: 12px; font-weight: bold; color: #60a5fa; background: rgba(59, 130, 246, 0.15); padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.25);">Sincronizzato CRM 📞</span>`;
            }

            div.innerHTML = `
                <div style="display: flex; align-items: center; gap: 20px;">
                    <span style="font-size: 22px; font-weight: 800; color: #a5b4fc; background: rgba(255,255,255,0.05); padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); font-family: monospace;">${n.time}</span>
                    <span style="font-size: 19px; font-weight: 600; color: #f1f5f9; ${n.important ? 'color: #fca5a5;' : ''}">${n.txt}</span>
                </div>
                ${deleteBtn}
            `;
            listCont.appendChild(div);
        });
    }

    function closePlanningDayZoomModal() {
        const modal = document.getElementById('planning-day-zoom-modal');
        if (modal) modal.style.display = 'none';
        currentZoomDateKey = "";
    }

    async function addNoteFromZoom() {
        if (!currentZoomDateKey) return;
        const txtInput = document.getElementById('zoom-add-txt');
        const timeInput = document.getElementById('zoom-add-time');
        const impInput = document.getElementById('zoom-add-imp');

        const txt = txtInput.value.trim();
        const time = timeInput.value || "09:00";
        const important = impInput.checked;

        if (!txt) return;

        let notes = JSON.parse(localStorage.getItem(`note_${currentZoomDateKey}`) || "[]");
        const noteId = Date.now();
        notes.push({
            id: noteId,
            txt: txt,
            time: time,
            important: important
        });
        localStorage.setItem(`note_${currentZoomDateKey}`, JSON.stringify(notes));

        renderZoomAppointments();
        renderAllCalendars();
        refreshDashboard();

        txtInput.value = "";
        impInput.checked = false;

        if (supabaseClient) {
            try {
                const fullDateTime = currentZoomDateKey + 'T' + time + ':00';
                const { error } = await supabaseClient.from('ares_planning').insert({
                    id: noteId,
                    data_scadenza: fullDateTime,
                    descrizione: 'NOTE:' + txt,
                    importante: important
                });
                if (error) throw error;
            } catch (err) {
                console.error("Errore sincronizzazione nota da Zoom:", err);
            }
        }
    }

    async function deleteNoteFromZoom(noteId) {
        if (!currentZoomDateKey) return;
        
        let notes = JSON.parse(localStorage.getItem(`note_${currentZoomDateKey}`) || "[]");
        notes = notes.filter(n => n.id !== noteId);
        localStorage.setItem(`note_${currentZoomDateKey}`, JSON.stringify(notes));

        renderZoomAppointments();
        renderAllCalendars();
        refreshDashboard();

        if (supabaseClient) {
            try {
                const { error } = await supabaseClient.from('ares_planning').delete().eq('id', noteId);
                if (error) throw error;
            } catch (err) {
                console.error("Errore eliminazione nota da Zoom:", err);
            }
        }
    }

    function buildWeek(id, offsetDays) {
        const cont = document.getElementById(id); 
        if(!cont) return;
        cont.innerHTML = "";
        
        let d = new Date();
        let day = d.getDay(); 
        let diff = d.getDate() - day + (day == 0 ? -6 : 1);
        d.setDate(diff + offsetDays);
        
        const crmData = JSON.parse(localStorage.getItem('crm_inputs') || "{}");
        
        for(let i=0; i<7; i++) {
            let dateKey = d.toISOString().split('T')[0];
            
            // Rileva se il giorno in esame è la data corrente (Oggi)
            let todayStr = new Date().toISOString().split('T')[0];
            let isToday = (dateKey === todayStr);
            
            // Verifica festività e weekend
            let holidayName = getItalianHoliday(d);
            let isSunday = (d.getDay() === 0);
            let isSaturday = (d.getDay() === 6);
            let isHoliday = !!holidayName;
            
            // Carica stato giornata critica
            let isCritical = localStorage.getItem(`critical_day_${dateKey}`) === 'true';
            
            // Crea cella giorno
            let cell = document.createElement('div');
            cell.className = 'day-cell';
            if (isToday) cell.classList.add('today-day-cell');
            else if (isCritical) cell.classList.add('critical-day-cell');
            else if (isSunday) cell.classList.add('sunday-cell');
            else if (isHoliday) cell.classList.add('holiday-cell');
            
            let badgeHtml = '';
            if (isToday) {
                badgeHtml = `<span class="cell-badge badge-today">🛰️ OGGI (CORRENTE)</span>`;
            } else if (isCritical) {
                badgeHtml = `<span class="cell-badge badge-critical">⚠️ CRITICO</span>`;
            } else if (holidayName) {
                badgeHtml = `<span class="cell-badge badge-holiday">🎉 ${holidayName.toUpperCase()}</span>`;
            } else if (isSunday) {
                badgeHtml = `<span class="cell-badge badge-holiday">🎉 DOMENICA</span>`;
            }
            
            cell.innerHTML = `
                <div class="day-title-row" style="user-select: none;">
                    <div class="day-title-info">
                        <span class="day-name">${days[d.getDay()]}</span>
                        <span class="day-date">${d.getDate()}/${d.getMonth()+1}</span>
                    </div>
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <button class="btn-toggle-critical" style="background: rgba(99, 102, 241, 0.15); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.25); border-radius: 6px; padding: 4px 8px; font-size: 11px; cursor: pointer; transition: all 0.2s; font-weight: 700; display: flex; align-items: center; gap: 4px;" title="Ingrandisci Giorno (Visuale Leggibile 50%)" onclick="openPlanningDayZoomModal('${dateKey}')">🔍 Zoom</button>
                        <button class="btn-toggle-critical ${isCritical ? 'active' : ''}" 
                                title="Segna come giornata critica/urgente"
                                onclick="toggleCriticalDay('${dateKey}', this)">🔴</button>
                    </div>
                </div>
                ${badgeHtml}
                <div id="list_${dateKey}" class="day-appointments-list"></div>
                <div class="cell-add-form">
                    <div class="cell-form-inputs">
                        <input type="time" id="time_${dateKey}" value="09:00">
                        <input type="text" id="in_${dateKey}" placeholder="Nota...">
                    </div>
                    <div class="cell-form-controls">
                        <label class="chk-important-label">
                            <input type="checkbox" id="imp_${dateKey}"> 🔴 Imp.
                        </label>
                        <button class="btn-add-appt" onclick="addNote('${dateKey}')">+</button>
                    </div>
                </div>
            `;
            
            cont.appendChild(cell);
            
            // Recupera note manuali
            let notes = JSON.parse(localStorage.getItem(`note_${dateKey}`) || "[]");
            let combinedAppts = [];
            
            // Aggiunge note manuali
            notes.forEach(n => {
                combinedAppts.push({
                    id: n.id,
                    time: n.time || "09:00",
                    txt: n.txt || "",
                    important: !!n.important,
                    type: 'manual'
                });
            });
            
            // Cerca ed aggiunge appuntamenti dal CRM
            for (let contactName in crmData) {
                let appt = crmData[contactName];
                if (appt.date && appt.date.split('T')[0] === dateKey) {
                    let time = appt.date.split('T')[1] || "09:00";
                    combinedAppts.push({
                        id: 'crm_' + contactName,
                        time: time,
                        txt: `📞 ${contactName}`,
                        important: false,
                        type: 'crm'
                    });
                }
            }
            
            // Ordina cronologicamente per orario
            combinedAppts.sort((a,b) => a.time.localeCompare(b.time));
            
            let listCont = cell.querySelector(`#list_${dateKey}`);
            combinedAppts.forEach(n => {
                let div = document.createElement('div');
                div.className = 'appt-item';
                if (n.important) div.classList.add('appt-important');
                if (n.type === 'crm') div.classList.add('appt-crm');
                
                // Cursore pointer per far capire che l'elemento è interattivo ed apre i dettagli
                div.style.cursor = 'pointer';
                div.title = "Clicca per visualizzare, modificare o eliminare";
                
                div.addEventListener('click', (event) => {
                    // Evita che il clic sul pulsante elimina interferisca con il modal
                    if (event.target.classList.contains('btn-delete-appt') || event.target.tagName === 'BUTTON') {
                        return;
                    }
                    openPlanningModal(dateKey, n);
                });
                
                let deleteBtn = '';
                if (n.type === 'manual') {
                    deleteBtn = `<button class="btn-delete-appt" title="Elimina" onclick="deleteNote('${dateKey}', ${n.id})">✖</button>`;
                } else {
                    deleteBtn = `<span style="font-size: 10px; opacity: 0.6; cursor: help;" title="Sincronizzato dal CRM">📞</span>`;
                }
                
                div.innerHTML = `
                    <span class="appt-text">
                        <span class="appt-time">${n.time}</span>
                        <span>${n.txt}</span>
                    </span>
                    ${deleteBtn}
                `;
                listCont.appendChild(div);
            });
            
            d.setDate(d.getDate() + 1);
        }
    }

    // LISTA ATTIVITA
    async function addPlanningEvent() {
        let date = document.getElementById('new-date').value;
        let desc = document.getElementById('new-desc').value;
        if(!date || !desc) return;
        
        const eventId = Date.now();
        const descTrimmed = desc.trim();
        
        let events = JSON.parse(localStorage.getItem('planning_events') || "[]");
        events.push({id: eventId, date: date, desc: descTrimmed});
        localStorage.setItem('planning_events', JSON.stringify(events));
        renderPlanning();
        refreshDashboard();
        
        // Sincronizzazione in Cloud
        if (supabaseClient) {
            try {
                const { error } = await supabaseClient.from('ares_planning').insert({
                    id: eventId,
                    data_scadenza: date,
                    descrizione: 'PLAN:' + descTrimmed,
                    importante: false
                });
                if (error) throw error;
            } catch (err) {
                console.error("Errore salvataggio planning su Cloud:", err);
            }
        }
    }

    function renderPlanning() {
        const list = document.getElementById('planning-list'); 
        if(!list) return;
        list.innerHTML = "";
        JSON.parse(localStorage.getItem('planning_events') || "[]").forEach(e => {
            let formattedDate = e.date.replace('T', ' ');
            list.innerHTML += `
                <div class="item-card" style="border-left-color: #818cf8; padding: 12px 16px; border-radius:10px;">
                    <div style="display:flex; flex-direction:column; gap:4px; flex:1;">
                        <span style="font-size: 10px; color: #94a3b8; font-weight:700;">🕒 ${formattedDate}</span>
                        <b style="color:#fff; font-size:13px;">${e.desc}</b>
                    </div>
                    <button class="btn-delete-appt" onclick="delEvent(${e.id})" style="padding: 6px 10px; font-size:11px;">✖</button>
                </div>`;
        });
    }

    async function delEvent(id) {
        let events = JSON.parse(localStorage.getItem('planning_events') || "[]");
        events = events.filter(e => e.id !== id);
        localStorage.setItem('planning_events', JSON.stringify(events));
        renderPlanning();
        refreshDashboard();
        
        // Cancellazione in Cloud
        if (supabaseClient) {
            try {
                const { error } = await supabaseClient.from('ares_planning').delete().eq('id', id);
                if (error) throw error;
            } catch (err) {
                console.error("Errore durante l'eliminazione dal cloud dell'evento:", err);
            }
        }
    }

    async function loadPlanning() {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('note_') || key.startsWith('critical_day_'))) {
                localStorage.removeItem(key);
            }
        }
        localStorage.setItem('planning_events', '[]');
        
        if (supabaseClient) {
            try {
                showCloudStatus("Caricamento planning da Cloud...", "syncing");
                const { data, error } = await supabaseClient.from('ares_planning').select('*');
                if (error) throw error;
                
                if (data) {
                    const localEvents = [];
                    data.forEach(row => {
                        const desc = row.descrizione || "";
                        if (desc.startsWith('NOTE:')) {
                            const txt = desc.substring(5);
                            const fullDate = row.data_scadenza || "";
                            const parts = fullDate.split('T');
                            const dateKey = parts[0];
                            const timeVal = parts[1] ? parts[1].substring(0, 5) : "09:00";
                            
                            let notes = JSON.parse(localStorage.getItem(`note_${dateKey}`) || "[]");
                            notes.push({
                                id: Number(row.id),
                                txt: txt,
                                time: timeVal,
                                important: !!row.importante
                            });
                            localStorage.setItem(`note_${dateKey}`, JSON.stringify(notes));
                        } else if (desc.startsWith('PLAN:')) {
                            const txt = desc.substring(5);
                            localEvents.push({
                                id: Number(row.id),
                                date: row.data_scadenza ? row.data_scadenza.replace(' ', 'T') : "",
                                desc: txt,
                                fascicolo_id: row.fascicolo_id || null
                            });
                        } else if (desc === 'CRITICAL') {
                            const dateKey = row.data_scadenza.split('T')[0];
                            localStorage.setItem(`critical_day_${dateKey}`, 'true');
                        }
                    });
                    
                    localStorage.setItem('planning_events', JSON.stringify(localEvents));
                }
                showCloudStatus("Planning Sincronizzato con Cloud", "success");
            } catch (err) {
                console.error("Errore caricamento planning da Cloud:", err);
                showCloudStatus("Errore Connessione Cloud. Uso dati locali.", "error");
            }
        }
        
        if (typeof renderPlanning === 'function') renderPlanning();
        if (typeof renderAllCalendars === 'function') renderAllCalendars();
        if (typeof updateMobileInterface === 'function') updateMobileInterface();
    }

    // RESOURCE MANAGER AVANZATO
    let resources = { persone: [], mezzi: [], attrezzature: [] };

    function switchResourceTab(tabName) {
        document.querySelectorAll('#view-risorse .tab-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('#view-risorse .tab-btn').forEach(b => b.classList.remove('active'));
        
        document.getElementById('tab-content-' + tabName).classList.add('active');
        document.getElementById('tab-btn-' + tabName).classList.add('active');
    }

    async function loadResources() {
        let localStored = localStorage.getItem('ares_resources');
        if (localStored) {
            try {
                resources = JSON.parse(localStored);
            } catch (e) {
                console.error("Errore caricamento locale risorse", e);
            }
        }
        
        if (!resources.persone) resources.persone = [];
        if (!resources.mezzi) resources.mezzi = [];
        if (!resources.attrezzature) resources.attrezzature = [];

        if (supabaseClient) {
            try {
                showCloudStatus("Caricamento risorse da Cloud...", "syncing");
                const { data, error } = await supabaseClient.from('ares_resources').select('*');
                if (error) throw error;
                
                if (data && data.length > 0) {
                    resources.persone = [];
                    resources.mezzi = [];
                    resources.attrezzature = [];
                    
                    data.forEach(row => {
                        if (row.tipo === 'persone') {
                            resources.persone.push({
                                id: Number(row.id),
                                nome: row.nome_modello || "",
                                cognome: row.cognome_targa || "",
                                foto: row.foto || "",
                                ciFile: row.file_1 || "",
                                ciScadenza: row.scadenza_1 || "",
                                patenteFile: row.file_2 || "",
                                patenteScadenza: row.scadenza_2 || "",
                                abilFile: row.file_3 || "",
                                abilScadenza: row.scadenza_3 || "",
                                fascicolo_id: row.fascicolo_id || null
                            });
                        } else if (row.tipo === 'mezzi') {
                            resources.mezzi.push({
                                id: Number(row.id),
                                tipo: row.nome_modello || "",
                                targa: row.cognome_targa || "",
                                foto: row.foto || "",
                                assFile: row.file_1 || "",
                                assScadenza: row.scadenza_1 || "",
                                revFile: row.file_2 || "",
                                revScadenza: row.scadenza_2 || "",
                                repairs: row.repairs || [],
                                fascicolo_id: row.fascicolo_id || null
                            });
                        } else if (row.tipo === 'attrezzature') {
                            resources.attrezzature.push({
                                id: Number(row.id),
                                modello: row.nome_modello || "",
                                foto: row.foto || "",
                                acquistoData: row.acquisto_data || "",
                                acquistoValore: row.acquisto_valore || 0,
                                repairs: row.repairs || []
                            });
                        }
                    });
                    
                    localStorage.setItem('ares_resources', JSON.stringify(resources));
                }
                showCloudStatus("Risorse Sincronizzate con Cloud", "success");
            } catch (err) {
                console.error("Errore caricamento risorse da Cloud:", err);
                showCloudStatus("Errore Connessione Cloud. Uso dati locali.", "error");
            }
        }
        
        renderResources();
        checkExpirations();
    }

    async function saveResources() {
        localStorage.setItem('ares_resources', JSON.stringify(resources));
        renderResources();
        updateAll();
        checkExpirations();

        if (supabaseClient) {
            try {
                const rowsToUpsert = [];
                
                if (resources.persone) {
                    resources.persone.forEach(p => {
                        rowsToUpsert.push({
                            id: p.id,
                            tipo: 'persone',
                            nome_modello: p.nome || "",
                            cognome_targa: p.cognome || "",
                            foto: p.foto || "",
                            scadenza_1: p.ciScadenza || null,
                            scadenza_2: p.patenteScadenza || null,
                            scadenza_3: p.abilScadenza || null,
                            file_1: p.ciFile || "",
                            file_2: p.patenteFile || "",
                            file_3: p.abilFile || "",
                            repairs: [],
                            fascicolo_id: p.fascicolo_id || null
                        });
                    });
                }
                
                if (resources.mezzi) {
                    resources.mezzi.forEach(m => {
                        rowsToUpsert.push({
                            id: m.id,
                            tipo: 'mezzi',
                            nome_modello: m.tipo || "",
                            cognome_targa: m.targa || "",
                            foto: m.foto || "",
                            scadenza_1: m.assScadenza || null,
                            scadenza_2: m.revScadenza || null,
                            scadenza_3: null,
                            file_1: m.assFile || "",
                            file_2: m.revFile || "",
                            file_3: "",
                            repairs: m.repairs || [],
                            fascicolo_id: m.fascicolo_id || null
                        });
                    });
                }
                
                if (resources.attrezzature) {
                    resources.attrezzature.forEach(a => {
                        rowsToUpsert.push({
                            id: a.id,
                            tipo: 'attrezzature',
                            nome_modello: a.modello || "",
                            cognome_targa: "",
                            foto: a.foto || "",
                            scadenza_1: null,
                            scadenza_2: null,
                            scadenza_3: null,
                            file_1: "",
                            file_2: "",
                            file_3: "",
                            repairs: a.repairs || []
                        });
                    });
                }
                
                if (rowsToUpsert.length > 0) {
                    const { error } = await supabaseClient.from('ares_resources').upsert(rowsToUpsert, { onConflict: 'id' });
                    if (error) throw error;
                }
            } catch (err) {
                console.error("Errore salvataggio risorse su Cloud:", err);
                showCloudStatus("Errore Sync Risorse. Dati salvati in locale.", "error");
            }
        }
    }

    function getExpiryBadge(dateStr) {
        if (!dateStr) return { html: `<span class="expiry-badge expiry-safe">N/D</span>`, status: 'safe', days: 999 };
        const expiryDate = new Date(dateStr);
        const today = new Date();
        today.setHours(0,0,0,0);
        expiryDate.setHours(0,0,0,0);
        const diffTime = expiryDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
            return { html: `<span class="expiry-badge expiry-expired">SCADUTO (${Math.abs(diffDays)} gg fa)</span>`, status: 'expired', days: diffDays };
        } else if (diffDays <= 30) {
            return { html: `<span class="expiry-badge expiry-warning">SCADE TRA ${diffDays} gg</span>`, status: 'warning', days: diffDays };
        } else {
            return { html: `<span class="expiry-badge expiry-safe">OK (${diffDays} gg rimasti)</span>`, status: 'safe', days: diffDays };
        }
    }

    function renderResources() {
        // 1. Render Persone
        const pGrid = document.getElementById('persone-grid');
        if (pGrid) {
            pGrid.innerHTML = '';
            resources.persone.forEach(p => {
                const ciBadge = getExpiryBadge(p.ciScadenza);
                const patBadge = getExpiryBadge(p.patenteScadenza);
                const abilBadge = getExpiryBadge(p.abilScadenza);
                
                const card = document.createElement('div');
                card.className = 'resource-card';
                card.innerHTML = `
                    <div class="resource-header">
                        ${p.foto ? `<img class="resource-avatar" src="${p.foto}" onerror="this.outerHTML='<div class=\'resource-avatar\'>👥</div>'">` : '<div class="resource-avatar">👥</div>'}
                        <div class="resource-details">
                            <h4 class="resource-name">${p.nome} ${p.cognome}</h4>
                            <span class="resource-sub">Persona</span>
                        </div>
                    </div>
                    <div class="resource-docs">
                        <div class="doc-item">
                            <span class="doc-label">📄 Carta Identità:</span>
                            <div class="doc-actions">
                                ${ciBadge.html}
                                ${p.ciFile ? `<a class="doc-link" href="${p.ciFile}" target="_blank">Apri</a>` : ''}
                            </div>
                        </div>
                        <div class="doc-item">
                            <span class="doc-label">🪪 Patente:</span>
                            <div class="doc-actions">
                                ${patBadge.html}
                                ${p.patenteFile ? `<a class="doc-link" href="${p.patenteFile}" target="_blank">Apri</a>` : ''}
                            </div>
                        </div>
                        <div class="doc-item">
                            <span class="doc-label">🎓 Abilitazioni:</span>
                            <div class="doc-actions">
                                ${abilBadge.html}
                                ${p.abilFile ? `<a class="doc-link" href="${p.abilFile}" target="_blank">Apri</a>` : ''}
                            </div>
                        </div>
                    </div>
                    <div style="margin-top:auto; padding-top:10px; display:flex; justify-content:flex-end; gap:6px;">
                        <button class="btn-action" style="padding:6px 12px; font-size:11px; background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99,102,241,0.25);" onclick="editResource('persone', ${p.id})">Modifica</button>
                        <button class="btn-action btn-danger" style="padding:6px 12px; font-size:11px;" onclick="deleteResource('persone', ${p.id})">Rimuovi</button>
                    </div>
                `;
                pGrid.appendChild(card);
            });
        }

        // 2. Render Mezzi
        const mGrid = document.getElementById('mezzi-grid');
        if (mGrid) {
            mGrid.innerHTML = '';
            resources.mezzi.forEach(m => {
                const assBadge = getExpiryBadge(m.assScadenza);
                const revBadge = getExpiryBadge(m.revScadenza);
                
                let repairsHtml = '';
                if (m.repairs && m.repairs.length > 0) {
                    m.repairs.forEach(rep => {
                        repairsHtml += `
                            <div class="repair-item">
                                <span>${rep.date} - ${rep.desc}</span>
                                <b style="color:#f43f5e;">€ ${parseFloat(rep.amount).toFixed(2)}</b>
                            </div>
                        `;
                    });
                } else {
                    repairsHtml = '<div style="font-size:10px; color:#94a3b8; font-style:italic; text-align:center; padding:5px 0;">Nessuna manutenzione registrata</div>';
                }

                const card = document.createElement('div');
                card.className = 'resource-card';
                card.innerHTML = `
                    <div class="resource-header">
                        ${m.foto ? `<img class="resource-avatar" src="${m.foto}" onerror="this.outerHTML='<div class=\'resource-avatar\'>🚚</div>'">` : '<div class="resource-avatar">🚚</div>'}
                        <div class="resource-details">
                            <h4 class="resource-name">${m.tipo}</h4>
                            <span class="resource-sub">Targa: <b>${m.targa}</b></span>
                        </div>
                    </div>
                    <div class="resource-docs">
                        <div class="doc-item">
                            <span class="doc-label">🛡️ Assicurazione:</span>
                            <div class="doc-actions">
                                ${assBadge.html}
                                ${m.assFile ? `<a class="doc-link" href="${m.assFile}" target="_blank">Apri</a>` : ''}
                            </div>
                        </div>
                        <div class="doc-item">
                            <span class="doc-label">🔧 Revisione:</span>
                            <div class="doc-actions">
                                ${revBadge.html}
                                ${m.revFile ? `<a class="doc-link" href="${m.revFile}" target="_blank">Apri</a>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="repair-section">
                        <div class="repair-title">🔧 Log Manutenzioni / Riparazioni</div>
                        <div class="repair-list">${repairsHtml}</div>
                        <div class="repair-form">
                            <input type="date" id="rep-date-${m.id}" style="width:75px; font-size:10px; padding:3px;">
                            <input type="text" id="rep-desc-${m.id}" placeholder="Nota..." style="font-size:10px; padding:3px;">
                            <input type="number" id="rep-amount-${m.id}" placeholder="€" style="width:55px; font-size:10px; padding:3px;" min="0">
                            <button class="btn-action" style="padding:4px 8px; font-size:11px;" onclick="addVehicleRepair(${m.id})">+</button>
                        </div>
                    </div>
                    <div style="margin-top:auto; padding-top:10px; display:flex; justify-content:flex-end; gap:6px;">
                        <button class="btn-action" style="padding:6px 12px; font-size:11px; background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99,102,241,0.25);" onclick="editResource('mezzi', ${m.id})">Modifica</button>
                        <button class="btn-action btn-danger" style="padding:6px 12px; font-size:11px;" onclick="deleteResource('mezzi', ${m.id})">Rimuovi</button>
                    </div>
                `;
                mGrid.appendChild(card);
            });
        }

        // 3. Render Attrezzature
        const aGrid = document.getElementById('attrezzature-grid');
        if (aGrid) {
            aGrid.innerHTML = '';
            resources.attrezzature.forEach(a => {
                let repairsHtml = '';
                if (a.repairs && a.repairs.length > 0) {
                    a.repairs.forEach(rep => {
                        repairsHtml += `
                            <div class="repair-item">
                                <span>${rep.date} - ${rep.desc}</span>
                                <b style="color:#f43f5e;">€ ${parseFloat(rep.amount).toFixed(2)}</b>
                            </div>
                        `;
                    });
                } else {
                    repairsHtml = '<div style="font-size:10px; color:#94a3b8; font-style:italic; text-align:center; padding:5px 0;">Nessuna riparazione registrata</div>';
                }

                const card = document.createElement('div');
                card.className = 'resource-card';
                card.innerHTML = `
                    <div class="resource-header">
                        ${a.foto ? `<img class="resource-avatar" src="${a.foto}" onerror="this.outerHTML='<div class=\'resource-avatar\'>⚙️</div>'">` : '<div class="resource-avatar">⚙️</div>'}
                        <div class="resource-details">
                            <h4 class="resource-name">${a.modello}</h4>
                            <span class="resource-sub">Attrezzatura</span>
                        </div>
                    </div>
                    <div class="resource-docs">
                        <div class="doc-item">
                            <span class="doc-label">📅 Data Acquisto:</span>
                            <span style="font-size:12px; color:#fff; font-weight:600;">${a.acquistoData || 'N/D'}</span>
                        </div>
                        <div class="doc-item">
                            <span class="doc-label">💰 Valore Acquisto:</span>
                            <span style="font-size:12px; color:#10b981; font-weight:700;">€ ${parseFloat(a.acquistoValore || 0).toLocaleString('it-IT', {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>
                    <div class="repair-section">
                        <div class="repair-title">⚙️ Log Riparazioni / Manutenzioni</div>
                        <div class="repair-list">${repairsHtml}</div>
                        <div class="repair-form">
                            <input type="date" id="rep-date-a-${a.id}" style="width:75px; font-size:10px; padding:3px;">
                            <input type="text" id="rep-desc-a-${a.id}" placeholder="Nota..." style="font-size:10px; padding:3px;">
                            <input type="number" id="rep-amount-a-${a.id}" placeholder="€" style="width:55px; font-size:10px; padding:3px;" min="0">
                            <button class="btn-action" style="padding:4px 8px; font-size:11px;" onclick="addEquipmentRepair(${a.id})">+</button>
                        </div>
                    </div>
                    <div style="margin-top:auto; padding-top:10px; display:flex; justify-content:flex-end; gap:6px;">
                        <button class="btn-action" style="padding:6px 12px; font-size:11px; background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99,102,241,0.25);" onclick="editResource('attrezzature', ${a.id})">Modifica</button>
                        <button class="btn-action btn-danger" style="padding:6px 12px; font-size:11px;" onclick="deleteResource('attrezzature', ${a.id})">Rimuovi</button>
                    </div>
                `;
                aGrid.appendChild(card);
            });
        }
    }

    function addPersonResource() {
        const nome = document.getElementById('p-nome').value.trim();
        const cognome = document.getElementById('p-cognome').value.trim();
        const foto = document.getElementById('p-foto').value.trim();
        const ciFile = document.getElementById('p-ci-file').value.trim();
        const ciScadenza = document.getElementById('p-ci-scadenza').value;
        const patenteFile = document.getElementById('p-patente-file').value.trim();
        const patenteScadenza = document.getElementById('p-patente-scadenza').value;
        const abilFile = document.getElementById('p-abil-file').value.trim();
        const abilScadenza = document.getElementById('p-abil-scadenza').value;
        
        if (!nome || !cognome) {
            alert("Inserisci almeno Nome e Cognome!");
            return;
        }
        
        const isEditing = (editingResourceId && editingResourceCategory === 'persone');
        const targetId = isEditing ? editingResourceId : Date.now();
        
        const pObj = {
            id: targetId,
            nome,
            cognome,
            foto,
            ciFile,
            ciScadenza,
            patenteFile,
            patenteScadenza,
            abilFile,
            abilScadenza
        };
        
        if (isEditing) {
            resources.persone = resources.persone.map(p => p.id === targetId ? pObj : p);
        } else {
            resources.persone.push(pObj);
        }
        
        resetResourceForm('persone');
        saveResources();
        if (isEditing) alert("Risorsa persona aggiornata correttamente!");
    }

    function addVehicleResource() {
        const tipo = document.getElementById('m-tipo').value.trim();
        const targa = document.getElementById('m-targa').value.trim();
        const foto = document.getElementById('m-foto').value.trim();
        const assFile = document.getElementById('m-ass-file').value.trim();
        const assScadenza = document.getElementById('m-ass-scadenza').value;
        const revFile = document.getElementById('m-rev-file').value.trim();
        const revScadenza = document.getElementById('m-rev-scadenza').value;
        
        if (!tipo || !targa) {
            alert("Inserisci Tipo/Modello e Targa!");
            return;
        }
        
        const isEditing = (editingResourceId && editingResourceCategory === 'mezzi');
        const targetId = isEditing ? editingResourceId : Date.now();
        
        let repairs = [];
        if (isEditing) {
            const existing = resources.mezzi.find(m => m.id === targetId);
            if (existing && existing.repairs) repairs = existing.repairs;
        }
        
        const mObj = {
            id: targetId,
            tipo,
            targa,
            foto,
            assFile,
            assScadenza,
            revFile,
            revScadenza,
            repairs
        };
        
        if (isEditing) {
            resources.mezzi = resources.mezzi.map(m => m.id === targetId ? mObj : m);
        } else {
            resources.mezzi.push(mObj);
        }
        
        resetResourceForm('mezzi');
        saveResources();
        if (isEditing) alert("Risorsa mezzo aggiornata correttamente!");
    }

    function addEquipmentResource() {
        const modello = document.getElementById('a-modello').value.trim();
        const foto = document.getElementById('a-foto').value.trim();
        const acquistoData = document.getElementById('a-acquisto-data').value;
        const acquistoValore = parseFloat(document.getElementById('a-acquisto-valore').value) || 0;
        
        if (!modello) {
            alert("Inserisci il Modello dell'Attrezzatura!");
            return;
        }
        
        const isEditing = (editingResourceId && editingResourceCategory === 'attrezzature');
        const targetId = isEditing ? editingResourceId : Date.now();
        
        let repairs = [];
        if (isEditing) {
            const existing = resources.attrezzature.find(e => e.id === targetId);
            if (existing && existing.repairs) repairs = existing.repairs;
        }
        
        const aObj = {
            id: targetId,
            modello,
            foto,
            acquistoData,
            acquistoValore,
            repairs
        };
        
        if (isEditing) {
            resources.attrezzature = resources.attrezzature.map(a => a.id === targetId ? aObj : a);
        } else {
            resources.attrezzature.push(aObj);
        }
        
        resetResourceForm('attrezzature');
        saveResources();
        if (isEditing) alert("Risorsa attrezzatura aggiornata correttamente!");
    }

    // ----------------------------------------------------
    // HELPER GESTIONE EDITING E RESET FORM RISORSE
    // ----------------------------------------------------
    let editingResourceId = null;
    let editingResourceCategory = null;

    function editResource(category, id) {
        editingResourceId = id;
        editingResourceCategory = category;
        
        const item = resources[category].find(x => x.id === id);
        if (!item) return;
        
        switchResourceTab(category);
        
        if (category === 'persone') {
            document.getElementById('p-nome').value = item.nome || '';
            document.getElementById('p-cognome').value = item.cognome || '';
            document.getElementById('p-foto').value = item.foto || '';
            document.getElementById('p-ci-file').value = item.ciFile || '';
            document.getElementById('p-ci-scadenza').value = item.ciScadenza || '';
            document.getElementById('p-patente-file').value = item.patenteFile || '';
            document.getElementById('p-patente-scadenza').value = item.patenteScadenza || '';
            document.getElementById('p-abil-file').value = item.abilFile || '';
            document.getElementById('p-abil-scadenza').value = item.abilScadenza || '';
            
            document.getElementById('form-persona-title').innerText = `✏️ Modifica Persona: ${item.nome} ${item.cognome}`;
            document.getElementById('btn-save-persona').innerText = `Salva Modifiche 💾`;
            document.getElementById('btn-cancel-persona').style.display = 'inline-block';
            document.getElementById('form-persona-title').scrollIntoView({ behavior: 'smooth' });
        } else if (category === 'mezzi') {
            document.getElementById('m-tipo').value = item.tipo || '';
            document.getElementById('m-targa').value = item.targa || '';
            document.getElementById('m-foto').value = item.foto || '';
            document.getElementById('m-ass-file').value = item.assFile || '';
            document.getElementById('m-ass-scadenza').value = item.assScadenza || '';
            document.getElementById('m-rev-file').value = item.revFile || '';
            document.getElementById('m-rev-scadenza').value = item.revScadenza || '';
            
            document.getElementById('form-mezzi-title').innerText = `✏️ Modifica Mezzo: ${item.tipo} (${item.targa})`;
            document.getElementById('btn-save-mezzi').innerText = `Salva Modifiche 💾`;
            document.getElementById('btn-cancel-mezzi').style.display = 'inline-block';
            document.getElementById('form-mezzi-title').scrollIntoView({ behavior: 'smooth' });
        } else if (category === 'attrezzature') {
            document.getElementById('a-modello').value = item.modello || '';
            document.getElementById('a-foto').value = item.foto || '';
            document.getElementById('a-acquisto-data').value = item.acquistoData || '';
            document.getElementById('a-acquisto-valore').value = item.acquistoValore || '';
            
            document.getElementById('form-attrezzature-title').innerText = `✏️ Modifica Attrezzatura: ${item.modello}`;
            document.getElementById('btn-save-attrezzature').innerText = `Salva Modifiche 💾`;
            document.getElementById('btn-cancel-attrezzature').style.display = 'inline-block';
            document.getElementById('form-attrezzature-title').scrollIntoView({ behavior: 'smooth' });
        }
    }

    function resetResourceForm(category) {
        editingResourceId = null;
        editingResourceCategory = null;
        
        if (category === 'persone') {
            document.getElementById('p-nome').value = '';
            document.getElementById('p-cognome').value = '';
            document.getElementById('p-foto').value = '';
            document.getElementById('p-ci-file').value = '';
            document.getElementById('p-ci-scadenza').value = '';
            document.getElementById('p-patente-file').value = '';
            document.getElementById('p-patente-scadenza').value = '';
            document.getElementById('p-abil-file').value = '';
            document.getElementById('p-abil-scadenza').value = '';
            
            document.getElementById('form-persona-title').innerText = `Aggiungi Persona`;
            document.getElementById('btn-save-persona').innerText = `Aggiungi Persona 👥`;
            document.getElementById('btn-cancel-persona').style.display = 'none';
        } else if (category === 'mezzi') {
            document.getElementById('m-tipo').value = '';
            document.getElementById('m-targa').value = '';
            document.getElementById('m-foto').value = '';
            document.getElementById('m-ass-file').value = '';
            document.getElementById('m-ass-scadenza').value = '';
            document.getElementById('m-rev-file').value = '';
            document.getElementById('m-rev-scadenza').value = '';
            
            document.getElementById('form-mezzi-title').innerText = `Aggiungi Mezzo`;
            document.getElementById('btn-save-mezzi').innerText = `Aggiungi Mezzo 🚚`;
            document.getElementById('btn-cancel-mezzi').style.display = 'none';
        } else if (category === 'attrezzature') {
            document.getElementById('a-modello').value = '';
            document.getElementById('a-foto').value = '';
            document.getElementById('a-acquisto-data').value = '';
            document.getElementById('a-acquisto-valore').value = '';
            
            document.getElementById('form-attrezzature-title').innerText = `Aggiungi Attrezzatura`;
            document.getElementById('btn-save-attrezzature').innerText = `Aggiungi Attrezzatura ⚙️`;
            document.getElementById('btn-cancel-attrezzature').style.display = 'none';
        }
    }

    async function deleteResource(category, id) {
        if (confirm("Sei sicuro di voler rimuovere questa risorsa?")) {
            resources[category] = resources[category].filter(item => item.id !== id);
            await saveResources();
            
            // Cancellazione in Cloud
            if (supabaseClient && id) {
                try {
                    const { error } = await supabaseClient.from('ares_resources').delete().eq('id', id);
                    if (error) throw error;
                } catch (err) {
                    console.error("Errore eliminazione risorsa su Cloud:", err);
                }
            }
        }
    }

    function addVehicleRepair(vehicleId) {
        const dateInput = document.getElementById(`rep-date-${vehicleId}`);
        const descInput = document.getElementById(`rep-desc-${vehicleId}`);
        const amountInput = document.getElementById(`rep-amount-${vehicleId}`);
        
        const date = dateInput.value;
        const desc = descInput.value.trim();
        const amount = parseFloat(amountInput.value) || 0;
        
        if (!date || !desc || amount <= 0) {
            alert("Inserisci una data, descrizione e un importo valido maggiore di zero!");
            return;
        }
        
        const vehicle = resources.mezzi.find(m => m.id === vehicleId);
        if (vehicle) {
            if (!vehicle.repairs) vehicle.repairs = [];
            vehicle.repairs.push({ date, desc, amount });
            dateInput.value = '';
            descInput.value = '';
            amountInput.value = '';
            saveResources();
        }
    }

    function addEquipmentRepair(equipmentId) {
        const dateInput = document.getElementById(`rep-date-a-${equipmentId}`);
        const descInput = document.getElementById(`rep-desc-a-${equipmentId}`);
        const amountInput = document.getElementById(`rep-amount-a-${equipmentId}`);
        
        const date = dateInput.value;
        const desc = descInput.value.trim();
        const amount = parseFloat(amountInput.value) || 0;
        
        if (!date || !desc || amount <= 0) {
            alert("Inserisci una data, descrizione e un importo valido maggiore di zero!");
            return;
        }
        
        const equipment = resources.attrezzature.find(e => e.id === equipmentId);
        if (equipment) {
            if (!equipment.repairs) equipment.repairs = [];
            equipment.repairs.push({ date, desc, amount });
            dateInput.value = '';
            descInput.value = '';
            amountInput.value = '';
            saveResources();
        }
    }

    function checkExpirations() {
        const alertsDiv = document.getElementById('dash-alerts');
        if (!alertsDiv) return;
        alertsDiv.innerHTML = '';
        
        let alerts = [];
        
        if (resources.persone) {
            resources.persone.forEach(p => {
                const docs = [
                    { label: "Carta Identità", date: p.ciScadenza, file: p.ciFile },
                    { label: "Patente di Guida", date: p.patenteScadenza, file: p.patenteFile },
                    { label: "Abilitazione/Patentini", date: p.abilScadenza, file: p.abilFile }
                ];
                docs.forEach(doc => {
                    if (doc.date) {
                        const info = getExpiryBadge(doc.date);
                        if (info.status === 'expired' || info.status === 'warning') {
                            alerts.push({
                                type: info.status,
                                message: `${p.nome} ${p.cognome} - Scadenza ${doc.label}: ${doc.date} (${info.days < 0 ? 'SCADUTO da ' + Math.abs(info.days) + ' gg' : 'scade in ' + info.days + ' gg'})`,
                                file: doc.file
                            });
                        }
                    }
                });
            });
        }
        
        if (resources.mezzi) {
            resources.mezzi.forEach(m => {
                const docs = [
                    { label: "Assicurazione", date: m.assScadenza, file: m.assFile },
                    { label: "Revisione", date: m.revScadenza, file: m.revFile }
                ];
                docs.forEach(doc => {
                    if (doc.date) {
                        const info = getExpiryBadge(doc.date);
                        if (info.status === 'expired' || info.status === 'warning') {
                            alerts.push({
                                type: info.status,
                                message: `${m.tipo} (${m.targa}) - Scadenza ${doc.label}: ${doc.date} (${info.days < 0 ? 'SCADUTA da ' + Math.abs(info.days) + ' gg' : 'scade in ' + info.days + ' gg'})`,
                                file: doc.file
                            });
                        }
                    }
                });
            });
        }
        
        if (alerts.length === 0) {
            alertsDiv.innerHTML = '<div style="color: #10b981; font-weight: 600; padding: 10px; font-size:13px; text-align:center;">🟢 Nessun documento in scadenza o scaduto. Ottimo lavoro!</div>';
        } else {
            alerts.forEach(alert => {
                const card = document.createElement('div');
                card.className = `alert-card ${alert.type === 'warning' ? 'warning' : ''}`;
                card.innerHTML = `
                    <span>${alert.type === 'expired' ? '🔴' : '🟡'} ${alert.message}</span>
                    ${alert.file ? `<a class="doc-link" href="${alert.file}" target="_blank" style="margin-left: 10px;">Apri Documento</a>` : ''}
                `;
                alertsDiv.appendChild(card);
            });
        }
    }

    // CRM & BI REVAMPED
    function filterCRM() {
        let input = document.getElementById('search-input').value.toLowerCase();
        document.querySelectorAll('.table-row-item').forEach(r => {
            let nameEl = r.querySelector('.crm-name b') || r.querySelector('.crm-name');
            let name = (nameEl.innerText || nameEl.textContent || "").trim();
            
            let zoneEl = r.querySelector('.crm-zone-badge');
            let zone = zoneEl ? (zoneEl.innerText || zoneEl.textContent || "").trim() : "";
            
            let match = name.toLowerCase().includes(input) || zone.toLowerCase().includes(input);
            r.style.display = match ? "" : "none";
        });
    }

    function updateCRMStatus(el) {
        let card = el.closest('.crm-card');
        if (!card) return;
        
        let dateVal = card.querySelector('.date-input').value;
        let prevVal = parseFloat(card.querySelector('.prev-box').value) || 0;
        let badge = card.querySelector('.crm-status');
        
        if (prevVal > 0) {
            badge.className = "crm-status status-active";
            badge.innerText = "Contratto";
        } else if (dateVal) {
            badge.className = "crm-status status-scheduled";
            badge.innerText = "Pianificato";
        } else {
            badge.className = "crm-status status-prospect";
            badge.innerText = "Prospect";
        }
    }

    async function saveCRMData() {
        let inputs = {};
        let manualContacts = [];
        
        document.querySelectorAll('.table-row-item').forEach(r => {
            let nameEl = r.querySelector('.crm-name b') || r.querySelector('.crm-name');
            let name = (nameEl.innerText || nameEl.textContent || "").trim();
            let date = r.querySelector('.date-input').value;
            let prev = parseFloat(r.querySelector('.prev-box').value) || 0;
            let cost = parseFloat(r.querySelector('.cost-box').value) || 0;
            let note = r.querySelector('.notes-box').value;
            
            let zoneEl = r.querySelector('.crm-zone-badge');
            let zone = zoneEl ? zoneEl.innerText.replace('📍 ', '').trim() : "";
            
            inputs[name] = { date: date, prev: prev, cost: cost, note: note, zone: zone };
            
            if (r.classList.contains('manual-row')) {
                manualContacts.push({ name: name, zone: zone });
            }
        });
        
        localStorage.setItem('crm_inputs', JSON.stringify(inputs));
        localStorage.setItem('crm_manual_contacts', JSON.stringify(manualContacts));
        if (typeof renderAllCalendars === 'function') {
            renderAllCalendars();
        }
        if (typeof refreshDashboard === 'function') {
            refreshDashboard();
        }

        if (supabaseClient) {
            try {
                const rowsToUpsert = Object.keys(inputs).map(name => {
                    const info = inputs[name];
                    return {
                        name: name,
                        zone: info.zone || "",
                        appuntamento: info.date || "",
                        preventivo: parseFloat(info.prev) || 0,
                        spesa: parseFloat(info.cost) || 0,
                        note: info.note || ""
                    };
                });
                
                if (rowsToUpsert.length > 0) {
                    const { error } = await supabaseClient.from('ares_crm').upsert(rowsToUpsert, { onConflict: 'name' });
                    if (error) throw error;
                }
            } catch (err) {
                console.error("Errore salvataggio CRM su Cloud:", err);
                showCloudStatus("Errore Sync CRM. Dati salvati in locale.", "error");
            }
        }
    }

    async function loadCRMData() {
        let manualContacts = [];
        let inputs = {};

        if (supabaseClient) {
            try {
                showCloudStatus("Caricamento CRM da Cloud...", "syncing");
                const { data, error } = await supabaseClient.from('ares_crm').select('*');
                if (error) throw error;
                
                if (data && data.length > 0) {
                    data.forEach(row => {
                        inputs[row.name] = {
                            date: row.appuntamento || "",
                            prev: row.preventivo || 0,
                            cost: row.spesa || 0,
                            note: row.note || "",
                            zone: row.zone || ""
                        };
                        
                        let existsInHTML = Array.from(document.querySelectorAll('.table-row-item b, .table-row-item .crm-name')).some(el => {
                            let txt = (el.innerText || el.textContent || "").trim();
                            return txt === row.name;
                        });
                        
                        if (!existsInHTML) {
                            manualContacts.push({ name: row.name, zone: row.zone });
                        }
                    });
                    
                    localStorage.setItem('crm_inputs', JSON.stringify(inputs));
                    localStorage.setItem('crm_manual_contacts', JSON.stringify(manualContacts));
                } else {
                    manualContacts = JSON.parse(localStorage.getItem('crm_manual_contacts') || "[]");
                    inputs = JSON.parse(localStorage.getItem('crm_inputs') || "{}");
                }
                showCloudStatus("CRM Sincronizzato con Cloud", "success");
            } catch (err) {
                console.error("Errore caricamento CRM da Cloud:", err);
                showCloudStatus("Errore Connessione Cloud. Uso dati locali.", "error");
                manualContacts = JSON.parse(localStorage.getItem('crm_manual_contacts') || "[]");
                inputs = JSON.parse(localStorage.getItem('crm_inputs') || "{}");
            }
        } else {
            manualContacts = JSON.parse(localStorage.getItem('crm_manual_contacts') || "[]");
            inputs = JSON.parse(localStorage.getItem('crm_inputs') || "{}");
        }

        // 1. Carica i contatti manuali prima di tutto
        manualContacts.forEach(contact => {
            let name = "", zone = "";
            if (typeof contact === 'string') {
                name = contact;
            } else if (contact && typeof contact === 'object') {
                name = contact.name || "";
                zone = contact.zone || "";
            }
            if (!name) return;
            
            let exists = Array.from(document.querySelectorAll('.table-row-item b, .table-row-item .crm-name')).some(el => {
                let txt = (el.innerText || el.textContent || "").trim();
                return txt === name;
            });
            if (!exists) {
                addManualContact(name, zone, true);
            }
        });
        
        // 2. Popola tutti gli input salvati
        document.querySelectorAll('.table-row-item').forEach(r => {
            let nameEl = r.querySelector('.crm-name b') || r.querySelector('.crm-name');
            let name = (nameEl.innerText || nameEl.textContent || "").trim();
            if (inputs[name]) {
                r.querySelector('.date-input').value = inputs[name].date || "";
                r.querySelector('.prev-box').value = inputs[name].prev || 0;
                r.querySelector('.cost-box').value = inputs[name].cost || 0;
                r.querySelector('.notes-box').value = inputs[name].note || "";
                
                // Aggiorna lo stato visivo basato sui dati inseriti
                if (typeof updateCRMStatus === 'function') {
                    updateCRMStatus(r.querySelector('.date-input'));
                }
            }
        });
    }


    function addManualContact(nameVal = null, zoneVal = null, isLoading = false) {
        let name = nameVal || document.getElementById('new-name').value;
        let zone = zoneVal || (document.getElementById('new-zone') ? document.getElementById('new-zone').value : "") || "";
        if(!name) return;
        
        let crmList = document.getElementById('crm-list');
        if (!crmList) return;
        
        let firstLetter = name.charAt(0).toUpperCase() || 'M';
        let cardId = 'manual-' + Date.now();
        
        let div = document.createElement('div');
        div.className = "crm-card table-row-item manual-row";
        div.id = cardId;
        
        let zoneBadgeHtml = zone ? `<span class="crm-zone-badge">📍 ${zone}</span>` : '';
        
        div.innerHTML = `
            <div class="crm-info">
                <div class="crm-avatar" style="background:rgba(16, 185, 129, 0.1); border-color:rgba(16, 185, 129, 0.2); color:#10b981;">${firstLetter}</div>
                <div class="crm-details">
                    <h4 class="crm-name" title="${name}"><b>${name}</b></h4>
                    <div class="crm-meta" style="display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-top:2px;">
                        <span class="crm-status status-prospect">Prospect</span>
                        ${zoneBadgeHtml}
                    </div>
                </div>
            </div>
            <div class="crm-inputs-grid">
                <div class="crm-field">
                    <label>Appuntamento</label>
                    <input type="datetime-local" class="date-input" onchange="saveCRMData(); updateCRMStatus(this)">
                </div>
                <div class="crm-field">
                    <label>Preventivo (€)</label>
                    <input type="number" class="prev-box" value="0" onchange="updateAll(); saveCRMData(); updateCRMStatus(this)">
                </div>
                <div class="crm-field">
                    <label>Spesa (€)</label>
                    <input type="number" class="cost-box" value="0" onchange="updateAll(); saveCRMData(); updateCRMStatus(this)">
                </div>
            </div>
            <div class="crm-notes-col">
                <label>Annotazioni / Promemoria</label>
                <textarea class="notes-box" placeholder="Aggiungi dettagli o note..." oninput="saveCRMData()"></textarea>
            </div>
            <div style="text-align:center;">
                <button class="btn-delete-appt" title="Rimuovi Contatto" onclick="removeManualContact('${cardId}')" style="font-size: 14px; padding: 6px;">✖</button>
            </div>
        `;
        crmList.appendChild(div);
        
        if(!isLoading) {
            document.getElementById('new-name').value = "";
            if (document.getElementById('new-zone')) {
                document.getElementById('new-zone').value = "";
            }
            saveCRMData();
            updateAll();
        }
    }

    async function removeManualContact(cardId) {
        if (confirm("Sei sicuro di voler eliminare questo contatto dal CRM?")) {
            let el = document.getElementById(cardId);
            if (el) {
                let nameEl = el.querySelector('.crm-name b') || el.querySelector('.crm-name');
                let name = nameEl ? (nameEl.innerText || nameEl.textContent || "").trim() : "";
                
                el.remove();
                await saveCRMData();
                updateAll();
                
                // Cancellazione in Cloud
                if (supabaseClient && name) {
                    try {
                        const { error } = await supabaseClient.from('ares_crm').delete().eq('name', name);
                        if (error) throw error;
                    } catch (err) {
                        console.error("Errore durante l'eliminazione del contatto dal cloud:", err);
                    }
                }
            }
        }
    }

    function updateAll() {
        loadResources();
        let totalRev = 0, totalCost = 0;
        document.querySelectorAll('.table-row-item').forEach(r => {
            if(r.style.display !== 'none') {
                totalRev += parseFloat(r.querySelector('.prev-box').value || 0);
                totalCost += parseFloat(r.querySelector('.cost-box').value || 0);
            }
        });
        
        let cashFlowRev = new Array(12).fill(0);
        
        // Aggiungi preventivi convalidati
        const savedPrev = JSON.parse(localStorage.getItem('ares_preventivi') || "[]");
        savedPrev.forEach(p => {
            if (p.stato === 'convalidato') {
                let pTot = parseFloat(p.totalePreventivo || 0);
                totalRev += pTot;
                totalCost += parseFloat(p.spesePresunte || 0);
                
                let isRic = false;
                let mesiRic = 1;
                if (p.voci) {
                    p.voci.forEach(v => {
                        if (v.desc && v.desc.startsWith("__RICORRENTE__:true")) isRic = true;
                        if (v.desc && v.desc.startsWith("__DURATA_MESI__:__")) {
                            mesiRic = parseInt(v.desc.split(":")[1]) || 12;
                        } else if (v.desc && v.desc.startsWith("__DURATA_MESI__:")){
                            mesiRic = parseInt(v.desc.split(":")[1]) || 12;
                        }
                    });
                }
                
                if (isRic && mesiRic > 0) {
                    let monthlyRev = pTot / mesiRic;
                    for (let i = 0; i < Math.min(mesiRic, 12); i++) {
                        cashFlowRev[i] += monthlyRev;
                    }
                } else {
                    cashFlowRev[0] += pTot; // Assume Mese 1
                }
            }
        });
        
        let resourceCosts = 0;
        if (resources.attrezzature) {
            resources.attrezzature.forEach(a => {
                resourceCosts += parseFloat(a.acquistoValore || 0);
                if (a.repairs) {
                    a.repairs.forEach(rep => {
                        resourceCosts += parseFloat(rep.amount || 0);
                    });
                }
            });
        }
        if (resources.mezzi) {
            resources.mezzi.forEach(m => {
                if (m.repairs) {
                    m.repairs.forEach(rep => {
                        resourceCosts += parseFloat(rep.amount || 0);
                    });
                }
            });
        }
        totalCost += resourceCosts;
        document.getElementById('kpi-rev').innerText = "€ " + totalRev.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        document.getElementById('kpi-cost').innerText = "€ " + totalCost.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        let margin = totalRev - totalCost;
        
        let marginElement = document.getElementById('kpi-margin');
        marginElement.innerText = "€ " + margin.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        
        let marginTrend = document.getElementById('kpi-margin-trend');
        let cardMargin = document.getElementById('card-margin');
        if (margin > 0) {
            marginTrend.className = "kpi-trend trend-up";
            marginTrend.innerHTML = "▲ Margine in Attivo";
            cardMargin.style.boxShadow = "0 10px 30px rgba(16, 185, 129, 0.1)";
            cardMargin.style.borderColor = "rgba(16, 185, 129, 0.2)";
        } else if (margin < 0) {
            marginTrend.className = "kpi-trend trend-down";
            marginTrend.innerHTML = "▼ Margine in Perdita";
            cardMargin.style.boxShadow = "0 10px 30px rgba(244, 63, 94, 0.1)";
            cardMargin.style.borderColor = "rgba(244, 63, 94, 0.2)";
        } else {
            marginTrend.className = "kpi-trend trend-neutral";
            marginTrend.innerHTML = "● Bilancio in Pareggio";
            cardMargin.style.boxShadow = "none";
            cardMargin.style.borderColor = "rgba(255, 255, 255, 0.05)";
        }
        
        let roi = totalCost > 0 ? (margin / totalCost) * 100 : 0;
        let roiElement = document.getElementById('kpi-roi');
        roiElement.innerText = roi.toFixed(1) + "%";
        
        let roiTrend = document.getElementById('kpi-roi-trend');
        let cardRoi = document.getElementById('card-roi');
        if (roi > 0) {
            roiTrend.className = "kpi-trend trend-up";
            roiTrend.innerHTML = "▲ ROI Positivo";
            cardRoi.style.boxShadow = "0 10px 30px rgba(16, 185, 129, 0.1)";
            cardRoi.style.borderColor = "rgba(16, 185, 129, 0.2)";
        } else if (roi < 0) {
            roiTrend.className = "kpi-trend trend-down";
            roiTrend.innerHTML = "▼ ROI Negativo";
            cardRoi.style.boxShadow = "0 10px 30px rgba(244, 63, 94, 0.1)";
            cardRoi.style.borderColor = "rgba(244, 63, 94, 0.2)";
        } else {
            roiTrend.className = "kpi-trend trend-neutral";
            roiTrend.innerHTML = "● Nessun Ritorno";
            cardRoi.style.boxShadow = "none";
            cardRoi.style.borderColor = "rgba(255, 255, 255, 0.05)";
        }

        if (typeof Chart === 'undefined') {
            console.warn("Chart.js non è caricato. I grafici non saranno mostrati.");
            return;
        }

        Chart.defaults.font.family = "'Outfit', sans-serif";
        Chart.defaults.color = '#94a3b8';

        if(barChart) barChart.destroy();
        
        const barCtx = document.getElementById('barChart').getContext('2d');
        const gradRev = barCtx.createLinearGradient(0, 0, 0, 300);
        gradRev.addColorStop(0, 'rgba(99, 102, 241, 0.85)');
        gradRev.addColorStop(1, 'rgba(59, 130, 246, 0.15)');

        const gradCost = barCtx.createLinearGradient(0, 0, 0, 300);
        gradCost.addColorStop(0, 'rgba(244, 63, 94, 0.85)');
        gradCost.addColorStop(1, 'rgba(236, 72, 153, 0.15)');

        barChart = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: ['Bilancio Operativo'],
                datasets: [
                    {
                        label: 'Fatturato Previsto (€)',
                        data: [totalRev],
                        backgroundColor: gradRev,
                        borderColor: '#6366f1',
                        borderWidth: 2,
                        borderRadius: 12,
                        borderSkipped: false,
                        barPercentage: 0.4,
                        categoryPercentage: 0.4
                    },
                    {
                        label: 'Spese Previste (€)',
                        data: [totalCost],
                        backgroundColor: gradCost,
                        borderColor: '#f43f5e',
                        borderWidth: 2,
                        borderRadius: 12,
                        borderSkipped: false,
                        barPercentage: 0.4,
                        categoryPercentage: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#f1f5f9',
                            font: { size: 12, weight: '600' },
                            padding: 15
                        }
                    },
                    tooltip: {
                        backgroundColor: '#131520',
                        titleColor: '#ffffff',
                        bodyColor: '#e2e8f0',
                        borderColor: 'rgba(255, 255, 255, 0.08)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 10,
                        bodyFont: { size: 13 }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8', font: { weight: '600' } }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });

        if(doughChart) doughChart.destroy();
        const doughCtx = document.getElementById('doughnutChart').getContext('2d');
        
        doughChart = new Chart(doughCtx, {
            type: 'doughnut',
            data: {
                labels: ['Fatturato Previsto (€)', 'Spese Previste (€)'],
                datasets: [{
                    data: [totalRev, totalCost],
                    backgroundColor: ['rgba(99, 102, 241, 0.85)', 'rgba(244, 63, 94, 0.85)'],
                    borderColor: ['#6366f1', '#f43f5e'],
                    borderWidth: 2,
                    hoverOffset: 12
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#f1f5f9',
                            font: { size: 12, weight: '600' },
                            padding: 15
                        }
                    },
                    tooltip: {
                        backgroundColor: '#131520',
                        borderColor: 'rgba(255, 255, 255, 0.08)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 10,
                        bodyFont: { size: 13 }
                    }
                }
            }
        });
        
        if(cashFlowChart) cashFlowChart.destroy();
        const cfCtx = document.getElementById('cashFlowChart');
        if (cfCtx) {
            const gradCf = cfCtx.getContext('2d').createLinearGradient(0, 0, 0, 300);
            gradCf.addColorStop(0, 'rgba(16, 185, 129, 0.85)');
            gradCf.addColorStop(1, 'rgba(16, 185, 129, 0.1)');
            
            const monthLabels = [];
            const currentDate = new Date();
            for (let i = 0; i < 12; i++) {
                let d = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
                monthLabels.push(d.toLocaleString('it-IT', { month: 'short' }) + " " + String(d.getFullYear()).slice(-2));
            }
            
            cashFlowChart = new Chart(cfCtx, {
                type: 'line',
                data: {
                    labels: monthLabels,
                    datasets: [{
                        label: 'Entrate Previste (MRR) €',
                        data: cashFlowRev,
                        backgroundColor: gradCf,
                        borderColor: '#10b981',
                        borderWidth: 2,
                        pointBackgroundColor: '#131520',
                        pointBorderColor: '#10b981',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#131520',
                            titleColor: '#ffffff',
                            bodyColor: '#e2e8f0',
                            borderColor: 'rgba(255, 255, 255, 0.08)',
                            borderWidth: 1,
                            padding: 12,
                            cornerRadius: 10
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: '#94a3b8', font: { size: 10 } }
                        },
                        y: {
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { color: '#94a3b8', font: { size: 11 } }
                        }
                    }
                }
            });
        }
    }

    function renderDashboardAgenda() {
        const dashCont = document.getElementById('dash-planning');
        if (!dashCont) return;
        dashCont.innerHTML = '';
        
        const today = new Date();
        today.setHours(0,0,0,0);
        
        let agendaItems = [];
        const crmData = JSON.parse(localStorage.getItem('crm_inputs') || "{}");
        
        // Controlla i prossimi 7 giorni
        for (let i = 0; i < 7; i++) {
            let scanDate = new Date(today);
            scanDate.setDate(today.getDate() + i);
            let dateKey = scanDate.toISOString().split('T')[0];
            
            // Check critical day
            let isCritical = localStorage.getItem(`critical_day_${dateKey}`) === 'true';
            if (isCritical) {
                agendaItems.push({
                    date: dateKey,
                    time: "H 24",
                    txt: `⚠️ GIORNATA CRITICA / SCADENZE URGENTI`,
                    important: true,
                    type: 'critical'
                });
            }
            
            // Notes
            let notes = JSON.parse(localStorage.getItem(`note_${dateKey}`) || "[]");
            notes.forEach(n => {
                agendaItems.push({
                    date: dateKey,
                    time: n.time || "09:00",
                    txt: n.txt || "",
                    important: !!n.important,
                    type: 'manual'
                });
            });
            
            // CRM
            for (let contactName in crmData) {
                let appt = crmData[contactName];
                if (appt.date && appt.date.split('T')[0] === dateKey) {
                    let time = appt.date.split('T')[1] || "09:00";
                    agendaItems.push({
                        date: dateKey,
                        time: time,
                        txt: `📞 Appuntamento CRM con ${contactName}`,
                        important: false,
                        type: 'crm'
                    });
                }
            }
        }
        
        // Ordina per data e poi per ora
        agendaItems.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.time.localeCompare(b.time);
        });
        
        if (agendaItems.length === 0) {
            dashCont.innerHTML = `
                <div style="text-align: center; padding: 25px; color: #94a3b8; font-style: italic; font-size: 13px;">
                    📅 Nessun appuntamento o scadenza programmata per i prossimi 7 giorni.
                </div>
            `;
            return;
        }
        
        // Genera HTML
        let html = '<div style="display:flex; flex-direction:column; gap:10px; margin-top:10px;">';
        agendaItems.forEach(item => {
            let formattedDate = item.date.split('-').reverse().slice(0, 2).join('/'); // dd/mm
            let itemClass = 'item-card';
            let borderStyle = 'border-left: 4px solid #6366f1; margin: 0;';
            let icon = '📅';
            
            if (item.type === 'critical') {
                borderStyle = 'border-left: 4px solid #f43f5e; background: rgba(244, 63, 94, 0.08); color: #fda4af; margin: 0;';
                icon = '⚠️';
            } else if (item.important) {
                borderStyle = 'border-left: 4px solid #f43f5e; background: rgba(244, 63, 94, 0.03); margin: 0;';
                icon = '🔴';
            } else if (item.type === 'crm') {
                borderStyle = 'border-left: 4px solid #10b981; background: rgba(16, 185, 129, 0.03); margin: 0;';
                icon = '📞';
            }
            
            html += `
                <div class="${itemClass}" style="${borderStyle} padding: 12px 16px; border-radius: 10px; font-size: 13px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-weight: 700; background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; font-size: 11px; color:#a5b4fc;">
                            ${formattedDate} - ${item.time}
                        </span>
                        <span style="font-weight: 600; color: #fff;">${icon} ${item.txt}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        dashCont.innerHTML = html;
    }

    function refreshDashboard() { 
        updateAll(); 
        checkExpirations(); 
        renderDashboardAgenda();
    }

    // PREVENTIVATORE MULTISERVIZIO FUNCTIONS
    let canvas, ctx, drawing = false;
    let brushColor = '#f43f5e';
    let bgImage = null;

    function initCanvas() {
        canvas = document.getElementById('mapCanvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        
        redrawCanvas();
        
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);
        
        canvas.addEventListener('touchstart', startDrawingTouch, {passive: false});
        canvas.addEventListener('touchmove', drawTouch, {passive: false});
        canvas.addEventListener('touchend', stopDrawing);
    }

    function startDrawing(e) {
        drawing = true;
        const rect = canvas.getBoundingClientRect();
        // Calculate correct scaling in case client bounding box differs from internal width/height
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        ctx.beginPath();
        ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
    }

    function draw(e) {
        if (!drawing) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
        ctx.stroke();
    }

    function stopDrawing() {
        drawing = false;
    }

    function startDrawingTouch(e) {
        e.preventDefault();
        drawing = true;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const touch = e.touches[0];
        ctx.beginPath();
        ctx.moveTo((touch.clientX - rect.left) * scaleX, (touch.clientY - rect.top) * scaleY);
    }

    function drawTouch(e) {
        if (!drawing) return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const touch = e.touches[0];
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineTo((touch.clientX - rect.left) * scaleX, (touch.clientY - rect.top) * scaleY);
        ctx.stroke();
    }

    function selectBrush(color) {
        brushColor = color;
        document.querySelectorAll('.btn-brush').forEach(b => b.classList.remove('active'));
        if(color === '#f43f5e') document.getElementById('btn-brush-red').classList.add('active');
        if(color === '#10b981') document.getElementById('btn-brush-green').classList.add('active');
        if(color === '#3b82f6') document.getElementById('btn-brush-blue').classList.add('active');
    }

    function clearCanvas() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        bgImage = null;
        redrawCanvas();
    }

    function redrawCanvas() {
        if (!ctx) return;
        ctx.fillStyle = '#131520';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if (bgImage) {
            ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText('Nessuna mappa caricata. Seleziona uno screenshot di Maps/Earth', canvas.width / 2, canvas.height / 2 - 10);
            ctx.fillText('Usa i colori sopra per tracciare Aree Operative, Stoccaggio o Accessi', canvas.width / 2, canvas.height / 2 + 15);
        }
    }

    let cleanLayoutBase64 = "";

    function loadCleanLayoutImage(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(event) {
            cleanLayoutBase64 = event.target.result;
            const previewImg = document.getElementById('prev-layout-clean-preview');
            const placeholder = document.getElementById('prev-layout-clean-placeholder');
            if (previewImg && placeholder) {
                previewImg.src = cleanLayoutBase64;
                previewImg.style.display = 'block';
                placeholder.style.display = 'none';
            }
        }
        reader.readAsDataURL(file);
    }

    function removeCleanLayoutImage() {
        cleanLayoutBase64 = "";
        const previewImg = document.getElementById('prev-layout-clean-preview');
        const placeholder = document.getElementById('prev-layout-clean-placeholder');
        const fileInput = document.getElementById('prev-layout-clean-upload');
        if (previewImg && placeholder) {
            previewImg.src = "";
            previewImg.style.display = 'none';
            placeholder.style.display = 'block';
        }
        if (fileInput) fileInput.value = "";
    }

    function toggleLayoutPrintView() {
        const option = document.querySelector('input[name="layout-print-option"]:checked').value;
        const canvasBlock = document.getElementById('layout-canvas-editor-block');
        const uploadBlock = document.getElementById('layout-clean-upload-block');
        const noneBlock = document.getElementById('layout-none-block');
        
        if (option === 'canvas') {
            canvasBlock.style.display = 'block';
            uploadBlock.style.display = 'none';
            noneBlock.style.display = 'none';
        } else if (option === 'upload') {
            canvasBlock.style.display = 'none';
            uploadBlock.style.display = 'flex';
            noneBlock.style.display = 'none';
        } else {
            canvasBlock.style.display = 'none';
            uploadBlock.style.display = 'none';
            noneBlock.style.display = 'block';
        }
    }

    function loadMapImage(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                bgImage = img;
                redrawCanvas();
            }
            img.src = event.target.result;
        }
        reader.readAsDataURL(file);
    }

    function loadSavedCanvas(base64Data) {
        if (!base64Data) {
            clearCanvas();
            return;
        }
        const img = new Image();
        img.onload = function() {
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            }
            bgImage = img;
        }
        img.src = base64Data;
    }

    function switchPrevFormTab(tabName) {
        document.querySelectorAll('#prev-form-screen .tab-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('#prev-form-screen .tab-btn').forEach(b => b.classList.remove('active'));
        
        document.getElementById('prev-tab-content-' + tabName).classList.add('active');
        document.getElementById('prev-tab-btn-' + tabName).classList.add('active');
        
        if(tabName === 'logistica') {
            setTimeout(() => {
                initCanvas();
            }, 60);
        }
    }

    function getNextProtocolSequence() {
        const list = JSON.parse(localStorage.getItem('ares_preventivi') || "[]");
        return (list.length + 1).toString().padStart(3, '0');
    }

    function addCustomExpenseRow(desc = "", val = 0, isRec = false) {
        const container = document.getElementById('prev-custom-expenses-container');
        if (!container) return;
        
        const rowId = 'custom-expense-row-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
        
        const rowDiv = document.createElement('div');
        rowDiv.id = rowId;
        rowDiv.className = 'custom-expense-row';
        rowDiv.style.display = 'flex';
        rowDiv.style.gap = '10px';
        rowDiv.style.alignItems = 'center';
        
        rowDiv.innerHTML = `
            <input type="text" class="custom-exp-desc" placeholder="Es. Oneri o spese extra..." value="${desc}" style="flex:2; font-size:13px; padding:8px; background:rgba(0,0,0,0.25); color:#fff; border:1px solid rgba(255,255,255,0.08); border-radius:6px;">
            <input type="number" class="custom-exp-val" value="${val}" min="0" step="any" oninput="recalculateTotals()" placeholder="€" style="flex:1; font-size:13px; font-weight:bold; padding:8px; background:rgba(0,0,0,0.25); color:#fff; border:1px solid rgba(255,255,255,0.08); border-radius:6px; text-align:right;">
            <label style="display:flex; align-items:center; gap:4px; font-size:10px; cursor:pointer;"><input type="checkbox" class="custom-exp-rec" onchange="recalculateTotals()" ${isRec ? 'checked' : ''} style="accent-color:#10b981; margin:0;"> /mese</label>
            <button type="button" onclick="removeCustomExpenseRow('${rowId}')" style="background:transparent; border:none; color:#f43f5e; cursor:pointer; font-size:14px; padding:4px;" title="Rimuovi Spesa">✖</button>
        `;
        
        container.appendChild(rowDiv);
        recalculateTotals();
    }

    function updateLiveProtocol() {
        const year = new Date().getFullYear();
        const cliente = document.getElementById('prev-cliente').value.trim() || "CLIENTE";
        const servizio = document.getElementById('prev-servizio').value || "TRA";
        const provincia = (document.getElementById('prev-provincia').value.trim() || "RM").toUpperCase();
        const operatore = (document.getElementById('prev-operatore').value.trim() || "GL").toUpperCase();
        const segnalatore = (document.getElementById('prev-segnalatore').value.trim() || "VE").toUpperCase();
        
        let seq = "001";
        const editId = document.getElementById('prev-edit-id').value;
        if (editId) {
            const list = JSON.parse(localStorage.getItem('ares_preventivi') || "[]");
            const existing = list.find(p => p.id == editId);
            if (existing && existing.protocollo) {
                const parts = existing.protocollo.split('-');
                if (parts.length >= 7) {
                    seq = parts[6];
                }
            }
        } else {
            seq = getNextProtocolSequence();
        }
        
        const protocolCode = `ARES-${year}-${servizio}-${provincia}-${operatore}-${segnalatore}-${seq}`;
        document.getElementById('live-protocol-text').innerText = protocolCode;
        
        const expDiv = document.getElementById('live-protocol-explanation');
        if (expDiv) {
            let servText = "Servizio";
            if(servizio === 'TRA') servText = "🚚 Traslochi";
            if(servizio === 'PUL') servText = "🧹 Pulizie";
            if(servizio === 'GIA') servText = "🌱 Giardinaggio";
            if(servizio === 'DIS') servText = "🦟 Disinfestazione";
            if(servizio === 'EDI') servText = "🧱 Piccoli Edili";
            if(servizio === 'EVE') servText = "🎉 Allestimenti";
            if(servizio === 'ALT') servText = "⚙️ Altro Servizio";
            
            expDiv.innerHTML = `
                <span style="font-size:10px; background:rgba(255,255,255,0.06); color:#cbd5e1; padding:2px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.1);"><b>ARES</b>: Azienda</span>
                <span style="font-size:10px; background:rgba(255,255,255,0.06); color:#cbd5e1; padding:2px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.1);"><b>${year}</b>: Anno</span>
                <span style="font-size:10px; background:rgba(99,102,241,0.15); color:#818cf8; padding:2px 8px; border-radius:6px; border:1px solid rgba(99,102,241,0.25);"><b>${servizio}</b>: ${servText}</span>
                <span style="font-size:10px; background:rgba(255,255,255,0.06); color:#cbd5e1; padding:2px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.1);"><b>${provincia}</b>: Sede</span>
                <span style="font-size:10px; background:rgba(255,255,255,0.06); color:#cbd5e1; padding:2px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.1);"><b>${operatore}</b>: Operatore</span>
                <span style="font-size:10px; background:rgba(255,255,255,0.06); color:#cbd5e1; padding:2px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.1);"><b>${segnalatore}</b>: Segnalato da</span>
                <span style="font-size:10px; background:rgba(16,185,129,0.15); color:#10b981; padding:2px 8px; border-radius:6px; border:1px solid rgba(16,185,129,0.25);"><b>${seq}</b>: Seq.</span>
            `;
        }
        return protocolCode;
    }

    function toggleRicorrenteDurata() {
        const isRec = document.getElementById('prev-is-ricorrente').checked;
        const container = document.getElementById('prev-durata-container');
        if (isRec) {
            container.style.opacity = '1';
            container.style.pointerEvents = 'all';
        } else {
            container.style.opacity = '0.5';
            container.style.pointerEvents = 'none';
        }
    }

    function openNewPreventivoForm() {
        document.getElementById('prev-list-screen').style.display = 'none';
        document.getElementById('prev-form-screen').style.display = 'block';
        document.getElementById('prev-form-title').innerText = "Nuovo Progetto & Preventivo";
        
        document.getElementById('prev-edit-id').value = "";
        
        document.getElementById('prev-is-ricorrente').checked = false;
        document.getElementById('prev-mesi-ricorrenza').value = "12";
        toggleRicorrenteDurata();
        document.getElementById('prev-cliente').value = "";
        document.getElementById('prev-cantiere').value = "";
        document.getElementById('prev-referente').value = "";
        document.getElementById('prev-telefono').value = "";
        document.getElementById('prev-servizio').value = "TRA";
        document.getElementById('prev-provincia').value = "RM";
        document.getElementById('prev-operatore').value = "GL";
        document.getElementById('prev-segnalatore').value = "VE";
        document.getElementById('prev-log-spazio').value = "";
        document.getElementById('prev-log-contorno').value = "";
        document.getElementById('prev-tr-km').value = "0";
        document.getElementById('prev-tr-pedaggio').value = "0";
        document.getElementById('prev-tr-costokm').value = "0.35";
        document.getElementById('prev-tr-staff').value = "2";
        document.getElementById('prev-al-camera').value = "0";
        document.getElementById('prev-al-persone').value = "0";
        document.getElementById('prev-al-notti').value = "0";
        document.getElementById('prev-spese-presunte').value = "0";
        
        document.getElementById('prev-costo-furgone').value = "0";
        document.getElementById('prev-costo-attrezzature').value = "0";
        document.getElementById('prev-costo-manodopera').value = "0";
        clearCustomExpenses();
        addCustomExpenseRow("", 0);
        
        document.getElementById('prev-items-body').innerHTML = "";
        
        switchPrevFormTab('generali');
        updateLiveProtocol();
        calculateTrasferte();
        
        setTimeout(() => {
            initCanvas();
            clearCanvas();
        }, 80);
    }

    function closePreventivoForm() {
        document.getElementById('prev-list-screen').style.display = 'block';
        document.getElementById('prev-form-screen').style.display = 'none';
    }

    function calculateTrasferte() {
        const km = parseFloat(document.getElementById('prev-tr-km').value) || 0;
        const pedaggi = parseFloat(document.getElementById('prev-tr-pedaggio').value) || 0;
        const costoKM = parseFloat(document.getElementById('prev-tr-costokm').value) || 0;
        const staff = parseFloat(document.getElementById('prev-tr-staff').value) || 1;
        const diaria = parseFloat(document.getElementById('prev-tr-diaria').value) || 0;
        
        const costCamera = parseFloat(document.getElementById('prev-al-camera').value) || 0;
        const persone = parseFloat(document.getElementById('prev-al-persone').value) || 0;
        const notti = parseFloat(document.getElementById('prev-al-notti').value) || 0;
        
        const costoTrasferta = (km * 2 * costoKM) + pedaggi + (staff * diaria);
        const costoAlloggio = costCamera * persone * notti;
        
        document.getElementById('lbl-total-trasferta').innerText = "€ " + costoTrasferta.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        document.getElementById('lbl-total-alloggio').innerText = "€ " + costoAlloggio.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        
        const sumCostiLogistici = costoTrasferta + costoAlloggio;
        document.getElementById('lbl-costi-logistici-sum').innerText = "€ " + sumCostiLogistici.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        
        recalculateTotals();
    }
    function addCustomExpenseRow(desc = "", val = 0) {
        const container = document.getElementById('prev-custom-expenses-container');
        if (!container) return;
        
        const rowId = 'custom-expense-row-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
        
        const rowDiv = document.createElement('div');
        rowDiv.id = rowId;
        rowDiv.className = 'custom-expense-row';
        rowDiv.style.display = 'flex';
        rowDiv.style.gap = '10px';
        rowDiv.style.alignItems = 'center';
        
        rowDiv.innerHTML = `
            <input type="text" class="custom-exp-desc" placeholder="Es. Oneri o spese extra..." value="${desc}" style="flex:2; font-size:13px; padding:8px; background:rgba(0,0,0,0.25); color:#fff; border:1px solid rgba(255,255,255,0.08); border-radius:6px;">
            <input type="number" class="custom-exp-val" value="${val}" min="0" oninput="recalculateTotals()" placeholder="€" style="flex:1; font-size:13px; font-weight:bold; padding:8px; background:rgba(0,0,0,0.25); color:#fff; border:1px solid rgba(255,255,255,0.08); border-radius:6px; text-align:right;">
            <button type="button" onclick="removeCustomExpenseRow('${rowId}')" style="background:transparent; border:none; color:#f43f5e; font-size:14px; cursor:pointer; padding:6px; display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:6px; transition:background 0.2s;" onmouseover="this.style.background='rgba(244,63,94,0.1)'" onmouseout="this.style.background='transparent'">✖</button>
        `;
        container.appendChild(rowDiv);
        recalculateTotals();
    }
    
    function removeCustomExpenseRow(rowId) {
        const row = document.getElementById(rowId);
        if (row) {
            row.remove();
            recalculateTotals();
        }
    }
    
    function clearCustomExpenses() {
        const container = document.getElementById('prev-custom-expenses-container');
        if (container) container.innerHTML = "";
    }

    function addPrevCostRow(desc="", qta=1, um="Cad.", prezzo=0) {
        const tbody = document.getElementById('prev-items-body');
        if (!tbody) return;
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        tr.className = 'computo-row';
        
        tr.innerHTML = `
            <td style="padding:8px 4px;">
                <input type="text" class="row-desc" value="${desc}" placeholder="Descrizione del lavoro o materiale..." style="width:96%; background:rgba(0,0,0,0.15); border:1px solid rgba(255,255,255,0.05); border-radius:6px; color:#fff; padding:6px; font-size:11px;">
            </td>
            <td style="padding:8px 4px;">
                <input type="number" class="row-qta" value="${qta}" step="any" oninput="recalculateTotals()" style="width:90%; background:rgba(0,0,0,0.15); border:1px solid rgba(255,255,255,0.05); border-radius:6px; color:#fff; padding:6px; font-size:11px;">
            </td>
            <td style="padding:8px 4px;">
                <input type="text" class="row-um" value="${um}" placeholder="mq, ore, cad" style="width:90%; background:rgba(0,0,0,0.15); border:1px solid rgba(255,255,255,0.05); border-radius:6px; color:#fff; padding:6px; font-size:11px;">
            </td>
            <td style="padding:8px 4px;">
                <input type="number" class="row-prezzo" value="${prezzo}" step="any" oninput="recalculateTotals()" style="width:90%; background:rgba(0,0,0,0.15); border:1px solid rgba(255,255,255,0.05); border-radius:6px; color:#fff; padding:6px; font-size:11px;">
            </td>
            <td style="padding:8px 4px; font-weight:700; color:#fff; vertical-align:middle;" class="row-totale">
                € 0,00
            </td>
            <td style="padding:8px 4px; text-align:center; vertical-align:middle;">
                <button onclick="this.closest('tr').remove(); recalculateTotals();" style="background:transparent; border:none; color:#f43f5e; cursor:pointer; font-size:13px;" title="Rimuovi">✖</button>
            </td>
        `;
        tbody.appendChild(tr);
        recalculateTotals();
    }

    function recalculateTotals() {
        let subtotalVoci = 0;
        document.querySelectorAll('.computo-row').forEach(tr => {
            const qta = parseFloat(tr.querySelector('.row-qta').value) || 0;
            const prezzo = parseFloat(tr.querySelector('.row-prezzo').value) || 0;
            const totalRow = qta * prezzo;
            const totalCell = tr.querySelector('.row-totale');
            
            if (totalRow < 0) {
                totalCell.style.color = '#fb923c'; // Colore arancio per gli sconti
                totalCell.innerText = "- € " + Math.abs(totalRow).toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            } else {
                totalCell.style.color = '#fff';
                totalCell.innerText = "€ " + totalRow.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            }
            subtotalVoci += totalRow;
        });
        
        const km = parseFloat(document.getElementById('prev-tr-km').value) || 0;
        const pedaggi = parseFloat(document.getElementById('prev-tr-pedaggio').value) || 0;
        const costoKM = parseFloat(document.getElementById('prev-tr-costokm').value) || 0;
        const staff = parseFloat(document.getElementById('prev-tr-staff').value) || 1;
        const diaria = parseFloat(document.getElementById('prev-tr-diaria').value) || 0;
        const costoTrasferta = (km * 2 * costoKM) + pedaggi + (staff * diaria);
        
        const costCamera = parseFloat(document.getElementById('prev-al-camera').value) || 0;
        const persone = parseFloat(document.getElementById('prev-al-persone').value) || 0;
        const notti = parseFloat(document.getElementById('prev-al-notti').value) || 0;
        const costoAlloggio = costCamera * persone * notti;
        
        const totalTrasferte = costoTrasferta + costoAlloggio;
        
        // Calcolo totale fatturato
        let totalPreventivo = subtotalVoci;
        const isRicorrente = document.getElementById('prev-is-ricorrente').checked;
        const mesiRicorrenza = parseInt(document.getElementById('prev-mesi-ricorrenza').value) || 12;
        if (isRicorrente) {
            totalPreventivo = totalPreventivo * mesiRicorrenza;
        }
        
        document.getElementById('lbl-subtotale-voci').innerText = "€ " + totalPreventivo.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + (isRicorrente ? ` (${mesiRicorrenza} mesi)` : "");
        
        const ivaFlag = document.getElementById('prev-iva-flag').checked;
        if (ivaFlag) {
            const iva = totalPreventivo * 0.22;
            const totalWithIva = totalPreventivo * 1.22;
            document.getElementById('lbl-totale-preventivo').innerHTML = `€ ${totalPreventivo.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span style="font-size:12px; font-weight:normal; color:#a5b4fc;">(+ IVA € ${iva.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2})} = € ${totalWithIva.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2})})</span>`;
        } else {
            document.getElementById('lbl-totale-preventivo').innerText = "€ " + totalPreventivo.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        }
        
        // Calcolo della spesa complessiva interna basata sul worksheet di costo
        const furgoneMesi = (isRicorrente && document.getElementById('prev-rec-furgone').checked) ? mesiRicorrenza : 1;
        const costoFurgone = (parseFloat(document.getElementById('prev-costo-furgone').value) || 0) * furgoneMesi;
        
        const attrMesi = (isRicorrente && document.getElementById('prev-rec-attrezzature').checked) ? mesiRicorrenza : 1;
        const costoAttrezzature = (parseFloat(document.getElementById('prev-costo-attrezzature').value) || 0) * attrMesi;
        
        const manoMesi = (isRicorrente && document.getElementById('prev-rec-manodopera').checked) ? mesiRicorrenza : 1;
        const costoManodopera = (parseFloat(document.getElementById('prev-costo-manodopera').value) || 0) * manoMesi;
        
        // Anche trasferte e alloggio possono essere ricorrenti
        const trMesi = (isRicorrente && document.getElementById('prev-tr-ricorrente') && document.getElementById('prev-tr-ricorrente').checked) ? mesiRicorrenza : 1;
        const totalTrasferte = (costoTrasferta + costoAlloggio) * trMesi;
        
        let customSpeseSum = 0;
        document.querySelectorAll('.custom-expense-row').forEach(row => {
            const val = parseFloat(row.querySelector('.custom-exp-val').value) || 0;
            const isRec = row.querySelector('.custom-exp-rec').checked;
            customSpeseSum += val * ((isRicorrente && isRec) ? mesiRicorrenza : 1);
        });
        
        // Spese totali = Costi Logistici Automt. (Trasferta & Alloggio) + Spese Manuali + Spese Custom
        const totalSpese = totalTrasferte + costoFurgone + costoAttrezzature + costoManodopera + customSpeseSum;
        
        // Aggiorna indicatori UI grandi
        document.getElementById('lbl-totale-spese-worksheet').innerText = "€ " + totalSpese.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        document.getElementById('lbl-costi-logistici-sum').innerText = "€ " + totalTrasferte.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        
        // Scrive nel vecchio campo nascosto così non rompiamo i salvataggi esistenti
        document.getElementById('prev-spese-presunte').value = totalSpese;
        
        const margine = totalPreventivo - totalSpese;
        const marginPerc = totalPreventivo > 0 ? (margine / totalPreventivo) * 100 : 0;
        const roi = totalSpese > 0 ? (margine / totalSpese) * 100 : 0;
        
        const bilancioCard = document.getElementById('prev-bilancio-card');
        const bilancioLabel = document.getElementById('prev-bilancio-label');
        const margineEl = document.getElementById('lbl-margine-stimato');
        const roiEl = document.getElementById('lbl-roi-stimato');
        
        const marginFormatted = "€ " + margine.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        
        // Aggiorna la lancetta del tachimetro SVG (rotazione da -90deg a +90deg)
        const needle = document.getElementById('gauge-needle');
        if (needle) {
            let angle = -90; // Default a inizio scala (Rosso/Perdita)
            if (totalSpese > 0) {
                const ratio = totalPreventivo / totalSpese;
                if (ratio < 1) {
                    // Sotto costo: mappa da -90 a -45 gradi
                    angle = -90 + (ratio * 45);
                } else if (ratio < 2) {
                    // Pareggio: mappa da -45 a 0 gradi
                    angle = -45 + ((ratio - 1) * 45);
                } else if (ratio < 4) {
                    // Margine buono: mappa da 0 a 45 gradi
                    angle = 0 + (((ratio - 2) / 2) * 45);
                } else {
                    // Margine ottimo: mappa da 45 a 90 gradi
                    angle = 45 + Math.min(45, (((ratio - 4) / 6) * 45));
                }
            }
            needle.style.transform = `rotate(${angle}deg)`;
        }
        
        if (totalPreventivo < totalSpese) {
            // ROSSO: Sotto costo o perdita
            bilancioCard.style.border = '2px solid rgba(239, 68, 68, 0.4)';
            bilancioCard.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.15)';
            bilancioLabel.innerText = "🔴 Sotto Costo (Perdita)";
            bilancioLabel.style.color = '#fca5a5';
            margineEl.style.color = '#ef4444';
            margineEl.innerText = marginFormatted;
            roiEl.innerText = `Mancano € ${(totalSpese - totalPreventivo).toLocaleString('it-IT', {minimumFractionDigits: 2})} per coprire le spese`;
            roiEl.style.color = '#cbd5e1';
        } else if (totalPreventivo >= totalSpese && totalPreventivo < 2 * totalSpese) {
            // ARANCIONE: Pareggio
            bilancioCard.style.border = '2px solid rgba(249, 115, 22, 0.4)';
            bilancioCard.style.boxShadow = '0 0 15px rgba(249, 115, 22, 0.15)';
            bilancioLabel.innerText = "🟠 Pareggio Raggiunto";
            bilancioLabel.style.color = '#ffedd5';
            margineEl.style.color = '#f97316';
            margineEl.innerText = marginFormatted;
            roiEl.innerText = `Margine Netto: € ${margine.toLocaleString('it-IT', {minimumFractionDigits: 2})} | ROI: ${roi.toFixed(1)}%`;
            roiEl.style.color = '#fed7aa';
        } else if (totalPreventivo >= 2 * totalSpese && totalPreventivo < 4 * totalSpese) {
            // GIALLO: Margine pari alle spese
            bilancioCard.style.border = '2px solid rgba(234, 179, 8, 0.4)';
            bilancioCard.style.boxShadow = '0 0 15px rgba(234, 179, 8, 0.15)';
            bilancioLabel.innerText = "🟡 Margine Buono (Margine >= Spese)";
            bilancioLabel.style.color = '#fef9c3';
            margineEl.style.color = '#eab308';
            margineEl.innerText = marginFormatted;
            roiEl.innerText = `Margine Netto: € ${margine.toLocaleString('it-IT', {minimumFractionDigits: 2})} | ROI: ${roi.toFixed(1)}%`;
            roiEl.style.color = '#fef08a';
        } else {
            // VERDE: Margine almeno 3 volte le spese (ricavo >= 4 * spese)
            bilancioCard.style.border = '2px solid rgba(34, 197, 94, 0.4)';
            bilancioCard.style.boxShadow = '0 0 15px rgba(34, 197, 94, 0.15)';
            bilancioLabel.innerText = "🟢 Margine Ottimo! (Margine >= 3x Spese)";
            bilancioLabel.style.color = '#dcfce7';
            margineEl.style.color = '#22c55e';
            margineEl.innerText = marginFormatted;
            roiEl.innerText = `Margine Netto: € ${margine.toLocaleString('it-IT', {minimumFractionDigits: 2})} | ROI: ${roi.toFixed(1)}%`;
            roiEl.style.color = '#bbf7d0';
        }
    }

    async function savePreventivo(stato) {
        const cliente = document.getElementById('prev-cliente').value.trim();
        if (!cliente) {
            alert("Inserisci il nome del cliente!");
            switchPrevFormTab('generali');
            return;
        }
        
        const protocollo = updateLiveProtocol();
        const cantiere = document.getElementById('prev-cantiere').value.trim();
        const referente = document.getElementById('prev-referente').value.trim();
        const telefono = document.getElementById('prev-telefono').value.trim();
        const servizio = document.getElementById('prev-servizio').value;
        const provincia = document.getElementById('prev-provincia').value.trim().toUpperCase();
        const operatore = document.getElementById('prev-operatore').value.trim().toUpperCase();
        const segnalatore = document.getElementById('prev-segnalatore').value.trim().toUpperCase();
        const noteLogistica = document.getElementById('prev-log-spazio').value.trim();
        const noteContorno = document.getElementById('prev-log-contorno').value.trim();
        
        const km = parseFloat(document.getElementById('prev-tr-km').value) || 0;
        const pedaggi = parseFloat(document.getElementById('prev-tr-pedaggio').value) || 0;
        const costoKM = parseFloat(document.getElementById('prev-tr-costokm').value) || 0;
        const staff = parseFloat(document.getElementById('prev-tr-staff').value) || 1;
        const diaria = parseFloat(document.getElementById('prev-tr-diaria').value) || 0;
        const costoTrasferta = (km * 2 * costoKM) + pedaggi + (staff * diaria);
        
        const costCamera = parseFloat(document.getElementById('prev-al-camera').value) || 0;
        const persone = parseFloat(document.getElementById('prev-al-persone').value) || 0;
        const notti = parseFloat(document.getElementById('prev-al-notti').value) || 0;
        const costoAlloggio = costCamera * persone * notti;
        
        const spesePresunte = parseFloat(document.getElementById('prev-spese-presunte').value) || 0;
        const ivaFlag = document.getElementById('prev-iva-flag').checked;
        const isRicorrente = document.getElementById('prev-is-ricorrente').checked;
        const mesiRicorrenza = parseInt(document.getElementById('prev-mesi-ricorrenza').value) || 12;
        
        const voci = [];
        document.querySelectorAll('.computo-row').forEach(tr => {
            const desc = tr.querySelector('.row-desc').value.trim();
            const qta = parseFloat(tr.querySelector('.row-qta').value) || 0;
            const um = tr.querySelector('.row-um').value.trim();
            const prezzo = parseFloat(tr.querySelector('.row-prezzo').value) || 0;
            if (desc) {
                voci.push({ desc, qta, um, prezzo, totale: qta * prezzo });
            }
        });
        
        // Aggiunta metadati locali in modo sicuro per il database
        voci.push({ desc: "__DIARIA__:" + diaria, qta: 0, um: "", prezzo: 0, totale: 0 });
        voci.push({ desc: "__IVA__:" + (ivaFlag ? "true" : "false"), qta: 0, um: "", prezzo: 0, totale: 0 });
        voci.push({ desc: "__RICORRENTE__:" + (isRicorrente ? "true" : "false"), qta: 0, um: "", prezzo: 0, totale: 0 });
        voci.push({ desc: "__DURATA_MESI__:" + mesiRicorrenza, qta: 0, um: "", prezzo: 0, totale: 0 });
        
        const costoFurgone = parseFloat(document.getElementById('prev-costo-furgone').value) || 0;
        const costoAttrezzature = parseFloat(document.getElementById('prev-costo-attrezzature').value) || 0;
        const costoManodopera = parseFloat(document.getElementById('prev-costo-manodopera').value) || 0;
        
        voci.push({ desc: "__FURGONE__:" + costoFurgone, qta: 0, um: "", prezzo: 0, totale: 0 });
        voci.push({ desc: "__ATTREZZATURE__:" + costoAttrezzature, qta: 0, um: "", prezzo: 0, totale: 0 });
        voci.push({ desc: "__MANODOPERA__:" + costoManodopera, qta: 0, um: "", prezzo: 0, totale: 0 });
        
        const customRows = document.querySelectorAll('.custom-expense-row');
        customRows.forEach((row, i) => {
            const cDesc = row.querySelector('.custom-exp-desc').value.trim();
            const cVal = parseFloat(row.querySelector('.custom-exp-val').value) || 0;
            const cRec = row.querySelector('.custom-exp-rec').checked;
            voci.push({ desc: `__CUSTOM_DESC_${i}__:` + cDesc, qta: 0, um: "", prezzo: 0, totale: 0 });
            voci.push({ desc: `__CUSTOM_VAL_${i}__:` + cVal, qta: 0, um: "", prezzo: 0, totale: 0 });
            voci.push({ desc: `__CUSTOM_REC_${i}__:` + (cRec ? "true" : "false"), qta: 0, um: "", prezzo: 0, totale: 0 });
        });
        
        // Salvataggio checkbox spese ricorrenti
        const recFurgone = document.getElementById('prev-rec-furgone').checked;
        const recAttrezzature = document.getElementById('prev-rec-attrezzature').checked;
        const recManodopera = document.getElementById('prev-rec-manodopera').checked;
        const recTrasferte = document.getElementById('prev-tr-ricorrente') ? document.getElementById('prev-tr-ricorrente').checked : false;
        voci.push({ desc: "__REC_FURGONE__:" + (recFurgone ? "true" : "false"), qta: 0, um: "", prezzo: 0, totale: 0 });
        voci.push({ desc: "__REC_ATTREZZATURE__:" + (recAttrezzature ? "true" : "false"), qta: 0, um: "", prezzo: 0, totale: 0 });
        voci.push({ desc: "__REC_MANODOPERA__:" + (recManodopera ? "true" : "false"), qta: 0, um: "", prezzo: 0, totale: 0 });
        voci.push({ desc: "__REC_TRASFERTE__:" + (recTrasferte ? "true" : "false"), qta: 0, um: "", prezzo: 0, totale: 0 });
        
        // Subtotale voci pulito e trasferimento già inclusi se ricorrenti o no.
        // Wait, recalculateTotals already calculates the correct totalPreventivo including mesiRicorrenza.
        // But the saved totalePreventivo shouldn't be recalculated here in a flawed way.
        // Let's use the UI's already calculated subtotal if possible, or recalculate exactly as UI does.
        let totalePreventivo = subtotalVoci;
        if (isRicorrente) {
            totalePreventivo = totalePreventivo * mesiRicorrenza;
        }
        
        const layoutPrintOption = document.querySelector('input[name="layout-print-option"]:checked').value;
        voci.push({ desc: "__LAYOUT_MODE__:" + layoutPrintOption, qta: 0, um: "", prezzo: 0, totale: 0 });

        let canvasData = "";
        if (layoutPrintOption === 'canvas') {
            if (canvas) {
                canvasData = canvas.toDataURL("image/png");
            }
        } else if (layoutPrintOption === 'upload') {
            canvasData = cleanLayoutBase64;
        }
        
        const editId = document.getElementById('prev-edit-id').value;
        let list = JSON.parse(localStorage.getItem('ares_preventivi') || "[]");
        
        const prevObj = {
            id: editId ? parseInt(editId) : Date.now(),
            protocollo,
            cliente,
            cantiere,
            referente,
            telefono,
            servizio,
            provincia,
            operatore,
            segnalatore,
            noteLogistica,
            noteContorno,
            distanzaKM: km,
            pedaggi,
            costoChilometrico: costoKM,
            staffTrasferta: staff,
            costoTrasferta,
            costoCamera: costCamera,
            personeHotel: persone,
            nottiHotel: notti,
            costoAlloggio,
            spesePresunte,
            voci,
            totalePreventivo,
            canvasData,
            stato: stato,
            dataCreazione: editId ? (list.find(p => p.id == editId)?.dataCreazione || new Date().toLocaleDateString('it-IT')) : new Date().toLocaleDateString('it-IT')
        };
        
        if (editId) {
            list = list.map(p => p.id == editId ? prevObj : p);
        } else {
            list.push(prevObj);
        }
        
        localStorage.setItem('ares_preventivi', JSON.stringify(list));
        
        closePreventivoForm();
        renderPreventivi();
        updateAll();
        if (typeof refreshDashboard === 'function') {
            refreshDashboard();
        }

        // Auto-creazione fascicolo se convalidato
        if (stato === 'convalidato') {
            try { if (typeof autoCreateFascicoloFromPreventivo === 'function') autoCreateFascicoloFromPreventivo(prevObj); } catch(e){}
        }

        // Sincronizzazione in Cloud
        if (supabaseClient) {
            try {
                const { error } = await supabaseClient.from('ares_preventivi').upsert({
                    id: prevObj.id,
                    protocollo: prevObj.protocollo,
                    cliente: prevObj.cliente,
                    cantiere: prevObj.cantiere,
                    referente: prevObj.referente,
                    telefono: prevObj.telefono,
                    servizio: prevObj.servizio,
                    provincia: prevObj.provincia,
                    operatore: prevObj.operatore,
                    segnalatore: prevObj.segnalatore,
                    note_logistica: prevObj.noteLogistica,
                    note_contorno: prevObj.noteContorno,
                    distanza_km: prevObj.distanzaKM,
                    pedaggi: prevObj.pedaggi,
                    costo_chilometrico: prevObj.costoChilometrico,
                    staff_trasferta: prevObj.staffTrasferta,
                    costo_trasferta: prevObj.costoTrasferta,
                    costo_camera: prevObj.costoCamera,
                    persone_hotel: prevObj.personeHotel,
                    notti_hotel: prevObj.nottiHotel,
                    costo_alloggio: prevObj.costoAlloggio,
                    spese_presunte: prevObj.spesePresunte,
                    voci: prevObj.voci,
                    totale_preventivo: prevObj.totalePreventivo,
                    canvas_data: prevObj.canvasData,
                    stato: prevObj.stato,
                    data_creazione: prevObj.dataCreazione
                }, { onConflict: 'id' });
                if (error) throw error;
            } catch (err) {
                console.error("Errore salvataggio preventivo su Cloud:", err);
                showCloudStatus("Errore Sync Preventivo. Salvato in locale.", "error");
            }
        }
    }

    function renderPreventivi() {
        const list = JSON.parse(localStorage.getItem('ares_preventivi') || "[]");
        
        let totalAll = 0;
        let totalConvalidated = 0;
        let sumMargin = 0;
        let countConvalidated = 0;
        
        list.forEach(p => {
            totalAll += p.totalePreventivo || 0;
            if (p.stato === 'convalidato') {
                totalConvalidated += p.totalePreventivo || 0;
                const margin = p.totalePreventivo - p.spesePresunte;
                const marginPerc = p.totalePreventivo > 0 ? (margin / p.totalePreventivo) * 100 : 0;
                sumMargin += marginPerc;
                countConvalidated++;
            }
        });
        
        const avgMargin = countConvalidated > 0 ? (sumMargin / countConvalidated) : 0;
        
        document.getElementById('prev-kpi-total').innerText = "€ " + totalAll.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        document.getElementById('prev-kpi-convalidated').innerText = "€ " + totalConvalidated.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        document.getElementById('prev-kpi-avg-margin').innerText = avgMargin.toFixed(1) + "%";
        
        const tbody = document.getElementById('preventivi-list-body');
        if (!tbody) return;
        tbody.innerHTML = "";
        
        if (list.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding:30px; color:#94a3b8; font-style:italic;">
                        Nessun preventivo presente in archivio. Clicca su "Nuovo Preventivo" per iniziare!
                    </td>
                </tr>
            `;
            return;
        }
        
        list.forEach(p => {
            let servText = "Altro";
            let servColor = "rgba(148, 163, 184, 0.15)";
            if(p.servizio === 'TRA') { servText = "🚚 Traslochi"; servColor = "rgba(99, 102, 241, 0.15)"; }
            if(p.servizio === 'PUL') { servText = "🧹 Pulizie"; servColor = "rgba(16, 185, 129, 0.15)"; }
            if(p.servizio === 'GIA') { servText = "🌱 Giardinaggio"; servColor = "rgba(34, 197, 94, 0.15)"; }
            if(p.servizio === 'DIS') { servText = "🦟 Disinfestazione"; servColor = "rgba(239, 68, 68, 0.15)"; }
            if(p.servizio === 'EDI') { servText = "🧱 Piccoli Edili"; servColor = "rgba(245, 158, 11, 0.15)"; }
            if(p.servizio === 'EVE') { servText = "🎉 Eventi"; servColor = "rgba(236, 72, 153, 0.15)"; }
            
            let statoBadge = "";
            if (p.stato === 'convalidato') {
                statoBadge = `<span style="background:rgba(16, 185, 129, 0.15); color:#10b981; border:1px solid rgba(16, 185, 129, 0.25); padding:3px 8px; border-radius:6px; font-weight:700; font-size:10px; text-transform:uppercase;">Convalidato</span>`;
            } else {
                statoBadge = `<span style="background:rgba(245, 158, 11, 0.15); color:#f59e0b; border:1px solid rgba(245, 158, 11, 0.25); padding:3px 8px; border-radius:6px; font-weight:700; font-size:10px; text-transform:uppercase;">Bozza</span>`;
            }
            
            const margin = p.totalePreventivo - p.spesePresunte;
            const marginPerc = p.totalePreventivo > 0 ? (margin / p.totalePreventivo) * 100 : 0;
            
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(255,255,255,0.06)';
            tr.style.transition = 'all 0.2s';
            
            tr.innerHTML = `
                <td style="padding:12px 8px; font-weight:700; color:#fff; font-family:'Outfit';">${p.protocollo}</td>
                <td style="padding:12px 8px;">
                    <b>${p.cliente}</b>
                    ${p.cantiere ? `<div style="font-size:10px; color:#94a3b8; margin-top:2px;">📍 ${p.cantiere}</div>` : ''}
                </td>
                <td style="padding:12px 8px;">
                    <span style="background:${servColor}; border-radius:6px; padding:2px 8px; font-size:10px; font-weight:600;">${servText}</span>
                </td>
                <td style="padding:12px 8px; font-weight:700; color:#10b981;">€ ${p.totalePreventivo.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style="padding:12px 8px; font-weight:600; color:${margin >= 0 ? '#10b981' : '#f43f5e'};">
                    € ${margin.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${marginPerc.toFixed(1)}%)
                </td>
                <td style="padding:12px 8px;">${statoBadge}</td>
                <td style="padding:12px 8px; text-align:right;">
                    <button class="btn-action" onclick="toggleConvalida(${p.id})" style="padding:4px 8px; font-size:11px; margin-right:4px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); cursor:pointer;" title="${p.stato === 'convalidato' ? 'Riapri preventivo' : 'Convalida preventivo'}">
                        ${p.stato === 'convalidato' ? '↩️ Riapri' : '✅ Convalida'}
                    </button>
                    <button class="btn-action" onclick="editPreventivo(${p.id})" style="padding:4px 8px; font-size:11px; margin-right:4px; background:rgba(99, 102, 241, 0.15); border:1px solid rgba(99, 102, 241, 0.3); color:#818cf8; cursor:pointer;" title="Modifica">
                        Modifica 📝
                    </button>
                    <button class="btn-action" onclick="stampaPreventivo(${p.id})" style="padding:4px 8px; font-size:11px; margin-right:4px; background:rgba(59, 130, 246, 0.15); border:1px solid rgba(59, 130, 246, 0.3); color:#60a5fa; cursor:pointer;" title="Stampa cliente">
                        Stampa 🖨️
                    </button>
                    <button class="btn-action btn-danger" onclick="deletePreventivo(${p.id})" style="padding:4px 8px; font-size:11px; cursor:pointer;" title="Elimina">
                        🗑️
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function editPreventivo(id) {
        const list = JSON.parse(localStorage.getItem('ares_preventivi') || "[]");
        const p = list.find(item => item.id == id);
        if (!p) return;
        
        document.getElementById('prev-list-screen').style.display = 'none';
        document.getElementById('prev-form-screen').style.display = 'block';
        document.getElementById('prev-form-title').innerText = "Modifica Preventivo " + p.protocollo;
        
        document.getElementById('prev-edit-id').value = p.id;
        document.getElementById('prev-cliente').value = p.cliente || "";
        document.getElementById('prev-cantiere').value = p.cantiere || "";
        document.getElementById('prev-referente').value = p.referente || "";
        document.getElementById('prev-telefono').value = p.telefono || "";
        document.getElementById('prev-servizio').value = p.servizio || "TRA";
        document.getElementById('prev-provincia').value = p.provincia || "RM";
        document.getElementById('prev-operatore').value = p.operatore || "GL";
        document.getElementById('prev-segnalatore').value = p.segnalatore || "VE";
        document.getElementById('prev-log-spazio').value = p.noteLogistica || "";
        document.getElementById('prev-log-contorno').value = p.noteContorno || "";
        
        document.getElementById('prev-tr-km').value = p.distanzaKM || 0;
        document.getElementById('prev-tr-pedaggio').value = p.pedaggi || 0;
        document.getElementById('prev-tr-costokm').value = p.costoChilometrico || 0.35;
        document.getElementById('prev-tr-staff').value = p.staffTrasferta || 2;
        
        document.getElementById('prev-al-camera').value = p.costoCamera || 0;
        document.getElementById('prev-al-persone').value = p.personeHotel || 0;
        document.getElementById('prev-al-notti').value = p.nottiHotel || 0;
        
        document.getElementById('prev-spese-presunte').value = p.spesePresunte || 0;
        
        const tbody = document.getElementById('prev-items-body');
        tbody.innerHTML = "";
        let diaria = 0;
        let applicaIva = false;
        
        // Reset Worksheet fields before loading
        document.getElementById('prev-costo-furgone').value = 0;
        document.getElementById('prev-costo-attrezzature').value = 0;
        document.getElementById('prev-costo-manodopera').value = 0;
        clearCustomExpenses();
        
        const customDescs = {};
        const customVals = {};
        const customRecs = {};

        let layoutMode = "";
        
        let recFurgone = false;
        let recAttrezzature = false;
        let recManodopera = false;
        let recTrasferte = false;

        if (p.voci && p.voci.length > 0) {
            p.voci.forEach(v => {
                if (v.desc && v.desc.startsWith("__DIARIA__:")) {
                    diaria = parseFloat(v.desc.substring(11)) || 0;
                } else if (v.desc && v.desc.startsWith("__IVA__:")) {
                    applicaIva = v.desc.substring(8) === "true";
                } else if (v.desc && v.desc.startsWith("__FURGONE__:")) {
                    document.getElementById('prev-costo-furgone').value = parseFloat(v.desc.substring(12)) || 0;
                } else if (v.desc && v.desc.startsWith("__ATTREZZATURE__:")) {
                    document.getElementById('prev-costo-attrezzature').value = parseFloat(v.desc.substring(17)) || 0;
                } else if (v.desc && v.desc.startsWith("__MANODOPERA__:")) {
                    document.getElementById('prev-costo-manodopera').value = parseFloat(v.desc.substring(15)) || 0;
                } else if (v.desc && v.desc.startsWith("__REC_FURGONE__:")) {
                    recFurgone = v.desc.substring(16) === "true";
                } else if (v.desc && v.desc.startsWith("__REC_ATTREZZATURE__:")) {
                    recAttrezzature = v.desc.substring(21) === "true";
                } else if (v.desc && v.desc.startsWith("__REC_MANODOPERA__:")) {
                    recManodopera = v.desc.substring(19) === "true";
                } else if (v.desc && v.desc.startsWith("__REC_TRASFERTE__:")) {
                    recTrasferte = v.desc.substring(18) === "true";
                } else if (v.desc && v.desc.startsWith("__LAYOUT_MODE__:")) {
                    layoutMode = v.desc.substring(16);
                } else if (v.desc && v.desc.startsWith("__CUSTOM_DESC_")) {
                    const matchDesc = v.desc.match(/^__CUSTOM_DESC_(\d+)__:(.*)$/);
                    if (matchDesc) {
                        const idx = parseInt(matchDesc[1]);
                        customDescs[idx] = matchDesc[2];
                    }
                } else if (v.desc && v.desc.startsWith("__CUSTOM_VAL_")) {
                    const matchVal = v.desc.match(/^__CUSTOM_VAL_(\d+)__:(.*)$/);
                    if (matchVal) {
                        const idx = parseInt(matchVal[1]);
                        customVals[idx] = parseFloat(matchVal[2]) || 0;
                    }
                } else if (v.desc && v.desc.startsWith("__CUSTOM_REC_")) {
                    const matchRec = v.desc.match(/^__CUSTOM_REC_(\d+)__:(.*)$/);
                    if (matchRec) {
                        const idx = parseInt(matchRec[1]);
                        customRecs[idx] = matchRec[2] === "true";
                    }
                } else {
                    addPrevCostRow(v.desc, v.qta, v.um, v.prezzo);
                }
            });
            
            // Reconstruct dynamic rows based on collected indices
            const indices = Object.keys(customDescs).map(Number).sort((a, b) => a - b);
            if (indices.length > 0) {
                indices.forEach(idx => {
                    addCustomExpenseRow(customDescs[idx], customVals[idx] || 0, customRecs[idx] || false);
                });
            } else {
                addCustomExpenseRow("", 0, false);
            }
        } else {
            addCustomExpenseRow("", 0, false);
        }
        
        // Restore fixed expenses rec flags
        if(document.getElementById('prev-rec-furgone')) document.getElementById('prev-rec-furgone').checked = recFurgone;
        if(document.getElementById('prev-rec-attrezzature')) document.getElementById('prev-rec-attrezzature').checked = recAttrezzature;
        if(document.getElementById('prev-rec-manodopera')) document.getElementById('prev-rec-manodopera').checked = recManodopera;
        if(document.getElementById('prev-tr-ricorrente')) document.getElementById('prev-tr-ricorrente').checked = recTrasferte;
        
        // Restore Ricorrente
        let isRic = false;
        let mesiRic = 12;
        if (p.voci) {
            p.voci.forEach(v => {
                if (v.desc && v.desc.startsWith("__RICORRENTE__:true")) isRic = true;
                if (v.desc && v.desc.startsWith("__DURATA_MESI__:__")) {
                    // Note: saved as "__DURATA_MESI__:12" so split fallback
                    mesiRic = parseInt(v.desc.split(":")[1]) || 12;
                } else if (v.desc && v.desc.startsWith("__DURATA_MESI__:")){
                    mesiRic = parseInt(v.desc.split(":")[1]) || 12;
                }
            });
        }
        document.getElementById('prev-is-ricorrente').checked = isRic;
        document.getElementById('prev-mesi-ricorrenza').value = mesiRic;
        if(typeof toggleRicorrenteDurata === 'function') toggleRicorrenteDurata();

        
        // Restore layout mode UI options
        if (!layoutMode) {
            layoutMode = (p.canvasData && p.canvasData !== "") ? "canvas" : "none";
        }
        
        const radioBtn = document.querySelector(`input[name="layout-print-option"][value="${layoutMode}"]`);
        if (radioBtn) {
            radioBtn.checked = true;
        }
        
        removeCleanLayoutImage(); // Reset upload file input
        toggleLayoutPrintView(); // Show/hide correct UI wrapper

        document.getElementById('prev-tr-diaria').value = diaria;
        document.getElementById('prev-iva-flag').checked = applicaIva;
        
        switchPrevFormTab('generali');
        updateLiveProtocol();
        calculateTrasferte();
        
        setTimeout(() => {
            initCanvas();
            if (layoutMode === 'canvas') {
                loadSavedCanvas(p.canvasData);
            } else if (layoutMode === 'upload') {
                cleanLayoutBase64 = p.canvasData || "";
                const previewImg = document.getElementById('prev-layout-clean-preview');
                const placeholder = document.getElementById('prev-layout-clean-placeholder');
                if (previewImg && placeholder && cleanLayoutBase64 !== "") {
                    previewImg.src = cleanLayoutBase64;
                    previewImg.style.display = 'block';
                    placeholder.style.display = 'none';
                }
            }
        }, 100);
    }

    async function deletePreventivo(id) {
        if (confirm("Sei sicuro di voler eliminare questo preventivo definitivamente?")) {
            let list = JSON.parse(localStorage.getItem('ares_preventivi') || "[]");
            list = list.filter(p => p.id != id);
            localStorage.setItem('ares_preventivi', JSON.stringify(list));
            renderPreventivi();
            updateAll();
            if (typeof refreshDashboard === 'function') {
                refreshDashboard();
            }
            
            // Cancellazione in Cloud
            if (supabaseClient) {
                try {
                    const { error } = await supabaseClient.from('ares_preventivi').delete().eq('id', id);
                    if (error) throw error;
                } catch (err) {
                    console.error("Errore eliminazione preventivo su Cloud:", err);
                }
            }
        }
    }

    function autoCreateRecurringTasksFromPreventivo(prev) {
        let isRic = false;
        let mesiRic = 0;
        if (prev.voci) {
            prev.voci.forEach(v => {
                if (v.desc && v.desc.startsWith("__RICORRENTE__:true")) isRic = true;
                if (v.desc && v.desc.startsWith("__DURATA_MESI__:__")) {
                    mesiRic = parseInt(v.desc.split(":")[1]) || 12;
                } else if (v.desc && v.desc.startsWith("__DURATA_MESI__:")){
                    mesiRic = parseInt(v.desc.split(":")[1]) || 12;
                }
            });
        }
        
        if (!isRic || mesiRic <= 0) return;
        
        let taskTime = "09:00";
        let title = "Servizio Ricorrente: " + prev.cliente + " (" + prev.cantiere + ")";
        let startDate = new Date();
        
        for(let i = 0; i < mesiRic; i++) {
            let taskDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, startDate.getDate());
            let dateKey = taskDate.toISOString().split('T')[0];
            
            let notesForDate = JSON.parse(localStorage.getItem(`note_${dateKey}`) || "[]");
            let exists = notesForDate.some(n => n.txt === title && n.type === 'ricorrente');
            
            if (!exists) {
                notesForDate.push({
                    id: Date.now() + i,
                    time: taskTime,
                    txt: title,
                    important: true,
                    type: 'ricorrente'
                });
                localStorage.setItem(`note_${dateKey}`, JSON.stringify(notesForDate));
            }
        }
        console.log(`Creati ${mesiRic} task ricorrenti per preventivo ${prev.id}`);
    }

    async function toggleConvalida(id) {
        let list = JSON.parse(localStorage.getItem('ares_preventivi') || "[]");
        let targetState = 'bozza';
        list = list.map(p => {
            if (p.id == id) {
                p.stato = p.stato === 'convalidato' ? 'bozza' : 'convalidato';
                targetState = p.stato;
                if (targetState === 'convalidato') {
                    try { if (typeof autoCreateFascicoloFromPreventivo === 'function') autoCreateFascicoloFromPreventivo(p); } catch(e){}
                    try { autoCreateRecurringTasksFromPreventivo(p); } catch(e){}
                }
            }
            return p;
        });
        localStorage.setItem('ares_preventivi', JSON.stringify(list));
        renderPreventivi();
        updateAll();
        if (typeof refreshDashboard === 'function') {
            refreshDashboard();
        }
        
        // Sincronizzazione in Cloud
        if (supabaseClient) {
            try {
                const { error } = await supabaseClient.from('ares_preventivi').update({ stato: targetState }).eq('id', id);
                if (error) throw error;
            } catch (err) {
                console.error("Errore durante l'aggiornamento dello stato preventivo su Cloud:", err);
            }
        }
    }

    async function loadPreventivi() {
        let list = [];
        if (supabaseClient) {
            try {
                showCloudStatus("Caricamento preventivi da Cloud...", "syncing");
                const { data, error } = await supabaseClient.from('ares_preventivi').select('*');
                if (error) throw error;
                
                if (data) {
                    list = data.map(row => ({
                        id: Number(row.id),
                        protocollo: row.protocollo || "",
                        cliente: row.cliente || "",
                        cantiere: row.cantiere || "",
                        referente: row.referente || "",
                        telefono: row.telefono || "",
                        servizio: row.servizio || "",
                        provincia: row.provincia || "",
                        operatore: row.operatore || "",
                        segnalatore: row.segnalatore || "",
                        noteLogistica: row.note_logistica || "",
                        noteContorno: row.note_contorno || "",
                        distanzaKM: Number(row.distanza_km) || 0,
                        pedaggi: Number(row.pedaggi) || 0,
                        costoChilometrico: Number(row.costo_chilometrico) || 0,
                        staffTrasferta: Number(row.staff_trasferta) || 1,
                        costoTrasferta: Number(row.costo_trasferta) || 0,
                        costoCamera: Number(row.costo_camera) || 0,
                        personeHotel: Number(row.persone_hotel) || 0,
                        nottiHotel: Number(row.notti_hotel) || 0,
                        costoAlloggio: Number(row.costo_alloggio) || 0,
                        spesePresunte: Number(row.spese_presunte) || 0,
                        voci: row.voci || [],
                        totalePreventivo: Number(row.totale_preventivo) || 0,
                        canvasData: row.canvas_data || "",
                        stato: row.stato || "bozza",
                        dataCreazione: row.data_creazione || ""
                    }));
                    localStorage.setItem('ares_preventivi', JSON.stringify(list));
                }
                showCloudStatus("Preventivi Sincronizzati con Cloud", "success");
            } catch (err) {
                console.error("Errore caricamento preventivi da Cloud:", err);
                showCloudStatus("Errore Connessione Cloud. Uso dati locali.", "error");
                list = JSON.parse(localStorage.getItem('ares_preventivi') || "[]");
            }
        } else {
            list = JSON.parse(localStorage.getItem('ares_preventivi') || "[]");
        }
        
        if (typeof renderPreventivi === 'function') {
            renderPreventivi();
        }
    }

    async function loadCamerasFromCloud() {
        if (supabaseClient) {
            try {
                showCloudStatus("Caricamento telecamere da Cloud...", "syncing");
                const { data, error } = await supabaseClient.from('ares_cameras').select('*');
                if (error) throw error;
                
                if (data) {
                    const list = data.map(row => ({
                        id: row.id,
                        name: row.name,
                        sourceType: row.sourcetype,
                        url: row.url,
                        lat: Number(row.lat),
                        lng: Number(row.lng),
                        status: row.status
                    }));
                    localStorage.setItem('ares_cameras', JSON.stringify(list));
                    if (typeof camerasList !== 'undefined') {
                        camerasList = list;
                    }
                }
                showCloudStatus("Telecamere Sincronizzate con Cloud", "success");
            } catch (err) {
                console.error("Errore caricamento telecamere da Cloud:", err);
                showCloudStatus("Errore Connessione Cloud. Uso dati locali.", "error");
            }
        }
    }

    function stampaPreventivo(id) {
        const list = JSON.parse(localStorage.getItem('ares_preventivi') || "[]");
        const p = list.find(item => item.id == id);
        if (!p) return;
        
        const printSheet = document.getElementById('print-sheet-actual');
        if (!printSheet) return;
        
        let servText = "Altro Servizio";
        if(p.servizio === 'TRA') servText = "Traslochi e Logistica";
        if(p.servizio === 'PUL') servText = "Pulizie Industriali / Civili";
        if(p.servizio === 'GIA') servText = "Manutenzione Aree Verdi / Giardinaggio";
        if(p.servizio === 'DIS') servText = "Servizio di Disinfestazione / Sanificazione";
        if(p.servizio === 'EDI') servText = "Piccoli Lavori Edili di Ripristino";
        if(p.servizio === 'EVE') servText = "Allestimento Logistico per Eventi";
        
        let tableRows = "";
        let applicaIva = false;
        let layoutMode = "none";
        
        if (p.canvasData && p.canvasData !== "") {
            layoutMode = "canvas"; // Fallback per vecchi preventivi che hanno dati di disegno
        }
        
        if (p.voci && p.voci.length > 0) {
            p.voci.forEach(v => {
                if (v.desc && v.desc.startsWith("__")) {
                    if (v.desc.startsWith("__IVA__:")) {
                        applicaIva = v.desc.substring(8) === "true";
                    } else if (v.desc.startsWith("__LAYOUT_MODE__:")) {
                        layoutMode = v.desc.substring(16);
                    }
                    return;
                }
                tableRows += `
                    <tr>
                        <td style="padding:10px 8px; border-bottom:1px solid #e2e8f0; font-size:12px;">${v.desc}</td>
                        <td style="padding:10px 8px; border-bottom:1px solid #e2e8f0; font-size:12px; text-align:center;">${v.qta}</td>
                        <td style="padding:10px 8px; border-bottom:1px solid #e2e8f0; font-size:12px; text-align:center;">${v.um}</td>
                        <td style="padding:10px 8px; border-bottom:1px solid #e2e8f0; font-size:12px; text-align:right;">€ ${v.prezzo.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        <td style="padding:10px 8px; border-bottom:1px solid #e2e8f0; font-size:12px; text-align:right; font-weight:700;">€ ${v.totale.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    </tr>
                `;
            });
        } else {
            tableRows = `<tr><td colspan="5" style="padding:12px; text-align:center; color:#64748b;">Nessuna voce specificata</td></tr>`;
        }
        
        let transferHtml = "";
        
        // Logica per inserire planimetria in stampa in base al layoutMode
        let mapImageHtml = "";
        if (layoutMode !== "none" && p.canvasData && p.canvasData !== "") {
            let figCaption = "Fig 1. Planimetria del cantiere con delimitazione Area Operativa (Rosso), Area Stoccaggio (Verde) e Percorso Accesso (Blu).";
            if (layoutMode === "upload") {
                figCaption = "Fig 1. Planimetria e Layout Operativo del cantiere allegato al preventivo.";
            }
            mapImageHtml = `
                <div style="margin-top:25px; margin-bottom:25px; page-break-inside:avoid;">
                    <h4 style="font-size:13px; font-weight:700; text-transform:uppercase; color:#0f172a; margin-bottom:8px; border-bottom:1px solid #f97316; padding-bottom:6px;">Rilievo Logistico & Layout Operativo</h4>
                    <div style="text-align:center; padding:8px; border:1px solid #e2e8f0; border-radius:8px; background:#fafafa;">
                        <img src="${p.canvasData}" style="max-width:100%; max-height:300px; object-fit:contain; display:block; margin:0 auto; border-radius:6px;">
                        <div style="margin-top:6px; font-size:9.5px; color:#64748b; font-style:italic;">
                            ${figCaption}
                        </div>
                    </div>
                </div>
            `;
        }

        printSheet.innerHTML = `
            <div style="position:relative; font-family:'Outfit', sans-serif; color:#1e293b; padding:10px;">
                <!-- Logo Filigrana di Sfondo (Watermark) - Usiamo tag img per garantire stampa su ogni browser -->
                <div style="position:absolute; top:35%; left:50%; transform:translate(-50%, -50%); opacity:0.035; z-index:-1; width:450px; pointer-events:none; text-align:center;">
                    <img src="logo.jpg" style="width:100%; height:auto; filter:grayscale(100%); display:block; margin:0 auto;">
                </div>

                <!-- TESTATA CON IMPOSTAZIONE MOCKUP -->
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #f97316; padding-bottom:12px; margin-bottom:20px;">
                    <!-- Colonna Sinistra: Logo Aziendale -->
                    <div style="flex:1; display:flex; justify-content:flex-start; align-items:center;">
                        <img src="logo.jpg" style="max-height:65px; border-radius:4px; display:block;">
                    </div>
                    
                    <!-- Colonna Centrale: Ragione Sociale in Grigio Slate Premium -->
                    <div style="flex:2; text-align:center;">
                        <h1 style="font-family:'Outfit', sans-serif; font-size:30px; font-weight:500; color:#576574; margin:0; letter-spacing:0.5px;">Logistica Ares srls</h1>
                    </div>
                    
                    <!-- Colonna Destra: Certificazione UNI EN ISO 14001:2015 Ufficiale -->
                    <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                        <img src="logocert.jpg" style="height:50px; width:auto; border-radius:4px; display:block; margin:0 auto; mix-blend-mode: multiply;">
                        <div style="font-family:'Outfit', sans-serif; font-size:7.5px; color:#1b5e20; font-weight:700; text-align:center; white-space:nowrap; margin-top:2px; letter-spacing:0.1px;">
                            Certificazione UNI EN ISO 14001:2015 + A1 2024
                        </div>
                    </div>
                </div>

                <!-- SOTTO-TESTATA CON DETTAGLI PROTOCOLLO E DATA -->
                <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #e2e8f0; border-left:4px solid #f97316; border-radius:8px; padding:8px 12px; margin-bottom:20px;">
                    <div style="font-size:12px; font-weight:700; color:#475569; letter-spacing:0.5px;">
                        PREVENTIVO E PROPOSTA COMMERCIALE
                    </div>
                    <div style="font-size:11px; color:#475569;">
                        <b>Protocollo:</b> <span style="font-family:monospace; font-weight:700; color:#f97316;">${p.protocollo}</span>
                        <span style="margin: 0 8px; color:#cbd5e1;">|</span>
                        <b>Data Emissione:</b> ${p.dataCreazione}
                    </div>
                </div>

                <!-- PANNELLI INFORMATIVI CLIENTE / CANTIERE -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px;">
                    <div style="border:1px solid #e2e8f0; border-left:4px solid #f97316; border-radius:8px; padding:12px; background:#f8fafc;">
                        <h3 style="font-size:11px; font-weight:700; color:#f97316; text-transform:uppercase; margin-top:0; margin-bottom:6px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">Dati di Fatturazione Cliente</h3>
                        <div style="font-size:12px; color:#0f172a; line-height:1.5;">
                            <b>Cliente:</b> ${p.cliente}<br>
                            <b>Referente:</b> ${p.referente || 'N/D'}<br>
                            <b>Telefono:</b> ${p.telefono || 'N/D'}
                        </div>
                    </div>
                    <div style="border:1px solid #e2e8f0; border-left:4px solid #f97316; border-radius:8px; padding:12px; background:#f8fafc;">
                        <h3 style="font-size:11px; font-weight:700; color:#f97316; text-transform:uppercase; margin-top:0; margin-bottom:6px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">Dettaglio Cantiere & Servizio</h3>
                        <div style="font-size:12px; color:#0f172a; line-height:1.5;">
                            <b>Servizio Richiesto:</b> ${servText}<br>
                            <b>Luogo di Esecuzione:</b> ${p.cantiere || 'N/D'}<br>
                            <b>Provincia:</b> ${p.provincia}
                        </div>
                    </div>
                </div>

                <!-- CONDIZIONI OPERATIVE E LOGISTICA -->
                ${(p.noteLogistica || p.noteContorno) ? `
                <div style="border:1px solid #e2e8f0; border-left:4px solid #f97316; border-radius:8px; padding:12px; margin-bottom:20px;">
                    <h3 style="font-size:11px; font-weight:700; color:#f97316; text-transform:uppercase; margin-top:0; margin-bottom:6px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">Rilievo Logistico & Condizioni Esecutive</h3>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; font-size:11.5px; line-height:1.5;">
                        <div>
                            <b>Spazi & Logistica:</b><br>
                            <span style="color:#475569;">${p.noteLogistica || 'Nessuna nota logistica particolare.'}</span>
                        </div>
                        <div>
                            <b>Condizioni Operative / Allacciamenti:</b><br>
                            <span style="color:#475569;">${p.noteContorno || 'Nessuna specifica tecnica aggiuntiva.'}</span>
                        </div>
                    </div>
                </div>
                ` : ''}

                <!-- SEZIONE MAPPA / PLANIMETRIA (SE NON DISABILITATA) -->
                ${mapImageHtml}

                <!-- TABELLA COMPUTO METRICO -->
                <div style="margin-bottom:20px;">
                    <h4 style="font-size:12.5px; font-weight:700; text-transform:uppercase; color:#0f172a; margin-bottom:8px; border-bottom:1px solid #f97316; padding-bottom:4px;">Computo Metrico & Voci Economiche</h4>
                    <table class="print-table" style="width:100%; border-collapse:collapse; margin-bottom:15px;">
                        <thead>
                            <tr style="background:#f8fafc; font-size:10.5px; text-transform:uppercase; font-weight:700; color:#0f172a;">
                                <th style="padding:8px; text-align:left; border-bottom:2px solid #f97316; width:50%;">Descrizione Lavorazione / Fornitura</th>
                                <th style="padding:8px; text-align:center; border-bottom:2px solid #f97316; width:10%;">Q.tà</th>
                                <th style="padding:8px; text-align:center; border-bottom:2px solid #f97316; width:10%;">U.M.</th>
                                <th style="padding:8px; text-align:right; border-bottom:2px solid #f97316; width:15%;">Prezzo Unit.</th>
                                <th style="padding:8px; text-align:right; border-bottom:2px solid #f97316; width:15%;">Totale</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                            ${transferHtml}
                        </tbody>
                    </table>
                </div>

                <!-- BLOCCO TOTALI ECONOMICI -->
                <div style="display:flex; justify-content:flex-end; margin-top:15px; page-break-inside:avoid;">
                    <div style="border:2px solid #f97316; border-radius:8px; padding:12px; min-width:260px; background:#f8fafc; text-align:right;">
                        ${applicaIva ? `
                        <div style="font-size:11px; color:#475569; margin-bottom:3px;">Subtotale imponibile: € ${p.totalePreventivo.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                        <div style="font-size:11px; color:#475569; margin-bottom:6px;">Iva (22%): € ${(p.totalePreventivo * 0.22).toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                        <div style="font-size:15px; font-weight:900; color:#0f172a; border-top:1px solid #cbd5e1; padding-top:6px;">
                            TOTALE DOVUTO: <span style="color:#f97316;">€ ${(p.totalePreventivo * 1.22).toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                        ` : `
                        <div style="font-size:15px; font-weight:900; color:#0f172a; padding-top:6px;">
                            TOTALE IMPOSTO: <span style="color:#f97316;">€ ${p.totalePreventivo.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                        `}
                    </div>
                </div>

                <!-- CONDIZIONI E FIRME -->
                <div style="margin-top:35px; page-break-inside:avoid;">
                    <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:30px; font-size:10px;">
                        <div>
                            <b>Condizioni Generali di Fornitura:</b><br>
                            <ul style="padding-left:15px; margin:5px 0; color:#475569; line-height:1.4;">
                                <li>La validità della presente proposta commerciale è di 30 giorni dalla data di emissione.</li>
                                <li>Termini di pagamento: 30% all'accettazione, saldo a fine lavori o secondo accordi.</li>
                                <li>Eventuali lavori imprevisti verranno concordati preventivamente per iscritto.</li>
                            </ul>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:flex-end; padding-top:10px;">
                            <div style="text-align:center; flex:1;">
                                <div style="border-bottom:1px solid #94a3b8; height:35px; width:110px; margin:0 auto;"></div>
                                <span style="font-size:8.5px; color:#64748b; display:block; margin-top:4px;">Firma per Accettazione Cliente</span>
                            </div>
                            <div style="text-align:center; flex:1;">
                                <div style="border-bottom:1px solid #94a3b8; height:35px; width:110px; margin:0 auto;"></div>
                                <span style="font-size:8.5px; color:#64748b; display:block; margin-top:4px;">Firma Direzione ARES</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- PIÈ DI PAGINA (FOOTER CON LOGO E RIFERIMENTI MOCKUP) -->
                <div class="print-footer" style="display:flex; justify-content:space-between; border-top:1px solid #f97316; padding-top:10px; margin-top:35px; font-size:10px; color:#475569; line-height:1.5; page-break-inside:avoid;">
                    <div style="text-align:left;">
                        <div><b>Sede Legale:</b> P.zza Bergoncini Duca n. 7/b Roma</div>
                        <div><b>Sede Operativa:</b> Via di Torrevecchia n. 901 Roma</div>
                    </div>
                    <div style="text-align:right;">
                        <div><b>P.IVA:</b> 13842301007</div>
                        <div><b>Email:</b> m.olivieri@logistica-ares.it | <b>Cell:</b> +39 373 739 72724</div>
                        <div><b>Sito Web:</b> www.logistica-ares.it</div>
                    </div>
                </div>
            </div>
        `;
        
        window.print();
    }

    // 📱 FUNZIONALITÀ INTERFACCIA MOBILE PWA (TAB SWITCHING & LOGICA SCHEDE)
    let currentMobileAppt = null;

    function toggleSosSignal() {
        const btn = document.getElementById('mobile-btn-sos');
        if (!btn) return;
        
        if (!isSosActive) {
            const conf = confirm("⚠️ ATTENZIONE: Sei sicuro di voler lanciare un segnale di EMERGENZA SOS alla centrale?");
            if (!conf) return;
            
            isSosActive = true;
            lastSosActivationTime = Date.now(); // Salva il timestamp dell'SOS
            btn.innerHTML = "🚨 ANNULLA SOS OPERATIVO";
            btn.classList.add('btn-sos-active');
            
            sendHeartbeat();
        } else {
            isSosActive = false;
            btn.innerHTML = "🆘 INVIA SOS EMERGENZA";
            btn.classList.remove('btn-sos-active');
            
            sendHeartbeat();
        }
    }

    function focusSosWorker() {
        if (!activeSosWorker) return;
        
        // Se l'operatore non si trova sulla scheda della mappa, cambia vista prima di zoomare
        const mapContainer = document.getElementById('view-operativa');
        if (mapContainer && mapContainer.style.display !== 'block') {
            show('operativa');
        }
        
        // Aspetta che la mappa si carichi o si ridisegni se appena visualizzata
        setTimeout(() => {
            if (!mapInstance) return;
            selectGisWorker(activeSosWorker);
            const lat = parseFloat(activeSosWorker.latitude);
            const lon = parseFloat(activeSosWorker.longitude);
            if (!isNaN(lat) && !isNaN(lon)) {
                mapInstance.flyTo([lat, lon], 18, { animate: true, duration: 1.5 });
            }
        }, 300);
    }

    function closeSosOverlay() {
        const overlay = document.getElementById('pc-sos-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    function muteSosAlarm() {
        isSosMuted = true;
        if ('speechSynthesis' in window) {
            try {
                window.speechSynthesis.cancel();
            } catch (err) {
                console.error("Errore stop sintesi vocale:", err);
            }
        }
        const muteBtn = document.getElementById('pc-btn-sos-mute');
        if (muteBtn) {
            muteBtn.innerHTML = '🔇 Tacitato';
            muteBtn.style.opacity = '0.7';
        }
        console.log("Allarme SOS tacitato localmente sul browser.");
    }

    async function resolveSosFromPc() {
        if (!activeSosWorker) return;
        const workerName = activeSosWorker.username;
        if (!confirm(`Sei sicuro di voler contrassegnare l'allarme SOS di ${workerName} come RISOLTO?\nQuesto ripristinerà il suo stato normale sul telefono.`)) {
            return;
        }
        
        try {
            let cleanDevice = activeSosWorker.device || "📱 Mobile";
            cleanDevice = cleanDevice.replace(/🚨 SOS\s*-\s*/, "");
            
            if (supabaseClient) {
                const { error } = await supabaseClient
                    .from('ares_presence')
                    .update({ device: cleanDevice })
                    .eq('username', workerName);
                    
                if (error) throw error;
                
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                }
                isSosMuted = false;
                activeSosWorker = null;
                const overlay = document.getElementById('pc-sos-overlay');
                if (overlay) overlay.style.display = 'none';
                
                await updateGisWorkers();
                alert(`Emergenza SOS per ${workerName} risolta con successo!`);
            }
        } catch (err) {
            console.error("Errore risoluzione SOS:", err);
            alert("Impossibile risolvere l'SOS sul database. Riprova.");
        }
    }

    function switchMobileTab(tabName) {
        document.querySelectorAll('.mobile-sub-view').forEach(view => {
            view.style.display = 'none';
        });
        document.querySelectorAll('#view-mobile-app button').forEach(btn => {
            btn.style.color = '#94a3b8';
        });
        const targetView = document.getElementById(`mobile-sec-${tabName}`);
        if (targetView) targetView.style.display = 'block';
        const targetBtn = document.getElementById(`mobile-tab-btn-${tabName}`);
        if (targetBtn) targetBtn.style.color = '#6366f1';
        
        if (tabName === 'agenda') {
            updateMobileInterface();
        }
    }

    function updateMobileInterface() {
        const loggedUserStr = localStorage.getItem('ares_logged_user') || sessionStorage.getItem('ares_logged_user');
        if (!loggedUserStr) return;
        
        let user;
        try {
            user = JSON.parse(loggedUserStr);
        } catch(e) { return; }
        
        const username = user.username;
        const loggedEl = document.getElementById('mobile-logged-username');
        const profileEl = document.getElementById('mobile-profile-name');
        if (loggedEl) loggedEl.innerText = username;
        if (profileEl) profileEl.innerText = username;
        
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayKey = `${yyyy}-${mm}-${dd}`;
        
        const listContainer = document.getElementById('mobile-appointments-list');
        if (!listContainer) return;
        listContainer.innerHTML = "";
        
        let todayAppts = [];
        
        // 1. Legge gli eventi CRM/ERP per oggi
        const localEvents = JSON.parse(localStorage.getItem('planning_events') || "[]");
        localEvents.forEach(evt => {
            if (evt.date && evt.date.startsWith(todayKey)) {
                const hasUsername = evt.desc.toLowerCase().includes(username.toLowerCase());
                const isAdmin = username.toLowerCase() === 'roberto' || username.toLowerCase() === 'massimo';
                
                if (hasUsername || isAdmin) {
                    const timePart = evt.date.split('T')[1] ? evt.date.split('T')[1].substring(0,5) : "09:00";
                    todayAppts.push({
                        id: evt.id,
                        time: timePart,
                        desc: evt.desc,
                        type: 'CRM',
                        client: evt.desc.split(' - ')[0] || "Cliente Generico",
                        address: evt.desc.split(' - ')[1] || "Indirizzo non specificato"
                    });
                }
            }
        });
        
        // 2. Legge le note manuali per oggi
        const notes = JSON.parse(localStorage.getItem(`note_${todayKey}`) || "[]");
        notes.forEach(n => {
            const hasUsername = n.txt.toLowerCase().includes(username.toLowerCase());
            const isAdmin = username.toLowerCase() === 'roberto' || username.toLowerCase() === 'massimo';
            
            if (hasUsername || isAdmin) {
                todayAppts.push({
                    id: n.id,
                    time: n.time || "09:00",
                    desc: n.txt,
                    type: 'MANUALE',
                    client: n.txt.split(' - ')[0] || "Nota",
                    address: n.txt.split(' - ')[1] || "Nessun indirizzo"
                });
            }
        });
        
        // Ordina per orario
        todayAppts.sort((a,b) => a.time.localeCompare(b.time));
        
        const mCount = document.getElementById('mobile-agenda-count');
        if (mCount) mCount.innerText = todayAppts.length;
        
        if (todayAppts.length === 0) {
            listContainer.innerHTML = `
                <div class="card-ui" style="text-align: center; color: #94a3b8; padding: 30px 20px; background: rgba(30, 30, 45, 0.4);">
                    📭 Nessun intervento pianificato per te oggi!
                </div>
            `;
            return;
        }
        
        todayAppts.forEach(appt => {
            const card = document.createElement('div');
            card.className = 'card-ui';
            card.style.background = 'rgba(30, 30, 45, 0.6)';
            card.style.borderLeft = appt.type === 'CRM' ? '4px solid #6366f1' : '4px solid #10b981';
            card.style.padding = '16px';
            card.style.borderRadius = '12px';
            card.style.cursor = 'pointer';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.gap = '8px';
            card.style.marginBottom = '0px';
            
            const isCompleted = appt.desc.includes("✅ COMPLETATO") || appt.desc.includes("[COMPLETATO]");
            if (isCompleted) {
                card.style.opacity = "0.55";
            }
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; pointer-events: none;">
                    <span style="font-size: 13px; font-weight: 800; color: #818cf8;">⏰ ${appt.time}</span>
                    <span style="font-size: 9px; font-weight: 700; background: ${appt.type === 'CRM' ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)'}; color: ${appt.type === 'CRM' ? '#a5b4fc' : '#34d399'}; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">${appt.type}</span>
                </div>
                <h4 style="margin: 0; font-size: 16px; color: #fff; font-weight: 800; pointer-events: none;">${appt.client}</h4>
                <p style="margin: 0; font-size: 12px; color: #94a3b8; display: flex; align-items: center; gap: 4px; pointer-events: none;">📍 ${appt.address}</p>
            `;
            
            card.onclick = () => openMobileSheet(appt);
            listContainer.appendChild(card);
        });
    }

    function openMobileSheet(appt) {
        currentMobileAppt = appt;
        document.getElementById('m-sheet-time').innerText = `⏰ ${appt.time}`;
        document.getElementById('m-sheet-client').innerText = appt.client;
        document.getElementById('m-sheet-address').innerText = appt.address;
        document.getElementById('m-sheet-desc').innerText = appt.desc;
        
        const typeBadge = document.getElementById('m-sheet-type');
        if (typeBadge) {
            typeBadge.innerText = appt.type;
            typeBadge.style.background = appt.type === 'CRM' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)';
            typeBadge.style.color = appt.type === 'CRM' ? '#a5b4fc' : '#34d399';
            typeBadge.style.borderColor = appt.type === 'CRM' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(16, 185, 129, 0.25)';
        }
        
        const btnNav = document.getElementById('m-sheet-btn-nav');
        if (btnNav) btnNav.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(appt.address)}`;
        
        const btnCall = document.getElementById('m-sheet-btn-call');
        const phoneMatch = appt.desc.match(/(?:\+39|0039)?\s*[389]\d{2}\s*\d{3}\s*\d{4}/) || appt.desc.match(/\b\d{6,10}\b/);
        if (phoneMatch && btnCall) {
            btnCall.href = `tel:${phoneMatch[0].replace(/\s+/g, '')}`;
            btnCall.style.display = 'flex';
        } else if (btnCall) {
            btnCall.style.display = 'none';
        }
        
        const isCompleted = appt.desc.includes("✅ COMPLETATO") || appt.desc.includes("[COMPLETATO]");
        const btnComplete = document.getElementById('m-sheet-btn-complete');
        if (btnComplete) {
            if (isCompleted) {
                btnComplete.innerText = "Lavoro già completato";
                btnComplete.style.background = "rgba(255,255,255,0.05)";
                btnComplete.style.color = "#64748b";
                btnComplete.style.cursor = "default";
                btnComplete.disabled = true;
            } else {
                btnComplete.innerText = "✅ Completa Lavoro";
                btnComplete.style.background = "linear-gradient(135deg, #10b981, #059669)";
                btnComplete.style.color = "#fff";
                btnComplete.style.cursor = "pointer";
                btnComplete.disabled = false;
            }
        }
        
        const sheet = document.getElementById('mobile-bottom-sheet');
        if (sheet) sheet.style.bottom = '0';
    }

    function closeMobileSheet() {
        const sheet = document.getElementById('mobile-bottom-sheet');
        if (sheet) sheet.style.bottom = '-100%';
        currentMobileAppt = null;
    }

    async function markApptCompleted() {
        if (!currentMobileAppt) return;
        const appt = currentMobileAppt;
        
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayKey = `${yyyy}-${mm}-${dd}`;
        
        if (appt.type === 'MANUALE') {
            let notes = JSON.parse(localStorage.getItem(`note_${todayKey}`) || "[]");
            notes = notes.map(n => {
                if (n.id === appt.id) {
                    n.txt = "✅ COMPLETATO - " + n.txt;
                }
                return n;
            });
            localStorage.setItem(`note_${todayKey}`, JSON.stringify(notes));
            
            if (supabaseClient) {
                try {
                    await supabaseClient.from('ares_planning').upsert({
                        id: appt.id,
                        data_scadenza: todayKey + 'T' + appt.time,
                        descrizione: 'NOTE:✅ COMPLETATO - ' + appt.desc.replace("NOTE:", ""),
                        importante: false
                    });
                } catch (e) {
                    console.error("Errore completamento nota Cloud:", e);
                }
            }
        } else {
            let localEvents = JSON.parse(localStorage.getItem('planning_events') || "[]");
            localEvents = localEvents.map(evt => {
                if (evt.id === appt.id) {
                    evt.desc = "✅ COMPLETATO - " + evt.desc;
                }
                return evt;
            });
            localStorage.setItem('planning_events', JSON.stringify(localEvents));
            
            if (supabaseClient) {
                try {
                    await supabaseClient.from('ares_planning').upsert({
                        id: appt.id,
                        data_scadenza: todayKey + 'T' + appt.time,
                        descrizione: 'PLAN:✅ COMPLETATO - ' + appt.desc.replace("PLAN:", ""),
                        importante: false
                    });
                } catch (e) {
                    console.error("Errore completamento CRM Cloud:", e);
                }
            }
        }
        
        closeMobileSheet();
        updateMobileInterface();
        
        if (typeof renderAllCalendars === 'function') renderAllCalendars();
        if (typeof refreshDashboard === 'function') refreshDashboard();
    }

    // Caricamento dei dati salvati all'avvio dell'applicazione con Sync Cloud
    window.addEventListener('DOMContentLoaded', async () => {
        await initAuthSystem();
        
        // Registrazione del Service Worker per la PWA
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./service-worker.js')
                .then(reg => console.log('Service Worker registrato con successo!', reg))
                .catch(err => console.error('Errore registrazione Service Worker:', err));
        }
    }); // <-- CLOSED DOMContentLoaded HERE!

    // ================================================================
    // 📹 SISTEMA TELECAMERE & VIDEO MANAGER — COMPLETO
    // ================================================================

    let camerasList = [];
    let cameraMarkers = {};
    let cameraLayerGroup = null;
    let openVideoWindows = {};
    let videoWindowZIndex = 10000;
    let lassoMode = false;
    let camTimestampInterval = null;

    let camPickerMap = null;
    let camPickerMarker = null;

    // Demo cameras preloaded
    const DEFAULT_CAMERAS = [
        { id: 'cam_demo_1', name: 'Ingresso Cantiere Nord', sourceType: 'mp4_locale', url: './video_telecamere/demo1.mov', lat: 41.9109, lng: 12.4818, status: 'active' },
        { id: 'cam_demo_2', name: 'Deposito Materiali Est', sourceType: 'mp4_locale', url: './video_telecamere/demo2.mov', lat: 41.8986, lng: 12.5133, status: 'active' },
        { id: 'cam_demo_4', name: 'Varco Uscita Sud', sourceType: 'mp4_locale', url: './video_telecamere/demo4.mov', lat: 41.8850, lng: 12.4850, status: 'maintenance' },
        { id: 'cam_demo_6', name: 'Telecamera Perimetrale Ovest', sourceType: 'mp4_locale', url: './video_telecamere/demo6.mov', lat: 41.9140, lng: 12.4700, status: 'offline' }
    ];

    function loadCameras() {
        const stored = localStorage.getItem('ares_cameras');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    camerasList = parsed.filter(c => c && typeof c === 'object');
                } else {
                    camerasList = [];
                }
            } catch(e) {
                console.error("Error parsing ares_cameras", e);
                camerasList = [];
            }
        } else {
            camerasList = JSON.parse(JSON.stringify(DEFAULT_CAMERAS));
            saveCamerasToStorage();
        }
    }

    async function saveCamerasToStorage() {
        localStorage.setItem('ares_cameras', JSON.stringify(camerasList));
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                const rowsToSync = camerasList.map(c => ({
                    id: c.id,
                    name: c.name,
                    sourcetype: c.sourceType,
                    url: c.url,
                    lat: c.lat,
                    lng: c.lng,
                    status: c.status
                }));
                await supabaseClient.from('ares_cameras').upsert(rowsToSync, { onConflict: 'id' });
            } catch (e) {
                console.error("Error syncing cameras to cloud", e);
            }
        }
    }

    function renderCameraManager() {
        try {
            loadCameras();
            updateCamKPI();
            const container = document.getElementById('cam-manager-list');
            if (!container) return;
            container.innerHTML = '';

            if (camerasList && camerasList.length > 0) {
                camerasList.forEach(cam => {
                    try {
                        const statusClass = cam.status === 'active' ? 'cam-status-active' : cam.status === 'maintenance' ? 'cam-status-maintenance' : 'cam-status-offline';
                        const statusLabel = cam.status === 'active' ? '🟢 Attivo' : cam.status === 'maintenance' ? '🟡 Manutenzione' : '🔴 Disconnesso';
                        const typeLabel = { mp4_locale: '🎬 MP4', hls: '📺 HLS', mjpeg: '📷 MJPEG', iframe_embed: '🌐 iframe', rtsp: '🔌 RTSP' }[cam.sourceType] || cam.sourceType || 'Sconosciuto';

                        const card = document.createElement('div');
                        card.className = 'cam-card';
                        card.innerHTML = `
                            <div class="cam-card-header">
                                <div class="cam-icon-box">📷</div>
                                <div class="cam-card-info">
                                    <h4 class="cam-card-name" title="${cam.name || 'Senza Nome'}">${cam.name || 'Senza Nome'}</h4>
                                    <div class="cam-card-type">${typeLabel}</div>
                                    <div class="cam-card-url" title="${cam.url || ''}">${cam.url || 'Nessun URL'}</div>
                                </div>
                                <span class="cam-status-badge ${statusClass}">${statusLabel}</span>
                            </div>
                            <div class="cam-card-coords">📍 Lat: ${(parseFloat(cam.lat)||0).toFixed(4)} — Lng: ${(parseFloat(cam.lng)||0).toFixed(4)}</div>
                            <div class="cam-card-actions">
                                <button class="cam-btn cam-btn-preview" onclick="openCameraPreview('${cam.id}')">▶ Anteprima</button>
                                <button class="cam-btn cam-btn-edit" onclick="editCamera('${cam.id}')">✏️ Modifica</button>
                                <button class="cam-btn cam-btn-delete" onclick="deleteCamera('${cam.id}')">🗑️</button>
                            </div>
                        `;
                        container.appendChild(card);
                    } catch(e) {
                        const err = document.createElement('div');
                        err.style.color = 'red';
                        err.textContent = "Error rendering card: " + e.message;
                        container.appendChild(err);
                    }
                });
            }

            if (!camerasList || camerasList.length === 0) {
                container.innerHTML = '<div style="color:#94a3b8; padding:20px; text-align:center;">Nessuna telecamera configurata.</div>';
            }

            // Initialize Map Picker with a safe delay to allow DOM to layout
            setTimeout(initCamPickerMap, 350);
        } catch(e) {
            const container = document.getElementById('cam-manager-list');
            if(container) container.innerHTML = '<div style="color:red; background:#fee2e2; padding:20px; border-radius:8px;">CRITICAL ERROR: ' + e.message + '</div>';
        }
    }

    function initCamPickerMap() {
        try {
            const mapDiv = document.getElementById('cam-picker-map');
            if (!mapDiv) return;

            if (typeof L === 'undefined') {
                mapDiv.innerHTML = '<div style="color:red; padding:20px;">Leaflet library is not loaded. Please check your internet connection.</div>';
                return;
            }

            if (!camPickerMap) {
                // Selezioniamo Roma centro
                camPickerMap = L.map('cam-picker-map', {
                    zoomControl: false,
                    attributionControl: false
                }).setView([41.9028, 12.4964], 10);
                
                const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    subdomains: 'abcd',
                    maxZoom: 19
                });

                const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    maxZoom: 19,
                    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                });

                darkLayer.addTo(camPickerMap);

                L.control.layers({
                    "🗺️ Mappa Scura": darkLayer,
                    "🛰️ Satellitare": satelliteLayer
                }, null, { position: 'topright' }).addTo(camPickerMap);

                L.control.zoom({ position: 'bottomright' }).addTo(camPickerMap);

                camPickerMap.on('click', function(e) {
                    const lat = e.latlng.lat.toFixed(6);
                    const lng = e.latlng.lng.toFixed(6);
                    document.getElementById('cam-lat').value = lat;
                    document.getElementById('cam-lng').value = lng;
                    updateCamPickerMarker(lat, lng);
                });
            }
            
            // Force Leaflet to recalculate size after the container is fully visible
            setTimeout(() => {
                if (camPickerMap) {
                    camPickerMap.invalidateSize();
                }
            }, 100);
        } catch(e) {
            const mapDiv = document.getElementById('cam-picker-map');
            if(mapDiv) mapDiv.innerHTML = '<div style="color:red; padding:10px;">Map Init Error: ' + e.message + '</div>';
        }
    }

    let camSearchTimeout = null;

    function handleCamAddressSearch(query) {
        query = query.trim();
        const resultsBox = document.getElementById('cam-search-results');
        if (!resultsBox) return;

        clearTimeout(camSearchTimeout);
        
        if (query.length < 3) {
            resultsBox.style.display = 'none';
            return;
        }

        // Imposta lo stato di caricamento
        resultsBox.innerHTML = '<div style="padding: 10px 14px; color: #818cf8; font-size: 13px; text-align: center;">Ricerca in corso... ⏳</div>';
        resultsBox.style.display = 'block';

        camSearchTimeout = setTimeout(() => {
            // Nominatim API (OpenStreetMap)
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=it`)
                .then(r => r.json())
                .then(data => {
                    if (data.length === 0) {
                        resultsBox.innerHTML = '<div style="padding: 10px 14px; color: #f43f5e; font-size: 13px;">Nessun risultato trovato</div>';
                    } else {
                        resultsBox.innerHTML = data.map(item => `
                            <div class="cam-search-item" onclick="selectCamAddress(${item.lat}, ${item.lon}, '${item.display_name.replace(/'/g, "\\'")}')">
                                📍 ${item.display_name}
                            </div>
                        `).join('');
                    }
                })
                .catch(err => {
                    console.error('Geocoding error:', err);
                    resultsBox.innerHTML = '<div style="padding: 10px 14px; color: #f43f5e; font-size: 13px;">Errore di connessione al servizio mappe</div>';
                });
        }, 600);
    }

    // Hide results if clicked outside
    document.addEventListener('click', (e) => {
        const searchInput = document.getElementById('cam-search-address');
        const resultsBox = document.getElementById('cam-search-results');
        if (searchInput && resultsBox && !searchInput.contains(e.target) && !resultsBox.contains(e.target)) {
            resultsBox.style.display = 'none';
        }
    });

    function selectCamAddress(lat, lng, name) {
        document.getElementById('cam-search-address').value = name;
        document.getElementById('cam-search-results').style.display = 'none';
        
        document.getElementById('cam-lat').value = parseFloat(lat).toFixed(6);
        document.getElementById('cam-lng').value = parseFloat(lng).toFixed(6);
        
        updateCamPickerMarker(lat, lng);
    }

    function updateCamPickerMarker(lat, lng) {
        if (!camPickerMap) return;
        if (camPickerMarker) {
            camPickerMarker.setLatLng([lat, lng]);
        } else {
            camPickerMarker = L.marker([lat, lng]).addTo(camPickerMap);
        }
        camPickerMap.setView([lat, lng], 16);
    }

    function updateCamKPI() {
        if (!camerasList) camerasList = [];
        const validCameras = camerasList.filter(c => c && typeof c === 'object');
        const total = validCameras.length;
        const active = validCameras.filter(c => c.status === 'active').length;
        const maint = validCameras.filter(c => c.status === 'maintenance').length;
        const offline = validCameras.filter(c => c.status === 'offline').length;
        const setVal = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
        setVal('cam-kpi-total', total);
        setVal('cam-kpi-active', active);
        setVal('cam-kpi-maint', maint);
        setVal('cam-kpi-offline', offline);

        // Update layer counter badge
        const countBadge = document.getElementById('cam-layer-count');
        if (countBadge) {
            countBadge.textContent = total;
            countBadge.style.display = total > 0 ? 'inline' : 'none';
        }
    }

    function saveCameraFromForm() {
        const editId = document.getElementById('cam-edit-id').value;
        const name = document.getElementById('cam-name').value.trim();
        const sourceType = document.getElementById('cam-source-type').value;
        const url = document.getElementById('cam-url').value.trim();
        const status = document.getElementById('cam-status').value;
        const lat = parseFloat(document.getElementById('cam-lat').value);
        const lng = parseFloat(document.getElementById('cam-lng').value);

        if (!name || !url || isNaN(lat) || isNaN(lng)) {
            alert('Compila tutti i campi obbligatori (Nome, URL, Lat, Lng).');
            return;
        }

        if (editId) {
            const idx = camerasList.findIndex(c => c.id === editId);
            if (idx !== -1) {
                camerasList[idx] = { ...camerasList[idx], name, sourceType, url, status, lat, lng };
            }
        } else {
            const newCam = {
                id: 'cam_' + Date.now(),
                name, sourceType, url, status, lat, lng
            };
            camerasList.push(newCam);
        }

        saveCamerasToStorage();
        resetCamForm();
        renderCameraManager();
        // Refresh map POIs if layer is active
        if (document.getElementById('layer-cameras') && document.getElementById('layer-cameras').checked) {
            renderCameraPOIs();
        }
    }

    function resetCamForm() {
        document.getElementById('cam-edit-id').value = '';
        document.getElementById('cam-name').value = '';
        document.getElementById('cam-source-type').value = 'mp4_locale';
        document.getElementById('cam-url').value = '';
        document.getElementById('cam-status').value = 'active';
        document.getElementById('cam-lat').value = '';
        document.getElementById('cam-lng').value = '';
        document.getElementById('cam-form-title').textContent = 'Aggiungi Telecamera';
        document.getElementById('cam-btn-cancel').style.display = 'none';
    }

    function editCamera(camId) {
        const cam = camerasList.find(c => c.id === camId);
        if (!cam) return;
        document.getElementById('cam-edit-id').value = cam.id;
        document.getElementById('cam-name').value = cam.name;
        document.getElementById('cam-source-type').value = cam.sourceType;
        document.getElementById('cam-url').value = cam.url;
        document.getElementById('cam-status').value = cam.status;
        document.getElementById('cam-lat').value = cam.lat;
        document.getElementById('cam-lng').value = cam.lng;
        document.getElementById('cam-form-title').textContent = 'Modifica Telecamera';
        document.getElementById('cam-btn-cancel').style.display = 'inline-flex';
        updateCamPickerMarker(cam.lat, cam.lng);
        // Scroll to form
        document.getElementById('view-videomanager').scrollIntoView({ behavior: 'smooth' });
    }

    async function deleteCamera(camId) {
        if (!confirm('Eliminare questa telecamera?')) return;
        camerasList = camerasList.filter(c => c.id !== camId);
        saveCamerasToStorage();
        
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                await supabaseClient.from('ares_cameras').delete().eq('id', camId);
            } catch(e) {
                console.error("Errore cancellazione Supabase:", e);
            }
        }
        
        renderCameraManager();
        // Close video window if open
        if (openVideoWindows[camId]) {
            closeCameraWindow(camId);
        }
        if (document.getElementById('layer-cameras') && document.getElementById('layer-cameras').checked) {
            renderCameraPOIs();
        }
    }

    // ---- CAMERA POI ON LEAFLET MAP ----
    function toggleCameraLayer() {
        const cb = document.getElementById('layer-cameras');
        const toolsPanel = document.getElementById('cam-tools-panel');
        if (cb && cb.checked) {
            loadCameras();
            renderCameraPOIs();
            if (toolsPanel) { toolsPanel.style.display = 'flex'; }
        } else {
            clearCameraPOIs();
            if (toolsPanel) { toolsPanel.style.display = 'none'; }
            if (lassoMode) toggleLassoMode();
        }
    }

    function renderCameraPOIs() {
        clearCameraPOIs();
        if (!mapInstance) return;
        cameraLayerGroup = L.layerGroup().addTo(mapInstance);

        camerasList.forEach(cam => {
            const color = cam.status === 'active' ? '#10b981' : cam.status === 'maintenance' ? '#f59e0b' : '#f43f5e';
            const iconHtml = `
                <div style="position:relative; width:36px; height:36px;">
                    <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:36px; height:36px; border-radius:50%; background:${color}33; border:2px solid ${color}; animation:pulse-cam 2s infinite ease-out;"></div>
                    <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:20px; height:20px; border-radius:50%; background:${color}; display:flex; align-items:center; justify-content:center; font-size:10px; color:#fff; box-shadow:0 0 10px ${color};">📷</div>
                </div>
            `;
            const icon = L.divIcon({ className: 'cam-poi-icon', html: iconHtml, iconSize: [36, 36], iconAnchor: [18, 18] });
            const marker = L.marker([cam.lat, cam.lng], { icon }).addTo(cameraLayerGroup);

            marker.bindTooltip(`<b>${cam.name}</b><br><span style="font-size:10px; color:${color};">${cam.status === 'active' ? '🟢 Attivo' : cam.status === 'maintenance' ? '🟡 Manutenzione' : '🔴 Disconnesso'}</span>`, {
                className: 'leaflet-tooltip', direction: 'top', offset: [0, -20]
            });

            marker.on('click', () => openCameraFromMap(cam.id));
            cameraMarkers[cam.id] = marker;
        });
    }

    function clearCameraPOIs() {
        if (cameraLayerGroup && mapInstance) {
            mapInstance.removeLayer(cameraLayerGroup);
            cameraLayerGroup = null;
        }
        cameraMarkers = {};
    }

    // ---- OPEN CAMERA VIDEO WINDOW ----
    function openCameraFromMap(camId) {
        openCameraPreview(camId);
    }

    function openCameraPreview(camId) {
        if (openVideoWindows[camId]) {
            // Bring to front
            const win = openVideoWindows[camId].element;
            if (win) { videoWindowZIndex++; win.style.zIndex = videoWindowZIndex; win.classList.add('active-window'); }
            return;
        }

        const cam = camerasList.find(c => c.id === camId);
        if (!cam) return;

        const container = document.getElementById('video-windows-container');
        const windowCount = Object.keys(openVideoWindows).length;
        const offsetX = 100 + (windowCount * 30);
        const offsetY = 100 + (windowCount * 30);

        const win = document.createElement('div');
        win.className = 'video-float-window active-window';
        win.id = 'video-win-' + camId;
        win.style.left = Math.min(offsetX, window.innerWidth - 440) + 'px';
        win.style.top = Math.min(offsetY, window.innerHeight - 340) + 'px';
        videoWindowZIndex++;
        win.style.zIndex = videoWindowZIndex;

        const statusColor = cam.status === 'active' ? '#10b981' : cam.status === 'maintenance' ? '#f59e0b' : '#f43f5e';

        let mediaHtml = '';
        if (cam.sourceType === 'mp4_locale' || cam.sourceType === 'hls') {
            mediaHtml = `<video id="vid-${camId}" autoplay muted loop playsinline></video>`;
        } else if (cam.sourceType === 'mjpeg') {
            mediaHtml = `<img src="${cam.url}" alt="${cam.name}">`;
        } else if (cam.sourceType === 'iframe_embed') {
            mediaHtml = `<iframe src="${cam.url}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
        } else if (cam.sourceType === 'rtsp') {
            mediaHtml = `<div style="color:#f59e0b; font-size:12px; text-align:center; padding:20px;">⚠️ RTSP richiede proxy gateway<br><span style="font-size:10px; color:#94a3b8;">Configura go2rtc o mediamtx per convertire RTSP → HLS/WebRTC</span></div>`;
        }

        win.innerHTML = `
            <div class="video-window-header" data-cam-id="${camId}">
                <div class="video-window-title">
                    <span style="color:${statusColor}; font-size:8px;">●</span>
                    <span>${cam.name}</span>
                </div>
                <div class="video-window-controls">
                    <button onclick="arrangeVideoGrid()" title="Griglia">⊞</button>
                    <button class="close-btn" onclick="closeCameraWindow('${camId}')" title="Chiudi">✖</button>
                </div>
            </div>
            <div class="video-window-body">
                ${mediaHtml}
                <div class="video-scanline-overlay"></div>
            </div>
            <div class="video-window-footer">
                <span>📹 ${cam.sourceType.toUpperCase()}</span>
                <span class="video-timestamp" id="ts-${camId}">--:--:--</span>
            </div>
            <div class="video-resize-handle" data-cam-id="${camId}"></div>
        `;

        container.appendChild(win);
        openVideoWindows[camId] = { element: win, camData: cam };

        // Init video source
        if (cam.sourceType === 'mp4_locale') {
            const vid = document.getElementById('vid-' + camId);
            if (vid) { vid.src = cam.url; vid.play().catch(() => {}); }
        } else if (cam.sourceType === 'hls') {
            const vid = document.getElementById('vid-' + camId);
            if (vid && typeof Hls !== 'undefined' && Hls.isSupported()) {
                const hls = new Hls();
                hls.loadSource(cam.url);
                hls.attachMedia(vid);
                hls.on(Hls.Events.MANIFEST_PARSED, () => vid.play().catch(() => {}));
            } else if (vid && vid.canPlayType('application/vnd.apple.mpegurl')) {
                vid.src = cam.url;
                vid.play().catch(() => {});
            }
        }

        // Make draggable
        makeDraggable(win, camId);
        // Make resizable
        makeResizable(win, camId);
        // Click to bring to front
        win.addEventListener('mousedown', () => {
            Object.values(openVideoWindows).forEach(w => w.element.classList.remove('active-window'));
            videoWindowZIndex++;
            win.style.zIndex = videoWindowZIndex;
            win.classList.add('active-window');
        });

        // Update floating close-all button
        updateCloseAllButton();
        // Draw SVG lines
        updateAllSVGLines();
        // Start timestamps
        startTimestampUpdater();
    }

    function closeCameraWindow(camId) {
        const entry = openVideoWindows[camId];
        if (entry) {
            // Stop video
            const vid = entry.element.querySelector('video');
            if (vid) { vid.pause(); vid.src = ''; }
            entry.element.remove();
            delete openVideoWindows[camId];
        }
        // Remove SVG line
        const line = document.getElementById('svg-line-' + camId);
        if (line) line.remove();

        updateCloseAllButton();
        if (Object.keys(openVideoWindows).length === 0) stopTimestampUpdater();
    }

    function closeAllCameras() {
        Object.keys(openVideoWindows).forEach(camId => closeCameraWindow(camId));
        const svgOverlay = document.getElementById('cam-svg-overlay');
        if (svgOverlay) svgOverlay.innerHTML = '';
    }

    function updateCloseAllButton() {
        const btn = document.getElementById('btn-close-all-cameras');
        if (!btn) return;
        const count = Object.keys(openVideoWindows).length;
        btn.style.display = count > 0 ? 'flex' : 'none';
        btn.innerHTML = `✖ CHIUDI TUTTE LE TELECAMERE (${count})`;
    }

    // ---- DRAG & RESIZE ----
    function makeDraggable(win, camId) {
        const header = win.querySelector('.video-window-header');
        let isDragging = false, startX, startY, startLeft, startTop;

        header.addEventListener('mousedown', e => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = win.offsetLeft;
            startTop = win.offsetTop;
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', e => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            win.style.left = (startLeft + dx) + 'px';
            win.style.top = (startTop + dy) + 'px';
            updateSVGLine(camId);
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.userSelect = '';
            }
        });
    }

    function makeResizable(win, camId) {
        const handle = win.querySelector('.video-resize-handle');
        if (!handle) return;
        let isResizing = false, startX, startY, startW, startH;

        handle.addEventListener('mousedown', e => {
            e.preventDefault();
            e.stopPropagation();
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startW = win.offsetWidth;
            startH = win.offsetHeight;
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', e => {
            if (!isResizing) return;
            const w = Math.max(280, startW + (e.clientX - startX));
            const h = Math.max(220, startH + (e.clientY - startY));
            win.style.width = w + 'px';
            win.style.height = h + 'px';
            updateSVGLine(camId);
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.userSelect = '';
            }
        });
    }

    // ---- SVG CONNECTION LINES ----
    function updateSVGLine(camId) {
        const entry = openVideoWindows[camId];
        if (!entry) return;
        const marker = cameraMarkers[camId];
        if (!marker || !mapInstance) return;

        const svgOverlay = document.getElementById('cam-svg-overlay');
        if (!svgOverlay) return;

        // Get marker screen position
        const point = mapInstance.latLngToContainerPoint(marker.getLatLng());
        const mapEl = document.getElementById('gis-map');
        if (!mapEl) return;
        const mapRect = mapEl.getBoundingClientRect();
        const markerScreenX = mapRect.left + point.x;
        const markerScreenY = mapRect.top + point.y;

        // Get window center
        const win = entry.element;
        const winRect = win.getBoundingClientRect();
        const winCenterX = winRect.left + winRect.width / 2;
        const winCenterY = winRect.top;

        let line = document.getElementById('svg-line-' + camId);
        if (!line) {
            line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.id = 'svg-line-' + camId;
            svgOverlay.appendChild(line);
        }
        
        // Se il marker è fuori dalla visuale della mappa, nascondi la linea
        if (!mapInstance.getBounds().contains(marker.getLatLng())) {
            line.style.display = 'none';
            return;
        } else {
            line.style.display = 'block';
        }

        line.setAttribute('x1', markerScreenX);
        line.setAttribute('y1', markerScreenY);
        line.setAttribute('x2', winCenterX);
        line.setAttribute('y2', winCenterY);
    }

    function updateAllSVGLines() {
        Object.keys(openVideoWindows).forEach(camId => updateSVGLine(camId));
    }

    // Update lines when map moves
    let _origInitGisMap = typeof initGisMap === 'function' ? initGisMap : null;
    // We'll hook into map events after init

    // ---- TIMESTAMP UPDATER ----
    function startTimestampUpdater() {
        if (camTimestampInterval) return;
        camTimestampInterval = setInterval(() => {
            const now = new Date();
            const ts = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            Object.keys(openVideoWindows).forEach(camId => {
                const el = document.getElementById('ts-' + camId);
                if (el) el.textContent = ts;
            });
        }, 1000);
    }

    function stopTimestampUpdater() {
        if (camTimestampInterval) { clearInterval(camTimestampInterval); camTimestampInterval = null; }
    }

    // ---- AUTO GRID ARRANGEMENT ----
    function arrangeVideoGrid() {
        const ids = Object.keys(openVideoWindows);
        if (ids.length === 0) return;

        const cols = Math.ceil(Math.sqrt(ids.length));
        const rows = Math.ceil(ids.length / cols);
        const margin = 10;
        const sidebarW = 290;
        const availW = window.innerWidth - sidebarW - margin * 2;
        const availH = window.innerHeight - 80;
        const cellW = Math.floor(availW / cols) - margin;
        const cellH = Math.floor(availH / rows) - margin;

        ids.forEach((camId, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const win = openVideoWindows[camId].element;
            win.style.left = (sidebarW + margin + col * (cellW + margin)) + 'px';
            win.style.top = (60 + row * (cellH + margin)) + 'px';
            win.style.width = cellW + 'px';
            win.style.height = cellH + 'px';
        });
        setTimeout(updateAllSVGLines, 100);
    }

    // ---- LASSO FREEHAND SELECTION ----
    function toggleLassoMode() {
        lassoMode = !lassoMode;
        const btn = document.getElementById('btn-lasso');
        const canvas = document.getElementById('lasso-canvas');

        if (lassoMode) {
            if (btn) btn.classList.add('btn-lasso-active');
            if (canvas) canvas.style.display = 'block';
            if (mapInstance) mapInstance.dragging.disable();
            initLassoEvents();
        } else {
            if (btn) btn.classList.remove('btn-lasso-active');
            if (canvas) canvas.style.display = 'none';
            if (mapInstance) mapInstance.dragging.enable();
            cleanupLassoEvents();
        }
    }

    let lassoPoints = [];
    let lassoDrawing = false;
    let lassoHandlers = {};

    function initLassoEvents() {
        const canvas = document.getElementById('lasso-canvas');
        if (!canvas) return;
        const mapEl = document.getElementById('gis-map');
        if (mapEl) {
            canvas.width = mapEl.offsetWidth;
            canvas.height = mapEl.offsetHeight;
        }
        const ctx = canvas.getContext('2d');

        lassoHandlers.mousedown = (e) => {
            lassoDrawing = true;
            lassoPoints = [{ x: e.offsetX, y: e.offsetY }];
        };
        lassoHandlers.mousemove = (e) => {
            if (!lassoDrawing) return;
            lassoPoints.push({ x: e.offsetX, y: e.offsetY });
            // Draw
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.beginPath();
            ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
            lassoPoints.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 3]);
            ctx.stroke();
            // Fill
            ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
            ctx.closePath();
            ctx.fill();
        };
        lassoHandlers.mouseup = () => {
            if (!lassoDrawing) return;
            lassoDrawing = false;
            // Close polygon and select cameras
            selectCamerasInLasso();
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Exit lasso mode
            toggleLassoMode();
        };

        canvas.addEventListener('mousedown', lassoHandlers.mousedown);
        canvas.addEventListener('mousemove', lassoHandlers.mousemove);
        canvas.addEventListener('mouseup', lassoHandlers.mouseup);
    }

    function cleanupLassoEvents() {
        const canvas = document.getElementById('lasso-canvas');
        if (!canvas || !lassoHandlers.mousedown) return;
        canvas.removeEventListener('mousedown', lassoHandlers.mousedown);
        canvas.removeEventListener('mousemove', lassoHandlers.mousemove);
        canvas.removeEventListener('mouseup', lassoHandlers.mouseup);
        lassoHandlers = {};
    }

    function selectCamerasInLasso() {
        if (lassoPoints.length < 3 || !mapInstance) return;

        camerasList.forEach(cam => {
            const point = mapInstance.latLngToContainerPoint(L.latLng(cam.lat, cam.lng));
            if (isPointInPolygon(point.x, point.y, lassoPoints)) {
                openCameraPreview(cam.id);
            }
        });
    }

    function isPointInPolygon(x, y, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    // ---- HOOK INTO MAP EVENTS (after map init) ----
    const _origInitGis = typeof window.initGisMap === 'function' ? window.initGisMap : null;
    // We'll add a MutationObserver or post-init hook
    // Instead, we override after a small delay to catch mapInstance
    (function hookMapEvents() {
        const checkInterval = setInterval(() => {
            if (typeof mapInstance !== 'undefined' && mapInstance && mapInstance._loaded) {
                mapInstance.on('move', updateAllSVGLines);
                mapInstance.on('zoom', updateAllSVGLines);
                mapInstance.on('resize', updateAllSVGLines);
                clearInterval(checkInterval);
            }
        }, 1000);
    })();

    // Also update SVG lines on window resize
    window.addEventListener('resize', updateAllSVGLines);
    window.addEventListener('scroll', updateAllSVGLines);

    // ==========================================
    // RADAR MULTIMEDIA FASCICOLI (FILE SYSTEM API)
    // ==========================================
    const AresRadarDB = {
        dbName: 'ares_radar_db',
        storeName: 'master_folders',
        async init() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, 1);
                request.onupgradeneeded = (e) => {
                    e.target.result.createObjectStore(this.storeName);
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        },
        async getHandle(id) {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.storeName, 'readonly');
                const req = tx.objectStore(this.storeName).get(id);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        },
        async saveHandle(id, handle) {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.storeName, 'readwrite');
                const req = tx.objectStore(this.storeName).put(handle, id);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    };

    let activeMasterFolderHandle = null;

    async function pickMasterFolder(fascicoloId) {
        try {
            activeMasterFolderHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            await AresRadarDB.saveHandle('radar_master', activeMasterFolderHandle);
            alert("Cartella Master impostata con successo!");
            document.querySelectorAll('[id^="radar-master-folder-name-"]').forEach(el => {
                el.innerText = `📂 ${activeMasterFolderHandle.name}`;
            });
            if (fascicoloId && typeof loadRadarGallery === 'function') {
                loadRadarGallery(fascicoloId);
            }
        } catch (e) {
            console.error("Scelta cartella annullata o fallita", e);
        }
    }

    async function getVerifyRadarHandle() {
        if (!activeMasterFolderHandle) {
            activeMasterFolderHandle = await AresRadarDB.getHandle('radar_master');
        }
        if (activeMasterFolderHandle) {
            if ((await activeMasterFolderHandle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
                if ((await activeMasterFolderHandle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
                    throw new Error("Permission denied or needs user gesture");
                }
            }
            return activeMasterFolderHandle;
        }
        return null;
    }

    function handleRadarDragOver(e, fascicoloId) {
        e.preventDefault();
        const dropzone = document.getElementById(`radar-dropzone-${fascicoloId}`);
        if(dropzone) dropzone.style.borderColor = '#10b981';
    }

    function handleRadarDragLeave(e, fascicoloId) {
        e.preventDefault();
        const dropzone = document.getElementById(`radar-dropzone-${fascicoloId}`);
        if(dropzone) dropzone.style.borderColor = 'rgba(16,185,129,0.5)';
    }

    async function handleRadarDrop(e, fascicoloId) {
        e.preventDefault();
        const dropzone = document.getElementById(`radar-dropzone-${fascicoloId}`);
        const statusEl = document.getElementById(`radar-status-${fascicoloId}`);
        if(dropzone) dropzone.style.borderColor = 'rgba(16,185,129,0.5)';
        
        if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
        const filesToSave = Array.from(e.dataTransfer.files);

        const masterHandle = await getVerifyRadarHandle();
        if (!masterHandle) {
            statusEl.innerHTML = "<span style='color:#f43f5e'>Errore: Devi prima selezionare la 'Cartella Master' in basso!</span>";
            return;
        }

        statusEl.innerHTML = "Creazione cartella fascicolo...";

        try {
            // Crea o ottiene cartella fascicolo (es. FAS-12)
            const fascicoloFolder = await masterHandle.getDirectoryHandle(`FAS-${fascicoloId}`, { create: true });
            
            for (let i = 0; i < filesToSave.length; i++) {
                const file = filesToSave[i];
                statusEl.innerHTML = `Salvataggio ${file.name}...`;
                const fileHandle = await fascicoloFolder.getFileHandle(file.name, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(file);
                await writable.close();
            }
            statusEl.innerHTML = `<span style='color:#10b981'>✅ ${filesToSave.length} file salvati in locale (FAS-${fascicoloId})</span>`;
            
            // Effetto grafico
            dropzone.style.transform = 'scale(1.05)';
            setTimeout(() => dropzone.style.transform = 'scale(1)', 200);
            
            // Aggiorna galleria
            loadRadarGallery(fascicoloId);

        } catch (err) {
            console.error(err);
            statusEl.innerHTML = "<span style='color:#f43f5e'>Errore durante il salvataggio locale!</span>";
        }
    }

    async function loadRadarGallery(fascicoloId) {
        const btnContainerEl = document.getElementById(`radar-album-btn-container-${fascicoloId}`);
        const statusEl = document.getElementById(`radar-status-${fascicoloId}`);
        if (!btnContainerEl) return;
        
        try {
            const masterHandle = await getVerifyRadarHandle();
            if (!masterHandle) {
                btnContainerEl.innerHTML = `<div style="width:100%; text-align:center; padding:20px; color:#94a3b8; font-size:12px;">Nessuna Cartella Master collegata.<br>Clicca "Cambia Cartella Master" in basso per ripristinare il collegamento.</div>`;
                return;
            }
            
            let fascicoloFolder;
            try {
                fascicoloFolder = await masterHandle.getDirectoryHandle(`FAS-${fascicoloId}`);
            } catch(e) {
                btnContainerEl.innerHTML = `<div style="width:100%; text-align:center; padding:20px; color:#94a3b8; font-size:12px;">Nessun file presente nel Radar.<br>Trascina un file nel cerchio per iniziare.</div>`;
                return;
            }
            
            let fileCount = 0;
            let totalSizeBytes = 0;
            
            for await (const entry of fascicoloFolder.values()) {
                if (entry.kind === 'file') {
                    fileCount++;
                    const file = await entry.getFile();
                    totalSizeBytes += file.size;
                }
            }
            
            if(fileCount > 0) {
                if(statusEl) statusEl.innerHTML = `<span style='color:#10b981'>✅ ${fileCount} file trovati in locale</span>`;
                if(btnContainerEl) btnContainerEl.innerHTML = '';
            } else {
                btnContainerEl.innerHTML = `<div style="width:100%; text-align:center; padding:20px; color:#94a3b8; font-size:12px;">Cartella vuota.</div>`;
            }
            
        } catch (e) {
            console.error("Errore Radar Gallery:", e);
            btnContainerEl.innerHTML = `
                <div style="width:100%; text-align:center; padding:20px;">
                    <button onclick="loadRadarGallery(${fascicoloId})" style="padding:10px 20px; background:linear-gradient(135deg, #10b981, #059669); border:none; border-radius:8px; color:#fff; font-weight:bold; cursor:pointer; box-shadow:0 5px 15px rgba(16,185,129,0.3);">
                        🔓 Clicca qui per sbloccare l'accesso al tuo Hard Disk
                    </button>
                    <div style="color:#94a3b8; font-size:11px; margin-top:10px;">Il browser per sicurezza richiede un tuo click esplicito per leggere i file locali dopo ogni riavvio.</div>
                </div>
            `;
        }
    }

    async function openRadarAlbum(fascicoloId, masterName) {
        console.log("openRadarAlbum chiamato:", fascicoloId, masterName);
        // Create full-screen modal
        const modal = document.createElement('div');
        modal.id = `radar-modal-${fascicoloId}`;
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            z-index: 99999; display: flex; flex-direction: column; opacity: 0; transition: opacity 0.3s ease;
            overflow-y: auto; padding-bottom: 50px;
        `;
        
        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            width: 100%; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center;
            background: linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%);
            position: sticky; top: 0; z-index: 10;
        `;
        
        const titleArea = document.createElement('div');
        titleArea.innerHTML = `
            <h1 style="color: white; margin: 0; font-size: 28px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">📸 Album Fotografico - Fascicolo ${fascicoloId}</h1>
            <div style="color: #94a3b8; font-size: 14px; margin-top: 5px;">Cartella Master: <span style="color:#38bdf8">${masterName}</span> / FAS-${fascicoloId}</div>
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = "✖ Chiudi Album";
        closeBtn.style.cssText = `
            background: rgba(239, 68, 68, 0.8); color: white; border: 1px solid rgba(255,255,255,0.2);
            padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer;
            transition: all 0.2s; font-size: 14px;
        `;
        closeBtn.onmouseover = () => closeBtn.style.background = "#ef4444";
        closeBtn.onmouseout = () => closeBtn.style.background = "rgba(239, 68, 68, 0.8)";
        closeBtn.onclick = () => {
            modal.style.opacity = '0';
            setTimeout(() => document.body.removeChild(modal), 300);
        };
        
        header.appendChild(titleArea);
        header.appendChild(closeBtn);
        modal.appendChild(header);
        
        // Loading State
        const grid = document.createElement('div');
        grid.style.cssText = `
            display: flex; flex-wrap: wrap; gap: 30px; justify-content: center; padding: 40px; max-width: 1400px; margin: 0 auto;
        `;
        grid.innerHTML = '<div style="color:#fff; font-size:18px;">Caricamento file locali in corso...</div>';
        modal.appendChild(grid);
        document.body.appendChild(modal);
        
        // Animate in
        requestAnimationFrame(() => modal.style.opacity = '1');
        
        // Load files
        try {
            const masterHandle = await getVerifyRadarHandle();
            if (!masterHandle) throw new Error("No handle");
            const fascicoloFolder = await masterHandle.getDirectoryHandle(`FAS-${fascicoloId}`);
            
            let fileEntries = [];
            
            for await (const entry of fascicoloFolder.values()) {
                if (entry.kind === 'file') {
                    const file = await entry.getFile();
                    fileEntries.push(file);
                }
            }
            
            grid.innerHTML = ''; // clear loading
            
            if (fileEntries.length === 0) {
                grid.innerHTML = '<div style="color:#94a3b8; font-size:18px;">Nessun file presente.</div>';
                return;
            }
            
            fileEntries.forEach(file => {
                const isImg = file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|gif|webp|heic|bmp)$/i);
                const isVid = file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mov|avi)$/i);
                const url = URL.createObjectURL(file);
                
                const wrapper = document.createElement('div');
                const rot = (Math.random() * 8 - 4).toFixed(1);
                
                wrapper.style.cssText = `
                    background: #fff; padding: 12px 12px 40px 12px; border-radius: 4px;
                    box-shadow: 0 15px 35px rgba(0,0,0,0.5); width: 220px; text-align: center;
                    transform: rotate(${rot}deg) translateY(0); transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                    cursor: pointer; position: relative;
                `;
                
                // Hover Effects
                wrapper.onmouseover = () => {
                    wrapper.style.transform = `scale(1.15) rotate(0deg) translateY(-10px)`;
                    wrapper.style.zIndex = "50";
                    wrapper.style.boxShadow = "0 25px 50px rgba(0,0,0,0.7)";
                };
                wrapper.onmouseout = () => {
                    wrapper.style.transform = `rotate(${rot}deg) translateY(0)`;
                    wrapper.style.zIndex = "1";
                    wrapper.style.boxShadow = "0 15px 35px rgba(0,0,0,0.5)";
                };
                
                // Lightbox Click
                wrapper.onclick = () => openLightbox(url, isImg, isVid, file.name);
                
                let mediaHTML = '';
                if(isImg) {
                    mediaHTML = `<img src="${url}" style="width:100%; height:180px; object-fit:cover; border:1px solid #e2e8f0;">`;
                } else if (isVid) {
                    mediaHTML = `<video src="${url}" style="width:100%; height:180px; object-fit:cover; border:1px solid #e2e8f0; background:#000;"></video>
                                 <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:40px; pointer-events:none; opacity:0.8;">▶️</div>`;
                } else {
                    mediaHTML = `<div style="width:100%; height:180px; background:#f1f5f9; border:1px solid #e2e8f0; display:flex; justify-content:center; align-items:center; font-size:50px;">📄</div>`;
                }
                
                wrapper.innerHTML = `
                    ${mediaHTML}
                    <div style="color:#1e293b; font-family:'Segoe UI', sans-serif; font-weight:bold; font-size:12px; margin-top:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${(isVid ? "🎬 " : "")}${file.name}
                    </div>
                `;
                grid.appendChild(wrapper);
            });
            
        } catch (e) {
            console.error("Errore openRadarAlbum:", e);
            grid.innerHTML = '<div style="color:#ef4444; font-size:18px;">Errore nel caricamento delle foto. L\'accesso potrebbe essere stato negato.</div>';
        }
    }
    
    function openLightbox(url, isImg, isVid, filename) {
        const lb = document.createElement('div');
        lb.style.cssText = `
            position: fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.95);
            z-index: 999999; display:flex; flex-direction:column; justify-content:center; align-items:center;
            opacity: 0; transition: opacity 0.3s;
        `;
        
        const close = document.createElement('button');
        close.innerHTML = "✖ Chiudi";
        close.style.cssText = `
            position:absolute; top:30px; right:40px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.3);
            color:white; padding:10px 20px; border-radius:8px; cursor:pointer; font-size:16px; font-weight:bold; z-index:10;
        `;
        close.onclick = () => {
            lb.style.opacity = '0';
            setTimeout(() => document.body.removeChild(lb), 300);
        };
        
        let content = '';
        if(isImg) {
            content = `<img src="${url}" style="max-width:90vw; max-height:85vh; object-fit:contain; border-radius:8px; box-shadow:0 0 40px rgba(0,0,0,0.8);">`;
        } else if (isVid) {
            content = `<video src="${url}" controls autoplay style="max-width:90vw; max-height:85vh; border-radius:8px; box-shadow:0 0 40px rgba(0,0,0,0.8);"></video>`;
        } else {
            content = `<div style="color:white; font-size:24px;">Anteprima non disponibile per questo file.</div>`;
        }
        
        lb.innerHTML = `
            ${content}
            <div style="color:#cbd5e1; margin-top:20px; font-size:18px; font-family:monospace;">${filename}</div>
        `;
        lb.appendChild(close);
        document.body.appendChild(lb);
        requestAnimationFrame(() => lb.style.opacity = '1');
    }
    
    // Assicura che la funzione sia globale per i bottoni generati dinamicamente
    window.openRadarAlbum = openRadarAlbum;

    // ==========================================
    // MODULE: FASCICOLI LAVORI (DOSSIER DIGITALE)
    // ==========================================
    let aresFascicoli = [];
    
    // Generatore sonoro "Swoosh" per sfoglio pagina (usando Web Audio API, per non scaricare file)
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    function playFlipSound() {
        if(audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    }

    async function fetchFascicoli() {
        if (!supabaseClient) return;
        const { data, error } = await supabaseClient.from('ares_fascicoli').select('*').order('created_at', { ascending: false });
        if (!error && data) aresFascicoli = data;
    }

    async function renderFascicoli() {
        await fetchFascicoli();
        const container = document.getElementById('fascicoli-container');
        
        let html = `
            <div class="omnisearch-container">
                <span class="omnisearch-icon">🔍</span>
                <input type="text" class="omnisearch-input" placeholder="Cerca commessa, cliente o ID..." onkeyup="filterFascicoli(this.value)">
            </div>
            <div class="fascicoli-grid" id="fascicoli-grid-render">
        `;
        
        if(aresFascicoli.length === 0) {
            html += `<div style="color:#94a3b8; text-align:center; width:100%; grid-column: 1 / -1;">Nessun fascicolo trovato. Convalida un preventivo per crearne uno.</div>`;
        } else {
            aresFascicoli.forEach(f => {
                html += `
                <div class="fascicolo-card" style="position:relative; cursor:pointer;">
                    <button onclick="event.stopPropagation(); deleteFascicolo(${f.id})" style="position:absolute; top:10px; right:10px; background:rgba(244, 63, 94, 0.2); border:none; border-radius:4px; color:#f43f5e; cursor:pointer; font-size:12px; padding:4px 8px; z-index:10;">🗑️ Elimina</button>
                    <div onclick="openFascicoloBook(${f.id})">
                        <div style="font-size:12px; color:#38bdf8; font-weight:700; margin-bottom:5px;">#FAS-${f.id}</div>
                        <div style="font-size:18px; color:#fff; font-weight:700; margin-bottom:10px;">${f.titolo_commessa || 'Senza Titolo'}</div>
                        <div style="font-size:12px; color:#94a3b8;">📅 Inizio: ${f.data_inizio || '-'}</div>
                        <div style="font-size:12px; color:#94a3b8;">📍 ${f.indirizzo || 'N/D'}</div>
                        <div style="margin-top:15px; font-size:11px; background:rgba(56,189,248,0.1); color:#38bdf8; padding:5px; border-radius:4px; text-align:center;">
                            📖 Apri Fascicolo
                        </div>
                    </div>
                </div>`;
            });
        }
        
        html += `</div>`;
        container.innerHTML = html;
        
        // Setup Book Modal se non esiste
        if(!document.getElementById('fascicolo-book-modal')) {
            const modalHTML = `
            <div id="fascicolo-book-modal" class="book-modal-overlay">
                <button class="book-close-btn" onclick="closeFascicoloBook()" style="z-index: 100000;">X CHIUDI</button>
                <div id="book-nav-prev" onclick="handleBookNav('prev')" style="position:absolute; left:20px; top:50%; transform:translateY(-50%); font-size:80px; width:60px; text-align:center; color:rgba(255,255,255,0.3); cursor:pointer; z-index:10000; transition:0.3s; user-select:none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='rgba(255,255,255,0.3)'">◀</div>
                <div id="fascicolo-book-wrapper" style="display:flex; justify-content:center; align-items:center; width:100%; height:calc(100% - 110px); transition: transform 0.5s;">
                    <div class="book-container" id="fascicolo-book-element">
                        <!-- Pagine generate dinamicamente -->
                    </div>
                </div>
                <div id="book-nav-next" onclick="handleBookNav('next')" style="position:absolute; right:20px; top:50%; transform:translateY(-50%); font-size:80px; width:60px; text-align:center; color:rgba(255,255,255,0.3); cursor:pointer; z-index:10000; transition:0.3s; user-select:none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='rgba(255,255,255,0.3)'">▶</div>
                
                <!-- TOOLBAR FILE LOCALI - FUORI DA STPAGEFLIP -->
                <div id="fascicolo-file-toolbar" style="position:absolute; bottom:0; left:0; right:0; height:100px; background:linear-gradient(180deg, rgba(15,23,42,0.0) 0%, rgba(15,23,42,0.95) 30%, #0f172a 100%); display:flex; align-items:center; justify-content:center; gap:25px; z-index:100001; padding:0 100px; opacity:0; pointer-events:none; transition: opacity 0.4s ease;">
                    
                    <div id="toolbar-dropzone" style="width:70px; height:70px; border-radius:50%; border:2px dashed rgba(16,185,129,0.5); background:rgba(0,0,0,0.3); display:flex; justify-content:center; align-items:center; cursor:pointer; transition:all 0.3s; flex-shrink:0;" title="Trascina qui i file">
                        <div style="font-size:28px; pointer-events:none;">📡</div>
                    </div>
                    
                    <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-start;">
                        <div id="toolbar-folder-name" style="color:#34d399; font-size:11px; font-family:monospace;"></div>
                        <div id="toolbar-status" style="font-size:12px; color:#94a3b8; font-family:monospace;">In attesa di file...</div>
                    </div>
                    
                    <button id="toolbar-pick-folder-btn" style="padding:10px 18px; background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.4); border-radius:8px; color:#34d399; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s; white-space:nowrap;" onmouseover="this.style.background='rgba(16,185,129,0.3)'" onmouseout="this.style.background='rgba(16,185,129,0.15)'">
                        ⚙️ Cambia Cartella Master
                    </button>
                    
                    <div id="toolbar-album-btn-container" style="display:flex; justify-content:center;"></div>
                </div>

                <!-- TOOLBAR AZIONI GLOBALI (Salva, Salva Diario) - FUORI DA STPAGEFLIP -->
                <div id="fascicolo-actions-toolbar" style="position:absolute; bottom:30px; left:40px; display:flex; gap:15px; z-index:100000; transition: opacity 0.3s ease;">
                    <button id="global-btn-salva" style="display:none; padding:10px 15px; background:linear-gradient(135deg, #10b981, #059669); border:none; border-radius:6px; color:#fff; font-weight:bold; cursor:pointer; box-shadow:0 4px 15px rgba(0,0,0,0.5); pointer-events:auto;">🔍 Salva</button>
                    <button id="global-btn-diario" style="display:none; padding:10px 20px; background:#3b82f6; border:none; border-radius:8px; color:#fff; font-weight:bold; cursor:pointer; box-shadow:0 4px 15px rgba(0,0,0,0.5); pointer-events:auto;">💾 Salva Diario</button>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }
    }

    function filterFascicoli(query) {
        query = query.toLowerCase();
        const cards = document.querySelectorAll('#fascicoli-grid-render .fascicolo-card');
        cards.forEach(card => {
            if(card.innerText.toLowerCase().includes(query)) card.style.display = 'block';
            else card.style.display = 'none';
        });
    }

    let fascicoloPageFlip = null;
    let currentFascicoloPhotos = [];
    let currentFascicoloData = null;

    // --- NUOVI SUONI REALISTICI PER IL CAMBIO PAGINA ---
    const flipSounds = [
        new Audio('carta1.mp3'),
        new Audio('carta2.mp3'),
        new Audio('carta3.mp3')
    ];
    flipSounds.forEach(s => s.volume = 0.8);

    function playFlipSound() {
        try {
            const randIndex = Math.floor(Math.random() * flipSounds.length);
            const sound = flipSounds[randIndex];
            sound.currentTime = 0; // Evita la sovrapposizione se si sfoglia velocemente
            sound.play().catch(e => console.log('Audio autoplay bloccato dal browser', e));
        } catch(err) {
            console.error('Errore riproduzione audio:', err);
        }
    }

    function handleBookNav(direction) {
        if (!fascicoloPageFlip) return;
        try {
            if (direction === 'prev') {
                fascicoloPageFlip.flipPrev();
                // Fallback nel caso in cui l'animazione di flipPrev fallisca (noto bug di PageFlip sull'ultima pagina)
                setTimeout(() => {
                    if (fascicoloPageFlip.getState() === 'read') {
                        fascicoloPageFlip.turnToPrevPage();
                    }
                }, 100);
            } else {
                fascicoloPageFlip.flipNext();
            }
        } catch(e) {
            console.error("Book nav error:", e);
        }
    }


    function openFascicoloBook(id) {
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
            
            // Imposta funzioni onClick per bottoni globali
            const btnSalva = document.getElementById('global-btn-salva');
            const btnDiario = document.getElementById('global-btn-diario');
            if(btnSalva) {
                btnSalva.onclick = () => geocodeFascicoloAddress(fascicolo.id);
                btnSalva.style.display = 'block'; // Visibile inizialmente
            }
            if(btnDiario) {
                btnDiario.onclick = () => saveFascicoloNote(fascicolo.id);
                btnDiario.style.display = 'block'; // Visibile inizialmente
            }
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
            
            // GESTIONE VISIBILITÀ BOTTONI GLOBALI (solo pagine 1 e 2, cioè indice < 2)
            const btnSalva = document.getElementById('global-btn-salva');
            const btnDiario = document.getElementById('global-btn-diario');
            if(btnSalva && btnDiario) {
                if(e.data < 2) {
                    btnSalva.style.display = 'block';
                    btnDiario.style.display = 'block';
                } else {
                    btnSalva.style.display = 'none';
                    btnDiario.style.display = 'none';
                }
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
                    const url = URL.createObjectURL(file);
                    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(file.name);
                    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|avi)$/i.test(file.name);
                    photos.push({ name: file.name, url: url, type: file.type, size: file.size, isImage: isImage, isVideo: isVideo });
                }
            }
            
            if (photos.length > 0) {
                currentFascicoloPhotos = photos;
                rebuildFascicoloBook();
            }
            
            // Aggiorna lo status nella toolbar
            const statusEl = document.querySelector('[id^="radar-status-"]');
            if (statusEl && photos.length > 0) {
                statusEl.innerHTML = "<span style='color:#10b981'>\u2705 " + photos.length + " foto caricate</span>";
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
    
    function showPhotoLightbox(url, name, isImage, isVideo) {
        let lb = document.getElementById('photo-lightbox');
        if (!lb) {
            lb = document.createElement('div');
            lb.id = 'photo-lightbox';
            lb.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.95); z-index:999999; display:flex; align-items:center; justify-content:center; flex-direction:column; cursor:pointer; opacity:0; transition:opacity 0.3s;';
            lb.onclick = (e) => { 
                if(e.target.tagName !== 'A') {
                    lb.style.opacity = '0'; 
                    setTimeout(() => { lb.style.display = 'none'; lb.innerHTML=''; }, 300); 
                }
            };
            document.body.appendChild(lb);
        }
        
        const isPdf = name && name.toLowerCase().endsWith('.pdf');
        let mediaHtml = '';
        if (isImage === 'true' || isImage === true) {
            mediaHtml = '<img src="' + url + '" style="max-width:90vw; max-height:85vh; object-fit:contain; border-radius:8px; box-shadow:0 20px 60px rgba(0,0,0,0.8);">';
        } else if (isVideo === 'true' || isVideo === true) {
            mediaHtml = '<video src="' + url + '" controls autoplay style="max-width:90vw; max-height:85vh; object-fit:contain; border-radius:8px; box-shadow:0 20px 60px rgba(0,0,0,0.8);"></video>';
        } else if (isPdf) {
            mediaHtml = `<iframe src="${url}" style="width:80vw; height:85vh; border:none; border-radius:8px; box-shadow:0 20px 60px rgba(0,0,0,0.8); background:#fff;"></iframe>`;
        } else {
            mediaHtml = `
                <div style="font-size:100px; margin-bottom:20px;">📄</div>
                <div style="color:#fff; font-size:24px; font-weight:bold; margin-bottom:20px;">Anteprima non disponibile</div>
                <a href="${url}" download="${name}" style="padding:15px 30px; background:#38bdf8; color:#fff; text-decoration:none; border-radius:8px; font-weight:bold; font-size:16px;">Scarica File</a>
            `;
        }
        
        lb.innerHTML = mediaHtml + '<div style="color:#fff; font-size:14px; margin-top:15px; opacity:0.7;">' + name + ' — Clicca sullo sfondo per chiudere</div>';
        lb.style.display = 'flex';
        setTimeout(() => { lb.style.opacity = '1'; }, 10);
    }

    function setupFileToolbar(fascicoloId) {
        const toolbar = document.getElementById('fascicolo-file-toolbar');
        if(!toolbar) return;
        
        // Bottone Cambia Cartella Master
        const pickBtn = document.getElementById('toolbar-pick-folder-btn');
        if(pickBtn) pickBtn.onclick = () => pickMasterFolder(fascicoloId);
        
        // Drop Zone
        const dropzone = document.getElementById('toolbar-dropzone');
        if(dropzone) {
            dropzone.ondragover = (e) => handleRadarDragOver(e, fascicoloId);
            dropzone.ondragleave = (e) => handleRadarDragLeave(e, fascicoloId);
            dropzone.ondrop = (e) => handleRadarDrop(e, fascicoloId);
        }
        
        // Carica la gallery nel container della toolbar
        const albumContainer = document.getElementById('toolbar-album-btn-container');
        if(albumContainer) albumContainer.id = 'radar-album-btn-container-' + fascicoloId;
        
        // Status e folder name
        const statusEl = document.getElementById('toolbar-status');
        if(statusEl) statusEl.id = 'radar-status-' + fascicoloId;
        const folderNameEl = document.getElementById('toolbar-folder-name');
        if(folderNameEl) folderNameEl.id = 'radar-master-folder-name-' + fascicoloId;
        
        if(typeof loadRadarGallery === 'function') loadRadarGallery(fascicoloId);
    }

    function generateBookPages(fascicolo, photos) {
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
                        <input type="text" id="fascicolo-address-${fascicolo.id}" value="${fascicolo.indirizzo || ''}" placeholder="Cerca indirizzo (es. Via Roma 1, Milano)" style="flex:1; padding:10px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.3); color:#fff; font-size:14px; outline:none; position:relative; z-index:9999; pointer-events:auto; " onkeyup="handleFascicoloAddressSearch(this.value, ${fascicolo.id})" onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation();">
                        
                        <div id="fascicolo-address-results-${fascicolo.id}" style="display:none; position:absolute; top:45px; left:0; width:100%; background:#1e293b; border:1px solid rgba(255,255,255,0.1); border-radius:6px; box-shadow:0 10px 25px rgba(0,0,0,0.5); z-index:9999; max-height:150px; overflow-y:auto;"></div>
                    </div>
                </div>
                </div>
        `;
        
        // --- Pagina 2 ---
        let p2 = `
                <div class="my-book-page" style="${pageStyle} box-shadow: inset 10px 0 20px rgba(0,0,0,0.5);">
                <h3 style="color:#f59e0b; border-bottom:1px solid rgba(245, 158, 11, 0.3); padding-bottom:10px;">Diario Operativo & Note</h3>
                <textarea id="note-fascicolo-${fascicolo.id}" style="width:100%; height:300px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; padding:15px; font-family:monospace; resize:none; position:relative; z-index:9999; pointer-events:auto; " placeholder="Scrivi qui gli appunti della commessa..." onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation();">${fascicolo.note_diario || ''}</textarea>
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
                        <div onclick="addFascicoloTask(${fascicolo.id})" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); padding:12px; border-radius:8px; display:flex; align-items:center; justify-content:center; border-style:dashed; cursor:pointer;" onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation();">
                            <span style="color:#94a3b8; font-size:13px;">+ Aggiungi Task / Scadenza</span>
                        </div>
                    </div>
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
                        <div onclick="assignFascicoloResource(${fascicolo.id})" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); padding:12px; border-radius:8px; display:flex; align-items:center; justify-content:center; border-style:dashed; cursor:pointer;" onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation();">
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
                    <button onclick="focusFascicoloOnGIS(${fascicolo.lat}, ${fascicolo.lng})" style="width:100%; padding:15px; background:linear-gradient(135deg, #0ea5e9, #0284c7); border:none; border-radius:8px; color:#fff; font-weight:bold; font-size:14px; cursor:pointer; margin-top:15px; box-shadow:0 10px 20px rgba(14,165,233,0.2); position:relative; z-index:9999; pointer-events:auto; " onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation();">
                        🎯 Centra in Sala Operativa
                    </button>
                    ` : ''}
                    <button onclick="setFascicoloCoordinates(${fascicolo.id})" style="width:100%; padding:10px; background:transparent; border:1px solid rgba(14,165,233,0.3); border-radius:8px; color:#38bdf8; font-size:12px; cursor:pointer; margin-top:10px; position:relative; z-index:9999; pointer-events:auto; " onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation();">
                        📍 Imposta Coordinate Manuali
                    </button>
                </div>
                </div>
        `;
        
        // --- Pagine Galleria Fotografica (dinamiche) ---
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
                    const safeName = photo.name.replace(/'/g, "\\'");
                    
                    let thumbHtml = '';
                    if (photo.isImage) {
                        thumbHtml = `<img src="${safeUrl}" style="width:100%; height:130px; object-fit:cover; border-radius:2px;" onerror="this.style.display='none'">`;
                    } else if (photo.isVideo) {
                        thumbHtml = `
                            <div style="width:100%; height:130px; background:#1e293b; display:flex; align-items:center; justify-content:center; border-radius:2px;">
                                <div style="font-size:40px;">▶️</div>
                            </div>`;
                    } else {
                        thumbHtml = `
                            <div style="width:100%; height:130px; background:#334155; display:flex; align-items:center; justify-content:center; border-radius:2px; flex-direction:column;">
                                <div style="font-size:40px;">📄</div>
                                <div style="color:#cbd5e1; font-size:10px; margin-top:5px; font-weight:bold;">FILE</div>
                            </div>`;
                    }
                    
                    photoCells += `
                        <button onclick="showPhotoLightbox('${safeUrl}', '${safeName}', ${photo.isImage}, ${photo.isVideo})" style="background:#fff; padding:6px 6px 20px 6px; border:none; border-radius:3px; cursor:pointer; box-shadow:0 4px 15px rgba(0,0,0,0.4); transform:rotate(${rot}deg); transition:all 0.3s; text-align:center;" onmouseover="this.style.transform='rotate(0deg) scale(1.05)'" onmouseout="this.style.transform='rotate(${rot}deg) scale(1)'">
                            ${thumbHtml}
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

        return p1 + p2 + p3 + p4 + p5 + photoPages;
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
        const wrapper = document.getElementById('fascicolo-book-wrapper');
        
        if (wrapper) wrapper.style.transform = "rotateX(5deg) scale(0.8)";
        if (modal) modal.classList.remove('active');
        

        
        if (fascicoloPageFlip) {
            setTimeout(() => {
                try { fascicoloPageFlip.destroy(); } catch(e) {}
                fascicoloPageFlip = null;
                if (wrapper) wrapper.innerHTML = '<div class="book-container" id="fascicolo-book-element"></div>';
            }, 300);
        }
    }

    function copyLocalPath(path) {
        if(!path) {
            alert("Nessun percorso locale associato a questo fascicolo.");
            return;
        }
        navigator.clipboard.writeText(path).then(() => {
            alert("Percorso Cartella copiato! Vai su Esplora Risorse di Windows e fai INCOLLA nella barra in alto per aprire gli allegati.");
        });
    }

    async function saveFascicoloNote(id) {
        const text = document.getElementById(`note-fascicolo-${id}`).value;
        if(supabaseClient) {
            await supabaseClient.from('ares_fascicoli').update({ note_diario: text }).eq('id', id);
            alert("Diario salvato nel Cloud!");
        }
    }

    async function autoCreateFascicoloFromPreventivo(prev) {
        if(!supabaseClient) return;
        
        // Controlla se esiste già
        const { data: ext } = await supabaseClient.from('ares_fascicoli').select('id').eq('preventivo_id', prev.id).maybeSingle();
        if(ext) return; // Esiste già
        
        const fascicolo = {
            titolo_commessa: prev.cliente + (prev.note ? " - " + prev.note : ""),
            preventivo_id: prev.id,
            indirizzo: "",
            data_inizio: new Date().toISOString().split('T')[0],
            percorso_locale: `D:\\Ares_Archivio\\Commessa_${prev.id}_${prev.cliente.replace(/\\s+/g, '_')}`
        };
        
        const { error } = await supabaseClient.from('ares_fascicoli').insert([fascicolo]);
        if(!error) console.log("Fascicolo autogenerato per il preventivo " + prev.id);
    }

    // Load cameras on startup
    loadCameras();
    updateCamKPI();


// ==========================================
// HMI MULTI-SCHERMO (DETACHABLE VIEWS)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const isDetached = urlParams.get('detached') === 'true';
    const detachedView = urlParams.get('view');
    const aresChannel = new BroadcastChannel('ares_channel');

    // Funzione per inviare broadcast
    window.sendAresBroadcast = function(action, payload) {
        aresChannel.postMessage({ action, payload, source: isDetached ? 'detached' : 'main' });
    };

    // Ascolto Broadcast
    aresChannel.onmessage = (event) => {
        const { action, payload, source } = event.data;
        if (action === 'reattach' && source === 'detached' && payload === detachedView) {
            console.log(`Modulo ${payload} ri-ancorato`);
        }
        if (action === 'sync_data') {
            console.log("Ricevuto sync data:", payload);
        }
    };

    if (isDetached) {
        // Entriamo in modalità Detached
        document.body.classList.add('detached-mode');
        
        // Nascondiamo tutte le viste
        document.querySelectorAll('.view-section').forEach(view => {
            view.style.display = 'none';
        });
        
        // Mostriamo e inizializziamo solo quella richiesta
        if (detachedView) {
            const targetView = document.getElementById(`view-${detachedView}`);
            if (targetView) {
                targetView.style.display = 'block';
                // Ritardo per assicurare che completeAppInitialization() sia finito
                setTimeout(() => {
                    if (typeof show === 'function') {
                        show(detachedView);
                    }
                    window.dispatchEvent(new Event('resize'));
                }, 800);
            }
        }

        // Creazione bottone Re-Attach
        const reattachBtn = document.createElement('button');
        reattachBtn.className = 'btn-reattach';
        reattachBtn.innerHTML = '↙️ Ri-Ancora Finestra';
        reattachBtn.onclick = () => {
            sendAresBroadcast('reattach', detachedView);
            window.close();
        };
        document.body.appendChild(reattachBtn);

        // Se l'utente chiude la finestra con la X
        window.addEventListener('beforeunload', () => {
            sendAresBroadcast('reattach', detachedView);
        });

    } else {
        // Modalità Main: Aggiungiamo i bottoni Detach ai titoli delle view
        document.querySelectorAll('.view-section').forEach(view => {
            const viewId = view.id.replace('view-', '');
            
            // Creiamo il bottone
            const detachBtn = document.createElement('button');
            detachBtn.className = 'btn-detach';
            detachBtn.innerHTML = '↗️ Sgancia';
            detachBtn.title = 'Sgancia in una nuova finestra indipendente';
            detachBtn.onclick = (e) => {
                e.preventDefault();
                // Apriamo la nuova finestra
                window.open(`${window.location.pathname}?detached=true&view=${viewId}`, `_blank_ares_${viewId}`, "width=1200,height=800,menubar=no,toolbar=no,location=no,status=no");
            };

            // Inject logic
            const header = view.querySelector('.bi-header, .planning-header-bar, .crm-header') || view.querySelector('h2, h1, h3');
            if (header) {
                if (header.tagName && header.tagName.match(/^H[1-6]$/i)) {
                    // Standard header
                    header.style.display = 'flex';
                    header.style.alignItems = 'center';
                    header.style.justifyContent = 'space-between';
                    header.appendChild(detachBtn);
                } else {
                    // Header container
                    header.appendChild(detachBtn);
                }
            } else {
                // Fallback
                const wrap = document.createElement('div');
                wrap.style.padding = '10px 20px';
                wrap.style.display = 'flex';
                wrap.style.justifyContent = 'flex-end';
                wrap.appendChild(detachBtn);
                view.insertBefore(wrap, view.firstChild);
            }
        });
    }
});


    const neonTab = document.getElementById('sidebar-neon-tab');
    const mainSidebar = document.getElementById('main-sidebar');
    const pinBtn = document.getElementById('sidebar-pin-btn');
    let isSidebarPinned = false;
    let sidebarHideTimeout;

    const neonTabRight = document.getElementById('sidebar-neon-tab-right');
    const rightSidebar = document.getElementById('right-sidebar');
    const rightPinBtn = document.getElementById('right-sidebar-pin-btn');
    let isRightSidebarPinned = false;
    let rightSidebarHideTimeout;

    function openSidebar() {
        mainSidebar.classList.add('active');
        neonTab.style.transform = 'translateY(-50%) translateX(-20px)'; // sposta fuori
        neonTab.style.opacity = '0';
    }

    function closeSidebar() {
        if(isSidebarPinned) return;
        mainSidebar.classList.remove('active');
        neonTab.style.transform = 'translateY(-50%) translateX(0)'; // rimetti a posto
        neonTab.style.opacity = '1';
    }

    function toggleSidebarPin() {
        isSidebarPinned = !isSidebarPinned;
        if(isSidebarPinned) {
            mainSidebar.classList.add('pinned');
            pinBtn.classList.add('pinned');
            document.body.classList.add('sidebar-pinned');
        } else {
            mainSidebar.classList.remove('pinned');
            pinBtn.classList.remove('pinned');
            document.body.classList.remove('sidebar-pinned');
        }
    }

    if(neonTab && mainSidebar) {
        neonTab.addEventListener('mouseenter', openSidebar);
        neonTab.addEventListener('click', openSidebar);
        
        mainSidebar.addEventListener('mouseleave', () => {
            sidebarHideTimeout = setTimeout(closeSidebar, 400);
        });
        
        mainSidebar.addEventListener('mouseenter', () => {
            clearTimeout(sidebarHideTimeout);
        });
    }

    function openRightSidebar() {
        rightSidebar.classList.add('active');
        neonTabRight.style.transform = 'translateY(-50%) translateX(20px)'; // sposta fuori a destra
        neonTabRight.style.opacity = '0';
    }

    function closeRightSidebar() {
        if(isRightSidebarPinned) return;
        rightSidebar.classList.remove('active');
        neonTabRight.style.transform = 'translateY(-50%) translateX(0)'; // rimetti a posto
        neonTabRight.style.opacity = '1';
    }

    function toggleRightSidebarPin() {
        isRightSidebarPinned = !isRightSidebarPinned;
        if(isRightSidebarPinned) {
            rightSidebar.classList.add('pinned');
            rightPinBtn.classList.add('pinned');
            document.body.classList.add('right-sidebar-pinned');
        } else {
            rightSidebar.classList.remove('pinned');
            rightPinBtn.classList.remove('pinned');
            document.body.classList.remove('right-sidebar-pinned');
        }
    }

    if(neonTabRight && rightSidebar) {
        neonTabRight.addEventListener('mouseenter', openRightSidebar);
        neonTabRight.addEventListener('click', openRightSidebar);
        
        rightSidebar.addEventListener('mouseleave', () => {
            rightSidebarHideTimeout = setTimeout(closeRightSidebar, 400);
        });
        
        rightSidebar.addEventListener('mouseenter', () => {
            clearTimeout(rightSidebarHideTimeout);
        });
    }

    document.addEventListener('click', (e) => {
        if(!isSidebarPinned && mainSidebar && neonTab) {
            if(!mainSidebar.contains(e.target) && !neonTab.contains(e.target)) {
                closeSidebar();
            }
        }
        if(!isRightSidebarPinned && rightSidebar && neonTabRight) {
            if(!rightSidebar.contains(e.target) && !neonTabRight.contains(e.target)) {
                closeRightSidebar();
            }
        }
    });
    // --- FASCICOLI EXTENSION FUNCTIONS ---
    async function addFascicoloTask(fascicoloId) {
        // Crea l'overlay del modale glassmorphism
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        overlay.style.backdropFilter = 'blur(10px)';
        overlay.style.zIndex = '100000';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';

        overlay.innerHTML = `
            <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(139, 92, 246, 0.4); padding: 30px; border-radius: 16px; box-shadow: 0 20px 50px rgba(0,0,0,0.8); width: 450px; text-align:center; font-family: 'Inter', sans-serif;">
                <h3 style="color:#8b5cf6; margin-top:0; margin-bottom:10px; font-size:22px;">Pianifica Task / Scadenza</h3>
                <p style="color:#94a3b8; font-size:14px; margin-bottom:25px; line-height:1.5;">Inserisci i dettagli dell'evento per questo fascicolo. Sarà visibile anche sul calendario generale.</p>
                
                <div style="text-align: left; margin-bottom: 15px;">
                    <label style="color:#cbd5e1; font-size:12px; font-weight:bold; margin-bottom:5px; display:block;">DESCRIZIONE EVENTO</label>
                    <input type="text" id="task-desc" placeholder="Es. Ispezione in Cantiere" style="width:100%; padding:12px; border-radius:8px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:14px; outline:none; box-sizing:border-box;">
                </div>

                <div style="display:flex; gap:15px; margin-bottom: 25px;">
                    <div style="flex:1; text-align: left;">
                        <label style="color:#cbd5e1; font-size:12px; font-weight:bold; margin-bottom:5px; display:block;">DATA</label>
                        <input type="date" id="task-date" style="width:100%; padding:12px; border-radius:8px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:14px; outline:none; box-sizing:border-box; cursor:pointer;">
                    </div>
                    <div style="flex:1; text-align: left;">
                        <label style="color:#cbd5e1; font-size:12px; font-weight:bold; margin-bottom:5px; display:block;">ORA</label>
                        <input type="time" id="task-time" value="09:00" style="width:100%; padding:12px; border-radius:8px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:14px; outline:none; box-sizing:border-box; cursor:pointer;">
                    </div>
                </div>
                
                <div style="display:flex; justify-content:space-between; gap:15px;">
                    <button id="btn-cancel-task" style="flex:1; padding:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; font-weight:bold; cursor:pointer; transition:all 0.2s;">Annulla</button>
                    <button id="btn-confirm-task" style="flex:1; padding:12px; background:linear-gradient(135deg, #8b5cf6, #6d28d9); border:none; border-radius:8px; color:#fff; font-weight:bold; cursor:pointer; box-shadow:0 5px 15px rgba(139,92,246,0.3); transition:all 0.2s;">Aggiungi Task ✨</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);

        // Imposta la data di oggi come default
        document.getElementById('task-date').valueAsDate = new Date();
        
        // Hover effects sulle modali
        const cancelBtn = document.getElementById('btn-cancel-task');
        const confirmBtn = document.getElementById('btn-confirm-task');
        
        cancelBtn.onmouseover = () => cancelBtn.style.background = 'rgba(255,255,255,0.1)';
        cancelBtn.onmouseout = () => cancelBtn.style.background = 'rgba(255,255,255,0.05)';
        
        confirmBtn.onmouseover = () => confirmBtn.style.transform = 'translateY(-2px)';
        confirmBtn.onmouseout = () => confirmBtn.style.transform = 'translateY(0)';
        
        cancelBtn.onclick = () => {
            document.body.removeChild(overlay);
        };
        
        confirmBtn.onclick = async () => {
            const desc = document.getElementById('task-desc').value.trim();
            const date = document.getElementById('task-date').value;
            const time = document.getElementById('task-time').value;
            
            if(!desc || !date || !time) {
                alert("Compila tutti i campi (Descrizione, Data e Ora).");
                return;
            }
            
            document.body.removeChild(overlay);
            
            const eventId = Date.now();
            let newEvent = {
                id: eventId,
                descrizione: 'PLAN:' + desc,
                data_scadenza: date + ' ' + time,
                importante: false,
                fascicolo_id: fascicoloId
            };
            
            if (supabaseClient) {
                showCloudStatus("Salvataggio Task nel Fascicolo...", "syncing");
                const { error } = await supabaseClient.from('ares_planning').insert(newEvent);
                if (!error) {
                    showCloudStatus("Task Aggiunto!", "success");
                    await loadPlanning(); // ricarica eventi da db
                    openFascicoloBook(fascicoloId); // riaggiorna UI fascicolo
                } else {
                    showCloudStatus("Errore salvataggio task", "error");
                }
            }
        };
    }
    
    async function assignFascicoloResource(fascicoloId) {
        // Raccogli tutte le risorse NON attualmente assegnate a questo fascicolo
        const availablePersone = (resources.persone || []).filter(p => !p.fascicolo_id || p.fascicolo_id !== fascicoloId);
        const availableMezzi = (resources.mezzi || []).filter(m => !m.fascicolo_id || m.fascicolo_id !== fascicoloId);
        
        if(availablePersone.length === 0 && availableMezzi.length === 0) {
            alert("Non ci sono risorse nel database, oppure sono già tutte assegnate.");
            return;
        }
        
        // Crea l'overlay del modale glassmorphism
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        overlay.style.backdropFilter = 'blur(10px)';
        overlay.style.zIndex = '100000';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        
        let optionsHTML = '<option value="" disabled selected>-- Seleziona una Risorsa --</option>';
        if(availablePersone.length > 0) {
            optionsHTML += '<optgroup label="👷 Personale">';
            availablePersone.forEach(p => {
                optionsHTML += `<option value="${p.id}">${p.nome} ${p.cognome}</option>`;
            });
            optionsHTML += '</optgroup>';
        }
        if(availableMezzi.length > 0) {
            optionsHTML += '<optgroup label="🚚 Mezzi e Attrezzature">';
            availableMezzi.forEach(m => {
                optionsHTML += `<option value="${m.id}">${m.tipo} - Targa: ${m.targa}</option>`;
            });
            optionsHTML += '</optgroup>';
        }
        
        overlay.innerHTML = `
            <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(249, 115, 22, 0.4); padding: 30px; border-radius: 16px; box-shadow: 0 20px 50px rgba(0,0,0,0.8); width: 450px; text-align:center; font-family: 'Inter', sans-serif;">
                <h3 style="color:#f97316; margin-top:0; margin-bottom:10px; font-size:22px;">Assegna Risorsa Operativa</h3>
                <p style="color:#94a3b8; font-size:14px; margin-bottom:25px; line-height:1.5;">Seleziona un veicolo, un'attrezzatura o un operatore dalla flotta aziendale da dispiegare in questo cantiere.</p>
                
                <select id="resource-select-dropdown" style="width:100%; padding:14px; border-radius:8px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:16px; outline:none; margin-bottom:25px; cursor:pointer;">
                    ${optionsHTML}
                </select>
                
                <div style="display:flex; justify-content:space-between; gap:15px;">
                    <button id="btn-cancel-resource" style="flex:1; padding:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; font-weight:bold; cursor:pointer; transition:all 0.2s;">Annulla</button>
                    <button id="btn-confirm-resource" style="flex:1; padding:12px; background:linear-gradient(135deg, #f97316, #ea580c); border:none; border-radius:8px; color:#fff; font-weight:bold; cursor:pointer; box-shadow:0 5px 15px rgba(249,115,22,0.3); transition:all 0.2s;">Dispiega 🚀</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Hover effects sulle modali
        const cancelBtn = document.getElementById('btn-cancel-resource');
        const confirmBtn = document.getElementById('btn-confirm-resource');
        
        cancelBtn.onmouseover = () => cancelBtn.style.background = 'rgba(255,255,255,0.1)';
        cancelBtn.onmouseout = () => cancelBtn.style.background = 'rgba(255,255,255,0.05)';
        
        confirmBtn.onmouseover = () => confirmBtn.style.transform = 'translateY(-2px)';
        confirmBtn.onmouseout = () => confirmBtn.style.transform = 'translateY(0)';
        
        cancelBtn.onclick = () => {
            document.body.removeChild(overlay);
        };
        
        confirmBtn.onclick = async () => {
            const selectEl = document.getElementById('resource-select-dropdown');
            const selectedId = selectEl.value;
            
            if(!selectedId) {
                alert("Seleziona una risorsa dal menù a tendina prima di confermare.");
                return;
            }
            
            document.body.removeChild(overlay);
            
            const id = Number(selectedId);
            if(supabaseClient) {
                showCloudStatus("Dispiegamento Risorsa...", "syncing");
                const { error } = await supabaseClient.from('ares_resources').update({ fascicolo_id: fascicoloId }).eq('id', id);
                if(!error) {
                    showCloudStatus("Risorsa Dispiegata!", "success");
                    await loadResources();
                    openFascicoloBook(fascicoloId);
                } else {
                    showCloudStatus("Errore nell'assegnazione", "error");
                }
            }
        };
    }
    
    let fascicoloAddressTimeout = null;

    function handleFascicoloAddressSearch(query, fascicoloId) {
        query = query.trim();
        const resultsBox = document.getElementById(`fascicolo-address-results-${fascicoloId}`);
        if (!resultsBox) return;

        clearTimeout(fascicoloAddressTimeout);
        
        if (query.length < 3) {
            resultsBox.style.display = 'none';
            return;
        }

        resultsBox.innerHTML = '<div style="padding: 8px 10px; color: #818cf8; font-size: 11px; text-align: center;">Ricerca in corso... ⏳</div>';
        resultsBox.style.display = 'block';

        fascicoloAddressTimeout = setTimeout(() => {
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=it`)
                .then(r => r.json())
                .then(data => {
                    if (data.length === 0) {
                        resultsBox.innerHTML = '<div style="padding: 8px 10px; color: #f43f5e; font-size: 11px;">Nessun risultato trovato</div>';
                    } else {
                        resultsBox.innerHTML = data.map(item => `
                            <div style="padding: 8px 10px; color: #cbd5e1; font-size: 11px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05);" 
                                 onclick="selectFascicoloAddress('${item.display_name.replace(/'/g, "\\'")}', ${fascicoloId})"
                                 onmouseover="this.style.background='rgba(99,102,241,0.2)'"
                                 onmouseout="this.style.background='transparent'">
                                📍 ${item.display_name}
                            </div>
                        `).join('');
                    }
                })
                .catch(err => {
                    resultsBox.innerHTML = '<div style="padding: 8px 10px; color: #f43f5e; font-size: 11px;">Errore di ricerca</div>';
                });
        }, 600);
    }

    function selectFascicoloAddress(address, fascicoloId) {
        const input = document.getElementById(`fascicolo-address-${fascicoloId}`);
        const resultsBox = document.getElementById(`fascicolo-address-results-${fascicoloId}`);
        if(input) {
            input.value = address;
        }
        if(resultsBox) {
            resultsBox.style.display = 'none';
        }
        // Avvia geocoding automaticamente
        geocodeFascicoloAddress(fascicoloId);
    }

    async function geocodeFascicoloAddress(fascicoloId) {
        const addrInput = document.getElementById(`fascicolo-address-${fascicoloId}`);
        if(!addrInput) return;
        const address = addrInput.value.trim();
        if(!address) {
            alert("Inserisci un indirizzo prima di effettuare la geocodifica.");
            return;
        }

        showCloudStatus("Geocoding in corso...", "syncing");

        try {
            // Geocoding Nominatim OpenStreetMap
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
            const data = await response.json();

            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lng = parseFloat(data[0].lon);

                if(supabaseClient) {
                    const { error } = await supabaseClient.from('ares_fascicoli').update({ 
                        indirizzo: address,
                        lat: lat, 
                        lng: lng 
                    }).eq('id', fascicoloId);

                    if(!error) {
                        showCloudStatus("Geocoding Completato! 📍", "success");
                        await fetchFascicoli(); // Ricarica dati
                        
                        // Lampo visivo per conferma all'utente
                        addrInput.style.borderColor = "#10b981";
                        addrInput.style.backgroundColor = "rgba(16, 185, 129, 0.1)";
                        setTimeout(() => {
                            addrInput.style.borderColor = "rgba(255,255,255,0.2)";
                            addrInput.style.backgroundColor = "rgba(0,0,0,0.3)";
                        }, 1500);

                    } else {
                        showCloudStatus("Errore salvataggio indirizzo", "error");
                    }
                }
            } else {
                showCloudStatus("Indirizzo non trovato", "error");
                alert("Non è stato possibile trovare le coordinate per questo indirizzo. Prova a scriverlo in modo più specifico (es. Via Roma 1, Milano).");
            }
        } catch(e) {
            console.error("Errore Geocoding:", e);
            showCloudStatus("Errore di Rete", "error");
        }
    }
    
    async function setFascicoloCoordinates(fascicoloId) {
        let latStr = prompt("Inserisci Latitudine (es. 41.8902):");
        if(!latStr) return;
        let lngStr = prompt("Inserisci Longitudine (es. 12.4922):");
        if(!lngStr) return;
        
        let lat = parseFloat(latStr);
        let lng = parseFloat(lngStr);
        
        if(supabaseClient) {
            showCloudStatus("Salvataggio Coordinate GPS...", "syncing");
            const { error } = await supabaseClient.from('ares_fascicoli').update({ lat: lat, lng: lng }).eq('id', fascicoloId);
            if(!error) {
                showCloudStatus("Coordinate Salvate!", "success");
                await fetchFascicoli(); // reload
                openFascicoloBook(fascicoloId);
            } else {
                showCloudStatus("Errore salvataggio GPS", "error");
            }
        }
    }
    
    function focusFascicoloOnGIS(lat, lng) {
        closeFascicoloBook();
        show('operativa');
        setTimeout(() => {
            if(mapInstance) {
                mapInstance.flyTo([lat, lng], 18, { animate: true, duration: 1.5 });
                L.marker([lat, lng], {icon: L.divIcon({className: 'custom-leaflet-icon', html: `<div style="width:20px;height:20px;background:#38bdf8;border-radius:50%;border:2px solid #fff;box-shadow:0 0 15px #38bdf8;"></div>`})}).addTo(mapInstance).bindPopup("<b>Area Operativa</b><br>Cantiere Fascicolo").openPopup();
            }
        }, 300);
    }
    async function deleteFascicolo(fascicoloId) {
        if(!confirm("Sei sicuro di voler eliminare definitivamente questo Fascicolo? L'operazione non è reversibile.")) return;
        
        if(supabaseClient) {
            showCloudStatus("Eliminazione Fascicolo...", "syncing");
            
            // Dissocia le risorse
            await supabaseClient.from('ares_resources').update({ fascicolo_id: null }).eq('fascicolo_id', fascicoloId);
            
            // Elimina i task di planning
            await supabaseClient.from('ares_planning').delete().eq('fascicolo_id', fascicoloId);
            
            // Elimina il fascicolo
            const { error } = await supabaseClient.from('ares_fascicoli').delete().eq('id', fascicoloId);
            if(!error) {
                showCloudStatus("Fascicolo Eliminato", "success");
                await renderFascicoli();
            } else {
                showCloudStatus("Errore eliminazione fascicolo", "error");
            }
        }
    }
