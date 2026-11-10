import subprocess
from pathlib import Path

# User-approved fan-of-cards Proxy Press icon SVG
SVG_APP = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <!-- Card drop shadow for depth separation -->
    <filter id="cardShadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="-2" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.55" />
    </filter>
  </defs>

  <!-- Back Card: MTG Mana Blue -->
  <g transform="rotate(-15 190 280)" filter="url(#cardShadow)">
    <rect x="70" y="80" width="220" height="320" rx="16" fill="#1864AB" stroke="#0F1115" stroke-width="6" />
    <rect x="84" y="94" width="192" height="292" rx="10" fill="none" stroke="#339AF0" stroke-width="4" opacity="0.6" />
  </g>

  <!-- Middle Card: Terracotta / Rust Orange -->
  <g transform="rotate(-6 230 270)" filter="url(#cardShadow)">
    <rect x="120" y="84" width="220" height="320" rx="16" fill="#D9480F" stroke="#0F1115" stroke-width="6" />
    <rect x="134" y="98" width="192" height="292" rx="10" fill="none" stroke="#FF922B" stroke-width="4" opacity="0.6" />
  </g>

  <!-- Front Card: Deep Ink Black + Gold Border -->
  <g transform="rotate(5 290 260)" filter="url(#cardShadow)">
    <!-- Base Card Stock -->
    <rect x="180" y="86" width="224" height="326" rx="18" fill="#141518" stroke="#0F1115" stroke-width="6" />
    
    <!-- Bold Gold Card Frame -->
    <rect x="198" y="104" width="188" height="290" rx="12" fill="none" stroke="#F59F00" stroke-width="12" />

    <!-- High-Legibility Serif "P" Monogram -->
    <path d="M 252 170 
             H 298 
             C 334 170 348 186 348 212 
             C 348 240 332 254 298 254 
             H 274 
             V 306 
             H 288 
             V 318 
             H 238 
             V 306 
             H 252 
             V 182 
             H 238 
             V 170 
             Z 
             M 274 186 
             V 238 
             H 296 
             C 318 238 326 228 326 212 
             C 326 196 318 186 296 186 
             Z" fill="#FFF4E6" />
  </g>
</svg>"""

Path("electron/icon.svg").write_text(SVG_APP)
subprocess.run(["rsvg-convert", "-w", "512", "-h", "512", "electron/icon.svg", "-o", "electron/icon.png"], check=True)
subprocess.run(["magick", "electron/icon.png", "-define", "icon:auto-resize=256,128,64,48,32,16", "electron/icon.ico"], check=True)
print("Icons generated successfully!")
