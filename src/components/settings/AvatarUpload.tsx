'use client';

import { Camera, Upload, X } from 'lucide-react';
import Image from 'next/image';
import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/libs/cn';
import { createSupabaseBrowserClient } from '@/libs/SupabaseBrowser';

type AvatarUploadProps = {
  currentAvatarUrl?: string | null;
  onAvatarUpdate: (url: string | null) => void;
  isRTL?: boolean;
};

export default function AvatarUpload({ currentAvatarUrl, onAvatarUpdate, isRTL = false }: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  // Use local preview if available (for newly uploaded), otherwise use prop
  const previewUrl = localPreviewUrl || currentAvatarUrl || null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];
    if (!file) {
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Validate file type (only images)
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file');
      }

      // Validate file size (5MB limit for avatars)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new Error('Image size exceeds 5MB limit');
      }

      // Get user ID
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .maybeSingle();

      const userId = userRecord?.id || session.user.id;

      // Delete old avatar if exists
      if (currentAvatarUrl && currentAvatarUrl.includes('/avatars/')) {
        const oldFileName = currentAvatarUrl.split('/avatars/')[1];
        if (oldFileName) {
          await supabase.storage.from('avatars').remove([`${userId}/${oldFileName}`]);
        }
      }

      // Generate unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Failed to upload image: ${uploadError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setLocalPreviewUrl(publicUrl);
      onAvatarUpdate(publicUrl);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!currentAvatarUrl) {
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Get user ID
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .maybeSingle();

      const userId = userRecord?.id || session.user.id;

      // Delete from storage if it's in our storage bucket
      if (currentAvatarUrl.includes('/avatars/')) {
        const fileName = currentAvatarUrl.split('/avatars/')[1];
        if (fileName) {
          await supabase.storage.from('avatars').remove([`${userId}/${fileName.split('/').pop()}`]);
        }
      }

      setLocalPreviewUrl(null);
      onAvatarUpdate(null);
    } catch (error) {
      console.error('Error removing avatar:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to remove avatar');
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {uploadError && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {uploadError}
        </div>
      )}

      <div className={cn('flex items-center gap-6', isRTL ? 'flex-row-reverse' : '')}>
        {/* Avatar Preview */}
        <div className="relative">
          <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-pink-200 bg-gray-100">
            {previewUrl
              ? (
                  <Image
                    src={previewUrl}
                    alt="Avatar"
                    width={96}
                    height={96}
                    className="h-full w-full object-cover"
                  />
                )
              : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-100 to-pink-200">
                    <Camera className="h-8 w-8 text-pink-400" />
                  </div>
                )}
          </div>
          {previewUrl && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -right-1 -bottom-1 h-6 w-6 rounded-full"
              onClick={handleRemoveAvatar}
              title="Remove avatar"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Upload Button */}
        <div className="flex-1 space-y-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={cn('w-full', isRTL ? 'flex-row-reverse' : '')}
          >
            {isUploading
              ? (
                  <>
                    <div className={cn('h-4 w-4 animate-spin rounded-full border-2 border-pink-500 border-t-transparent', isRTL ? 'ml-2' : 'mr-2')} />
                    Uploading...
                  </>
                )
              : (
                  <>
                    <Upload className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                    {previewUrl ? 'Change Avatar' : 'Upload Avatar'}
                  </>
                )}
          </Button>
          <p className="text-xs text-slate-500">
            JPG, PNG or GIF. Max size 5MB
          </p>
        </div>
      </div>
    </div>
  );
}
