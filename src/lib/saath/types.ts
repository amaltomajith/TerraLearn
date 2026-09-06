// Hand-written DTOs for the Saath tables and RPC results.
// (If you later run `npm run types:supabase`, generated types land in
//  src/types/supabase.ts and can be layered on top of these.)

export type FarmerRole = 'farmer' | 'buyer' | 'both';
export type ListingType = 'equipment' | 'labour' | 'resource' | 'demand';
export type OfferStatus =
  | 'pending'
  | 'countered'
  | 'accepted'
  | 'declined'
  | 'expired';
export type DisputeStatus = 'open' | 'resolved';
export type CircularBadge = 'none' | 'bronze' | 'silver' | 'gold';

export interface Farmer {
  id: string;
  clerk_user_id: string | null;
  name: string;
  phone: string | null;
  role: FarmerRole;
  village: string | null;
  language: string;
  enterprises: string[];
  gstin: string | null;
  gstin_verified: boolean;
  created_at: string;
}

export interface Farm {
  id: string;
  label: string;
  lat: number;
  lng: number;
  is_primary: boolean;
  enterprises: string[];
  primary_crop: string | null;
  created_at: string;
}

export interface Listing {
  id: string;
  farmer_id: string;
  type: ListingType;
  category: string | null;
  title: string;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  ifs_resource_type: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Offer {
  id: string;
  listing_id: string;
  from_farmer_id: string;
  parent_offer_id: string | null;
  price: number | null;
  quantity: number | null;
  status: OfferStatus;
  note: string | null;
  created_at: string;
}

export interface Exchange {
  id: string;
  listing_id: string | null;
  offer_id: string | null;
  requester_id: string;
  provider_id: string;
  is_ifs_exchange: boolean;
  payment_confirmed_by_payer: boolean;
  payment_confirmed_by_payee: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface Rating {
  id: string;
  exchange_id: string;
  rater_id: string;
  rated_id: string;
  reliability_score: number | null;
  condition_score: number | null;
  communication_score: number | null;
  note: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  context_type: string | null;
  context_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Dispute {
  id: string;
  exchange_id: string;
  raised_by: string;
  reason: string;
  status: DisputeStatus;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

// --- RPC row shapes --------------------------------------------------------

export interface NearbyListingRow {
  id: string;
  farmer_id: string;
  farmer_name: string;
  village: string | null;
  type: ListingType;
  category: string | null;
  title: string;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  ifs_resource_type: string | null;
  distance_m: number | null;
  lat: number;
  lng: number;
  created_at: string;
}

export interface IfsMatchRow {
  my_enterprise: string;
  resource: string;
  direction: 'i_supply' | 'i_need';
  their_enterprise: string;
  their_farmer_id: string;
  their_farmer_name: string;
  their_village: string | null;
  distance_m: number | null;
  their_lat: number;
  their_lng: number;
  has_active_listing: boolean;
}

export interface SupplyMatchRow {
  listing_id: string;
  farmer_id: string;
  farmer_name: string;
  village: string | null;
  title: string;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  distance_m: number | null;
}

export interface DemandMatchRow {
  demand_id: string;
  buyer_id: string;
  buyer_name: string;
  category: string | null;
  title: string;
  quantity: number | null;
  rate: number | null;
  distance_m: number | null;
}

export interface MapPointRow {
  id: string;
  name: string;
  village: string | null;
  role: FarmerRole;
  enterprises: string[];
  lat: number;
  lng: number;
  distance_m: number | null;
  badge: CircularBadge;
}

export interface PaymentReliability {
  avg_score: number | null;
  n: number;
}
