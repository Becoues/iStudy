import {
  GenerationResponse,
  ExpansionResponse,
  KnowledgeItemWithChildren,
} from "@/types/knowledge";

/**
 * Strip markdown code fences (```json ... ``` or ``` ... ```) from text.
 */
function stripCodeFences(text: string): string {
  let cleaned = text.trim();

  // Remove opening fence: ```json or ```
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "");

  // Remove closing fence
  cleaned = cleaned.replace(/\n?\s*```\s*$/, "");

  return cleaned.trim();
}

/**
 * Attempt to extract a JSON object from arbitrary text by finding
 * the first '{' and the last matching '}'.
 */
function extractJsonFromText(text: string): string | null {
  const startIndex = text.indexOf("{");
  if (startIndex === -1) return null;

  let depth = 0;
  let endIndex = -1;

  for (let i = startIndex; i < text.length; i++) {
    if (text[i] === "{") {
      depth++;
    } else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        endIndex = i;
        break;
      }
    }
  }

  if (endIndex === -1) return null;

  return text.slice(startIndex, endIndex + 1);
}

/**
 * Parse AI-generated text into a GenerationResponse.
 * Handles common issues like markdown code fences and extraneous text.
 */
export function parseGenerationResponse(text: string): GenerationResponse {
  // Attempt 1: direct parse
  try {
    const parsed = JSON.parse(text);
    return validateGenerationResponse(parsed);
  } catch {
    // continue to next strategy
  }

  // Attempt 2: strip code fences and parse
  const stripped = stripCodeFences(text);
  try {
    const parsed = JSON.parse(stripped);
    return validateGenerationResponse(parsed);
  } catch {
    // continue to next strategy
  }

  // Attempt 3: extract JSON object from text via brace matching
  const extracted = extractJsonFromText(text);
  if (extracted) {
    try {
      const parsed = JSON.parse(extracted);
      return validateGenerationResponse(parsed);
    } catch {
      // fall through to error
    }
  }

  throw new Error(
    "Failed to parse generation response: could not extract valid JSON from AI output"
  );
}

/**
 * Parse AI-generated text into an ExpansionResponse.
 * Handles common issues like markdown code fences and extraneous text.
 */
export function parseExpansionResponse(text: string): ExpansionResponse {
  // Attempt 1: direct parse
  try {
    const parsed = JSON.parse(text);
    return validateExpansionResponse(parsed);
  } catch {
    // continue to next strategy
  }

  // Attempt 2: strip code fences and parse
  const stripped = stripCodeFences(text);
  try {
    const parsed = JSON.parse(stripped);
    return validateExpansionResponse(parsed);
  } catch {
    // continue to next strategy
  }

  // Attempt 3: extract JSON object from text via brace matching
  const extracted = extractJsonFromText(text);
  if (extracted) {
    try {
      const parsed = JSON.parse(extracted);
      return validateExpansionResponse(parsed);
    } catch {
      // fall through to error
    }
  }

  throw new Error(
    "Failed to parse expansion response: could not extract valid JSON from AI output"
  );
}

function validateGenerationResponse(data: unknown): GenerationResponse {
  if (typeof data !== "object" || data === null) {
    throw new Error("Response is not an object");
  }

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.tags)) {
    throw new Error('Response missing "tags" array');
  }

  if (!Array.isArray(obj.items)) {
    throw new Error('Response missing "items" array');
  }

  return {
    tags: obj.tags as string[],
    items: obj.items as GenerationResponse["items"],
  };
}

function validateExpansionResponse(data: unknown): ExpansionResponse {
  if (typeof data !== "object" || data === null) {
    throw new Error("Response is not an object");
  }

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.items)) {
    throw new Error('Response missing "items" array');
  }

  return {
    items: obj.items as ExpansionResponse["items"],
  };
}

/**
 * Build a tree structure from a flat list of knowledge items.
 * Each item should have: id, parentId, orderIndex, and other fields.
 * Returns an array of root-level items with nested children arrays.
 */
export function buildItemTree(
  items: Array<{
    id: string;
    parentId: string | null;
    orderIndex: number;
    [key: string]: unknown;
  }>
): KnowledgeItemWithChildren[] {
  const itemMap = new Map<string, KnowledgeItemWithChildren>();
  const roots: KnowledgeItemWithChildren[] = [];

  // First pass: create a map of all items with empty children arrays
  for (const item of items) {
    itemMap.set(item.id, {
      ...item,
      children: [],
    } as unknown as KnowledgeItemWithChildren);
  }

  // Second pass: build parent-child relationships
  for (const item of items) {
    const node = itemMap.get(item.id)!;

    if (item.parentId && itemMap.has(item.parentId)) {
      const parent = itemMap.get(item.parentId)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children by orderIndex at each level
  function sortChildren(nodes: KnowledgeItemWithChildren[]): void {
    nodes.sort((a, b) => a.orderIndex - b.orderIndex);
    for (const node of nodes) {
      if (node.children.length > 0) {
        sortChildren(node.children);
      }
    }
  }

  sortChildren(roots);

  return roots;
}
