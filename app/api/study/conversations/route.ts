import { listStudyConversations } from "@/lib/dynamodb-study";
import { TEST_ID_PATTERN } from "@/lib/study-api";

export async function GET(request: Request): Promise<Response> {
  const testId = new URL(request.url).searchParams.get("test_id")?.trim();

  if (testId && !TEST_ID_PATTERN.test(testId)) {
    return Response.json({ detail: "Invalid test_id" }, { status: 400 });
  }

  try {
    const conversations = await listStudyConversations(testId || undefined);
    return Response.json(conversations);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list conversations";
    return Response.json({ detail: message }, { status: 500 });
  }
}
