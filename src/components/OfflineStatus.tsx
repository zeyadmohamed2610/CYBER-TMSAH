import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { WifiOff, Wifi, RefreshCw, CloudOff } from "lucide-react";
import { toast } from "sonner";

interface OfflineStatusContextType {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
}

const OfflineStatusContext = createContext<OfflineStatusContextType>({
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  syncNow: async () => {},
});

export const useOfflineStatus = () => useContext(OfflineStatusContext);

interface OfflineStatusProviderProps {
  children: ReactNode;
  syncFunction?: () => Promise<{ synced: number; failed: number }>;
  getPendingCountFunction?: () => number;
}

export const OfflineStatusProvider = ({ 
  children, 
  syncFunction,
  getPendingCountFunction 
}: OfflineStatusProviderProps) => {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("تم استعادة الاتصال بالإنترنت", {
        icon: <Wifi className="h-4 w-4 text-green-500" />
      });
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("أنت الآن غير متصل بالإنترنت", {
        icon: <WifiOff className="h-4 w-4 text-yellow-500" />
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (getPendingCountFunction) {
      const updatePendingCount = () => {
        setPendingCount(getPendingCountFunction());
      };
      
      updatePendingCount();
      const interval = setInterval(updatePendingCount, 5000);
      
      return () => clearInterval(interval);
    }
  }, [getPendingCountFunction]);

  const syncNow = async () => {
    if (!syncFunction || isSyncing || !isOnline) return;
    
    setIsSyncing(true);
    try {
      const result = await syncFunction();
      if (result.synced > 0) {
        toast.success(`تم مزامنة ${result.synced} حضور`, {
          icon: <RefreshCw className="h-4 w-4" />
        });
      }
      if (result.failed > 0) {
        toast.error(`فشلت مزامنة ${result.failed} حضور`, {
          icon: <CloudOff className="h-4 w-4" />
        });
      }
    } catch {
      toast.error("فشلت المزامنة");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncing) {
      const autoSync = setTimeout(() => {
        syncNow();
      }, 2000);
      
      return () => clearTimeout(autoSync);
    }
  }, [isOnline, pendingCount, isSyncing, syncNow]);

  return (
    <OfflineStatusContext.Provider value={{ isOnline, pendingCount, isSyncing, syncNow }}>
      {children}
    </OfflineStatusContext.Provider>
  );
};

export const OfflineIndicator = () => {
  const { isOnline, pendingCount, isSyncing, syncNow } = useOfflineStatus();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className={`fixed bottom-4 left-4 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all duration-300 ${
      isOnline 
        ? "bg-green-500/20 border border-green-500/30 text-green-400" 
        : "bg-yellow-500/20 border border-yellow-500/30 text-yellow-400"
    }`}>
      {isSyncing ? (
        <RefreshCw className="h-4 w-4 animate-spin" />
      ) : isOnline ? (
        <Wifi className="h-4 w-4" />
      ) : (
        <WifiOff className="h-4 w-4" />
      )}
      
      <span className="text-sm font-medium">
        {!isOnline 
          ? "غير متصل" 
          : pendingCount > 0 
            ? `${pendingCount} في الانتظار` 
            : "متصل"}
      </span>

      {pendingCount > 0 && isOnline && !isSyncing && (
        <button 
          onClick={syncNow}
          className="ml-1 px-2 py-0.5 text-xs bg-white/10 hover:bg-white/20 rounded-full transition-colors"
        >
          مزامنة
        </button>
      )}
    </div>
  );
};