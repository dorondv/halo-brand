'use client';

import { FileText, Image as ImageIcon, Upload, X } from 'lucide-react';
import Image from 'next/image';
import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type MediaUploadProps = {
  mediaUrls: string[];
  onMediaUpdate: (urls: string[]) => void;
};

export default function MediaUpload({ mediaUrls, onMediaUpdate }: MediaUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) {
      return;
    }

    setIsUploading(true);
    try {
      // Mock upload - in real implementation, you would upload to Supabase Storage
      // For now, we'll create object URLs for preview
      const newUrls: string[] = [];
      for (const file of files) {
        // Create a mock URL for preview (in production, this would be the uploaded file URL)
        const mockUrl = URL.createObjectURL(file);
        newUrls.push(mockUrl);
      }
      onMediaUpdate([...mediaUrls, ...newUrls]);
    } catch (error) {
      console.error('Error uploading files:', error);
    }
    setIsUploading(false);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeMedia = (urlToRemove: string) => {
    // Revoke object URL to free memory
    URL.revokeObjectURL(urlToRemove);
    onMediaUpdate(mediaUrls.filter(url => url !== urlToRemove));
  };

  const getFileType = (url: string) => {
    // For object URLs, we can't easily determine the type, so we'll check if it's a blob
    // In production with real URLs, you'd check the extension
    if (url.startsWith('blob:')) {
      // For demo purposes, we'll treat all as images
      // In production, you'd store file type metadata
      return 'image';
    }
    const extension = url.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return 'image';
    }
    if (['mp4', 'mov', 'avi', 'wmv'].includes(extension || '')) {
      return 'video';
    }
    return 'file';
  };

  return (
    <Card className="border-gray-200 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-pink-500" />
          Media Upload
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full border-2 border-dashed border-pink-200 py-8 text-pink-600 transition-all duration-300 hover:border-pink-300 hover:bg-pink-50"
        >
          {isUploading
            ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
                  Uploading...
                </div>
              )
            : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8" />
                  <span className="font-medium">Click to upload media</span>
                  <span className="text-sm text-slate-500">Images, videos up to 10MB</span>
                </div>
              )}
        </Button>

        {mediaUrls.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {mediaUrls.map((url, index) => {
              const fileType = getFileType(url);

              return (
                <div key={url} className="group relative">
                  <div className="aspect-square overflow-hidden rounded-xl border border-gray-200 bg-slate-100">
                    {fileType === 'image'
                      ? (
                          <Image src={url} alt={`Upload ${index + 1}`} width={400} height={400} className="h-full w-full object-cover" />
                        )
                      : fileType === 'video'
                        ? (
                            <video src={url} className="h-full w-full object-cover" controls>
                              <track kind="captions" />
                            </video>
                          )
                        : (
                            <div className="flex h-full w-full items-center justify-center">
                              <FileText className="h-8 w-8 text-slate-400" />
                            </div>
                          )}
                  </div>

                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    onClick={() => removeMedia(url)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
