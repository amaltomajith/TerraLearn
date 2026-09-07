// DTOs for the global AI assistant: conversation memory + the request/response
// contract with the FastAPI backend.

export type AssistantRole = 'user' | 'assistant' | 'system';

// ---------------------------------------------------------------------------
// Page context handed to the assistant by whatever screen is mounted. The
// simulator (src/components/home.tsx) publishes these via useAssistantPageContext;
// every other page leaves it null and the assistant falls back to the primary farm.
// ---------------------------------------------------------------------------

/** The pinned crop-simulation result, when one is on screen. */
export interface CropContextData {
  crop: string;
  plantingDate: string;
  yieldEstimate: number;
  viabilityScore: number;
  profit: number;
}

/** The current pin's environment snapshot + market signals. Mirrors backend AskRequest. */
export interface AssistantExtraContext {
  locationName?: string;
  env?: {
    temperature?: number;
    precipitation?: number;
    humidity?: number;
    soilPH?: number;
    soilNitrogen?: number;
    soilPhosphorus?: number;
    usAqi?: number;
    pm2_5?: number;
    pm10?: number;
    ozone?: number;
  };
  suggestedCrops?: string[];
  mandiTrendPct?: number;
  buyerDemand?: {
    buyerName: string;
    category: string;
    rate?: number;
    unit?: string;
    distanceKm?: number;
  }[];
}

export interface AssistantPageContext {
  position: { lat: number; lng: number } | null;
  cropContext?: CropContextData | null;
  assistantContext?: AssistantExtraContext | null;
}

// ---------------------------------------------------------------------------
// Assistant actions (PR3) — declared now so the persisted `meta` shape is
// stable across releases. Unused until draft-and-confirm messaging ships.
// ---------------------------------------------------------------------------

export interface AssistantAction {
  type: 'send_message';
  /** The model proposes a name; the frontend resolves it against the Saath snapshot. */
  recipientName: string;
  body: string;
  /** Filled in by the client resolver at confirm time. */
  recipientFarmerId?: string;
  threadId?: string;
}

// ---------------------------------------------------------------------------
// Saath snapshot (PR2) — a compact, frontend-assembled view of the farmer's
// Saath network, sent as structured context on every /api/ask call. All lists
// are hard-capped client-side to stay inside the token budget.
// ---------------------------------------------------------------------------

export interface SaathSnapshot {
  inbox: {
    threadId: string;
    otherId: string;
    otherName: string;
    lastSnippet: string;
    fromMe: boolean;
    unreadish: boolean;
    at: string; // YYYY-MM-DD
  }[];
  nearbyFarmers: {
    id: string;
    name: string;
    village?: string;
    enterprises: string[];
    distanceKm?: number;
  }[];
  ifsLoops: {
    resource: string;
    direction: 'i_supply' | 'i_need';
    theirId: string;
    theirName: string;
    distanceKm?: number;
  }[];
  myListings: { id: string; type: string; title: string; active: boolean }[];
  nearbyDemand: {
    buyerId: string;
    buyerName: string;
    category: string;
    rate?: number;
    unit?: string;
    distanceKm?: number;
  }[];
}

// ---------------------------------------------------------------------------
// Conversation memory (assistant_threads / assistant_messages)
// ---------------------------------------------------------------------------

export interface AssistantThread {
  id: string;
  farmer_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

export interface AssistantMeta {
  /** Which provider served the answer: 'groq' | 'openrouter_fallback'. */
  provider?: string;
  /** A pending / completed message-send proposal. */
  action?: AssistantAction;
  /** ISO timestamp set once the user confirms the send. */
  actionSentAt?: string;
  /** Set if the user dismissed the proposal without sending. */
  actionDismissed?: boolean;
}

export interface AssistantMessage {
  id: string;
  thread_id: string;
  role: AssistantRole;
  content: string;
  meta: AssistantMeta | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Backend contract
// ---------------------------------------------------------------------------

export interface AskPayload {
  question: string;
  lat?: number | null;
  lng?: number | null;
  cropContext?: CropContextData | null;
  history?: { role: AssistantRole; content: string }[];
  farmerLanguage?: string | null;
  farmerName?: string | null;
  village?: string | null;
  enterprises?: string[] | null;
  // ...AssistantExtraContext is spread in flat by the caller.
  locationName?: string;
  env?: AssistantExtraContext['env'];
  suggestedCrops?: string[];
  mandiTrendPct?: number;
  buyerDemand?: AssistantExtraContext['buyerDemand'];
  saath?: SaathSnapshot;
}

export interface AskResult {
  answer: string;
  action?: AssistantAction;
}
