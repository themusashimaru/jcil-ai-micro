'use client';

import type { GeneratedImage } from '@/app/chat/types';
import { CreateImageModal, EditImageModal, GenerationGallery } from './CreativeButton';

interface ComposerCreativeModalsProps {
  showCreateImageModal: boolean;
  showEditImageModal: boolean;
  showGalleryModal: boolean;
  onCloseCreateImage: () => void;
  onCloseEditImage: () => void;
  onCloseGallery: () => void;
  onReusePrompt: (prompt: string) => void;
  conversationId?: string;
  onImageGenerated?: (image: GeneratedImage) => void;
}

export function ComposerCreativeModals({
  showCreateImageModal,
  showEditImageModal,
  showGalleryModal,
  onCloseCreateImage,
  onCloseEditImage,
  onCloseGallery,
  onReusePrompt,
  conversationId,
  onImageGenerated,
}: ComposerCreativeModalsProps) {
  return (
    <>
      <CreateImageModal
        isOpen={showCreateImageModal}
        onClose={onCloseCreateImage}
        conversationId={conversationId}
        onImageGenerated={onImageGenerated}
      />
      <EditImageModal
        isOpen={showEditImageModal}
        onClose={onCloseEditImage}
        conversationId={conversationId}
        onImageGenerated={onImageGenerated}
      />
      <GenerationGallery
        isOpen={showGalleryModal}
        onClose={onCloseGallery}
        onReusePrompt={onReusePrompt}
      />
    </>
  );
}
