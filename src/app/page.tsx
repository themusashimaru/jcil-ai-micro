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
import { formatMessageTime } from '@/lib/format-date';

// --- Define Types ---
interface Message { 
  id: string; 
  role: 'user' | 'assistant'; 
  content: string;
  created_at?: string;
}
interface Conversation { id: string; created_at: string; title?: string | null; }
interface Notification { id: string; created_at: string; content: string; read_status: boolean; }

type ActiveTool = 'none' | 'textMessageTool' | 'emailWriter' | 'recipeExtractor';

// ===== FILE UPLOAD CONSTANTS =====
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

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
  const [isLoading, setIsLoading] = useState(false); // For chat response
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [historyIsLoading, setHistoryIsLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  
  // 🔥 WHISPER AUDIO STATES
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [attachedFileMimeType, setAttachedFileMimeType] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTool, setActiveTool] = useState<ActiveTool>('none'); 
  const inputRef = useRef<HTMLTextAreaElement>(null); 
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [fileButtonFlash, setFileButtonFlash] = useState(false);
  const [toolButtonFlash, setToolButtonFlash] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // --- Function to fetch unread count ---
  const fetchUnreadCount = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) { return; }
    const { error, count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).eq('read_status', false);
    if (error) { console.error('fetchUnreadCount: Error:', error); }
    else { setUnreadCount(count ?? 0); }
  }, []);

  // --- Effects ---
  
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
    if (isRecording) { mediaRecorderRef.current?.stop(); } 
    setIsRecording(false);
    setIsTranscribing(false);
    inputRef.current?.focus(); 
    setIsTyping(false);
    setIsSidebarOpen(false);
  };

  const loadConversation = async (id: string) => {
    if (isLoading || renamingId === id) return; 
    if (isRecording) { mediaRecorderRef.current?.stop(); }
    setIsRecording(false);
    setIsTranscribing(false);
    setIsLoading(true); 
    setMessages([]); 
    setRenamingId(null); 
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
      setMessages([{ id:'err', role:'assistant', content:'Error loading conversation.' }]); 
    }
    else if (data) { 
      const loadedMessages = data.map(msg => ({ 
        id: msg.id, 
        role: msg.role as 'user' | 'assistant', 
        content: msg.content,
        created_at: msg.created_at
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

  // 🔥 --- REWRITTEN FORM SUBMIT ---
  const handleFormSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
     if (e) e.preventDefault();
     if (isLoading || isTranscribing || isRecording) return;
     
     // --- Capture current state at the time of submission ---
     const textInput = localInput.trim();
     const fileUrl = uploadedFileUrl;
     const fileMimeType = attachedFileMimeType;
     const fileName = attachedFileName;

     // --- Check for content ---
     const hasText = textInput.length > 0;
     const hasFile = fileName && fileUrl;
     
     if (!hasText && !hasFile) return; // Exit if nothing to send

     if (isRecording) { mediaRecorderRef.current?.stop(); }
     
     setIsLoading(true);
     setIsTyping(true);
     
     // --- 1. Create userMsg logic (Fixes Bug #1) ---
     let userMsg: string;
     let userMsgForTitle: string;

     if (hasText) {
        userMsg = textInput; // If there's text, use it as the content
        userMsgForTitle = userMsg;
     } else if (hasFile) {
        userMsg = `[Image: ${fileName}]`; // If only a file, use this
        userMsgForTitle = userMsg;
     } else {
        // Should be impossible due to guard clause
        setIsLoading(false);
        setIsTyping(false);
        return;
     }

     const newUserMessage: Message = { 
       id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, 
       role: 'user', 
       content: userMsg,
       created_at: new Date().toISOString()
     };
     const currentMessages = [...messages, newUserMessage];
     
     setMessages(currentMessages); 
     setLocalInput(''); 
     
     // 🔥 BUG FIX: Clear attachment state AFTER sending, not before
     // We will do this in the `finally` block of the fetch
     
     let currentConvoId = conversationId;
     if (!currentConvoId) {
        const title = userMsgForTitle.substring(0, 40) + "...";
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
        // --- 2. Send request (Fixes Bug #2) ---
        const response = await fetch('/api/chat', {
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ 
            messages: currentMessages, 
            conversationId: currentConvoId, 
            tool: activeTool,
            // Explicitly pass the captured file data
            fileUrl: hasFile ? fileUrl : null,         
            fileMimeType: hasFile ? fileMimeType : null,
          }) 
        });

        if (!response.ok || !response.body) { 
          let err; 
          try { err = await response.json(); } catch {} 
          throw new Error(err?.error || response.statusText); 
        }

        const reader = response.body.getReader(); 
        const decoder = new TextDecoder(); 
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
       setMessages(prev => [...prev, { 
         id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, 
         role: 'assistant', 
         content: `Sorry, an error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
         created_at: new Date().toISOString()
       }]); 
     }
     finally {
         setIsLoading(false);
         setIsTyping(false);
         clearAttachmentState(); // 🔥 BUG FIX: Clear state AFTER fetch is done
         inputRef.current?.focus();
     }
   };
   // 🔥 --- END REWRITTEN FORM SUBMIT ---

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

  // 🔥 --- WHISPER API LOGIC ---
  
  // 🔥 BUG FIX: New function to resize textarea
  const resizeTextarea = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 150) + 'px';
    }
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
        // 🔥 BUG FIX: Append text, don't replace
        setLocalInput(prev => (prev + ' ' + data.text).trim());
        
        // 🔥 BUG FIX: Force resize after setting new text
        // We need a slight delay for React to update the value
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

    if (isRecording) {
      // --- STOP RECORDING ---
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      // --- START RECORDING ---
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
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
      } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Microphone access denied. Please allow microphone access in your browser settings.');
        setIsRecording(false);
      }
    }
  };
  // 🔥 --- END WHISPER API LOGIC ---

  const handleUploadClick = () => { 
    if(isLoading) return;
    
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
    resizeTextarea(); // 🔥 BUG FIX: Call resize function here too
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
    if (isTranscribing) return "Transcribing audio...";
    if (isLoading) return "AI is thinking...";
    if (isRecording) return "Recording... Click mic to stop.";
    if (attachedFileName) return "Describe the file or add text...";
    if (activeTool === 'textMessageTool') return "Using Text Message Tool... (Paste text or upload screenshot)";
    if (activeTool === 'emailWriter') return "Using Email Writing Tool... (Paste email or describe)";
    if (activeTool === 'recipeExtractor') return "Using Recipe Extractor... (Paste recipe or upload photo)";
    return "Type your message...";
  };

  const handleToolButtonClick = () => {
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
        
        {/* Sidebar Footer */}
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
      {/* 🔥 FIX: Wider on mobile. Changed p-2 to p-0 */}
      <main className="flex-1 flex flex-col p-0 sm:p-4 md:p-6 bg-white overflow-hidden">
        <Card className="w-full h-full flex flex-col shadow-sm sm:shadow-lg bg-white border-slate-200 rounded-lg sm:rounded-xl">
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
              </div>
              <div className="w-10 lg:hidden"></div>
            </div>
          </CardHeader>
          
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
                        fallback.className = 'logo-fallback w-full h-full bg-blue-900 rounded-lg flex items-center justify-center text-white text-4xl font-bold';
                        fallback.textContent = 'JCIL';
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                </div>
                {/* 🔥 NEW: Added Slingshot 2.0 text */}
                <h2 className="text-lg sm:text-xl font-semibold text-blue-900 text-center">
                  slingshot 2.0
                </h2>
                <p className="text-slate-700 text-base sm:text-lg md:text-xl font-medium text-center px-4">
                  {getTimeBasedGreeting()}
                </p>
              </div>
            ) : ( 
              messages.map((msg: Message) => ( 
                <div key={msg.id} className={`flex items-start space-x-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}> 
                  
                  {/* 🔥 REMOVED: AI Avatar block was here */}
                  
                  {/* 🔥 UPDATED: AI message bubble is now wider */}
                  <div className={`flex flex-col ${msg.role === 'user' ? 'items-end max-w-[85%] sm:max-w-md' : 'items-start max-w-[95%] sm:max-w-2xl'}`}>
                    {msg.role === 'user' ? (
                      <div className="bg-blue-900 text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl whitespace-pre-wrap text-sm leading-relaxed shadow-sm">
                        {msg.content}
                      </div>
                    ) : (
                      // 🔥 UPDATED: Added whitespace-pre-wrap for AI text alignment
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
          
          <form onSubmit={handleFormSubmit} className="px-3 sm:px-6 md:px-8 py-3 sm:py-4 md:py-5 border-t border-slate-200 bg-white rounded-b-lg sm:rounded-b-xl">
            
            {/* 🔥 UPDATED: Professional file indicator */}
            {attachedFileName && (
              <div className="mb-2 sm:mb-3 flex items-center justify-between rounded-lg sm:rounded-xl border border-blue-200 bg-blue-50 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm shadow-sm">
                <div className="flex items-center gap-2 truncate">
                  <FileIcon className="h-4 w-4 flex-shrink-0 text-blue-600" strokeWidth={2} />
                  <span className="truncate text-blue-800 font-medium" title={attachedFileName}>
                    Attached: {attachedFileName}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 sm:h-7 sm:w-7 flex-shrink-0 rounded-full hover:bg-blue-100 transition-all"
                  onClick={removeAttachedFile}
                  disabled={isLoading}
                >
                  <XIcon className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" strokeWidth={2} />
                </Button>
              </div>
            )}

            <div className="flex items-center space-x-2"> 
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
                  {/* 🔥 REMOVED: Emojis */}
                  <DropdownMenuItem 
                    onSelect={() => cameraInputRef.current?.click()} 
                    className="text-slate-700 text-sm cursor-pointer"
                  >
                    Take Photo
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onSelect={() => fileInputRef.current?.click()} 
                    className="text-slate-700 text-sm cursor.pointer"
                  >
                    Choose File
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
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

              <div className="flex-1 relative flex items-center border border-slate-300 rounded-xl bg-white focus-within:border-blue-900 transition-all">
                {/* 🔥 FIXED: Font color fix. Added !text-slate-900 */}
                <Textarea
                   ref={inputRef} 
                   value={localInput}
                   onChange={handleTextareaChange}
                   placeholder={getPlaceholderText()} 
                   disabled={isLoading || isTranscribing}
                   autoComplete="off"
                   autoCorrect="off"
                   autoCapitalize="sentences"
                   spellCheck="true"
                   inputMode="text"
                   className="flex-1 resize-none min-h-[40px] sm:min-h-[44px] max-h-[120px] sm:max-h-[150px] text-xs sm:text-sm leading-relaxed overflow-y-auto bg-transparent !border-0 !ring-0 !outline-none focus:!ring-0 focus:!outline-none focus-visible:!ring-0 focus-visible:!outline-none shadow-none px-3 sm:px-4 py-2.5 sm:py-3 !text-slate-900 dark:text-slate-200" 
                   rows={1} 
                   onKeyDown={handleTextareaKeyDown}
                   style={{ border: 'none', boxShadow: 'none', outline: 'none' }}
                 />
                
                <Button 
                  type="button" 
                  variant="ghost"
                  size="icon" 
                  disabled={isLoading || isTranscribing} 
                  onClick={handleMicClick} 
                  className={`flex flex-shrink-0 transition-all rounded-lg h-8 w-8 mr-1 ${
                    isRecording 
                      ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' 
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                  title={isRecording ? "Stop recording" : "Start recording"}
                >
                  {isTranscribing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mic className="h-4 w-4" strokeWidth={2} />
                  )}
                </Button>
                
                {/* 🔥 BUILD FIX: This line is now correct */}
                <Button
                   type="submit"
                   disabled={isLoading || isTranscribing || (!localInput.trim() && !attachedFileName)}
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