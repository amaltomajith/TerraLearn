import { Routes, Route, Navigate } from 'react-router-dom';
import { VayuLayout } from './VayuLayout';
import { DroughtPanel } from './DroughtPanel';
import { FloodPanel } from './FloodPanel';

/**
 * Vayu sub-app — Flood & Drought Early Warning + Mitigation.
 * Lazy-loaded at /vayu/* in RootGate.
 */
export default function VayuApp() {
  return (
    <Routes>
      <Route element={<VayuLayout />}>
        <Route index element={<Navigate to="drought" replace />} />
        <Route path="drought" element={<DroughtPanel />} />
        <Route path="flood" element={<FloodPanel />} />
        <Route path="*" element={<Navigate to="drought" replace />} />
      </Route>
    </Routes>
  );
}
