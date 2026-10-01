export interface AvatarPreset {
  id: string;
  name: string;
  category: string;
  accent: string;
  svgDataUri: string;
}

const encodeSvg = (svgString: string): string => {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;
};

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: "preset-scholar",
    name: "أكاديمي ذكي",
    category: "أكاديمي",
    accent: "from-blue-600 via-indigo-600 to-purple-600",
    svgDataUri: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <defs>
          <linearGradient id="bg_sc" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1e1b4b"/>
            <stop offset="50%" stop-color="#312e81"/>
            <stop offset="100%" stop-color="#4338ca"/>
          </linearGradient>
          <linearGradient id="glow_sc" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#38bdf8"/>
            <stop offset="100%" stop-color="#818cf8"/>
          </linearGradient>
        </defs>
        <rect width="120" height="120" rx="36" fill="url(#bg_sc)"/>
        <circle cx="60" cy="52" r="22" fill="#c7d2fe"/>
        <!-- Glasses -->
        <rect x="44" y="46" width="13" height="9" rx="3" fill="none" stroke="#1e1b4b" stroke-width="2.5"/>
        <rect x="63" y="46" width="13" height="9" rx="3" fill="none" stroke="#1e1b4b" stroke-width="2.5"/>
        <path d="M57 50 L63 50" stroke="#1e1b4b" stroke-width="2.5"/>
        <!-- Academic Cap -->
        <polygon points="60,22 88,32 60,42 32,32" fill="#0f172a" stroke="#818cf8" stroke-width="2"/>
        <polygon points="60,32 78,39 60,46 42,39" fill="#1e293b"/>
        <path d="M82 34 L88 48" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
        <circle cx="88" cy="50" r="2.5" fill="#38bdf8"/>
        <!-- Shoulders -->
        <path d="M26 106 C26 84, 42 76, 60 76 C78 76, 94 84, 94 106 Z" fill="url(#glow_sc)"/>
        <polygon points="60,76 52,90 60,102 68,90" fill="#ffffff" opacity="0.9"/>
      </svg>
    `),
  },
  {
    id: "preset-cyber-hacker",
    name: "سيبراني متقدم",
    category: "أمن سيبراني",
    accent: "from-emerald-500 via-teal-600 to-cyan-700",
    svgDataUri: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <defs>
          <linearGradient id="bg_cy" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#022c22"/>
            <stop offset="60%" stop-color="#064e3b"/>
            <stop offset="100%" stop-color="#047857"/>
          </linearGradient>
          <linearGradient id="neon_cy" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#10b981"/>
            <stop offset="100%" stop-color="#06b6d4"/>
          </linearGradient>
        </defs>
        <rect width="120" height="120" rx="36" fill="url(#bg_cy)"/>
        <!-- Hoodie -->
        <path d="M28 108 C28 80, 42 70, 60 70 C78 70, 92 80, 92 108 Z" fill="#0f172a"/>
        <circle cx="60" cy="54" r="24" fill="#020617" stroke="#10b981" stroke-width="2"/>
        <!-- Cyber Visor -->
        <polygon points="40,48 80,48 76,60 44,60" fill="url(#neon_cy)"/>
        <line x1="42" y1="54" x2="78" y2="54" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="4,2"/>
        <!-- Matrix Rain Accent -->
        <text x="32" y="30" fill="#10b981" font-size="8" font-family="monospace" opacity="0.6">01</text>
        <text x="80" y="32" fill="#06b6d4" font-size="8" font-family="monospace" opacity="0.6">10</text>
        <!-- Binary Circuit Accent -->
        <circle cx="60" cy="74" r="4" fill="#10b981"/>
        <path d="M60 78 L60 92 M52 86 L68 86" stroke="#10b981" stroke-width="2"/>
      </svg>
    `),
  },
  {
    id: "preset-quantum-core",
    name: "نواة الذكاء الاصطناعي",
    category: "تكنولوجيا",
    accent: "from-purple-600 via-pink-600 to-rose-600",
    svgDataUri: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <defs>
          <linearGradient id="bg_ai" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#2e1065"/>
            <stop offset="60%" stop-color="#581c87"/>
            <stop offset="100%" stop-color="#831843"/>
          </linearGradient>
          <linearGradient id="glow_ai" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ec4899"/>
            <stop offset="100%" stop-color="#a855f7"/>
          </linearGradient>
        </defs>
        <rect width="120" height="120" rx="36" fill="url(#bg_ai)"/>
        <!-- Futuristic AI bot head -->
        <rect x="36" y="34" width="48" height="42" rx="16" fill="#0f172a" stroke="url(#glow_ai)" stroke-width="3"/>
        <!-- Antennas -->
        <line x1="60" y1="34" x2="60" y2="20" stroke="#ec4899" stroke-width="3" stroke-linecap="round"/>
        <circle cx="60" cy="18" r="4" fill="#f43f5e"/>
        <!-- Eyes glowing -->
        <circle cx="49" cy="52" r="5" fill="#38bdf8"/>
        <circle cx="71" cy="52" r="5" fill="#38bdf8"/>
        <!-- Digital Smile / Display -->
        <path d="M50 63 Q60 69 70 63" stroke="#a855f7" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <!-- Torso -->
        <path d="M30 110 C30 88, 44 82, 60 82 C76 82, 90 88, 90 110 Z" fill="#1e1b4b" stroke="#a855f7" stroke-width="2"/>
        <polygon points="60,86 52,98 68,98" fill="#ec4899"/>
      </svg>
    `),
  },
  {
    id: "preset-guardian-shield",
    name: "حارس المنظومة",
    category: "حماية وأمان",
    accent: "from-amber-500 via-orange-600 to-amber-700",
    svgDataUri: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <defs>
          <linearGradient id="bg_sh" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#451a03"/>
            <stop offset="50%" stop-color="#78350f"/>
            <stop offset="100%" stop-color="#b45309"/>
          </linearGradient>
          <linearGradient id="gold_sh" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#fde047"/>
            <stop offset="100%" stop-color="#f59e0b"/>
          </linearGradient>
        </defs>
        <rect width="120" height="120" rx="36" fill="url(#bg_sh)"/>
        <!-- Shield Main -->
        <path d="M60 22 L86 34 C86 64, 60 86, 60 86 C60 86, 34 64, 34 34 Z" fill="#0f172a" stroke="url(#gold_sh)" stroke-width="3"/>
        <!-- Inner Core -->
        <path d="M60 30 L78 40 C78 60, 60 76, 60 76 C60 76, 42 60, 42 40 Z" fill="url(#gold_sh)" opacity="0.25"/>
        <!-- Keyhole / Checkmark -->
        <circle cx="60" cy="46" r="6" fill="#fde047"/>
        <polygon points="57,48 63,48 65,62 55,62" fill="#fde047"/>
        <!-- Pedestal / Body -->
        <path d="M26 110 C26 92, 40 86, 60 86 C80 86, 94 92, 94 110 Z" fill="#1e293b"/>
      </svg>
    `),
  },
  {
    id: "preset-student-star",
    name: "طالب متفوق",
    category: "طلابي",
    accent: "from-sky-500 via-blue-600 to-indigo-600",
    svgDataUri: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <defs>
          <linearGradient id="bg_st" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#082f49"/>
            <stop offset="60%" stop-color="#0369a1"/>
            <stop offset="100%" stop-color="#0284c7"/>
          </linearGradient>
        </defs>
        <rect width="120" height="120" rx="36" fill="url(#bg_st)"/>
        <!-- Head -->
        <circle cx="60" cy="48" r="22" fill="#fed7aa"/>
        <!-- Hair with styled cut -->
        <path d="M38 46 C38 28, 50 26, 60 26 C72 26, 82 28, 82 46 C80 34, 46 34, 38 46 Z" fill="#1e293b"/>
        <!-- Friendly Smile & Eyes -->
        <circle cx="53" cy="46" r="2.5" fill="#0f172a"/>
        <circle cx="67" cy="46" r="2.5" fill="#0f172a"/>
        <path d="M54 54 Q60 60 66 54" stroke="#0f172a" stroke-width="2" fill="none" stroke-linecap="round"/>
        <!-- Student Hoodie -->
        <path d="M26 110 C26 84, 42 74, 60 74 C78 74, 94 84, 94 110 Z" fill="#38bdf8"/>
        <!-- Star badge -->
        <polygon points="60,78 62,84 68,84 63,88 65,94 60,90 55,94 57,88 52,84 58,84" fill="#fde047"/>
      </svg>
    `),
  },
  {
    id: "preset-falcon-helwan",
    name: "صقر حلوان",
    category: "الجامعة",
    accent: "from-teal-500 via-emerald-600 to-green-700",
    svgDataUri: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <defs>
          <linearGradient id="bg_fa" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#064e3b"/>
            <stop offset="60%" stop-color="#047857"/>
            <stop offset="100%" stop-color="#059669"/>
          </linearGradient>
        </defs>
        <rect width="120" height="120" rx="36" fill="url(#bg_fa)"/>
        <!-- Stylized Cyber Falcon Head -->
        <polygon points="60,20 86,50 60,76 34,50" fill="#0f172a" stroke="#34d399" stroke-width="2"/>
        <polygon points="60,32 78,50 60,68 42,50" fill="#065f46"/>
        <!-- Eye of the Falcon -->
        <circle cx="52" cy="46" r="3.5" fill="#fde047"/>
        <circle cx="68" cy="46" r="3.5" fill="#fde047"/>
        <!-- Wings / Body -->
        <path d="M20 110 C32 82, 48 76, 60 76 C72 76, 88 82, 100 110 Z" fill="#10b981"/>
        <polygon points="60,76 50,96 60,110 70,96" fill="#34d399"/>
      </svg>
    `),
  },
  {
    id: "preset-doctor-professor",
    name: "دكتور جامعي",
    category: "أكاديمي",
    accent: "from-indigo-600 via-purple-700 to-indigo-900",
    svgDataUri: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <defs>
          <linearGradient id="bg_pr" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1e1b4b"/>
            <stop offset="60%" stop-color="#312e81"/>
            <stop offset="100%" stop-color="#4338ca"/>
          </linearGradient>
        </defs>
        <rect width="120" height="120" rx="36" fill="url(#bg_pr)"/>
        <!-- Head -->
        <circle cx="60" cy="48" r="22" fill="#fde68a"/>
        <!-- Hair -->
        <path d="M38 44 C38 26, 50 24, 60 24 C70 24, 82 26, 82 44 C76 34, 44 34, 38 44 Z" fill="#64748b"/>
        <!-- Glasses -->
        <circle cx="51" cy="48" r="7" fill="none" stroke="#0f172a" stroke-width="2"/>
        <circle cx="69" cy="48" r="7" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="58" y1="48" x2="62" y2="48" stroke="#0f172a" stroke-width="2"/>
        <!-- Formal Suit & Tie -->
        <path d="M24 110 C24 84, 40 76, 60 76 C80 76, 96 84, 96 110 Z" fill="#0f172a"/>
        <polygon points="60,76 50,92 60,110 70,92" fill="#ffffff"/>
        <polygon points="60,82 56,92 60,104 64,92" fill="#dc2626"/>
      </svg>
    `),
  },
  {
    id: "preset-dev-architect",
    name: "مهندس برمجيات",
    category: "تطوير",
    accent: "from-cyan-500 via-blue-600 to-teal-700",
    svgDataUri: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <defs>
          <linearGradient id="bg_de" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#083344"/>
            <stop offset="60%" stop-color="#0e7490"/>
            <stop offset="100%" stop-color="#06b6d4"/>
          </linearGradient>
        </defs>
        <rect width="120" height="120" rx="36" fill="url(#bg_de)"/>
        <!-- Headphone Band -->
        <path d="M34 50 C34 30, 44 22, 60 22 C76 22, 86 30, 86 50" fill="none" stroke="#0284c7" stroke-width="4"/>
        <rect x="30" y="44" width="8" height="16" rx="4" fill="#0284c7"/>
        <rect x="82" y="44" width="8" height="16" rx="4" fill="#0284c7"/>
        <!-- Face -->
        <circle cx="60" cy="50" r="20" fill="#fed7aa"/>
        <!-- Terminal Eyes < / > -->
        <path d="M48 48 L44 52 L48 56" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round"/>
        <path d="M72 48 L76 52 L72 56" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round"/>
        <!-- Smile -->
        <path d="M54 58 Q60 63 66 58" stroke="#0f172a" stroke-width="2" fill="none" stroke-linecap="round"/>
        <!-- Modern T-shirt -->
        <path d="M26 110 C26 84, 42 74, 60 74 C78 74, 94 84, 94 110 Z" fill="#0f172a"/>
        <!-- Code icon on shirt -->
        <text x="52" y="94" fill="#38bdf8" font-size="12" font-family="monospace" font-weight="bold">{;}</text>
      </svg>
    `),
  },
];
