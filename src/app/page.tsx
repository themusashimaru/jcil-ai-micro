// src/app/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { type User as SupabaseUser } from '@supabase/supabase-js';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical,
  Mic,
  Paperclip,
  Bell,
  Loader2,
  File as FileIcon,
  X as XIcon,
  Wrench,
  Check,
  ClipboardCopy,
  Menu,
  Send,
} from 'lucide-react';

import { formatMessageTime } from '@/lib/format-date';

// ======================================================
// TYPES
// ======================================================
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

interface Conversation {
  id: string;
  created_at: string;
  title?: string | null;
}

interface Notification {
  id: string;
  created_at: string;
  content: string;
  read_status: boolean;
}

type ActiveTool = 'none' | 'textMessageTool' | 'emailWriter' | 'recipeExtractor';

// ======================================================
// CONSTANTS
// ======================================================
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const supabase = createClient();

// ======================================================
// SMALL COMPONENTS
// ======================================================
const TypingIndicator = () => (
  <div className="flex items-start space-x-2 justify-start">
    <div className="p-3 max-w-xs lg:max-w-md">
      <div className="flex space-x-2">
        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
);

// ======================================================
// MAIN PAGE
// ======================================================
export default function Home() {
  const router = useRouter();

  // --- auth / user ---
  const [user, setUser] = useState<SupabaseUser | null>(null);

  // --- chats ---
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [historyIsLoading, setHistoryIsLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // --- ui ---
  const [localInput, setLocalInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTool, setActiveTool] = useState<ActiveTool>('none');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [fileButtonFlash, setFileButtonFlash] = useState(false);
  const [toolButtonFlash, setToolButtonFlash] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // --- file / image ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [attachedFileMimeType, setAttachedFileMimeType] = useState<string | null>(null);

  // --- audio / whisper ---
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // --- refs ---
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ======================================================
  // HELPERS
  // ======================================================
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const clearAttachmentState = () => {
    setUploadedFileUrl(null);
    setAttachedFileName(null);
    setAttachedFileMimeType(null);
  };

  const resizeTextarea = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 150) + 'px';
    }
  };

  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'How can I help you this morning?';
    if (hour >= 12 && hour < 17) return 'How can I help you this afternoon?';
    return 'How can I help you this evening?';
  };

  // ======================================================
  // FETCHES
  // ======================================================
  const fetchUnreadCount = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;

    const { error, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)
      .eq('read_status', false);

    if (error) {
      console.error('fetchUnreadCount error:', error);
      return;
    }
    setUnreadCount(count ?? 0);
  }, []);

  const fetchConversations = async (userId: string) => {
    setHistoryIsLoading(true);
    const { data, error } = await supabase
      .from('conversations')
      .select('id, created_at, title')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching conversations:', error);
    } else if (data) {
      setConversations(data);
    }
    setHistoryIsLoading(false);
  };

  // ======================================================
  // EFFECTS
  // ======================================================
  // get user + initial data
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(currentUser);
      if (currentUser) {
        await fetchConversations(currentUser.id);
        await fetchUnreadCount();
      } else {
        setHistoryIsLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [fetchUnreadCount]);

  // realtime notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnreadCount]);

  // scroll on messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ======================================================
  // CHAT ACTIONS
  // ======================================================
  const handleNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setLocalInput('');
    clearAttachmentState();
    setActiveTool('none');
    setRenamingId(null);
    if (isRecording) mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setIsTranscribing(false);
    setIsTyping(false);
    setIsSidebarOpen(false);
    inputRef.current?.focus();
  };

  const loadConversation = async (id: string) => {
    if (isLoading || renamingId === id) return;
    if (isRecording) mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setIsTranscribing(false);

    setIsLoading(true);
    setMessages([]);
    clearAttachmentState();
    setActiveTool('none');
    setIsTyping(false);
    setIsSidebarOpen(false);

    const { data, error } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading msgs:', error);
      setMessages([
        {
          id: 'err',
          role: 'assistant',
          content: 'Error loading conversation.',
        },
      ]);
    } else if (data) {
      const loaded: Message[] = data.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        created_at: m.created_at ?? undefined,
      }));
      setMessages(loaded);
      setConversationId(id);
    }

    setIsLoading(false);
    inputRef.current?.focus();
  };

  const handleDelete = async (id: string) => {
    if (isLoading) return;
    if (!window.confirm('Delete this chat?')) return;

    const { error } = await supabase.from('conversations').delete().eq('id', id);
    if (error) {
      console.error('Error deleting:', error);
      alert('Error deleting conversation.');
      return;
    }

    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (conversationId === id) handleNewChat();
  };

  const handleRenameClick = (convo: Conversation) => {
    setRenamingId(convo.id);
    setRenameValue(convo.title || `Chat from ${new Date(convo.created_at).toLocaleString()}`);
  };

  const handleRenameSubmit = async (e: React.FormEvent<HTMLFormElement>, id: string) => {
    e.preventDefault();
    if (isLoading) {
      setRenamingId(null);
      return;
    }
    const newTitle = renameValue.trim();
    if (!newTitle) {
      setRenamingId(null);
      return;
    }

    const { error } = await supabase.from('conversations').update({ title: newTitle }).eq('id', id);
    if (error) {
      console.error('Error renaming:', error);
      alert('Error renaming conversation.');
    } else {
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c)));
    }
    setRenamingId(null);
    setRenameValue('');
  };

  // ======================================================
  // FILE UPLOAD
  // ======================================================
  const handleUploadClick = () => {
    if (isLoading) return;
    setFileButtonFlash(true);
    setTimeout(() => setFileButtonFlash(false), 180);
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type.toLowerCase())) {
      alert(`Invalid file type. Please upload: ${ALLOWED_FILE_EXTENSIONS.join(', ')}`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      const maxMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
      alert(`File too large. Max ${maxMB}MB`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadFile = async (file: File) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !user) {
      alert('Authentication issue. Please sign in again.');
      return;
    }

    const filePath = `${user.id}/${Date.now()}_${file.name}`;
    setIsLoading(true);
    clearAttachmentState();

    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (error) {
      console.error('Upload error:', error);
      alert(`Upload failed: ${error.message}`);
      setIsLoading(false);
      return;
    }

    if (data) {
      const { data: urlData, error: urlError } = await supabase
        .storage
        .from('uploads')
        .createSignedUrl(filePath, 3600);

      if (urlError) {
        console.error('URL error:', urlError);
        alert('Upload succeeded but could not get file URL.');
      } else if (urlData) {
        setUploadedFileUrl(urlData.signedUrl);
        setAttachedFileName(file.name);
        setAttachedFileMimeType(file.type);
      }
    }

    setIsLoading(false);
  };

  const removeAttachedFile = () => {
    clearAttachmentState();
  };

  // ======================================================
  // MIC / WHISPER
  // ======================================================
  const handleTranscribe = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');

    try {
      const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
      const data = await response.json();

      if (response.ok) {
        setLocalInput((prev) => (prev + ' ' + data.text).trim());
        setTimeout(resizeTextarea, 0);
      } else {
        alert(`Transcription failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Transcribe error:', error);
      alert('Failed to transcribe audio.');
    } finally {
      setIsTranscribing(false);
      audioChunksRef.current = [];
    }
  };

  const handleMicClick = async () => {
    if (isLoading || isTranscribing) return;

    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsRecording(true);
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleTranscribe(audioBlob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
    } catch (error) {
      console.error('Mic error:', error);
      alert('Microphone access denied.');
      setIsRecording(false);
    }
  };

  // ======================================================
  // TOOLS
  // ======================================================
  const renderCheck = (tool: ActiveTool) => {
    if (activeTool === tool) {
      return <Check className="ml-auto h-4 w-4" strokeWidth={2} />;
    }
    return null;
  };

  const handleToolButtonClick = () => {
    setToolButtonFlash(true);
    setTimeout(() => setToolButtonFlash(false), 180);
  };

  const getPlaceholderText = () => {
    if (isTranscribing) return 'Transcribing audio...';
    if (isLoading) return 'AI is thinking...';
    if (isRecording) return 'Recording... Click mic to stop.';
    if (attachedFileName) return 'Describe the file or add text...';
    if (activeTool === 'textMessageTool') return 'Using Text Message Tool...';
    if (activeTool === 'emailWriter') return 'Using Email Writer...';
    if (activeTool === 'recipeExtractor') return 'Using Recipe Extractor...';
    return 'Type your message...';
  };

  // ======================================================
  // COPY
  // ======================================================
  const handleCopy = useCallback((id: string, content: string) => {
    if ('clipboard' in navigator) {
      navigator.clipboard
        .writeText(content)
        .then(() => {
          setCopiedMessageId(id);
          setTimeout(() => setCopiedMessageId(null), 2000);
        })
        .catch((err) => {
          console.error('copy failed', err);
          alert('Failed to copy.');
        });
    } else {
      alert('Clipboard not available.');
    }
  }, []);

  // ======================================================
  // SIGN OUT
  // ======================================================
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  // ======================================================
  // HANDLE TEXTAREA
  // ======================================================
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalInput(e.target.value);
    resizeTextarea();
  };

  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleFormSubmit();
    }
  };

  // ======================================================
  // FORM SUBMIT – THIS IS THE IMPORTANT PART
  // ======================================================
  const handleFormSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (isLoading || isTranscribing || isRecording) return;

    // ✅ must be logged in – your API checks this
    if (!user) {
      alert('Your session expired. Please log in again.');
      router.push('/login');
      return;
    }

    // capture current values
    const textInput = localInput.trim();
    const fileUrl = uploadedFileUrl;
    const fileMimeType = attachedFileMimeType;
    const fileName = attachedFileName;

    const hasText = textInput.length > 0;
    const hasFile = fileUrl && fileName;

    if (!hasText && !hasFile) return;

    // stop mic
    if (isRecording) {
      mediaRecorderRef.current?.stop();
    }

    setIsLoading(true);
    setIsTyping(true);

    // build user message
    let userMsg = '';
    let userMsgForTitle = '';

    if (hasText) {
      userMsg = textInput;
      userMsgForTitle = textInput;
    } else {
      userMsg = `[Image: ${fileName}]`;
      userMsgForTitle = userMsg;
    }

    const newUserMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      role: 'user',
      content: userMsg,
      created_at: new Date().toISOString(),
    };

    // update UI immediately
    setMessages((prev) => [...prev, newUserMessage]);
    setLocalInput('');
    clearAttachmentState();

    // make sure there's a conversation
    let currentConvoId = conversationId;

    if (!currentConvoId) {
      const title =
        userMsgForTitle.length > 40
          ? userMsgForTitle.slice(0, 40) + '...'
          : userMsgForTitle;

      const { data: newConvo, error: convError } = await supabase
        .from('conversations')
        .insert({ user_id: user.id, title })
        .select('id, created_at, title')
        .single();

      if (convError || !newConvo) {
        console.error('Error creating conversation:', convError);
        // roll back this user message from UI
        setMessages((prev) => prev.filter((m) => m.id !== newUserMessage.id));
        alert('Error saving conversation.');
        setIsLoading(false);
        setIsTyping(false);
        return;
      }

      currentConvoId = newConvo.id;
      setConversationId(newConvo.id);
      setConversations((prev) => [newConvo, ...prev]);
    }

    // now call API
    try {
      // ❗ use the messages that are in state *plus* this new one
      // we build them as CoreMessage { role, content }
      const currentMessagesForAPI = [...messages, newUserMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentMessagesForAPI,
          conversationId: currentConvoId,
          tool: activeTool,
          fileUrl: hasFile ? fileUrl : null,
          fileMimeType: hasFile ? fileMimeType : null,
        }),
      });

      if (!resp.ok || !resp.body) {
        let errMsg = 'Request failed';
        try {
          const errJson = await resp.json();
          if (errJson?.error) errMsg = errJson.error;
        } catch {
          //
        }
        throw new Error(errMsg);
      }

      // stream it
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let assistantId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      let assistantContent = '';
      let firstChunk = true;

      // read chunks
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;

        if (firstChunk && assistantContent.length > 0) {
          setIsTyping(false);
        }

        setMessages((prev) => {
          if (firstChunk) {
            firstChunk = false;
            return [
              ...prev,
              {
                id: assistantId,
                role: 'assistant',
                content: assistantContent,
                created_at: new Date().toISOString(),
              },
            ];
          }

          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: assistantContent }];
          }
          return [
            ...prev,
            {
              id: assistantId,
              role: 'assistant',
              content: assistantContent,
              created_at: new Date().toISOString(),
            },
          ];
        });
      }
    } catch (err) {
      console.error('Error in chat submit:', err);
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          role: 'assistant',
          content: `Sorry, an error occurred: ${
            err instanceof Error ? err.message : 'Unknown error'
          }`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  // ======================================================
  // RENDER
  // ======================================================
  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed lg:relative w-80 h-full flex-shrink-0 bg-white border-r border-slate-200 flex flex-col shadow-sm transform transition-transform duration-300 ease-in-out z-50 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-tight text-slate-700">
              Chat History
            </h2>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold uppercase tracking-tight text-slate-700">
                JCIL.ai
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden hover:bg-slate-100 rounded-lg"
                onClick={() => setIsSidebarOpen(false)}
              >
                <XIcon className="h-5 w-5 text-slate-700" strokeWidth={2} />
              </Button>
            </div>
          </div>
          <Button
            className="w-full bg-blue-900 hover:bg-blue-950 text-white rounded-lg transition-all shadow-sm"
            onClick={handleNewChat}
            disabled={isLoading}
          >
            New Chat
          </Button>
        </div>

        {/* conversation list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {historyIsLoading ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              Loading chats...
            </div>
          ) : conversations.length > 0 ? (
            conversations.map((convo) => (
              <div key={convo.id} className="flex items-center group gap-1">
                {renamingId === convo.id ? (
                  <form
                    className="flex-1"
                    onSubmit={(e) => handleRenameSubmit(e, convo.id)}
                  >
                    <Input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => setRenamingId(null)}
                      autoFocus
                      className="h-9 border-slate-300 focus:border-blue-900 rounded-lg text-sm"
                    />
                  </form>
                ) : (
                  <Button
                    variant="ghost"
                    className={`flex-1 justify-start truncate text-sm font-medium transition-all rounded-lg ${
                      convo.id === conversationId
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                    onClick={() => loadConversation(convo.id)}
                    disabled={isLoading}
                  >
                    <div className="truncate">
                      {convo.title || new Date(convo.created_at).toLocaleString()}
                    </div>
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-slate-100 transition-all rounded-lg"
                      disabled={isLoading}
                    >
                      <MoreVertical className="h-4 w-4 text-slate-700" strokeWidth={2} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-white border-slate-200 shadow-lg rounded-lg">
                    <DropdownMenuItem
                      onClick={() => handleRenameClick(convo)}
                      className="text-slate-700 cursor-pointer"
                    >
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600 cursor-pointer"
                      onClick={() => handleDelete(convo.id)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-slate-500 text-sm">
              No history yet.
            </div>
          )}
        </div>

        {/* footer */}
        <div className="bg-white px-6 py-4 space-y-3 border-t border-slate-200">
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-900 hover:bg-slate-100 transition-all rounded-lg relative"
            onClick={() => router.push('/notifications')}
            disabled={isLoading}
          >
            <Bell className="h-5 w-5 mr-2" strokeWidth={2} />
            <span className="text-sm font-medium">Notifications</span>
            {unreadCount > 0 && (
              <span className="ml-auto inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                {unreadCount}
              </span>
            )}
          </Button>

          {/* legal */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start text-slate-900 hover:bg-slate-100 transition-all rounded-lg"
                disabled={isLoading}
              >
                <span className="text-sm font-medium">Legal & Policies</span>
                <MoreVertical className="h-4 w-4 ml-auto" strokeWidth={2} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 bg-white border border-slate-200 shadow-lg rounded-lg"
            >
              <DropdownMenuLabel className="text-slate-700 text-xs font-bold uppercase">
                Legal Information
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-200" />
              <DropdownMenuItem asChild>
                <Link href="/privacy" className="cursor-pointer text-slate-700 text-sm">
                  Privacy Policy
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/terms" className="cursor-pointer text-slate-700 text-sm">
                  Terms of Service
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/cookies" className="cursor-pointer text-slate-700 text-sm">
                  Cookie Policy
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* user dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start text-slate-900 hover:bg-slate-100 transition-all rounded-lg px-4 py-3"
                disabled={isLoading}
              >
                <div className="flex-1 text-left overflow-hidden">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {user?.email || 'Loading...'}
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 bg-white border border-slate-200 shadow-lg rounded-lg"
            >
              <DropdownMenuItem
                onClick={() => router.push('/settings')}
                className="text-slate-700 cursor-pointer text-sm"
              >
                <svg
                  className="h-4 w-4 mr-2"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut} className="text-slate-700 cursor-pointer text-sm">
                <svg
                  className="h-4 w-4 mr-2"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <main className="flex-1 flex flex-col p-0 sm:p-4 md:p-6 bg-white overflow-hidden">
        <Card className="w-full h-full flex flex-col shadow-sm sm:shadow-lg bg-white border-slate-200 rounded-lg sm:rounded-xl">
          {/* header */}
          <CardHeader className="bg-white border-b border-slate-200 rounded-t-lg sm:rounded-t-xl px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-5">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden hover:bg-slate-100 rounded-lg"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu className="h-6 w-6 text-slate-700" strokeWidth={2} />
              </Button>
              <div className="flex-1 text-center">
                <CardTitle className="text-lg sm:text-xl font-semibold text-blue-900">
                  New Chat
                </CardTitle>
              </div>
              <div className="w-10 lg:hidden" />
            </div>
          </CardHeader>

          {/* content */}
          <CardContent className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 bg-white">
            {isLoading && messages.length === 0 ? (
              <div className="text-center text-slate-500 text-sm">Loading messages...</div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full space-y-6">
                <div className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 flex items-center justify-center">
                  <img
                    src="/jcil-ai-logo.png"
                    alt="JCIL.ai Logo"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('.logo-fallback')) {
                        const fallback = document.createElement('div');
                        fallback.className =
                          'logo-fallback w-full h-full bg-blue-900 rounded-lg flex items-center justify-center text-white text-4xl font-bold';
                        fallback.textContent = 'JCIL';
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                </div>
                <h2 className="text
