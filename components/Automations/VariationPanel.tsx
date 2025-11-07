'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clip, Variation } from '@/types';
import { VARIATION_TEMPLATES } from '@/lib/variations/templates';
import JobBadge from './JobBadge';

interface VariationPanelProps {
  clip: Clip | null;
  variations: Variation[];
  onGenerate: (input: {
    prompt?: string;
    templateIds: string[];
    count?: number;
  }) => Promise<void> | void;
  onQueueRender: (variationIds: string[]) => Promise<void> | void;
  onClose: () => void;
}

export default function VariationPanel({
  clip,
  variations,
  onGenerate,
  onQueueRender,
  onClose,
}: VariationPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(2);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(
    () => new Set([VARIATION_TEMPLATES[0]?.id])
  );
  const [selectedVariations, setSelectedVariations] = useState<Set<string>>(
    new Set()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setSelectedVariations(new Set());
  }, [variations]);

  const sortedVariations = useMemo(
    () =>
      [...variations].sort((a, b) => (a.templateId + a.id).localeCompare(b.templateId + b.id)),
    [variations]
  );

  if (!clip) return null;

  const toggleTemplate = (templateId: string) => {
    setSelectedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next.size ? next : new Set([templateId]);
    });
  };

  const toggleVariation = (variationId: string) => {
    setSelectedVariations((prev) => {
      const next = new Set(prev);
      if (next.has(variationId)) {
        next.delete(variationId);
      } else {
        next.add(variationId);
      }
      return next;
    });
  };

  const handleGenerate = async () => {
    if (!selectedTemplates.size) return;
    setIsSubmitting(true);
    try {
      await onGenerate({
        prompt: prompt.trim() || undefined,
        templateIds: Array.from(selectedTemplates),
        count,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQueueSelected = async () => {
    if (!selectedVariations.size) return;
    await onQueueRender(Array.from(selectedVariations));
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60">
      <div className="w-full max-w-xl bg-[#181818] h-full p-6 overflow-y-auto border-l border-[#333]">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[#888] m-0">
              Variations for Clip #{clip.id}
            </p>
            <h3 className="text-2xl font-semibold m-0">{clip.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#bbb] hover:text-white text-2xl leading-none bg-transparent border-none cursor-pointer"
            aria-label="Close variation panel"
          >
            ×
          </button>
        </div>

        <section className="mb-6">
          <h4 className="text-sm uppercase tracking-wide text-[#777] mb-2">
            Prompt &amp; Templates
          </h4>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Add optional guidance (tone, CTA, keywords)"
            rows={3}
            className="w-full bg-[#1f1f1f] border border-[#333] rounded-lg p-3 text-sm text-white focus:outline-none focus:border-[#0a84ff]"
          />
          <div className="flex items-center gap-3 mt-3 text-sm">
            <label htmlFor="variation-count" className="text-[#bbb]">
              Variations per template
            </label>
            <input
              id="variation-count"
              type="number"
              min={1}
              max={4}
              value={count}
              onChange={(event) => setCount(Math.max(1, Math.min(4, Number(event.target.value))))}
              className="w-20 bg-transparent border border-[#444] rounded px-2 py-1 text-white"
            />
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {VARIATION_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => toggleTemplate(template.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  selectedTemplates.has(template.id)
                    ? 'bg-[#0a84ff] border-[#0a84ff] text-white'
                    : 'bg-transparent border-[#333] text-[#bbb]'
                }`}
              >
                {template.name}
              </button>
            ))}
          </div>

          <button
            onClick={handleGenerate}
            disabled={isSubmitting}
            className="mt-4 bg-[#0a84ff] w-full text-center text-white font-semibold py-2.5 rounded-lg hover:bg-[#0066cc] disabled:opacity-60"
          >
            {isSubmitting ? 'Generating…' : 'Generate Variations'}
          </button>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm uppercase tracking-wide text-[#777] m-0">
              Generated Variations ({variations.length})
            </h4>
            <button
              onClick={handleQueueSelected}
              disabled={!selectedVariations.size}
              className="text-xs bg-[#30d158] text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
            >
              Queue {selectedVariations.size || ''} for render
            </button>
          </div>

          {!variations.length ? (
            <div className="text-center text-[#666] py-8 text-sm">
              Generate a few overlays to see them here.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sortedVariations.map((variation) => (
                <div
                  key={variation.id}
                  className="border border-[#333] rounded-lg p-3 bg-[#1f1f1f]"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedVariations.has(variation.id)}
                        onChange={() => toggleVariation(variation.id)}
                        className="w-4 h-4"
                      />
                      <p className="text-sm font-semibold m-0">{variation.templateId}</p>
                    </div>
                    <JobBadge status={variation.status} />
                  </div>
                  <p className="text-xs text-[#bbb] m-0">
                    {variation.overlay.content}
                  </p>
                  <p className="text-[11px] text-[#666] mt-1 mb-0">
                    Position: {variation.overlay.position} · Size:{' '}
                    {variation.overlay.fontSize}px · BG {variation.overlay.bgOpacity}%
                  </p>
                  <button
                    onClick={() => onQueueRender([variation.id])}
                    className="mt-3 text-xs bg-transparent border border-[#444] text-white px-3 py-1.5 rounded-lg hover:border-[#666]"
                  >
                    Queue Render
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

