// /app/notifications/[id]/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { type User } from '@supabase/supabase-js';

// --- Notification type ---
interface Notification {
  id: string;
  created_at: string;
  content: string;
  read_status: boolean;
}

const supabase = createClient();

export default function NotificationDetailPage() {
  const router = useRouter();
  const params = useParams();
  // Get ID directly, check if it's a valid string later
  const notificationIdParam = params.id;

  const [user, setUser] = useState<User | null>(null);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [loading, setLoading] = useState(true); // Start true

  // Get user on mount
  useEffect(() => {
    let isMounted = true;
    console.log("Detail Page: getUser effect running...");
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      if (!isMounted) return;
      if (!currentUser) {
        console.log("Detail Page: No user, redirecting.");
        router.push('/login');
      } else {
        console.log("Detail Page: User found:", currentUser.id);
        setUser(currentUser);
      }
    }).catch(err => {
      console.error("Detail Page: Error getting user:", err);
      if(isMounted) router.push('/login');
    });
    return () => { isMounted = false; console.log("Detail Page: getUser effect cleanup."); };
  }, [router]);

  // --- Mark this specific notification as read ---
  const markAsRead = async (id: string) => {
    console.log("Detail Page: Attempting markAsRead for:", id);
    const { error } = await supabase
      .from('notifications')
      .update({ read_status: true })
      .eq('id', id);

    if (error) {
      console.error("Detail Page: Error marking as read:", error);
    } else {
      console.log("Detail Page: Successfully marked as read.");
    }
  };


 // Fetch notification - Refined checks for user and ID readiness
 useEffect(() => {
    let isMounted = true;
    console.log("Detail Page: fetchNotification effect running. User:", !!user, "ID Param:", notificationIdParam);

    // Convert param to string or null, only if it exists
    const currentNotificationId = typeof notificationIdParam === 'string' ? notificationIdParam : null;

    const fetchNotification = async () => {
      // **Only proceed if BOTH user and a valid notificationId string exist**
      if (!user || !currentNotificationId) {
        console.log("Detail Page: Conditions not met. Waiting...");
        // If user is loaded but ID is definitely invalid/missing, stop loading
        if (user && notificationIdParam !== undefined && currentNotificationId === null) {
            console.log("Detail Page: User loaded but ID invalid/missing. Stopping load.");
            if(isMounted && loading) setLoading(false);
            if(isMounted) setNotification(null);
        } else if (!user && loading) {
            // Still waiting for user, keep loading
            console.log("Detail Page: Still waiting for user...");
        } else if (user && notificationIdParam === undefined && loading) {
            // User ready, but router params not ready yet, keep loading
             console.log("Detail Page: Still waiting for router params (ID)...");
        }
        return; // Wait for dependencies to be ready
      }

      console.log("Detail Page: fetchNotification START - User & ID available:", currentNotificationId);
      if (isMounted && !loading) setLoading(true); // Ensure loading is true

      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('id', currentNotificationId)
          .eq('user_id', user.id)
          .single();

        if (!isMounted) return;

        if (error) {
          console.error('Detail Page: Supabase fetch error:', error);
          setNotification(null);
        } else if (data) {
          console.log("Detail Page: Fetched data:", data);
          setNotification(data);
          if (!data.read_status) {
            console.log("Detail Page: Is unread, calling markAsRead...");
            await markAsRead(currentNotificationId); // Use the validated ID
          } else {
            console.log("Detail Page: Already read.");
          }
        } else {
           console.log("Detail Page: No data found for ID/User.");
           setNotification(null); // Explicitly set null if no data
        }
      } catch (fetchError) {
        if (!isMounted) return;
        console.error("Detail Page: Uncaught fetch error:", fetchError);
        setNotification(null);
      } finally {
        if (isMounted) {
          console.log("Detail Page: fetchNotification END.");
          setLoading(false);
        }
      }
    };

    fetchNotification();

    return () => {
      isMounted = false;
      console.log("Detail Page: Cleanup fetch effect.");
    };
  // **DEPENDENCY CHANGE**: Depend on the raw param, let the check inside handle readiness
  }, [user, notificationIdParam]);


  return (
    <div className="flex justify-center items-start min-h-screen bg-gray-100 dark:bg-gray-900 p-4 md:p-8">
      <Card className="w-full max-w-3xl">
        <CardHeader className="flex flex-row items-center space-x-2 border-b pb-4"> {/* Added border */}
           {/* --- Back Button --- */}
           <Button
              variant="outline" // Changed variant for better visibility
              size="icon"
              onClick={() => router.push('/notifications')} // Go back to LIST page
              aria-label="Back to notifications" // Accessibility
            >
             <ArrowLeft className="h-5 w-5" />
           </Button>
           <div>
              <CardTitle>Notification</CardTitle> {/* Simplified Title */}
           </div>
        </CardHeader>
        <CardContent className="pt-6"> {/* Added padding-top */}
          {loading ? (
            <div className="text-center text-gray-500 py-8">Loading notification...</div>
          ) : !notification ? (
             <div className="text-center text-red-500 py-8">Notification not found or access denied.</div>
          ) : (
            <div>
               <p className="text-sm text-muted-foreground mb-4">
                  Received: {new Date(notification.created_at).toLocaleString()}
               </p>
               <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap break-words"> {/* Added break-words */}
                  {notification.content}
               </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}