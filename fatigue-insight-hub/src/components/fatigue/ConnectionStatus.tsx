import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { healthCheck } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  className?: string;
}

export function ConnectionStatus({ className }: ConnectionStatusProps) {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  useEffect(() => {
    const checkConnection = async () => {
      const isHealthy = await healthCheck();
      setStatus(isHealthy ? 'connected' : 'disconnected');
    };

    // Check immediately
    checkConnection();

    // Check every 30 seconds
    const interval = setInterval(checkConnection, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleRetry = () => {
    setStatus('checking');
    healthCheck().then(isHealthy => {
      setStatus(isHealthy ? 'connected' : 'disconnected');
    });
  };

  return (
    <div 
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs",
        status === 'connected' && "bg-success/10 text-success",
        status === 'disconnected' && "bg-destructive/10 text-destructive cursor-pointer hover:bg-destructive/20",
        status === 'checking' && "bg-muted text-muted-foreground",
        className
      )}
      onClick={status === 'disconnected' ? handleRetry : undefined}
      title={status === 'disconnected' ? 'Click to retry connection' : undefined}
    >
      {status === 'checking' && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Checking...</span>
        </>
      )}
      {status === 'connected' && (
        <>
          <Wifi className="h-3 w-3" />
          <span>API Connected</span>
        </>
      )}
      {status === 'disconnected' && (
        <>
          <WifiOff className="h-3 w-3" />
          <span>API Offline</span>
        </>
      )}
    </div>
  );
}
