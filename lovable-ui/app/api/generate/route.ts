import { NextRequest } from "next/server";
import { query } from "@anthropic-ai/claude-code";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("[API] Starting code generation for prompt:", prompt);

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Async task: generate AI response
    (async () => {
      try {
        const abortController = new AbortController();
        let messageCount = 0;

        for await (const message of query({
          prompt: prompt,
          abortController: abortController,
          options: {
            maxTurns: 10,
            allowedTools: [
              "Read",
              "Write",
              "Edit",
              "MultiEdit",
              "Bash",
              "LS",
              "Glob",
              "Grep",
              "WebSearch",
              "WebFetch"
            ]
          }
        })) {
          messageCount++;
          console.log(`[API] Message ${messageCount} - Type: ${message.type}`);

          // Handle specific message types
          if ((message as any).type === "tool_use") {
            console.log(`[API] Tool use: ${(message as any).name}`);
          } else if (message.type === "result") {
            console.log(`[API] Result: ${(message as any).subtype}`);
          }

          // Send message to client
          await writer.write(
            encoder.encode(`data: ${JSON.stringify(message)}\n\n`)
          );
        }

        console.log(`[API] Generation complete. Total messages: ${messageCount}`);
        await writer.write(encoder.encode("data: [DONE]\n\n"));
      } catch (error: any) {
        console.error("[API] Error during generation:", error);
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`)
        );
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error: any) {
    console.error("[API] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
