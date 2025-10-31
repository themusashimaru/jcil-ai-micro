// /src/app/page.tsx

'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Mic, Paperclip, Bell, Loader2, File as FileIcon, X as XIcon, Wrench, Check, ClipboardCopy, Menu, Send } from 'lucide-react'; 
import { useEffect, useState, useRef, useCallback } from 'react';
import { type User as SupabaseUser } from '@supabase/supabase-js';
import { formatMessageTime } from '@/lib/format-date'; // 🔥 NEW: Import timestamp formatter

// --- Define Types ---
interface Message { 
  id: string; 
  role: 'user' | 'assistant'; 
  content: string;
  created_at?: string; // 🔥 NEW: Add timestamp support
}
interface Conversation { id: string; created_at: string; title?: string | null; }
interface Notification { id: string; created_at: string; content: string; read_status: boolean; }

type ActiveTool = 'none' | 'textMessageTool' | 'emailWriter' | 'recipeExtractor';

// ===== FILE UPLOAD CONSTANTS =====
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// --- Speech Recognition ---
const SpeechRecognitionAPI = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;

// ===== Typing Indicator Component =====
const TypingIndicator = () => (
  <div className="flex items-start space-x-2 justify-start">
    <div className="p-3 max-w-xs lg:max-w-md">
      <div className="flex space-x-2">
        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  </div>
);

