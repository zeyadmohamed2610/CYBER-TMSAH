export interface Notification {
  id: string;
  title: string;
  body: string;
  type: "exam" | "quiz" | "reminder" | "announcement";
  date: string;
  time: string;
  subject?: string;
  createdBy: string;
  createdAt: string;
  read: boolean;
  reminded24h: boolean;
  reminded1h: boolean;
}

const STORAGE_KEY = "cyber_notifications";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function load(): Notification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(items: Notification[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function getTypeLabel(type: Notification["type"]): string {
  switch (type) {
    case "exam": return "امتحان";
    case "quiz": return "كويز";
    case "reminder": return "تذكير";
    case "announcement": return "إعلان";
  }
}

function getTypeIcon(type: Notification["type"]): string {
  switch (type) {
    case "exam": return "📝";
    case "quiz": return "❓";
    case "reminder": return "⏰";
    case "announcement": return "📢";
  }
}

function isUpcoming(n: Notification): boolean {
  const eventTime = new Date(`${n.date}T${n.time}`).getTime();
  return eventTime > Date.now();
}

function isPast(n: Notification): boolean {
  const eventTime = new Date(`${n.date}T${n.time}`).getTime();
  return eventTime <= Date.now();
}

function getTimeUntil(n: Notification): string {
  const eventTime = new Date(`${n.date}T${n.time}`).getTime();
  const diff = eventTime - Date.now();
  if (diff <= 0) return "انتهى";
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days} يوم${days > 1 ? "" : ""} و ${hours} ساعة`;
  if (hours > 0) return `${hours} ساعة${hours > 1 ? "" : ""} و ${mins} دقيقة`;
  if (mins > 0) return `${mins} دقيقة`;
  return "الآن";
}

export const notificationService = {
  getAll(): Notification[] {
    return load().sort((a, b) => {
      const ta = new Date(`${a.date}T${a.time}`).getTime();
      const tb = new Date(`${b.date}T${b.time}`).getTime();
      return ta - tb;
    });
  },

  getUpcoming(): Notification[] {
    return this.getAll().filter(isUpcoming);
  },

  getPast(): Notification[] {
    return this.getAll().filter(isPast).reverse();
  },

  getUnreadCount(): number {
    return load().filter(n => !n.read && isUpcoming(n)).length;
  },

  add(params: {
    title: string;
    body: string;
    type: Notification["type"];
    date: string;
    time: string;
    subject?: string;
    createdBy: string;
  }): Notification {
    const items = load();
    const notification: Notification = {
      id: generateId(),
      title: params.title,
      body: params.body,
      type: params.type,
      date: params.date,
      time: params.time,
      subject: params.subject,
      createdBy: params.createdBy,
      createdAt: new Date().toISOString(),
      read: false,
      reminded24h: false,
      reminded1h: false,
    };
    items.push(notification);
    save(items);
    return notification;
  },

  markAsRead(id: string): void {
    const items = load();
    const item = items.find(n => n.id === id);
    if (item) {
      item.read = true;
      save(items);
    }
  },

  markAllAsRead(): void {
    const items = load();
    items.forEach(n => { n.read = true; });
    save(items);
  },

  remove(id: string): void {
    const items = load().filter(n => n.id !== id);
    save(items);
  },

  clearPast(): void {
    const items = load().filter(n => !isPast(n));
    save(items);
  },

  checkReminders(): { due24h: Notification[]; due1h: Notification[] } {
    const items = load();
    const now = Date.now();
    const due24h: Notification[] = [];
    const due1h: Notification[] = [];

    for (const n of items) {
      if (isPast(n)) continue;
      const eventTime = new Date(`${n.date}T${n.time}`).getTime();
      const diff = eventTime - now;
      const hours24 = 24 * 60 * 60 * 1000;
      const hours1 = 60 * 60 * 1000;

      if (!n.reminded24h && diff <= hours24 && diff > hours1) {
        n.reminded24h = true;
        due24h.push(n);
      }
      if (!n.reminded1h && diff <= hours1 && diff > 0) {
        n.reminded1h = true;
        due1h.push(n);
      }
    }

    if (due24h.length > 0 || due1h.length > 0) save(items);
    return { due24h, due1h };
  },

  getTypeLabel,
  getTypeIcon,
  getTimeUntil,
  isUpcoming,
};
