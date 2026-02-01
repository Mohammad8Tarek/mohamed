
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { AppSettings, Property } from '../types';
import { defaultLogoBase64 } from '../logo';

/**
 * Reverses a string to simulate RTL rendering in jsPDF for Arabic support.
 * Only reverses segments containing Arabic characters.
 */
const containsArabic = (text: string) => /[\u0600-\u06FF]/.test(text);

const processRtlText = (text: string): string => {
    if (!text) return '';
    if (!containsArabic(text)) return text;
    // Simple reversal for jsPDF which doesn't support complex RTL shaping natively
    return text.split('').reverse().join('');
};

const processDataForRtl = (data: any[][], language: 'en' | 'ar') => {
    if (language !== 'ar') return data;
    return data.map(row => row.map(cell => {
        if (typeof cell === 'string') return processRtlText(cell);
        return cell;
    }));
};

interface ExcelExportOptions {
    headers: string[];
    data: any[][];
    sheetName?: string;
    filename: string;
    settings: AppSettings;
    property?: Property | null;
    summableColumns: string[]; // NEW
    rawData: any[]; // NEW: Pass raw data for accurate calculations
}

export const exportToExcel = ({ headers, data, sheetName = 'Report', filename, settings, property, summableColumns, rawData }: ExcelExportOptions) => {
    const title = `${settings.systemName.toUpperCase()} - ${property?.displayName?.toUpperCase() || 'ENTERPRISE REPORT'}`;
    const timestamp = `EXPORTED ON: ${new Date().toLocaleString()}`;
    
    let ws_data: any[][] = [
        [title],
        [timestamp],
        [],
        headers,
        ...data
    ];

    if (summableColumns && summableColumns.length > 0 && rawData.length > 0) {
        const totals: { [key: string]: number } = {};
        summableColumns.forEach(col => {
            totals[col] = rawData.reduce((sum, row) => sum + (typeof row[col] === 'number' ? row[col] : 0), 0);
        });

        const totalRow: any[] = new Array(headers.length).fill('');
        totalRow[0] = 'TOTALS:'; // Label for the totals row

        headers.forEach((header, index) => {
            const originalColKey = headers[index]; // Assuming headers match summableColumns keys directly or are consistently mapped
            if (summableColumns.includes(originalColKey)) {
                totalRow[index] = totals[originalColKey];
            } else if (originalColKey.toLowerCase().includes('total') && !isNaN(parseFloat(rawData[0][originalColKey]))) { // Catch "total" in header
                totalRow[index] = rawData.reduce((sum, row) => sum + (typeof row[originalColKey] === 'number' ? row[originalColKey] : 0), 0);
            }
        });
        
        ws_data.push([]); // Add an empty row for spacing
        ws_data.push(totalRow);
    }
    
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    
    // Freeze header and adjust column widths
    ws['!freeze'] = 'A5';
    ws['!cols'] = headers.map(() => ({ wch: 25 }));

    // Apply bold font style to header row cells (row 4, index 3)
    const headerStyle = { font: { bold: true } };
    for (let i = 0; i < headers.length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: 3, c: i });
        if (ws[cellRef]) {
            ws[cellRef].s = headerStyle;
        }
    }

    // Apply bold for totals row if added
    if (summableColumns && summableColumns.length > 0 && rawData.length > 0) {
        const totalRowIndex = ws_data.length -1; // Last row added
        const totalRowStyle = { font: { bold: true }, fill: { fgColor: { rgb: "FFF2CC" } } }; // Light yellow background
        for (let i = 0; i < headers.length; i++) {
            const cellRef = XLSX.utils.encode_cell({ r: totalRowIndex, c: i });
            if (ws[cellRef]) {
                ws[cellRef].s = totalRowStyle;
            }
        }
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
};

interface PdfExportOptions {
    headers: string[];
    data: any[][];
    title: string;
    filename: string;
    settings: AppSettings;
    language: 'en' | 'ar';
    property?: Property | null;
    summableColumns: string[]; // NEW
    rawData: any[]; // NEW: Pass raw data for accurate calculations
}

