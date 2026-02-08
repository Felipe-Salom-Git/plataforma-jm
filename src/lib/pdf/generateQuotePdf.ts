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

    materials?: Array<{
        id: string;
        description: string;
        unit: string;
        quantity: number;
        unitPrice: number;
        total: number;
    }>;

    subtotal: number;
    discount: number;
    total: number;

    excludedItems: string[];
    clarifications: string;
    paymentConditions: string;
    paymentMethod: string;
    signatureBase64?: string;
    logoBase64?: string;
    conditions: string;
    notes: string;
}

const COLORS = {
    primary: rgb(0.2, 0.4, 0.6), // Blue
    headerText: rgb(1, 1, 1),    // White
    tableHeaderBg: rgb(0.9, 0.9, 0.9),
    border: rgb(0.8, 0.8, 0.8),
    textMain: rgb(0, 0, 0),
    textMuted: rgb(0.4, 0.4, 0.4),
    zebra: rgb(0.96, 0.96, 0.96),
    accent: rgb(0.95, 0.95, 0.95)
};

const PAGE_MARGIN = 40;
const BOTTOM_MARGIN = 50;

export const generateQuotePdf = async (data: QuotePdfData): Promise<Uint8Array> => {
    const doc = await PDFDocument.create();
    const fontReg = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    // --- STATE ---
    let page = doc.addPage();
    let { width, height } = page.getSize();
    let cursorY = height - PAGE_MARGIN;

    // --- HELPERS ---

    const safeStr = (v: any) => (v == null ? "" : String(v));
    const safeNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

    const formatCurrency = (val: number, override?: string) => {
        if (override) return override;
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
    };

    const wrap = (text: string, font: PDFFont, size: number, maxWidth: number): string[] => {
        if (!text) return [];
        const distinctLines = text.split(/\r?\n/);
        const finalLines: string[] = [];
        for (const rawLine of distinctLines) {
            if (!rawLine.trim()) {
                finalLines.push("");
                continue;
            }
            const words = rawLine.split(' ');
            let currentLine = words[0] || '';
            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = font.widthOfTextAtSize(`${currentLine} ${word}`, size);
                if (width < maxWidth) {
                    currentLine += ` ${word}`;
                } else {
                    finalLines.push(currentLine);
                    currentLine = word;
                }
            }
            finalLines.push(currentLine);
        }
        return finalLines;
    };

    // Ensure space exists, if not adds page and draws mini header
    const ensureSpace = (neededHeight: number): { didBreak: boolean, page: PDFPage } => {
        if (cursorY - neededHeight < BOTTOM_MARGIN) {
            page = doc.addPage();
            // Update width/height to match new page
            ({ width, height } = page.getSize());
            cursorY = height - PAGE_MARGIN;
            drawHeaderMini(); // New page always starts with mini header
            return { didBreak: true, page };
        }
        return { didBreak: false, page };
    };

    // --- DRAWERS ---

    const drawHeaderFull = () => {
        const colWidth = (width - 2 * PAGE_MARGIN) / 2;
        const leftX = PAGE_MARGIN;
        // Right block starts at the middle + some padding if desired, or just exactly 50%
        // User asked for "same width for symmetry".
        const rightX = PAGE_MARGIN + colWidth + 10;

        const headerLines = [
            safeStr(data.companyName).toUpperCase(),
            'SOLUCIONES ELÉCTRICAS',
            'ELECTRICISTA MATRICULADO',
            // Phone | Email line will be added dynamically
        ];

        // Calculate blue block height roughly
        // Fixed height of 80 seems appropriate for 4-5 lines of text
        const headerHeight = 85;

        // Blue Block Top-Left
        page.drawRectangle({
            x: leftX,
            y: cursorY - headerHeight,
            width: colWidth - 5, // Slight gap
            height: headerHeight,
            color: COLORS.primary,
        });

        // Left Content (White text on Blue)
        let textY = cursorY - 25;

        page.drawText(safeStr(data.companyName).toUpperCase(), {
            x: leftX + 10,
            y: textY,
            size: 14,
            font: fontBold,
            color: COLORS.headerText,
        });
        textY -= 18;

        page.drawText('SOLUCIONES ELÉCTRICAS', {
            x: leftX + 10,
            y: textY,
            size: 9,
            font: fontReg,
            color: COLORS.headerText,
        });
        textY -= 12;

        page.drawText('ELECTRICISTA MATRICULADO', {
            x: leftX + 10,
            y: textY,
            size: 8,
            font: fontReg,
            color: COLORS.headerText,
        });
        textY -= 16; // Gap before contact info

        // Contact Info Row
        const contactParts: string[] = [];
        if (data.companyPhone) contactParts.push(`Tel: ${data.companyPhone}`);
        if (data.companyEmail) contactParts.push(`Mail: ${data.companyEmail}`);

        const contactText = contactParts.join(' | ');
        if (contactText) {
            page.drawText(contactText, {
                x: leftX + 10,
                y: textY,
                size: 8,
                font: fontReg,
                color: COLORS.headerText,
            });
        }

        // Right Side Header (White block)
        let headY = cursorY - 25;

        page.drawText('PRESUPUESTO', {
            x: rightX,
            y: headY,
            size: 18,
            font: fontBold,
            color: COLORS.primary,
        });
        headY -= 20;

        // Work Title (wrapped)
        const titleLines = wrap(safeStr(data.workTitle).toUpperCase(), fontBold, 10, colWidth - 20);
        titleLines.forEach(l => {
            page.drawText(l, { x: rightX, y: headY, size: 10, font: fontBold, color: COLORS.textMain });
            headY -= 12;
        });

        headY -= 8;

        // Dates
        page.drawText(`Fecha: ${data.issueDate}`, { x: rightX, y: headY, size: 9, font: fontReg, color: COLORS.textMain });
        headY -= 12;
        if (data.validUntil) {
            page.drawText(`Válido hasta: ${data.validUntil}`, { x: rightX, y: headY, size: 9, font: fontReg, color: COLORS.textMain });
        }

        // Update cursorY
        cursorY = cursorY - headerHeight - 20;
    };

    const drawHeaderMini = () => {
        // Simple header: Title + Budget Number
        page.drawText('PRESUPUESTO (cont.)', {
            x: PAGE_MARGIN,
            y: cursorY - 10,
            size: 10,
            font: fontBold,
            color: COLORS.textMuted
        });
        page.drawText(`${data.budgetNumber}`, {
            x: width - PAGE_MARGIN - 50,
            y: cursorY - 10,
            size: 10,
            font: fontBold,
            color: COLORS.textMuted
        });

        // Line separator
        page.drawLine({
            start: { x: PAGE_MARGIN, y: cursorY - 15 },
            end: { x: width - PAGE_MARGIN, y: cursorY - 15 },
            thickness: 0.5,
            color: COLORS.border
        });

        cursorY -= 30; // Spacing after mini header
    };

    const drawClientBlock = () => {
        // Calculate height
        const clientName = safeStr(data.clientName);
        const addressLines = wrap(safeStr(data.clientAddress), fontReg, 9, 300);

        let blockHeight = 20; // Title + Name
        blockHeight += addressLines.length * 11;
        if (data.clientPhone) blockHeight += 11;
        if (data.clientEmail) blockHeight += 11;

        ensureSpace(blockHeight + 20); // Add breathing room

        let blockY = cursorY;

        // Col 1: Client Data
        page.drawText('CLIENTE:', { x: PAGE_MARGIN, y: blockY, size: 9, font: fontBold, color: COLORS.primary });
        page.drawText(clientName, { x: PAGE_MARGIN + 50, y: blockY, size: 9, font: fontBold });
        blockY -= 12;

        addressLines.forEach(l => {
            page.drawText(l, { x: PAGE_MARGIN + 50, y: blockY, size: 9, font: fontReg });
            blockY -= 11;
        });

        if (data.clientPhone) {
            page.drawText(`Tel: ${data.clientPhone}`, { x: PAGE_MARGIN + 50, y: blockY, size: 9, font: fontReg, color: COLORS.textMuted });
            blockY -= 11;
        }
        if (data.clientEmail) {
            page.drawText(`Email: ${data.clientEmail}`, { x: PAGE_MARGIN + 50, y: blockY, size: 9, font: fontReg, color: COLORS.textMuted });
            blockY -= 11;
        }

        // Update cursorY to lowest point
        cursorY = blockY - 20;
    };

    const drawItemsTable = () => {
        // Define Column Bounds
        const tableX = PAGE_MARGIN;
        const tableW = width - 2 * PAGE_MARGIN;

        // Fixed widths for numeric cols
        const idxW = 30;
        const priceW = 80;
        const qtyW = 60;
        const totalW = 80; // slightly larger to fit total

        // Calculate bounds
        const cols = {
            idx: { left: tableX, right: tableX + idxW },
            desc: { left: tableX + idxW, right: width - PAGE_MARGIN - priceW - qtyW - totalW },
            price: { left: width - PAGE_MARGIN - priceW - qtyW - totalW, right: width - PAGE_MARGIN - qtyW - totalW },
            qty: { left: width - PAGE_MARGIN - qtyW - totalW, right: width - PAGE_MARGIN - totalW },
            total: { left: width - PAGE_MARGIN - totalW, right: width - PAGE_MARGIN }
        };

        const drawTableHeader = () => {
            page.drawRectangle({
                x: PAGE_MARGIN,
                y: cursorY - 20,
                width: width - 2 * PAGE_MARGIN,
                height: 20,
                color: COLORS.tableHeaderBg
            });

            const txtY = cursorY - 14;
            // Center headers in their columns or left align?
            // "dibujar textos centrados o left dentro de cada COL.*"
            page.drawText('ÍTEM', { x: cols.idx.left + 5, y: txtY, size: 8, font: fontBold });
            page.drawText('TAREA / DESCRIPCIÓN', { x: cols.desc.left + 5, y: txtY, size: 8, font: fontBold });
            page.drawText('PRECIO', { x: cols.price.left + 5, y: txtY, size: 8, font: fontBold });
            page.drawText('CANT', { x: cols.qty.left + 5, y: txtY, size: 8, font: fontBold });
            page.drawText('TOTAL', { x: cols.total.left + 5, y: txtY, size: 8, font: fontBold });

            // Vertical Separators (Header)
            const drawVertLine = (x: number) => {
                page.drawLine({
                    start: { x: x, y: cursorY },
                    end: { x: x, y: cursorY - 20 },
                    thickness: 0.5,
                    color: COLORS.border
                });
            };
            drawVertLine(cols.desc.left);
            drawVertLine(cols.price.left);
            drawVertLine(cols.qty.left);
            drawVertLine(cols.total.left);
            drawVertLine(cols.total.right);

            cursorY -= 20;
        };

        // Header check
        if (ensureSpace(40).didBreak) {
            // New page created, ensureSpace draws mini header. 
        }
        drawTableHeader();
        cursorY -= 5;

        // Constants for row sizing
        const MIN_ROW_H = 20;
        const LINE_H = 11;
        const PAD_Y = 6;

        // Rows
        data.items.forEach((item, idx) => {
            const desc = safeStr(item.description || "—");

            const qty = safeNum(item.quantity);
            const unitPrice = safeNum(item.unitPrice);
            const total = safeNum(item.total);

            // Calculate height
            const descWidth = cols.desc.right - cols.desc.left - 10;
            const descLines = wrap(desc, fontReg, 9, descWidth);

            const rowHeight = Math.max(MIN_ROW_H, descLines.length * LINE_H + (PAD_Y * 2));

            // Ensure Space BEFORE drawing (with +2 margin as requested)
            const { didBreak, page: currentPage } = ensureSpace(rowHeight + 2);
            if (didBreak) {
                drawTableHeader();
                cursorY -= 5;
            }

            // Draw Zebra / Background
            currentPage.drawRectangle({
                x: PAGE_MARGIN,
                y: cursorY - rowHeight,
                width: width - 2 * PAGE_MARGIN,
                height: rowHeight,
                color: idx % 2 === 1 ? COLORS.zebra : rgb(1, 1, 1),
            });

            // Draw Text
            const textY = cursorY - PAD_Y - 7; // Approx baseline adjustment

            currentPage.drawText(`${idx + 1}`, { x: cols.idx.left + 5, y: textY, size: 9, font: fontReg });

            descLines.forEach((l, i) => {
                currentPage.drawText(l, { x: cols.desc.left + 5, y: textY - (i * LINE_H), size: 9, font: fontReg });
            });

            // Numbers
            const priceStr = formatCurrency(unitPrice, item.priceText);
            const qtyStr = qty.toString();
            // If qty is 0, show "—" optionally? User said: (si es 0 mostrar "0" o "—", pero que aparezca)
            // Let's stick to safeNum returning number, toString gives "0".
            const totalStr = formatCurrency(total, item.totalText);

            // Right Align with 8px padding from right edge of column
            currentPage.drawText(priceStr, { x: cols.price.right - 8 - fontReg.widthOfTextAtSize(priceStr, 9), y: textY, size: 9, font: fontReg });
            currentPage.drawText(qtyStr, { x: cols.qty.right - 8 - fontReg.widthOfTextAtSize(qtyStr, 9), y: textY, size: 9, font: fontReg });
            currentPage.drawText(totalStr, { x: cols.total.right - 8 - fontReg.widthOfTextAtSize(totalStr, 9), y: textY, size: 9, font: fontReg });

            // Vertical Separators (Thin lines)
            const drawVertLine = (x: number) => {
                currentPage.drawLine({
                    start: { x: x, y: cursorY },
                    end: { x: x, y: cursorY - rowHeight },
                    thickness: 0.5,
                    color: COLORS.border
                });
            };

            drawVertLine(cols.desc.left);
            drawVertLine(cols.price.left);
            drawVertLine(cols.qty.left);
            drawVertLine(cols.total.left);
            drawVertLine(cols.total.right);

            // Bottom border
            currentPage.drawLine({
                start: { x: PAGE_MARGIN, y: cursorY - rowHeight },
                end: { x: width - PAGE_MARGIN, y: cursorY - rowHeight },
                thickness: 0.5,
                color: COLORS.border
            });

            cursorY -= rowHeight;
        });

        cursorY -= 15; // Gap after table
    };

    const drawMaterialsTable = () => {
        if (!data.materials || data.materials.length === 0) return;

        // Title
        if (ensureSpace(30).didBreak) { }
        page.drawText('MATERIALES ESTIMADOS', { x: PAGE_MARGIN, y: cursorY, size: 10, font: fontBold, color: COLORS.primary });
        cursorY -= 15;

        // Define Column Bounds (Same as Items for consistency)
        const tableX = PAGE_MARGIN;
        const tableW = width - 2 * PAGE_MARGIN;
        const idxW = 30;
        const priceW = 80;
        const qtyW = 60;
        const totalW = 80;

        const cols = {
            idx: { left: tableX, right: tableX + idxW },
            desc: { left: tableX + idxW, right: width - PAGE_MARGIN - priceW - qtyW - totalW },
            price: { left: width - PAGE_MARGIN - priceW - qtyW - totalW, right: width - PAGE_MARGIN - qtyW - totalW },
            qty: { left: width - PAGE_MARGIN - qtyW - totalW, right: width - PAGE_MARGIN - totalW },
            total: { left: width - PAGE_MARGIN - totalW, right: width - PAGE_MARGIN }
        };

        const drawTableHeader = () => {
            page.drawRectangle({
                x: PAGE_MARGIN,
                y: cursorY - 20,
                width: width - 2 * PAGE_MARGIN,
                height: 20,
                color: COLORS.tableHeaderBg
            });
            const txtY = cursorY - 14;
            page.drawText('ÍTEM', { x: cols.idx.left + 5, y: txtY, size: 8, font: fontBold });
            page.drawText('MATERIAL', { x: cols.desc.left + 5, y: txtY, size: 8, font: fontBold });
            page.drawText('PRECIO', { x: cols.price.left + 5, y: txtY, size: 8, font: fontBold });
            page.drawText('CANT', { x: cols.qty.left + 5, y: txtY, size: 8, font: fontBold });
            page.drawText('TOTAL', { x: cols.total.left + 5, y: txtY, size: 8, font: fontBold });

            // Vertical Separators (Header)
            const drawVertLine = (x: number) => {
                page.drawLine({
                    start: { x: x, y: cursorY },
                    end: { x: x, y: cursorY - 20 },
                    thickness: 0.5,
                    color: COLORS.border
                });
            };
            drawVertLine(cols.desc.left);
            drawVertLine(cols.price.left);
            drawVertLine(cols.qty.left);
            drawVertLine(cols.total.left);
            drawVertLine(cols.total.right);

            cursorY -= 20;
        };

        if (ensureSpace(40).didBreak) { }
        drawTableHeader();
        cursorY -= 5;

        // Constants
        const MIN_ROW_H = 20;
        const LINE_H = 11;
        const PAD_Y = 6;

        data.materials.forEach((item, idx) => {
            // Fix description fallback: try item.name, then item.description
            const desc = safeStr((item as any).name ?? item.description ?? "—");

            // Fix CANT: ensure qty is drawn even if 0
            const qty = safeNum((item as any).quantity ?? (item as any).cantidad ?? 0);

            const unitPrice = safeNum((item as any).unitPrice ?? (item as any).precioUnitario ?? 0);
            const total = safeNum((item as any).total ?? (qty * unitPrice));

            const descWidth = cols.desc.right - cols.desc.left - 10;
            const descLines = wrap(desc, fontReg, 9, descWidth);
            const rowHeight = Math.max(MIN_ROW_H, descLines.length * LINE_H + (PAD_Y * 2));

            const { didBreak, page: currentPage } = ensureSpace(rowHeight + 2);
            if (didBreak) {
                drawTableHeader();
                cursorY -= 5;
            }

            // Draw Zebra / Background
            currentPage.drawRectangle({
                x: PAGE_MARGIN,
                y: cursorY - rowHeight,
                width: width - 2 * PAGE_MARGIN,
                height: rowHeight,
                color: idx % 2 === 1 ? COLORS.zebra : rgb(1, 1, 1),
            });

            const textY = cursorY - PAD_Y - 7;
            currentPage.drawText('•', { x: cols.idx.left + 5, y: textY, size: 9, font: fontReg });

            descLines.forEach((l, i) => {
                currentPage.drawText(l, { x: cols.desc.left + 5, y: textY - (i * LINE_H), size: 9, font: fontReg });
            });

            // Right Alignment Logic
            currentPage.drawText(formatCurrency(unitPrice), { x: cols.price.right - 8 - fontReg.widthOfTextAtSize(formatCurrency(unitPrice), 9), y: textY, size: 9, font: fontReg });
            currentPage.drawText(qty.toString(), { x: cols.qty.right - 8 - fontReg.widthOfTextAtSize(qty.toString(), 9), y: textY, size: 9, font: fontReg });
            currentPage.drawText(formatCurrency(total), { x: cols.total.right - 8 - fontReg.widthOfTextAtSize(formatCurrency(total), 9), y: textY, size: 9, font: fontReg });

            // Vertical Separators
            const drawVertLine = (x: number) => {
                currentPage.drawLine({
                    start: { x: x, y: cursorY },
                    end: { x: x, y: cursorY - rowHeight },
                    thickness: 0.5,
                    color: COLORS.border
                });
            };

            drawVertLine(cols.desc.left);
            drawVertLine(cols.price.left);
            drawVertLine(cols.qty.left);
            drawVertLine(cols.total.left);
            drawVertLine(cols.total.right);

            // Bottom border
            currentPage.drawLine({
                start: { x: PAGE_MARGIN, y: cursorY - rowHeight },
                end: { x: width - PAGE_MARGIN, y: cursorY - rowHeight },
                thickness: 0.5,
                color: COLORS.border
            });

            cursorY -= rowHeight;
        });

        cursorY -= 15;
    };

    const drawTotals = () => {
        const boxHeight = 70;
        ensureSpace(boxHeight);

        const totalsX = width - PAGE_MARGIN - 200;
        const totalsValX = width - PAGE_MARGIN - 80;

        // Separator line
        page.drawLine({ start: { x: totalsX, y: cursorY }, end: { x: width - PAGE_MARGIN, y: cursorY }, thickness: 1, color: COLORS.border });
        cursorY -= 5;

        // Subtotal
        page.drawText('SUBTOTAL:', { x: totalsX, y: cursorY - 10, size: 10, font: fontBold });
        page.drawText(formatCurrency(data.subtotal), { x: totalsValX, y: cursorY - 10, size: 10, font: fontReg });
        cursorY -= 20;

        // Discount
        if (data.discount > 0) {
            page.drawText('DESCUENTO:', { x: totalsX, y: cursorY - 10, size: 10, font: fontBold });
            page.drawText(`-${formatCurrency(data.discount)}`, { x: totalsValX, y: cursorY - 10, size: 10, font: fontReg });
            cursorY -= 20;
        }

        // Total Final Box
        page.drawRectangle({
            x: totalsX - 10,
            y: cursorY - 25,
            width: 220,
            height: 30,
            color: COLORS.accent
        });

        page.drawText('TOTAL FINAL:', { x: totalsX, y: cursorY - 18, size: 12, font: fontBold, color: COLORS.primary });
        page.drawText(formatCurrency(data.total), { x: totalsValX, y: cursorY - 18, size: 12, font: fontBold, color: COLORS.primary });

        cursorY -= 40;
    };

    const drawSection = (title: string, content: string | string[]) => {
        if (!content || (Array.isArray(content) && content.length === 0)) return;

        // Normalize to array of lines
        let rawLines: string[] = [];
        if (Array.isArray(content)) {
            content.forEach(c => {
                rawLines.push(...wrap(`• ${c}`, fontReg, 9, width - 2 * PAGE_MARGIN - 20));
            });
        } else {
            rawLines = wrap(content, fontReg, 9, width - 2 * PAGE_MARGIN - 20);
        }

        const blockHeight = 25 + (rawLines.length * 11) + 10;

        // Ensure space for the whole block if reasonably sized, else split (for now simplistic: ensure whole)
        // If block > page, force new page then draw. If still > page, it will overflow (known imitation).
        ensureSpace(Math.min(blockHeight, height - 100));

        // Draw Accent
        page.drawLine({
            start: { x: PAGE_MARGIN, y: cursorY },
            end: { x: PAGE_MARGIN, y: cursorY - blockHeight + 10 },
            thickness: 3,
            color: COLORS.primary
        });

        // Title
        page.drawText(title, { x: PAGE_MARGIN + 15, y: cursorY - 10, size: 10, font: fontBold, color: COLORS.primary });

        let textY = cursorY - 25;
        rawLines.forEach(l => {
            // Check page break inside long section
            if (ensureSpace(12).didBreak) {
                textY = cursorY; // Reset to top of new page
                // Optional: Redraw accent or title? For now just flow text.
            }
            page.drawText(l, { x: PAGE_MARGIN + 15, y: textY, size: 9, font: fontReg, color: COLORS.textMain });
            textY -= 11;
        });

        cursorY = textY - 15;
    };

    const drawSignature = async () => {
        if (data.signatureBase64 && data.signatureBase64.startsWith('data:image')) {
            const sigHeight = 90;
            ensureSpace(sigHeight);

            try {
                const imgBytes = await fetch(data.signatureBase64).then(res => res.arrayBuffer());
                let img;
                if (data.signatureBase64.startsWith('data:image/png')) img = await doc.embedPng(imgBytes);
                else img = await doc.embedJpg(imgBytes);

                const dims = img.scale(0.5);
                const xCent = (width - dims.width) / 2;

                page.drawImage(img, {
                    x: xCent,
                    y: cursorY - dims.height,
                    width: dims.width,
                    height: dims.height
                });

                cursorY -= (dims.height + 5);

                // Line + Name
                page.drawLine({ start: { x: width / 2 - 80, y: cursorY }, end: { x: width / 2 + 80, y: cursorY }, thickness: 1, color: COLORS.primary });
                cursorY -= 12;
                page.drawText('FIRMA DEL PRESTADOR', { x: width / 2 - 45, y: cursorY, size: 8, font: fontReg });
                cursorY -= 12;
                page.drawText(safeStr(data.companyName), { x: width / 2 - 25, y: cursorY, size: 8, font: fontReg });

                cursorY -= 20;

            } catch (e) {
                console.error("Sig render error", e);
            }
        } else {
            // Placeholder if no signature? User requirement: "Si no existe: mostrar texto... (ya lo tienen)"
            // Actually prompt says "Si no existe: mostrar texto 'Sin firma cargada...'". 
            // Previous code didn't render anything if no sig. I'll add a simple placeholder if desired, 
            // but usually cleaner to just leave blank or draw the line for manual signature.
            // Prompt 7) says "Si no existe ... Dibujar línea + FIRMA ...".

            ensureSpace(60);
            cursorY -= 30; // space for signing
            page.drawLine({ start: { x: width / 2 - 80, y: cursorY }, end: { x: width / 2 + 80, y: cursorY }, thickness: 1, color: COLORS.primary });
            cursorY -= 12;
            page.drawText('FIRMA DEL PRESTADOR', { x: width / 2 - 45, y: cursorY, size: 8, font: fontReg });
            cursorY -= 12;
            page.drawText(safeStr(data.companyName), { x: width / 2 - 25, y: cursorY, size: 8, font: fontReg });
            cursorY -= 20;
        }
    };

    const drawFooter = () => {
        const pageCount = doc.getPageCount();
        if (pageCount <= 1) return; // Only if > 1 page

        for (let i = 0; i < pageCount; i++) {
            const p = doc.getPage(i);
            const { width } = p.getSize();
            const text = `Página ${i + 1} de ${pageCount}`;
            p.drawText(text, {
                x: width - PAGE_MARGIN - 60,
                y: 20,
                size: 8,
                font: fontReg,
                color: COLORS.textMuted
            });
        }
    };

    // --- EXECUTION FLOW ---

    // 1. Header (Page 1)
    drawHeaderFull();

    // 2. Client Block
    drawClientBlock();

    // 3. Items
    drawItemsTable();

    // 4. Materials
    drawMaterialsTable();

    // 5. Totals
    drawTotals();

    // 6. Sections
    if (data.excludedItems && data.excludedItems.length > 0) {
        drawSection('ÍTEMS NO COTIZADOS', data.excludedItems);
    }
    if (data.clarifications) drawSection('ACLARACIONES', data.clarifications);
    if (data.conditions) drawSection('CONDICIONES GENERALES', data.conditions);
    if (data.notes) drawSection('NOTAS', data.notes);
    if (data.paymentConditions) drawSection('CONDICIONES DE PAGO', data.paymentConditions);
    if (data.paymentMethod) drawSection('MÉTODO DE PAGO', data.paymentMethod);

    // 7. Signature
    await drawSignature();

    // 8. Footer
    drawFooter();

    return await doc.save();
};
