import subprocess
from pathlib import Path

# Professional 512x512 App Icon SVG
SVG_APP = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background squircle gradient -->
    <linearGradient id="sqBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1f232c"/>
      <stop offset="50%" stop-color="#14171d"/>
      <stop offset="100%" stop-color="#0a0c0e"/>
    </linearGradient>
    
    <!-- Metallic gold gradients -->
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff0bd"/>
      <stop offset="35%" stop-color="#f5c76d"/>
      <stop offset="70%" stop-color="#d49228"/>
      <stop offset="100%" stop-color="#80500c"/>
    </linearGradient>
    <linearGradient id="goldTrim" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#e0a33a"/>
      <stop offset="50%" stop-color="#ffd980"/>
      <stop offset="100%" stop-color="#a86e19"/>
    </linearGradient>
    <linearGradient id="artBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#362510"/>
      <stop offset="50%" stop-color="#1b140b"/>
      <stop offset="100%" stop-color="#0d0b08"/>
    </linearGradient>

    <!-- Drop Shadows -->
    <filter id="shadowLg" x="-20%" y="-20%" width="150%" height="150%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000000" flood-opacity="0.65"/>
    </filter>
    <filter id="cardGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
    <filter id="sparkGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Squircle Base -->
  <rect x="20" y="20" width="472" height="472" rx="108" fill="url(#sqBg)"/>
  <rect x="20" y="20" width="472" height="472" rx="108" fill="none" stroke="url(#goldGrad)" stroke-width="3" stroke-opacity="0.3"/>

  <!-- Subtle Inner Vignette -->
  <rect x="22" y="22" width="468" height="468" rx="106" fill="none" stroke="#000000" stroke-width="6" opacity="0.4"/>

  <!-- Back Card (Tilted Left -11 deg) -->
  <g transform="rotate(-11 230 265)" filter="url(#shadowLg)">
    <rect x="110" y="86" width="224" height="314" rx="16" fill="#101216" stroke="#664612" stroke-width="3.5"/>
    <rect x="124" y="100" width="196" height="286" rx="10" fill="#181a20" stroke="url(#goldTrim)" stroke-width="1.5" stroke-opacity="0.6"/>
    <!-- Cardback Emblem -->
    <circle cx="222" cy="243" r="46" fill="none" stroke="#caa048" stroke-width="2" stroke-dasharray="4 6" opacity="0.35"/>
    <circle cx="222" cy="243" r="30" fill="#211a10" stroke="#caa048" stroke-width="1.5" opacity="0.45"/>
  </g>

  <!-- Front Card (Tilted Right +4 deg) -->
  <g transform="rotate(4 270 268)" filter="url(#shadowLg)">
    <!-- Outer Card Border -->
    <rect x="156" y="84" width="228" height="320" rx="16" fill="#0b0d10" stroke="url(#goldGrad)" stroke-width="3.5"/>
    
    <!-- Card Frame Body -->
    <rect x="170" y="98" width="200" height="292" rx="10" fill="#1b1e25"/>
    <rect x="170" y="98" width="200" height="292" rx="10" fill="none" stroke="url(#goldTrim)" stroke-width="1.5" stroke-opacity="0.75"/>

    <!-- Title Bar -->
    <rect x="180" y="110" width="180" height="28" rx="5" fill="#14161d" stroke="url(#goldGrad)" stroke-width="1.2"/>
    <circle cx="346" cy="124" r="6.5" fill="url(#goldTrim)"/>

    <!-- Art Frame Box -->
    <rect x="180" y="146" width="180" height="136" rx="5" fill="url(#artBg)" stroke="url(#goldGrad)" stroke-width="1.5"/>
    
    <!-- Art Window: Radial Sunburst & Precision Grid -->
    <g stroke="url(#goldGrad)" stroke-width="1.5" opacity="0.3" transform="translate(270, 214)">
      <line x1="-58" y1="0" x2="58" y2="0"/>
      <line x1="0" y1="-50" x2="0" y2="50"/>
      <line x1="-40" y1="-38" x2="40" y2="38"/>
      <line x1="-40" y1="38" x2="40" y2="-38"/>
      <circle cx="0" cy="0" r="34" fill="none" stroke-dasharray="3 5"/>
    </g>

    <!-- Radiant Glowing Mana Spark (Magic proxy insignia) -->
    <circle cx="270" cy="214" r="30" fill="#e0a33a" opacity="0.22" filter="url(#sparkGlow)"/>
    <path d="M 270 180 Q 270 214 304 214 Q 270 214 270 248 Q 270 214 236 214 Q 270 214 270 180 Z" 
          fill="url(#goldGrad)" filter="url(#sparkGlow)"/>
    <!-- Central diamond star highlight -->
    <polygon points="270,202 274,214 286,214 276,218 279,228 270,221 261,228 264,218 254,214 266,214" fill="#ffffff" opacity="0.95"/>
    <circle cx="270" cy="214" r="3" fill="#ffffff"/>

    <!-- Type Bar -->
    <rect x="180" y="290" width="180" height="20" rx="4" fill="#14161d" stroke="url(#goldGrad)" stroke-width="1" opacity="0.9"/>
    
    <!-- Rules Text Box -->
    <rect x="180" y="318" width="180" height="62" rx="5" fill="#111318" stroke="#8c6422" stroke-width="1" opacity="0.85"/>
    <!-- Subtle Gold Foil Text Rules -->
    <line x1="194" y1="332" x2="336" y2="332" stroke="url(#goldTrim)" stroke-width="2.5" stroke-linecap="round" opacity="0.55"/>
    <line x1="194" y1="344" x2="310" y2="344" stroke="url(#goldTrim)" stroke-width="2.5" stroke-linecap="round" opacity="0.55"/>
    <line x1="194" y1="356" x2="270" y2="356" stroke="url(#goldTrim)" stroke-width="2.5" stroke-linecap="round" opacity="0.55"/>

    <!-- P/T Box -->
    <rect x="322" y="360" width="42" height="22" rx="4" fill="#221a0f" stroke="url(#goldGrad)" stroke-width="1.4"/>
    <circle cx="343" cy="371" r="3" fill="#ffd980"/>
  </g>

  <!-- Precision Cut Corner Marks (Proxy Press Cutting Guides) -->
  <g stroke="url(#goldGrad)" stroke-width="3" stroke-linecap="round" opacity="0.85">
    <!-- Top-Left -->
    <path d="M 52 86 L 52 56 L 82 56"/>
    <!-- Top-Right -->
    <path d="M 460 86 L 460 56 L 430 56"/>
    <!-- Bottom-Left -->
    <path d="M 52 426 L 52 456 L 82 456"/>
    <!-- Bottom-Right -->
    <path d="M 460 426 L 460 456 L 430 456"/>
  </g>
