'use client';

import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Sparkles,
  Share2,
  Linkedin,
  Instagram,
  Download,
  Volume2,
  VolumeX,
  X,
  Award,
  Check,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { playApplauseSound, stopApplauseSound } from '../lib/applauseSound';

export interface WinnerTrophyModalProps {
  isOpen: boolean;
  onClose: () => void;
  winner: {
    name: string;
    rank: 1 | 2 | 3;
    score: number;
    totalTimeFormatted?: string;
    correctCount?: number;
  };
  roomPin?: string;
  onOpenCertificate?: () => void;
}

export default function WinnerTrophyModal({
  isOpen,
  onClose,
  winner,
  roomPin,
  onOpenCertificate
}: WinnerTrophyModalProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(true);
  const [copiedType, setCopiedType] = useState<'linkedin' | 'instagram' | null>(null);
  const [isDownloadingStory, setIsDownloadingStory] = useState(false);
  const stopAudioRef = useRef<(() => void) | null>(null);

  const rank = winner?.rank || 1;
  const isFirst = rank === 1;
  const isSecond = rank === 2;
  const isThird = rank === 3;

  const rankTitle = isFirst
    ? '🥇 1st Place - Grand Champion'
    : isSecond
    ? '🥈 2nd Place - Runner-Up'
    : '🥉 3rd Place - 2nd Runner-Up';

  const trophyTheme = isFirst
    ? {
        name: 'Gold',
        gradient: 'from-amber-300 via-yellow-400 to-amber-600',
        glowColor: 'rgba(245, 158, 11, 0.45)',
        badgeBg: 'bg-amber-400 text-amber-950',
        border: 'border-amber-400/60',
        titleColor: 'text-amber-300',
        metalGradient: ['#FFFBEB', '#FDE047', '#EAB308', '#CA8A04', '#78350F'],
        awardSubtitle: 'Top Tournament Defense Champion'
      }
    : isSecond
    ? {
        name: 'Silver',
        gradient: 'from-slate-100 via-slate-300 to-slate-500',
        glowColor: 'rgba(148, 163, 184, 0.45)',
        badgeBg: 'bg-slate-200 text-slate-900',
        border: 'border-slate-300/60',
        titleColor: 'text-slate-200',
        metalGradient: ['#FFFFFF', '#E2E8F0', '#94A3B8', '#64748B', '#334155'],
        awardSubtitle: 'Elite Incident Response Speed'
      }
    : {
        name: 'Bronze',
        gradient: 'from-amber-600 via-orange-600 to-amber-900',
        glowColor: 'rgba(217, 119, 6, 0.45)',
        badgeBg: 'bg-amber-600 text-white',
        border: 'border-amber-600/60',
        titleColor: 'text-amber-400',
        metalGradient: ['#FEF3C7', '#F59E0B', '#D97706', '#92400E', '#451A03'],
        awardSubtitle: 'Tactical Cybersecurity Excellence'
      };

  // Trigger celebration on open: Confetti, Vibration, Applause Sound
  useEffect(() => {
    if (!isOpen) return;

    // 1. Confetti Cannons
    triggerVictoryConfetti();

    // 2. Mobile Device Vibration
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([150, 80, 150, 80, 300, 100, 500]);
      } catch {}
    }

    // 3. Web Audio Round of Applause & Fanfare
    try {
      const stopFn = playApplauseSound(7);
      stopAudioRef.current = stopFn;
      setIsPlayingAudio(true);
    } catch {}

    return () => {
      if (stopAudioRef.current) {
        stopAudioRef.current();
        stopAudioRef.current = null;
      }
      stopApplauseSound();
    };
  }, [isOpen, rank]);

  const triggerVictoryConfetti = () => {
    try {
      // Cannon from left
      confetti({
        particleCount: 70,
        angle: 60,
        spread: 75,
        origin: { x: 0, y: 0.7 },
        colors: ['#00E676', '#009639', '#FFD700', '#FFA500', '#FFFFFF']
      });

      // Cannon from right
      confetti({
        particleCount: 70,
        angle: 120,
        spread: 75,
        origin: { x: 1, y: 0.7 },
        colors: ['#00E676', '#009639', '#FFD700', '#FFA500', '#FFFFFF']
      });

      // Center gold burst after 250ms
      setTimeout(() => {
        confetti({
          particleCount: 80,
          spread: 100,
          origin: { x: 0.5, y: 0.4 },
          colors: ['#FFD700', '#F59E0B', '#FFFFFF', '#00E676'],
          shapes: ['star', 'circle']
        });
      }, 250);
    } catch {}
  };

  const toggleAudio = () => {
    if (isPlayingAudio) {
      stopApplauseSound();
      setIsPlayingAudio(false);
    } else {
      const stopFn = playApplauseSound(6);
      stopAudioRef.current = stopFn;
      setIsPlayingAudio(true);
    }
  };

  const handleShareLinkedIn = () => {
    const shareText = `🏆 Proud to announce that I won ${rankTitle} at Schneider Electric Cyber Day 2026! 🛡️⚡

Honored to take the podium with a score of ${winner.score} pts in the Fastest Finger First OT & Cyber Security Defense Championship at Avinya Campus, Bangalore.

Special thanks to the leadership and organizing team:
• Anoop Varghese (Sr. GM CCSH OT SOC MSSP) - https://www.linkedin.com/in/anoop-varghese-a54a9336/
• Abhinav Roy (GM CCSH OT SOC MSSP) - https://www.linkedin.com/in/abhinavroy07/
• Padmasini Annadanam (CCSH OT SOC MSSP) - https://www.linkedin.com/in/padmasiniannadanam/

#CyberDay2026 #SchneiderElectric #Winner #OTSecurity #CyberSecurity #CCSHOTSOC #LifeIsOn #BeyondComplianceEnablingBusiness`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText).catch(() => {});
    }

    setCopiedType('linkedin');
    setTimeout(() => setCopiedType(null), 4000);

    const linkedInUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(shareText)}`;
    window.open(linkedInUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShareInstagram = async () => {
    const caption = `🏆 ${rankTitle} | Cyber Day 2026
