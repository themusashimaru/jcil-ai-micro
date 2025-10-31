// /app/notifications/page.tsx  <-- LIST PAGE

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { type User } from '@supabase/supabase-js';

// --- Notification type ---
interface Notification {
  id: string;
  created_at: string;
  content: string;
  read_status: boolean;
}

const supabase = createClient();

export default function NotificationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Get user on mount
  useEffect(() => {
    let isMounted = true;
    console.log("List Page: getUser effect running...");
    const getUser = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
       if (!isMounted) return;
      if (!currentUser) {
         console.log("List Page: No user found, redirecting.");
        router.push('/login');
      } else {
         console.log("List Page: User found:", currentUser.id);
        setUser(currentUser);
      }
    };
    getUser();
     return () => { isMounted = false; console.log("List Page: getUser cleanup.") };
  }, [router]);

  // Fetch notifications list when user is loaded
  useEffect(() => {
     let isMounted = true;
     console.log("List Page: fetchNotifications effect running. User:", !!user);
    if (user) {
      const fetchNotifications = async () => {
        if(!isMounted) return; // Check mount status before async call
        setLoading(true);
        console.log("List Page: Fetching notifications for user:", user.id);
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }); // Show newest first

        if (!isMounted) return; // Check after async call returns

        if (error) {
          console.error('List Page: Error fetching notifications:', error);
        } else if (data) {
           console.log("List Page: Fetched notifications:", data.length);
          setNotifications(data);
        }
        setLoading(false);
      };
      fetchNotifications();
    } else {
        // If user is null, stop loading (unless it's initial load)
        if (loading && user === null) { // Only set loading false if user confirmed null
           // console.log("List Page: User is null, stopping loading.");
           // setLoading(false); // Let getUser handle redirect
        }
    }
     return () => { isMounted = false; console.log("List Page: fetchNotifications cleanup.") };
  }, [user]); // Re-run when user state changes


  // Delete a notification
  const handleDeleteNotification = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent navigation when clicking delete button

    if (!window.confirm("Delete this notification?")) {
      return;
    }
    console.log("List Page: Deleting notification:", id);

    // Optimistically remove from UI
    setNotifications(prev => prev.filter(n => n.id !== id));

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("List Page: Error deleting notification:", error);
      // Revert UI change (might need to re-fetch for accuracy)
      alert("Could not delete notification. Please refresh."); // Ask user to refresh on error
    } else {
        console.log("List Page: Deleted notification successfully.");
    }
  };


  return (
    <div className="flex justify-center items-start min-h-screen bg-gray-100 dark:bg-gray-900 p-4 md:p-8">
      <Card className="w-full max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div className="flex items-center space-x-2">
            {/* Back button goes to main chat page */}
            <Button variant="outline" size="icon" onClick={() => router.push('/')} aria-label="Back to chat">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Your recent notifications</CardDescription>
            </div>
          </div>
          {/* TODO: Add "Mark all as read" button here? */}
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center text-gray-500 py-8">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center text-gray-500 py-8">You have no notifications.</div>
          ) : (
            <ul className="space-y-4">
              {notifications.map(notification => (
                <li
                  key={notification.id}
                  className={`relative p-4 rounded-lg border cursor-pointer group transition-colors duration-150 ease-in-out ${
                    !notification.read_status
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                  // Navigate to detail page on click
                  onClick={() => router.push(`/notifications/${notification.id}`)}
                  title="Click to view details" // Accessibility
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-7 w-7 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 z-10" // Show on hover, ensure button is clickable
                    onClick={(e) => handleDeleteNotification(notification.id, e)}
                    aria-label="Delete notification" // Accessibility
                  >
                     <Trash2 className="h-4 w-4" />
                  </Button>

                  {/* Show snippet for long content */}
                  <p className="mb-1 pr-8 text-sm md:text-base line-clamp-2"> {/* Use line-clamp for snippet */}
                    {notification.content}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(notification.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}