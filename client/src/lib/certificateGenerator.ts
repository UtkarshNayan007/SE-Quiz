/**
 * Client-Side Certificate Generation Engine for Schneider Electric Cyber Day 2026
 * 
 * 100% Client-Side HTML5 Canvas rendering. Zero load on Render backend or Vercel.
 * Theme: White and Green (Schneider Electric Brand #009639 & Cyber Green #00E676)
 * Calligraphy: Beautiful script calligraphy for recipient name & signatures
 * Background: Increased visibility Gen-Z Cyber Awareness Graphics (Shield, Circuit Traces, Binary, Terminal Prompts)
 * Logos: Dual Header - Official Schneider Electric Logo (/se-logo-official.png) & Team CSH Logo (/csh-logo.png)
 * Event: Cyber Day 2026 | "Beyond Compliance. Enabling Business." | 7 October 2026 | Avinya Campus, Bangalore
 */

export interface CertificateData {
  name: string;
  tier: 'winner' | 'participant';
  awardTitle: string; // e.g. "Grand Champion", "Podium 2nd Place", "Best Learner Award", "Certified Cyber Defender"
  rank: number | string;
  totalParticipants?: number;
  score: number;
  speed?: string;
  attemptedCount?: number;
  totalQuestions?: number;
  verificationId?: string;
  dateStr?: string;
  locationStr?: string;
}

export type CertificateFormat = 'landscape' | 'story';

export const LEADERSHIP_PROFILES = [
  {
    name: 'Anoop Varghese',
    title: 'Sr. GM CCSH OT SOC MSSP',
    org: 'Schneider Electric',
    linkedin: 'https://www.linkedin.com/in/anoop-varghese-a54a9336/'
  },
  {
    name: 'Abhinav Roy',
    title: 'GM CCSH OT SOC MSSP',
    org: 'Schneider Electric',
    linkedin: 'https://www.linkedin.com/in/abhinavroy07/'
  },
  {
    name: 'Padmasini Annadanam',
    title: 'Cyber Engineer - CCSH OT SOC MSSP',
    org: 'Schneider Electric',
    linkedin: 'https://www.linkedin.com/in/padmasiniannadanam/'
  }
];

export function generateVerificationId(name: string, score: number): string {
  let hash = 0;
  const str = `${name.trim().toLowerCase()}-${score}-cyberday2026`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(6, '0').slice(0, 6);
  return `SE-CCSH26-${hex}`;
}

/**
 * Load an image from URL safely with fallback
 */
