
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
  console.log("Generating simple report for:", dispatch.dispatch_id);
  
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Packing Slip');

  sheet.pageSetup = {
    paperSize: 9, // A4
    orientation: 'portrait',
    fitToPage: false,
    scale: 100,
    horizontalCentered: true,
    margins: { left: 0.315, right: 0.315, top: 0.315, bottom: 0.315, header: 0.3, footer: 0.3 }
  };

  sheet.columns = [
    { width: 10 }, { width: 17 }, { width: 18 }, { width: 15 }, { width: 15 }, { width: 15 }
  ];

  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
  };

  const titleRow = sheet.addRow(['RADIANCE POLYMERS']);
  sheet.mergeCells('A1:F1');
  titleRow.height = 25;
  titleRow.getCell(1).font = { size: 18, bold: true };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  const addressLine1 = sheet.addRow(['Plot No. 149/1, Sector No. 7, PCNTDA, Bhosari, Pune - 411 026. Maharashtra (INDIA).']);
  sheet.mergeCells('A2:F2');
  addressLine1.getCell(1).font = { size: 10 };
  addressLine1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  const addressLine2 = sheet.addRow(['Mob No. 9225538612, Email: moulding.radiance@gmail.com']);
  sheet.mergeCells('A3:F3');
  addressLine2.getCell(1).font = { size: 10 };
  addressLine2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.addRow([]);

  const docTitleRow = sheet.addRow(['Delivery challan cum Packing Slip']);
  sheet.mergeCells('A5:F5');
  docTitleRow.height = 32;
  docTitleRow.getCell(1).font = { size: 12, bold: true };
  docTitleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  docTitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
  docTitleRow.getCell(1).border = borderStyle;

  const formattedDate = new Date().toLocaleDateString('en-GB');
  
  // Per request: If the ID is a DRAFT, we leave the field empty in the report
  const reportDispId = dispatch.dispatch_id.startsWith('DRAFT-') ? '' : dispatch.dispatch_id;

  const metaRows = [
    { left: `PARTY NAME : ${dispatch.customer_name}`, right: `DATE : ${formattedDate}` },
    { left: `DISP. EXE : ${dispatch.operator_id}`, right: `VEHICLE NO : ${dispatch.vehicle_no}` },
    { left: `DRIVER : ${dispatch.driver_name} (${dispatch.driver_mobile})`, right: `LR NO : ${dispatch.lr_no}` },
    { left: `DISP. ID : ${reportDispId}`, right: `TIME : ${new Date().toLocaleTimeString()}` }
  ];

  metaRows.forEach((item) => {
    const row = sheet.addRow([item.left, '', '', item.right, '', '']);
    row.height = 28;
    const rowIdx = row.number;
    sheet.mergeCells(`A${rowIdx}:C${rowIdx}`);
    row.getCell(1).border = borderStyle;
    row.getCell(1).font = { size: 10, bold: true };
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.mergeCells(`D${rowIdx}:F${rowIdx}`);
    row.getCell(4).border = borderStyle;
    row.getCell(4).font = { size: 10, bold: true };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  });

  const signRow = sheet.addRow(['Inv. No :', '', '', 'DISP. EXE. SIGN :', '', '']);
  signRow.height = 65;
  sheet.mergeCells(`A${signRow.number}:C${signRow.number}`);
  signRow.getCell(1).border = borderStyle;
  signRow.getCell(1).font = { size: 10, bold: true };
  signRow.getCell(1).alignment = { vertical: 'top', horizontal: 'left', indent: 1 };
  sheet.mergeCells(`D${signRow.number}:F${signRow.number}`);
  signRow.getCell(4).border = borderStyle;
  signRow.getCell(4).font = { size: 10, bold: true };
  signRow.getCell(4).alignment = { vertical: 'top', horizontal: 'left', indent: 1 };

  sheet.addRow([]);

  const headerRow = sheet.addRow(['Sr no.', 'PART NO', 'PART NAME', 'BOX DISP QTY', 'TOTAL QTY', 'DISP. EXE. SIGN.']);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { size: 9, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderStyle;
  });

  summaries.forEach((s, index) => {
    const row = sheet.addRow([index + 1, s.part_no, s.part_name, s.boxes, s.total_qty, '']);
    row.height = 24;
    row.eachCell((cell, colNumber) => {
      cell.border = borderStyle;
      cell.font = { size: 10 };
      cell.alignment = { horizontal: (colNumber === 2 || colNumber === 3) ? 'left' : 'center', vertical: 'middle' };
      if (colNumber === 2 || colNumber === 3) cell.alignment.indent = 1;
    });
  });

  const totalBoxes = summaries.reduce((acc, s) => acc + s.boxes, 0);
  const totalQty = summaries.reduce((acc, s) => acc + s.total_qty, 0);
  const totalRow = sheet.addRow(['', '', 'TOTAL', totalBoxes, totalQty, '']);
  totalRow.height = 35;
  totalRow.eachCell((cell, colNumber) => {
    cell.font = { size: 11, bold: true };
    cell.border = borderStyle;
    if (colNumber === 3) cell.alignment = { horizontal: 'right', vertical: 'middle', indent: 2 };
    else cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const excelBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const pdfBlob = new Blob(['Report'], { type: 'application/pdf' });

  return {
    pdf: { fileName: `Report_${dispatch.id}.pdf`, blob: pdfBlob, mimeType: 'application/pdf', simulatedPath: '' },
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
      await navigator.share({ files: [file], title: 'Report', text: `Report: ${result.fileName}` });
      return true;
    } catch { return false; }
  }
  return false;
}
