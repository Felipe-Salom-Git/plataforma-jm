import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';

export interface QuotePdfData {
    companyName: string;
    companyAddress: string;
    companyPhone: string;
    companyEmail: string;

    clientName: string;
    clientAddress: string;
    clientPhone: string;
    clientEmail: string;

    budgetNumber: string;
    issueDate: string;
    validUntil: string;
    workTitle: string;

    items: Array<{
        id: string;
        description: string; // Long text
        unit: string;
        quantity: number;
        unitPrice: number; // 0 means "A definir" or similar if handled, but interface says number. logic will format.
        total: number;
        priceText?: string; // Overrides price number if present (e.g. "A convenir")
        totalText?: string; // Overrides total number
    }>;

    subtotal: number;
    discount: number;
    total: number;

    // Page 2 data
    excludedItems: string[];
    clarifications: string;
    paymentConditions: string;
    paymentMethod: string;
    signatureBase64?: string;
    logoBase64?: string;

    footerTextPage1?: string;
}

// --- CONSTANTS & CONFIG ---
const FONTS = {
    sizeTitle: 24,
    sizeSubtitle: 14,
    sizeBody: 10,
    sizeSmall: 8,
};

const COLORS = {
    primary: rgb(0.2, 0.2, 0.2), // Dark Gray
    headerBg: rgb(0.2, 0.4, 0.6), // Blue-ish band (adjust as needed)
    headerText: rgb(1, 1, 1),
    tableHeaderBg: rgb(0.9, 0.9, 0.9),
    border: rgb(0.8, 0.8, 0.8),
    accent: rgb(0.8, 0.2, 0.2),
};

const PAGE_MARGIN = 50;

// --- HELPERS ---

/** Formats currency or returns text override */
const formatCurrency = (val: number, override?: string) => {
    if (override) return override;
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);
};

/**
 * Split text into lines that fit within maxWidth
 */
