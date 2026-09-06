import { UserButton } from '@clerk/clerk-react';
import { clerkAppearance } from './clerkAppearance';

/** Clerk user menu for the top nav. The app is fully gated, so a signed-out
 *  state never reaches here. */
export default function NavAuthControl() {
  return <UserButton appearance={clerkAppearance} />;
}
