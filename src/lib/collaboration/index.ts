/**
 * COLLABORATION MODULE EXPORTS
 *
 * Real collaborative editing implementation.
 */

export {
  CRDTDocument,
  DocumentStore,
  getDocumentStore,
  type CRDTOperation,
  type CRDTState,
  type CursorPosition,
} from './crdt-document';

export {
  CollaborationManager,
  getCollaborationManager,
  type CollaborationSession,
  type CollaborationUser,
  type CollaborationEvent,
  type JoinSessionResult,
} from './collaboration-manager';

export {
  useCollaboration,
  type UseCollaborationOptions,
  type UseCollaborationReturn,
} from './useCollaboration';