const splitTextToLines = (text: string, font: PDFFont, size: number, maxWidth: number): string[] => {
    if (!text) return [];
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = font.widthOfTextAtSize(`${currentLine} ${word}`, size);
        if (width < maxWidth) {
            currentLine += ` ${word}`;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
};

// --- DRAWING FUNCTIONS ---

const drawHeader = (page: PDFPage, fontBold: PDFFont, fontReg: PDFFont, data: QuotePdfData, pageNum: number) => {
    const { width, height } = page.getSize();

    // Header Band
    page.drawRectangle({
        x: 0,
        y: height - 60,
        width: width,
        height: 60,
        color: COLORS.headerBg,
    });

    // Title
    page.drawText('PRESUPUESTO', {
        x: width - 200,
        y: height - 40,
        size: FONTS.sizeTitle,
        font: fontBold,
        color: COLORS.headerText,
    });

    // Metadata
    const metaText = `Nº ${data.budgetNumber} | Fecha: ${data.issueDate}\nVálido hasta: ${data.validUntil}`;
    page.drawText(metaText, {
        x: width - 200,
        y: height - 45 - 15,
        size: FONTS.sizeSmall, // Reduced size for meta
        font: fontReg,
        color: rgb(0.9, 0.9, 0.9),
        lineHeight: 12,
    });

    // Logo Placeholder (Text if no image)
    if (!data.logoBase64) {
        page.drawText(data.companyName, {
            x: PAGE_MARGIN,
            y: height - 40,
            size: FONTS.sizeSubtitle,
            font: fontBold,
            color: COLORS.headerText,
        });
    } else {
        // TODO: Embed image logic here if passed
    }
};

const drawFooter = (page: PDFPage, font: PDFFont, text: string, pageNum: number, totalPages: number) => {
    const { width } = page.getSize();
    const y = 30;

    page.drawLine({
        start: { x: PAGE_MARGIN, y: y + 10 },
        end: { x: width - PAGE_MARGIN, y: y + 10 },
        thickness: 1,
        color: COLORS.border,
    });

    page.drawText(text, {
        x: PAGE_MARGIN,
        y: y,
        size: FONTS.sizeSmall,
        font: font,
        color: COLORS.primary,
    });

    page.drawText(`HOJA ${pageNum} DE ${totalPages}`, {
        x: width - PAGE_MARGIN - 60,
        y: y,
        size: FONTS.sizeSmall,
        font: font,
        color: COLORS.primary,
    });
};

// --- MAIN GENERATOR ---

export const generateQuotePdf = async (data: QuotePdfData): Promise<Uint8Array> => {
    const doc = await PDFDocument.create();
    const fontReg = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    // --- PAGE 1 ---
    const page1 = doc.addPage();
    const { width, height } = page1.getSize();

    drawHeader(page1, fontBold, fontReg, data, 1);

    // Info Grid
    let yPos = height - 100;

    // Client Block
    page1.drawText('CLIENTE', { x: PAGE_MARGIN, y: yPos, size: 8, font: fontBold, color: rgb(0.5, 0.5, 0.5) });
    yPos -= 12;
    page1.drawText(data.clientName, { x: PAGE_MARGIN, y: yPos, size: 10, font: fontBold });
    yPos -= 12;
    page1.drawText(`${data.clientAddress}\n${data.clientPhone} | ${data.clientEmail}`, {
        x: PAGE_MARGIN, y: yPos, size: 9, font: fontReg, lineHeight: 11
    });

    // Company Block (Right side)
    yPos += 24; // Reset to top of block
    const col2X = width / 2 + 20;
    page1.drawText('EMPRESA', { x: col2X, y: yPos, size: 8, font: fontBold, color: rgb(0.5, 0.5, 0.5) });
    yPos -= 12;
    page1.drawText(data.companyName, { x: col2X, y: yPos, size: 10, font: fontBold });
    yPos -= 12;
    page1.drawText(`${data.companyAddress}\n${data.companyPhone} | ${data.companyEmail}`, {
        x: col2X, y: yPos, size: 9, font: fontReg, lineHeight: 11
    });

    yPos -= 40;

    // Work Title
    page1.drawText(`Obra: ${data.workTitle}`, { x: PAGE_MARGIN, y: yPos, size: 12, font: fontBold });
    page1.drawLine({
        start: { x: PAGE_MARGIN, y: yPos - 5 },
        end: { x: width - PAGE_MARGIN, y: yPos - 5 },
        thickness: 1.5, color: COLORS.primary
    });

    yPos -= 30;

    // Table Headers
    const colX = [PAGE_MARGIN, PAGE_MARGIN + 30, width - 200, width - 140, width - 80];
    // # | Item | Unit | Qty | Price | Total (Adjusted)
    // Simplified cols: # (30px), Desc (Flex), Price (70), Qty(40), Total(70)

    const cols = {
        idx: PAGE_MARGIN,
        desc: PAGE_MARGIN + 30,
        price: width - 190,
        qty: width - 120,
        total: width - 70 // Right aligned anchor roughly
    };

    // Header Bg
    page1.drawRectangle({ x: PAGE_MARGIN, y: yPos - 5, width: width - 2 * PAGE_MARGIN, height: 20, color: COLORS.tableHeaderBg });

    page1.drawText('#', { x: cols.idx + 5, y: yPos, size: 9, font: fontBold });
    page1.drawText('ÍTEM / TAREA', { x: cols.desc, y: yPos, size: 9, font: fontBold });
    page1.drawText('PRECIO', { x: cols.price, y: yPos, size: 9, font: fontBold });
    page1.drawText('CANT.', { x: cols.qty, y: yPos, size: 9, font: fontBold });
    page1.drawText('TOTAL', { x: cols.total, y: yPos, size: 9, font: fontBold });

    yPos -= 20;

    // Items Loop
    for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];
        const descWidth = cols.price - cols.desc - 10;
        const descLines = splitTextToLines(item.description, fontReg, 9, descWidth);
        const isMultiLine = descLines.length > 1;
        const rowHeight = 15 + (descLines.length - 1) * 11;

        // Check page break logic here if needed (omitted for strict 2-page request, assuming fit)

        // Index
        page1.drawText(`${i + 1}`, { x: cols.idx + 5, y: yPos, size: 9, font: fontReg });

        // Description
        descLines.forEach((line, idx) => {
            page1.drawText(line, { x: cols.desc, y: yPos - (idx * 11), size: 9, font: fontReg });
        });
        if (item.unit) {
            page1.drawText(`(${item.unit})`, { x: cols.desc, y: yPos - (descLines.length * 11), size: 7, font: fontReg, color: rgb(0.5, 0.5, 0.5) });
        }

        // Values
        const priceStr = formatCurrency(item.unitPrice, item.priceText);
        const totalStr = formatCurrency(item.total, item.totalText);

        page1.drawText(priceStr, { x: cols.price, y: yPos, size: 9, font: fontReg });
        page1.drawText(item.quantity.toString(), { x: cols.qty + 10, y: yPos, size: 9, font: fontReg }); // Centerish
        page1.drawText(totalStr, { x: cols.total, y: yPos, size: 9, font: fontReg });

        // Line
        page1.drawLine({
            start: { x: PAGE_MARGIN, y: yPos - rowHeight + 10 },
            end: { x: width - PAGE_MARGIN, y: yPos - rowHeight + 10 },
            thickness: 0.5, color: COLORS.border
        });

        yPos -= (rowHeight + 5);
    }

    // Subtotal / Total
    yPos -= 10;
    page1.drawText('SUBTOTAL', { x: width - 200, y: yPos, size: 10, font: fontBold });
    page1.drawText(formatCurrency(data.subtotal), { x: width - 80, y: yPos, size: 10, font: fontReg });

    if (data.discount > 0) {
        yPos -= 15;
        page1.drawText('DESCUENTO', { x: width - 200, y: yPos, size: 10, font: fontBold, color: COLORS.accent });
        page1.drawText(`-${formatCurrency(data.discount)}`, { x: width - 80, y: yPos, size: 10, font: fontBold, color: COLORS.accent });
    }

    yPos -= 20;
    page1.drawLine({ start: { x: width - 200, y: yPos + 15 }, end: { x: width - PAGE_MARGIN, y: yPos + 15 }, thickness: 1 });
    page1.drawText('TOTAL FINAL', { x: width - 200, y: yPos, size: 12, font: fontBold });
    page1.drawText(formatCurrency(data.total), { x: width - 80, y: yPos, size: 12, font: fontBold });

    drawFooter(page1, fontReg, `${data.companyName} - ${data.companyEmail}`, 1, 2);


    // --- PAGE 2 ---
    const page2 = doc.addPage();
    drawHeader(page2, fontBold, fontReg, data, 2);

    yPos = height - 100;

    // Excluded Items
    page2.drawRectangle({ x: PAGE_MARGIN, y: yPos, width: 5, height: 15, color: COLORS.headerBg });
    page2.drawText('ÍTEMS NO COTIZADOS', { x: PAGE_MARGIN + 15, y: yPos, size: 10, font: fontBold });
    yPos -= 20;

    if (data.excludedItems.length > 0) {
        data.excludedItems.forEach(item => {
            page2.drawText(`• ${item}`, { x: PAGE_MARGIN + 20, y: yPos, size: 9, font: fontReg });
            yPos -= 12;
        });
    } else {
        page2.drawText('Ninguno.', { x: PAGE_MARGIN + 20, y: yPos, size: 9, font: fontReg, color: rgb(0.5, 0.5, 0.5) });
        yPos -= 12;
    }

    yPos -= 20;

    // Clarifications
    page2.drawRectangle({ x: PAGE_MARGIN, y: yPos, width: 5, height: 15, color: COLORS.headerBg });
    page2.drawText('ACLARACIONES GENERALES', { x: PAGE_MARGIN + 15, y: yPos, size: 10, font: fontBold });
    yPos -= 20;

    const clarLines = splitTextToLines(data.clarifications, fontReg, 9, width - 2 * PAGE_MARGIN);
    clarLines.forEach(line => {
        page2.drawText(line, { x: PAGE_MARGIN, y: yPos, size: 9, font: fontReg });
        yPos -= 11;
    });

    yPos -= 30;

    // Payment Terms
    page2.drawRectangle({ x: PAGE_MARGIN, y: yPos, width: 5, height: 15, color: COLORS.headerBg });
    page2.drawText('CONDICIONES DE PAGO', { x: PAGE_MARGIN + 15, y: yPos, size: 10, font: fontBold });
    yPos -= 20;

    const paymentLines = splitTextToLines(data.paymentConditions, fontReg, 9, width - 2 * PAGE_MARGIN);
    paymentLines.forEach(line => {
        page2.drawText(line, { x: PAGE_MARGIN, y: yPos, size: 9, font: fontReg });
        yPos -= 11;
    });

    // Signature (Bottom)
    yPos = 150;
    if (data.signatureBase64) {
        const imgBytes = await fetch(data.signatureBase64).then(res => res.arrayBuffer()); // Basic handle, assumes proper data URI
        let img;
        if (data.signatureBase64.startsWith('data:image/png')) img = await doc.embedPng(imgBytes);
        else img = await doc.embedJpg(imgBytes);

        const dims = img.scale(0.5);
        page2.drawImage(img, {
            x: width / 2 - dims.width / 2,
            y: yPos + 20,
            width: dims.width,
            height: dims.height,
        });
    }

    page2.drawLine({ start: { x: width / 2 - 100, y: yPos }, end: { x: width / 2 + 100, y: yPos }, thickness: 1, color: COLORS.primary });
    page2.drawText('Firma / Aceptación Cliente', {
        x: width / 2 - 60, y: yPos - 15, size: 9, font: fontReg
    });

    drawFooter(page2, fontReg, data.workTitle, 2, 2);

    return await doc.save();
};
