import re

filepath = r"c:\Users\orgsi\Desktop\areslogistica2_Deploy\index.html"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Add the new sound logic right after `let fascicoloPageFlip = null;`
target = "    let fascicoloPageFlip = null;"

new_sound_logic = """    let fascicoloPageFlip = null;

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
"""

if "NUOVI SUONI REALISTICI" not in content:
    content = content.replace(target, new_sound_logic)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Patch4 success")
