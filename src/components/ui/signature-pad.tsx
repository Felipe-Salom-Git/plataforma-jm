'use client';

import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Button } from './button';
import { Eraser } from 'lucide-react';

export interface SignaturePadRef {
    clear: () => void;
    isEmpty: () => boolean;
    getSVG: () => string | null;
}

interface Point {
    x: number;
    y: number;
}

export const SignaturePad = forwardRef<SignaturePadRef, { className?: string }>(({ className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    // Store strokes for SVG generation
    const [strokes, setStrokes] = useState<Point[][]>([]);
    const [currentStroke, setCurrentStroke] = useState<Point[]>([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Handle resizing
        const resize = () => {
            const rect = canvas.parentElement?.getBoundingClientRect();
            if (rect) {
                canvas.width = rect.width;
                canvas.height = 200; // Fixed height or flexible
                redraw();
            }
        };

        window.addEventListener('resize', resize);
        resize();

        return () => window.removeEventListener('resize', resize);
    }, []);

    const redraw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#000';

        strokes.forEach(stroke => drawStroke(ctx, stroke));
        // Draw current stroke if exists (though usually it's pushed to strokes only on end, or updated live)
        // For react state it's easier to just draw mostly from live ctx and rely on strokes for redraw/svg
    };

    const drawStroke = (ctx: CanvasRenderingContext2D, points: Point[]) => {
        if (points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
    };

    const getCoords = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): Point => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if ((e as React.TouchEvent).touches && (e as React.TouchEvent).touches.length > 0) {
            clientX = (e as React.TouchEvent).touches[0].clientX;
            clientY = (e as React.TouchEvent).touches[0].clientY;
        } else if ((e as any).changedTouches && (e as any).changedTouches.length > 0) {
            // For touchend
            clientX = (e as any).changedTouches[0].clientX;
            clientY = (e as any).changedTouches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault(); // Prevent scrolling on touch
        setIsDrawing(true);
        const p = getCoords(e);
        setCurrentStroke([p]);

        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#000';
            ctx.moveTo(p.x, p.y);
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        if (!isDrawing) return;
        const p = getCoords(e);

        // Add to current stroke data
        currentStroke.push(p);

        // Draw visually
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
        }
    };

    const endDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        if (currentStroke.length > 0) {
            setStrokes(prev => [...prev, [...currentStroke]]);
        }
        setCurrentStroke([]);
    };

    useImperativeHandle(ref, () => ({
        clear: () => {
            setStrokes([]);
            setCurrentStroke([]);
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx?.clearRect(0, 0, canvas.width, canvas.height);
            }
        },
        isEmpty: () => strokes.length === 0 && currentStroke.length === 0,
        getSVG: () => {
            if (strokes.length === 0) return null;
            const canvas = canvasRef.current;
            if (!canvas) return null;

            // Generate Path D
            let pathData = '';
            strokes.forEach(stroke => {
                if (stroke.length < 2) return;
                pathData += `M ${stroke[0].x.toFixed(2)} ${stroke[0].y.toFixed(2)} `;
                for (let i = 1; i < stroke.length; i++) {
                    pathData += `L ${stroke[i].x.toFixed(2)} ${stroke[i].y.toFixed(2)} `;
                }
            });

            return `<svg viewBox="0 0 ${canvas.width} ${canvas.height}" xmlns="http://www.w3.org/2000/svg">
                <path d="${pathData}" stroke="black" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`;
        }
    }));

    return (
        <div className={className}>
            <canvas
                ref={canvasRef}
                className="w-full h-[200px] border rounded-md touch-none bg-slate-50 cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={endDrawing}
                onMouseLeave={endDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={endDrawing}
            />
            <div className="flex justify-end mt-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        setStrokes([]);
                        const canvas = canvasRef.current;
                        if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
                    }}
                    type="button"
                >
                    <Eraser className="w-4 h-4 mr-2" /> Borrar
                </Button>
            </div>
        </div>
    );
});

SignaturePad.displayName = 'SignaturePad';
