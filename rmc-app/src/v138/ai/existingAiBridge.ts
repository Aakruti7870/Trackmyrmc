export const AI_ENDPOINTS={
  config:'/ai/config',
  chat:'/ai/chat',
  stream:'/ai/chat/stream',
  speechToText:'/ai/stt',
  supportTicket:'/ai/support-ticket',
  adminSettings:'/admin/ai-settings',
} as const;

/** Opens the AI assistant already present in TrackMyRMC. No second assistant is created. */
export function openExistingAiAssistant(){ window.dispatchEvent(new Event('rmc:ai-open')); }

/** Use this only from the same authenticated API client already used by the app. */
export type ExistingApiClient={ get<T=unknown>(path:string):Promise<T>; post<T=unknown>(path:string,body?:unknown):Promise<T> };
export async function getAiConfig(api:ExistingApiClient){ return api.get(AI_ENDPOINTS.config); }
