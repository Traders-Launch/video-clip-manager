'use client';

import { useRef } from 'react';

interface VideoImportProps {
  onVideoLoad: (file: File) => void;
}

export default function VideoImport({ onVideoLoad }: VideoImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onVideoLoad(file);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white p-6">
      <div className="max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-semibold mb-6">Video Clip Manager</h1>

        <div
          className="bg-[#2a2a2a] rounded-xl p-10 text-center border-2 border-dashed border-[#444] cursor-pointer hover:border-[#666] hover:bg-[#333] transition-all"
          onClick={() => inputRef.current?.click()}
        >
          <h2 className="text-xl mb-2">Import Video</h2>
          <p className="text-[#999]">Click to select a video file or drag and drop</p>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
}
