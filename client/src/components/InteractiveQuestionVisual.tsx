'use client';

import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Search, 
  HelpCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Wifi, 
  Laptop, 
  Lock, 
  Unlock, 
  FileText, 
  Usb, 
  Eye, 
  Sparkles, 
  BellRing, 
  Smartphone, 
  MapPin, 
  KeyRound, 
  Server, 
  UserCheck, 
  Activity,
  Layers
} from 'lucide-react';

export interface ViolationPoint {
  id: number;
  title: string;
  description: string;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
}

export interface ProfileItem {
  id: string;
  label: string;
  role: string;
  environment: string;
  connection: string;
  securityControls: string;
  riskRating: 'CRITICAL' | 'HIGH' | 'LOW' | 'MINIMAL';
  isVulnerable?: boolean;
  threatCallouts?: string[];
  iconType?: 'cafe' | 'office' | 'home' | 'substation' | 'sms' | 'email' | 'teams' | 'ticket';
  quote?: string;
}

export interface VisualData {
  type: 'spot_the_difference' | 'picture_mcq' | 'picture_base' | 'memory_check' | 'crossword' | 'fill_in_the_blank' | 'riddle';
  // Spot the Difference
  sceneType?: 'office_delegation' | 'soc_gate' | 'turnstile_tailgate' | 'conference_leak' | 'cafe_eavesdrop' | string;
  sceneTitle?: string;
  sceneA?: {
    title: string;
    description: string;
    status: 'SECURE' | 'BASELINE';
  };
  sceneB?: {
    title: string;
    description: string;
    status: 'VULNERABLE' | 'SUSPECT';
  };
  violations?: ViolationPoint[];
  // Picture MCQ & Picture Base
  profiles?: ProfileItem[];
  // Memory Check
  alertData?: {
    title?: string;
    subtitle?: string;
    sender?: string;
    timestamp: string;
    ipAddress: string;
    location: string;
    device: string;
    authCode?: string;
    actionPrompt?: string;
    suspiciousSignals?: string[];
    isAttack?: boolean;
  };
  // Crossword
  crosswordData?: {
    clueNumber: number;
    direction: 'ACROSS' | 'DOWN';
    length: number;
    solutionWord: string;
    clue: string;
    revealedIndices?: number[];
  };
  // Fill in the Blank
  fillBlankData?: {
    prefixText?: string;
    sentenceBefore?: string;
    blankPlaceholder?: string;
    blank?: string;
    suffixText?: string;
    sentenceAfter?: string;
    contextBadge?: string;
    correctAnswerText?: string;
  };
  // Riddle
  riddleData?: {
    title?: string;
    riddleText: string;
    hintCategory?: string;
    hint?: string;
    enigmaTag?: string;
    decodedTitle?: string;
    iconType?: 'lock' | 'shield' | 'terminal' | 'phone' | 'usb' | 'eye';
  };
}

export interface RevealVisual {
  // Spot the difference
  violationHighlights?: ViolationPoint[];
  // Picture MCQ
  vulnerableProfileId?: string;
  // Memory Check
  highlightedSignals?: {
    field: string;
    value: string;
    reason: string;
  }[];
  crosswordSolution?: string;
  fillBlankAnswer?: string;
  riddleAnswer?: string;
  vulnerabilitySummary?: string;
}

interface Props {
  type?: string;
  visualData?: VisualData | null;
  revealVisual?: RevealVisual | null;
  isReveal?: boolean;
  compact?: boolean; // true for mobile participant view, false for projector/host
}

/* =========================================================================
   SCENE SVG RENDERER FOR SPOT-THE-DIFFERENCE (5 REALISTIC HUMAN WORKPLACE SCENES)
   ========================================================================= */
