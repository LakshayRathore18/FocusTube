// TEMP: manual test route, delete once transcript pipeline is validated

import { NextRequest, NextResponse } from "next/server";
import { getTranscript } from "@/lib/transcript";

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId");

  if (!videoId) {
    return NextResponse.json(
      { error: 'Missing "videoId" query parameter' },
      { status: 400 }
    );
  }

  const result = await getTranscript(videoId);

  if (!result.success) {
    return NextResponse.json({
      success: false,
      reason: result.reason,
    });
  }

  return NextResponse.json({
    success: true,
    transcriptLength: result.transcript.length,
    preview: result.transcript.slice(0, 300),
  });
}
