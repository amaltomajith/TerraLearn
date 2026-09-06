import { Routes, Route, Navigate } from 'react-router-dom';
import { SaathLayout } from './SaathLayout';
import { FeedPage } from './FeedPage';
import { MapPage } from './MapPage';
import { MyListingsPage } from './MyListingsPage';
import { ListingComposer } from './ListingComposer';
import { MessagesPage } from './MessagesPage';
import { BuyerPage } from './BuyerPage';
import { ProfilePage } from './ProfilePage';
import { DisputesPanel } from './DisputesPanel';

/**
 * The Saath sub-app. Auth, the Clerk provider, the identity provider and the
 * onboarding gate all live above this (src/App.tsx → src/auth/RootGate.tsx),
 * shared with the simulator. This only owns the /saath/* route tree.
 */
export default function SaathApp() {
  return (
    <Routes>
      <Route element={<SaathLayout />}>
        <Route index element={<Navigate to="feed" replace />} />
        <Route path="feed" element={<FeedPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="listings" element={<MyListingsPage />} />
        <Route path="listings/new" element={<ListingComposer />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="messages/:threadId" element={<MessagesPage />} />
        <Route path="buyer" element={<BuyerPage />} />
        <Route path="disputes" element={<DisputesPanel />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/:farmerId" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="feed" replace />} />
      </Route>
    </Routes>
  );
}
