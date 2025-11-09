'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useRef, useCallback } from 'react';
import { type User as SupabaseUser } from '@supabase/supabase-js';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

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
import UpgradeModal from '@/components/UpgradeModal';
import ToolCarousel from '@/components/ToolCarousel';

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
  Zap,
  Moon,
  CheckCircle,
  Settings,
  Shield,
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
  images?: Array<{
    data: string;
    mediaType: string;
    fileName: string;
  }>;
}

interface Conversation {
  id: string;
  created_at: string;
  title?: string | null;
  user_id?: string;
}

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB per file (fits most photos/screenshots)
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// Christian-themed loading messages for theological/chat queries
const THEOLOGICAL_LOADING_MESSAGES = [
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

// Practical loading messages for searches, trends, news, etc.
const PRACTICAL_LOADING_MESSAGES = [
  "Analyzing your question...",
  "Processing information...",
  "Structuring research...",
  "Locating relevant data...",
  "Filtering results...",
  "Compiling findings...",
  "Synthesizing information...",
  "Organizing insights...",
  "Cross-referencing sources...",
  "Applying biblical wisdom...",
  "Filtering through Christian principles...",
];

// Sassy loading messages for liberal/woke queries 😏
const WOKE_DETECTION_MESSAGES = [
  "Detecting wokeness...",
  "Restructuring the woke agenda...",
  "Reshaping the liberal perspective...",
  "Applying common sense...",
  "Fact-checking mainstream narratives...",
  "Filtering out cultural Marxism...",
  "Translating from woke to truth...",
  "Rejecting identity politics...",
  "Deploying biblical reality check...",
  "Bypassing leftist programming...",
];

// Lazy student detection 📚
const LAZY_STUDENT_MESSAGES = [
  "Detecting academic shortcuts...",
  "Encouraging genuine learning...",
  "Redirecting to study materials...",
  "Promoting intellectual growth...",
  "Discouraging plagiarism...",
  "Building character through effort...",
  "Teaching the value of hard work...",
  "Guiding towards honest achievement...",
];

// Veteran detection 🇺🇸
const VETERAN_MESSAGES = [
  "Honoring your service...",
  "Thank you for your sacrifice...",
  "Respecting those who served...",
  "Grateful for your dedication...",
  "Serving those who served...",
  "Recognizing military service...",
  "Appreciating American heroes...",
];

// Business professional detection 💼
const BUSINESS_MESSAGES = [
  "Analyzing business strategy...",
  "Processing professional inquiry...",
  "Structuring business insights...",
  "Optimizing strategic approach...",
  "Deploying market intelligence...",
  "Synthesizing business data...",
];

// Parent/Homeschool detection 👨‍👩‍👧‍👦
const PARENT_MESSAGES = [
  "Supporting family education...",
  "Assisting homeschool curriculum...",
  "Providing biblical guidance for families...",
  "Strengthening Christian parenting...",
  "Building godly family foundations...",
];

// Dark/Occult detection ⚠️🛡️
const DARK_ENTITY_MESSAGES = [
  "⚠️ Detecting dark entities...",
  "⚠️ Detecting malicious intent...",
  "⚠️ Identifying occult content...",
  "⚠️ Spiritual protection activated...",
  "⚠️ Rejecting demonic influence...",
  "⚠️ Deploying biblical authority...",
];

// Business Owners/Creators 🚀
const CREATOR_MESSAGES = [
  "Supporting your vision...",
  "Empowering your business journey...",
  "Gathering insights efficiently...",
  "Optimizing for your success...",
  "Building your dream...",
  "Reviewing for accurate guidance...",
  "Accelerating your goals...",
];

// Emotional Distress/Struggling 💙✝️
const DISTRESS_MESSAGES = [
  "User is experiencing hardship...",
  "Jesus loves you very much...",
  "You have a beautiful future...",
  "Providing compassionate support...",
  "God sees your struggle...",
  "Hope is on the horizon...",
  "You are not alone...",
  "Strength is being prepared...",
];

// Hacker/Malicious Attempt Detection 🚨⚠️
const HACKER_MESSAGES = [
  "🚨 Detecting hacking attempt...",
  "🚨 SQL injection detected...",
  "🚨 Cross-site scripting blocked...",
  "⚠️ Do not pass GO. Do not collect $200.",
  "🛑 Silicon Valley shenanigans detected...",
  "⚠️ Nice try, script kiddie...",
  "🚫 Malicious activity identified...",
  "🚨 Unauthorized access attempt...",
  "⛔ Error 403: Protected by Higher Authority...",
  "🚨 Security threat neutralized...",
];

const TypingIndicator = ({
  isPractical = false,
  isWoke = false,
  isLazyStudent = false,
  isVeteran = false,
  isBusiness = false,
  isParent = false,
  isDarkEntity = false,
  isCreator = false,
  isDistress = false,
  isHacker = false
}: {
  isPractical?: boolean;
  isWoke?: boolean;
  isLazyStudent?: boolean;
  isVeteran?: boolean;
  isBusiness?: boolean;
  isParent?: boolean;
  isDarkEntity?: boolean;
  isCreator?: boolean;
  isDistress?: boolean;
  isHacker?: boolean;
}) => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    let messages = THEOLOGICAL_LOADING_MESSAGES;

    // Priority order for special detection
    if (isHacker) {
      messages = HACKER_MESSAGES; // ABSOLUTE HIGHEST - Block hackers immediately! 🚨
    } else if (isDarkEntity) {
      messages = DARK_ENTITY_MESSAGES; // Block evil immediately!
    } else if (isDistress) {
      messages = DISTRESS_MESSAGES; // Compassion for struggling souls
    } else if (isVeteran) {
      messages = VETERAN_MESSAGES; // Honor our veterans
    } else if (isCreator) {
      messages = CREATOR_MESSAGES; // Support business owners
    } else if (isLazyStudent) {
      messages = LAZY_STUDENT_MESSAGES; // Catch cheaters
    } else if (isWoke) {
      messages = WOKE_DETECTION_MESSAGES; // Time for sass
    } else if (isParent) {
      messages = PARENT_MESSAGES; // Support families
    } else if (isBusiness) {
      messages = BUSINESS_MESSAGES; // Professional mode
    } else if (isPractical) {
      messages = PRACTICAL_LOADING_MESSAGES;
    }

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [isPractical, isWoke, isLazyStudent, isVeteran, isBusiness, isParent, isDarkEntity, isCreator, isDistress, isHacker]);

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
            {isHacker
              ? HACKER_MESSAGES[messageIndex]
              : isDarkEntity
                ? DARK_ENTITY_MESSAGES[messageIndex]
                : isDistress
                  ? DISTRESS_MESSAGES[messageIndex]
                  : isVeteran
                    ? VETERAN_MESSAGES[messageIndex]
                    : isCreator
                      ? CREATOR_MESSAGES[messageIndex]
                      : isLazyStudent
                        ? LAZY_STUDENT_MESSAGES[messageIndex]
                        : isWoke
                          ? WOKE_DETECTION_MESSAGES[messageIndex]
                          : isParent
                            ? PARENT_MESSAGES[messageIndex]
                            : isBusiness
                              ? BUSINESS_MESSAGES[messageIndex]
                              : isPractical
                                ? PRACTICAL_LOADING_MESSAGES[messageIndex]
                                : THEOLOGICAL_LOADING_MESSAGES[messageIndex]
            }
          </span>
        </div>
      </div>
    </div>
  );
};

