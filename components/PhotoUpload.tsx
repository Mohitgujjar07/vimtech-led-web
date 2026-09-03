'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, GripVertical, Image as ImageIcon } from 'lucide-react';

interface PhotoFile {
  id: string;
  file: File;
  preview: string;
  pageNumber: number;
}

interface PhotoUploadProps {
  onPhotosReady: (photos: { file: File; pageNumber: number }[]) => void;
  maxPhotos?: number;
}

export default function PhotoUpload({ onPhotosReady, maxPhotos = 5 }: PhotoUploadProps) {
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const addPhotos = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const newPhotos: PhotoFile[] = Array.from(files).map((file, idx) => ({
        id: `${Date.now()}-${idx}`,
        file,
        preview: URL.createObjectURL(file),
        pageNumber: photos.length + idx + 1,
      }));

      const updated = [...photos, ...newPhotos].slice(0, maxPhotos);
      setPhotos(updated);
      onPhotosReady(updated.map((p) => ({ file: p.file, pageNumber: p.pageNumber })));
    },
    [photos, maxPhotos, onPhotosReady]
  );

  const removePhoto = useCallback(
    (id: string) => {
      const updated = photos
        .filter((p) => p.id !== id)
        .map((p, idx) => ({ ...p, pageNumber: idx + 1 }));
      setPhotos(updated);
      onPhotosReady(updated.map((p) => ({ file: p.file, pageNumber: p.pageNumber })));
    },
    [photos, onPhotosReady]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      addPhotos(e.dataTransfer.files);
    },
    [addPhotos]
  );

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 transition-colors hover:border-brand-400 hover:bg-brand-50/30"
      >
        <ImageIcon className="mb-3 h-10 w-10 text-gray-400" />
        <p className="mb-1 text-sm font-medium text-gray-700">
          Drop ledger photos here
        </p>
        <p className="mb-4 text-xs text-gray-500">
          or use the buttons below (up to {maxPhotos} photos)
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary text-xs"
          >
            <Upload className="h-4 w-4" />
            Choose Files
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="btn-primary text-xs"
          >
            <Camera className="h-4 w-4" />
            Take Photo
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => addPhotos(e.target.files)}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => addPhotos(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Photo previews */}
      {photos.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            {photos.length} photo{photos.length !== 1 ? 's' : ''} selected
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
              >
                <img
                  src={photo.preview}
                  alt={`Page ${photo.pageNumber}`}
                  className="aspect-[3/4] w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                  <span className="text-xs font-medium text-white">
                    Page {photo.pageNumber}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
