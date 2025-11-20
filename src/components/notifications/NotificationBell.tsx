import { useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function NotificationBell() {
    const { notifications, unreadCount, markAsRead } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    const handleNotificationClick = async (notification: any) => {
        await markAsRead(notification.id);
        setIsOpen(false);

        if (notification.link) {
            navigate(notification.link);
        }
    };

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive animate-pulse" />
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Notificações</span>
                    {unreadCount > 0 && (
                        <span className="text-xs font-normal text-muted-foreground">
                            {unreadCount} não lida{unreadCount !== 1 && 's'}
                        </span>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <ScrollArea className="h-[300px]">
                    {notifications.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            Nenhuma notificação nova
                        </div>
                    ) : (
                        <div className="py-1">
                            {notifications.map((notification) => (
                                <DropdownMenuItem
                                    key={notification.id}
                                    className="flex flex-col items-start gap-1 p-3 cursor-pointer focus:bg-muted/50"
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <div className="flex w-full items-start justify-between gap-2">
                                        <span className="font-semibold text-sm">{notification.title}</span>
                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                            {formatDistanceToNow(new Date(notification.created_at), {
                                                addSuffix: true,
                                                locale: ptBR,
                                            })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                        {notification.message}
                                    </p>
                                </DropdownMenuItem>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