const SceneSvg: React.FC<{ sceneType: string; isPictureB: boolean; isReveal?: boolean }> = ({ sceneType, isPictureB, isReveal = false }) => {
  const bubbleBorder = isReveal && isPictureB ? '#ef4444' : '#475569';
  const bubbleTitle = isReveal && isPictureB ? '#f87171' : '#38bdf8';
  const bubbleSub = isReveal && isPictureB ? '#fca5a5' : '#cbd5e1';
  const alertStroke = isReveal && isPictureB ? '#ef4444' : '#475569';

  // SCENE 1: WORKSTATION CREDENTIAL SHARING & DESK DELEGATION
  if (sceneType === 'office_delegation') {
    return (
      <svg viewBox="0 0 400 250" className="w-full h-full select-none font-sans">
        <rect x="0" y="0" width="400" height="150" fill="#0b1329" />
        <line x1="0" y1="150" x2="400" y2="150" stroke="#1e293b" strokeWidth="2" />
        <polygon points="10,240 390,240 370,150 30,150" fill="#1e293b" stroke="#334155" strokeWidth="2" />

        {/* Office Desk Partition */}
        <rect x="20" y="20" width="360" height="90" rx="6" fill="#1e293b" fillOpacity="0.3" stroke="#334155" strokeWidth="1" />

        {/* Person A (Employee) */}
        <circle cx="130" cy="110" r="16" fill="#fbcfe8" stroke="#f472b6" strokeWidth="1.5" />
        <ellipse cx="130" cy="155" rx="28" ry="24" fill="#1e40af" />

        {/* Person B (Colleague) */}
        <circle cx="310" cy="110" r="16" fill="#fed7aa" stroke="#fb923c" strokeWidth="1.5" />
        <ellipse cx="310" cy="155" rx="26" ry="25" fill="#334155" />

        {!isPictureB ? (
          /* SCENARIO A: COMPLIANT WORKPLACE DIALOGUE */
          <g>
            {/* Employee A Lanyard */}
            <rect x="123" y="142" width="14" height="18" rx="2" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="1" />
            <text x="130" y="154" fill="#ffffff" fontSize="6" fontWeight="bold" textAnchor="middle">ID</text>

            {/* Locked Monitor */}
            <rect x="40" y="90" width="65" height="45" rx="4" fill="#020617" stroke="#475569" strokeWidth="2" />
            <rect x="62" y="135" width="20" height="15" fill="#334155" />
            <rect x="44" y="94" width="57" height="37" rx="2" fill="#0f172a" />
            <text x="72" y="115" fill="#94a3b8" fontSize="6.5" fontWeight="bold" textAnchor="middle">WIN+L LOCKED</text>

            {/* Speech Bubble from Employee A */}
            <rect x="20" y="28" width="180" height="38" rx="6" fill="#020617" stroke="#475569" strokeWidth="1.5" />
            <text x="30" y="44" fill="#38bdf8" fontSize="6.5" fontWeight="bold">Employee A:</text>
            <text x="30" y="56" fill="#e2e8f0" fontSize="6.5">&ldquo;I cannot share my badge or password.&rdquo;</text>
            <text x="30" y="63" fill="#94a3b8" fontSize="5.5">&ldquo;Request PAM elevation via CyberArk.&rdquo;</text>

            {/* Speech Bubble from Colleague B */}
            <rect x="215" y="28" width="165" height="38" rx="6" fill="#020617" stroke="#475569" strokeWidth="1.5" />
            <text x="225" y="44" fill="#f59e0b" fontSize="6.5" fontWeight="bold">Colleague B:</text>
            <text x="225" y="56" fill="#e2e8f0" fontSize="6.5">&ldquo;Understood, I will submit the</text>
            <text x="225" y="63" fill="#94a3b8" fontSize="5.5">ServiceNow access ticket now.&rdquo;</text>
          </g>
        ) : (
          /* SCENARIO B: CREDENTIAL SHARING & VIOLATIONS WITH SPEECH BUBBLES */
          <g>
            {/* Extended Arm Handing Smartcard Badge */}
            <path d="M 145 145 Q 190 148 230 152" stroke="#fbcfe8" strokeWidth="8" strokeLinecap="round" />
            <rect x="225" y="145" width="22" height="15" rx="2" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" transform="rotate(8 225 145)" />
            <text x="236" y="155" fill="#ffffff" fontSize="6" fontWeight="900" textAnchor="middle">ID BADGE</text>

            {/* Colleague Arm Reaching to Take Badge */}
            <path d="M 295 145 L 250 152" stroke="#fed7aa" strokeWidth="8" strokeLinecap="round" />

            {/* Unlocked Monitor with Payroll Data */}
            <rect x="35" y="90" width="70" height="48" rx="4" fill="#020617" stroke={alertStroke} strokeWidth="1.5" />
            <rect x="38" y="93" width="64" height="42" fill="#1e1b4b" />
            <text x="70" y="110" fill="#cbd5e1" fontSize="6" fontWeight="bold" textAnchor="middle">UNLOCKED PAYROLL</text>
            <text x="70" y="120" fill="#94a3b8" fontSize="5" textAnchor="middle">Employee Salaries Exposed</text>

            {/* Password Post-it Note on Desk */}
            <rect x="135" y="175" width="40" height="28" rx="2" fill="#fef08a" stroke="#ca8a04" strokeWidth="1" transform="rotate(-5 135 175)" />
            <text x="155" y="188" fill="#713f12" fontSize="6" fontWeight="900" textAnchor="middle">PASS:</text>
            <text x="155" y="197" fill="#713f12" fontSize="6" fontWeight="bold" textAnchor="middle">Admin!26</text>

            {/* Rogue Red USB inserted in PC Tower */}
            <rect x="12" y="140" width="16" height="35" rx="3" fill="#020617" stroke="#475569" strokeWidth="1" />
            <rect x="26" y="152" width="12" height="7" rx="1.5" fill={isReveal ? "#ef4444" : "#64748b"} stroke={isReveal ? "#fca5a5" : "#94a3b8"} strokeWidth="1" />

            {/* Speech Bubble from Employee A */}
            <rect x="15" y="24" width="185" height="44" rx="6" fill="#020617" stroke={bubbleBorder} strokeWidth="1.5" />
            <text x="25" y="40" fill={bubbleTitle} fontSize="6.5" fontWeight="bold">Employee A (Sharing Credentials):</text>
            <text x="25" y="52" fill="#ffffff" fontSize="6.5">&ldquo;Take my badge and password,&rdquo;</text>
            <text x="25" y="62" fill={bubbleSub} fontSize="6">&ldquo;approve the invoice while I'm at lunch!&rdquo;</text>

            {/* Speech Bubble from Colleague B */}
            <rect x="210" y="24" width="175" height="44" rx="6" fill="#020617" stroke={bubbleBorder} strokeWidth="1.5" />
            <text x="220" y="40" fill={bubbleTitle} fontSize="6.5" fontWeight="bold">Colleague B (No Badge on Neck):</text>
            <text x="220" y="52" fill="#ffffff" fontSize="6.5">&ldquo;Thanks! I'll log in as you and</text>
            <text x="220" y="62" fill={bubbleSub} fontSize="6">approve it right away.&rdquo;</text>
          </g>
        )}
      </svg>
    );
  }

  // SCENE 2: RESTRICTED SOC & SERVER ROOM DOOR ACCESS
  if (sceneType === 'soc_gate') {
    return (
      <svg viewBox="0 0 400 250" className="w-full h-full select-none font-sans">
        <rect x="0" y="0" width="400" height="250" fill="#0f172a" />
        <rect x="20" y="220" width="360" height="30" fill="#1e293b" />
        
        {/* Door Frame & Header */}
        <rect x="100" y="65" width="180" height="155" fill="#1e293b" stroke="#334155" strokeWidth="3" />
        <text x="190" y="78" fill="#94a3b8" fontSize="7" fontWeight="bold" textAnchor="middle">RESTRICTED SOC & DATA CENTER</text>

        {!isPictureB ? (
          /* SCENARIO A: COMPLIANT BIOMETRIC ENTRY */
          <g>
            <rect x="110" y="85" width="160" height="135" fill="#0f172a" stroke="#475569" strokeWidth="2" />
            <circle cx="190" cy="150" r="4" fill="#38bdf8" />

            {/* Biometric Card Reader */}
            <rect x="290" y="110" width="35" height="50" rx="4" fill="#020617" stroke="#334155" strokeWidth="2" />
            <circle cx="307" cy="130" r="6" fill="#38bdf8" />
            <text x="307" y="148" fill="#94a3b8" fontSize="5" fontWeight="bold" textAnchor="middle">VERIFIED</text>

            {/* Authorized Engineer Scanning */}
            <circle cx="345" cy="120" r="15" fill="#fbcfe8" />
            <ellipse cx="345" cy="170" rx="22" ry="28" fill="#1e3a8a" />

            {/* Speech Bubble from Engineer */}
            <rect x="40" y="16" width="320" height="36" rx="6" fill="#020617" stroke="#475569" strokeWidth="1.5" />
            <text x="55" y="32" fill="#38bdf8" fontSize="7" fontWeight="bold">Security Protocol:</text>
            <text x="55" y="44" fill="#e2e8f0" fontSize="6.5">&ldquo;Please present your photo ID and sign the visitor log before entering the SOC.&rdquo;</text>
          </g>
        ) : (
          /* SCENARIO B: DOOR PROPPED & UNBADGED CONTRACTOR PRETEXTING */
          <g>
            {/* Door Held Open */}
            <polygon points="110,85 175,75 175,205 110,220" fill="#1e293b" stroke={alertStroke} strokeWidth="2" />
            
            {/* Employee holding door */}
            <circle cx="145" cy="115" r="14" fill="#fbcfe8" />
            <ellipse cx="145" cy="165" rx="20" ry="26" fill="#1e40af" />
            <path d="M 160 145 L 175 145" stroke="#fbcfe8" strokeWidth="7" strokeLinecap="round" />

            {/* Unbadged Contractor with Heavy Metal Case */}
            <circle cx="230" cy="115" r="16" fill="#fed7aa" stroke="#fb923c" strokeWidth="1.5" />
            <ellipse cx="230" cy="165" rx="24" ry="28" fill="#475569" />
            <rect x="250" y="160" width="36" height="24" rx="3" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
            <text x="268" y="174" fill="#ffffff" fontSize="5" fontWeight="bold" textAnchor="middle">TOOLCASE</text>

            {/* Door Prop Wedge at Bottom */}
            <polygon points="175,220 205,220 205,208" fill="#eab308" stroke="#ca8a04" strokeWidth="1" />

            {/* Speech Bubble: Contractor Pretexting */}
            <rect x="10" y="14" width="185" height="42" rx="6" fill="#020617" stroke={bubbleBorder} strokeWidth="1.5" />
            <text x="20" y="28" fill={bubbleTitle} fontSize="6.5" fontWeight="bold">Contractor (No Badge):</text>
            <text x="20" y="40" fill="#ffffff" fontSize="6.5">&ldquo;Hold the door! Emergency AC repair,</text>
            <text x="20" y="49" fill={bubbleSub} fontSize="6">no time to badge in or wait!&rdquo;</text>

            {/* Speech Bubble: Employee Holding Door */}
            <rect x="205" y="14" width="185" height="42" rx="6" fill="#020617" stroke={bubbleBorder} strokeWidth="1.5" />
            <text x="215" y="28" fill={bubbleTitle} fontSize="6.5" fontWeight="bold">Employee (Bypassing Scanner):</text>
            <text x="215" y="40" fill="#ffffff" fontSize="6.5">&ldquo;Sure, come right in! I'll hold</text>
            <text x="215" y="49" fill={bubbleSub} fontSize="6">the security door open for you.&rdquo;</text>
          </g>
        )}
      </svg>
    );
  }

  // SCENE 3: CAMPUS SPEED-GATE TURNSTILES TAILGATING
  if (sceneType === 'turnstile_tailgate') {
    return (
      <svg viewBox="0 0 400 250" className="w-full h-full select-none font-sans">
        <rect x="0" y="0" width="400" height="250" fill="#0f172a" />
        <rect x="0" y="170" width="400" height="80" fill="#1e293b" />
        <line x1="30" y1="210" x2="370" y2="210" stroke="#eab308" strokeWidth="2" strokeDasharray="6 3" />

        <rect x="70" y="100" width="40" height="85" rx="4" fill="#334155" stroke="#64748b" strokeWidth="2" />
        <rect x="210" y="100" width="40" height="85" rx="4" fill="#334155" stroke="#64748b" strokeWidth="2" />
        <rect x="350" y="100" width="40" height="85" rx="4" fill="#334155" stroke="#64748b" strokeWidth="2" />

        {!isPictureB ? (
          /* SCENARIO A: COMPLIANT TURNSTILE SWIPING */
          <g>
            <circle cx="150" cy="90" r="16" fill="#fbcfe8" />
            <ellipse cx="150" cy="145" rx="22" ry="28" fill="#1e40af" />
            <rect x="144" y="135" width="12" height="16" rx="2" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="1" />

            <rect x="40" y="20" width="320" height="40" rx="6" fill="#020617" stroke="#475569" strokeWidth="1.5" />
            <text x="55" y="38" fill="#38bdf8" fontSize="7" fontWeight="bold">Access Policy:</text>
            <text x="55" y="50" fill="#e2e8f0" fontSize="6.5">&ldquo;Single-file entry: Each employee must tap their individual badge. Do not hold flaps.&rdquo;</text>
          </g>
        ) : (
          /* SCENARIO B: TAILGATER WITH COFFEE BOX SLIPPING THROUGH */
          <g>
            {/* Person A holding flap */}
            <circle cx="130" cy="90" r="15" fill="#fbcfe8" />
            <ellipse cx="130" cy="140" rx="20" ry="26" fill="#1e40af" />

            {/* Person B Tailgater hiding face behind Coffee Box */}
            <circle cx="180" cy="95" r="16" fill="#fed7aa" />
            <ellipse cx="180" cy="150" rx="22" ry="28" fill="#64748b" />
            <rect x="160" y="90" width="40" height="30" rx="3" fill="#d97706" stroke="#fde047" strokeWidth="1" />
            <text x="180" y="108" fill="#fef08a" fontSize="6" fontWeight="bold" textAnchor="middle">COFFEE</text>

            {/* Speech Bubble from Tailgater */}
            <rect x="10" y="16" width="185" height="42" rx="6" fill="#020617" stroke={bubbleBorder} strokeWidth="1.5" />
            <text x="20" y="30" fill={bubbleTitle} fontSize="6.5" fontWeight="bold">Tailgater (Hiding Face):</text>
            <text x="20" y="42" fill="#ffffff" fontSize="6.5">&ldquo;Hurry, hold the gate! My hands</text>
            <text x="20" y="51" fill={bubbleSub} fontSize="6">are full with coffee cups!&rdquo;</text>

            {/* Speech Bubble from Employee */}
            <rect x="205" y="16" width="185" height="42" rx="6" fill="#020617" stroke={bubbleBorder} strokeWidth="1.5" />
            <text x="215" y="30" fill={bubbleTitle} fontSize="6.5" fontWeight="bold">Employee (Holding Barrier):</text>
            <text x="215" y="42" fill="#ffffff" fontSize="6.5">&ldquo;Hurry through before it closes!</text>
            <text x="215" y="51" fill={bubbleSub} fontSize="6">I've got the flap held for you.&rdquo;</text>
          </g>
        )}
      </svg>
    );
  }

  // SCENE 4: EXECUTIVE CONFERENCE ROOM
  if (sceneType === 'conference_leak') {
    return (
      <svg viewBox="0 0 400 250" className="w-full h-full select-none font-sans">
        <rect x="0" y="0" width="400" height="250" fill="#0f172a" />
        <ellipse cx="200" cy="185" rx="160" ry="40" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <rect x="50" y="25" width="170" height="75" rx="4" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="3" />

        {!isPictureB ? (
          /* SCENARIO A: SANITIZED MEETING ROOM */
          <g>
            <text x="135" y="60" fill="#38bdf8" fontSize="8" fontWeight="900" textAnchor="middle">✓ WHITEBOARD CLEANED</text>
            <text x="135" y="72" fill="#64748b" fontSize="6" textAnchor="middle">Clear Board Policy Enforced</text>
            <rect x="175" y="170" width="50" height="20" rx="3" fill="#020617" stroke="#475569" strokeWidth="1.5" />
            <circle cx="200" cy="190" r="12" fill="#0f172a" stroke="#334155" strokeWidth="2" />
            <text x="200" y="193" fill="#94a3b8" fontSize="4.5" textAnchor="middle">IDLE</text>
          </g>
        ) : (
          /* SCENARIO B: CREDENTIALS ON WHITEBOARD & ACTIVE CALL */
          <g>
            <text x="60" y="42" fill="#1e293b" fontSize="6" fontWeight="900">PROD PASSWORDS & IPS:</text>
            <text x="60" y="54" fill="#0f172a" fontSize="6" fontFamily="monospace">10.240.12.8 - Root</text>
            <text x="60" y="64" fill="#334155" fontSize="6" fontFamily="monospace">DB_PASS: SeAdmin$2026</text>

            {/* Unlocked Laptop with Presentation */}
            <rect x="170" y="150" width="55" height="35" rx="3" fill="#020617" stroke={alertStroke} strokeWidth="1.5" />
            <rect x="173" y="153" width="49" height="28" fill="#1e1b4b" />
            <text x="197" y="168" fill="#cbd5e1" fontSize="5" fontWeight="bold" textAnchor="middle">M&A PROPOSAL</text>

            {/* Active Conference Call */}
            <circle cx="200" cy="195" r="12" fill="#1e1b4b" stroke={alertStroke} strokeWidth="1.5" />
            <text x="200" y="198" fill="#cbd5e1" fontSize="4" fontWeight="bold" textAnchor="middle">LIVE 42m</text>

            {/* Audio Quote Banner */}
            <rect x="235" y="30" width="150" height="42" rx="6" fill="#020617" stroke={bubbleBorder} strokeWidth="1.5" />
            <text x="245" y="45" fill={bubbleTitle} fontSize="6.5" fontWeight="bold">Speakerphone Warning:</text>
            <text x="245" y="56" fill="#ffffff" fontSize="6">&ldquo;Remote bridge line still open,</text>
            <text x="245" y="65" fill={bubbleSub} fontSize="5.5">broadcasting room audio.&rdquo;</text>
          </g>
        )}
      </svg>
    );
  }

  // SCENE 5: PUBLIC CAFE / TRANSIT WORKING
  return (
    <svg viewBox="0 0 400 250" className="w-full h-full select-none font-sans">
      <rect x="0" y="0" width="400" height="250" fill="#0f172a" />
      <rect x="40" y="160" width="320" height="70" fill="#1e293b" stroke="#334155" strokeWidth="2" />

      {/* Worker */}
      <circle cx="160" cy="105" r="16" fill="#fbcfe8" />
      <ellipse cx="160" cy="155" rx="24" ry="26" fill="#1e3a8a" />

      {!isPictureB ? (
        /* SCENARIO A: PRIVACY FILTER & HEADSET */
        <g>
          <rect x="175" y="130" width="60" height="42" rx="3" fill="#020617" stroke="#475569" strokeWidth="2" />
          <text x="205" y="152" fill="#94a3b8" fontSize="5" fontWeight="bold" textAnchor="middle">PRIVACY FILTER</text>

          <rect x="40" y="20" width="320" height="40" rx="6" fill="#020617" stroke="#475569" strokeWidth="1.5" />
          <text x="55" y="38" fill="#38bdf8" fontSize="7" fontWeight="bold">Public Work Standard:</text>
          <text x="55" y="50" fill="#e2e8f0" fontSize="6.5">&ldquo;Privacy screen filter active, noise-canceling headset worn, tethered to secure VPN.&rdquo;</text>
        </g>
      ) : (
        /* SCENARIO B: SPEAKERPHONE CALL & SHOULDER SURFER */
        <g>
          {/* Laptop Screen facing public aisle */}
          <rect x="175" y="130" width="65" height="45" rx="3" fill="#020617" stroke={alertStroke} strokeWidth="2" />
          <rect x="178" y="133" width="59" height="37" fill="#1e1b4b" />
          <text x="207" y="147" fill="#cbd5e1" fontSize="5" fontWeight="bold" textAnchor="middle">CUSTOMER BANK ACC</text>

          {/* Shoulder Surfer behind */}
          <circle cx="210" cy="75" r="16" fill="#475569" fillOpacity="0.5" stroke={alertStroke} strokeWidth="1.5" />
          <ellipse cx="210" cy="110" rx="22" ry="18" fill="#334155" fillOpacity="0.5" />

          {/* Speech Bubble: Loudspeaker Call */}
          <rect x="10" y="16" width="185" height="45" rx="6" fill="#020617" stroke={bubbleBorder} strokeWidth="1.5" />
          <text x="20" y="30" fill={bubbleTitle} fontSize="6.5" fontWeight="bold">Worker on Speakerphone:</text>
          <text x="20" y="42" fill="#ffffff" fontSize="6">&ldquo;Yes, customer account #49201...&rdquo;</text>
          <text x="20" y="52" fill={bubbleSub} fontSize="6">&ldquo;transfer the $500k wire now!&rdquo;</text>

          {/* Speech Bubble: Shoulder Surfer */}
          <rect x="205" y="16" width="185" height="45" rx="6" fill="#020617" stroke={bubbleBorder} strokeWidth="1.5" />
          <text x="215" y="30" fill={bubbleTitle} fontSize="6.5" fontWeight="bold">Passerby (Shoulder Surfing):</text>
          <text x="215" y="42" fill="#ffffff" fontSize="6">&ldquo;Reading customer IBAN off the screen</text>
          <text x="215" y="52" fill={bubbleSub} fontSize="6">and noting down transaction details.&rdquo;</text>
        </g>
      )}
    </svg>
  );
};

