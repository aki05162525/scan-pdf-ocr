"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

interface Props {
  files: File[];
  onReorder: (files: File[]) => void;
  onRemove: (index: number) => void;
}

export default function ImagePreviewList({
  files,
  onReorder,
  onRemove,
}: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const idMap = useRef(new WeakMap<File, string>());

  const getFileId = (file: File): string => {
    let id = idMap.current.get(file);
    if (!id) {
      id = crypto.randomUUID();
      idMap.current.set(file, id);
    }
    return id;
  };

  useEffect(() => {
    const newUrls = files.map((f) => URL.createObjectURL(f));
    setUrls(newUrls);
    return () => {
      for (const u of newUrls) URL.revokeObjectURL(u);
    };
  }, [files]);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;

    const newFiles = [...files];
    const [moved] = newFiles.splice(dragIndex, 1);
    newFiles.splice(index, 0, moved);
    onReorder(newFiles);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  if (files.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        アップロード画像 ({files.length}ページ) - ドラッグで並び替え
      </h3>
      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 list-none p-0">
        {files.map((file, index) => (
          <li
            key={getFileId(file)}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            aria-label={`ページ ${index + 1}: ${file.name}`}
            className={`relative border rounded-lg overflow-hidden cursor-move ${
              dragIndex === index ? "opacity-50" : ""
            }`}
          >
            <div className="relative aspect-[3/4] bg-gray-100">
              {urls[index] && (
                <Image
                  src={urls[index]}
                  alt={`ページ ${index + 1}`}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                  unoptimized
                  className="object-cover"
                />
              )}
            </div>
            <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
              {index + 1}
            </div>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="absolute top-1 right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center hover:bg-red-600"
            >
              x
            </button>
            <div className="text-xs text-gray-500 p-1 truncate">
              {file.name}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
