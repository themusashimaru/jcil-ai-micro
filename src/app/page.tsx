'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useRef, useCallback } from 'react';
import { type User as SupabaseUser } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/browser';
import { formatMessageTime } from '@/lib/format-date';
import { type ToolType, TOOLS_CONFIG, getToolsByCategory } from '@/lib/tools-config';

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
  Search,
  Share2,
  LogOut,
} from 'lucide-react';

interface MessageRow {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  conversation_id: string;
  user_id: string;
}

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
  user_id?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// Christian-themed loading messages with professional academic flair
const LOADING_MESSAGES = [
  "Seeking wisdom from Scripture...",
  "Processing through a biblical lens...",
  "Analyzing with discernment...",
  "Searching the Scriptures...",
  "Filtering through Christian principles...",
  "Examining with theological care...",
  "Rendering a thoughtful response...",
  "Compiling biblical insights...",
  "Synthesizing scriptural wisdom...",
  "Meditating on your question...",
  "Applying faith-based reasoning...",
  "Cross-referencing sacred texts...",
  "Constructing a faithful answer...",
  "Parsing with divine guidance...",
  "Rejecting wokeness, embracing truth...",
];

const TypingIndicator = () => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000); // Change message every 2 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-start space-x-3 justify-start">
      <div className="p-3 max-w-xs lg:max-w-2xl">
        <div className="flex items-center space-x-3">
          <div className="flex space-x-2">
            <div className="w-2 h-2 bg-blue-900 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-blue-900 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-blue-900 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-sm text-slate-600 italic animate-pulse">
            {LOADING_MESSAGES[messageIndex]}
          </span>
        </div>
      </div>
    </div>
  );
};

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
  const [searchQuery, setSearchQuery] = useState('');

  // notifications
  const [unreadCount, setUnreadCount] = useState(0);

  // tools / files
  const [activeTool, setActiveTool] = useState<ToolType>('none');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [attachedFileMimeType, setAttachedFileMimeType] = useState<string | null>(null);

  // recording
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

  const renderCheck = (tool: ToolType) =>
    activeTool === tool ? <Check className="ml-auto h-4 w-4" strokeWidth={2} /> : null;

  const toolLabel = () => {
    const tool = TOOLS_CONFIG[activeTool];
    return tool?.name || 'Plain Chat';
  };

  const getPlaceholderText = () => {
    if (isTranscribing) return 'Transcribing audio...';
    if (isLoading) return 'AI is thinking...';
    if (isRecording) return 'Begin speaking…';
    if (attachedFileName) return 'Describe the file or add text...';
    if (activeTool !== 'none') {
      const tool = TOOLS_CONFIG[activeTool];
      return `Using ${tool?.name || 'tool'}...`;
    }
    return 'Type your message...';
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
    return () => { mounted = false; };
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
        () => { fetchUnreadCount(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchUnreadCount]);

  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Auto-resize textarea when localInput changes (for mic transcription AND typing)
  useEffect(() => {
    resizeTextarea();
  }, [localInput]);

  const fetchConversations = async (userId: string) => {
    setHistoryIsLoading(true);
    const { data, error } = await supabase
      .from('conversations')
      .select('id, created_at, title, user_id')
      .eq('user_id', userId) // filter by owner
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
    if (!user) return;

    if (isRecording) mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setIsTranscribing(false);
    setIsLoading(true);
    setMessages([]);
    setRenamingId(null);
    clearAttachmentState();
    setActiveTool('none');
    setIsTyping(false);
    setIsSidebarOpen(false);

    // Only load messages that belong to the signed-in user
    const { data, error } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', id)
      .eq('user_id', user.id) // 🔒 important for RLS
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

  const generateTitle = async (convId: string) => {
    try {
      const response = await fetch('/api/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId }),
      });

      const data = await response.json();
      if (data.ok && data.title) {
        // Update the conversation title in local state
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, title: data.title } : c))
        );
      }
    } catch (error) {
      console.error('Error generating title:', error);
      // Silently fail - title generation is not critical
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleShare = async () => {
    const shareData = {
      title: 'JCIL.AI Slingshot 2.0',
      text: 'Check out Slingshot 2.0 - A Christian Conservative AI assistant powered by Claude',
      url: window.location.origin,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Share cancelled or failed:', err);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.origin);
      alert('Link copied to clipboard!');
    }
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

  const removeAttachedFile = () => { clearAttachmentState(); };

  // --------- AUDIO (unchanged behavior: manual send after transcript) ----------
  const handleTranscribe = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');

    try {
      const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
      const data = await response.json();
      if (response.ok) {
        setLocalInput((prev) => (prev + ' ' + data.text).trim());
        // useEffect will handle textarea resize automatically
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
    // Only allow Enter to submit on desktop (not mobile)
    // On mobile, Enter should create new line, only Send button submits
    if (event.key === 'Enter' && !event.shiftKey && !isMobileDevice()) {
      event.preventDefault();
      handleFormSubmit();
    }
  };

  // Helper function to detect mobile devices
  const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const handleToolButtonClick = () => {
    setToolButtonFlash(true);
    setTimeout(() => setToolButtonFlash(false), 200);
  };

  // ---- TOOL WORKSPACE CREATION ----
  const handleToolSelection = async (toolType: ToolType) => {
    if (!user) {
      alert('Please sign in to use tools.');
      return;
    }

    // If selecting "none" (Plain Chat), just set the tool
    if (toolType === 'none') {
      setActiveTool('none');
      return;
    }

    // Get tool configuration
    const toolConfig = TOOLS_CONFIG[toolType];
    if (!toolConfig) {
      console.error('Tool configuration not found:', toolType);
      return;
    }

    // Create a new conversation for this tool workspace
    const { data: newConvo, error: convError } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        title: toolConfig.name, // Use tool name as conversation title
      })
      .select('id, created_at, title, user_id')
      .single();

    if (convError || !newConvo) {
      console.error('Error creating tool workspace:', convError);
      alert('Failed to create tool workspace.');
      return;
    }

    // Clear current messages and set up new workspace
    setMessages([]);
    setConversationId(newConvo.id);
    setConversations((prev) => [newConvo, ...prev]);
    setActiveTool(toolType);
    setIsSidebarOpen(false); // Close sidebar on mobile

    // Add welcome message from AI
    if (toolConfig.welcomeMessage) {
      const welcomeMsg: Message = {
        id: `welcome_${Date.now()}`,
        role: 'assistant',
        content: toolConfig.welcomeMessage,
        created_at: new Date().toISOString(),
      };
      setMessages([welcomeMsg]);

      // Persist welcome message to database
      await supabase.from('messages').insert({
        user_id: user.id,
        conversation_id: newConvo.id,
        role: 'assistant',
        content: toolConfig.welcomeMessage,
      });
    }

    // Focus input field
    inputRef.current?.focus();
  };

  // ---- CHAT SEND LOGIC (writes user_id on every insert) ----
  // Filter conversations based on search query
  const filteredConversations = conversations.filter((convo) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const title = (convo.title || '').toLowerCase();
    const date = new Date(convo.created_at).toLocaleString().toLowerCase();

    return title.includes(query) || date.includes(query);
  });

  const handleFormSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (isLoading || isTranscribing || isRecording) return;

    // must be signed in to write rows under RLS
    if (!user) {
      alert('Please sign in to chat.');
      return;
    }

    const textInput = localInput.trim();
    const hasFile = !!uploadedFile;
    const hasText = textInput.length > 0;

    if (!hasText && !hasFile) return;
    if (isRecording) mediaRecorderRef.current?.stop();

    setIsLoading(true);
    setIsTyping(true); // Show typing indicator while AI responds

    const userMsgText = hasText ? textInput : `[Image: ${attachedFileName}]`;

    // ensure conversation exists (with user_id)
    let currentConvoId = conversationId;
    if (!currentConvoId) {
      const title = userMsgText.substring(0, 40) + '...';
      const { data: newConvo, error: convError } = await supabase
        .from('conversations')
        .insert({ user_id: user.id, title })  // ✅ include user_id
        .select('id, created_at, title, user_id')
        .single();

      if (convError) {
        console.error('conversation insert error:', convError);
        setIsLoading(false);
        alert('Failed to start a conversation.');
        return;
      }
      currentConvoId = newConvo.id;
      setConversationId(newConvo.id);
      setConversations((prev) => [newConvo, ...prev]);
    }

    // locally display user message
    const newUserMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      role: 'user',
      content: userMsgText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newUserMessage]);
    setLocalInput('');
    clearAttachmentState();

    // persist user message with user_id
    const { error: insertUserErr } = await supabase.from('messages').insert({
      user_id: user.id,                    // ✅ include user_id
      conversation_id: currentConvoId,
      role: 'user',
      content: userMsgText,
    });

    if (insertUserErr) {
      console.error('insert user message error:', insertUserErr);
      setIsLoading(false);
      setMessages((prev) => [
        ...prev,
        { id: `err_${Date.now()}`, role: 'assistant', content: 'Error saving your message.' },
      ]);
      return;
    }

    try {
      // call your chat API
      let response: Response;
      if (hasFile) {
        const formData = new FormData();
        formData.append('message', textInput);
        formData.append('file', uploadedFile as File);
        formData.append('toolType', activeTool);
        response = await fetch('/api/chat', { method: 'POST', body: formData });
      } else {
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: textInput, toolType: activeTool }),
        });
      }

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Error from /api/chat');
      }

      const assistantText: string = data.reply ?? '';

      // show assistant reply
      const assistantMessage: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        role: 'assistant',
        content: assistantText,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // persist assistant reply with user_id
      const { error: insertAsstErr } = await supabase.from('messages').insert({
        user_id: user.id,                    // ✅ include user_id
        conversation_id: currentConvoId,
        role: 'assistant',
        content: assistantText,
      });
      if (insertAsstErr) {
        console.error('insert assistant message error:', insertAsstErr);
      }

      // Generate smart title after first exchange (user message + assistant response)
      // Only generate if this is the first assistant response (2 messages total)
      if (messages.length <= 1 && currentConvoId) {
        generateTitle(currentConvoId);
      }

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
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
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

          {/* Search bar */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" strokeWidth={2} />
            <Input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 h-9 border-slate-300 focus:border-blue-900 rounded-lg text-sm"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 hover:bg-slate-100 rounded-lg"
                onClick={() => setSearchQuery('')}
              >
                <XIcon className="h-3 w-3 text-slate-500" strokeWidth={2} />
              </Button>
            )}
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
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map((convo) => (
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
          ) : searchQuery ? (
            <div className="p-4 text-center text-slate-500 text-sm">No conversations found matching "{searchQuery}"</div>
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
              
              <DropdownMenuItem 
                className="cursor-pointer text-slate-700 text-sm"
                onSelect={(e) => {
                  e.preventDefault();
                  router.push('/privacy');
                }}
              >
                Privacy Policy
              </DropdownMenuItem>

              <DropdownMenuItem 
                className="cursor-pointer text-slate-700 text-sm"
                onSelect={(e) => {
                  e.preventDefault();
                  router.push('/terms');
                }}
              >
                Terms of Service
              </DropdownMenuItem>

              <DropdownMenuItem 
                className="cursor-pointer text-slate-700 text-sm"
                onSelect={(e) => {
                  e.preventDefault();
                  router.push('/cookies');
                }}
              >
                Cookie Policy
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
              {/* Left side - Mobile menu OR desktop spacer */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden hover:bg-slate-100 rounded-lg"
                  onClick={() => setIsSidebarOpen(true)}
                >
                  <Menu className="h-6 w-6 text-slate-700" strokeWidth={2} />
                </Button>
                {/* Desktop spacer to balance right side buttons */}
                <div className="hidden lg:flex items-center gap-2">
                  <div className="w-10 h-10" />
                  <div className="w-10 h-10" />
                </div>
              </div>

              {/* Center - Title */}
              <div className="flex-1 text-center">
                <CardTitle className="text-lg sm:text-xl font-semibold text-blue-900">New Chat</CardTitle>
                <div className="text-xs text-slate-500 mt-1">{toolLabel()}</div>
              </div>

              {/* Right side - Share and Logout */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-slate-100 rounded-lg"
                  onClick={handleShare}
                  disabled={isLoading}
                  title="Share App"
                >
                  <Share2 className="h-5 w-5 text-slate-700" strokeWidth={2} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-slate-100 rounded-lg"
                  onClick={handleSignOut}
                  disabled={isLoading}
                  title="Sign Out"
                >
                  <LogOut className="h-5 w-5 text-slate-700" strokeWidth={2} />
                </Button>
              </div>
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
            {/* Spiritual Tools - Clean Buttons Above Input */}
            <div className="mb-3 sm:mb-4 flex flex-wrap gap-2 sm:gap-3">
              <Button
                type="button"
                onClick={() => router.push('/devotional')}
                disabled={isLoading}
                className="flex-1 min-w-[140px] bg-blue-900 hover:bg-blue-950 text-white font-semibold rounded-lg shadow-sm hover:shadow-md transition-all duration-200 py-2.5 sm:py-3"
              >
                <span className="text-xs sm:text-sm">DAILY DEVOTIONAL</span>
              </Button>
              <Button
                type="button"
                onClick={() => handleToolSelection('deep-bible-research')}
                disabled={isLoading}
                className="flex-1 min-w-[140px] bg-blue-900 hover:bg-blue-950 text-white font-semibold rounded-lg shadow-sm hover:shadow-md transition-all duration-200 py-2.5 sm:py-3"
              >
                <span className="text-xs sm:text-sm">BIBLE RESEARCH</span>
              </Button>
              <Button
                type="button"
                onClick={() => router.push('/news')}
                disabled={isLoading}
                className="flex-1 min-w-[140px] bg-blue-900 hover:bg-blue-950 text-white font-semibold rounded-lg shadow-sm hover:shadow-md transition-all duration-200 py-2.5 sm:py-3"
              >
                <span className="text-xs sm:text-sm">NEWS SUMMARY</span>
              </Button>
            </div>

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
                    className={`hover:bg-slate-100 rounded-lg h-9 w-9 sm:h-10 sm:w-10 ${fileButtonFlash ? 'bg-slate-200' : ''}`}
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

              {/* tool picker (icon-only wrench) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={isLoading}
                    className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 ${toolButtonFlash ? 'ring-2 ring-slate-200' : ''}`}
                    title="Pick a tool"
                    onClick={handleToolButtonClick}
                  >
                    <Wrench className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  side="top"
                  align="start"
                  className="min-w-[280px] max-h-[500px] overflow-y-auto bg-white border border-slate-200 shadow-lg rounded-xl p-1"
                >
                  <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wide text-slate-700 px-2 py-1">
                    🛠️ AI Tools
                  </DropdownMenuLabel>

                  <DropdownMenuItem
                    onClick={() => handleToolSelection('none')}
                    className="text-slate-900 text-sm cursor-pointer rounded-lg px-2 py-2 data-[highlighted]:bg-slate-100"
                  >
                    Plain Chat {renderCheck('none')}
                  </DropdownMenuItem>

                  {/* ==================== WRITING TOOLS ==================== */}
                  <DropdownMenuSeparator className="my-1 bg-slate-200" />
                  <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wide text-slate-700 px-2 py-1">
                    📝 Writing Tools
                  </DropdownMenuLabel>

                  {/* Email Writer */}
                  <DropdownMenuItem
                    onClick={() => handleToolSelection('email-high-school')}
                    className="text-slate-900 text-sm cursor-pointer rounded-lg px-2 py-2 data-[highlighted]:bg-slate-100"
                  >
                    Email · High School {renderCheck('email-high-school')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleToolSelection('email-bachelors')}
                    className="text-slate-900 text-sm cursor-pointer rounded-lg px-2 py-2 data-[highlighted]:bg-slate-100"
                  >
                    Email · Bachelor's {renderCheck('email-bachelors')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleToolSelection('email-masters')}
                    className="text-slate-900 text-sm cursor-pointer rounded-lg px-2 py-2 data-[highlighted]:bg-slate-100"
                  >
                    Email · Master's {renderCheck('email-masters')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleToolSelection('email-executive')}
                    className="text-slate-900 text-sm cursor-pointer rounded-lg px-2 py-2 data-[highlighted]:bg-slate-100"
                  >
                    Email · Executive {renderCheck('email-executive')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleToolSelection('email-phd')}
                    className="text-slate-900 text-sm cursor-pointer rounded-lg px-2 py-2 data-[highlighted]:bg-slate-100"
                  >
                    Email · PhD {renderCheck('email-phd')}
                  </DropdownMenuItem>

                  {/* Essay Writer */}
                  <div className="h-1"></div>
                  <DropdownMenuItem
                    onClick={() => handleToolSelection('essay-high-school')}
                    className="text-slate-900 text-sm cursor-pointer rounded-lg px-2 py-2 data-[highlighted]:bg-slate-100"
                  >
                    Essay · High School {renderCheck('essay-high-school')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleToolSelection('essay-bachelors')}
                    className="text-slate-900 text-sm cursor-pointer rounded-lg px-2 py-2 data-[highlighted]:bg-slate-100"
                  >
                    Essay · Bachelor's {renderCheck('essay-bachelors')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleToolSelection('essay-masters')}
                    className="text-slate-900 text-sm cursor-pointer rounded-lg px-2 py-2 data-[highlighted]:bg-slate-100"
                  >
                    Essay · Master's {renderCheck('essay-masters')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleToolSelection('essay-executive')}
                    className="text-slate-900 text-sm cursor-pointer rounded-lg px-2 py-2 data-[highlighted]:bg-slate-100"
                  >
                    Essay · Executive {renderCheck('essay-executive')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleToolSelection('essay-phd')}
                    className="text-slate-900 text-sm cursor-pointer rounded-lg px-2 py-2 data-[highlighted]:bg-slate-100"
                  >
                    Essay · PhD {renderCheck('essay-phd')}
                  </DropdownMenuItem>

                  {/* Text Message Writer */}
                  <div className="h-1"></div>
                  <DropdownMenuItem
                    onClick={() => handleToolSelection('text-message-casual')}
                    className="text-slate-900 text-sm cursor-pointer rounded-lg px-2 py-2 data-[highlighted]:bg-slate-100"
                  >
                    Text Message · Casual {renderCheck('text-message-casual')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleToolSelection('text-message-professional')}
                    className="text-slate-900 text-sm cursor-pointer rounded-lg px-2 py-2 data-[highlighted]:bg-slate-100"
                  >
                    Text Message · Professional {renderCheck('text-message-professional')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleToolSelection('text-message-formal')}
                    className="text-slate-900 text-sm cursor-pointer rounded-lg px-2 py-2 data-[highlighted]:bg-slate-100"
                  >
                    Text Message · Formal {renderCheck('text-message-formal')}
                  </DropdownMenuItem>

                  {/* ==================== PROFESSIONAL TOOLS ==================== */}
                  <DropdownMenuSeparator className="my-1 bg-slate-200" />
                  <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wide text-slate-700 px-2 py-1">
                    💼 Professional
                  </DropdownMenuLabel>

                  <DropdownMenuItem
                    onClick={() => handleToolSelection('resume-writer')}
                    className="text-slate-900 text-sm cursor-pointer rounded-lg px-2 py-2 data-[highlighted]:bg-slate-100"
                  >
                    Resume Writer (ATS) {renderCheck('resume-writer')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleToolSelection('document-summary')}
                    className="text-slate-900 text-sm cursor-pointer rounded-lg px-2 py-2 data-[highlighted]:bg-slate-100"
                  >
                    Document Summary {renderCheck('document-summary')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleToolSelection('data-analysis')}
                    className="text-slate-900 text-sm cursor-pointer rounded-lg px-2 py-2 data-[highlighted]:bg-slate-100"
                  >
                    Data Analysis {renderCheck('data-analysis')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleToolSelection('business-strategy')}
                    className="text-slate-900 text-sm cursor-pointer rounded-lg px-2 py-2 data-[highlighted]:bg-slate-100"
                  >
                    Business Strategy {renderCheck('business-strategy')}
                  </DropdownMenuItem>

                  {/* ==================== AI ASSISTANTS ==================== */}
                  <DropdownMenuSeparator className="my-1 bg-slate-200" />
                  <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wide text-slate-700 px-2 py-1">
                    🤖 AI Assistants
                  </DropdownMenuLabel>

                  <DropdownMenuItem
                    onClick={() => handleToolSelection('apologetics-helper')}
                    className="text-slate-900 text-sm cursor-pointer rounded-lg px-2 py-2 data-[highlighted]:bg-slate-100"
                  >
                    Apologetics Helper {renderCheck('apologetics-helper')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleToolSelection('coding-assistant')}
                    className="text-slate-900 text-sm cursor-pointer rounded-lg px-2 py-2 data-[highlighted]:bg-slate-100"
                  >
                    Coding Assistant {renderCheck('coding-assistant')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleToolSelection('deep-bible-research')}
                    className="text-slate-900 text-sm cursor-pointer rounded-lg px-2 py-2 data-[highlighted]:bg-slate-100"
                  >
                    Deep Bible Research {renderCheck('deep-bible-research')}
                  </DropdownMenuItem>

                  {/* ==================== PRACTICAL TOOLS ==================== */}
                  <DropdownMenuSeparator className="my-1 bg-slate-200" />
                  <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wide text-slate-700 px-2 py-1">
                    🌿 Practical Tools
                  </DropdownMenuLabel>

                  <DropdownMenuItem
                    onClick={() => handleToolSelection('plant-identifier')}
                    className="text-slate-900 text-sm cursor-pointer rounded-lg px-2 py-2 data-[highlighted]:bg-slate-100"
                  >
                    Plant Identifier {renderCheck('plant-identifier')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleToolSelection('ingredient-extractor')}
                    className="text-slate-900 text-sm cursor-pointer rounded-lg px-2 py-2 data-[highlighted]:bg-slate-100"
                  >
                    Ingredient Extractor {renderCheck('ingredient-extractor')}
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
                  {isTranscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" strokeWidth={2} />}
                </Button>

                <Button
                  type="submit"
                  disabled={isLoading || isTranscribing || (!localInput.trim() && !attachedFileName)}
                  className="h-8 w-8 sm:h-9 sm:w-9 mr-1.5 bg-blue-900 hover:bg-blue-950 text-white rounded-lg flex items-center justify-center"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Send className="h-4 w-4" strokeWidth={2} />}
                </Button>
              </div>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}