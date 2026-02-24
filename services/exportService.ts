
import { Dispatch, ScanRecord, PartSummary } from '../types';
// @ts-ignore
import ExcelJS from 'https://esm.sh/exceljs';

export interface ExportResult {
  fileName: string;
  blob: Blob;
  mimeType: string;
  simulatedPath: string;
}

export async function generateExports(dispatch: Dispatch, scans: ScanRecord[], summaries: PartSummary[]): Promise<{ pdf: ExportResult, excel: ExportResult }> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Packing Slip');

  // Page Setup for standard A4 - exact dimensions for printing
  sheet.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.25, right: 0.25, top: 0.25, bottom: 0.25, header: 0, footer: 0 }
  };

  // 6-column layout matching the table headers in the provided sample
  sheet.columns = [
    { width: 8 },   // A: Sr no.
    { width: 16 },  // B: PART NO
    { width: 32 },  // C: PART NAME
    { width: 15 },  // D: BOX DISP QTY
    { width: 15 },  // E: TOTAL QTY
    { width: 18 }   // F: DISP. EXE. SIGN.
  ];

  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
  };

  const centerMiddle: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle' };
  const leftMiddle: Partial<ExcelJS.Alignment> = { horizontal: 'left', vertical: 'middle', indent: 1 };

  // --- HEADER SECTION ---
  const headerRow = sheet.addRow(['RADIANCE POLYMERS']);
  sheet.mergeCells('A1:F1');
  headerRow.height = 32;
  headerRow.getCell(1).font = { size: 18, bold: true };
  headerRow.getCell(1).alignment = centerMiddle;
  headerRow.getCell(1).border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

  const addrRow1 = sheet.addRow(['Plot No. 149/1, Sector No. 7, PCNTDA, Bhosari, Pune - 411 026. Maharashtra (INDIA).']);
  sheet.mergeCells('A2:F2');
  addrRow1.getCell(1).alignment = centerMiddle;
  addrRow1.getCell(1).font = { size: 9 };
  addrRow1.getCell(1).border = { left: { style: 'thin' }, right: { style: 'thin' } };

  const addrRow2 = sheet.addRow(['Mob No. 9225538612, Email: moulding.radiance@gmail.com']);
  sheet.mergeCells('A3:F3');
  addrRow2.getCell(1).alignment = centerMiddle;
  addrRow2.getCell(1).font = { size: 9 };
  addrRow2.getCell(1).border = { left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };

  // --- DOCUMENT TITLE ---
  const titleRow = sheet.addRow(['Delivery challan cum Packing Slip']);
  sheet.mergeCells('A4:F4');
  titleRow.height = 20;
  titleRow.getCell(1).font = { size: 11, bold: true };
  titleRow.getCell(1).alignment = centerMiddle;
  titleRow.getCell(1).border = borderThin;

  // --- INFO GRID (Mapping exactly to Screenshot 2) ---
  const now = new Date(dispatch.start_time);
  const dateStr = now.toLocaleDateString('en-GB');
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const dispId = dispatch.dispatch_id.startsWith('DRAFT-') ? '' : dispatch.dispatch_id;

  const infoRows = [
    [`PARTY NAME : ${dispatch.customer_name}`, `DISP. EXE : ${dispatch.operator_id}`],
    [`DRIVER : ${dispatch.driver_name}`, `DATE : ${dateStr}`],
    [`DRIVER MOB NO : ${dispatch.driver_mobile}`, `TIME : ${timeStr}`],
    [`VEHICLE NO : ${dispatch.vehicle_no}`, `LOCATION:`],
    [`LR NO : ${dispatch.lr_no}`, `TRANSPORT:`],
    [`INVOICE NO:`, `DISP. ID : ${dispId}`]
  ];

  infoRows.forEach((rowData) => {
    const row = sheet.addRow([rowData[0], '', '', rowData[1], '', '']);
    sheet.mergeCells(`A${row.number}:C${row.number}`);
    sheet.mergeCells(`D${row.number}:F${row.number}`);
    row.height = 22;
    row.getCell(1).font = { size: 9, bold: true };
    row.getCell(1).alignment = leftMiddle;
    row.getCell(1).border = borderThin;
    row.getCell(4).font = { size: 9, bold: true };
    row.getCell(4).alignment = leftMiddle;
    row.getCell(4).border = borderThin;
    // Fill empty cells with borders for visual consistency
    row.eachCell({ includeEmpty: true }, (cell) => cell.border = borderThin);
  });

  sheet.addRow([]); // Blank spacer row

  // --- TABLE HEADER ---
  const tblHeader = sheet.addRow(['Sr no.', 'PART NO', 'PART NAME', 'BOX DISP QTY', 'TOTAL QTY', 'DISP. EXE. SIGN.']);
  tblHeader.height = 24;
  tblHeader.eachCell((cell) => {
    cell.font = { size: 8, bold: true };
    cell.alignment = centerMiddle;
    cell.border = borderThin;
  });

  // --- TABLE CONTENT ---
  summaries.forEach((s, index) => {
    const row = sheet.addRow([index + 1, s.part_no, s.part_name, s.boxes, s.total_qty, '']);
    row.height = 24;
    row.eachCell((cell, colNum) => {
      cell.border = borderThin;
      cell.font = { size: 9 };
      cell.alignment = (colNum === 2 || colNum === 3) ? leftMiddle : centerMiddle;
    });
  });

  // Maintain form length with empty rows (as per visual sample)
  const minRows = 16;
  const currentRows = summaries.length;
  if (currentRows < minRows) {
    for (let i = 0; i < (minRows - currentRows); i++) {
        const emptyRow = sheet.addRow(['', '', '', '', '', '']);
        emptyRow.height = 24;
        emptyRow.eachCell({ includeEmpty: true }, (cell) => cell.border = borderThin);
    }
  }

  // --- TOTALS ROW ---
  const totalBoxes = summaries.reduce((acc, s) => acc + s.boxes, 0);
  const totalQty = summaries.reduce((acc, s) => acc + s.total_qty, 0);
  const footerRow = sheet.addRow(['', '', 'TOTAL', totalBoxes, totalQty, '']);
  sheet.mergeCells(`A${footerRow.number}:B${footerRow.number}`);
  footerRow.height = 28;
  footerRow.eachCell((cell) => {
    cell.font = { size: 10, bold: true };
    cell.border = borderThin;
    cell.alignment = centerMiddle;
  });

  // --- SIGNATURE SECTION (INV CREATER vs DRIVER SIGN) ---
  const signRow = sheet.addRow(['INV CREATER NAME & SIGN :', '', '', 'DRIVER SIGN :', '', '']);
  sheet.mergeCells(`A${signRow.number}:C${signRow.number + 2}`); // Span 3 rows for sign space
  sheet.mergeCells(`D${signRow.number}:F${signRow.number + 2}`);
  
  signRow.height = 22;
  const c1 = signRow.getCell(1);
  c1.font = { size: 9, bold: true };
  c1.alignment = { horizontal: 'left', vertical: 'top', indent: 1 };
  
  const c4 = signRow.getCell(4);
  c4.font = { size: 9, bold: true };
  c4.alignment = { horizontal: 'left', vertical: 'top', indent: 1 };

  // Manual border application for the sign box rows
  for (let i = 0; i < 3; i++) {
    const r = sheet.getRow(signRow.number + i);
    if (i > 0) r.height = 22;
    r.eachCell({ includeEmpty: true }, (cell) => cell.border = borderThin);
  }

  // Final buffer generation
  const buffer = await workbook.xlsx.writeBuffer();
  const excelBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  return {
    pdf: { fileName: `PackingSlip_${dispatch.customer_name}.pdf`, blob: new Blob([]), mimeType: 'application/pdf', simulatedPath: '' },
    excel: { fileName: `PackingSlip_${dispatch.customer_name.replace(/\W/g, '')}.xlsx`, blob: excelBlob, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', simulatedPath: '' }
  };
}

export function triggerDownload(result: ExportResult) {
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', result.fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function shareFile(result: ExportResult) {
  if (navigator.share) {
    try {
      const file = new File([result.blob], result.fileName, { type: result.mimeType });
      await navigator.share({ files: [file], title: 'Packing Slip', text: `Packing Slip for ${result.fileName}` });
      return true;
    } catch { return false; }
  }
  return false;
}