// --- Component Start ---
const supabase = createClient();

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<SupabaseUser | null>(null);

  // --- States ---
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [localInput, setLocalInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [historyIsLoading, setHistoryIsLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [attachedFileMimeType, setAttachedFileMimeType] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTool, setActiveTool] = useState<ActiveTool>('none'); 
  const inputRef = useRef<HTMLTextAreaElement>(null); 
  const finalTranscriptRef = useRef<string>('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [fileButtonFlash, setFileButtonFlash] = useState(false);
  const [toolButtonFlash, setToolButtonFlash] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  // --- Function to fetch unread count ---
  const fetchUnreadCount = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) { return; }
    const { error, count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).eq('read_status', false);
    if (error) { console.error('fetchUnreadCount: Error:', error); }
    else { setUnreadCount(count ?? 0); }
  }, []);

  // --- Effects ---
  // Speech Recognition Setup with Auto Language Detection
  useEffect(() => {
    if (!SpeechRecognitionAPI) { 
      console.warn("Speech Recognition not supported in this browser."); 
      setSpeechRecognitionSupported(false);
      return; 
    }
    
    setSpeechRecognitionSupported(true);
    
    let instance: SpeechRecognition | null = recognitionRef.current;
    if (!instance) {
        instance = new SpeechRecognitionAPI();
        instance.continuous = true; 
        instance.interimResults = true;
        
        // Auto-detect language from browser
        const browserLanguage = navigator.language || 'en-US';
        instance.lang = browserLanguage;
        console.log(`Speech recognition language set to: ${browserLanguage}`);
        
        recognitionRef.current = instance; 
        console.log("Speech instance created.");
    }
    instance.onstart = () => { 
      console.log("Speech started."); 
      setIsRecording(true); 
      finalTranscriptRef.current = localInput; 
    };
    instance.onresult = (event) => { 
      let iT = '', cF = ''; 
      for (let i = 0; i < event.results.length; ++i) { 
        const tS = event.results[i][0].transcript; 
        if (event.results[i].isFinal) cF += tS + ' '; 
        else if (i >= event.resultIndex) iT = tS; 
      } 
      finalTranscriptRef.current = cF.trim(); 
      const fT = finalTranscriptRef.current + (iT ? ' ' + iT : ''); 
      setLocalInput(fT.trim()); 
    };
    instance.onerror = (event) => { 
      console.error("Speech Error:", event.error); 
      
      if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone access in your browser settings.');
      } else if (event.error === 'no-speech') {
        alert('No speech detected. Please try again.');
      } else {
        alert(`Microphone Error: ${event.error}`);
      }
      
      setIsRecording(false); 
    };
    instance.onend = () => { 
      console.log("Speech ended."); 
      setIsRecording(false); 
    };
    return () => { 
      console.log("Cleaning up speech."); 
      if (recognitionRef.current) { 
        recognitionRef.current.stop(); 
      } 
      setIsRecording(false); 
    };
  }, []); 

  // Get User and Initial Data
  useEffect(() => {
    let isMounted = true;
    const getUserAndInitialData = async () => {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if(!isMounted) return;
        setUser(currentUser);
        if (currentUser) {
            fetchConversations(currentUser.id);
            fetchUnreadCount();
        } else {
            setHistoryIsLoading(false);
        }
    };
    getUserAndInitialData();
    return () => { isMounted = false; };
  }, [fetchUnreadCount]);

  const fetchConversations = async (userId: string) => {
    setHistoryIsLoading(true);
    const { data, error } = await supabase
      .from('conversations')
      .select('id, created_at, title')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) console.error('Error fetching conversations:', error);
    else if (data) setConversations(data);
    setHistoryIsLoading(false);
  };

  // Realtime Subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('public:notifications').on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => { fetchUnreadCount(); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchUnreadCount]);

  // Scroll Chat
  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

  // Focus Input
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Detect iOS device
  useEffect(() => {
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);
  }, []);

  // --- Functions ---
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  
  const clearAttachmentState = () => {
    setUploadedFileUrl(null);
    setAttachedFileName(null);
    setAttachedFileMimeType(null); 
  };

  const handleNewChat = () => { 
    setMessages([]); 
    setConversationId(null); 
    setLocalInput(''); 
    setRenamingId(null); 
    clearAttachmentState(); 
    setActiveTool('none'); 
    if (isRecording) { recognitionRef.current?.stop(); } 
    inputRef.current?.focus(); 
    finalTranscriptRef.current = '';
    setIsTyping(false);
    setIsSidebarOpen(false);
  };

  const loadConversation = async (id: string) => {
    if (isLoading || renamingId === id) return; 
    if (isRecording) { recognitionRef.current?.stop(); }
    setIsLoading(true); 
    setMessages([]); 
    setRenamingId(null); 
    clearAttachmentState(); 
    setActiveTool('none'); 
    finalTranscriptRef.current = '';
    setIsTyping(false);
    setIsSidebarOpen(false);
    
    // 🔥 UPDATED: Now fetch created_at timestamp too!
    const { data, error } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });
    
    if (error) { 
      console.error('Error loading msgs:', error); 
      setMessages([{ id:'err', role:'assistant', content:'Error loading conversation.' }]); 
    }
    else if (data) { 
      const loadedMessages = data.map(msg => ({ 
        id: msg.id, 
        role: msg.role as 'user' | 'assistant', 
        content: msg.content,
        created_at: msg.created_at // 🔥 NEW: Include timestamp
      })); 
      setMessages(loadedMessages); 
      setConversationId(id); 
    }
    setIsLoading(false); 
    inputRef.current?.focus();
  };

  const handleDelete = async (id: string) => {
    if (isLoading || !window.confirm("Delete this chat?")) return;
    const { error } = await supabase.from('conversations').delete().eq('id', id);
    if (error) { 
      console.error("Error deleting:", error); 
      alert("Error deleting conversation."); 
    }
    else { 
      setConversations(prev => prev.filter(c => c.id !== id)); 
      if (conversationId === id) handleNewChat(); 
    }
  };

  const handleRenameClick = (convo: Conversation) => { 
    setRenamingId(convo.id); 
    setRenameValue(convo.title || `Chat from ${new Date(convo.created_at).toLocaleString()}`); 
  };

  const handleRenameSubmit = async (e: React.FormEvent<HTMLFormElement>, id: string) => {
    e.preventDefault(); 
    if (isLoading || !renameValue.trim()) { 
      setRenamingId(null); 
      return; 
    }
    const newTitle = renameValue.trim();
    const { error } = await supabase.from('conversations').update({ title: newTitle }).eq('id', id);
    if (error) { 
      console.error("Error renaming:", error); 
      alert("Error renaming conversation."); 
    }
    else { 
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c)); 
    }
    setRenamingId(null); 
    setRenameValue('');
  };

  const handleFormSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
     if (e) e.preventDefault();
     if ((!localInput.trim() && !attachedFileName) || isLoading) return; 
     if (isRecording) { recognitionRef.current?.stop(); }
     
     setIsLoading(true);
     setIsTyping(true);
     
     const fileUrl = uploadedFileUrl;
     const fileMimeType = attachedFileMimeType;

     let userMsg: string;
     if (localInput.trim()) {
        userMsg = localInput;
     } else if (attachedFileName) {
        userMsg = `[Analyzing file: ${attachedFileName}]`;
     } else {
        setIsLoading(false);
        setIsTyping(false);
        return; 
     }

     // 🔥 FIXED: Using simple ID generator instead of crypto.randomUUID()
     const newUserMessage: Message = { 
       id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, 
       role: 'user', 
       content: userMsg,
       created_at: new Date().toISOString() // 🔥 NEW: Add timestamp
     };
     const currentMessages = [...messages, newUserMessage];
     
     setMessages(currentMessages); 
     setLocalInput(''); 
     clearAttachmentState(); 
     finalTranscriptRef.current = '';
     
     let currentConvoId = conversationId;
     if (!currentConvoId) {
        const title = userMsg.substring(0, 40) + "...";
        const { data: newConvo, error: convError } = await supabase.from('conversations').insert({ user_id: user!.id, title }).select('id, created_at, title').single();
        if (convError || !newConvo) { 
          console.error("Error creating convo:", convError); 
          setMessages(prev => prev.filter(m => m.id !== newUserMessage.id)); 
          alert("Error saving conversation."); 
          setIsLoading(false);
          setIsTyping(false);
          return; 
        }
        currentConvoId = newConvo.id; 
        setConversationId(newConvo.id); 
        setConversations(prev => [newConvo, ...prev]);
     }
     try {
        const response = await fetch('/api/chat', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ 
            messages: currentMessages, 
            conversationId: currentConvoId, 
            tool: activeTool,
            fileUrl,         
            fileMimeType,
          }) 
        });

        if (!response.ok || !response.body) { 
          let err; 
          try { err = await response.json(); } catch {} 
          throw new Error(err?.error || response.statusText); 
        }

        const reader = response.body.getReader(); 
        const decoder = new TextDecoder(); 
        // 🔥 FIXED: Using simple ID generator instead of crypto.randomUUID()
        let assistantId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        let assistantContent = ''; 
        let firstChunk = true;
        
        while (true) { 
           const { done, value } = await reader.read(); 
           if (done) break; 
           const chunk = decoder.decode(value, { stream: true }); 
           assistantContent += chunk;
           
           if (firstChunk && assistantContent.length > 0) {
             setIsTyping(false);
           }
           
           setMessages(prev => { 
             if (firstChunk) { 
               firstChunk = false;
               // 🔥 NEW: Add timestamp to assistant message
               return [...prev, { 
                 id: assistantId, 
                 role: 'assistant', 
                 content: assistantContent,
                 created_at: new Date().toISOString()
               }]; 
             } else { 
               const last = prev[prev.length - 1]; 
               if (last?.role === 'assistant') { 
                 return [...prev.slice(0, -1), { ...last, content: assistantContent }]; 
               } 
               return [...prev, { 
                 id: assistantId, 
                 role: 'assistant', 
                 content: assistantContent,
                 created_at: new Date().toISOString()
               }]; 
             } 
           });
        }
     } catch (error) { 
       console.error("Error fetching/streaming:", error);
       setIsTyping(false);
       // 🔥 FIXED: Using simple ID generator instead of crypto.randomUUID()
       setMessages(prev => [...prev, { 
         id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, 
         role: 'assistant', 
         content: `Sorry, an error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
         created_at: new Date().toISOString() // 🔥 NEW: Add timestamp
       }]); 
     }
     finally {
         setIsLoading(false);
         setIsTyping(false);
         inputRef.current?.focus();
     }
   };

  const handleSignOut = async () => { 
    await supabase.auth.signOut(); 
    router.push('/login'); 
    router.refresh(); 
  };

  const handleCopy = useCallback((id: string, content: string) => {
    if ('clipboard' in navigator) {
      navigator.clipboard.writeText(content).then(() => {
        setCopiedMessageId(id);
        setTimeout(() => setCopiedMessageId(null), 2000);
      }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy.');
      });
    } else {
      alert('Clipboard API not available. Please copy manually.');
    }
  }, []);

  const handleMicClick = () => {
    if (!speechRecognitionSupported) {
      alert("Voice input is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }
    
    if (!recognitionRef.current) { 
      alert("Microphone not ready. Please refresh the page."); 
      return; 
    }
    
    if (isLoading) return;
    
    if (isRecording) {
      console.log("Mic click: Requesting stop...");
      recognitionRef.current.stop();
    } else {
       console.log("Mic click: Requesting start...");
       finalTranscriptRef.current = localInput; 
       try { 
         recognitionRef.current.start(); 
       }
       catch (e) { 
         console.error("Error starting mic:", e); 
         alert("Failed to start microphone. Please check your browser permissions.");
         setIsRecording(false); 
       }
    }
  };

  const handleUploadClick = () => { 
    if(isLoading) return;
    
    // Flash effect
    setFileButtonFlash(true);
    setTimeout(() => setFileButtonFlash(false), 200);
    
    fileInputRef.current?.click(); 
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => { 
    const file = event.target.files?.[0]; 
    
    if (file && user) {
      if (!ALLOWED_FILE_TYPES.includes(file.type.toLowerCase())) {
        alert(`Invalid file type. Please upload an image file:\n${ALLOWED_FILE_EXTENSIONS.join(', ')}`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      
      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
        alert(`File is too large. Maximum size is ${sizeMB}MB.\nYour file: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      
      uploadFile(file);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = ''; 
  };
  
  const removeAttachedFile = () => {
    clearAttachmentState(); 
  };

  const uploadFile = async (file: File) => {
    const { data: { session } } = await supabase.auth.getSession(); 
    if (!session || !user) { 
      alert("Authentication issue. Please sign in again."); 
      return; 
    }
    
    const filePath = `${user.id}/${Date.now()}_${file.name}`;
    setIsLoading(true);
    
    clearAttachmentState(); 

    const { data, error } = await supabase.storage.from('uploads').upload(filePath, file, { cacheControl: '3600', upsert: false });
    
    if (error) { 
      console.error("Upload error:", error);
      alert(`Upload failed: ${error.message}`); 
      setIsLoading(false); 
    }
    else if (data) {
      const { data: urlData, error: urlError } = await supabase.storage.from('uploads').createSignedUrl(filePath, 3600);
      
      if (urlError) { 
        console.error("URL error:", urlError);
        alert('Upload succeeded but failed to get file URL.'); 
      } 
      else if (urlData) { 
        setUploadedFileUrl(urlData.signedUrl); 
        setAttachedFileName(file.name);
        setAttachedFileMimeType(file.type); 
      }
      setIsLoading(false);
    } else { 
      setIsLoading(false); 
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalInput(e.target.value);
    
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
  };

  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleFormSubmit();
    }
  };

  const renderCheck = (tool: ActiveTool) => {
    if (activeTool === tool) {
      return <Check className="ml-auto h-4 w-4" strokeWidth={2} />;
    }
    return null;
  };

  const getPlaceholderText = () => {
    if (isLoading) return "AI is thinking...";
    if (isRecording) return "Listening...";
    if (attachedFileName) return "Describe the file or add text...";
    if (activeTool === 'textMessageTool') return "Using Text Message Tool... (Paste text or upload screenshot)";
    if (activeTool === 'emailWriter') return "Using Email Writing Tool... (Paste email or describe)";
    if (activeTool === 'recipeExtractor') return "Using Recipe Extractor... (Paste recipe or upload photo)";
    return "Type your message...";
  };

  const handleToolButtonClick = () => {
    // Flash effect
    setToolButtonFlash(true);
    setTimeout(() => setToolButtonFlash(false), 200);
  };

  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return "How can I help you this morning?";
    } else if (hour >= 12 && hour < 17) {
      return "How can I help you this afternoon?";
    } else {
      return "How can I help you this evening?";
    }
  };

  // --- Render ---
  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:relative
        w-80 h-full
        flex-shrink-0 bg-white border-r border-slate-200 flex flex-col shadow-sm
        transform transition-transform duration-300 ease-in-out
        z-50
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Sidebar Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-tight text-slate-700">Chat History</h2>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold uppercase tracking-tight text-slate-700">JCIL.ai</span>
              {/* Close button for mobile */}
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
        
        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {historyIsLoading ? ( 
            <div className="p-4 text-center text-slate-500 text-sm">Loading chats...</div> 
          ) : conversations.length > 0 ? (
            conversations.map(convo => (
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
        
        {/* Sidebar Footer - White Background to match rest of sidebar */}
        <div className="bg-white px-6 py-4 space-y-3 border-t border-slate-200">
           {/* Notifications Button */}
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
           
           {/* Legal Menu Dropdown */}
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
             <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 shadow-lg rounded-lg">
               <DropdownMenuLabel className="text-slate-700 text-xs font-bold uppercase">Legal Information</DropdownMenuLabel>
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

           {/* User Profile Section - Email only, no avatar */}
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
             <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 shadow-lg rounded-lg">
               <DropdownMenuItem 
                 onClick={() => router.push('/settings')}
                 className="text-slate-700 cursor-pointer text-sm"
               >
                 <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                   <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                   <circle cx="12" cy="12" r="3"/>
                 </svg>
                 Settings
               </DropdownMenuItem>
               <DropdownMenuItem 
                 onClick={handleSignOut}
                 className="text-slate-700 cursor-pointer text-sm"
               >
                 <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                   <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                   <polyline points="16 17 21 12 16 7"/>
                   <line x1="21" y1="12" x2="9" y2="12"/>
                 </svg>
                 Sign Out
               </DropdownMenuItem>
             </DropdownMenuContent>
           </DropdownMenu>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col p-2 sm:p-4 md:p-6 bg-white overflow-hidden">
        <Card className="w-full h-full flex flex-col shadow-sm sm:shadow-lg bg-white border-slate-200 rounded-lg sm:rounded-xl">
          <CardHeader className="bg-white border-b border-slate-200 rounded-t-lg sm:rounded-t-xl px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-5">
            <div className="flex items-center justify-between">
              {/* Mobile Hamburger Menu - Left */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden hover:bg-slate-100 rounded-lg"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu className="h-6 w-6 text-slate-700" strokeWidth={2} />
              </Button>
              
              {/* Centered Title - Navy Blue */}
              <div className="flex-1 text-center">
                <CardTitle className="text-lg sm:text-xl font-semibold text-blue-900">New Chat</CardTitle>
              </div>
              
              {/* Spacer for mobile to keep title centered */}
              <div className="w-10 lg:hidden"></div>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 bg-white">
            {isLoading && messages.length === 0 ? ( 
              <div className="text-center text-slate-500 text-sm">Loading messages...</div> 
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full space-y-6">
                {/* Logo Container */}
                <div className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 flex items-center justify-center">
                  <img
                    src="/jcil-ai-logo.png"
                    alt="JCIL.ai Logo"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      // Fallback if image doesn't load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('.logo-fallback')) {
                        const fallback = document.createElement('div');
                        fallback.className = 'logo-fallback w-full h-full bg-blue-900 rounded-lg flex items-center justify-center text-white text-4xl font-bold';
                        fallback.textContent = 'JCIL';
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                </div>
                <p className="text-slate-700 text-base sm:text-lg md:text-xl font-medium text-center px-4">
                  {getTimeBasedGreeting()}
                </p>
              </div>
            ) : ( 
              messages.map((msg: Message) => ( 
                <div key={msg.id} className={`flex items-start space-x-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}> 
                  
                  {/* AI Avatar - Show JCIL logo for assistant messages */}
                  {msg.role === 'assistant' && (
                    <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center -mt-6">
                      <img
                        src="/jcil-ai-logo.png"
                        alt="JCIL AI"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const fallback = document.createElement('div');
                            fallback.className = 'w-full h-full bg-blue-900 rounded-full flex items-center justify-center';
                            fallback.innerHTML = '<span class="text-white text-lg font-bold">AI</span>';
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                    </div>
                  )}
                  
                  {/* Message Content */}
                  <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-xs lg:max-w-md`}>
                    {msg.role === 'user' ? (
                      <div className="bg-blue-900 text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl whitespace-pre-wrap text-sm leading-relaxed shadow-sm">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                        {msg.content}
                      </div>
                    )}
                    
                    {/* 🔥 NEW: Timestamp Display */}
                    {msg.created_at && (
                      <div className="text-[10px] sm:text-xs text-slate-400 mt-1 px-1">
                        {formatMessageTime(msg.created_at)}
                      </div>
                    )}
                  </div>
                  
                  {/* Copy Button for Assistant Messages */}
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
            
            {/* Typing Indicator */}
            {isTyping && <TypingIndicator />}
            
            <div ref={messagesEndRef} />
          </CardContent>
          
          {/* Form with Textarea */}
          <form onSubmit={handleFormSubmit} className="px-3 sm:px-6 md:px-8 py-3 sm:py-4 md:py-5 border-t border-slate-200 bg-white rounded-b-lg sm:rounded-b-xl">
            
            {/* Attached File Indicator */}
            {attachedFileName && (
              <div className="mb-2 sm:mb-3 flex items-center justify-between rounded-lg sm:rounded-xl border border-slate-300 bg-slate-50 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm shadow-sm">
                <div className="flex items-center gap-2 truncate">
                  <FileIcon className="h-4 w-4 flex-shrink-0 text-slate-600" strokeWidth={2} />
                  <span className="truncate text-slate-700 font-medium" title={attachedFileName}>
                    {attachedFileName}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 sm:h-7 sm:w-7 flex-shrink-0 rounded-full hover:bg-slate-200 transition-all"
                  onClick={removeAttachedFile}
                  disabled={isLoading}
                >
                  <XIcon className="h-3 w-3 sm:h-4 sm:w-4 text-slate-600" strokeWidth={2} />
                </Button>
              </div>
            )}

            <div className="flex items-center space-x-2"> 
              {/* Hidden file inputs */}
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
              
              {/* File Upload Button with Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    type="button" 
                    variant="ghost"
                    size="icon" 
                    disabled={isLoading} 
                    className={`flex-shrink-0 hover:bg-slate-100 transition-all rounded-lg h-9 w-9 sm:h-10 sm:w-10 ${fileButtonFlash ? 'bg-slate-200' : ''}`}
                    title="Attach file or take photo"
                  >
                      <Paperclip className="h-4 w-4 sm:h-5 sm:w-5 text-slate-700" strokeWidth={2} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="bg-white border border-slate-200 shadow-lg rounded-lg">
                  <DropdownMenuItem 
                    onSelect={() => cameraInputRef.current?.click()} 
                    className="text-slate-700 text-sm cursor-pointer"
                  >
                    📸 Take Photo
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onSelect={() => fileInputRef.current?.click()} 
                    className="text-slate-700 text-sm cursor-pointer"
                  >
                    🖼️ Choose File
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Tool Selector Button */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    type="button" 
                    variant="ghost"
                    size="icon" 
                    disabled={isLoading} 
                    onClick={handleToolButtonClick}
                    className={`flex-shrink-0 transition-all rounded-lg h-9 w-9 sm:h-10 sm:w-10 ${
                      activeTool === 'none' 
                        ? 'hover:bg-slate-100 text-slate-700' 
                        : 'bg-blue-900 hover:bg-blue-950 text-white'
                    } ${toolButtonFlash ? 'bg-slate-200' : ''}`}
                    title="Select tool"
                  >
                      <Wrench className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="bg-white border border-slate-200 shadow-lg rounded-lg">
                  <DropdownMenuLabel className="text-slate-700 text-xs font-bold uppercase">Select Tool</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-200" />
                  <DropdownMenuItem onSelect={() => setActiveTool('none')} className="text-slate-700 text-sm cursor-pointer">
                    Regular Chat
                    {renderCheck('none')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setActiveTool('textMessageTool')} className="text-slate-700 text-sm cursor-pointer">
                    Text Message Tool
                    {renderCheck('textMessageTool')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setActiveTool('emailWriter')} className="text-slate-700 text-sm cursor-pointer">
                    Email Writer
                    {renderCheck('emailWriter')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setActiveTool('recipeExtractor')} className="text-slate-700 text-sm cursor-pointer">
                    Recipe Extractor
                    {renderCheck('recipeExtractor')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Input Container with Textarea, Mic, and Send */}
              <div className="flex-1 relative flex items-center border border-slate-300 rounded-xl bg-white focus-within:border-blue-900 transition-all">
                {/* Textarea Input */}
                <Textarea
                   ref={inputRef} 
                   value={localInput}
                   onChange={handleTextareaChange}
                   placeholder={getPlaceholderText()} 
                   disabled={isLoading}
                   autoComplete="off"
                   autoCorrect="off"
                   autoCapitalize="sentences"
                   spellCheck="true"
                   inputMode="text"
                   className="flex-1 resize-none min-h-[40px] sm:min-h-[44px] max-h-[120px] sm:max-h-[150px] text-xs sm:text-sm leading-relaxed overflow-y-auto bg-transparent !border-0 !ring-0 !outline-none focus:!ring-0 focus:!outline-none focus-visible:!ring-0 focus-visible:!outline-none shadow-none px-3 sm:px-4 py-2.5 sm:py-3" 
                   rows={1} 
                   onKeyDown={handleTextareaKeyDown}
                   style={{ border: 'none', boxShadow: 'none', outline: 'none' }}
                 />
                
                {/* Microphone Button - Inside input box, hidden on iOS */}
                {!isIOS && (
                  <Button 
                    type="button" 
                    variant="ghost"
                    size="icon" 
                    disabled={isLoading || !speechRecognitionSupported} 
                    onClick={handleMicClick} 
                    className={`flex flex-shrink-0 transition-all rounded-lg h-8 w-8 mr-1 ${
                      isRecording 
                        ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' 
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                    title={speechRecognitionSupported ? "Voice input" : "Voice input not supported"}
                  >
                      <Mic className="h-4 w-4" strokeWidth={2} />
                  </Button>
                )}
                
                {/* Send Button - Navy square with white plane icon, gold on active */}
                <Button
                   type="submit"
                   disabled={isLoading || (!localInput.trim() && !attachedFileName)}
                   className="flex-shrink-0 h-8 w-8 sm:h-9 sm:w-9 mr-1.5 bg-blue-900 hover:bg-blue-950 active:bg-blue-950 text-white rounded-lg transition-all p-0 flex items-center justify-center group" 
                 >
                   {isLoading ? (
                     <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                   ) : (
                     <Send className="h-4 w-4 group-active:text-yellow-500 transition-colors" strokeWidth={2} />
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