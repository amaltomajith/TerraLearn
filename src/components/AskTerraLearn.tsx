import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, User, Sparkles, Loader2, MapPin, Leaf } from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { toast } from 'sonner';

export interface CropContextData {
  crop: string;
  plantingDate: string;
  yieldEstimate: number;
  viabilityScore: number;
  profit: number;
}

export interface AskTerraLearnProps {
  position: { lat: number; lng: number } | null;
  cropContext?: CropContextData | null;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export function AskTerraLearn({ position, cropContext }: AskTerraLearnProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello! I am your TerraLearn AI Environmental Assistant. Ask me any question about climate, rainfall trends, air quality, or crop viability for your selected location.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (questionText?: string) => {
    const textToSend = questionText || input.trim();
    if (!textToSend || isLoading) return;

    if (!position) {
      toast.error('Please drop a pin on the map first to select a location.');
      return;
    }

    const userMsgId = Date.now().toString();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, sender: 'user', text: textToSend, timestamp },
    ]);
    if (!questionText) setInput('');
    setIsLoading(true);

    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

    try {
      let response: Response | null = null;
      try {
        response = await fetch(`${baseUrl}/api/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: textToSend,
            lat: position.lat,
            lng: position.lng,
            cropContext: cropContext || undefined,
          }),
        });
      } catch {
        // Fallback between localhost and 127.0.0.1 if default fails
        const fallbackUrl = baseUrl.includes('127.0.0.1')
          ? 'http://localhost:8000'
          : 'http://127.0.0.1:8000';
        response = await fetch(`${fallbackUrl}/api/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: textToSend,
            lat: position.lat,
            lng: position.lng,
            cropContext: cropContext || undefined,
          }),
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const replyText = data.answer || 'No response generated.';

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (error) {
      console.error('Error querying backend:', error);
      toast.error('Failed to communicate with TerraLearn AI backend.');
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: `Unable to connect to the assistant server at ${baseUrl}. Ensure the FastAPI backend is running via 'uvicorn app.main:app --reload'.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const samplePrompts = [
    'How is the climate trend here for farming?',
    'Is current air quality safe for outdoor crop work?',
    'What weather risks exist for this location?',
  ];

  return (
    <div className="bg-card rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-border/60 flex flex-col h-[520px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              Ask TerraLearn AI
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            </h3>
            <p className="text-xs text-muted-foreground">
              LangChain powered environmental & crop advice
            </p>
          </div>
        </div>

        {/* Badges for active context */}
        <div className="flex items-center gap-2">
          {position && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono bg-muted/40 px-2.5 py-1 rounded-md text-muted-foreground">
              <MapPin className="w-3 h-3 text-primary" />
              {position.lat.toFixed(2)}°, {position.lng.toFixed(2)}°
            </span>
          )}
          {cropContext && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-md">
              <Leaf className="w-3 h-3" />
              {cropContext.crop} ({cropContext.viabilityScore}% score)
            </span>
          )}
        </div>
      </div>

      {/* Message List */}
      <ScrollArea className="flex-1 py-4 pr-3">
        <div className="space-y-4 pr-2">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0 mt-0.5 text-primary">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-primary text-primary-foreground font-medium rounded-tr-xs'
                      : 'bg-muted/40 dark:bg-muted/20 border border-border/40 text-foreground rounded-tl-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  <span
                    className={`block text-[10px] mt-1.5 font-mono ${
                      msg.sender === 'user' ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground'
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center shrink-0 mt-0.5 text-accent-foreground">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3 items-center text-xs text-muted-foreground"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-muted/40 rounded-2xl px-4 py-2.5 border border-border/40 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-primary animate-ping" />
                Analyzing climate & air quality data...
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Suggested prompts if few messages */}
      {messages.length <= 2 && (
        <div className="flex items-center gap-2 py-2 overflow-x-auto scrollbar-none">
          {samplePrompts.map((promptText, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(promptText)}
              className="text-xs bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full whitespace-nowrap transition-colors border border-border/40"
            >
              {promptText}
            </button>
          ))}
        </div>
      )}

      {/* Input Box */}
      <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="pt-3 border-t border-border/50 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={position ? 'Ask about climate, AQI, or farming risks...' : 'Drop a pin on map to enable AI assistant'}
          disabled={isLoading}
          className="flex-1 h-11 rounded-xl border border-border/60 bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all disabled:opacity-50"
        />
        <Button
          type="submit"
          disabled={!input.trim() || isLoading || !position}
          className="h-11 px-4 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 shadow-sm"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  );
}