/* =========================================================================
   1. SPOT THE DIFFERENCE VISUAL
   ========================================================================= */
export const SpotTheDifferenceVisual: React.FC<{
  visualData?: VisualData | null;
  revealVisual?: RevealVisual | null;
  isReveal?: boolean;
  compact?: boolean;
}> = ({ visualData, revealVisual, isReveal, compact }) => {
  const [activeTab, setActiveTab] = useState<'both' | 'a' | 'b'>(compact ? 'b' : 'both');
  const violations = revealVisual?.violationHighlights || visualData?.violations || [];

  return (
    <div className="w-full bg-slate-900 text-white rounded-2xl overflow-hidden border border-slate-700 shadow-xl">
      {/* Visual Header */}
      <div className="bg-slate-800/90 px-4 py-3 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 font-black text-xs">
            <Search className="w-4 h-4" />
          </span>
          <div>
            <h4 className="text-sm font-black tracking-wide text-white uppercase flex items-center gap-2">
              <span>Security Visual Audit</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-200 border border-slate-600">
                Compare Scenarios
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Inspect Scenario A and Scenario B carefully
            </p>
          </div>
        </div>

        {/* Mobile View Switcher */}
        {compact && (
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-700 text-xs font-bold gap-1">
            <button
              onClick={() => setActiveTab('a')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeTab === 'a' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Scenario A
            </button>
            <button
              onClick={() => setActiveTab('b')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeTab === 'b' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Scenario B
            </button>
            <button
              onClick={() => setActiveTab('both')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeTab === 'both' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Both
            </button>
          </div>
        )}
      </div>

      {/* Main Image Grid / Comparison Area */}
      <div className="p-4 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className={`grid gap-4 ${compact && activeTab !== 'both' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
          
          {/* SCENARIO A */}
          {(!compact || activeTab === 'a' || activeTab === 'both') && (
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-200 border border-slate-700 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                  Scenario A
                </span>
              </div>
              
              <div className="relative w-full aspect-[16/10] bg-slate-950 rounded-xl border-2 border-slate-700 p-3 flex flex-col justify-between overflow-hidden shadow-inner">
                {/* DYNAMIC SCENE SVG: Scenario A */}
                <SceneSvg
                  sceneType={visualData?.sceneType || 'office_delegation'}
                  isPictureB={false}
                  isReveal={isReveal}
                />
              </div>
            </div>
          )}

          {/* SCENARIO B */}
          {(!compact || activeTab === 'b' || activeTab === 'both') && (
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2.5 py-1 rounded-md border text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                  isReveal ? 'bg-red-500/20 text-red-300 border-red-500/40' : 'bg-slate-800 text-slate-200 border-slate-700'
                }`}>
                  Scenario B
                </span>
                <span className="text-[11px] text-slate-400 font-bold">
                  {isReveal ? `${violations.length} Violations Identified!` : 'Audit Details'}
                </span>
              </div>
              
              <div className={`relative w-full aspect-[16/10] bg-slate-950 rounded-xl border-2 p-3 flex flex-col justify-between overflow-hidden shadow-inner transition-colors ${
                isReveal ? 'border-red-500/60 ring-1 ring-red-500/40' : 'border-slate-700'
              }`}>
                {/* DYNAMIC SCENE SVG: Scenario B */}
                <SceneSvg
                  sceneType={visualData?.sceneType || 'office_delegation'}
                  isPictureB={true}
                  isReveal={isReveal}
                />

                {/* REVEAL RADAR PULSE BADGES (Displayed on Scenario B ONLY at Answer Reveal) */}
                {isReveal && violations.map((v) => (
                  <div
                    key={v.id}
                    style={{ left: `${v.x}%`, top: `${v.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group"
                  >
                    <div className="absolute inset-0 w-7 h-7 -left-1 -top-1 rounded-full bg-red-500 animate-ping opacity-75" />
                    <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-tr from-red-600 to-amber-500 text-white font-black text-[11px] shadow-lg border-2 border-white ring-2 ring-red-500/50 cursor-pointer">
                      {v.id}
                    </div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-950 text-white text-[11px] p-2 rounded-lg border border-red-500/60 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                      <p className="font-bold text-amber-300">#{v.id}: {v.title}</p>
                      <p className="text-slate-300 leading-tight mt-0.5">{v.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* VIOLATIONS EXPLANATION BREAKDOWN (Shown on Reveal to Participants & Projector) */}
        {isReveal && violations.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-700/80 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-2.5">
              <h5 className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Security Audit Breakdown • {violations.length} Identified Differences</span>
              </h5>
              <span className="text-[11px] px-2 py-0.5 bg-red-500/20 text-red-300 rounded border border-red-500/40 font-bold">
                Answer: {violations.length} Violations
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {violations.map((v) => (
                <div
                  key={v.id}
                  className="bg-slate-800/80 border border-red-500/30 rounded-xl p-2.5 flex items-start gap-2.5 shadow-sm"
                >
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-red-600 text-white font-black text-xs shadow">
                    {v.id}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white leading-tight truncate">
                      {v.title}
                    </p>
                    <p className="text-[11px] text-slate-400 leading-snug mt-0.5 line-clamp-2">
                      {v.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* =========================================================================
   2. PICTURE PROFILES VISUAL ("Which person is more prone to cyber attack?")
   ========================================================================= */
export const PictureProfilesVisual: React.FC<{
  visualData?: VisualData | null;
  revealVisual?: RevealVisual | null;
  isReveal?: boolean;
  compact?: boolean;
}> = ({ visualData, revealVisual, isReveal, compact }) => {
  const profiles = visualData?.profiles || [];
  const vulnerableId = revealVisual?.vulnerableProfileId;

  return (
    <div className={`w-full bg-slate-900 text-white rounded-2xl overflow-hidden border border-slate-700 shadow-xl ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center justify-between mb-2.5 border-b border-slate-700/80 pb-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 font-black text-xs">
            <Activity className="w-3.5 h-3.5" />
          </span>
          <div>
            <h4 className="text-xs sm:text-sm font-black tracking-wide text-white uppercase flex items-center gap-2">
              <span>Threat Profiling Analysis</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                Inspection Dossier
              </span>
            </h4>
          </div>
        </div>
      </div>

      <div className={`grid gap-2 sm:gap-3 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
        {profiles.map((p, idx) => {
          const isTarget = isReveal && (p.isVulnerable || p.id === vulnerableId);

          return (
            <div
              key={p.id}
              className={`relative rounded-xl ${compact ? 'p-2.5' : 'p-3.5'} border-2 transition-all duration-300 flex flex-col justify-between ${
                isTarget
                  ? 'bg-red-950/50 border-red-500 shadow-lg ring-1 ring-red-500/60'
                  : isReveal
                  ? 'bg-slate-800/40 border-slate-700/60 opacity-60'
                  : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center font-black text-xs shrink-0 ${
                    isTarget ? 'bg-red-600 text-white' : 'bg-slate-700 text-white'
                  }`}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider truncate ${
                    isReveal
                      ? p.riskRating === 'CRITICAL' ? 'bg-red-500/20 text-red-300 border border-red-500/40' :
                        p.riskRating === 'HIGH' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                        'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-700/80 text-slate-300 border border-slate-600'
                  }`}>
                    {isReveal ? `${p.riskRating} RISK` : p.role}
                  </span>
                </div>

                <h5 className={`${compact ? 'text-xs' : 'text-sm'} font-bold text-white mb-1 line-clamp-1`}>{p.label}</h5>
                
                {/* Environmental Metadata */}
                <div className="space-y-1 text-[10px] text-slate-300">
                  <div className="flex items-center gap-1 text-slate-400">
                    <Wifi className="w-3 h-3 text-slate-500 shrink-0" />
                    <span className="truncate">{p.connection}</span>
                  </div>
                  {!compact && (
                    <div className="flex items-center gap-1 text-slate-400">
                      <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">{p.securityControls}</span>
                    </div>
                  )}
                </div>

                {/* Spoken Quote / Statement */}
                {p.quote && (
                  <div className="mt-2.5 p-2 rounded-lg bg-slate-950/75 border border-slate-700/80 text-[11px] text-slate-200 leading-snug">
                    <span className="text-amber-400 font-bold not-italic">💬 Dialogue: </span>
                    <span className="italic text-slate-100">&ldquo;{p.quote}&rdquo;</span>
                  </div>
                )}
              </div>

              {/* Reveal Callout */}
              {isTarget && p.threatCallouts && p.threatCallouts.length > 0 && (
                <div className="mt-2 pt-1.5 border-t border-red-500/40">
                  <p className="text-[9px] font-black text-red-400 uppercase tracking-wide truncate">
                    ⚠️ {p.threatCallouts[0]}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* =========================================================================
   3. MEMORY & VIGILANCE CHECKER VISUAL (MFA Alert Inspection)
   ========================================================================= */
export const MemoryCheckVisual: React.FC<{
  visualData?: VisualData | null;
  revealVisual?: RevealVisual | null;
  isReveal?: boolean;
  compact?: boolean;
}> = ({ visualData, revealVisual, isReveal, compact }) => {
  const alert = visualData?.alertData;
  if (!alert) return null;

  return (
    <div className="w-full bg-slate-900 text-white rounded-2xl overflow-hidden border border-slate-700 shadow-xl p-4">
      <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 font-black text-xs">
            <BellRing className="w-4 h-4" />
          </span>
          <div>
            <h4 className="text-sm font-black tracking-wide text-white uppercase flex items-center gap-2">
              <span>Vigilance & Memory Check</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Observe Details Closely
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Scrutinize the security authentication challenge
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-center py-2">
        {/* Realistic Mobile / Desktop Push Alert Card */}
        <div className="w-full max-w-md bg-slate-950 rounded-2xl border-2 border-slate-700 shadow-2xl overflow-hidden">
          {/* Alert Top Bar */}
          <div className="bg-slate-800/90 px-4 py-3 flex items-center justify-between border-b border-slate-700">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#009639] flex items-center justify-center font-black text-white text-xs">
                SE
              </div>
              <span className="text-xs font-black text-white tracking-wide">
                Schneider Electric • Identity Guard
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">MFA Push</span>
          </div>

          {/* Alert Body */}
          <div className="p-4 space-y-3">
            <div className="text-center pb-2">
              <h5 className="text-sm font-bold text-white">{alert.title}</h5>
              <p className="text-xs text-slate-400">{alert.subtitle}</p>
            </div>

            {/* Key Field Rows */}
            <div className="space-y-2 bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs">
              
              {/* Location (Anomaly) */}
              <div className={`flex items-center justify-between p-2 rounded-lg transition-all ${
                isReveal ? 'bg-red-500/20 border border-red-500/50' : 'bg-slate-950/60'
              }`}>
                <div className="flex items-center gap-2 text-slate-400">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  <span>Request Location:</span>
                </div>
                <span className={`font-mono font-bold ${isReveal ? 'text-red-400 text-sm' : 'text-white'}`}>
                  {alert.location}
                </span>
              </div>

              {/* Time */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60">
                <span className="text-slate-400">Request Time:</span>
                <span className="font-mono text-white">{alert.timestamp}</span>
              </div>

              {/* Device */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60">
                <div className="flex items-center gap-2 text-slate-400">
                  <Smartphone className="w-4 h-4 text-slate-500" />
                  <span>Device & OS:</span>
                </div>
                <span className="font-mono text-white">{alert.device}</span>
              </div>

              {/* Verification Code (Anomaly) */}
              <div className={`flex items-center justify-between p-2 rounded-lg transition-all ${
                isReveal ? 'bg-amber-500/20 border border-amber-500/50' : 'bg-slate-950/60'
              }`}>
                <div className="flex items-center gap-2 text-slate-400">
                  <KeyRound className="w-4 h-4 text-slate-500" />
                  <span>Verification Code:</span>
                </div>
                <span className={`font-mono font-black ${isReveal ? 'text-amber-400 text-base' : 'text-emerald-400 text-sm'}`}>
                  {alert.authCode}
                </span>
              </div>
            </div>

            {/* Simulated Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button disabled className="py-2.5 rounded-xl bg-red-600/90 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow">
                <span>⛔ Deny (Fraud)</span>
              </button>
              <button disabled className="py-2.5 rounded-xl bg-emerald-600/80 text-white font-bold text-xs flex items-center justify-center gap-1.5 opacity-60">
                <span>✓ Approve</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reveal Analysis Banner */}
      {isReveal && (
        <div className="mt-3 p-3 bg-red-950/40 border border-red-500/40 rounded-xl flex items-center gap-3 animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <div className="text-xs">
            <p className="font-black text-red-300 uppercase">MFA Fatigue / Impossible Travel Indicator</p>
            <p className="text-slate-300">
              Notice the location <span className="text-red-400 font-bold">{alert.location}</span> and code <span className="text-amber-300 font-mono font-bold">{alert.authCode}</span>. Prompt received at odd hours indicates compromised credentials!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================================
   4. CYBER CROSSWORD VISUAL
   ========================================================================= */
export const CrosswordVisual: React.FC<{
  visualData?: VisualData | null;
  revealVisual?: RevealVisual | null;
  isReveal?: boolean;
  compact?: boolean;
}> = ({ visualData, revealVisual, isReveal, compact }) => {
  const cw = visualData?.crosswordData;
  if (!cw) return null;

  const word = cw.solutionWord.toUpperCase();
  const letters = word.split('');
  const revealedIndices = new Set(cw.revealedIndices || []);

  return (
    <div className="w-full bg-slate-900 text-white rounded-2xl overflow-hidden border border-slate-700 shadow-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black text-xs">
            <Layers className="w-4 h-4" />
          </span>
          <div>
            <h4 className="text-sm font-black tracking-wide text-white uppercase flex items-center gap-2">
              <span>Cyber Crossword Puzzle</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {cw.clueNumber}-{cw.direction} ({cw.length} Letters)
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Fill the missing letters from the clue description
            </p>
          </div>
        </div>
      </div>

      {/* Clue Card */}
      <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 mb-4 flex items-start gap-3">
        <div className="px-2.5 py-1 rounded bg-[#009639] text-white font-mono font-black text-xs shrink-0">
          {cw.clueNumber}
        </div>
        <p className="text-xs md:text-sm text-slate-200 font-medium leading-relaxed">
          <strong className="text-emerald-400 font-bold">{cw.clueNumber}-{cw.direction}: </strong>
          {cw.clue}
        </p>
      </div>

      {/* Graphical Tile Grid */}
      <div className="flex flex-col items-center justify-center py-2">
        <div className="flex flex-wrap justify-center gap-1.5 md:gap-2 max-w-full">
          {letters.map((letter, idx) => {
            const isInitiallyShown = revealedIndices.has(idx);
            const showLetter = isInitiallyShown || isReveal;
            
            return (
              <div
                key={idx}
                className={`relative flex flex-col items-center justify-center ${
                  compact ? 'w-6 h-8 sm:w-7 sm:h-9 text-[11px] sm:text-xs' : 'w-8 h-10 md:w-11 md:h-14 text-sm md:text-xl'
                } rounded-lg font-mono font-black border-2 transition-all duration-500 shadow-md ${
                  isReveal && !isInitiallyShown
                    ? 'bg-emerald-600 text-white border-emerald-400 animate-bounce scale-105'
                    : isInitiallyShown
                    ? 'bg-slate-800 text-slate-200 border-slate-600'
                    : 'bg-slate-950 text-slate-700 border-dashed border-slate-700'
                }`}
              >
                <span className="absolute top-0.5 left-1 text-[8px] font-sans font-bold text-slate-500 leading-none">
                  {idx + 1}
                </span>
                <span>{showLetter ? letter : ''}</span>
              </div>
            );
          })}
        </div>

        {/* Reveal Badge */}
        {isReveal && (
          <div className="mt-4 px-4 py-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl flex items-center gap-2 text-emerald-300 text-xs font-bold animate-in fade-in">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Solved: <strong className="font-mono text-white text-sm">{cw.solutionWord}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
};

/* =========================================================================
   5. FILL IN THE BLANK VISUAL
   ========================================================================= */
export const FillInTheBlankVisual: React.FC<{
  visualData?: VisualData | null;
  revealVisual?: RevealVisual | null;
  isReveal?: boolean;
  compact?: boolean;
}> = ({ visualData, revealVisual, isReveal, compact }) => {
  const fb = visualData?.fillBlankData;
  if (!fb) return null;

  return (
    <div className="w-full bg-slate-900 text-white rounded-2xl overflow-hidden border border-slate-700 shadow-xl">
      {/* Header */}
      <div className="bg-slate-800/90 px-4 py-3 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black text-xs">
            <FileText className="w-4 h-4" />
          </span>
          <div>
            <h4 className="text-sm font-black tracking-wide text-white uppercase flex items-center gap-2">
              <span>Cyber Knowledge</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Fill in the Blank
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              {fb.contextBadge || 'Select the missing cybersecurity concept from the options below'}
            </p>
          </div>
        </div>
      </div>

      {/* Body: Sentence Terminal View */}
      <div className="p-5 sm:p-6 bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col items-center justify-center">
        <div className="max-w-2xl w-full p-4 sm:p-5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 text-sm sm:text-base leading-relaxed text-center font-medium shadow-inner">
          <span>{fb.sentenceBefore || fb.prefixText}</span>
          <span className={`inline-flex items-center px-3 py-1 mx-1.5 rounded-lg border font-bold text-xs sm:text-sm tracking-wide transition-all ${
            isReveal && (fb.correctAnswerText || revealVisual?.fillBlankAnswer)
              ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400 ring-2 ring-emerald-500/50 scale-105'
              : 'bg-amber-500/10 text-amber-300 border-dashed border-amber-400/60 animate-pulse'
          }`}>
            {isReveal && (fb.correctAnswerText || revealVisual?.fillBlankAnswer) ? (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{fb.correctAnswerText || revealVisual?.fillBlankAnswer}</span>
              </span>
            ) : (
              <span>[ ? ? ? ]</span>
            )}
          </span>
          <span>{fb.sentenceAfter || fb.suffixText}</span>
        </div>

        {isReveal && (fb.correctAnswerText || revealVisual?.fillBlankAnswer) && (
          <div className="mt-4 px-4 py-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl flex items-center gap-2 text-emerald-300 text-xs font-bold animate-in fade-in">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Completed: <strong className="text-white">{fb.correctAnswerText || revealVisual?.fillBlankAnswer}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
};

/* =========================================================================
   6. RIDDLE VISUAL
   ========================================================================= */
export const RiddleVisual: React.FC<{
  visualData?: VisualData | null;
  revealVisual?: RevealVisual | null;
  isReveal?: boolean;
  compact?: boolean;
}> = ({ visualData, revealVisual, isReveal, compact }) => {
  const rd = visualData?.riddleData;
  if (!rd) return null;

  return (
    <div className="w-full bg-slate-900 text-white rounded-2xl overflow-hidden border border-slate-700 shadow-xl">
      {/* Header */}
      <div className="bg-slate-800/90 px-4 py-3 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 font-black text-xs">
            <HelpCircle className="w-4 h-4" />
          </span>
          <div>
            <h4 className="text-sm font-black tracking-wide text-white uppercase flex items-center gap-2">
              <span>Cyber Enigma</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {rd.enigmaTag || 'Cyber Threat Riddle'}
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Analyze the clues and deduce the hidden cybersecurity entity
            </p>
          </div>
        </div>
      </div>

      {/* Body: Mystery Parchment / Terminal Card */}
      <div className="p-5 sm:p-6 bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col items-center justify-center">
        <div className="max-w-xl w-full p-4 sm:p-5 rounded-xl bg-purple-950/20 border border-purple-800/40 text-center shadow-inner relative overflow-hidden">
          <div className="absolute top-2 right-2 text-purple-600/30">
            <Lock className="w-12 h-12" />
          </div>
          <p className="text-sm sm:text-base text-purple-200 italic leading-relaxed font-serif relative z-10">
            &ldquo;{rd.riddleText}&rdquo;
          </p>
          {rd.hint && (
            <p className="mt-3 text-[11px] text-purple-400/80 font-mono">
              Clue: {rd.hint}
            </p>
          )}
        </div>

        {isReveal && (
          <div className="mt-4 px-4 py-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl flex items-center gap-2 text-emerald-300 text-xs font-bold animate-in fade-in">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{rd.decodedTitle || 'Enigma Decoded'} — <span className="text-slate-300 font-normal">{revealVisual?.vulnerabilitySummary}</span></span>
          </div>
        )}
      </div>
    </div>
  );
};

/* =========================================================================
   MAIN ROUTER COMPONENT
   ========================================================================= */
export const InteractiveQuestionVisual: React.FC<Props> = ({
  type,
  visualData,
  revealVisual,
  isReveal = false,
  compact = false
}) => {
  const effectiveType = type || visualData?.type;

  switch (effectiveType) {
    case 'spot_the_difference':
      return (
        <SpotTheDifferenceVisual
          visualData={visualData}
          revealVisual={revealVisual}
          isReveal={isReveal}
          compact={compact}
        />
      );

    case 'picture_base':
    case 'picture_mcq':
      return (
        <PictureProfilesVisual
          visualData={visualData}
          revealVisual={revealVisual}
          isReveal={isReveal}
          compact={compact}
        />
      );

    case 'memory_check':
      return (
        <MemoryCheckVisual
          visualData={visualData}
          revealVisual={revealVisual}
          isReveal={isReveal}
          compact={compact}
        />
      );

    case 'crossword':
      return (
        <CrosswordVisual
          visualData={visualData}
          revealVisual={revealVisual}
          isReveal={isReveal}
          compact={compact}
        />
      );

    case 'fill_in_the_blank':
      return (
        <FillInTheBlankVisual
          visualData={visualData}
          revealVisual={revealVisual}
          isReveal={isReveal}
          compact={compact}
        />
      );

    case 'riddle':
      return (
        <RiddleVisual
          visualData={visualData}
          revealVisual={revealVisual}
          isReveal={isReveal}
          compact={compact}
        />
      );

    default:
      return null;
  }
};

export default InteractiveQuestionVisual;
