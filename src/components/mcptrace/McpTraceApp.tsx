import { Navigation } from '@/components/Navigation';
import NavAuthControl from '@/components/saath/NavAuthControl';
import McpTracePage from './McpTracePage';

/**
 * MCP trace sub-app — a dev-only tool for verifying the Farmer/Buyer MCP
 * servers' tool-selection reasoning, mounted the same way Cascade/Saath/Vayu
 * are (see RootGate). Single page, no sub-routes.
 */
export default function McpTraceApp() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation authSlot={<NavAuthControl />} />
      <main className="max-w-[1800px] mx-auto px-4 sm:px-6 pb-20 pt-24">
        <McpTracePage />
      </main>
    </div>
  );
}
