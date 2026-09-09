import { Routes, Route, Navigate } from 'react-router-dom';
import { CascadeLayout } from './CascadeLayout';
import { OverviewPage } from './OverviewPage';
import { NodeDetailPage } from './NodeDetailPage';

/**
 * Cascade sub-app — the FarmRisk cascade engine surfaced as a 3rd top-level tab.
 * Auth, Clerk, identity, and the onboarding gate all live above this in RootGate.
 */
export default function CascadeApp() {
  return (
    <Routes>
      <Route element={<CascadeLayout />}>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="nodes" element={<NodeDetailPage />} />
        <Route path="*" element={<Navigate to="overview" replace />} />
      </Route>
    </Routes>
  );
}