function loadImageSafely(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Render the certificate directly onto a provided HTMLCanvasElement
 */
export async function renderCertificateToCanvas(
  canvas: HTMLCanvasElement,
  data: CertificateData,
  format: CertificateFormat = 'landscape'
): Promise<void> {
  const isLandscape = format === 'landscape';
  const width = isLandscape ? 1920 : 1080;
  const height = isLandscape ? 1080 : 1920;

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Wait for Google Calligraphy Fonts if available
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // continue without blocking
    }
  }

  const isWinner = data.tier === 'winner';
  const verificationId = data.verificationId || generateVerificationId(data.name, data.score);
  const eventDate = data.dateStr || '7 October 2026';
  const eventLocation = data.locationStr || 'Avinya Campus, Bangalore';

  // Load both logos in parallel (using user's uploaded official logo)
  const [seLogoImg, cshLogoImg] = await Promise.all([
    loadImageSafely('/se-logo-official.png').then(img => img || loadImageSafely('/se-logo-full.png')),
    loadImageSafely('/csh-logo.png')
  ]);

  // Helper for safe rounded rect drawing
  const drawRoundRectPath = (x: number, y: number, w: number, h: number, r: number) => {
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(x, y, w, h, r);
    } else {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
  };

  // Helper for text rendering
  const drawText = (
    text: string,
    x: number,
    y: number,
    font: string,
    color: string,
    align: CanvasTextAlign = 'center',
    base: CanvasTextBaseline = 'middle'
  ) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = base;
    ctx.fillText(text, x, y);
  };

  // -------------------------------------------------------------
  // 1. WHITE & GREEN THEME BACKGROUND (Matches Website Theme)
  // -------------------------------------------------------------
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#FFFFFF');
  bgGrad.addColorStop(0.5, '#F7FCF9'); // Fresh mint white
  bgGrad.addColorStop(1, '#FFFFFF');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Soft radiant center bloom (light emerald brand glow)
  const glowX = width / 2;
  const glowY = isLandscape ? 500 : 860;
  const radialGlow = ctx.createRadialGradient(glowX, glowY, 60, glowX, glowY, isLandscape ? 750 : 600);
  radialGlow.addColorStop(0, isWinner ? 'rgba(0, 230, 118, 0.12)' : 'rgba(0, 150, 57, 0.08)');
  radialGlow.addColorStop(0.6, 'rgba(0, 150, 57, 0.03)');
  radialGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = radialGlow;
  ctx.fillRect(0, 0, width, height);

  // -------------------------------------------------------------
  // 2. INCREASED VISIBILITY GEN-Z CYBER AWARENESS GRAPHICS
  // -------------------------------------------------------------
  ctx.save();

  // A. Hexagonal Cyber Matrix Mesh (upper corners & background) - Increased Visibility (~16%)
  const drawHexGrid = (startX: number, startY: number, cols: number, rows: number, hexR: number) => {
    ctx.strokeStyle = 'rgba(0, 150, 57, 0.16)';
    ctx.lineWidth = 1.4;
    const h = hexR * Math.sqrt(3);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = startX + c * hexR * 1.5;
        const cy = startY + r * h + (c % 2 ? h / 2 : 0);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const px = cx + hexR * Math.cos(angle);
          const py = cy + hexR * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  };

  drawHexGrid(50, 70, isLandscape ? 9 : 6, isLandscape ? 7 : 6, 28);
  drawHexGrid(width - (isLandscape ? 430 : 290), 70, isLandscape ? 9 : 6, isLandscape ? 7 : 6, 28);

  // B. Prominent Cyber Defense Shield with Padlock (Watermark Center-Right) - Increased Visibility (~22%)
  const shieldX = isLandscape ? width * 0.76 : width * 0.78;
  const shieldY = isLandscape ? height * 0.49 : height * 0.44;
  const shieldW = isLandscape ? 280 : 190;
  const shieldH = isLandscape ? 350 : 240;

  ctx.strokeStyle = 'rgba(0, 150, 57, 0.22)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(shieldX, shieldY - shieldH / 2);
  ctx.lineTo(shieldX + shieldW / 2, shieldY - shieldH * 0.35);
  ctx.lineTo(shieldX + shieldW * 0.45, shieldY + shieldH * 0.25);
  ctx.lineTo(shieldX, shieldY + shieldH / 2);
  ctx.lineTo(shieldX - shieldW * 0.45, shieldY + shieldH * 0.25);
  ctx.lineTo(shieldX - shieldW / 2, shieldY - shieldH * 0.35);
  ctx.closePath();
  ctx.stroke();

  // Inner Shield Contour in vibrant cyber green
  ctx.strokeStyle = 'rgba(0, 230, 118, 0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(shieldX, shieldY - shieldH / 2 + 18);
  ctx.lineTo(shieldX + shieldW / 2 - 18, shieldY - shieldH * 0.35 + 12);
  ctx.lineTo(shieldX + shieldW * 0.45 - 16, shieldY + shieldH * 0.25 - 12);
  ctx.lineTo(shieldX, shieldY + shieldH / 2 - 18);
  ctx.lineTo(shieldX - shieldW * 0.45 + 16, shieldY + shieldH * 0.25 - 12);
  ctx.lineTo(shieldX - shieldW / 2 + 18, shieldY - shieldH * 0.35 + 12);
  ctx.closePath();
  ctx.stroke();

  // Cyber Padlock Graphic inside Shield
  const lockY = shieldY + 12;
  ctx.strokeStyle = 'rgba(0, 150, 57, 0.24)';
  ctx.lineWidth = 3.5;
  // Shackle
  ctx.beginPath();
  ctx.arc(shieldX, lockY - 28, 26, Math.PI, 0, false);
  ctx.stroke();
  // Body
  ctx.fillStyle = 'rgba(0, 230, 118, 0.08)';
  ctx.fillRect(shieldX - 35, lockY - 26, 70, 56);
  ctx.strokeRect(shieldX - 35, lockY - 26, 70, 56);
  // Keyhole
  ctx.fillStyle = 'rgba(0, 150, 57, 0.26)';
  ctx.beginPath();
  ctx.arc(shieldX, lockY - 3, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(shieldX - 4, lockY - 1);
  ctx.lineTo(shieldX + 4, lockY - 1);
  ctx.lineTo(shieldX + 5, lockY + 16);
  ctx.lineTo(shieldX - 5, lockY + 16);
  ctx.closePath();
  ctx.fill();

  // C. Cyber Circuit Board Traces & Glowing Solder Nodes - Increased Visibility (~25%)
  ctx.strokeStyle = 'rgba(0, 150, 57, 0.24)';
  ctx.fillStyle = 'rgba(0, 230, 118, 0.35)';
  ctx.lineWidth = 2.2;

  const traces = [
    // Bottom-left circuit network
    [{ x: 90, y: height - 120 }, { x: 240, y: height - 120 }, { x: 310, y: height - 190 }, { x: 480, y: height - 190 }],
    [{ x: 120, y: height - 75 }, { x: 320, y: height - 75 }, { x: 390, y: height - 145 }, { x: 560, y: height - 145 }],
    // Top-right circuit network
    [{ x: width - 80, y: 160 }, { x: width - 210, y: 160 }, { x: width - 290, y: 240 }, { x: width - 460, y: 240 }],
    [{ x: width - 120, y: 110 }, { x: width - 300, y: 110 }, { x: width - 370, y: 180 }, { x: width - 520, y: 180 }],
    // Mid left trace
    [{ x: 90, y: height * 0.44 }, { x: 240, y: height * 0.44 }, { x: 310, y: height * 0.51 }, { x: 430, y: height * 0.51 }]
  ];

  traces.forEach(path => {
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();

    // Solder pad dots
    const end = path[path.length - 1];
    ctx.beginPath();
    ctx.arc(end.x, end.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // D. Gen-Z Cyber Awareness Code / Terminal Stream Watermark - Increased Visibility (~20%)
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = 'rgba(0, 150, 57, 0.20)';
  ctx.textAlign = 'left';

  const cyberStrings = [
    '01000011 01011001 01000010 01000101 01010010 // CYBER_DAY_2026',
    '> [SECURITY_POSTURE: 100%_SECURED] // OT_SOC_MSSP_ACTIVE',
    '>> ZERO_TRUST // THREAT_INTELLIGENCE // ACTIVE_DEFENSE',
    'AVINYA_CAMPUS_BANGALORE // 07_OCT_2026 // LIFE_IS_ON',
    '01100011 01110011 01101000 // CONNECTED_SERVICES_HUB'
  ];

  const streamStartX = isLandscape ? 110 : 60;
  const streamStartY = isLandscape ? height * 0.63 : height * 0.60;
  cyberStrings.forEach((str, idx) => {
    ctx.fillText(str, streamStartX, streamStartY + idx * 24);
  });

  ctx.restore();

  // -------------------------------------------------------------
  // 3. GREEN & WHITE DOUBLE BORDER WITH CORNER BRACKETS
  // -------------------------------------------------------------
  const m = isLandscape ? 38 : 28;
  const innerM = m + 14;

  ctx.save();
  // Outer Border: Solid Schneider Electric Green #009639
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#009639';
  ctx.strokeRect(m, m, width - m * 2, height - m * 2);

  // Inner Border: Vibrant Cyber Green #00E676
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = isWinner ? '#F59E0B' : '#00E676';
  ctx.strokeRect(innerM, innerM, width - innerM * 2, height - innerM * 2);

  // Decorative Corner Cyber Brackets
  const drawCyberCorner = (cx: number, cy: number, dx: number, dy: number) => {
    const size = isLandscape ? 36 : 28;
    ctx.strokeStyle = '#009639';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy + dy * size);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + dx * size, cy);
    ctx.stroke();

    // Corner cyber terminal dot
    ctx.fillStyle = '#00E676';
    ctx.beginPath();
    ctx.arc(cx + dx * 9, cy + dy * 9, 3.5, 0, Math.PI * 2);
    ctx.fill();
  };

  drawCyberCorner(m + 4, m + 4, 1, 1);
  drawCyberCorner(width - m - 4, m + 4, -1, 1);
  drawCyberCorner(m + 4, height - m - 4, 1, -1);
  drawCyberCorner(width - m - 4, height - m - 4, -1, -1);
  ctx.restore();

  // -------------------------------------------------------------
  // 4. VERTICALLY CENTERED & BALANCED CONTENT
  // -------------------------------------------------------------
  if (isLandscape) {
    // =========================================================
    // LANDSCAPE (1920 x 1080) - EVENLY BALANCED VERTICALLY
    // =========================================================
    const centerX = width / 2;

    // A. DUAL HEADER LOGOS
    // 1st Logo: Schneider Electric (Top Left - User's uploaded official image)
    const logoY = 65;
    if (seLogoImg) {
      const seW = 200;
      const seH = (seLogoImg.naturalHeight / seLogoImg.naturalWidth) * seW || 133;
      ctx.drawImage(seLogoImg, 95, logoY, seW, Math.min(seH, 130));
    } else {
      drawText('Schneider Electric', 190, logoY + 45, 'bold 26px system-ui', '#009639', 'left');
    }

    // 2nd Logo: Team CSH Logo (Top Right)
    if (cshLogoImg) {
      const cshSize = 110;
      ctx.drawImage(cshLogoImg, width - 95 - cshSize, logoY + 5, cshSize, cshSize);
    } else {
      ctx.fillStyle = '#009639';
      ctx.beginPath();
      ctx.arc(width - 150, logoY + 60, 48, 0, Math.PI * 2);
      ctx.fill();
      drawText('CSH', width - 150, logoY + 60, 'bold 18px system-ui', '#FFFFFF');
    }

    // B. CENTER HEADING: CYBER DAY 2026
    ctx.save();
    ctx.font = 'bold 44px "Cinzel", system-ui, sans-serif';
    ctx.fillStyle = '#009639';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CYBER DAY 2026', centerX, 92);

    // Tagline below heading: "Beyond Compliance. Enabling Business."
    drawText('Beyond Compliance. Enabling Business.', centerX, 134, 'italic 600 18px "Playfair Display", Georgia, serif', '#1E293B');

    // Date & Location Pill Bar (as shown in reference Image 3)
    const infoPillW = 480;
    const infoPillH = 34;
    const infoPillY = 160;
    ctx.fillStyle = 'rgba(0, 150, 57, 0.08)';
    ctx.strokeStyle = '#009639';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    drawRoundRectPath(centerX - infoPillW / 2, infoPillY, infoPillW, infoPillH, 17);
    ctx.fill();
    ctx.stroke();

    drawText(
      `📅 ${eventDate}   |   📍 ${eventLocation}`,
      centerX,
      infoPillY + infoPillH / 2,
      'bold 13px system-ui, sans-serif',
      '#007A2E'
    );
    ctx.restore();

    // C. CERTIFICATE TITLE (Tier Specific)
    ctx.save();
    if (isWinner) {
      ctx.font = 'bold 48px "Cinzel", Georgia, serif';
      ctx.fillStyle = '#009639';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CERTIFICATE OF EXCELLENCE', centerX, 242);

      drawText('HONORING OUTSTANDING CYBER DEFENSE MASTERY & TOP HONORS', centerX, 282, 'bold 12px system-ui, sans-serif', '#D97706');
    } else {
      ctx.font = 'bold 46px "Cinzel", Georgia, serif';
      ctx.fillStyle = '#009639';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CERTIFICATE OF PARTICIPATION', centerX, 242);

      drawText('RECOGNIZING ACTIVE COMPETENCE IN CYBERSECURITY & OT DEFENSE', centerX, 282, 'bold 12px system-ui, sans-serif', '#007A2E');
    }
    ctx.restore();

    // D. RECIPIENT PRESENTATION CLAUSE
    drawText('This certificate is proudly presented to', centerX, 340, 'italic 20px "Playfair Display", Georgia, serif', '#64748B');

    // E. RECIPIENT NAME IN GORGEOUS CALLIGRAPHY FONT (Centered in the True Middle)
    ctx.save();
    const recipientName = data.name.trim();
    // Use Great Vibes or Alex Brush calligraphy, with Brush Script fallback
    ctx.font = '76px "Great Vibes", "Alex Brush", "Brush Script MT", "Playfair Display", cursive, Georgia';
    ctx.fillStyle = '#064E24'; // Rich deep forest emerald calligraphy ink
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Auto-scale calligraphy font if name is very long
    const maxNameW = 1200;
    const currentNameW = ctx.measureText(recipientName).width;
    if (currentNameW > maxNameW) {
      const scale = maxNameW / currentNameW;
      ctx.font = `${Math.floor(76 * scale)}px "Great Vibes", "Alex Brush", "Brush Script MT", cursive, Georgia`;
    }
    ctx.fillText(recipientName, centerX, 412);

    // Decorative Calligraphy Underline with Emerald Diamond
    const lineLen = 340;
    ctx.strokeStyle = isWinner ? '#F59E0B' : '#009639';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(centerX - lineLen, 458);
    ctx.lineTo(centerX - 30, 458);
    ctx.moveTo(centerX + 30, 458);
    ctx.lineTo(centerX + lineLen, 458);
    ctx.stroke();

    ctx.fillStyle = '#00E676';
    ctx.beginPath();
    ctx.arc(centerX, 458, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // F. AWARD TIER BADGE PILL
    ctx.save();
    const badgeW = 480;
    const badgeH = 40;
    const badgeY = 485;
    ctx.fillStyle = isWinner ? 'rgba(245, 158, 11, 0.12)' : 'rgba(0, 150, 57, 0.10)';
    ctx.strokeStyle = isWinner ? '#F59E0B' : '#009639';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    drawRoundRectPath(centerX - badgeW / 2, badgeY, badgeW, badgeH, 14);
    ctx.fill();
    ctx.stroke();

    const titlePrefix = isWinner ? '🏆 ' : '🛡️ ';
    drawText(
      `${titlePrefix}${data.awardTitle.toUpperCase()}`,
      centerX,
      badgeY + badgeH / 2,
      'bold 15px system-ui, sans-serif',
      isWinner ? '#B45309' : '#007A2E'
    );
    ctx.restore();

    // G. CITATION NARRATIVE
    const citation = isWinner
      ? 'For demonstrating superior technical precision, rapid incident detection, and exceptional cyber defense problem-solving in the Schneider Electric Cyber Day 2026 OT & SOC Defense Championship.'
      : 'For successful participation and dedication to cybersecurity excellence in the Schneider Electric Cyber Day 2026 Challenge, demonstrating active commitment to securing critical OT and enterprise environments.';

    ctx.save();
    ctx.font = '16px "Playfair Display", Georgia, serif';
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const maxW = 1250;
    const words = citation.split(' ');
    let line1 = '';
    let line2 = '';
    for (const w of words) {
      if (ctx.measureText(line1 + ' ' + w).width < maxW && !line2) {
        line1 += (line1 ? ' ' : '') + w;
      } else {
        line2 += (line2 ? ' ' : '') + w;
      }
    }
    ctx.fillText(line1, centerX, 555);
    if (line2) ctx.fillText(line2, centerX, 582);
    ctx.restore();

    // H. PERFORMANCE METRICS STRIP (Score, Rank, Speed)
    ctx.save();
    const statBoxY = 620;
    const statBoxH = 54;
    const statBoxW = 210;
    const gap = 26;

    const stats = [
      { label: 'FINAL SCORE', val: `${data.score} PTS`, col: '#009639' },
      { label: 'OFFICIAL RANK', val: typeof data.rank === 'number' ? `#${data.rank}` : String(data.rank), col: '#0F172A' },
      { label: 'RESPONSE SPEED', val: data.speed || '--', col: '#0284C7' }
    ];

    const totalStatW = stats.length * statBoxW + (stats.length - 1) * gap;
    let startStatX = centerX - totalStatW / 2;

    stats.forEach(st => {
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      drawRoundRectPath(startStatX, statBoxY, statBoxW, statBoxH, 12);
      ctx.fill();
      ctx.stroke();

      // Top green brand stripe
      ctx.fillStyle = '#009639';
      ctx.beginPath();
      drawRoundRectPath(startStatX, statBoxY, statBoxW, 4.5, 2);
      ctx.fill();

      drawText(st.label, startStatX + statBoxW / 2, statBoxY + 20, 'bold 11px system-ui', '#64748B');
      drawText(st.val, startStatX + statBoxW / 2, statBoxY + 39, 'bold 17px monospace', st.col);
      startStatX += statBoxW + gap;
    });
    ctx.restore();

    // I. CIRCULAR OFFICIAL EMBOSSED SECURITY SEAL
    drawOfficialSeal(ctx, centerX, 735, 46, isWinner);

    // J. THREE OFFICIAL SIGNATORIES (Well Balanced at the Bottom)
    const sigY = 885;
    const sigPositions = [
      width * 0.23, // Anoop Varghese
      width * 0.50, // Abhinav Roy
      width * 0.77  // Padmasini Annadanam
    ];

    LEADERSHIP_PROFILES.forEach((ldr, idx) => {
      const sx = sigPositions[idx];

      // Stylized Calligraphy Signature Script
      ctx.font = 'italic 34px "Great Vibes", "Alex Brush", "Brush Script MT", cursive, Georgia';
      ctx.fillStyle = '#009639';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ldr.name, sx, sigY - 30);

      // Signature Divider Line
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx - 125, sigY);
      ctx.lineTo(sx + 125, sigY);
      ctx.stroke();

      // Signatory Details
      drawText(ldr.name, sx, sigY + 24, 'bold 16px system-ui, sans-serif', '#0F172A');
      drawText(ldr.title, sx, sigY + 46, 'bold 12px system-ui, sans-serif', '#009639');
      drawText(ldr.org, sx, sigY + 66, '11px system-ui, sans-serif', '#64748B');
    });

    // K. VERIFICATION FOOTER
    const footY = height - 60;
    drawText(`VERIFICATION ID: ${verificationId}`, width * 0.20, footY, 'bold 11px monospace', '#64748B');
    drawText(`${eventDate} • ${eventLocation}`, centerX, footY, 'bold 11px system-ui', '#007A2E');
    drawText('CCSH OT SOC MSSP • LIFE IS ON', width * 0.80, footY, 'bold 11px system-ui', '#009639');

  } else {
    // =========================================================
    // INSTAGRAM STORY FORMAT (1080 x 1920) - VERTICALLY BALANCED
    // =========================================================
    const centerX = width / 2;

    // A. DUAL HEADER LOGOS (Top)
    const logoY = 120;
    if (seLogoImg) {
      const seW = 220;
      const seH = (seLogoImg.naturalHeight / seLogoImg.naturalWidth) * seW || 146;
      ctx.drawImage(seLogoImg, centerX - seW / 2 - 80, logoY, seW, Math.min(seH, 140));
    }
    if (cshLogoImg) {
      const cshSize = 100;
      ctx.drawImage(cshLogoImg, centerX + 60, logoY + 10, cshSize, cshSize);
    }

    // B. HEADING: CYBER DAY 2026
    ctx.save();
    ctx.font = 'bold 52px "Cinzel", system-ui, sans-serif';
    ctx.fillStyle = '#009639';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CYBER DAY 2026', centerX, 290);

    // Tagline
    drawText('Beyond Compliance. Enabling Business.', centerX, 345, 'italic 600 21px "Playfair Display", Georgia, serif', '#1E293B');

    // Date & Location Pill
    const pillW = 540;
    const pillH = 42;
    const pillY = 385;
    ctx.fillStyle = 'rgba(0, 150, 57, 0.08)';
    ctx.strokeStyle = '#009639';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    drawRoundRectPath(centerX - pillW / 2, pillY, pillW, pillH, 21);
    ctx.fill();
    ctx.stroke();

    drawText(
      `📅 ${eventDate}   |   📍 ${eventLocation}`,
      centerX,
      pillY + pillH / 2,
      'bold 15px system-ui',
      '#007A2E'
    );
    ctx.restore();

    // C. CERTIFICATE TITLE
    if (isWinner) {
      ctx.font = 'bold 54px "Cinzel", Georgia, serif';
      ctx.fillStyle = '#009639';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CERTIFICATE OF', centerX, 500);
      ctx.fillText('EXCELLENCE', centerX, 565);

      drawText('HONORING OUTSTANDING CYBER DEFENSE MASTERY', centerX, 625, 'bold 15px system-ui', '#D97706');
    } else {
      ctx.font = 'bold 50px "Cinzel", Georgia, serif';
      ctx.fillStyle = '#009639';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CERTIFICATE OF', centerX, 500);
      ctx.fillText('PARTICIPATION', centerX, 565);

      drawText('RECOGNIZING ACTIVE CYBERSECURITY DEFENSE', centerX, 625, 'bold 15px system-ui', '#007A2E');
    }

    // Presentation text
    drawText('This certificate is proudly presented to', centerX, 705, 'italic 24px "Playfair Display", Georgia, serif', '#64748B');

    // Recipient Name in Calligraphy Font
    ctx.save();
    ctx.font = '76px "Great Vibes", "Alex Brush", "Brush Script MT", "Playfair Display", cursive, Georgia';
    ctx.fillStyle = '#064E24';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.name.trim(), centerX, 785);

    // Underline
    ctx.strokeStyle = isWinner ? '#F59E0B' : '#009639';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(centerX - 260, 835);
    ctx.lineTo(centerX + 260, 835);
    ctx.stroke();
    ctx.restore();

    // Award Category Badge
    ctx.save();
    const badgeW = 560;
    const badgeH = 52;
    const badgeY = 875;
    ctx.fillStyle = isWinner ? 'rgba(245, 158, 11, 0.12)' : 'rgba(0, 150, 57, 0.10)';
    ctx.strokeStyle = isWinner ? '#F59E0B' : '#009639';
    ctx.lineWidth = 2;
    ctx.beginPath();
    drawRoundRectPath(centerX - badgeW / 2, badgeY, badgeW, badgeH, 16);
    ctx.fill();
    ctx.stroke();

    const titlePrefix = isWinner ? '🏆 ' : '🛡️ ';
    drawText(
      `${titlePrefix}${data.awardTitle.toUpperCase()}`,
      centerX,
      badgeY + badgeH / 2,
      'bold 18px system-ui, sans-serif',
      isWinner ? '#B45309' : '#007A2E'
    );
    ctx.restore();

    // Seal in Center of Story
    drawOfficialSeal(ctx, centerX, 1010, 62, isWinner);

    // Performance Stats in Story
    ctx.save();
    const statY = 1125;
    const statW = 280;
    const statH = 80;
    const gap = 20;

    const stats = [
      { label: 'FINAL SCORE', val: `${data.score} PTS`, col: '#009639' },
      { label: 'OFFICIAL RANK', val: typeof data.rank === 'number' ? `#${data.rank}` : String(data.rank), col: '#0F172A' },
      { label: 'TOTAL SPEED', val: data.speed || '--', col: '#0284C7' }
    ];

    const totalW = stats.length * statW + (stats.length - 1) * gap;
    let sx = centerX - totalW / 2;

    stats.forEach(st => {
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      drawRoundRectPath(sx, statY, statW, statH, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#009639';
      ctx.beginPath();
      drawRoundRectPath(sx, statY, statW, 5, 2);
      ctx.fill();

      drawText(st.label, sx + statW / 2, statY + 26, 'bold 13px system-ui', '#64748B');
      drawText(st.val, sx + statW / 2, statY + 55, 'bold 21px monospace', st.col);
      sx += statW + gap;
    });
    ctx.restore();

    // Citation
    const citation = isWinner
      ? 'Recognized for elite tactical excellence, incident response precision, and OT cybersecurity mastery at Cyber Day 2026.'
      : 'Recognized for dedicated participation and tactical problem solving in critical infrastructure & OT defense at Cyber Day 2026.';

    ctx.save();
    ctx.font = '20px "Playfair Display", Georgia, serif';
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(citation, centerX, 1270);
    ctx.restore();

    // 3 Signatories arranged horizontally
    const sigY = 1450;
    const sigPositions = [
      width * 0.22,
      width * 0.50,
      width * 0.78
    ];

    LEADERSHIP_PROFILES.forEach((ldr, idx) => {
      const posX = sigPositions[idx];
      ctx.font = 'italic 34px "Great Vibes", "Alex Brush", "Brush Script MT", cursive, Georgia';
      ctx.fillStyle = '#009639';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ldr.name, posX, sigY - 32);

      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(posX - 105, sigY);
      ctx.lineTo(posX + 105, sigY);
      ctx.stroke();

      drawText(ldr.name, posX, sigY + 28, 'bold 16px system-ui', '#0F172A');
      drawText(ldr.title, posX, sigY + 52, 'bold 12px system-ui', '#009639');
      drawText(ldr.org, posX, sigY + 72, '11px system-ui', '#64748B');
    });

    // Story Footer
    const footY = height - 120;
    drawText(`VERIFICATION ID: ${verificationId}`, centerX, footY - 35, 'bold 15px monospace', '#64748B');
    drawText(`${eventDate} • ${eventLocation}`, centerX, footY, 'bold 15px system-ui', '#007A2E');
    drawText('SCHNEIDER ELECTRIC CCSH OT SOC MSSP • LIFE IS ON', centerX, footY + 35, 'bold 14px system-ui', '#009639');
  }
}

