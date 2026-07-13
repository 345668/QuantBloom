import BloomTerminal from "@/components/BloombergTerminal";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function Home() {
  // Initialize live updates via polling (serverless-safe)
  const { isConnected } = useWebSocket();
  
  return (
    <div className="relative">
      <BloomTerminal />
      {/* Live updates indicator (optional debug info) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-2 right-2 z-50">
          <div className={`px-2 py-1 rounded text-xs ${
            isConnected 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            Live: {isConnected ? 'Polling' : 'Paused'}
          </div>
        </div>
      )}
    </div>
  );
}
