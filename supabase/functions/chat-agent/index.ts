// supabase/functions/chat-agent/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { OpenAI } from "https://esm.sh/openai@4";

const AGENT_CONFIG = {
  baseURL: "https://api.aihubmix.com/v1",
  modelName: "gpt-5-nano",
  systemPrompt: "You are a helpful AI assistant for a React SPA website. Please answer in Chinese. Keep it concise."
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });
  }

  try {
    const { messages } = await req.json();

    // Get AI API key from environment
    const aiApiKey = Deno.env.get('AIHUBMIX_API_KEY');
    if (!aiApiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Call AI service
    const openai = new OpenAI({
      apiKey: aiApiKey,
      baseURL: AGENT_CONFIG.baseURL,
    });

    const response = await openai.chat.completions.create({
      model: AGENT_CONFIG.modelName,
      stream: true,
      messages: [
        { role: 'system', content: AGENT_CONFIG.systemPrompt },
        ...messages
      ],
      temperature: 0.7,
    });

    // Stream response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          console.error('Stream error:', err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
