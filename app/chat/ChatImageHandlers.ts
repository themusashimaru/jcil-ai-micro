'use client';

import { formatActionSuccessMessage } from './chatUtils';
import type { AgentModeId } from './agentModes';
import type { Message, GeneratedImage, Attachment } from './types';
import type { ActionPreviewData } from '@/components/chat/ActionPreviewCard';
import type { SearchMode } from '@/components/chat/ChatComposer';
import type { SelectedRepoInfo } from '@/components/chat/ChatComposer';

interface ChatImageHandlersArgs {
  currentChatId: string | null;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setQuickPromptText: React.Dispatch<React.SetStateAction<string>>;
  startAgentMode: (modeId: AgentModeId) => Promise<void>;
  handleSendMessage: (
    content: string,
    attachments: Attachment[],
    searchMode?: SearchMode,
    selectedRepo?: SelectedRepoInfo | null
  ) => Promise<void>;
}

export function createImageHandlers({
  currentChatId,
  setMessages,
  setQuickPromptText,
  startAgentMode,
  handleSendMessage,
}: ChatImageHandlersArgs) {
  const handleImageGenerated = (image: GeneratedImage) => {
    const typeLabel = image.type === 'edit' ? 'edited' : 'generated';
    const content = image.verification?.feedback
      ? `I've ${typeLabel} this image for you. ${image.verification.feedback}`
      : `I've ${typeLabel} this image based on your request: "${image.prompt}"`;
    setMessages((prev) => [
      ...prev,
      {
        id: `gen-${image.id}`,
        role: 'assistant',
        content,
        generatedImage: image,
        timestamp: new Date(),
      },
    ]);
  };

  const handleRegenerateImage = async (
    _generationId: string,
    originalPrompt: string,
    feedback: string
  ) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `regen-user-${Date.now()}`,
        role: 'user',
        content: `Please regenerate this image. The previous result: ${feedback}`,
        timestamp: new Date(),
      },
    ]);
    try {
      const response = await fetch('/api/create/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `${originalPrompt}. Important: ${feedback}`,
          conversationId: currentChatId,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        handleImageGenerated({
          id: data.id,
          type: 'create',
          imageUrl: data.imageUrl,
          prompt: originalPrompt,
          enhancedPrompt: data.enhancedPrompt,
          dimensions: data.dimensions,
          model: data.model || 'flux-2-pro',
          seed: data.seed,
          verification: data.verification,
        });
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `regen-error-${Date.now()}`,
            role: 'assistant',
            content: `I couldn't regenerate the image: ${data.message || data.error || 'Unknown error'}`,
            timestamp: new Date(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `regen-error-${Date.now()}`,
          role: 'assistant',
          content: 'I encountered an error while trying to regenerate the image. Please try again.',
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleActionSend = async (preview: ActionPreviewData): Promise<void> => {
    try {
      const response = await fetch('/api/composio/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: preview.toolName.replace(/^composio_/, ''),
          params: preview.toolParams,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: `action-success-${Date.now()}`,
            role: 'assistant',
            content: formatActionSuccessMessage(preview.platform, preview.action, data.data),
            timestamp: new Date(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `action-error-${Date.now()}`,
            role: 'assistant',
            content: `Failed to ${preview.action.toLowerCase()} on ${preview.platform}: ${data.error || 'Unknown error'}.`,
            timestamp: new Date(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `action-error-${Date.now()}`,
          role: 'assistant',
          content: `An error occurred while trying to ${preview.action.toLowerCase()} on ${preview.platform}.`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleActionEdit = (preview: ActionPreviewData, instruction: string): void => {
    const editRequest = `Please update the ${preview.platform} ${preview.action.toLowerCase()} based on this feedback: ${instruction}`;
    setMessages((prev) => [
      ...prev,
      {
        id: `action-edit-${Date.now()}`,
        role: 'user',
        content: editRequest,
        timestamp: new Date(),
      },
    ]);
    handleSendMessage(editRequest, [], undefined, undefined);
  };

  const handleActionCancel = (preview: ActionPreviewData): void => {
    setMessages((prev) => [
      ...prev,
      {
        id: `action-cancel-${Date.now()}`,
        role: 'assistant',
        content: `Okay, I've cancelled the ${preview.action.toLowerCase()} for ${preview.platform}. Let me know if you'd like to try something else!`,
        timestamp: new Date(),
      },
    ]);
  };

  const handleCarouselSelect = async (cardId: string) => {
    switch (cardId) {
      case 'create-image':
        setQuickPromptText('Create an image of ');
        break;
      case 'edit-image':
        setQuickPromptText('Edit this image: ');
        break;
      case 'research':
        setQuickPromptText('Research ');
        break;
      case 'deep-research':
        await startAgentMode('deep-research');
        break;
      case 'deep-strategy':
        await startAgentMode('strategy');
        break;
    }
  };

  return {
    handleImageGenerated,
    handleRegenerateImage,
    handleActionSend,
    handleActionEdit,
    handleActionCancel,
    handleCarouselSelect,
  };
}
