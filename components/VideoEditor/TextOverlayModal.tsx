'use client';

import { useState, useEffect } from 'react';
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
  const [content, setContent] = useState('');
  const [position, setPosition] = useState<'top' | 'center' | 'bottom'>('center');
  const [fontSize, setFontSize] = useState(48);
  const [textColor, setTextColor] = useState('#ffffff');
  const [bgColor, setBgColor] = useState('#000000');
  const [bgOpacity, setBgOpacity] = useState(50);
  const [fontWeight, setFontWeight] = useState('700');

  useEffect(() => {
    if (isOpen && clip?.textOverlay) {
      setContent(clip.textOverlay.content);
      setPosition(clip.textOverlay.position);
      setFontSize(clip.textOverlay.fontSize);
      setTextColor(clip.textOverlay.textColor);
      setBgColor(clip.textOverlay.bgColor);
      setBgOpacity(clip.textOverlay.bgOpacity);
      setFontWeight(clip.textOverlay.fontWeight);
    } else if (isOpen && !clip?.textOverlay) {
      // Reset to defaults
      setContent('');
      setPosition('center');
      setFontSize(48);
      setTextColor('#ffffff');
      setBgColor('#000000');
      setBgOpacity(50);
      setFontWeight('700');
    }
  }, [isOpen, clip]);

  const handleSave = () => {
    if (!clipId) return;

    if (content.trim()) {
      const textOverlay: TextOverlay = {
        content,
        position,
        fontSize,
        textColor,
        bgColor,
        bgOpacity,
        fontWeight,
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
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter your text..."
            className="w-full bg-[#333] border border-[#444] text-white p-2.5 rounded-md text-sm resize-vertical min-h-[80px]"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block mb-2 font-medium text-sm">Position</label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as any)}
              className="w-full bg-[#333] border border-[#444] text-white p-2.5 rounded-md text-sm"
            >
              <option value="top">Top</option>
              <option value="center">Center</option>
              <option value="bottom">Bottom</option>
            </select>
          </div>

          <div>
            <label className="block mb-2 font-medium text-sm">
              Font Size: {fontSize}px
            </label>
            <input
              type="range"
              min="20"
              max="120"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
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
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="w-[50px] h-10 border-none rounded-md cursor-pointer"
              />
              <input
                type="text"
                value={textColor}
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
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-[50px] h-10 border-none rounded-md cursor-pointer"
              />
              <input
                type="text"
                value={bgColor}
                readOnly
                className="flex-1 bg-[#333] border border-[#444] text-white p-2.5 rounded-md text-sm"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block mb-2 font-medium text-sm">
              Background Opacity: {bgOpacity}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={bgOpacity}
              onChange={(e) => setBgOpacity(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block mb-2 font-medium text-sm">Font Weight</label>
            <select
              value={fontWeight}
              onChange={(e) => setFontWeight(e.target.value)}
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
