import { jsPDF } from 'jspdf';

export interface LeaderboardParticipant {
  rank?: number;
  badgeNumber?: string | number;
  name?: string;
  score?: number;
  correctCount?: number;
  wrongCount?: number;
  attemptedCount?: number;
  totalTimeFormatted?: string;
  tieBrokenByTime?: boolean;
}

export interface PDFReportData {
  roomPin: string;
  eventName?: string;
  exportedAt?: string;
  grandChampion?: {
    name?: string;
    badgeNumber?: string | number;
    score?: number;
    correctCount?: number;
    totalTimeFormatted?: string;
  } | null;
  top3?: LeaderboardParticipant[];
  participants: LeaderboardParticipant[];
}

export function generateLeaderboardPDF(data: PDFReportData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  const participants = data.participants || [];
  const roomPin = data.roomPin || 'ROOM';
  const exportDate = data.exportedAt || new Date().toLocaleString();
  const grandChamp = data.grandChampion || data.top3?.[0] || participants[0];

  // Brand Palette (Schneider Electric & Cyber Green)
  const brandGreen = [0, 150, 57]; // #009639
  const darkSlate = [15, 23, 42]; // #0F172A
  const mutedSlate = [100, 116, 139]; // #64748B
  const borderSlate = [226, 232, 240]; // #E2E8F0
  const zebraBg = [248, 250, 252]; // #F8FAFC
  const goldBg = [254, 243, 199]; // #FEF3C7
  const goldBorder = [245, 158, 11]; // #F59E0B
  const goldText = [180, 83, 9]; // #B45309

  // Helper: Draw Running Header (for page 2 onwards)
  const drawCompactHeader = (pageNum: number) => {
    // Top Brand Bar
    doc.setFillColor(brandGreen[0], brandGreen[1], brandGreen[2]);
    doc.rect(0, 0, pageWidth, 4, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(brandGreen[0], brandGreen[1], brandGreen[2]);
    doc.text('SCHNEIDER ELECTRIC • CYBER SECURITY AWARENESS', margin, 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(mutedSlate[0], mutedSlate[1], mutedSlate[2]);
    doc.text(`Cyber Day 2026 • Official Leaderboard • PIN: ${roomPin}`, margin, 14);

    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, 17, pageWidth - margin, 17);
  };

  // Helper: Draw Running Footer on All Pages
  const drawFooter = (pageNum: number, totalPages: number) => {
    const footerY = pageHeight - 8;
    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(mutedSlate[0], mutedSlate[1], mutedSlate[2]);
    doc.text(
      'Schneider Electric • CCSH OT SOC MSSP • Cyber Day 2026 Official Tournament Report',
      margin,
      footerY + 1
    );

    const pageStr = `Page ${pageNum} of ${totalPages}`;
    doc.text(pageStr, pageWidth - margin, footerY + 1, { align: 'right' });
  };

  // -------------------------------------------------------------
  // PAGE 1: FULL HERO HEADER + TOP 3 SUMMARY + TABLE START
  // -------------------------------------------------------------

  // Top Accent Bar
  doc.setFillColor(brandGreen[0], brandGreen[1], brandGreen[2]);
  doc.rect(0, 0, pageWidth, 5, 'F');

  // Brand Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(brandGreen[0], brandGreen[1], brandGreen[2]);
  doc.text('SCHNEIDER ELECTRIC', margin, 13);

  // Main Event Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text('Cyber Day 2026', margin, 21);

  // Subtitle / Tagline
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(brandGreen[0], brandGreen[1], brandGreen[2]);
  doc.text('BEYOND COMPLIANCE , ENABLING BUSINESS.', margin, 26.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(mutedSlate[0], mutedSlate[1], mutedSlate[2]);
  doc.text(`Generated on: ${exportDate} • Total Active Participants: ${participants.length}`, margin, 31);

  // Room PIN Box on Top Right
  const pinBoxW = 48;
  const pinBoxH = 19;
  const pinBoxX = pageWidth - margin - pinBoxW;
  const pinBoxY = 11;

  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(brandGreen[0], brandGreen[1], brandGreen[2]);
  doc.setLineWidth(0.5);
  doc.roundedRect(pinBoxX, pinBoxY, pinBoxW, pinBoxH, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(brandGreen[0], brandGreen[1], brandGreen[2]);
  doc.text('ROOM PIN', pinBoxX + pinBoxW / 2, pinBoxY + 5.5, { align: 'center' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text(roomPin, pinBoxX + pinBoxW / 2, pinBoxY + 13.5, { align: 'center' });

  // Top 3 Podium Highlights Banner
  const podiumY = 36;
  const podiumH = 26;

  // Outer container
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, podiumY, contentWidth, podiumH, 2.5, 2.5, 'FD');

  const colW = contentWidth / 3;

  // 1st Place (Grand Champion)
  const champ = grandChamp;
  doc.setFillColor(goldBg[0], goldBg[1], goldBg[2]);
  doc.setDrawColor(goldBorder[0], goldBorder[1], goldBorder[2]);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin + 2, podiumY + 2, colW - 3, podiumH - 4, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(goldText[0], goldText[1], goldText[2]);
  doc.text('★ 1ST PLACE - GRAND CHAMPION ★', margin + 2 + (colW - 3) / 2, podiumY + 7, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  const champName = (champ?.name || 'TBD').substring(0, 24);
  doc.text(champName, margin + 2 + (colW - 3) / 2, podiumY + 13, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(brandGreen[0], brandGreen[1], brandGreen[2]);
  const champScore = `${champ?.score ?? 0} pts`;
  const champStats = champ?.badgeNumber ? `#${champ.badgeNumber} • ${champScore}` : champScore;
  doc.text(champStats, margin + 2 + (colW - 3) / 2, podiumY + 18, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(mutedSlate[0], mutedSlate[1], mutedSlate[2]);
  doc.text(`${champ?.correctCount ?? 0} Correct • ${champ?.totalTimeFormatted || '--'}`, margin + 2 + (colW - 3) / 2, podiumY + 22, { align: 'center' });

  // 2nd Place
  const runner1 = data.top3?.[1] || participants[1];
  const col2X = margin + colW + 1;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
  doc.setLineWidth(0.4);
  doc.roundedRect(col2X, podiumY + 2, colW - 2, podiumH - 4, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('★ 2ND PLACE - 1ST RUNNER UP ★', col2X + (colW - 2) / 2, podiumY + 7, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  const r1Name = (runner1?.name || 'TBD').substring(0, 24);
  doc.text(r1Name, col2X + (colW - 2) / 2, podiumY + 13, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  const r1Score = `${runner1?.score ?? 0} pts`;
  const r1Stats = runner1?.badgeNumber ? `#${runner1.badgeNumber} • ${r1Score}` : r1Score;
  doc.text(r1Stats, col2X + (colW - 2) / 2, podiumY + 18, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(mutedSlate[0], mutedSlate[1], mutedSlate[2]);
  doc.text(`${runner1?.correctCount ?? 0} Correct • ${runner1?.totalTimeFormatted || '--'}`, col2X + (colW - 2) / 2, podiumY + 22, { align: 'center' });

  // 3rd Place
  const runner2 = data.top3?.[2] || participants[2];
  const col3X = margin + colW * 2 + 1;
  doc.setFillColor(254, 247, 237);
  doc.setDrawColor(254, 215, 170);
  doc.setLineWidth(0.4);
  doc.roundedRect(col3X, podiumY + 2, colW - 3, podiumH - 4, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(194, 65, 12);
  doc.text('★ 3RD PLACE - 2ND RUNNER UP ★', col3X + (colW - 3) / 2, podiumY + 7, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  const r2Name = (runner2?.name || 'TBD').substring(0, 24);
  doc.text(r2Name, col3X + (colW - 3) / 2, podiumY + 13, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  const r2Score = `${runner2?.score ?? 0} pts`;
  const r2Stats = runner2?.badgeNumber ? `#${runner2.badgeNumber} • ${r2Score}` : r2Score;
  doc.text(r2Stats, col3X + (colW - 3) / 2, podiumY + 18, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(mutedSlate[0], mutedSlate[1], mutedSlate[2]);
  doc.text(`${runner2?.correctCount ?? 0} Correct • ${runner2?.totalTimeFormatted || '--'}`, col3X + (colW - 3) / 2, podiumY + 22, { align: 'center' });

  // -------------------------------------------------------------
  // TABLE SETUP & COLUMN DEFINITIONS
  // Total width: 182mm
  // -------------------------------------------------------------
  const columns = [
    { header: 'RANK', width: 15, align: 'center' },
    { header: 'BADGE #', width: 20, align: 'center' },
    { header: 'PARTICIPANT NAME', width: 55, align: 'left' },
    { header: 'SCORE', width: 22, align: 'right' },
    { header: 'CORRECT', width: 18, align: 'center' },
    { header: 'WRONG', width: 16, align: 'center' },
    { header: 'TIME (S)', width: 18, align: 'right' },
    { header: 'TIE-BREAKER', width: 18, align: 'center' }
  ];

  const rowHeight = 7.2;
  const tableHeaderHeight = 8;
  const bottomThreshold = pageHeight - 16; // Stop drawing before footer

  const drawTableHeader = (y: number) => {
    doc.setFillColor(brandGreen[0], brandGreen[1], brandGreen[2]);
    doc.rect(margin, y, contentWidth, tableHeaderHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    let curX = margin;
    columns.forEach((col) => {
      let textX = curX + col.width / 2;
      if (col.align === 'left') textX = curX + 2;
      if (col.align === 'right') textX = curX + col.width - 2;

      doc.text(col.header, textX, y + 5.2, { align: col.align as any });
      curX += col.width;
    });

    return y + tableHeaderHeight;
  };

  let currentY = podiumY + podiumH + 6;
  currentY = drawTableHeader(currentY);

  // Iterate over participants and render rows
  participants.forEach((p, idx) => {
    // Check if we need to break to the next page
    if (currentY + rowHeight > bottomThreshold) {
      doc.addPage();
      drawCompactHeader(doc.getNumberOfPages());
      currentY = 22;
      currentY = drawTableHeader(currentY);
    }

    const rank = p.rank || (idx + 1);
    const isFirst = rank === 1;
    const isSecond = rank === 2;
    const isThird = rank === 3;
    const isEven = idx % 2 === 0;

    // Row Background
    if (isFirst) {
      doc.setFillColor(254, 249, 195); // yellow-100
    } else if (isSecond) {
      doc.setFillColor(241, 245, 249); // slate-100
    } else if (isThird) {
      doc.setFillColor(254, 243, 199); // amber-100
    } else if (isEven) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(zebraBg[0], zebraBg[1], zebraBg[2]);
    }
    doc.rect(margin, currentY, contentWidth, rowHeight, 'F');

    // Bottom border for row
    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.setLineWidth(0.2);
    doc.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight);

    // Row values
    const rankStr = isFirst ? '🥇 #1' : isSecond ? '🥈 #2' : isThird ? '🥉 #3' : `#${rank}`;
    const badgeStr = p.badgeNumber ? `#${p.badgeNumber}` : '-';
    const nameStr = (p.name || 'Anonymous').substring(0, 30);
    const scoreStr = `${p.score ?? 0} pts`;
    const correctStr = String(p.correctCount ?? 0);
    const wrongCount = p.wrongCount ?? (p.attemptedCount !== undefined ? Math.max(0, p.attemptedCount - (p.correctCount ?? 0)) : 0);
    const wrongStr = String(wrongCount);
    const timeStr = p.totalTimeFormatted || '--';
    const tieStr = p.tieBrokenByTime ? 'Faster' : '-';

    const rowValues = [
      { text: rankStr, align: 'center', bold: isFirst || isSecond || isThird, color: isFirst ? goldText : isSecond ? [51, 65, 85] : isThird ? [194, 65, 12] : darkSlate },
      { text: badgeStr, align: 'center', bold: false, color: mutedSlate },
      { text: nameStr, align: 'left', bold: isFirst || isSecond || isThird, color: darkSlate },
      { text: scoreStr, align: 'right', bold: true, color: brandGreen },
      { text: correctStr, align: 'center', bold: true, color: [22, 101, 52] }, // emerald-800
      { text: wrongStr, align: 'center', bold: false, color: [220, 38, 38] }, // red-600
      { text: timeStr, align: 'right', bold: false, color: mutedSlate },
      { text: tieStr, align: 'center', bold: p.tieBrokenByTime, color: p.tieBrokenByTime ? [37, 99, 235] : mutedSlate }
    ];

    let cellX = margin;
    columns.forEach((col, colIdx) => {
      const val = rowValues[colIdx];
      doc.setFont('helvetica', val.bold ? 'bold' : 'normal');
      doc.setFontSize(8);
      doc.setTextColor(val.color[0], val.color[1], val.color[2]);

      let textX = cellX + col.width / 2;
      if (col.align === 'left') textX = cellX + 2;
      if (col.align === 'right') textX = cellX + col.width - 2;

      doc.text(val.text, textX, currentY + 4.8, { align: col.align as any });
      cellX += col.width;
    });

    currentY += rowHeight;
  });

  // Table Outer Frame
  doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
  doc.setLineWidth(0.4);

  // Apply footers with accurate total page count
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(p, totalPages);
  }

  // Trigger Save / Download
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `SE_Cyber_Security_Awareness_Leaderboard_${roomPin}_${timestamp}.pdf`;
  doc.save(filename);
}
