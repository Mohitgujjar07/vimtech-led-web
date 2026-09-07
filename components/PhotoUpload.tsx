'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, X, Plus, Sparkles, CheckCircle2 } from 'lucide-react';

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

  // Cleanup all object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addPhotos = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const newPhotos: PhotoFile[] = Array.from(files).map((file, idx) => ({
        id: `${Date.now()}-${idx}`,
        file,
        preview: URL.createObjectURL(file),
        pageNumber: photos.length + idx + 1,
      }));

      const updated = [...photos, ...newPhotos].slice(0, maxPhotos);

      // Revoke URLs for photos that got cut off by the limit
      const keptIds = new Set(updated.map((p) => p.id));
      newPhotos.forEach((p) => {
        if (!keptIds.has(p.id)) URL.revokeObjectURL(p.preview);
      });

      setPhotos(updated);
      onPhotosReady(updated.map((p) => ({ file: p.file, pageNumber: p.pageNumber })));
    },
    [photos, maxPhotos, onPhotosReady]
  );

  const removePhoto = useCallback(
    (id: string) => {
      const toRemove = photos.find((p) => p.id !== id);
      const target = photos.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.preview);

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
      {/* Hidden file inputs */}
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

      {/* ────────────────── Empty State / First Upload ────────────────── */}
      {photos.length === 0 ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/30 p-6 sm:p-8 text-center transition-all hover:bg-brand-50/60"
        >
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 shadow-xs">
            <Camera className="h-7 w-7 stroke-[2]" />
          </div>

          <h3 className="text-base font-bold text-gray-900">
            Snap Your Paper Ledger Page
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-gray-500">
            Hold your phone over the ledger book. Gemini AI reads handwriting, roll numbers, and signatures.
          </p>

          <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2.5 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-brand-800 active:scale-95"
            >
              <Camera className="h-4 w-4 stroke-[2.5]" />
              <span>Take Photo</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 shadow-2xs transition hover:bg-gray-50 active:scale-95"
            >
              <Upload className="h-4 w-4 text-gray-500" />
              <span>Choose from Gallery</span>
            </button>
          </div>

          <p className="mt-4 text-[11px] text-gray-400">
            Supports up to {maxPhotos} pages per session • High quality JPEG / PNG
          </p>
        </div>
      ) : (
        /* ────────────────── Captured Pages Grid ────────────────── */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-bold text-gray-900">
                {photos.length} {photos.length === 1 ? 'Page' : 'Pages'} Captured
              </span>
              <span className="text-xs text-gray-400">({photos.length}/{maxPhotos})</span>
            </div>

            {photos.length < maxPhotos && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-50 border border-brand-200 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>+ Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>+ Gallery</span>
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs"
              >
                <img
                  src={photo.preview}
                  alt={`Page ${photo.pageNumber}`}
                  className="aspect-[3/4] w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-white">
                    Page {photo.pageNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    className="rounded-full bg-red-600 p-1 text-white hover:bg-red-700 active:scale-90"
                    title="Remove page"
                  >
                    <X className="h-3.5 w-3.5 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            ))}

            {/* Quick Add Next Page Card if under limit */}
            {photos.length < maxPhotos && (
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex aspect-[3/4] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500 transition hover:border-brand-400 hover:bg-brand-50/40 active:scale-95"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-xs border border-gray-200 mb-2">
                  <Plus className="h-5 w-5 text-brand-700" />
                </div>
                <span className="text-xs font-semibold text-gray-700">Add Next Page</span>
                <span className="text-[10px] text-gray-400">Page {photos.length + 1}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
