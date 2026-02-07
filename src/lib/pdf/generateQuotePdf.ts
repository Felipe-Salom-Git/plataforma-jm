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
        description: string;
        unit: string;
        quantity: number;
        unitPrice: number;
        total: number;
        priceText?: string;
        totalText?: string;
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
    logoBase64?: string; // Optional if you have logo logic
    conditions: string; // Added robust field
    notes: string;      // Added robust field
}

const FONTS = {
    sizeTitle: 24,
    sizeSubtitle: 12,
    sizeBody: 9,
    sizeSmall: 8,
};

const COLORS = {
    primary: rgb(0.2, 0.4, 0.6), // Blue
    headerText: rgb(1, 1, 1),    // White
    tableHeaderBg: rgb(0.9, 0.9, 0.9),
    border: rgb(0.8, 0.8, 0.8),
    textMain: rgb(0, 0, 0),
    textMuted: rgb(0.4, 0.4, 0.4),
};

const PAGE_MARGIN = 40;

const formatCurrency = (val: number, override?: string) => {
    if (override) return override;
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
};

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

const drawHeader = (page: PDFPage, fontBold: PDFFont, fontReg: PDFFont, data: QuotePdfData) => {
    const { width, height } = page.getSize();

    // Blue Block Top-Left
    page.drawRectangle({
        x: PAGE_MARGIN,
        y: height - 100,
        width: 250,
        height: 60,
        color: COLORS.primary,
    });

    page.drawText(data.companyName.toUpperCase(), {
        x: PAGE_MARGIN + 10,
        y: height - 65,
        size: 14,
        font: fontBold,
        color: COLORS.headerText,
    });

    page.drawText('SOLUCIONES ELÉCTRICAS', {
        x: PAGE_MARGIN + 10,
        y: height - 80,
        size: 9,
        font: fontReg,
        color: COLORS.headerText,
    });
    page.drawText('ELECTRICISTA MATRICULADO', {
        x: PAGE_MARGIN + 10,
        y: height - 92,
        size: 8,
        font: fontReg,
        color: COLORS.headerText,
    });


    // Right Side Header
    const rightX = width - PAGE_MARGIN - 200;
    page.drawText('PRESUPUESTO', {
        x: rightX,
        y: height - 60,
        size: 18,
        font: fontBold,
        color: COLORS.primary,
    });

    // Work Title (Limited length or multi-line if needed, here simple)
    const titleLines = splitTextToLines(data.workTitle.toUpperCase(), fontBold, 10, 200);
    let titleY = height - 80;
    titleLines.forEach(l => {
        page.drawText(l, { x: rightX, y: titleY, size: 10, font: fontBold, color: COLORS.textMain });
        titleY -= 12;
    });

};

const drawFooterPage1 = (page: PDFPage, font: PDFFont) => {
    const { width } = page.getSize();
    page.drawText('HOJA 1 DE 2', {
        x: width - PAGE_MARGIN - 60,
        y: 30,
        size: 8,
        font: font,
        color: COLORS.textMuted
    });
};

const drawFooterPage2 = (page: PDFPage, font: PDFFont) => {
    const { width } = page.getSize();
    page.drawText('HOJA 2 DE 2', {
        x: width - PAGE_MARGIN - 60,
        y: 30,
        size: 8,
        font: font,
        color: COLORS.textMuted
    });
};


