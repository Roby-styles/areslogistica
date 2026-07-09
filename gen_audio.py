import wave
import struct
import random
import math
import os

def generate_paper_sound(filename, duration, seed):
    random.seed(seed)
    sample_rate = 44100
    n_samples = int(sample_rate * duration)
    
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        
        samples = []
        prev_val = 0
        for i in range(n_samples):
            noise = random.uniform(-1, 1)
            # Low pass filter
            val = prev_val * 0.4 + noise * 0.6
            prev_val = val
            
            # Envelope (fast attack, smooth decay)
            t = i / sample_rate
            env = math.exp(-t * 20) * (1.0 - math.exp(-t * 150))
            
            # Grainy modulation
            mod = 0.5 + 0.5 * math.sin(2 * math.pi * (20 + seed*5) * t)
            
            final_val = val * env * mod
            
            sample_int = int(final_val * 28000)
            sample_int = max(-32768, min(32767, sample_int))
            samples.append(struct.pack('<h', sample_int))
            
        wav_file.writeframes(b''.join(samples))

base_dir = r"c:\Users\orgsi\Desktop\areslogistica2_Deploy"
generate_paper_sound(os.path.join(base_dir, "carta1.mp3"), 0.4, 1)
generate_paper_sound(os.path.join(base_dir, "carta2.mp3"), 0.35, 2)
generate_paper_sound(os.path.join(base_dir, "carta3.mp3"), 0.45, 3)
print("Generated audio files")
