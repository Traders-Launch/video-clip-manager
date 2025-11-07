'use client';

import { useRef, useState } from 'react';

interface VideoImportProps {
  onVideosLoad: (files: File[]) => void;
  title?: string;
  description?: string;
  className?: string;
}

export default function VideoImport({
  onVideosLoad,
  title = 'Import Videos',
  description = 'Click to select videos or drag and drop files here',
  className = '',
}: VideoImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(file => file.type.startsWith('video/'));
    if (fileArray.length > 0) {
      onVideosLoad(fileArray);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) {
      handleFiles(event.target.files);
    }
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files?.length) {
      handleFiles(event.dataTransfer.files);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  return (
    <div
      className={`
        bg-[#2a2a2a] rounded-xl text-center border-2 border-dashed border-[#444] cursor-pointer
        transition-all p-10
        ${isDragging ? 'border-[#0a84ff] bg-[#1f2a38]' : 'hover:border-[#666] hover:bg-[#333]'}
        ${className}
      `}
      onClick={() => inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <h2 className="text-xl mb-2">{title}</h2>
      <p className="text-[#999] mb-0">{description}</p>
      <p className="text-[#666] text-sm mt-2">Multiple videos supported</p>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