export const exportToPdf = ({ headers, data, title, filename, settings, language, property, summableColumns, rawData }: PdfExportOptions) => {
    const doc = new jsPDF({ 
        orientation: 'l', // MANDATORY: LANDSCAPE
        unit: 'mm', 
        format: 'a4' 
    });
    
    const isRtl = language === 'ar';
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Logo logic with deep fallback
    const logoData = property?.logo || settings.reportLogo || settings.systemLogo || defaultLogoBase64;
    const primaryColor = property?.primaryColor || settings.primaryColor || '#0F2A44';

    const processedHeaders = isRtl ? headers.map(processRtlText) : headers;
    const processedData = processDataForRtl(data, language);

    // Calculate totals for the report
    let finalBody = [...processedData];
    let reportTotals: { [key: string]: number } = {};

    if (summableColumns && summableColumns.length > 0 && rawData.length > 0) {
        summableColumns.forEach(col => {
            reportTotals[col] = rawData.reduce((sum, row) => sum + (typeof row[col] === 'number' ? row[col] : 0), 0);
        });

        const totalRow: any[] = new Array(processedHeaders.length).fill('');
        totalRow[0] = isRtl ? processRtlText('الإجماليات:') : 'TOTALS:'; // Label for the totals row

        // Map totals to the correct column positions in the final row
        headers.forEach((header, index) => { // Use original headers to find column index
            const originalColKey = header;
            if (summableColumns.includes(originalColKey)) {
                totalRow[index] = reportTotals[originalColKey];
            } else if (originalColKey.toLowerCase().includes('total') && !isNaN(parseFloat(rawData[0][originalColKey]))) {
                totalRow[index] = rawData.reduce((sum, row) => sum + (typeof row[originalColKey] === 'number' ? row[originalColKey] : 0), 0);
            }
        });
        
        finalBody.push([]); // Add empty row for separation
        finalBody.push(totalRow);
    }


    autoTable(doc, {
        head: [processedHeaders],
        body: finalBody,
        startY: 45,
        margin: { top: 45, right: 10, bottom: 20, left: 10 },
        theme: 'grid',
        headStyles: { 
            fillColor: primaryColor, 
            textColor: '#FFFFFF', 
            fontStyle: 'bold', 
            halign: isRtl ? 'right' : 'left',
            fontSize: 8,
            cellPadding: 3
        },
        styles: { 
            font: 'Helvetica', 
            fontSize: 7, 
            cellPadding: 2, 
            halign: isRtl ? 'right' : 'left',
            overflow: 'linebreak'
        },
        alternateRowStyles: { fillColor: '#F8FAFC' },
        // Add specific style for the totals row
        didParseCell: (data) => {
            if (summableColumns && summableColumns.length > 0 && rawData.length > 0) {
                // Check if it's the totals row (the last row in the body)
                if (data.row.index === finalBody.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = '#F2F2F2'; // Light grey background
                    data.cell.styles.textColor = '#333333';
                }
            }
        },
        didDrawPage: (data: any) => {
            // Header Background
            doc.setFillColor('#F1F5F9');
            doc.rect(0, 0, pageWidth, 40, 'F');

            // Property Logo
            const logoW = 25;
            const logoH = 25;
            const logoX = isRtl ? 10 : pageWidth - logoW - 10;
            try { 
                doc.addImage(logoData, 'PNG', logoX, 7, logoW, logoH); 
            } catch (e) {
                console.warn("PDF Export: Logo rendering failed, using placeholder text.");
            }
            
            // System/Property Titles
            doc.setFontSize(16);
            doc.setTextColor(primaryColor);
            const systemTitle = isRtl ? processRtlText(settings.systemName) : settings.systemName;
            doc.text(systemTitle, isRtl ? pageWidth - 40 : 10, 15);
            
            doc.setFontSize(10);
            doc.setTextColor('#64748B');
            const propName = isRtl ? processRtlText(property?.displayName || 'Enterprise Node') : (property?.displayName || 'Enterprise Node');
            doc.text(propName, isRtl ? pageWidth - 40 : 10, 22);
            
            // Report Header Strip
            doc.setFillColor(primaryColor);
            doc.rect(isRtl ? pageWidth - 150 : 10, 30, 140, 8, 'F');
            doc.setFontSize(11);
            doc.setTextColor('#FFFFFF');
            const reportTitle = isRtl ? processRtlText(title) : title;
            doc.text(reportTitle, isRtl ? pageWidth - 15 : 15, 35.5, { align: isRtl ? 'right' : 'left' });

            // Timestamp
            doc.setFontSize(7);
            doc.setTextColor('#94A3B8');
            const dateStr = `Generated: ${new Date().toLocaleString()}`;
            doc.text(dateStr, isRtl ? 10 : pageWidth - 10, 35.5, { align: isRtl ? 'left' : 'right' });
            
            // Footer
            const footerY = pageHeight - 10;
            doc.setDrawColor('#E2E8F0');
            doc.line(10, footerY - 5, pageWidth - 10, footerY - 5);
            
            doc.setFontSize(7);
            doc.setTextColor('#94A3B8');
            const footerText = isRtl ? processRtlText('Sunrise Enterprise Proprietary Report - Internal Use Only') : 'Sunrise Enterprise Proprietary Report - Internal Use Only';
            doc.text(footerText, pageWidth / 2, footerY, { align: 'center' });
            doc.text(`Page ${data.pageNumber}`, isRtl ? 10 : pageWidth - 10, footerY, { align: isRtl ? 'left' : 'right' });
        },
    });

    doc.save(filename);
};

export const downloadEmployeeTemplate = (t: any, propertyName: string) => {
    const headers = [
        `Employee Code (*)`,
        `Clock ID`,
        `First Name (*)`,
        `Last Name (*)`,
        `National ID (*)`,
        `Gender (male/female) (*)`,
        `Date of Birth (YYYY-MM-DD)`,
        `Phone Number (*)`,
        `Address`,
        `Department Code (*)`,
        `Job Title (*)`,
        `Level`,
        `Work Location (*)`,
        `Contract Start Date (YYYY-MM-DD) (*)`,
        `Contract End Date (YYYY-MM-DD)`,
        `Status (active/left) (*)`
    ];
    const ws_data = [
        ['OFFICIAL HR IMPORT TEMPLATE - DO NOT MODIFY HEADERS'], 
        [`Target Property: ${propertyName}`], 
        ['(*) Indicates a required field. All date fields must be in YYYY-MM-DD format.'], 
        headers
    ];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();

    // Style and protect header
    ws['!cols'] = headers.map(h => ({ wch: h.length + 5 }));
    ws['!rows'] = [{ hpt: 20 }, { hpt: 15 }, { hpt: 15 }, { hpt: 25 }];

    // Apply bold font style to header row cells (row 4, index 3)
    const headerStyle = { font: { bold: true } };
    for (let i = 0; i < headers.length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: 3, c: i });
        if (ws[cellRef]) {
            ws[cellRef].s = headerStyle;
        }
    }

    XLSX.utils.book_append_sheet(wb, ws, "Employee Import Template");
    XLSX.writeFile(wb, `staff_import_template_${propertyName.toLowerCase().replace(/\s/g, '_')}.xlsx`);
};