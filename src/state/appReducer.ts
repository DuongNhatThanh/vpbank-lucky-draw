import type { AppAction, AppState } from "./actions";

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "INITIALIZE_APP":
      return {
        ...state,
        participantPreview: null,
        recovery: action.recovery,
        error: action.error,
      };
    case "SET_PARTICIPANT_PREVIEW":
      return {
        ...state,
        participantPreview: action.preview,
        error: null,
      };
    case "CLEAR_PARTICIPANT_PREVIEW":
      return {
        ...state,
        participantPreview: null,
      };
    case "APPLY_PARTICIPANTS":
      return {
        ...state,
        event: action.event,
        participantPreview: null,
        error: null,
      };
    case "PREPARE_LIVE_DRAW":
      return {
        ...state,
        event: action.event,
        error: null,
      };
    case "RESUME_SAVED_SESSION":
      return {
        ...state,
        event: action.event,
        participantPreview: null,
        recovery: { status: "resumed" },
        error: null,
      };
    case "START_NEW_SESSION":
      return {
        ...state,
        event: action.event,
        participantPreview: null,
        recovery: action.recovery,
        error: null,
      };
    case "CLEAR_ERROR":
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
}
