'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Share2,
  Linkedin,
  Instagram,
  Copy,
  Check,
  X,
  Sparkles,
  Shield,
  Trophy,
  ExternalLink,
  Smartphone,
  Monitor
} from 'lucide-react';
import {
  CertificateData,
  CertificateFormat,
  renderCertificateToCanvas,
  getLinkedInShareText,
  getInstagramShareCaption,
  LEADERSHIP_PROFILES
} from '../lib/certificateGenerator';

interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: CertificateData;
}

export default function CertificateModal({ isOpen, onClose, data }: CertificateModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [format, setFormat] = useState<CertificateFormat>('landscape');
  const [isRendering, setIsRendering] = useState<boolean>(true);
  const [copiedType, setCopiedType] = useState<'linkedin' | 'instagram' | 'id' | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');

  const isWinner = data.tier === 'winner';

  // Render canvas whenever format or data changes
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsRendering(true);

    const timer = setTimeout(async () => {
      if (canvasRef.current && isMounted) {
        await renderCertificateToCanvas(canvasRef.current, data, format);
        if (isMounted) setIsRendering(false);
      }
    }, 50);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, format, data]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Download Certificate as High-Res PNG
  const handleDownload = () => {
    if (!canvasRef.current) return;
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      const cleanName = (data.name || 'Participant').replace(/[^a-zA-Z0-9]/g, '_');
      const suffix = format === 'story' ? 'Story' : 'Certificate';
      link.download = `Schneider_Electric_CyberDay2026_${suffix}_${cleanName}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Certificate PNG downloaded in high resolution!');
    } catch (err) {
      console.error('Download error:', err);
      showToast('Failed to download image. Try right-clicking to save.');
    }
  };

  // 1-Click LinkedIn Share
  const handleLinkedInShare = async () => {
    const text = getLinkedInShareText(data);
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedType('linkedin');
      setTimeout(() => setCopiedType(null), 3000);
      
      // Auto-trigger certificate download so they have the image ready to attach
      handleDownload();

      showToast('Post text copied with leadership mentions! Opening LinkedIn...');
      
      // Open LinkedIn Feed with share composer
      setTimeout(() => {
        window.open('https://www.linkedin.com/feed/?shareActive=true', '_blank', 'noopener,noreferrer');
      }, 700);
    } catch {
      showToast('Could not copy automatically. Text copied to manual clipboard.');
    }
  };

  // 1-Click Instagram Story Share
  const handleInstagramShare = async () => {
    // Switch to story format if not already
    if (format !== 'story') {
      setFormat('story');
    }

    const caption = getInstagramShareCaption(data);
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(caption);
      }
      setCopiedType('instagram');
      setTimeout(() => setCopiedType(null), 3000);

      // Check if native mobile Web Share API with image file is supported
      if (canvasRef.current && navigator.share && navigator.canShare) {
        canvasRef.current.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], `CyberDay2026_Story_${data.name.replace(/\s+/g, '_')}.png`, { type: 'image/png' });
            if (navigator.canShare({ files: [file] })) {
              try {
                await navigator.share({
                  title: 'Cyber Day 2026 Certificate',
                  text: caption,
                  files: [file]
                });
                showToast('Shared successfully to your phone!');
                return;
              } catch (e: any) {
                if (e.name !== 'AbortError') {
                  // Fall back to download
                  handleDownload();
                }
              }
            }
          }
          handleDownload();
          showToast('Story image downloaded & caption copied! Ready to post on Instagram Stories.');
        }, 'image/png');
      } else {
        handleDownload();
        showToast('Story image downloaded & caption copied! Open Instagram to share.');
      }
    } catch {
      handleDownload();
      showToast('Story image downloaded. Open Instagram to post!');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-slate-900 rounded-3xl shadow-2xl border border-slate-700 overflow-hidden text-white">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-md ${
              isWinner ? 'bg-amber-500 text-slate-950' : 'bg-[#009639] text-white'
            }`}>
              {isWinner ? <Trophy className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">
                  Official E-Certificate
                </h3>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                  isWinner ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40' : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                }`}>
                  {isWinner ? '🏆 Excellence Tier' : '🛡️ Defender Tier'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Schneider Electric CCSH OT SOC MSSP • Cyber Day 2026
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* Format Switcher (Landscape 16:9 vs Story 9:16) */}
          <div className="flex items-center justify-between bg-slate-950/60 p-2 rounded-2xl border border-slate-800 text-xs font-semibold">
            <span className="text-slate-400 pl-2">Layout Aspect Ratio:</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setFormat('landscape')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  format === 'landscape'
                    ? 'bg-[#009639] text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Landscape (16:9)</span>
              </button>
              <button
                onClick={() => setFormat('story')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  format === 'story'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Instagram Story (9:16)</span>
              </button>
            </div>
          </div>

          {/* Live High-Res Canvas Preview */}
          <div className="relative w-full rounded-2xl overflow-hidden border border-slate-700/60 bg-black flex items-center justify-center min-h-[260px] max-h-[460px] shadow-inner">
            {isRendering && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                <div className="w-8 h-8 border-3 border-[#00E676] border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs text-slate-300 font-medium">Generating official vector certificate...</p>
              </div>
            )}
            <canvas
              ref={canvasRef}
              className={`max-w-full max-h-[440px] w-auto h-auto object-contain rounded-xl shadow-2xl transition-opacity duration-300 ${
                isRendering ? 'opacity-30' : 'opacity-100'
              }`}
            />
          </div>

          {/* 1-Click Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Download High-Res PNG */}
            <button
              onClick={handleDownload}
              className="py-3 px-4 rounded-2xl bg-[#009639] hover:bg-[#00E676] hover:text-slate-950 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Download PNG (Full HD)</span>
            </button>

            {/* 2. Share on LinkedIn */}
            <button
              onClick={handleLinkedInShare}
              className="py-3 px-4 rounded-2xl bg-[#0A66C2] hover:bg-[#0077B5] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-950/50 transition-all active:scale-95"
            >
              {copiedType === 'linkedin' ? <Check className="w-4 h-4 text-green-300" /> : <Linkedin className="w-4 h-4 fill-current" />}
              <span>Share to LinkedIn</span>
            </button>

            {/* 3. Share on Instagram */}
            <button
              onClick={handleInstagramShare}
              className="py-3 px-4 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:opacity-90 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-pink-950/50 transition-all active:scale-95"
            >
              {copiedType === 'instagram' ? <Check className="w-4 h-4 text-green-300" /> : <Instagram className="w-4 h-4" />}
              <span>Share to Instagram</span>
            </button>
          </div>

          {/* Official Mentions Card (Anoop Varghese, Abhinav Roy, Padmasini Annadanam) */}
          <div className="bg-slate-950/70 rounded-2xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Official Leadership Mentions & Tags
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800/60">
                Auto-included in LinkedIn Share
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {LEADERSHIP_PROFILES.map((leader, i) => (
                <a
                  key={i}
                  href={leader.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 flex items-center justify-between group transition"
                >
                  <div className="truncate pr-2">
                    <p className="text-xs font-bold text-white group-hover:text-emerald-400 transition truncate">
                      {leader.name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {leader.title}
                    </p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 flex-shrink-0 transition" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Copy Post Caption Box */}
          <div className="bg-slate-950/40 rounded-2xl p-3.5 border border-slate-800/80 flex items-center justify-between text-xs">
            <div className="truncate pr-3">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Copy Caption for Social Media</span>
              <span className="text-slate-300 truncate block text-[11px] font-mono">
                {`I am proud to share my Cyber Day 2026 Certificate with Schneider Electric CCSH OT SOC MSSP...`}
              </span>
            </div>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(getLinkedInShareText(data));
                setCopiedType('linkedin');
                setTimeout(() => setCopiedType(null), 3000);
                showToast('Complete post text copied to clipboard!');
              }}
              className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center gap-1.5 flex-shrink-0 text-xs transition"
            >
              {copiedType === 'linkedin' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy Text</span>
            </button>
          </div>

        </div>

        {/* Toast Feedback Notification */}
        {toastMessage && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-black shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <Sparkles className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}
