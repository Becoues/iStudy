/**
 * In-memory server semaphore for limiting concurrent AI tasks.
 * Slots expire after 5 minutes to prevent leaks from crashed clients.
 */

interface Slot {
  token: string;
  expiresAt: number;
}

const MAX_SLOTS = 3;
const SLOT_TTL_MS = 5 * 60 * 1000; // 5 minutes

const slots = new Map<string, Slot>();

/** Remove expired slots. Called on each acquire. */
function cleanup() {
  const now = Date.now();
  for (const [token, slot] of slots) {
    if (slot.expiresAt <= now) {
      slots.delete(token);
    }
  }
}

function generateToken(): string {
  return `sem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function acquire(): { granted: boolean; token?: string; position?: number } {
  cleanup();

  if (slots.size < MAX_SLOTS) {
    const token = generateToken();
    slots.set(token, {
      token,
      expiresAt: Date.now() + SLOT_TTL_MS,
    });
    return { granted: true, token };
  }

  return { granted: false, position: slots.size + 1 };
}

export function release(token: string): boolean {
  return slots.delete(token);
}

export function getStatus() {
  cleanup();
  return {
    active: slots.size,
    max: MAX_SLOTS,
    available: MAX_SLOTS - slots.size,
  };
}
