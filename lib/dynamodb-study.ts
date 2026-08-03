import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { StudyConversation } from "@/lib/study-api";

const CONVERSATIONS_TABLE =
  process.env.AI_TRIAGE_STUDY_CONVERSATIONS_TABLE ?? "ai-triage-study-conversations";

let client: DynamoDBDocumentClient | null = null;

function getClient(): DynamoDBDocumentClient {
  if (!client) {
    const region =
      process.env.AI_TRIAGE_STUDY_AWS_REGION ?? process.env.AWS_REGION ?? "ca-central-1";
    client = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return client;
}

export async function listStudyConversations(testId?: string): Promise<StudyConversation[]> {
  const items: StudyConversation[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await getClient().send(
      new ScanCommand({
        TableName: CONVERSATIONS_TABLE,
        ExclusiveStartKey: lastKey,
        ...(testId
          ? {
              FilterExpression: "test_id = :test_id",
              ExpressionAttributeValues: { ":test_id": testId },
            }
          : {}),
      }),
    );

    for (const item of result.Items ?? []) {
      items.push({
        conversation_id: String(item.conversation_id),
        test_id: String(item.test_id),
        created_at: Number(item.created_at),
        updated_at: Number(item.updated_at),
        turn_count: Number(item.turn_count ?? 0),
      });
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items.sort((a, b) => b.updated_at - a.updated_at);
}
