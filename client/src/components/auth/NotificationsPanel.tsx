import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, X, Check, AlertTriangle, Info, CheckCircle2, Trash2, MailOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  userId: string;
  type: "alert" | "system" | "trade" | "news";
  title: string;
  message: string;
  isRead: boolean;
  priority: "low" | "medium" | "high";
  createdAt: string;
  actionType?: string | null;
  actionData?: string | null;
  metadata?: string | null;
}

interface NotificationsPanelProps {
  children: React.ReactNode;
}

export default function NotificationsPanel({ children }: NotificationsPanelProps) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch notifications
  const { data: notifications = [], isLoading, error } = useQuery<Notification[]>({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await fetch(`/api/notifications/${user.id}`);
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return response.json();
    },
    enabled: !!user?.id && isAuthenticated,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });

  // Fetch unread count for badge
  const { data: unreadCount = 0 } = useQuery<{count: number}>({
    queryKey: ['notifications', user?.id, 'unread-count'],
    queryFn: async () => {
      if (!user?.id) return { count: 0 };
      const response = await fetch(`/api/notifications/${user.id}/unread-count`);
      if (!response.ok) throw new Error('Failed to fetch unread count');
      return response.json();
    },
    enabled: !!user?.id && isAuthenticated,
    refetchInterval: 30000,
  });

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('Failed to mark notification as read');
      return response.json();
    },
    onSuccess: () => {
      // Invalidate user-scoped notification queries
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
        queryClient.invalidateQueries({ queryKey: ['notifications', user.id, 'unread-count'] });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive",
        duration: 3000,
      });
    }
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user');
      const response = await fetch(`/api/notifications/${user.id}/read-all`, {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('Failed to mark all notifications as read');
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate user-scoped notification queries
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
        queryClient.invalidateQueries({ queryKey: ['notifications', user.id, 'unread-count'] });
      }
      toast({
        title: "Success",
        description: data.message || "All notifications marked as read",
        duration: 3000,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read",
        variant: "destructive",
        duration: 3000,
      });
    }
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete notification');
      return response.json();
    },
    onSuccess: () => {
      // Invalidate user-scoped notification queries
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
        queryClient.invalidateQueries({ queryKey: ['notifications', user.id, 'unread-count'] });
      }
      toast({
        title: "Success",
        description: "Notification deleted",
        duration: 3000,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive",
        duration: 3000,
      });
    }
  });

  const handleMarkAsRead = (notificationId: string) => {
    markAsReadMutation.mutate(notificationId);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const handleDeleteNotification = (notificationId: string) => {
    deleteNotificationMutation.mutate(notificationId);
  };

  const getNotificationIcon = (type: string, priority: string) => {
    switch (type) {
      case "alert":
        return priority === "high" ? 
          <AlertTriangle className="w-4 h-4 text-destructive" /> : 
          <Bell className="w-4 h-4 text-primary" />;
      case "system":
        return <Info className="w-4 h-4 text-chart-3" />;
      case "trade":
        return <CheckCircle2 className="w-4 h-4 text-chart-2" />;
      case "news":
        return <Info className="w-4 h-4 text-chart-4" />;
      default:
        return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "border-l-destructive bg-destructive/5";
      case "medium":
        return "border-l-primary bg-primary/5";
      case "low":
        return "border-l-muted-foreground bg-muted/5";
      default:
        return "border-l-border bg-card";
    }
  };

  if (!isAuthenticated) return null;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <div className="relative">
          {children}
          {(typeof unreadCount === 'object' && unreadCount?.count > 0) && (
            <Badge 
              className="absolute -top-2 -right-2 h-5 w-5 p-0 bg-destructive text-destructive-foreground text-xs font-mono"
              data-testid="notification-badge"
            >
              {unreadCount.count > 99 ? "99+" : unreadCount.count}
            </Badge>
          )}
        </div>
      </SheetTrigger>

      <SheetContent 
        className="w-[400px] sm:w-[500px] bg-card border-card-border"
        data-testid="notifications-panel"
      >
        <SheetHeader className="space-y-4">
          <SheetTitle className="text-primary font-mono text-lg uppercase tracking-wide">
            Notifications
          </SheetTitle>
          
          {notifications.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground font-mono">
                {(typeof unreadCount === 'object' ? unreadCount?.count : 0) || 0} unread • {notifications.length} total
              </p>
              {(typeof unreadCount === 'object' && unreadCount?.count > 0) && (
                <Button
                  data-testid="button-mark-all-read"
                  size="sm"
                  variant="outline"
                  className="font-mono text-xs"
                  onClick={handleMarkAllAsRead}
                  disabled={markAllAsReadMutation.isPending}
                >
                  <Check className="w-3 h-3 mr-1" />
                  Mark All Read
                </Button>
              )}
            </div>
          )}
        </SheetHeader>

        <div className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground font-mono">Loading notifications...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-destructive font-mono">Failed to load notifications</div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-2">
              <Bell className="w-12 h-12 text-muted-foreground opacity-50" />
              <div className="text-sm text-muted-foreground font-mono text-center">
                No notifications yet
              </div>
              <div className="text-xs text-muted-foreground font-mono text-center">
                You'll see alerts and updates here
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`border-l-2 p-4 rounded-md transition-colors ${getPriorityColor(notification.priority)} ${
                      !notification.isRead ? 'bg-opacity-10' : 'opacity-75'
                    }`}
                    data-testid={`notification-${notification.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type, notification.priority)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={`text-sm font-semibold font-mono ${
                              !notification.isRead ? 'text-foreground' : 'text-muted-foreground'
                            } truncate`}>
                              {notification.title}
                            </h4>
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1" />
                            )}
                          </div>
                          
                          <p className={`text-xs font-mono mt-1 ${
                            !notification.isRead ? 'text-secondary-foreground' : 'text-muted-foreground'
                          }`}>
                            {notification.message}
                          </p>
                          
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-muted-foreground font-mono">
                              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </span>
                            
                            <div className="flex items-center gap-1">
                              {!notification.isRead && (
                                <Button
                                  data-testid={`button-mark-read-${notification.id}`}
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-xs font-mono"
                                  onClick={() => handleMarkAsRead(notification.id)}
                                  disabled={markAsReadMutation.isPending}
                                >
                                  <Check className="w-3 h-3" />
                                </Button>
                              )}
                              
                              <Button
                                data-testid={`button-delete-${notification.id}`}
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs font-mono text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteNotification(notification.id)}
                                disabled={deleteNotificationMutation.isPending}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}