// Business List Component - renders with clickable phone/website
const BusinessList = ({ businesses }: { businesses: any[] }) => {
  return (
    <div className="space-y-3">
      <p className="text-slate-700 font-semibold mb-4">Here are the closest places I found:</p>
      {businesses.map((b: any, i: number) => (
        <div key={i} className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="font-bold text-slate-900 text-base mb-1">{b.name}</div>
          {b.address && <div className="text-sm text-slate-600 mb-2">{b.address}</div>}

          <div className="flex flex-wrap gap-2 mb-2">
            {b.phone && (
              <button
                onClick={() => {
                  const phoneDigits = b.phone.replace(/\D/g, '');
                  window.location.href = `tel:${phoneDigits}`;
                }}
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all"
              >
                📞 {b.phone}
              </button>
            )}
            {b.website && (
              <button
                onClick={() => window.open(b.website, '_blank')}
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all"
              >
                🌐 Visit Website
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-slate-600">
            {b.rating && (
              <span className="inline-flex items-center gap-1">
                ⭐ <span className="font-semibold text-slate-900">{b.rating}</span>/5 <span className="text-slate-500">({b.total_ratings || 0})</span>
              </span>
            )}
            {b.open_now !== null && (
              <span className={`inline-flex items-center gap-1 font-medium ${b.open_now ? 'text-green-600' : 'text-red-600'}`}>
                {b.open_now ? '🟢 Open now' : '🔴 Closed'}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const supabase = createClient();

export default function Home() {
  const router = useRouter();

  // auth
  const [user, setUser] = useState<SupabaseUser | null>(null);

  // subscription & usage
  const [subscriptionTier, setSubscriptionTier] = useState('free');
  const [dailyLimit, setDailyLimit] = useState(10);
  const [usageToday, setUsageToday] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  // dim mode (subtle grey filter)
  const [dimMode, setDimMode] = useState(false);

  // chat
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [localInput, setLocalInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isPracticalQuery, setIsPracticalQuery] = useState(false);
  const [isWokeQuery, setIsWokeQuery] = useState(false);
  const [isLazyStudentQuery, setIsLazyStudentQuery] = useState(false);
  const [isVeteranQuery, setIsVeteranQuery] = useState(false);
  const [isBusinessQuery, setIsBusinessQuery] = useState(false);
  const [isParentQuery, setIsParentQuery] = useState(false);
  const [isDarkEntityQuery, setIsDarkEntityQuery] = useState(false);
  const [isCreatorQuery, setIsCreatorQuery] = useState(false);
  const [isDistressQuery, setIsDistressQuery] = useState(false);
  const [isHackerQuery, setIsHackerQuery] = useState(false);

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
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [lastSentFiles, setLastSentFiles] = useState<File[]>([]); // Keep last sent images for follow-ups
  const MAX_FILES = 1;
  const MAX_TOTAL_SIZE = 4 * 1024 * 1024; // 4MB for single file

  // ============================================
  // MIC RECORDING - REBUILT FROM SCRATCH
  // ============================================
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);


  // ui refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [fileButtonFlash, setFileButtonFlash] = useState(false);
  const [toolButtonFlash, setToolButtonFlash] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Token usage tracking
  const [tokensUsedToday, setTokensUsedToday] = useState(0);

  // Upgrade Modal State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalData, setUpgradeModalData] = useState<any>(null);

  const scrollToBottom = () => {
    // Use instant scroll (not smooth) for better UX during streaming
    // Smooth scrolling lags behind during rapid message updates
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  };

  const clearAttachmentState = () => {
    setUploadedFiles([]);
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
    if (isLoading) return 'AI is thinking...';
    if (uploadedFiles.length > 0) return 'Describe the files or add text...';
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

        // Fetch subscription info
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('subscription_tier, daily_message_limit, is_admin')
          .eq('id', currentUser.id)
          .single();

        if (profile) {
          setSubscriptionTier(profile.subscription_tier || 'free');
          setDailyLimit(profile.daily_message_limit || 10);
          setIsAdmin(profile.is_admin || false);
        }

        // Fetch today's usage
        const { data: usageData, error: usageError } = await supabase
          .from('daily_usage')
          .select('message_count, token_count')
          .eq('user_id', currentUser.id)
          .eq('usage_date', new Date().toISOString().split('T')[0])
          .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 rows

        if (usageError) {
          console.error('Error fetching daily usage:', usageError);
          setUsageToday(0); // Default to 0 if error
          setTokensUsedToday(0);
        } else if (usageData) {
          setUsageToday(usageData.message_count || 0);
          setTokensUsedToday(usageData.token_count || 0);
        } else {
          setUsageToday(0); // No usage record for today yet
          setTokensUsedToday(0);
        }
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

  // Load dim mode preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dimMode');
    if (saved === 'true') setDimMode(true);
  }, []);

  // Save dim mode preference to localStorage
  useEffect(() => {
    localStorage.setItem('dimMode', String(dimMode));
  }, [dimMode]);

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

    if (isRecording) recorderRef.current?.stop();
    setIsRecording(false);
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
      // ✅ FIX: Load images from message_images table
      const messageIds = (data ?? []).map(m => m.id);
      let imagesMap: Record<string, Array<{ data: string; mediaType: string; fileName: string }>> = {};

      if (messageIds.length > 0) {
        const { data: imagesData, error: imagesError } = await supabase
          .from('message_images')
          .select('message_id, image_data, media_type, file_name')
          .in('message_id', messageIds);

        if (!imagesError && imagesData) {
          // Group images by message_id
          imagesData.forEach((img) => {
            if (!imagesMap[img.message_id]) {
              imagesMap[img.message_id] = [];
            }
            imagesMap[img.message_id].push({
              data: img.image_data,
              mediaType: img.media_type,
              fileName: img.file_name
            });
          });
        } else if (imagesError) {
          console.error('Error loading images:', imagesError);
        }
      }

      // Map messages WITH images
      const loaded: Message[] = (data ?? []).map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        created_at: m.created_at,
        images: imagesMap[m.id] // Attach images if they exist
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
    setLastSentFiles([]); // Clear image context for new chat
    setActiveTool('none');
    if (isRecording) recorderRef.current?.stop();
    setIsRecording(false);
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
    let newFiles = Array.from(event.target.files || []);

    if (newFiles.length === 0 || !user) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Calculate how many more files we can add
    const availableSlots = MAX_FILES - uploadedFiles.length;

    if (availableSlots <= 0) {
      alert(`You already have ${MAX_FILES} files. Please remove some before adding more.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // If user selected more than available slots, only take what we can
    if (newFiles.length > availableSlots) {
      alert(`You can only add ${availableSlots} more file${availableSlots === 1 ? '' : 's'}. Only the first ${availableSlots} will be added.`);
      newFiles = newFiles.slice(0, availableSlots);
    }

    // Validate each file
    for (const file of newFiles) {
      if (!ALLOWED_FILE_TYPES.includes(file.type.toLowerCase())) {
        alert(`Sorry, "${file.name}" has an invalid file type. Allowed types: ${ALLOWED_FILE_EXTENSIONS.join(', ')}`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        const maxMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
        alert(`Sorry, "${file.name}" is too large. The maximum file size is ${maxMB}MB.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    // Check total size
    const currentTotalSize = uploadedFiles.reduce((sum, f) => sum + f.size, 0);
    const newTotalSize = newFiles.reduce((sum, f) => sum + f.size, 0);
    if (currentTotalSize + newTotalSize > MAX_TOTAL_SIZE) {
      const maxMB = (MAX_TOTAL_SIZE / (1024 * 1024)).toFixed(1);
      alert(`Sorry, the total size of all files would exceed ${maxMB}MB. Please upload fewer or smaller files.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // All validations passed, add the files
    setUploadedFiles(prev => [...prev, ...newFiles]);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachedFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // --------- AUDIO VALIDATION & TRANSCRIPTION ----------
  // ============================================
  // MIC HANDLER - ULTRA SIMPLE, MOBILE FIRST
  // ============================================
  const handleMic = async () => {
    if (isRecording) {
      // Stop recording
      recorderRef.current?.stop();
      return;
    }

    try {
      // Start recording
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });

        // Determine filename from mime type
        let filename = 'audio.webm';
        if (recorder.mimeType.includes('mp4')) filename = 'audio.m4a';
        else if (recorder.mimeType.includes('ogg')) filename = 'audio.ogg';

        // Send to transcription
        const formData = new FormData();
        formData.append('file', blob, filename);

        try {
          const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
          const data = await res.json();

          if (data.text) {
            setLocalInput(data.text.trim());
            inputRef.current?.focus();
          } else {
            alert('No speech detected');
          }
        } catch (err) {
          alert('Transcription failed');
        }

        stream.getTracks().forEach(t => t.stop());
        setIsRecording(false);
      };

      setIsRecording(true);
      recorder.start();
    } catch (err) {
      alert('Microphone access denied');
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
    if (isLoading || isRecording) return;

    // must be signed in to write rows under RLS
    if (!user) {
      alert('Please sign in to chat.');
      return;
    }

    const textInput = localInput.trim();
    const hasFiles = uploadedFiles.length > 0;
    const hasText = textInput.length > 0;

    // Auto-include last sent images for follow-up questions
    const filesToSend = hasFiles ? uploadedFiles : (hasText ? lastSentFiles : []);
    const actuallyHasFiles = filesToSend.length > 0;

    if (!hasText && !actuallyHasFiles) return;
    if (isRecording) recorderRef.current?.stop();

    setIsLoading(true);
    setIsTyping(true); // Show typing indicator while AI responds

    // CRITICAL FIX: Wrap entire async flow in try-finally to prevent stuck loading state
    try {
      const userMsgText = textInput;

      // ✅ FIX: Prevent race condition - set conversation ID immediately
      let currentConvoId = conversationId;
      if (!currentConvoId) {
        // Generate and set ID BEFORE database insert to prevent race conditions
        const tempConvoId = crypto.randomUUID();
        setConversationId(tempConvoId); // Set immediately to prevent duplicate creation
        currentConvoId = tempConvoId;

        const title = userMsgText.substring(0, 40) + '...';
        const { data: newConvo, error: convError } = await supabase
          .from('conversations')
          .insert({
            id: tempConvoId, // Use pre-generated ID
            user_id: user.id,
            title
          })
          .select('id, created_at, title, user_id')
          .single();

        if (convError) {
          console.error('conversation insert error:', convError);
          alert('Failed to start a conversation.');
          setConversationId(null); // Reset on error
          return;
        }
        setConversations((prev) => [newConvo, ...prev]);
      }

    // locally display user message (without images to avoid stack overflow)
    const newUserMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      role: 'user',
      content: userMsgText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newUserMessage]);
    setLocalInput('');

    // Save uploaded files for follow-up questions, then clear
    if (hasFiles) {
      setLastSentFiles(uploadedFiles);
    }
    clearAttachmentState();

    // ============================================
    // 🎯 INTELLIGENT INTENT DETECTION
    // ============================================
    // Detect if user wants web search or fact-checking
    const lowerText = textInput.toLowerCase();

    // Web Search Intent Patterns (for Brave Search API)
    const searchPatterns = [
      /\b(search|google|look up|find|show me|tell me about)\b/i,
      /\b(what'?s|whats)\s+(happening|going on|new|breaking|the latest)\b/i,
      /\b(breaking news|latest news|news today|current events|today'?s news)\b/i,
      /\b(nearest|closest|best|top rated|around me|near me|nearby)\b/i, // location-based
      /\b(who is|what is|where is|when did|how did)\b.*\b(now|today|currently|recently|latest|2025)\b/i,
      /\b(news about|updates on|information on|status of)\b/i,
      /\b(restaurant|barber|barbershop|shop|store|hotel|cafe|coffee|gym|salon|spa|dentist|doctor|hospital|pharmacy|gas station|bank|atm|pizza|food|nail|nails|hair|massage)\b/i, // local business keywords
      /(closest|nearest|near me|around me|nearby|close by)\s+(restaurant|barber|barbershop|shop|store|hotel|cafe|gym|salon|spa|dentist|doctor|pizza|food|nail|nails|hair)/i, // closest + business
      /(restaurant|barber|barbershop|shop|store|hotel|cafe|gym|salon|spa|dentist|doctor|pizza|food|nail|nails|hair)\s+(near|nearby|around|close to|closest to|nearest to|in)\s+(me|here)/i, // business + near me
      /\b(places?|businesses?|spots?)\s+(in|near|around)\b/i // "places in marblehead"
    ];

    // Fact-Check Intent Patterns (for Perplexity API)
    const factCheckPatterns = [
      /\b(fact.?check|verify|is (it|this) true|check if|validate|confirm)\b/i,
      /\b(true or false|real or fake|debunk|hoax|myth)\b/i,
      /\b(did .+ really|is it accurate|is that correct)\b/i,
      /\b(prove|disprove|evidence for|evidence against)\b/i
    ];

    // Air Quality / Pollen Intent Patterns (Google Air Quality API)
    const airQualityPatterns = [
      /\b(air quality|air pollution|aqi|pollution level|smog)\b/i,
      /\b(pollen|pollen count|allergy|allergies|hay fever)\b/i,
      /\b(is (the )?air (safe|clean|good|bad|unhealthy))\b/i,
      /\b(should i wear a mask|safe to go outside)\b/i
    ];

    // Directions / Navigation Intent Patterns (Google Directions API)
    const directionsPatterns = [
      /\b(directions? to|how (do i|to) get to|route to|navigate to|drive to|walk to)\b/i,
      /\b(show me the way|take me to|guide me to)\b/i,
      /\b(how far is|distance to|how long (does it take|will it take) to get to)\b/i
    ];

    // Time Zone Intent Patterns (Google Time Zone API)
    const timezonePatterns = [
      /\b(what time is it in|time in|current time in)\b/i,
      /\b(time ?zone|timezone)\b/i,
      /\b(what('?s| is) the time (in|at))\b/i
    ];

    // Theological / Biblical Intent Patterns (for biblical loading messages)
    const theologicalPatterns = [
      /\b(bible|scripture|biblical|gospel|jesus|christ|god|lord|holy spirit|salvation)\b/i,
      /\b(prayer|pray|worship|faith|believe|christian|christianity)\b/i,
      /\b(sin|repent|forgive|forgiveness|grace|mercy|redemption)\b/i,
      /\b(heaven|hell|eternal|afterlife|resurrection)\b/i,
      /\b(theology|doctrine|covenant|testament|prophet|apostle)\b/i,
      /\b(what does (the )?bible say|according to scripture|biblically)\b/i,
      /\b(spiritual|soul|spirit|divine|sacred|holy)\b/i,
      /\b(sermon|preach|pastor|church|ministry)\b/i,
    ];

    // Woke/Liberal Detection Patterns (for sassy loading messages) 😏
    const wokePatterns = [
      /\b(white privilege|systemic racism|microaggression|safe space|trigger warning)\b/i,
      /\b(gender (identity|fluid|spectrum)|non-?binary|pronouns|ze\/zir|they\/them as singular)\b/i,
      /\b(toxic masculinity|patriarchy|heteronormative|cisgender|cis)\b/i,
      /\b(cultural appropriation|latinx|folx|bipoc)\b/i,
      /\b(defund (the )?police|acab|1312)\b/i,
      /\b(democratic socialism|social justice warrior|sjw|woke|cancel culture)\b/i,
      /\b(equity (not equality)|diversity training|unconscious bias)\b/i,
      /\b(reproductive rights|abortion is healthcare|my body my choice)\b/i,
      /\b(climate emergency|climate crisis|green new deal)\b/i,
      /\b(open borders|sanctuary cit(y|ies)|undocumented immigrants)\b/i,
    ];

    // Lazy Student Detection 📚
    const lazyStudentPatterns = [
      /\b(write (my|an) (essay|paper|report|assignment|homework) (for me|about))\b/i,
      /\b(do my homework|complete this assignment|finish (my|this) (essay|paper))\b/i,
      /\b(give me (the )?answer(s)? to|tell me the answer)\b/i,
      /\b(summarize (this|the) (book|chapter|article) (for me)?)\b/i,
      /\b(i (need|want) (you to )?(write|do|complete|finish))\b/i,
      /\b(can you (just )?(write|do|make|create) (this|my|an))\b/i,
      /due tomorrow|due (in|by) (an hour|2 hours|tonight)/i,
      /\b(quick(ly)?|fast|asap|urgent(ly)?|need (it )?now)\b.*\b(essay|paper|homework|assignment)\b/i,
    ];

    // Veteran Detection 🇺🇸
    const veteranPatterns = [
      /\b(i (am|was) (a |an )?(veteran|vet|soldier|marine|sailor|airman|service ?member))\b/i,
      /\b(i served (in|with) (the )?(army|navy|air force|marines|military|national guard))\b/i,
      /\b(deployed|deployment|combat|tour of duty|active duty|military service)\b/i,
      /\b(va (benefits|hospital|healthcare|claim)|veterans? affairs)\b/i,
      /\b(ptsd|tbi|service.?connected|dd.?214|gi bill)\b/i,
    ];

    // Business Professional Detection 💼
    const businessPatterns = [
      /\b(business (strategy|plan|model|proposal|analysis))\b/i,
      /\b(market (analysis|research|strategy|penetration|share))\b/i,
      /\b(roi|kpi|metrics|revenue|profit|quarterly|fiscal)\b/i,
      /\b(stakeholder|shareholder|investor|board meeting)\b/i,
      /\b(enterprise|corporate|c.?suite|executive|ceo|cfo)\b/i,
      /\b(swot analysis|competitive advantage|value proposition)\b/i,
    ];

    // Parent/Homeschool Detection 👨‍👩‍👧‍👦
    const parentPatterns = [
      /\b(homeschool|home.?school|home education)\b/i,
      /\b(teaching (my|our) (kids?|children|son|daughter))\b/i,
      /\b(christian curriculum|biblical worldview|faith.?based education)\b/i,
      /\b((my|our) (child|son|daughter|kids?) (is|are) learning)\b/i,
      /\b(family devotion|parenting|raising (godly )?children)\b/i,
    ];

    // Dark/Occult Detection ⚠️🛡️
    const darkEntityPatterns = [
      /\b(satan|satanic|lucifer|demon|demonic|devil|hell|hail satan)\b/i,
      /\b(witchcraft|witch|warlock|sorcery|black magic|dark magic|occult)\b/i,
      /\b(curse|hex|spell|ritual|seance|ouija|pentagram|666)\b/i,
      /\b(summoning|conjure|invoke (a |the )?(demon|spirit|entity))\b/i,
      /\b(blood sacrifice|dark ritual|pagan ritual)\b/i,
      /\b(tarot|divination|fortune telling|crystal ball)\b/i,
      /\b(illuminati|new world order|antichrist)\b/i,
    ];

    // Creator/Business Owner Detection 🚀
    const creatorPatterns = [
      /\b(my (business|startup|company|brand|channel|podcast))\b/i,
      /\b(i('?m| am) (starting|launching|building|creating) (a |an |my))\b/i,
      /\b((small business|side hustle|entrepreneur|founder|creator))\b/i,
      /\b(growing my (audience|following|business|brand))\b/i,
      /\b(youtube channel|content creator|influencer)\b/i,
      /\b(monetize|marketing strategy|customer acquisition)\b/i,
    ];

    // Emotional Distress Detection 💙✝️
    const distressPatterns = [
      /\b(i('?m| am) (depressed|sad|lonely|hopeless|lost|broken|hurting))\b/i,
      /\b(i (want to|wanna) (die|end it all|give up))\b/i,
      /\b(no (one|body) (cares|loves me|understands))\b/i,
      /\b(i (can't|cannot) (go on|do this|take it anymore))\b/i,
      /\b(life (is|feels) (meaningless|empty|pointless|hopeless))\b/i,
      /\b(struggling with (depression|anxiety|grief|loss|pain))\b/i,
      /\b(suicidal|self.?harm|cutting myself)\b/i,
      /\b(i need help|please help me|desperate)\b/i,
    ];

    // Hacker/SQL Injection/XSS Detection 🚨🛑
    const hackerPatterns = [
      /\b(sql.?(injection|inject)|union.?select|drop.?table|delete.?from)\b/i,
      /(<script|javascript:|onerror=|onload=|<iframe|eval\(|\.innerHTML)/i,
      /\b(\.\.\/|\.\.\\|\/etc\/passwd|cmd\.exe|powershell)\b/i,
      /(\|\||&&|;|\`|base64|exec\(|system\()/,
      /\b(hack|exploit|vulnerability|backdoor|shell|payload)\b/i,
      /(select.*from|insert.*into|update.*set|delete.*where)/i,
      /(<img.*onerror|<svg.*onload)/i,
      /\b(cookie.?theft|session.?hijack|csrf|xss|xxe)\b/i,
    ];

    const isSearchIntent = searchPatterns.some(pattern => pattern.test(lowerText));
    const isFactCheckIntent = !isSearchIntent && factCheckPatterns.some(pattern => pattern.test(lowerText));
    const isAirQualityIntent = !isSearchIntent && !isFactCheckIntent && airQualityPatterns.some(pattern => pattern.test(lowerText));
    const isDirectionsIntent = !isSearchIntent && !isFactCheckIntent && !isAirQualityIntent && directionsPatterns.some(pattern => pattern.test(lowerText));
    const isTimezoneIntent = !isSearchIntent && !isFactCheckIntent && !isAirQualityIntent && !isDirectionsIntent && timezonePatterns.some(pattern => pattern.test(lowerText));
    const isTheologicalIntent = theologicalPatterns.some(pattern => pattern.test(lowerText));
    const isWokeIntent = wokePatterns.some(pattern => pattern.test(lowerText));
    const isLazyStudentIntent = lazyStudentPatterns.some(pattern => pattern.test(lowerText));
    const isVeteranIntent = veteranPatterns.some(pattern => pattern.test(lowerText));
    const isBusinessIntent = businessPatterns.some(pattern => pattern.test(lowerText));
    const isParentIntent = parentPatterns.some(pattern => pattern.test(lowerText));
    const isDarkEntityIntent = darkEntityPatterns.some(pattern => pattern.test(lowerText));
    const isCreatorIntent = creatorPatterns.some(pattern => pattern.test(lowerText));
    const isDistressIntent = distressPatterns.some(pattern => pattern.test(lowerText));
    const isHackerIntent = hackerPatterns.some(pattern => pattern.test(lowerText));

    // Priority: Hacker (BLOCK!) > DarkEntity (BLOCK!) > Distress > Veteran > LazyStudent > Woke > Parent > Creator > Business > Theological > Practical
    // Reset all flags first
    setIsPracticalQuery(false);
    setIsWokeQuery(false);
    setIsLazyStudentQuery(false);
    setIsVeteranQuery(false);
    setIsBusinessQuery(false);
    setIsParentQuery(false);
    setIsDarkEntityQuery(false);
    setIsCreatorQuery(false);
    setIsDistressQuery(false);
    setIsHackerQuery(false);

    if (isHackerIntent) {
      // HIGHEST PRIORITY - Block hackers immediately! 🚨🛑
      setIsHackerQuery(true);
    } else if (isDarkEntityIntent) {
      // Block evil entities! ⚠️✝️
      setIsDarkEntityQuery(true);
    } else if (isDistressIntent) {
      // Compassion for struggling souls 💙
      setIsDistressQuery(true);
    } else if (isVeteranIntent) {
      // Respect our vets! 🇺🇸
      setIsVeteranQuery(true);
    } else if (isLazyStudentIntent) {
      // Catch cheaters early 📚
      setIsLazyStudentQuery(true);
    } else if (isWokeIntent) {
      // Time for sass 😏
      setIsWokeQuery(true);
    } else if (isParentIntent) {
      // Support Christian families 👨‍👩‍👧‍👦
      setIsParentQuery(true);
    } else if (isCreatorIntent) {
      // Empower entrepreneurs 🚀
      setIsCreatorQuery(true);
    } else if (isBusinessIntent) {
      // Professional mode 💼
      setIsBusinessQuery(true);
    } else if (isTheologicalIntent) {
      // Biblical messages ✝️
      // Keep all false, will use theological by default
    } else {
      // Everything else is practical
      setIsPracticalQuery(true);
    }

    // persist user message with user_id
    const { error: insertUserErr } = await supabase.from('messages').insert({
      user_id: user.id,                    // ✅ include user_id
      conversation_id: currentConvoId,
      role: 'user',
      content: userMsgText,
    });

    if (insertUserErr) {
      console.error('insert user message error:', insertUserErr);
      setMessages((prev) => [
        ...prev,
        { id: `err_${Date.now()}`, role: 'assistant', content: 'Error saving your message.' },
      ]);
      return;
    }

    let assistantText = '';

    // ✅ FIX: Build conversation history WITH images (exclude the just-added user message)
    const conversationHistory = messages.slice(0, -1).map(m => {
      const historyItem: any = {
        role: m.role,
        content: m.content
      };
      // Include images if they exist
      if (m.images && m.images.length > 0) {
        historyItem.images = m.images;
      }
      return historyItem;
    });

      // ============================================
      // 🌐 ROUTE 1: WEB SEARCH (Brave + Claude)
      // ============================================
      if (isSearchIntent && hasText) {
        console.log('🔍 Detected search intent, routing to Brave Search API...');

        // Detect if this is a location-based query (check first!)
        const locationPatterns = [
          /\b(nearest|closest|best|near me|around me|nearby|close by)\b/i,
          /\b(restaurants?|barber|barbershops?|shops?|stores?|hotels?|places?|businesses?|spots?|salons?|spas?|dentists?|doctors?|cafes?|gyms?|nail|nails|hair|pizza|food)\s+(near|nearby|around|in|close to)\b/i,
          /\b(where|find|show me|looking for)\s+(restaurants?|barber|shops?|stores?|places?|salons?|nail|nails|pizza)\b/i,
          /\b(pizza|food|coffee|cafe|barber|salon|nail|nails|hair|gym|dentist|doctor|pharmacy|gas|bank|atm|hotel|restaurant)\s+(places?|shops?|stores?|in|near|around)\b/i
        ];
        const isLocationQuery = locationPatterns.some(pattern => pattern.test(lowerText));

        console.log('🔍 Search query:', textInput);
        console.log('🎯 Location query detected:', isLocationQuery);

        // Check if user explicitly mentioned a city/location (skip geolocation if so)
        const hasCityMention = /\b(in|near|around)\s+[A-Z][a-z]+/i.test(textInput);
        console.log('🏙️ City mentioned in query:', hasCityMention);

        // Add temp message for web searches (non-location)
        if (!isLocationQuery) {
          const searchMsg: Message = {
            id: `temp-search-${Date.now()}`,
            role: 'assistant',
            content: '🔍 Checking news sources and verifying information...',
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, searchMsg]);
        }

        // Get user's location if it's a location query (with permission)
        let userLocation = null;
        if (isLocationQuery && !hasCityMention && typeof navigator !== 'undefined' && navigator.geolocation) {
          try {
            // Show temporary message while getting location
            const tempMsg: Message = {
              id: `temp-location-${Date.now()}`,
              role: 'assistant',
              content: '📍 Requesting your location for nearby results...',
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, tempMsg]);

            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                  timeout: 10000,
                  enableHighAccuracy: true,
                  maximumAge: 0
                }
              );
            });

            userLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            };
            console.log('📍 Location detected:', userLocation);

            // Reverse geocode to get city name
            try {
              const geocodeResponse = await fetch(
                `https://nominatim.openstreetmap.org/reverse?` +
                `lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json`
              );
              const geocodeData = await geocodeResponse.json();
              const city = geocodeData.address?.city ||
                          geocodeData.address?.town ||
                          geocodeData.address?.village ||
                          geocodeData.address?.county ||
                          'your area';
              const state = geocodeData.address?.state || '';
              const locationName = state ? `${city}, ${state}` : city;

              // Update temp message with location name
              setMessages((prev) =>
                prev.map(m => m.id === tempMsg.id
                  ? {...m, content: `📍 Searching for ${textInput.toLowerCase()} near **${locationName}**...`}
                  : m
                )
              );
            } catch (geoError) {
              console.log('Geocoding error:', geoError);
              // Continue with coordinates only
            }

            // Remove temp message
            setMessages((prev) => prev.filter(m => m.id !== tempMsg.id));
          } catch (error: any) {
            console.log('📍 Location error:', error);
            // Remove temp message
            setMessages((prev) => prev.filter(m => m.id.startsWith('temp-location-')));

            // Add error message
            const errorMsg: Message = {
              id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              role: 'assistant',
              content: '📍 Unable to access your location. Please enable location services in your browser settings, or try including your city/address in your search.',
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMsg]);
            setIsLoading(false);
            setIsTyping(false);
            return;
          }
        }

        // Route to appropriate search API
        if (isLocationQuery && (userLocation || hasCityMention)) {
          console.log('🍕 Calling Google Places with location:', userLocation);

          // Use Google Places API for local business searches
          const localSearchResponse = await fetch('/api/local-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: textInput,
              location: userLocation, // can be null if city is mentioned in query
              history: conversationHistory
            }),
          });

          const localSearchData = await localSearchResponse.json();

          console.log('🗺️ Google Places response:', localSearchData);

          // Remove temp messages
          setMessages((prev) => prev.filter(m => !m.id.startsWith('temp-search-') && !m.id.startsWith('temp-location-')));

          if (localSearchResponse.ok && localSearchData.businesses && localSearchData.businesses.length > 0) {
            // Store businesses as JSON in the message for special rendering
            const businessData = {
              type: 'business_list',
              businesses: localSearchData.businesses
            };

            assistantText = JSON.stringify(businessData);
          } else {
            // More helpful error message
            if (localSearchData.error) {
              assistantText = `Error searching for businesses: ${localSearchData.error}`;
            } else if (!userLocation && !hasCityMention) {
              assistantText = "📍 I need your location to find nearby businesses. Please enable location services or specify a city (e.g., 'pizza in Boston').";
            } else {
              assistantText = `I couldn't find any "${textInput}" nearby. Try:\n- Being more specific (e.g., "Italian restaurants")\n- Checking if location services are enabled\n- Adding your city name to the search`;
            }
          }
        } else {
          // Use Brave Search for news/general searches
          const searchResponse = await fetch('/api/web-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: textInput,
              location: userLocation,
              history: conversationHistory
            }),
          });

          const searchData = await searchResponse.json();

          // Remove temp messages
          setMessages((prev) => prev.filter(m => !m.id.startsWith('temp-search-') && !m.id.startsWith('temp-location-')));

          if (searchResponse.ok && searchData.interpretation) {
            assistantText = searchData.interpretation;
          } else {
            throw new Error(searchData.error || 'Web search failed');
          }
        }
      }
      // ============================================
      // ✅ ROUTE 2: FACT-CHECK (Perplexity + Christian Filter)
      // ============================================
      else if (isFactCheckIntent && hasText) {
        console.log('✅ Detected fact-check intent, routing to Perplexity API...');

        // Add temp message for fact-checking
        const factCheckMsg: Message = {
          id: `temp-factcheck-${Date.now()}`,
          role: 'assistant',
          content: '✅ Running claim through Perplexity and verifying sources...',
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, factCheckMsg]);

        const factCheckResponse = await fetch('/api/fact-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            claim: textInput,
            history: conversationHistory
          }),
        });

        const factCheckData = await factCheckResponse.json();

        // Remove temp message
        setMessages((prev) => prev.filter(m => !m.id.startsWith('temp-factcheck-')));

        if (factCheckResponse.ok && factCheckData.analysis) {
          assistantText = factCheckData.analysis;
        } else {
          throw new Error(factCheckData.error || 'Fact-check failed');
        }
      }
      // ============================================
      // 🌬️ ROUTE 3: AIR QUALITY (Google Air Quality API)
      // ============================================
      else if (isAirQualityIntent && hasText) {
        console.log('🌬️ Detected air quality intent, routing to Google Air Quality API...');

        // Get user's location
        let userLocation = null;
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          try {
            const tempMsg: Message = {
              id: `temp-air-${Date.now()}`,
              role: 'assistant',
              content: '🌬️ Getting air quality and pollen data for your area...',
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, tempMsg]);

            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 10000,
                enableHighAccuracy: true,
                maximumAge: 0
              });
            });

            userLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            };

            const airQualityResponse = await fetch('/api/google-air-quality', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ location: userLocation }),
            });

            const airQualityData = await airQualityResponse.json();

            setMessages((prev) => prev.filter(m => !m.id.startsWith('temp-air-')));

            if (airQualityResponse.ok && airQualityData.airQuality) {
              const aqi = airQualityData.airQuality.indexes?.[0];
              let response = `**Air Quality in ${airQualityData.location}**\n\n`;

              if (aqi) {
                response += `**AQI**: ${aqi.aqi} - ${aqi.category || 'Unknown'}\n`;
                response += `**Health**: ${aqi.dominantPollutant ? `Dominant pollutant: ${aqi.dominantPollutant}` : 'Data unavailable'}\n\n`;
              }

              // Add pollen data if available
              if (airQualityData.airQuality.pollens) {
                response += `**Pollen Levels**:\n`;
                airQualityData.airQuality.pollens.forEach((pollen: any) => {
                  response += `- ${pollen.displayName}: ${pollen.indexInfo?.category || 'N/A'}\n`;
                });
              }

              assistantText = response;
            } else {
              assistantText = "Unable to fetch air quality data. Please try again later.";
            }
          } catch (error: any) {
            setMessages((prev) => prev.filter(m => !m.id.startsWith('temp-air-')));
            assistantText = "📍 Unable to access your location. Please enable location services in your browser settings.";
          }
        } else {
          assistantText = "Location services are not available in your browser.";
        }
      }
      // ============================================
      // 🚗 ROUTE 4: DIRECTIONS (Google Directions API)
      // ============================================
      else if (isDirectionsIntent && hasText) {
        console.log('🚗 Detected directions intent, routing to Google Directions API...');

        const tempMsg: Message = {
          id: `temp-directions-${Date.now()}`,
          role: 'assistant',
          content: '🚗 Calculating route...',
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, tempMsg]);

        // Extract origin and destination from query
        // For now, we'll use "current location" as origin if user says "how do I get to X"
        let origin = 'current location';
        let destination = textInput.replace(/^(how (do i|to) get to|directions? to|route to|navigate to|drive to|walk to)\s*/i, '').trim();

        // Get user's current location for origin
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
            });
            origin = `${position.coords.latitude},${position.coords.longitude}`;
          } catch (error) {
            console.log('Could not get current location for directions');
          }
        }

        const directionsResponse = await fetch('/api/google-directions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ origin, destination }),
        });

        const directionsData = await directionsResponse.json();

        setMessages((prev) => prev.filter(m => !m.id.startsWith('temp-directions-')));

        if (directionsResponse.ok && directionsData.directions) {
          const dir = directionsData.directions;
          let response = `**Route to ${dir.end_address}**\n\n`;
          response += `**Distance**: ${dir.distance}\n`;
          response += `**Duration**: ${dir.duration}\n\n`;
          response += `**Directions**:\n`;
          dir.steps.forEach((step: any, i: number) => {
            response += `${i + 1}. ${step.instruction} (${step.distance})\n`;
          });
          assistantText = response;
        } else {
          assistantText = "Unable to calculate directions. Please try a different destination.";
        }
      }
      // ============================================
      // 🕐 ROUTE 5: TIME ZONE (Google Time Zone API)
      // ============================================
      else if (isTimezoneIntent && hasText) {
        console.log('🕐 Detected timezone intent, routing to Google Time Zone API...');

        const tempMsg: Message = {
          id: `temp-timezone-${Date.now()}`,
          role: 'assistant',
          content: '🕐 Looking up time zone...',
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, tempMsg]);

        // Extract location name from query
        const locationName = textInput.replace(/^(what time is it in|time in|current time in|what('?s| is) the time (in|at))\s*/i, '').trim();

        const timezoneResponse = await fetch('/api/google-timezone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locationName }),
        });

        const timezoneData = await timezoneResponse.json();

        setMessages((prev) => prev.filter(m => !m.id.startsWith('temp-timezone-')));

        if (timezoneResponse.ok && timezoneData.timezone) {
          const tz = timezoneData.timezone;
          assistantText = `**Time in ${locationName}**\n\n🕐 ${tz.formattedTime}\n📅 ${tz.formattedDate}\n🌍 ${tz.name} (UTC${tz.utcOffset >= 0 ? '+' : ''}${tz.utcOffset})`;
        } else {
          assistantText = "Unable to find time zone for that location. Please try a different city or country.";
        }
      }
      // ============================================
      // 💬 ROUTE 6: NORMAL CHAT (Streaming)
      // ============================================
      else {
        let response: Response;
        if (actuallyHasFiles) {
          const formData = new FormData();
          formData.append('message', textInput);
          formData.append('conversationId', currentConvoId || '');
          formData.append('history', JSON.stringify(conversationHistory));
          // Append all files (new uploads or last sent for follow-ups)
          filesToSend.forEach((file) => {
            formData.append('files', file);
          });
          formData.append('toolType', activeTool);
          response = await fetch('/api/chat', { method: 'POST', body: formData });
        } else {
          response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: textInput,
              conversationId: currentConvoId,
              history: conversationHistory,
              toolType: activeTool
            }),
          });
        }

        // Check if response is an error (non-streaming JSON response)
        if (!response.ok || response.headers.get('content-type')?.includes('application/json')) {
          const data = await response.json();

          // If there's an upgrade prompt in the error response
          if (data.upgradePrompt) {
            setUpgradeModalData(data.upgradePrompt);
            setShowUpgradeModal(true);
          }

          // Pass moderation data if present
          const error = new Error(data.error || 'Error from /api/chat') as any;
          if (data.moderation) {
            error.moderation = true;
            error.tip = data.tip;
            error.categories = data.categories;
          }
          throw error;
        }

        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        // Create assistant message placeholder
        const assistantMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const assistantMessage: Message = {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          created_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        let streamedText = '';
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'init') {
                  currentConvoId = data.conversationId;
                  setConversationId(currentConvoId);
                } else if (data.type === 'chunk') {
                  streamedText += data.text;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMsgId
                        ? { ...msg, content: streamedText }
                        : msg
                    )
                  );
                } else if (data.type === 'done') {
                  // Check for upgrade prompt
                  if (data.upgradePrompt) {
                    setUpgradeModalData(data.upgradePrompt);
                    setShowUpgradeModal(true);
                  }

                  // Generate smart title after first exchange
                  if (messages.length <= 1 && currentConvoId) {
                    generateTitle(currentConvoId);
                  }
                }
              }
            }
          }
        } catch (streamError) {
          console.error('Stream reading error:', streamError);
          throw streamError;
        }

        assistantText = streamedText;
      }

      // ✅ FIX: Keep last sent files for MULTIPLE follow-ups (only clear on new chat)
      // Images now persist across multiple follow-up questions until user starts new conversation

      // Note: Database saving is now handled on the backend during streaming

    } catch (error: any) {
      console.error('chat send error:', error);
      // Format error message based on type
      let errorMessage = `Sorry, an error occurred: ${error?.message || 'Unknown error'}`;

      // Enhanced error for moderation violations
      if (error?.moderation && error?.tip) {
        errorMessage = `🛡️ **Content Moderation**\n\n${error.message}\n\n💡 **Tip:** ${error.tip}`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          role: 'assistant',
          content: errorMessage,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
      setIsPracticalQuery(false);
      setIsWokeQuery(false);
      setIsLazyStudentQuery(false);
      setIsVeteranQuery(false);
      setIsBusinessQuery(false);
      setIsParentQuery(false);
      setIsDarkEntityQuery(false);
      setIsCreatorQuery(false);
      setIsDistressQuery(false);
      setIsHackerQuery(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="flex h-screen bg-white overflow-hidden transition-all duration-300"
      style={dimMode ? {
        filter: 'brightness(0.88) contrast(0.93)',
        backgroundColor: '#f5f5f5'
      } : {}
      }
    >
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
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-slate-100 rounded-lg relative"
                onClick={() => router.push('/notifications')}
                disabled={isLoading}
              >
                <Bell className="h-5 w-5 text-slate-700" strokeWidth={2} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </Button>
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
            className="w-full bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-950 hover:to-blue-900 text-white rounded-xl transition-all shadow-lg hover:shadow-xl font-semibold"
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
          {/* Usage Display */}
          <div className="space-y-2 pb-2">
            {subscriptionTier === 'free' ? (
              // FREE TIER: Show message count with progress bar
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Today's Usage</span>
                  <span className="text-slate-700 font-semibold">
                    {usageToday}/{dailyLimit}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      usageToday >= dailyLimit
                        ? 'bg-red-500'
                        : usageToday / dailyLimit > 0.8
                          ? 'bg-yellow-500'
                          : 'bg-blue-600'
                    }`}
                    style={{
                      width: `${Math.min((usageToday / dailyLimit) * 100, 100)}%`
                    }}
                  />
                </div>
                <div className="text-[10px] text-slate-500 text-center uppercase tracking-wide font-medium">
                  {subscriptionTier.toUpperCase()} PLAN
                </div>
              </>
            ) : (
              // PAID TIERS: Show token count without progress bar
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Today's Usage</span>
                  <span className="text-slate-700 font-semibold">
                    {tokensUsedToday.toLocaleString()} tokens
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 text-center uppercase tracking-wide font-medium mt-1">
                  {subscriptionTier.toUpperCase()} PLAN • NO DAILY LIMIT
                </div>
              </>
            )}
          </div>

          {/* Upgrade/Manage Plan Button */}
          <Button
            variant="ghost"
            className="w-full justify-center text-white bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-950 hover:to-blue-900 transition-all rounded-xl font-semibold shadow-lg hover:shadow-xl"
            onClick={() => router.push('/settings')}
            disabled={isLoading}
          >
            <Zap className="h-5 w-5 mr-2" strokeWidth={2.5} />
            <span className="text-sm">
              {subscriptionTier === 'free' ? 'Upgrade Plan' : 'Manage Plan'}
            </span>
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

          {/* Admin Panel Button (only for admins) */}
          {isAdmin && (
            <Button
              variant="ghost"
              className="w-full justify-start text-blue-900 hover:bg-blue-50 transition-all rounded-lg font-semibold"
              onClick={() => router.push('/admin')}
              disabled={isLoading}
            >
              <Shield className="h-4 w-4 mr-2" strokeWidth={2.5} />
              <span className="text-sm font-medium">Admin Panel</span>
            </Button>
          )}

          {/* Sign Out Button */}
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-900 hover:bg-slate-100 transition-all rounded-lg"
            onClick={handleSignOut}
            disabled={isLoading}
          >
            <LogOut className="h-4 w-4 mr-2" strokeWidth={2} />
            <span className="text-sm font-medium">Sign Out</span>
          </Button>

          {/* User Email Display */}
          <div className="w-full px-4 py-3 text-left">
            <div className="text-sm font-medium text-slate-900 truncate">
              {user?.email || 'Loading...'}
            </div>
          </div>
        </div>
      </aside>

      {/* main chat area */}
      <main className="flex-1 flex flex-col p-0 sm:p-4 md:p-6 bg-white overflow-hidden">
        <Card className="w-full h-full flex flex-col shadow-xl sm:shadow-2xl bg-white border-slate-200 rounded-lg sm:rounded-2xl gap-0 py-0">
          {/* header */}
          <CardHeader className="bg-white border-b border-slate-200 rounded-t-lg sm:rounded-t-xl px-4 sm:px-6 md:px-8 pt-3 sm:pt-4 md:pt-5 pb-0">
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
                {/* Dim Mode Button - visible on all screens */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-slate-100 rounded-lg"
                  onClick={() => setDimMode(!dimMode)}
                  disabled={isLoading}
                  title={dimMode ? "Disable Dim Mode" : "Enable Dim Mode"}
                >
                  <Moon className={`h-5 w-5 ${dimMode ? 'text-slate-900' : 'text-slate-500'}`} strokeWidth={2} />
                </Button>
                {/* Desktop spacer to balance right side buttons */}
                <div className="hidden lg:flex items-center gap-2">
                  <div className="w-10 h-10" />
                </div>
              </div>

              {/* Center - Title */}
              <div className="flex-1 flex flex-col items-center justify-center">
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
                  onClick={() => router.push('/settings')}
                  disabled={isLoading}
                  title="Settings"
                >
                  <Settings className="h-5 w-5 text-slate-700" strokeWidth={2} />
                </Button>
              </div>
            </div>
          </CardHeader>

          {/* messages */}
          <CardContent
            className="flex-1 overflow-y-auto p-0 bg-white relative pb-4"
            style={{
              clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 1.5rem), 98% calc(100% - 0.8rem), 95% calc(100% - 0.3rem), 90% calc(100% - 0.1rem), 10% calc(100% - 0.1rem), 5% calc(100% - 0.3rem), 2% calc(100% - 0.8rem), 0 calc(100% - 1.5rem))'
            }}
          >
            <div className="px-3 sm:px-6 md:px-8 pt-3 h-full flex flex-col space-y-4 sm:space-y-6">
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
                <h2 className="text-lg sm:text-xl font-semibold text-blue-900">Slingshot 2.0</h2>
                <div className="space-y-1">
                  <p className="text-slate-700 text-base sm:text-lg md:text-xl font-medium text-center px-4">
                    {getTimeBasedGreeting()}
                  </p>
                  <p className="text-blue-600 text-xs italic font-medium text-center">
                    ✨ Chat memory enabled - I can recall our conversations
                  </p>
                </div>

                {/* Tool Carousel */}
                <div className="w-full mt-8 bg-white">
                  <ToolCarousel
                    onToolSelect={handleToolSelection}
                    isLoading={isLoading}
                  />
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
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
                      <div className="bg-gradient-to-br from-blue-900 to-blue-800 text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl whitespace-pre-wrap text-sm leading-relaxed shadow-lg">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="text-slate-700 text-sm leading-relaxed">
                        {(() => {
                          // Check if this is a business list
                          try {
                            const parsed = JSON.parse(msg.content);
                            if (parsed.type === 'business_list' && parsed.businesses) {
                              return <BusinessList businesses={parsed.businesses} />;
                            }
                          } catch (e) {
                            // Not JSON, render as markdown
                          }

                          // Default: render as markdown
                          return (
                            <div className="prose prose-sm max-w-none prose-headings:font-bold prose-headings:text-slate-900 prose-headings:mb-3 prose-headings:mt-5 prose-p:text-slate-700 prose-p:mb-4 prose-p:leading-relaxed prose-em:text-slate-600 prose-em:italic prose-strong:font-bold prose-strong:text-slate-900 prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-800 prose-ul:my-3 prose-ol:my-3 prose-li:my-1">
                              <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          );
                        })()}
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
            {isTyping && (
              <TypingIndicator
                isPractical={isPracticalQuery}
                isWoke={isWokeQuery}
                isLazyStudent={isLazyStudentQuery}
                isVeteran={isVeteranQuery}
                isBusiness={isBusinessQuery}
                isParent={isParentQuery}
                isDarkEntity={isDarkEntityQuery}
                isCreator={isCreatorQuery}
                isDistress={isDistressQuery}
                isHacker={isHackerQuery}
              />
            )}
            <div ref={messagesEndRef} />
            </div>
          </CardContent>

          {/* input bar */}
          <form
            onSubmit={handleFormSubmit}
            className="px-3 sm:px-6 md:px-8 pt-4 pb-5 sm:pb-6 md:pb-8 bg-gradient-to-b from-white to-slate-50 rounded-b-lg sm:rounded-b-xl shadow-inner relative"
            style={{
              clipPath: 'polygon(0 1.5rem, 2% 0.8rem, 5% 0.3rem, 10% 0.1rem, 90% 0.1rem, 95% 0.3rem, 98% 0.8rem, 100% 1.5rem, 100% 100%, 0 100%)',
              marginTop: '-1.5rem'
            }}
          >
            {uploadedFiles.length > 0 && (
              <div className="mb-3 sm:mb-4">
                <div className="text-xs text-slate-600 mb-2 font-medium">
                  {uploadedFiles.length} {uploadedFiles.length === 1 ? 'file' : 'files'} attached
                </div>
                <div className="flex flex-wrap items-start">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="relative group rounded-lg border border-blue-200 bg-blue-50/50 overflow-hidden shadow-sm hover:shadow-md transition-shadow max-w-[56px]"
                    >
                      {/* Remove button - Always visible */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-red-500 hover:bg-red-600 text-white z-10"
                        onClick={() => removeAttachedFile(index)}
                        disabled={isLoading}
                      >
                        <XIcon className="h-2 w-2" strokeWidth={2} />
                      </Button>

                      {/* Thumbnail preview */}
                      {file.type.startsWith('image/') ? (
                        <div className="w-full h-[45px] bg-slate-100">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-[45px] bg-blue-100 flex items-center justify-center">
                          <FileIcon className="h-5 w-5 text-blue-600" strokeWidth={1.5} />
                        </div>
                      )}

                      {/* File name */}
                      <div className="px-2 py-1.5 bg-white/80 backdrop-blur-sm">
                        <p className="text-xs text-slate-700 font-medium truncate">
                          {file.name}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

            {/* Textarea - Bigger, Rounded, Mobile-Friendly, No Border Ever */}
            <div className="mb-3">
              <Textarea
                ref={inputRef}
                value={localInput}
                onChange={handleTextareaChange}
                placeholder={getPlaceholderText()}
                disabled={isLoading}
                autoComplete="off"
                autoCorrect="off"
                spellCheck
                className="w-full resize-none min-h-[80px] sm:min-h-[100px] max-h-[200px] sm:max-h-[240px] text-sm sm:text-base leading-relaxed overflow-y-auto bg-transparent !border-0 !ring-0 !outline-none focus:!border-0 focus:!ring-0 focus:!outline-none focus-visible:!ring-0 focus-visible:!outline-none shadow-none focus:shadow-none rounded-2xl px-4 py-3 text-slate-900"
                rows={3}
                onKeyDown={handleTextareaKeyDown}
              />
            </div>

            {/* Buttons Row - All below textarea */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                {/* Paperclip - Clean icon only */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isLoading || uploadedFiles.length >= MAX_FILES}
                      className={`hover:bg-slate-100 rounded-lg h-10 w-10 sm:h-11 sm:w-11 ${fileButtonFlash ? 'bg-slate-200' : ''}`}
                      title={uploadedFiles.length >= MAX_FILES ? `Maximum ${MAX_FILES} files reached` : "Attach file or take photo"}
                    >
                      <Paperclip className="h-5 w-5 text-slate-700" strokeWidth={2} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="top"
                    align="start"
                    className="bg-white border border-slate-200 shadow-lg rounded-lg"
                  >
                    <DropdownMenuItem
                      onSelect={() => cameraInputRef.current?.click()}
                      disabled={uploadedFiles.length >= MAX_FILES}
                      className="text-slate-700 text-sm cursor-pointer"
                    >
                      Take Photo
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => fileInputRef.current?.click()}
                      disabled={uploadedFiles.length >= MAX_FILES}
                      className="text-slate-700 text-sm cursor-pointer"
                    >
                      Choose File
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Wrench - Clean icon only */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isLoading}
                      className={`hover:bg-slate-100 rounded-lg h-10 w-10 sm:h-11 sm:w-11 ${toolButtonFlash ? 'bg-slate-200' : ''}`}
                      title="Pick a tool"
                      onClick={handleToolButtonClick}
                    >
                      <Wrench className="h-5 w-5 text-slate-700" strokeWidth={2} />
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

                  {/* Master's, Executive, and PhD tools only for Premium ($30) and Executive tiers */}
                  {(subscriptionTier === 'pro' || subscriptionTier === 'premium' || subscriptionTier === 'executive') && (
                    <>
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
                    </>
                  )}

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

                  {/* Master's, Executive, and PhD tools only for Premium ($30) and Executive tiers */}
                  {(subscriptionTier === 'pro' || subscriptionTier === 'premium' || subscriptionTier === 'executive') && (
                    <>
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
                    </>
                  )}

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
              </div>

              {/* Right side - Mic and Send buttons */}
              <div className="flex items-center gap-2">
                {/* Mic - Hide when typing, red box when recording */}
                {localInput.trim() === '' && (
                  <Button
                    type="button"
                    onClick={handleMic}
                    disabled={isLoading}
                    className={`h-10 w-10 sm:h-11 sm:w-11 rounded-lg flex items-center justify-center transition-all ${
                      isRecording
                        ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                        : 'bg-transparent hover:bg-slate-100 text-slate-700'
                    }`}
                    title={isRecording ? "Recording..." : "Voice input"}
                  >
                    <Mic className="h-5 w-5" strokeWidth={2} />
                  </Button>
                )}

                {/* Send Button - Invisible bg that turns blue when typing */}
                <Button
                  type="submit"
                  disabled={isLoading || (!localInput.trim() && uploadedFiles.length === 0)}
                  className={`h-10 w-10 sm:h-11 sm:w-11 rounded-lg flex items-center justify-center transition-all ${
                    localInput.trim() || uploadedFiles.length > 0
                      ? 'bg-blue-900 hover:bg-blue-950 text-white'
                      : 'bg-transparent hover:bg-slate-100 text-slate-400'
                  }`}
                  title="Send message"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} />
                  ) : (
                    <Send className="h-5 w-5" strokeWidth={2} />
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Card>
      </main>

      {/* Upgrade Modal */}
      {showUpgradeModal && upgradeModalData && (
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          title={upgradeModalData.title}
          description={upgradeModalData.description}
          features={upgradeModalData.features}
          price={upgradeModalData.price}
          paymentLink={upgradeModalData.paymentLink}
          fromTier={upgradeModalData.fromTier}
          toTier={upgradeModalData.toTier}
          highlightText={upgradeModalData.highlightText}
        />
      )}
    </div>
  );
}