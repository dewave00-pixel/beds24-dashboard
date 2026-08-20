'use client';

import { useRef, useEffect } from 'react';

interface ZoomableTimelineWrapperProps {
    zoomLevel: number;
    onUpdateZoomLevel: (newZoom: number) => void;
    children: React.ReactNode;
}

export default function ZoomableTimelineWrapper({
    zoomLevel,
    onUpdateZoomLevel,
    children,
}: ZoomableTimelineWrapperProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const touchStateRef = useRef<{
        initialDistance: number;
        initialZoom: number;
    } | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // 두 손가락 핀치 줌(Pinch-to-zoom) 터치 이벤트 리스너
        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const distance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );
                touchStateRef.current = {
                    initialDistance: distance,
                    initialZoom: zoomLevel,
                };
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2 && touchStateRef.current) {
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const distance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );

                if (touchStateRef.current.initialDistance > 0) {
                    const scaleFactor = distance / touchStateRef.current.initialDistance;
                    const calculatedZoom = touchStateRef.current.initialZoom * scaleFactor;
                    onUpdateZoomLevel(calculatedZoom);
                }
            }
        };

        const handleTouchEnd = () => {
            touchStateRef.current = null;
        };

        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: true });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });
        container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            container.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [zoomLevel, onUpdateZoomLevel]);

    return (
        <div
            ref={containerRef}
            className="w-full transition-[zoom] duration-150 ease-out origin-top-left"
            style={{
                zoom: zoomLevel,
                // Webkit 줌 지원
                WebkitTextSizeAdjust: '100%',
            }}
        >
            {children}
        </div>
    );
}
