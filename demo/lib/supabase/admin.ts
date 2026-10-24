// Service-role client: bypasses row-level security. Server only, never import it from a
// 'use client' file. Same client the agent uses (lib/agent/db.ts).

export { adminDb as db } from '../agent/db';
