import type { ProcurementState } from '../types/procurement';
import { INITIAL_STATE } from '../data/initialState';

export let DB: ProcurementState = structuredClone(INITIAL_STATE) as ProcurementState;
export function setDB(state: ProcurementState): void { DB = state; }

export const ui: {
  currentTab: string; currentModal: string | null; selectedRecord: any;
  searchQuery: string; trackingRecordId: string | null; messageSelection: string | null; directMessagePeerId: string | null; authMode: 'signup' | 'login';
} = { currentTab: 'dashboard', currentModal: null, selectedRecord: null,
  searchQuery: '', trackingRecordId: null, messageSelection: null, directMessagePeerId: null, authMode: 'login' };
