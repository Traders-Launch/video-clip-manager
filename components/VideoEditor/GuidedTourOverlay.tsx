'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

interface TourStep {
  targetId: string;
  title: string;
  description: string;
}

interface GuidedTourOverlayProps {
  steps: TourStep[];
  onClose: () => void;
  onSkip?: () => void;
}

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function GuidedTourOverlay({
  steps,
  onClose,
  onSkip,
}: GuidedTourOverlayProps) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<HighlightRect | null>(null);

  const step = steps[index];

  const calculateRect = useCallback(() => {
    if (typeof window === 'undefined') return;
    const element = document.querySelector<HTMLElement>(
      `[data-tour-id="${step?.targetId}"]`
    );
    if (element) {
      const bounds = element.getBoundingClientRect();
      setRect({
        top: bounds.top - 8,
        left: bounds.left - 8,
        width: bounds.width + 16,
        height: bounds.height + 16,
      });
    } else {
      const width = Math.min(420, window.innerWidth - 48);
      const height = 240;
      setRect({
        top: window.innerHeight / 2 - height / 2,
        left: window.innerWidth / 2 - width / 2,
        width,
        height,
      });
    }
  }, [step?.targetId]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      calculateRect();
    });
    return () => cancelAnimationFrame(frame);
  }, [calculateRect, index]);

  useEffect(() => {
    const onResize = () => calculateRect();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
      document.body.style.overflow = '';
    };
  }, [calculateRect]);

  if (!step) return null;

  const isLastStep = index === steps.length - 1;
  const highlightStyle: React.CSSProperties = rect
    ? {
        top: Math.max(rect.top, 16),
        left: Math.max(rect.left, 16),
        width: rect.width,
        height: rect.height,
      }
    : { top: '25%', left: '10%', width: '80%', height: '50%' };

  const cardTop = rect
    ? Math.min(rect.top + rect.height + 24, window.innerHeight - 220)
    : 80;
  const cardLeft = rect
    ? Math.min(rect.left, window.innerWidth - 360)
    : window.innerWidth / 2 - 180;

  return (
    <div className="fixed inset-0 z-[1200]">
      <div className="absolute inset-0 bg-black/70" />

      <div
        className="fixed border border-[#0a84ff] rounded-2xl pointer-events-none transition-all duration-200"
        style={{
          ...highlightStyle,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
        }}
      />

      <div
        className="fixed w-[340px] max-w-[90vw] bg-[#1f1f1f] text-white rounded-2xl border border-[#333] shadow-2xl p-5"
        style={{
          top: cardTop,
          left: cardLeft,
        }}
      >
        <p className="text-xs uppercase tracking-[0.2em] text-[#888] mb-1">
          Step {index + 1} / {steps.length}
        </p>
        <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
        <p className="text-sm text-[#ccc] mb-4">{step.description}</p>

        <div className="flex justify-between items-center gap-3 text-sm">
          <button
            onClick={() => {
              if (onSkip) onSkip();
              else onClose();
            }}
            className="text-[#bbb] hover:text-white transition-colors"
          >
            Skip tour
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => setIndex((prev) => Math.max(prev - 1, 0))}
              disabled={index === 0}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                index === 0
                  ? 'opacity-40 cursor-not-allowed border-[#444]'
                  : 'border-[#444] hover:border-[#666]'
              }`}
            >
              Back
            </button>
            <button
              onClick={() => {
                if (isLastStep) {
                  onClose();
                } else {
                  setIndex((prev) => Math.min(prev + 1, steps.length - 1));
                }
              }}
              className="px-4 py-1.5 rounded-lg bg-[#0a84ff] text-white text-xs font-semibold hover:bg-[#0066cc] transition-colors"
            >
              {isLastStep ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