Schneider Electric CCSH OT SOC MSSP
"Beyond Compliance. Enabling Business."
📍 Avinya Campus, Bangalore
Score: ${winner.score} pts
Mentions: Anoop Varghese | Abhinav Roy | Padmasini Annadanam
#CyberDay2026 #SchneiderElectric #Champion #CCSHOTSOC #OTSecurity #CyberSecurity`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(caption).catch(() => {});
    }

    setCopiedType('instagram');
    setTimeout(() => setCopiedType(null), 4000);

    // Generate high-res Instagram Story Trophy Image
    await generateAndDownloadStoryTrophy();
  };

  const generateAndDownloadStoryTrophy = async () => {
    setIsDownloadingStory(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Dark Gradient Background
      const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1920);
      bgGrad.addColorStop(0, '#030712');
      bgGrad.addColorStop(0.3, '#0F172A');
      bgGrad.addColorStop(0.7, '#064E3B');
      bgGrad.addColorStop(1, '#022C22');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1080, 1920);

      // 2. Radial Glow Behind Trophy
      const glow = ctx.createRadialGradient(540, 880, 50, 540, 880, 500);
      glow.addColorStop(0, isFirst ? 'rgba(234, 179, 8, 0.4)' : isSecond ? 'rgba(203, 213, 225, 0.35)' : 'rgba(217, 119, 6, 0.35)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(540, 880, 500, 0, Math.PI * 2);
      ctx.fill();

      // 3. Header: Schneider Electric
      ctx.textAlign = 'center';
      ctx.fillStyle = '#00E676';
      ctx.font = 'bold 36px "Outfit", sans-serif';
      ctx.fillText('SCHNEIDER ELECTRIC • CCSH MSS OPERATIONS', 540, 180);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 68px "Cinzel", serif';
      ctx.fillText('CYBER DAY 2026', 540, 270);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '600 32px "Outfit", sans-serif';
      ctx.fillText('"Beyond Compliance. Enabling Business."', 540, 330);

      // 4. Podium Badge
      ctx.fillStyle = isFirst ? '#F59E0B' : isSecond ? '#94A3B8' : '#D97706';
      ctx.beginPath();
      ctx.roundRect(300, 420, 480, 70, 35);
      ctx.fill();

      ctx.fillStyle = isFirst ? '#78350F' : '#0F172A';
      ctx.font = 'bold 32px "Outfit", sans-serif';
      ctx.fillText(rankTitle.toUpperCase(), 540, 467);

      // 5. Draw 2D Trophy Silhouette on Canvas
      drawTrophyVectorOnCanvas(ctx, 540, 880, rank);

      // 6. Winner Name Plaque
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 64px "Outfit", sans-serif';
      ctx.fillText(winner.name.toUpperCase(), 540, 1340);

      ctx.fillStyle = '#34D399';
      ctx.font = 'bold 44px "Space Grotesk", monospace';
      ctx.fillText(`${winner.score} PTS • SPEED ${winner.totalTimeFormatted || 'FASTEST'}`, 540, 1420);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 28px "Outfit", sans-serif';
      ctx.fillText('7 October 2026 • Avinya Campus, Bangalore', 540, 1600);

      ctx.fillStyle = '#00E676';
      ctx.font = 'bold 32px "Outfit", sans-serif';
      ctx.fillText('#CyberDay2026 #SchneiderElectric #CCSHOTSOC', 540, 1670);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `CyberDay2026_Trophy_Rank${rank}_${winner.name.replace(/\s+/g, '_')}.png`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          setIsDownloadingStory(false);
        }, 1500);
      }, 'image/png');
    } catch {
      setIsDownloadingStory(false);
    }
  };

  const drawTrophyVectorOnCanvas = (ctx: CanvasRenderingContext2D, cx: number, cy: number, trophyRank: number) => {
    ctx.save();
    ctx.translate(cx, cy);

    const isGold = trophyRank === 1;
    const isSilver = trophyRank === 2;

    const mainColor = isGold ? '#F59E0B' : isSilver ? '#CBD5E1' : '#D97706';
    const lightColor = isGold ? '#FDE047' : isSilver ? '#F8FAFC' : '#FBBF24';
    const darkColor = isGold ? '#78350F' : isSilver ? '#475569' : '#451A03';

    // Trophy Cup Body
    const cupGrad = ctx.createLinearGradient(-160, 0, 160, 0);
    cupGrad.addColorStop(0, darkColor);
    cupGrad.addColorStop(0.3, lightColor);
    cupGrad.addColorStop(0.7, mainColor);
    cupGrad.addColorStop(1, darkColor);

    ctx.fillStyle = cupGrad;
    ctx.beginPath();
    ctx.moveTo(-130, -220);
    ctx.lineTo(130, -220);
    ctx.bezierCurveTo(130, -50, 80, 20, 0, 70);
    ctx.bezierCurveTo(-80, 20, -130, -50, -130, -220);
    ctx.closePath();
    ctx.fill();

    // Trophy Rim
    ctx.fillStyle = lightColor;
    ctx.beginPath();
    ctx.ellipse(0, -220, 135, 25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trophy Handles (Left & Right)
    ctx.lineWidth = 24;
    ctx.strokeStyle = mainColor;
    ctx.beginPath();
    // Left handle
    ctx.arc(-130, -120, 60, Math.PI * 0.5, Math.PI * 1.5, false);
    ctx.stroke();

    // Right handle
    ctx.beginPath();
    ctx.arc(130, -120, 60, Math.PI * 1.5, Math.PI * 0.5, false);
    ctx.stroke();

    // Stem
    ctx.fillStyle = mainColor;
    ctx.fillRect(-28, 70, 56, 70);

    // Stem base
    ctx.fillStyle = lightColor;
    ctx.beginPath();
    ctx.ellipse(0, 140, 70, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trophy Plinth (Base Block)
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-140, 155, 280, 110);

    ctx.strokeStyle = lightColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(-140, 155, 280, 110);

    // CYBER DAY 2026 Engraved on Plinth Plate
    ctx.fillStyle = lightColor;
    ctx.font = 'bold 26px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.fillText('CYBER DAY 2026', 0, 205);

    ctx.fillStyle = '#00E676';
    ctx.font = 'bold 18px "Space Grotesk", monospace';
    ctx.fillText(isGold ? '★ CHAMPION ★' : isSilver ? '★ RUNNER-UP ★' : '★ 2ND RUNNER-UP ★', 0, 240);

    ctx.restore();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg max-h-[95vh] flex flex-col bg-gradient-to-b from-slate-900 via-slate-950 to-emerald-950/90 rounded-3xl shadow-2xl border border-slate-700/80 overflow-hidden text-white">
        
        {/* Ambient Radial Spotlight */}
        <div 
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-40 animate-pulse"
          style={{ backgroundColor: trophyTheme.glowColor }}
        />

        {/* Top Floating Action Controls */}
        <div className="flex items-center justify-between p-4 z-10">
          <button
            type="button"
            onClick={toggleAudio}
            title={isPlayingAudio ? 'Mute Applause' : 'Play Applause'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-200 border border-white/15 backdrop-blur-sm transition"
          >
            {isPlayingAudio ? (
              <>
                <Volume2 className="w-4 h-4 text-[#00E676] animate-bounce" />
                <span>Applause On</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-slate-400" />
                <span>Applause Muted</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition border border-white/15"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-0 space-y-4 text-center z-10">
          
          {/* Header Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-lg bg-white/15 backdrop-blur-md border border-white/20">
            <Sparkles className="w-4 h-4 text-yellow-300 animate-spin" style={{ animationDuration: '4s' }} />
            <span>Official Tournament Winner</span>
          </div>

          {/* 3D Animated Trophy Graphic */}
          <div className="relative flex flex-col items-center justify-center py-2">
            
            {/* Spinning Radiant Halo */}
            <div className="absolute w-44 h-44 sm:w-56 sm:h-56 rounded-full border-2 border-dashed border-white/15 animate-spin" style={{ animationDuration: '24s' }} />
            
            {/* Animated Trophy SVG */}
            <div className="relative w-44 h-48 sm:w-52 sm:h-56 transition-transform duration-500 hover:scale-105 filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.7)]">
              <svg viewBox="0 0 320 340" className="w-full h-full">
                <defs>
                  <linearGradient id={`trophyMetal-${rank}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={trophyTheme.metalGradient[0]} />
                    <stop offset="25%" stopColor={trophyTheme.metalGradient[1]} />
                    <stop offset="50%" stopColor={trophyTheme.metalGradient[2]} />
                    <stop offset="75%" stopColor={trophyTheme.metalGradient[3]} />
                    <stop offset="100%" stopColor={trophyTheme.metalGradient[4]} />
                  </linearGradient>
                  
                  <linearGradient id={`goldPlate-${rank}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#1E293B" />
                    <stop offset="50%" stopColor="#0F172A" />
                    <stop offset="100%" stopColor="#1E293B" />
                  </linearGradient>

                  <filter id="goldShine">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor={trophyTheme.glowColor} />
                  </filter>
                </defs>

                {/* Left Curved Handle */}
                <path
                  d="M 90 90 C 20 90 20 180 90 190"
                  fill="none"
                  stroke={`url(#trophyMetal-${rank})`}
                  strokeWidth="18"
                  strokeLinecap="round"
                />

                {/* Right Curved Handle */}
                <path
                  d="M 230 90 C 300 90 300 180 230 190"
                  fill="none"
                  stroke={`url(#trophyMetal-${rank})`}
                  strokeWidth="18"
                  strokeLinecap="round"
                />

                {/* Trophy Cup Main Body */}
                <path
                  d="M 80 50 L 240 50 C 240 145 200 195 160 215 C 120 195 80 145 80 50 Z"
                  fill={`url(#trophyMetal-${rank})`}
                  filter="url(#goldShine)"
                />

                {/* Trophy Top Rim */}
                <ellipse cx="160" cy="50" rx="80" ry="16" fill={trophyTheme.metalGradient[0]} />

                {/* Cup Center Star / Emblem */}
                <circle cx="160" cy="115" r="26" fill="rgba(0,0,0,0.2)" />
                <path
                  d="M 160 97 L 165 110 L 179 110 L 168 119 L 172 132 L 160 123 L 148 132 L 152 119 L 141 110 L 155 110 Z"
                  fill="#FFFFFF"
                />

                {/* Stem Column */}
                <rect x="146" y="215" width="28" height="40" fill={`url(#trophyMetal-${rank})`} />

                {/* Stem Ring */}
                <ellipse cx="160" cy="255" rx="38" ry="8" fill={trophyTheme.metalGradient[1]} />

                {/* Trophy Pedestal Base / Plinth */}
                <rect x="75" y="260" width="170" height="65" rx="10" fill={`url(#goldPlate-${rank})`} stroke={trophyTheme.metalGradient[1]} strokeWidth="2.5" />

                {/* Gold Engraved Plaque on Plinth */}
                <rect x="85" y="268" width="150" height="49" rx="6" fill="#0B1329" stroke={trophyTheme.metalGradient[2]} strokeWidth="1.5" />

                {/* MANDATORY ENGRAVING: CYBER DAY 2026 */}
                <text x="160" y="288" textAnchor="middle" fill={trophyTheme.metalGradient[1]} fontSize="13" fontWeight="900" fontFamily="serif" letterSpacing="1">
                  CYBER DAY 2026
                </text>

                <text x="160" y="306" textAnchor="middle" fill="#00E676" fontSize="10" fontWeight="bold" fontFamily="monospace">
                  {isFirst ? '★ 1ST PLACE ★' : isSecond ? '★ 2ND PLACE ★' : '★ 3RD PLACE ★'}
                </text>
              </svg>
            </div>

            {/* Replay Confetti Button */}
            <button
              type="button"
              onClick={triggerVictoryConfetti}
              className="mt-2 text-[11px] font-bold text-slate-300 hover:text-white bg-white/10 hover:bg-white/15 px-3 py-1 rounded-full flex items-center gap-1.5 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Pop More Confetti!</span>
            </button>
          </div>

          {/* Winner Title & Stats */}
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-md break-words">
              {winner.name}
            </h2>
            <p className={`text-sm sm:text-base font-extrabold ${trophyTheme.titleColor}`}>
              {rankTitle}
            </p>
            <p className="text-xs text-slate-400 font-medium">
              Schneider Electric CCSH OT SOC MSSP • Avinya Campus
            </p>

            <div className="inline-flex items-center gap-2 bg-slate-800/80 border border-slate-700 px-3 py-1 rounded-xl text-xs font-mono font-bold text-emerald-400 mt-2">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span>Score: {winner.score} pts</span>
              <span>•</span>
              <span>Speed: {winner.totalTimeFormatted || 'Fastest'}</span>
            </div>
          </div>

          {/* Social Sharing & Action Buttons */}
          <div className="space-y-2.5 pt-2">
            
            {/* 1. Share on LinkedIn */}
            <button
              type="button"
              onClick={handleShareLinkedIn}
              className="w-full py-3 px-4 rounded-2xl bg-[#0A66C2] hover:bg-[#0077B5] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-950/50 transition-all active:scale-95"
            >
              {copiedType === 'linkedin' ? (
                <>
                  <Check className="w-4 h-4 text-green-300" />
                  <span>Text Copied & Opening LinkedIn!</span>
                </>
              ) : (
                <>
                  <Linkedin className="w-4 h-4 fill-current" />
                  <span>Share Trophy to LinkedIn</span>
                </>
              )}
            </button>

            {/* 2. Share on Instagram (Story Card Download & Caption Copied) */}
            <button
              type="button"
              onClick={handleShareInstagram}
              disabled={isDownloadingStory}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-pink-950/50 transition-all active:scale-95"
            >
              {isDownloadingStory ? (
                <span>Generating Instagram Trophy Card...</span>
              ) : copiedType === 'instagram' ? (
                <>
                  <Check className="w-4 h-4 text-green-300" />
                  <span>Story Card Downloaded & Caption Copied!</span>
                </>
              ) : (
                <>
                  <Instagram className="w-4 h-4" />
                  <span>Share on Instagram (Story Card)</span>
                </>
              )}
            </button>

            {/* 3. View & Download Full E-Certificate */}
            {onOpenCertificate && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCertificate();
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/40 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Award className="w-4 h-4 text-[#00E676]" />
                <span>View Official E-Certificate</span>
              </button>
            )}
          </div>

          <p className="text-[10px] text-slate-400">
            Official award presented for Cyber Day 2026 by Schneider Electric CCSH OT SOC MSSP
          </p>
        </div>
      </div>
    </div>
  );
}
