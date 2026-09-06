import type { Farm, Farmer } from '@/lib/saath/types';

/**
 * Onboarding is "done" when the farmer row carries the essentials AND has at
 * least one farm (which the farms→farmers.location mirror guarantees means a
 * usable location for both the simulator and Saath proximity).
 */
export function isProfileComplete(farmer: Farmer | null, farms: Farm[]): boolean {
  if (!farmer) return false;
  if (!farmer.name?.trim()) return false;
  if (!farmer.phone?.trim()) return false;
  if (!farmer.role) return false;
  return farms.length >= 1;
}
