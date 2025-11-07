'use client';

import { useState } from 'react';
import { Clip, TextOverlay } from '@/types';

interface TextOverlayModalProps {
  isOpen: boolean;
  clipId: number | null;
  clip?: Clip;
  onClose: () => void;
  onSave: (clipId: number, textOverlay: TextOverlay | null) => void;
}

export default function TextOverlayModal({
  isOpen,
  clipId,
  clip,
  onClose,
  onSave,
}: TextOverlayModalProps) {
  const buildInitialFormState = (targetClip?: Clip) => ({
    content: targetClip?.textOverlay?.content ?? '',
    position: targetClip?.textOverlay?.position ?? 'center',
    fontSize: targetClip?.textOverlay?.fontSize ?? 48,
    textColor: targetClip?.textOverlay?.textColor ?? '#ffffff',
    bgColor: targetClip?.textOverlay?.bgColor ?? '#000000',
    bgOpacity: targetClip?.textOverlay?.bgOpacity ?? 50,
    fontWeight: targetClip?.textOverlay?.fontWeight ?? '700',
  });

  const [formState, setFormState] = useState(() => buildInitialFormState(clip));

  const updateFormState = <K extends keyof typeof formState>(
    key: K,
    value: (typeof formState)[K]
  ) => {
    setFormState(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = () => {
    if (!clipId) return;

    const trimmedContent = formState.content.trim();

    if (trimmedContent) {
      const textOverlay: TextOverlay = {
        content: trimmedContent,
        position: formState.position,
        fontSize: formState.fontSize,
        textColor: formState.textColor,
        bgColor: formState.bgColor,
        bgOpacity: formState.bgOpacity,
        fontWeight: formState.fontWeight,
      };
      onSave(clipId, textOverlay);
    } else {
      onSave(clipId, null);
    }
    onClose();
  };

  const handleRemove = () => {
    if (!clipId) return;
    onSave(clipId, null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-[#2a2a2a] p-8 rounded-xl max-w-[600px] w-[90%] max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xl font-semibold">Add Text Overlay</h3>
          <button
            onClick={onClose}
            className="bg-[#444] border-none text-white text-2xl cursor-pointer w-8 h-8 rounded-md flex items-center justify-center hover:bg-[#555] p-0"
          >
            ×
          </button>
        </div>

        <div className="mb-5">
          <label className="block mb-2 font-medium text-sm">Text Content</label>
          <textarea
            value={formState.content}
            onChange={(e) => updateFormState('content', e.target.value)}
            placeholder="Enter your text..."
            className="w-full bg-[#333] border border-[#444] text-white p-2.5 rounded-md text-sm resize-vertical min-h-[80px]"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block mb-2 font-medium text-sm">Position</label>
            <select
              value={formState.position}
              onChange={(e) =>
                updateFormState('position', e.target.value as 'top' | 'center' | 'bottom')
              }
              className="w-full bg-[#333] border border-[#444] text-white p-2.5 rounded-md text-sm"
            >
              <option value="top">Top</option>
              <option value="center">Center</option>
              <option value="bottom">Bottom</option>
            </select>
          </div>

          <div>
            <label className="block mb-2 font-medium text-sm">
              Font Size: {formState.fontSize}px
            </label>
            <input
              type="range"
              min="20"
              max="120"
              value={formState.fontSize}
              onChange={(e) => updateFormState('fontSize', Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block mb-2 font-medium text-sm">Text Color</label>
            <div className="flex gap-2.5 items-center">
              <input
                type="color"
                value={formState.textColor}
                onChange={(e) => updateFormState('textColor', e.target.value)}
                className="w-[50px] h-10 border-none rounded-md cursor-pointer"
              />
              <input
                type="text"
                value={formState.textColor}
                readOnly
                className="flex-1 bg-[#333] border border-[#444] text-white p-2.5 rounded-md text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block mb-2 font-medium text-sm">Background Color</label>
            <div className="flex gap-2.5 items-center">
              <input
                type="color"
                value={formState.bgColor}
                onChange={(e) => updateFormState('bgColor', e.target.value)}
                className="w-[50px] h-10 border-none rounded-md cursor-pointer"
              />
              <input
                type="text"
                value={formState.bgColor}
                readOnly
                className="flex-1 bg-[#333] border border-[#444] text-white p-2.5 rounded-md text-sm"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block mb-2 font-medium text-sm">
              Background Opacity: {formState.bgOpacity}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={formState.bgOpacity}
              onChange={(e) => updateFormState('bgOpacity', Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block mb-2 font-medium text-sm">Font Weight</label>
            <select
              value={formState.fontWeight}
              onChange={(e) => updateFormState('fontWeight', e.target.value)}
              className="w-full bg-[#333] border border-[#444] text-white p-2.5 rounded-md text-sm"
            >
              <option value="400">Normal</option>
              <option value="600">Semi-Bold</option>
              <option value="700">Bold</option>
              <option value="900">Black</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2.5 mt-5">
          <button
            onClick={handleSave}
            className="flex-1 bg-[#30d158] text-white border-none px-5 py-2.5 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#28a745] transition-all"
          >
            Save Text
          </button>
          <button
            onClick={handleRemove}
            className="flex-1 bg-[#ff453a] text-white border-none px-5 py-2.5 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#cc362e] transition-all"
          >
            Remove Text
          </button>
          <button
            onClick={onClose}
            className="bg-[#444] text-white border-none px-5 py-2.5 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#555] transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
