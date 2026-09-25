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
  Monitor,
  Eye
} from 'lucide-react';
import {
  CertificateData,
  CertificateFormat,
  renderCertificateToCanvas,
  getLinkedInShareText,
  getInstagramShareCaption,
  LEADERSHIP_PROFILES,
  toTitleCase
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [copiedType, setCopiedType] = useState<'linkedin' | 'instagram' | 'id' | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');

  const isWinner = data.tier === 'winner';

  // Keep previewUrlRef in sync for cleanup
  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  // Render canvas whenever format, data, or open state changes
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsRendering(true);

    const timer = setTimeout(async () => {
      if (canvasRef.current && isMounted) {
        await renderCertificateToCanvas(canvasRef.current, data, format);
        if (isMounted) {
          try {
            canvasRef.current.toBlob((blob) => {
              if (blob && isMounted) {
                const url = URL.createObjectURL(blob);
                setPreviewUrl((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return url;
                });
              }
              if (isMounted) setIsRendering(false);
            }, 'image/png', 1.0);
          } catch {
            if (isMounted) setIsRendering(false);
          }
        }
      }
    }, 60);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, format, data]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 5000);
  };

  // Helper to extract high-quality PNG Blob from the current canvas
  const getCanvasBlob = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!canvasRef.current) {
        resolve(null);
        return;
      }
      canvasRef.current.toBlob((blob) => resolve(blob), 'image/png', 1.0);
    });
  };

  // Download or Save Certificate as High-Res PNG
  const handleDownload = async () => {
    try {
      const blob = await getCanvasBlob();
      if (!blob) {
        throw new Error('Canvas blob generation failed');
      }

      const cleanName = toTitleCase(data.name || 'Participant').replace(/[^a-zA-Z0-9]/g, '_');
      const suffix = format === 'story' ? 'Story' : 'Certificate';
      const filename = `Schneider_Electric_CyberDay2026_${suffix}_${cleanName}.png`;
      const file = new File([blob], filename, { type: 'image/png' });

      // 1. Try Native Mobile Web Share API with File (iOS Safari & Android Chrome)
      // On iOS: Opens system Share Sheet where the user can tap "Save Image" -> saves directly to Photos / Camera Roll!
      // On Android: Opens system Share Sheet with "Save to device" / Photos / Drive options.
      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: 'Schneider Electric Cyber Day 2026 Certificate',
            text: `Official Cyber Day 2026 Certificate for ${toTitleCase(data.name || 'Participant')}`,
            files: [file]
          });
          showToast('Select "Save Image" to save directly to your Photos / Camera Roll!');
          return;
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') {
            // User cancelled the share dialog
            return;
          }
          console.warn('Web Share failed, falling back to blob download:', shareErr);
        }
      }

      // 2. Blob URL Download Fallback (Desktop Browsers & Android Downloads)
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = filename;
      link.href = blobUrl;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 2000);

      const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent || '');
      if (isIOS) {
        showToast('Downloaded to Files > Downloads! Or press & hold the certificate image to Save to Photos.');
      } else {
        showToast('Certificate PNG downloaded to your device Downloads folder!');
      }
    } catch (err) {
      console.error('Download error:', err);
      // 3. Last-resort fallback: open preview URL in new tab so user can press-and-hold to save
      if (previewUrl) {
        window.open(previewUrl, '_blank');
        showToast('Certificate opened in new tab. Press and hold to Save to Photos.');
      } else {
        showToast('Please press and hold the certificate image above to Save to Photos.');
      }
    }
  };

  // Open high-resolution certificate in a new tab
  const handleOpenFullSize = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
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

      // Auto-trigger certificate download/save
      await handleDownload();

      showToast('Post text copied with leadership mentions! Opening LinkedIn...');

      // Open LinkedIn Feed with share composer
      setTimeout(() => {
        window.open('https://www.linkedin.com/feed/?shareActive=true', '_blank', 'noopener,noreferrer');
      }, 900);
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

      // Render Story format (either from current canvas or offscreen canvas if format was just changed)
      let storyBlob: Blob | null = null;
      if (format === 'story' && canvasRef.current) {
        storyBlob = await getCanvasBlob();
      } else {
        const offscreen = document.createElement('canvas');
        await renderCertificateToCanvas(offscreen, data, 'story');
        storyBlob = await new Promise<Blob | null>((res) => offscreen.toBlob(res, 'image/png', 1.0));
      }

      if (storyBlob) {
        const cleanName = toTitleCase(data.name || 'Participant').replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `Schneider_Electric_CyberDay2026_Story_${cleanName}.png`;
        const file = new File([storyBlob], filename, { type: 'image/png' });

        if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: 'Schneider Electric Cyber Day 2026 Story',
              text: caption,
              files: [file]
            });
            showToast('Story ready! Select Instagram or Save Image to Photos.');
            return;
          } catch (e: any) {
            if (e?.name === 'AbortError') return;
          }
        }

        // Fallback download
        const blobUrl = URL.createObjectURL(storyBlob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
        }, 2000);
        showToast('Story image downloaded & caption copied! Open Instagram Stories to post.');
      } else {
        showToast('Story caption copied! Open Instagram Stories to post.');
      }
    } catch {
      showToast('Caption copied! Open Instagram Stories to post.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[94vh] flex flex-col bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-700 overflow-hidden text-white">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-3.5 py-3 sm:px-5 sm:py-4 border-b border-slate-800 bg-slate-950/80 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-md shrink-0 ${
              isWinner ? 'bg-amber-500 text-slate-950' : 'bg-[#009639] text-white'
            }`}>
              {isWinner ? <Trophy className="w-4 h-4 sm:w-5 sm:h-5" /> : <Shield className="w-4 h-4 sm:w-5 sm:h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className="text-sm sm:text-base font-black text-white truncate">
                  Official E-Certificate
                </h3>
                <span className={`text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                  isWinner ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40' : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                }`}>
                  {isWinner ? '🏆 Excellence' : '🛡️ Defender'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Schneider Electric CCSH OT SOC MSSP • Cyber Day 2026
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 space-y-4 sm:space-y-5">
          
          {/* Format Switcher (Landscape 16:9 vs Story 9:16) */}
          <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between bg-slate-950/60 p-2 rounded-2xl border border-slate-800 text-xs font-semibold gap-2">
            <span className="text-slate-400 pl-1.5 text-[11px] sm:text-xs">Layout Aspect Ratio:</span>
            <div className="flex items-center gap-1.5 w-full xs:w-auto">
              <button
                onClick={() => setFormat('landscape')}
                className={`flex-1 xs:flex-initial flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl transition text-[11px] sm:text-xs ${
                  format === 'landscape'
                    ? 'bg-[#009639] text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Monitor className="w-3.5 h-3.5 shrink-0" />
                <span>Landscape (16:9)</span>
              </button>
              <button
                onClick={() => setFormat('story')}
                className={`flex-1 xs:flex-initial flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl transition text-[11px] sm:text-xs ${
                  format === 'story'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 shrink-0" />
                <span>Story (9:16)</span>
              </button>
            </div>
          </div>

          {/* Live High-Res Image Preview (supports native iOS & Android long-press) */}
          <div className="relative w-full rounded-2xl overflow-hidden border border-slate-700/60 bg-black flex items-center justify-center min-h-[260px] max-h-[460px] shadow-inner group">
            {isRendering && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                <div className="w-8 h-8 border-3 border-[#00E676] border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs text-slate-300 font-medium">Generating official vector certificate...</p>
              </div>
            )}

            {/* Hidden Canvas used for offscreen vector rendering */}
            <canvas
              ref={canvasRef}
              className="hidden"
            />

            {/* Real <img> element enabling native iOS/Android Long-Press context menus ("Save to Photos" / "Download Image") */}
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Schneider Electric Cyber Day 2026 Certificate"
                className={`max-w-full max-h-[440px] w-auto h-auto object-contain rounded-xl shadow-2xl transition-opacity duration-300 select-none ${
                  isRendering ? 'opacity-30' : 'opacity-100'
                }`}
                style={{ WebkitTouchCallout: 'default' }}
              />
            ) : (
              <div className="w-full h-[260px] flex items-center justify-center">
                <div className="w-8 h-8 border-3 border-[#00E676] border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* Full Size View Button Overlay */}
            {previewUrl && !isRendering && (
              <button
                type="button"
                onClick={handleOpenFullSize}
                className="absolute top-3 right-3 px-2.5 py-1.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 shadow-md backdrop-blur-sm transition flex items-center gap-1.5 text-xs font-semibold"
                title="Open Full Resolution in New Tab"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Full Size</span>
              </button>
            )}
          </div>

          {/* Mobile Guidance Banner */}
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-emerald-950/40 border border-emerald-800/40 text-xs text-emerald-200">
            <Sparkles className="w-4 h-4 text-[#00E676] flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-white block">📱 Mobile Photo / Camera Roll Tip:</span>
              <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                Tap <strong>&quot;Save / Download&quot;</strong> below and select <em>&quot;Save Image&quot;</em> in your phone&apos;s menu. You can also <strong>press &amp; hold</strong> the certificate preview above to save directly to your Photos / Gallery!
              </p>
            </div>
          </div>

          {/* 1-Click Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            {/* 1. Download / Save High-Res PNG */}
            <button
              onClick={handleDownload}
              disabled={isRendering}
              className={`py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-[#009639] hover:bg-[#00E676] hover:text-slate-950 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all active:scale-95 ${
                isRendering ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>{isRendering ? 'Generating...' : 'Save / Download (Full HD)'}</span>
            </button>

            {/* 2. Share on LinkedIn */}
            <button
              onClick={handleLinkedInShare}
              disabled={isRendering}
              className={`py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-[#0A66C2] hover:bg-[#0077B5] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-950/50 transition-all active:scale-95 ${
                isRendering ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              {copiedType === 'linkedin' ? <Check className="w-4 h-4 text-green-300 shrink-0" /> : <Linkedin className="w-4 h-4 fill-current shrink-0" />}
              <span>Share to LinkedIn</span>
            </button>

            {/* 3. Share on Instagram */}
            <button
              onClick={handleInstagramShare}
              disabled={isRendering}
              className={`py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:opacity-90 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-pink-950/50 transition-all active:scale-95 ${
                isRendering ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              {copiedType === 'instagram' ? <Check className="w-4 h-4 text-green-300 shrink-0" /> : <Instagram className="w-4 h-4 shrink-0" />}
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
