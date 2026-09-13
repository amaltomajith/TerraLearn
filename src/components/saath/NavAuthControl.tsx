import { UserButton } from '@clerk/clerk-react';
import { Terminal } from 'lucide-react';
import { clerkAppearance } from './clerkAppearance';

/** Clerk user menu for the top nav. The app is fully gated, so a signed-out
 *  state never reaches here.
 *
 *  Carries one extra, discreet entry: a link to the dev-only /mcp-trace
 *  reasoning-trace page (see McpTracePage.tsx). Deliberately placed inside
 *  the account dropdown rather than the main Navigation bar every farmer
 *  sees — reachable, but not something a farmer would stumble into or find
 *  meaningful if they did. */
export default function NavAuthControl() {
  return (
    <UserButton appearance={clerkAppearance}>
      <UserButton.MenuItems>
        <UserButton.Link label="MCP trace (dev)" labelIcon={<Terminal className="w-4 h-4" />} href="/mcp-trace" />
      </UserButton.MenuItems>
    </UserButton>
  );
}