</svg>"""

# Header Logo SVG (Compact 64x64)
SVG_LOGO = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="22" height="22">
  <defs>
    <linearGradient id="lgGold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffe199"/>
      <stop offset="50%" stop-color="#e0a33a"/>
      <stop offset="100%" stop-color="#8f570d"/>
    </linearGradient>
  </defs>
  <!-- Back Card -->
  <rect x="14" y="6" width="34" height="48" rx="5" fill="#121418" stroke="#754e15" stroke-width="1.8" transform="rotate(-11 31 30)"/>
  <!-- Front Card -->
  <g transform="rotate(4 33 32)">
    <rect x="17" y="7" width="34" height="48" rx="5" fill="#16181f" stroke="url(#lgGold)" stroke-width="1.8"/>
    <!-- Inner art frame -->
    <rect x="21" y="16" width="26" height="19" rx="2" fill="#291e0d" stroke="url(#lgGold)" stroke-width="1"/>
    <!-- Mana Spark -->
    <path d="M 34 20 Q 34 25.5 39.5 25.5 Q 34 25.5 34 31 Q 34 25.5 28.5 25.5 Q 34 25.5 34 20 Z" fill="url(#lgGold)"/>
    <circle cx="34" cy="25.5" r="1.2" fill="#ffffff"/>
    <!-- Text box lines -->
    <line x1="22" y1="41" x2="43" y2="41" stroke="url(#lgGold)" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>
    <line x1="22" y1="45" x2="38" y2="45" stroke="url(#lgGold)" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>
  </g>
</svg>"""

Path("electron/icon.svg").write_text(SVG_APP)
subprocess.run(["rsvg-convert", "-w", "512", "-h", "512", "electron/icon.svg", "-o", "electron/icon.png"], check=True)
subprocess.run(["magick", "electron/icon.png", "-define", "icon:auto-resize=256,128,64,48,32,16", "electron/icon.ico"], check=True)
print("Icons generated successfully!")
