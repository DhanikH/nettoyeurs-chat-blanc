import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Check } from 'lucide-react';
import { formatDate, formatTime, formatDateTime } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';

interface Notification {
  id: string;
  message: string;
  is_read: number;
  created_at: string;
}

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user) {
      console.log("No user, skipping fetchNotifications");
      return;
    }
    try {
      console.log("User object:", user);
      if (!user || !user.id) {
        console.error("User object is invalid:", user);
        return;
      }
      const url = `/api/notifications?userId=${user.id}`;
      console.log("Fetching notifications from:", url);
      const res = await fetch(url);
      console.log("Response status:", res.status, "Content-Type:", res.headers.get("content-type"));
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Fetch failed:", res.status, errorText);
        throw new Error(`HTTP error! status: ${res.status}, body: ${errorText}`);
      }
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setNotifications(data);
      } else {
        const text = await res.text();
        console.error("Expected JSON response from notifications API, but got:", contentType, "Body:", text.substring(0, 100));
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
      // Re-throw or handle as needed
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    try {
      const res = await fetch(`${window.location.origin}/api/notifications/read-all/${user.id}`, { method: 'POST' });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      }
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
    }
  };

  const handleBellClick = () => {
    const newShowDropdown = !showDropdown;
    setShowDropdown(newShowDropdown);
    if (newShowDropdown) {
      markAllAsRead();
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleBellClick}
        className="relative p-2 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-xl transition-all"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-bold text-slate-900">Notifications</h3>
            <button onClick={() => setShowDropdown(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.map(notification => (
                <div 
                  key={notification.id} 
                  className={`p-4 border-b border-slate-50 last:border-0 transition-colors ${notification.is_read ? 'bg-white' : 'bg-emerald-50/30'}`}
                >
                  <div className="flex justify-between gap-3">
                    <p className={`text-sm leading-relaxed ${notification.is_read ? 'text-slate-600' : 'text-slate-900 font-medium'}`}>
                      {notification.message}
                    </p>
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                    {(() => {
                      try {
                        console.log("Notification created_at:", notification.created_at);
                        const d = new window.Date(notification.created_at);
                        console.log("Date object:", d);
                        return formatDateTime(d);
                      } catch (e) {
                        console.error("Error formatting date:", e);
                        return "Invalid Date";
                      }
                    })()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
