// src/app/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useRef, useCallback } from 'react';
import { type User as SupabaseUser } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/client';
import { formatMessageTime } from '@/lib/format-date';

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

type ActiveTool = 'none' | 'textMessageTool' | 'emailWriterHS' | 'emailWriterBA' | 'emailWriterSkilled' | 'emailWriterMS' | 'emailWriterPhD' | 'ingredientExtractor';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

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

const supabase = createClient();

export default function Home() {
  const router = useRouter();

  // auth
  const [user, setUser] = useState<SupabaseUser | null>(null);

  // chat
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [localInput, setLocalInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // history
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [historyIsLoading, setHistoryIsLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // notifications
  const [unreadCount, setUnreadCount] = useState(0);

  // tools / files
  const [activeTool, setActiveTool] = useState<ActiveTool>('none');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [attachedFileMimeType, setAttachedFileMimeType] = useState<string | null>(null);

  // recording
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ui refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [fileButtonFlash, setFileButtonFlash] = useState(false);
  const [toolButtonFlash, setToolButtonFlash] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const clearAttachmentState = () => {
    setUploadedFile(null);
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

  const toolLabel = (tool: ActiveTool) => {
    switch (tool) {
      case 'textMessageTool': return 'Text Message Tool';
      case 'emailWriterHS': return 'Email Writer · High School';
      case 'emailWriterBA': return 'Email Writer · Bachelor';
      case 'emailWriterSkilled': return 'Email Writer · Skilled Trade';
      case 'emailWriterMS': return 'Email Writer · Master’s';
      case 'emailWriterPhD': return 'Email Writer · PhD';
      case 'ingredientExtractor': return 'Ingredient Extractor';
      default: return 'Plain Chat';
    }
  };

  const renderCheck = (tool: ActiveTool) =>
    activeTool === tool ? <Check className="ml-auto h-4 w-4" strokeWidth={2} /> : null;

  const getPlaceholderText = () => {
    if (isTranscribing) return 'Transcribing audio...';
    if (isLoading) return 'AI is thinking...';
    if (isRecording) return 'Begin speaking…';
    if (attachedFileName) return 'Describe the file or add text...';
    switch (activeTool) {
      case 'textMessageTool': return 'Using Text Message Tool...';
      case 'emailWriterHS': return 'Email Writer · High School...';
      case 'emailWriterBA': return 'Email Writer · Bachelor...';
      case 'emailWriterSkilled': return 'Email Writer · Skilled Trade...';
      case 'emailWriterMS': return 'Email Writer · Master’s...';
      case 'emailWriterPhD': return 'Email Writer · PhD...';
      case 'ingredientExtractor': return 'Describe the recipe or attach a photo...';
      default: return 'Type your message...';
    }
  };

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

  useEffect(() => {
    let mounted = true;

    const run = async () => {
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

    run();

    return () => {
      mounted = false;
    };
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchUnreadCount();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnreadCount]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    inputRef.current?.focus();
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
      console.error('fetchConversations error:', error);
    } else {
      setConversations(data ?? []);
    }
    setHistoryIsLoading(false);
  };

  const loadConversation = async (id: string) => {
    if (isLoading || renamingId === id) return;

    if (isRecording) mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setIsTranscribing(false);
    setIsLoading(true);
    setMessages([]);
    setRenamingId(null);
    clearAttachmentState();
    setIsTyping(false);
    setIsSidebarOpen(false);

    const { data, error } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('loadConversation error:', error);
      setMessages([{ id: 'err', role: 'assistant', content: 'Error loading conversation.' }]);
    } else {
      const loaded = (data ?? []).map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        created_at: m.created_at,
      }));
      setMessages(loaded);
      setConversationId(id);
    }

    setIsLoading(false);
    inputRef.current?.focus();
  };

  const startNewChatForTool = (tool: ActiveTool) => {
    // switch tool and start a clean conversation to avoid confusion
    setActiveTool(tool);
    setMessages([]);
    setConversationId(null);
    setLocalInput('');
    clearAttachmentState();
    setIsTyping(false);
    inputRef.current?.focus();
  };

  const handleNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setLocalInput('');
    setRenamingId(null);
    clearAttachmentState();
    setActiveTool('none');
    if (isRecording) mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setIsTranscribing(false);
    inputRef.current?.focus();
    setIsTyping(false);
    setIsSidebarOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (isLoading) return;
    if (!window.confirm('Delete this chat?')) return;

    const { error } = await supabase.from('conversations').delete().eq('id', id);
    if (error) {
      console.error('delete conversation error:', error);
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
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }

    const newTitle = renameValue.trim();
    const { error } = await supabase.from('conversations').update({ title: newTitle }).eq('id', id);

    if (error) {
      console.error('rename error:', error);
      alert('Error renaming conversation.');
    } else {
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c)));
    }

    setRenamingId(null);
    setRenameValue('');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleCopy = useCallback((id: string, content: string) => {
    if (!navigator.clipboard) {
      alert('Clipboard not available.');
      return;
    }
    navigator.clipboard.writeText(content).then(
      () => {
        setCopiedMessageId(id);
        setTimeout(() => setCopiedMessageId(null), 2000);
      },
      (err) => {
        console.error('copy error:', err);
        alert('Failed to copy.');
      },
    );
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file && user) {
      if (!ALLOWED_FILE_TYPES.includes(file.type.toLowerCase())) {
        alert(`Invalid file type. Allowed: ${ALLOWED_FILE_EXTENSIONS.join(', ')}`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        const maxMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
        alert(`File is too large. Max ${maxMB}MB`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setUploadedFile(file);
      setAttachedFileName(file.name);
      setAttachedFileMimeType(file.type);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachedFile = () => {
    clearAttachmentState();
  };

  // ---------- AUDIO: stop on silence, no auto-send ----------
  const stopAllAudio = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setIsRecording(false);
  };

  const handleTranscribe = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');

    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setLocalInput((prev) => (prev + ' ' + data.text).trim());
        setTimeout(resizeTextarea, 0);
      } else {
        alert(`Transcription failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      alert('Failed to transcribe audio.');
    } finally {
      setIsTranscribing(false);
      audioChunksRef.current = [];
    }
  };

  const handleMicClick = async () => {
    if (isLoading || isTranscribing) return;

    // stop if already recording
    if (isRecording) {
      stopAllAudio();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setIsRecording(true);
      audioChunksRef.current = [];

      // Recorder
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
        stopAllAudio();
      };

      mediaRecorder.start();

      // VAD: stop after ~1.8s of silence, DO NOT auto-send
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.fftSize);
      const threshold = 0.008; // RMS threshold for silence
      const silenceMs = 1800; // 1.8 seconds
      const checkInterval = 120;

      const loop = () => {
        if (!analyserRef.current || !isRecording) return;
        analyserRef.current.getByteTimeDomainData(dataArray);

        // Compute RMS
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);

        if (rms < threshold) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = window.setTimeout(() => {
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop(); // we only stop recording, user will press send manually
              }
            }, silenceMs);
          }
        } else {
          if (silenceTimerRef.current) {
            window.clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        }
        if (isRecording) {
          window.setTimeout(loop, checkInterval);
        }
      };
      loop();
    } catch (error) {
      console.error('mic error:', error);
      alert('Microphone access denied.');
      setIsRecording(false);
    }
  };

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

  const handleToolButtonClick = () => {
    setToolButtonFlash(true);
    setTimeout(() => setToolButtonFlash(false), 200);
  };

  // ---- CHAT SEND LOGIC ----
  const handleFormSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (isLoading || isTranscribing || isRecording) return;

    const textInput = localInput.trim();
    const hasFile = !!uploadedFile;
    const hasText = textInput.length > 0;

    if (!hasText && !hasFile) return;

    setIsLoading(true);
    setIsTyping(false);

    const userMsgText = hasText ? textInput : `[Image: ${attachedFileName}]`;

    const newUserMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      role: 'user',
      content: userMsgText,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setLocalInput('');
    clearAttachmentState();

    // ensure conversation exists
    let currentConvoId = conversationId;
    if (!currentConvoId && user) {
      const title = userMsgText.substring(0, 40) + '...';
      const { data: newConvo, error: convError } = await supabase
        .from('conversations')
        .insert({ user_id: user.id, title })
        .select('id, created_at, title')
        .single();

      if (!convError && newConvo) {
        currentConvoId = newConvo.id;
        setConversationId(newConvo.id);
        setConversations((prev) => [newConvo, ...prev]);
      }
    }

    try {
      let response;
      if (hasFile) {
        const formData = new FormData();
        formData.append('message', textInput);
        formData.append('file', uploadedFile as File);
        response = await fetch('/api/chat', { method: 'POST', body: formData });
      } else {
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: textInput }),
        });
      }

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Error from /api/chat');
      }

      const assistantMessage: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        role: 'assistant',
        content: data.reply,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('chat send error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          role: 'assistant',
          content: `Sorry, an error occurred: ${error?.message || 'Unknown error'}`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* sidebar */}
      <aside
        className={`fixed lg:relative w-80 h-full flex-shrink-0 bg-white border-r border-slate-200 flex flex-col shadow-sm transform transition-transform duration-300 ease-in-out z-50 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-tight text-slate-700">Chat History</h2>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold uppercase tracking-tight text-slate-700">JCIL.ai</span>
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
            <div className="p-4 text-center text-slate-500 text-sm">Loading chats...</div>
          ) : conversations.length > 0 ? (
            conversations.map((convo) => (
              <div key={convo.id} className="flex items-center group">
                {renamingId === convo.id ? (
                  <form className="flex-1" onSubmit={(e) => handleRenameSubmit(e, convo.id)}>
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
            <div className="p-4 text-center text-slate-500 text-sm">No history yet.</div>
          )}
        </div>

        {/* sidebar footer */}
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
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-slate-700 cursor-pointer text-sm"
              >
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* main chat area */}
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
                <CardTitle className="text-lg sm:text-xl font-semibold text-blue-900">New Chat</CardTitle>
                <div className="text-xs text-slate-500 mt-1">{toolLabel(activeTool)}</div>
              </div>
              <div className="w-10 lg:hidden" />
            </div>
          </CardHeader>

          {/* messages */}
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
                <h2 className="text-lg sm:text-xl font-semibold text-blue-900">slingshot 2.0</h2>
                <p className="text-slate-700 text-base sm:text-lg md:text-xl font-medium text-center px-4">
                  {getTimeBasedGreeting()}
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start space-x-3 ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`flex flex-col ${
                      msg.role === 'user'
                        ? 'items-end max-w-[85%] sm:max-w-md'
                        : 'items-start max-w-[95%] sm:max-w-2xl'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <div className="bg-blue-900 text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl whitespace-pre-wrap text-sm leading-relaxed shadow-sm">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    )}

                    {msg.created_at && (
                      <div className="text-[10px] sm:text-xs text-slate-400 mt-1 px-1">
                        {formatMessageTime(msg.created_at)}
                      </div>
                    )}
                  </div>

                  {msg.role === 'assistant' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0 text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all rounded-lg"
                      onClick={() => handleCopy(msg.id, msg.content)}
                    >
                      {copiedMessageId === msg.id ? (
                        <Check className="h-4 w-4 text-green-600" strokeWidth={2} />
                      ) : (
                        <ClipboardCopy className="h-4 w-4" strokeWidth={2} />
                      )}
                    </Button>
                  )}
                </div>
              ))
            )}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </CardContent>

          {/* input bar */}
          <form
            onSubmit={handleFormSubmit}
            className="px-3 sm:px-6 md:px-8 py-3 sm:py-4 md:py-5 border-t border-slate-200 bg-white rounded-b-lg sm:rounded-b-xl"
          >
            {attachedFileName && (
              <div className="mb-2 sm:mb-3 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm shadow-sm">
                <div className="flex items-center gap-2 truncate">
                  <FileIcon className="h-4 w-4 text-blue-600" strokeWidth={2} />
                  <span className="truncate text-blue-800 font-medium">{attachedFileName}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 sm:h-7 sm:w-7 hover:bg-blue-100 rounded-full"
                  onClick={removeAttachedFile}
                  disabled={isLoading}
                >
                  <XIcon className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" strokeWidth={2} />
                </Button>
              </div>
            )}

            <div className="flex items-center space-x-2">
              {/* file inputs (hidden) */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept={ALLOWED_FILE_EXTENSIONS.join(',')}
                className="hidden"
              />
              <input
                type="file"
                ref={cameraInputRef}
                onChange={handleFileChange}
                accept="image/*"
                capture="environment"
                className="hidden"
              />

              {/* attach */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={isLoading}
                    className={`hover:bg-slate-100 rounded-lg h-9 w-9 sm:h-10 sm:w-10 ${
                      fileButtonFlash ? 'bg-slate-200' : ''
                    }`}
                    title="Attach file or take photo"
                  >
                    <Paperclip className="h-4 w-4 sm:h-5 sm:w-5 text-slate-700" strokeWidth={2} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align="start"
                  className="bg-white border border-slate-200 shadow-lg rounded-lg"
                >
                  <DropdownMenuItem
                    onSelect={() => cameraInputRef.current?.click()}
                    className="text-slate-700 text-sm cursor-pointer"
                  >
                    Take Photo
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => fileInputRef.current?.click()}
                    className="text-slate-700 text-sm cursor-pointer"
                  >
                    Choose File
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* TOOLS — back next to the input */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isLoading}
                    onClick={handleToolButtonClick}
                    className={`border-slate-300 text-slate-800 hover:bg-slate-100 rounded-lg px-2.5 h-9 sm:h-10 ${
                      toolButtonFlash ? 'bg-slate-200' : ''
                    }`}
                    title="Choose a tool"
                  >
                    <Wrench className="h-4 w-4 mr-1.5" />
                    <span className="hidden sm:inline">Tools</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-white border-slate-200 shadow-lg rounded-lg">
                  <DropdownMenuLabel className="text-slate-700 text-xs font-bold uppercase">Pick a tool</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-200" />
                  <DropdownMenuItem onClick={() => startNewChatForTool('none')}>
                    Plain Chat {renderCheck('none')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => startNewChatForTool('textMessageTool')}>
                    Text Message Tool {renderCheck('textMessageTool')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-200" />
                  <DropdownMenuLabel className="text-slate-700 text-xs font-bold uppercase">Email Writer</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => startNewChatForTool('emailWriterHS')}>
                    Email Writer · High School {renderCheck('emailWriterHS')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => startNewChatForTool('emailWriterBA')}>
                    Email Writer · Bachelor {renderCheck('emailWriterBA')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => startNewChatForTool('emailWriterSkilled')}>
                    Email Writer · Skilled Trade {renderCheck('emailWriterSkilled')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => startNewChatForTool('emailWriterMS')}>
                    Email Writer · Master&apos;s {renderCheck('emailWriterMS')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => startNewChatForTool('emailWriterPhD')}>
                    Email Writer · PhD {renderCheck('emailWriterPhD')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-200" />
                  <DropdownMenuItem onClick={() => startNewChatForTool('ingredientExtractor')}>
                    Ingredient Extractor {renderCheck('ingredientExtractor')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* mic + text + send */}
              <div className="flex-1 relative flex items-center border border-slate-300 rounded-xl bg-white focus-within:border-blue-900 transition-all">
                <Textarea
                  ref={inputRef}
                  value={localInput}
                  onChange={handleTextareaChange}
                  placeholder={getPlaceholderText()}
                  disabled={isLoading || isTranscribing}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck
                  className="flex-1 resize-none min-h-[40px] sm:min-h-[44px] max-h-[120px] sm:max-h-[150px] text-xs sm:text-sm leading-relaxed overflow-y-auto bg-transparent !border-0 !ring-0 !outline-none px-3 sm:px-4 py-2.5 sm:py-3 text-slate-900"
                  rows={1}
                  onKeyDown={handleTextareaKeyDown}
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isLoading || isTranscribing}
                  onClick={handleMicClick}
                  className={`h-8 w-8 mr-1 ${
                    isRecording
                      ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                      : 'hover:bg-slate-100 text-slate-700'
                  } rounded-lg`}
                  title={isRecording ? 'Stop recording' : 'Start recording'}
                >
                  {isTranscribing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mic className="h-4 w-4" strokeWidth={2} />
                  )}
                </Button>

                <Button
                  type="submit"
                  disabled={isLoading || isTranscribing || (!localInput.trim() && !attachedFileName)}
                  className="h-8 w-8 sm:h-9 sm:w-9 mr-1.5 bg-blue-900 hover:bg-blue-950 text-white rounded-lg flex items-center justify-center"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                  ) : (
                    <Send className="h-4 w-4" strokeWidth={2} />
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
