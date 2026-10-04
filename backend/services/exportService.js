const ExcelJS = require('exceljs');

/**
 * Generate comprehensive Excel workbook for room tournament results
 * @param {Object} data - { room, quiz, participants, submissions }
 * @returns {Promise<Buffer>}
 */
async function generateRoomReportExcel({ room, quiz, participants = [], submissions = [] }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LearnUp Live Arena';
  workbook.lastModifiedBy = 'Tournament Controller';
  workbook.created = new Date();
  workbook.modified = new Date();

  // 1. Overall Team Leaderboard Sheet
  const sheetSummary = workbook.addWorksheet('Leaderboard & Final Standings', {
    properties: { tabColor: { argb: 'FF10B981' } },
    views: [{ state: 'frozen', ySplit: 4 }]
  });

  // Title styling
  sheetSummary.mergeCells('A1:H1');
  const titleCell = sheetSummary.getCell('A1');
  titleCell.value = `${quiz?.title || 'Tournament'} — Official Results (Room PIN: ${room.pin})`;
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A0F1D' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheetSummary.getRow(1).height = 36;

  sheetSummary.mergeCells('A2:H2');
  const subCell = sheetSummary.getCell('A2');
  subCell.value = `Exported at: ${new Date().toLocaleString()} | Total Teams: ${participants.length} | Status: ${room.status}`;
  subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FFCBD5E1' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF131D31' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheetSummary.getRow(2).height = 22;

  // Header Row
  const headers = [
    'Rank',
    'Team Name',
    'Institution / College',
    'Captain Name',
    'Total Score',
    'Accuracy (%)',
    'Correct Answers',
    'Avg Response Time (s)'
  ];

  const headerRow = sheetSummary.getRow(4);
  headerRow.values = headers;
  headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2B45' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 26;

  // Sort participants by score descending
  const sorted = [...participants].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));

  sorted.forEach((p, idx) => {
    const totalAns = (p.correctAnswersCount || 0) + (p.incorrectAnswersCount || 0);
    const accuracy = totalAns > 0 ? Math.round(((p.correctAnswersCount || 0) / totalAns) * 100) : 0;
    const avgSec = p.averageResponseTimeMs ? (p.averageResponseTimeMs / 1000).toFixed(2) : '0.00';

    const row = sheetSummary.addRow([
      idx + 1,
      p.teamName,
      p.institution,
      p.captainName,
      p.totalScore || 0,
      `${accuracy}%`,
      p.correctAnswersCount || 0,
      avgSec
    ]);

    row.height = 22;
    row.alignment = { vertical: 'middle' };

    // Highlight podium
    if (idx === 0) {
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFACC15' } }; // Gold
      row.getCell(2).font = { bold: true };
    } else if (idx === 1) {
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCBD5E1' } }; // Silver
    } else if (idx === 2) {
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF97316' } }; // Bronze
    }
  });

  sheetSummary.columns = [
    { width: 10 },
    { width: 28 },
    { width: 32 },
    { width: 22 },
    { width: 15 },
    { width: 15 },
    { width: 18 },
    { width: 24 },
  ];

  // 2. Question Details Sheet
  if (quiz?.questions && quiz.questions.length > 0) {
    const qSheet = workbook.addWorksheet('Question Breakdown');
    qSheet.addRow(['Q#', 'Segment', 'Question Text', 'Time Limit (s)', 'Points', 'Correct Option']);
    qSheet.getRow(1).font = { bold: true };

    quiz.questions.forEach((q, idx) => {
      const correctOpt = q.options?.find(o => o.isCorrect)?.text || 'N/A';
      qSheet.addRow([
        idx + 1,
        q.segment || 'GENERAL',
        q.questionText,
        q.timeLimitSec,
        q.points,
        correctOpt
      ]);
    });

    qSheet.columns = [
      { width: 8 },
      { width: 20 },
      { width: 50 },
      { width: 15 },
      { width: 12 },
      { width: 30 }
    ];
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

module.exports = {
  generateRoomReportExcel
};
