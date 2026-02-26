/**
 * Transcription API route for ChatKit voice dictation
 *
 * POST /api/transcribe - Transcribe audio using OpenAI Whisper API
 *
 * Accepts audio in base64 format, transcribes it using gpt-4o-transcribe,
 * and returns the transcribed text. Requires Outseta authentication.
 */

import { authenticateRequest, errorResponse, jsonResponse } from "@/lib/auth/middleware";

export const runtime = "edge";

export async function POST(request: Request): Promise<Response> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return errorResponse("Missing OPENAI_API_KEY", 500, "MISSING_API_KEY");
  }

  // Authenticate
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return errorResponse(auth.error, auth.status, "UNAUTHORIZED");
  }

  try {
    const body = await request.json();
    const { audio_base64, mime_type } = body as { audio_base64?: string; mime_type?: string };

    if (!audio_base64 || !mime_type) {
      return errorResponse("Missing audio_base64 or mime_type", 400, "MISSING_FIELDS");
    }

    // Decode base64 audio
    const binaryStr = atob(audio_base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Determine file extension from mime type
    const mediaType = mime_type.split(";")[0];
    const extMap: Record<string, string> = {
      "audio/webm": "webm",
      "audio/mp4": "m4a",
      "audio/ogg": "ogg",
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
    };
    const ext = extMap[mediaType] ?? "webm";

    // Build multipart form for OpenAI transcription API
    const formData = new FormData();
    formData.append("file", new Blob([bytes], { type: mime_type }), `audio.${ext}`);
    formData.append("model", "gpt-4o-transcribe");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiApiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Transcription API error:", errorData);
      return errorResponse("Transcription failed", 502, "TRANSCRIPTION_ERROR");
    }

    const result = await response.json() as { text: string };
    return jsonResponse({ text: result.text });
  } catch (error) {
    console.error("Transcribe route error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(`Transcription failed: ${message}`, 500, "INTERNAL_ERROR");
  }
}
