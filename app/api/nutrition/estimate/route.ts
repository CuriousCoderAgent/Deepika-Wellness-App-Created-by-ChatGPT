/**
 * Reading a meal photo into an estimate.
 *
 * A member could already attach a photo to a meal, and the estimate ignored it
 * entirely — the numbers came from whatever she typed. This closes that gap:
 * the photo she has already uploaded is fetched from private storage, shown to
 * the model, and comes back as a list of foods with quantities.
 *
 * The photo never leaves private storage by any other path. It is read
 * server-side using the same ownership checks as `/api/files/[id]`, converted
 * to a data URL for one request, and not stored by the model provider
 * (`store: false`).
 *
 * Scope, which matters here more than accuracy: this estimates what is on a
 * plate. It is not allowed to comment on whether the meal is good, healthy,
 * or appropriate for anyone — that is coaching, and it belongs to Deepika. It
 * says what it sees and how sure it is, and the member can correct every number
 * afterwards exactly as she can today.
 */

import OpenAI from "openai";
import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { isConfigured, readPrivateFileRecord } from "@/lib/db";
import {
  authenticatedFileSession,
  canAccessPrivateFile,
  privateFileIdHash,
  readPrivateFileId,
} from "@/lib/private-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Generous enough for a plate of food, small enough to stay one request. */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

/**
 * Bump this whenever the developer prompt below changes.
 *
 * Stored on the food entry alongside the model name, so a number in someone's
 * diary can still be explained six months after the prompt that produced it
 * was rewritten. Without it, "the estimate looks wrong" is unanswerable.
 */
const PROMPT_VERSION = "meal-photo-2026-08-24";

const estimateSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items", "confident"],
  properties: {
    items: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity", "unit", "calories", "protein", "carbs", "fat"],
        properties: {
          name: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string" },
          calories: { type: "number" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
        },
      },
    },
    /** False when the photo is unclear, and the app then says so plainly. */
    confident: { type: "boolean" },
  },
} as const;

interface EstimatedItem {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const clamp = (value: unknown, max: number) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(Math.min(n, max));
};

/**
 * A model returning 40,000 calories for a bowl of dal is not an estimate, it is
 * a bug the member has to notice. Bound every number to something a person
 * could actually eat before it reaches her food log.
 */
function sanitise(items: unknown): EstimatedItem[] {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 12).map((raw) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const quantity = Number(item.quantity);
    return {
      name: String(item.name ?? "Item").trim().slice(0, 60) || "Item",
      quantity:
        Number.isFinite(quantity) && quantity > 0 && quantity <= 20
          ? Math.round(quantity * 10) / 10
          : 1,
      unit: String(item.unit ?? "serving").trim().slice(0, 24) || "serving",
      calories: clamp(item.calories, 2000),
      protein: clamp(item.protein, 200),
      carbs: clamp(item.carbs, 300),
      fat: clamp(item.fat, 200),
    };
  });
}

export async function POST(req: Request) {
  const user = await authenticatedFileSession();
  if (!user)
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isConfigured())
    return NextResponse.json(
      { error: "Storage is not configured." },
      { status: 503 },
    );
  if (!process.env.OPENAI_API_KEY)
    return NextResponse.json(
      { error: "Photo estimates are not switched on for this deployment." },
      { status: 503 },
    );

  const raw = await req.text();
  if (raw.length > 8_192)
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw || "{}") as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Malformed body." }, { status: 400 });
  }

  const fileId = typeof body.fileId === "string" ? body.fileId : "";
  const note = typeof body.description === "string" ? body.description.slice(0, 300) : "";
  if (!fileId)
    return NextResponse.json({ error: "No photo to read." }, { status: 400 });

  try {
    // Exactly the ownership checks the download route applies. A member can
    // only ever ask about a photo that is already hers.
    const claims = readPrivateFileId(fileId);
    if (!claims || !canAccessPrivateFile(user, claims) || claims.kind !== "meal-photo")
      return NextResponse.json({ error: "Photo not found." }, { status: 404 });
    const record = await readPrivateFileRecord(privateFileIdHash(fileId));
    if (
      !record ||
      record.ownerId !== claims.ownerId ||
      record.pathname !== claims.pathname
    )
      return NextResponse.json({ error: "Photo not found." }, { status: 404 });
    if (record.size > MAX_IMAGE_BYTES)
      return NextResponse.json(
        { error: "That photo is too large to read." },
        { status: 413 },
      );

    const stored = await get(claims.pathname, {
      access: "private",
      abortSignal: AbortSignal.timeout(20_000),
    });
    if (!stored || stored.statusCode !== 200 || !stored.stream)
      return NextResponse.json({ error: "Photo not found." }, { status: 404 });

    const bytes = Buffer.from(
      await new Response(stored.stream).arrayBuffer(),
    );
    const dataUrl = `data:${claims.contentType};base64,${bytes.toString("base64")}`;

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_VISION_MODEL || "gpt-5",
      store: false,
      input: [
        {
          role: "developer",
          content:
            "You identify the foods visible in a photograph of a meal and estimate typical portions. Indian home cooking is the common case: recognise roti, dal, sabzi, curd, rice, idli, dosa, poha, upma, khichdi, paneer, chole and rajma by name. Report only what you can see. Do not comment on whether the meal is healthy, balanced, sufficient or advisable, do not mention weight, diets or nutrition goals, and do not address the person. If the photo is unclear or is not food, return an empty item list with confident set to false.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: note
                ? `The member described this meal as: ${note}`
                : "Identify the foods in this photograph.",
            },
            { type: "input_image", image_url: dataUrl, detail: "low" },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "meal_photo_estimate",
          strict: true,
          schema: estimateSchema,
        },
      },
    });

    const parsed = JSON.parse(response.output_text) as {
      items?: unknown;
      confident?: unknown;
    };
    const items = sanitise(parsed.items);
    const total = items.reduce(
      (sum, item) => ({
        calories: sum.calories + item.calories,
        protein: sum.protein + item.protein,
        carbs: sum.carbs + item.carbs,
        fat: sum.fat + item.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );

    return NextResponse.json({
      items,
      // An empty list is an honest answer, and the app shows it as one rather
      // than falling back to numbers nobody stands behind.
      confident: Boolean(parsed.confident) && items.length > 0,
      // Provenance, so the app can store where the numbers came from rather
      // than only what they were.
      model: process.env.OPENAI_VISION_MODEL || "gpt-5",
      promptVersion: PROMPT_VERSION,
      ...total,
    });
  } catch (err) {
    console.error(
      "[nutrition] photo estimate failed",
      err instanceof Error ? err.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "The photo could not be read. You can enter the meal yourself." },
      { status: 503 },
    );
  }
}