/**
 * Draw ornate official circular seal in White & Green
 */
function drawOfficialSeal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  isWinner: boolean
) {
  ctx.save();
  ctx.translate(x, y);

  // Outer rays/teeth
  const teeth = 36;
  ctx.fillStyle = isWinner ? '#D97706' : '#007A2E';
  for (let i = 0; i < teeth; i++) {
    const angle = (i * 2 * Math.PI) / teeth;
    const tx = Math.cos(angle) * (radius + 6);
    const ty = Math.sin(angle) * (radius + 6);
    ctx.beginPath();
    ctx.arc(tx, ty, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Outer Circle Ring
  ctx.beginPath();
  ctx.arc(0, 0, radius + 2, 0, Math.PI * 2);
  ctx.fillStyle = isWinner ? '#F59E0B' : '#009639';
  ctx.fill();

  // Inner Circle Surface (White)
  ctx.beginPath();
  ctx.arc(0, 0, radius - 6, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = isWinner ? '#F59E0B' : '#009639';
  ctx.stroke();

  // Center Shield Vector Icon
  ctx.fillStyle = isWinner ? '#D97706' : '#009639';
  ctx.beginPath();
  const sw = radius * 0.45;
  const sh = radius * 0.55;
  ctx.moveTo(0, -sh);
  ctx.lineTo(sw, -sh * 0.4);
  ctx.lineTo(sw * 0.8, sh * 0.5);
  ctx.lineTo(0, sh);
  ctx.lineTo(-sw * 0.8, sh * 0.5);
  ctx.lineTo(-sw, -sh * 0.4);
  ctx.closePath();
  ctx.fill();

  // Star in Shield
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.16, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Generate formatted text for LinkedIn sharing with leader tags, links, date, and location
 */
export function getLinkedInShareText(data: CertificateData): string {
  const rankStr = typeof data.rank === 'number' ? `Rank #${data.rank}` : String(data.rank);
  const isWinner = data.tier === 'winner';
  const certType = isWinner ? 'Certificate of Excellence' : 'Certificate of Participation';

  return `I am proud to share that I participated in Cyber Day 2026 ("Beyond Compliance. Enabling Business.") organized by Schneider Electric CCSH OT SOC MSSP at Avinya Campus, Bangalore! 🛡️⚡

Honored to achieve the ${certType} (${data.awardTitle.toUpperCase()}) with a score of ${data.score} pts (${rankStr}). It was an incredible session testing real-world OT, SOC, and Cyber Defense response skills.

A huge thank you to the leadership and organizing team:
• Anoop Varghese (Sr. GM CCSH OT SOC MSSP) - https://www.linkedin.com/in/anoop-varghese-a54a9336/
• Abhinav Roy (GM CCSH OT SOC MSSP) - https://www.linkedin.com/in/abhinavroy07/
• Padmasini Annadanam (Cyber Engineer - CCSH OT SOC MSSP) - https://www.linkedin.com/in/padmasiniannadanam/

#SchneiderElectric #CyberDay2026 #CCSHOTSOC #CyberSecurity #OTSecurity #MSSP #LifeIsOn #CyberDefense #BeyondComplianceEnablingBusiness`;
}

/**
 * Generate caption for Instagram Stories
 */
export function getInstagramShareCaption(data: CertificateData): string {
  const isWinner = data.tier === 'winner';
  const tag = isWinner ? '🏆 Cyber Day 2026 Winner' : '🛡️ Cyber Day 2026 Defender';

  return `${tag} | Schneider Electric CCSH OT SOC MSSP
"Beyond Compliance. Enabling Business."
📅 7 October 2026 | 📍 Avinya Campus, Bangalore
${data.awardTitle} • Score: ${data.score} pts
Mentions: Anoop Varghese | Abhinav Roy | Padmasini Annadanam
#CyberDay2026 #SchneiderElectric #CCSHOTSOC #LifeIsOn #CyberSecurity #OTSecurity`;
}