export const generateQuotePdf = async (data: QuotePdfData): Promise<Uint8Array> => {
    const doc = await PDFDocument.create();
    const fontReg = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    // --- PAGE 1 ---
    const page1 = doc.addPage();
    const { width, height } = page1.getSize();

    drawHeader(page1, fontBold, fontReg, data);

    // Metadata Row
    let yPos = height - 130;

    // Client Block
    page1.drawText('CLIENTE:', { x: PAGE_MARGIN, y: yPos, size: 9, font: fontBold, color: COLORS.primary });
    page1.drawText(data.clientName, { x: PAGE_MARGIN + 50, y: yPos, size: 9, font: fontBold });
    yPos -= 12;

    const addressLines = splitTextToLines(data.clientAddress, fontReg, 9, 300);
    addressLines.forEach(l => {
        page1.drawText(l, { x: PAGE_MARGIN + 50, y: yPos, size: 9, font: fontReg });
        yPos -= 11;
    });

    // Dates (Right aligned related to client block)
    yPos = height - 130;
    const dateX = width - PAGE_MARGIN - 150;
    page1.drawText(`FECHA: ${data.issueDate}`, { x: dateX, y: yPos, size: 9, font: fontReg });
    yPos -= 15;
    page1.drawText(`VENCIMIENTO: ${data.validUntil}`, { x: dateX, y: yPos, size: 9, font: fontReg });


    // Items Table
    yPos = height - 200;
    const cols = {
        idx: PAGE_MARGIN,
        task: PAGE_MARGIN + 30,
        price: width - 180,
        qty: width - 110,
        total: width - 60
    };

    // Table Header
    page1.drawRectangle({ x: PAGE_MARGIN, y: yPos - 5, width: width - 2 * PAGE_MARGIN, height: 20, color: COLORS.tableHeaderBg });
    page1.drawText('ÍTEM', { x: cols.idx + 5, y: yPos + 2, size: 8, font: fontBold });
    page1.drawText('TAREA', { x: cols.task, y: yPos + 2, size: 8, font: fontBold });
    page1.drawText('PRECIO', { x: cols.price, y: yPos + 2, size: 8, font: fontBold });
    page1.drawText('CANT', { x: cols.qty, y: yPos + 2, size: 8, font: fontBold });
    page1.drawText('TOTAL', { x: cols.total, y: yPos + 2, size: 8, font: fontBold });

    yPos -= 25;

    // Items Loop
    for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];

        // Task description word wrap
        const taskWidth = cols.price - cols.task - 10;
        const taskLines = splitTextToLines(item.description, fontReg, 9, taskWidth);
        const rowHeight = Math.max(15, taskLines.length * 11 + 5);

        // Check page break (simple assumption: if close to bottom, just stop or continue. For strict 2 page, we assume fit or clip. 
        // Real implementation would handle multiple pages but requirement is strict 2 pages.)

        page1.drawText(`${i + 1}`, { x: cols.idx + 8, y: yPos, size: 9, font: fontReg });

        taskLines.forEach((l, idx) => {
            page1.drawText(l, { x: cols.task, y: yPos - (idx * 11), size: 9, font: fontReg });
        });

        page1.drawText(formatCurrency(item.unitPrice, item.priceText), { x: cols.price, y: yPos, size: 9, font: fontReg });
        page1.drawText((item.quantity || 0).toString(), { x: cols.qty + 10, y: yPos, size: 9, font: fontReg });
        page1.drawText(formatCurrency(item.total, item.totalText), { x: cols.total, y: yPos, size: 9, font: fontReg });

        // Line
        page1.drawLine({
            start: { x: PAGE_MARGIN, y: yPos - rowHeight + 10 },
            end: { x: width - PAGE_MARGIN, y: yPos - rowHeight + 10 },
            thickness: 0.5,
            color: COLORS.border
        });

        yPos -= rowHeight;
    }

    // Totals
    yPos -= 10;

    // Note for estimation if needed
    // page1.drawText('* TOTAL a definir por Item X', ...);

    page1.drawText('SUBTOTAL:', { x: width - 180, y: yPos, size: 10, font: fontBold });
    page1.drawText(formatCurrency(data.subtotal), { x: width - 80, y: yPos, size: 10, font: fontReg });

    if (data.discount > 0) {
        yPos -= 15;
        page1.drawText('DESCUENTO:', { x: width - 180, y: yPos, size: 10, font: fontBold });
        page1.drawText(`-${formatCurrency(data.discount)}`, { x: width - 80, y: yPos, size: 10, font: fontReg });
    }

    yPos -= 20;
    page1.drawText('TOTAL FINAL:', { x: width - 180, y: yPos, size: 12, font: fontBold, color: COLORS.primary });
    page1.drawText(formatCurrency(data.total), { x: width - 80, y: yPos, size: 12, font: fontBold, color: COLORS.primary });

    drawFooterPage1(page1, fontReg);

    // --- PAGE 2 ---
    const page2 = doc.addPage();

    // Header simplified repeated
    page2.drawRectangle({ x: PAGE_MARGIN, y: height - 60, width: width - 2 * PAGE_MARGIN, height: 2, color: COLORS.primary });
    page2.drawText('ANEXO Y CONDICIONES', { x: PAGE_MARGIN, y: height - 50, size: 12, font: fontBold, color: COLORS.primary });

    yPos = height - 100;

    const drawSection = (title: string, content: string | string[]) => {
        page2.drawText(title, { x: PAGE_MARGIN, y: yPos, size: 10, font: fontBold, color: COLORS.primary });
        yPos -= 15;

        const lines = Array.isArray(content)
            ? content.flatMap(l => splitTextToLines(l, fontReg, 9, width - 2 * PAGE_MARGIN))
            : splitTextToLines(content, fontReg, 9, width - 2 * PAGE_MARGIN);

        lines.forEach(l => {
            page2.drawText(l, { x: PAGE_MARGIN, y: yPos, size: 9, font: fontReg });
            yPos -= 11;
        });
        yPos -= 20; // Gap
    }

    // Items No Cotizados
    if (data.excludedItems && data.excludedItems.length > 0) {
        drawSection('ÍTEMS NO COTIZADOS', data.excludedItems.map(i => `• ${i}`));
    } else {
        drawSection('ÍTEMS NO COTIZADOS', 'Ninguno.');
    }

    // Aclaraciones (merging clarifications, conditions, notes if needed logic in mapper, here we dump field)
    // We can concatenate them for display or separate? Using mapped data.
    // The prompt asked for "ACLARACIONES", "CONDICIONES DE PAGO", "MÉTODO DE PAGO".
    // We have data.clarifications, data.conditions, data.notes. 
    // Let's combine Clarifications + Conditions + Notes under generic sections or specific if available.

    if (data.clarifications) drawSection('ACLARACIONES', data.clarifications);
    if (data.conditions) drawSection('CONDICIONES GENERALES', data.conditions);
    if (data.notes) drawSection('NOTAS', data.notes);

    if (data.paymentConditions) drawSection('CONDICIONES DE PAGO', data.paymentConditions);
    if (data.paymentMethod) drawSection('MÉTODO DE PAGO', data.paymentMethod);


    // Signature
    yPos = 150;
    if (data.signatureBase64 && data.signatureBase64.startsWith('data:image')) {
        try {
            const imgBytes = await fetch(data.signatureBase64).then(res => res.arrayBuffer());
            let img;
            if (data.signatureBase64.startsWith('data:image/png')) img = await doc.embedPng(imgBytes);
            else img = await doc.embedJpg(imgBytes);

            const dims = img.scale(0.5);
            page2.drawImage(img, {
                x: width / 2 - dims.width / 2,
                y: yPos + 10,
                width: dims.width,
                height: dims.height
            });
        } catch (e) {
            console.error("Sig render error", e);
        }
    } else {
        page2.drawText('Sin firma cargada. Esto no se mostrará en el PDF hasta que subas una.', {
            x: width / 2 - 130,
            y: yPos + 20,
            size: 9,
            font: fontReg,
            color: rgb(0.5, 0.5, 0.5)
        });
    }

    page2.drawLine({ start: { x: width / 2 - 80, y: yPos }, end: { x: width / 2 + 80, y: yPos }, thickness: 1, color: COLORS.primary });
    page2.drawText('FIRMA DEL PRESTADOR', { x: width / 2 - 40, y: yPos - 10, size: 8, font: fontReg });

    page2.drawText(`${data.companyName}\n${data.companyPhone} | ${data.companyEmail}`, {
        x: width / 2, y: yPos - 25, size: 8, font: fontReg,
        // Alignment center logic is manual in pdf-lib (calculate width). Simplified here left-ish aligned to center.
    });


    drawFooterPage2(page2, fontReg);

    return await doc.save();
};
