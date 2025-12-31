import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, Send, Loader2, Bot, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const AGENT_CONFIG = {
  baseURL: "https://api.aihubmix.com/v1",
  modelName: "gpt-5-nano",
  systemPrompt: "You are a helpful AI assistant for a React SPA website. Please answer in Chinese. Keep it concise."
};

export function ChatBubble() {
  const AIHUBMIX_API_KEY = import.meta.env.VITE_AIHUBMIX_API_KEY;

  // Don't render if no API key
  if (!AIHUBMIX_API_KEY) {
    return null;
  }

  const [isOpen, setIsOpen] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ id: string; role: string; content: string }>>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input?.trim() || isLoading) return;

    const userMessage = { id: Date.now().toString(), role: "user" as const, content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${AGENT_CONFIG.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AIHUBMIX_API_KEY}`,
        },
        body: JSON.stringify({
          model: AGENT_CONFIG.modelName,
          stream: true,
          messages: [
            { role: 'system', content: AGENT_CONFIG.systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: input }
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      // Create assistant message with empty content
      const assistantId = (Date.now() + 1).toString();
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      // Parse the stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader?.read() ?? { done: true, value: undefined };
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId ? { ...msg, content: msg.content + content } : msg
                )
              );
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "请求失败");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      {isOpen && (
        <Card className="w-[380px] h-[520px] shadow-2xl flex flex-col animate-in slide-in-from-bottom-2 fade-in duration-300">
          <CardHeader className="p-4 border-b bg-muted/40 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              <span className="text-sm font-semibold">AI Assistant</span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>

          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea ref={scrollAreaRef} className="h-full p-4">
              <div className="flex flex-col gap-3">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>你好！有什么可以帮助你的吗？</p>
                  </div>
                )}

                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex gap-2 max-w-[90%] text-sm animate-in slide-in-from-bottom-1 duration-200",
                      m.role === "user" ? "ml-auto flex-row-reverse" : ""
                    )}
                  >
                    <div
                      className={cn(
                        "p-3 rounded-2xl break-words",
                        m.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}

                {isLoading && messages.filter(m => m.role === "assistant").length === 0 && (
                  <div className="flex gap-2 text-sm">
                    <div className="bg-muted p-3 rounded-2xl rounded-bl-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="break-words">{error}</span>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>

          <CardFooter className="p-3 pt-0 border-t">
            <form onSubmit={handleSubmit} className="flex w-full gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入消息..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={isLoading || !input?.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}

      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="icon"
        className="h-14 w-14 rounded-full shadow-lg hover:scale-105 transition-transform"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </Button>
    </div>
  );
}
