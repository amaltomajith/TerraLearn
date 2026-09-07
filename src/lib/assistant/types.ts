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
  recipientFarmerId: string;
  recipientName: string;
  threadId?: string | null;
  body: string;
  contextType?: string | null;
  contextId?: string | null;
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
  /** PR3: a pending / completed message-send proposal. */
  action?: AssistantAction;
  /** PR3: ISO timestamp set once the user confirms the send. */
  actionSentAt?: string;
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
}

export interface AskResult {
  answer: string;
  action?: AssistantAction;
}
