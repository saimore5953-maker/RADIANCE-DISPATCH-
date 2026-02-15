
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
  console.log("Generating decompressed industrial exports for A4:", dispatch.dispatch_id);
  
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Packing Slip');

  // --- A4 PRINT CONFIGURATION ---
  sheet.pageSetup = {
    paperSize: 9, // A4
    orientation: 'portrait',
    fitToPage: false,
    scale: 100,
    horizontalCentered: true,
    margins: {
      left: 0.315,  // ~8mm
      right: 0.315, // ~8mm
      top: 0.315,   // ~8mm
      bottom: 0.315, // ~8mm
      header: 0.3,
      footer: 0.3
    }
  };

  // Set Column Widths (Total 90 units for perfect 50/50 split balance)
  sheet.columns = [
    { width: 10 }, // A: Sr no.
    { width: 17 }, // B: Part No
    { width: 18 }, // C: Part Name (Left Half = 45)
    { width: 15 }, // D: Box Qty / Inv No Label
    { width: 15 }, // E: Total Qty / Inv No Value
    { width: 15 }  // F: Sign Header / Metadata (Right Half = 45)
  ];

  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };

  // 1.1 Header Section
  const titleRow = sheet.addRow(['RADIANCE POLYMERS']);
  sheet.mergeCells('A1:F1');
  titleRow.height = 25;
  titleRow.getCell(1).font = { size: 18, bold: true };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  // A) Split Address + Contact into 2 Lines
  const addressLine1 = sheet.addRow(['Plot No. 149/1, Sector No. 7, PCNTDA, Bhosari, Pune - 411 026. Maharashtra (INDIA).']);
  sheet.mergeCells('A2:F2');
  addressLine1.getCell(1).font = { size: 10 };
  addressLine1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  const addressLine2 = sheet.addRow(['Mob No. 9225538612, Email: moulding.radiance@gmail.com']);
  sheet.mergeCells('A3:F3');
  addressLine2.getCell(1).font = { size: 10 };
  addressLine2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.addRow([]); // Spacer (Row 4)

  const docTitleRow = sheet.addRow(['Delivery challan cum Packing Slip']);
  sheet.mergeCells('A5:F5');
  docTitleRow.height = 32;
  docTitleRow.getCell(1).font = { size: 12, bold: true };
  docTitleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  docTitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
  docTitleRow.getCell(1).border = borderStyle;

  // 1.2 Metadata Block (Balanced 2-Column Split)
  const formattedDate = new Date(dispatch.start_time).toLocaleDateString('en-GB');
  const timeStr = dispatch.end_time ? new Date(dispatch.end_time).toLocaleTimeString() : 'N/A';
  
  const metaRows = [
    { left: `PARTY NAME : ${dispatch.customer_name}`, right: `DATE : ${formattedDate}` },
    { left: `DISP. EXE : ${dispatch.operator_id}`, right: `VEHICLE NO : ${dispatch.vehicle_no}` },
    { left: `DRIVER : ${dispatch.driver_name} (${dispatch.driver_mobile})`, right: `LR NO : ${dispatch.lr_no}` },
    { left: `DISP. ID : ${dispatch.dispatch_id}`, right: `TIME : ${timeStr}` }
  ];

  metaRows.forEach((item) => {
    const row = sheet.addRow([item.left, '', '', item.right, '', '']);
    row.height = 28; // B) Increased height for breathing space
    const rowIdx = row.number;
    
    // Merge left (A:C)
    sheet.mergeCells(`A${rowIdx}:C${rowIdx}`);
    const leftCell = row.getCell(1);
    leftCell.border = borderStyle;
    leftCell.font = { size: 10, bold: true };
    leftCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // Merge right (D:F)
    sheet.mergeCells(`D${rowIdx}:F${rowIdx}`);
    const rightCell = row.getCell(4);
    rightCell.border = borderStyle;
    rightCell.font = { size: 10, bold: true };
    rightCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  });

  // --- C) CLEAN 2-COLUMN INVOICE + SIGN BLOCK EXPANSION ---
  const signRow = sheet.addRow(['Inv. No :', '', '', 'DISP. EXE. SIGN :', '', '']);
  signRow.height = 65; // Significantly expanded for writing/signing
  const signRowIdx = signRow.number;

  // Left Half (A:C)
  sheet.mergeCells(`A${signRowIdx}:C${signRowIdx}`);
  signRow.getCell(1).border = borderStyle;
  signRow.getCell(1).font = { size: 10, bold: true };
  signRow.getCell(1).alignment = { vertical: 'top', horizontal: 'left', indent: 1 };

  // Right Half (D:F)
  sheet.mergeCells(`D${signRowIdx}:F${signRowIdx}`);
  signRow.getCell(4).border = borderStyle;
  signRow.getCell(4).font = { size: 10, bold: true };
  signRow.getCell(4).alignment = { vertical: 'top', horizontal: 'left', indent: 1 };

  sheet.addRow([]); // Spacer Row

  // 1.3 Table Headers
  const headerRow = sheet.addRow(['Sr no.', 'PART NO', 'PART NAME', 'BOX DISP QTY', 'TOTAL QTY', 'DISP. EXE. SIGN.']);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { size: 9, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderStyle;
  });

  // 1.4 Data Rows
  summaries.forEach((s, index) => {
    const row = sheet.addRow([index + 1, s.part_no, s.part_name, s.boxes, s.total_qty, '']);
    row.height = 24;
    row.eachCell((cell, colNumber) => {
      cell.border = borderStyle;
      cell.font = { size: 10 };
      cell.alignment = { 
        horizontal: (colNumber === 2 || colNumber === 3) ? 'left' : 'center',
        vertical: 'middle'
      };
      if (colNumber === 2 || colNumber === 3) cell.alignment.indent = 1;
    });
  });

  // 1.5 Empty Rows
  for (let i = 0; i < 8; i++) {
    const row = sheet.addRow(['', '', '', '', '', '']);
    row.height = 24;
    row.eachCell((cell) => {
      cell.border = borderStyle;
    });
  }

  // 1.6 Footer Totals
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

  // Generate binary output
  const buffer = await workbook.xlsx.writeBuffer();
  const excelBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  // 2. Simple PDF Blob
  const pdfHeader = [
    `RADIANCE DISPATCH REPORT`,
    `------------------------------------`,
    `Customer: ${dispatch.customer_name}`,
    `Executive: ${dispatch.operator_id}`,
    `Driver: ${dispatch.driver_name} (${dispatch.driver_mobile})`,
    `Vehicle: ${dispatch.vehicle_no} | LR: ${dispatch.lr_no}`,
    `ID: ${dispatch.dispatch_id}`,
    `Generated: ${new Date().toLocaleString()}`,
    `------------------------------------`,
    ``
  ].join("\n");
  const pdfBody = summaries.map(s => `${s.part_no} | ${s.boxes} Boxes | ${s.total_qty} Total Qty`).join("\n");
  const pdfBlob = new Blob([pdfHeader + pdfBody], { type: 'application/pdf' });

  return {
    pdf: {
      fileName: `PackingSlip_${dispatch.dispatch_id}.pdf`,
      blob: pdfBlob,
      mimeType: 'application/pdf',
      simulatedPath: `Downloads/RadianceDispatch/PackingSlip_${dispatch.dispatch_id}.pdf`
    },
    excel: {
      fileName: `PackingSlip_${dispatch.dispatch_id}.xlsx`,
      blob: excelBlob,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      simulatedPath: `Downloads/RadianceDispatch/PackingSlip_${dispatch.dispatch_id}.xlsx`
    }
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
      await navigator.share({
        files: [file],
        title: 'Dispatch Report',
        text: `Export for Dispatch: ${result.fileName}`,
      });
      return true;
    } catch (err) {
      console.error("Sharing failed", err);
      return false;
    }
  }
  return false;
}
