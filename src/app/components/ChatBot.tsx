import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, MessageCircle, Info, FileText, Megaphone, Headphones, Send, ChevronDown, Loader2, Maximize2, Minimize2, Bot } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { apiChatBot, type ChatMessage, type ChatSection as APIChatSection } from "../lib/api";

// ── Renderizador Markdown mínimo (sin dependencias externas) ────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      nodes.push(<ul key={key++} className="my-1 space-y-0.5 pl-4 list-disc">{listItems}</ul>);
      listItems = [];
    }
  };

  const parseInline = (raw: string): React.ReactNode => {
    // **bold**
    const parts = raw.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : part
    );
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      listItems.push(<li key={key++}>{parseInline(trimmed.slice(2))}</li>);
    } else {
      flushList();
      if (trimmed === "") {
        nodes.push(<br key={key++} />);
      } else {
        nodes.push(<p key={key++} className="leading-snug">{parseInline(trimmed)}</p>);
      }
    }
  }
  flushList();
  return nodes;
}
// ────────────────────────────────────────────────────────────────────────────

type ChatSection = "menu" | "info" | "documentos" | "comunicados" | "atencion";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

const menuOptions = [
  {
    id: "info" as ChatSection,
    icon: Info,
    label: "Información",
    color: "bg-[#1e3a5f] hover:bg-[#2a4a6f]",
    description: "Información general sobre la universidad",
  },
  {
    id: "documentos" as ChatSection,
    icon: FileText,
    label: "Documentos",
    color: "bg-[#8B5CF6] hover:bg-[#7C3AED]",
    description: "Acceso a documentos y formularios",
  },
  {
    id: "comunicados" as ChatSection,
    icon: Megaphone,
    label: "Comunicados",
    color: "bg-[#10B981] hover:bg-[#059669]",
    description: "Últimos comunicados institucionales",
  },
  {
    id: "atencion" as ChatSection,
    icon: Headphones,
    label: "Atención",
    color: "bg-[#ff9800] hover:bg-[#f57c00]",
    description: "Asistente virtual de atención al cliente",
  },
];

export function ChatBot() {
  // "closed" → cerrado | "input" → solo barra de input | "chat" → panel completo
  const [stage, setStage] = useState<"closed" | "input" | "chat">("closed");
  const [currentSection] = useState<ChatSection>("atencion");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isModal, setIsModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Permite que componentes externos abran el chat via: window.dispatchEvent(new CustomEvent('open-chatbot'))
  useEffect(() => {
    const handler = () => {
      if (stage === "closed") setStage("input");
    };
    window.addEventListener("open-chatbot", handler);
    return () => window.removeEventListener("open-chatbot", handler);
  }, [stage]);

  // Foco automático al abrir la barra de input
  useEffect(() => {
    if (stage === "input") {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [stage]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  const handleToggle = () => {
    if (stage !== "closed") {
      setStage("closed");
      setMessages([]);
      setInputMessage("");
      setIsModal(false);
    } else {
      setStage("input");
    }
  };

  /** Convierte el historial de Message[] al formato que espera la API */
  const buildHistory = (msgs: Message[]): ChatMessage[] =>
    msgs.map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      text: m.text,
    }));

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: "user",
      timestamp: new Date(),
    };

    // Si es el primer mensaje → expandir al panel completo
    const isFirstMessage = messages.length === 0;
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputMessage("");
    setIsLoading(true);
    if (isFirstMessage) setStage("chat");
    scrollToBottom();

    try {
      const apiSection: APIChatSection = currentSection !== "menu" ? (currentSection as APIChatSection) : "atencion";
      const { reply } = await apiChatBot(
        userMessage.text,
        apiSection,
        buildHistory(updatedMessages),
      );
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: reply,
          sender: "bot",
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: "Lo siento, no pude procesar tu solicitud en este momento. Por favor intenta de nuevo o comunícate a soporte@uniautonoma.edu.co.",
          sender: "bot",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  const sectionColor =
    currentSection === "info" ? "from-[#1e3a5f] to-[#2a4a6f]" :
    currentSection === "documentos" ? "from-[#8B5CF6] to-[#7C3AED]" :
    currentSection === "comunicados" ? "from-[#10B981] to-[#059669]" :
    "from-[#ff9800] to-[#f57c00]";

  const isOpen = stage !== "closed";

  return (
    <>
      {/* ── Botón flotante ─────────────────────────────────────────── */}
      <motion.div
        className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-50"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <Button
          onClick={handleToggle}
          size="icon"
          className="h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-2xl bg-gradient-to-br from-[#ff9800] to-[#f57c00] hover:from-[#f57c00] hover:to-[#e65100] border-2 border-white"
          aria-label="Abrir asistente"
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </motion.div>
            ) : (
              <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </motion.div>

      {/* ── Barra de input minimalista (stage = "input") ────────────── */}
      <AnimatePresence>
        {stage === "input" && (
          <motion.div
            key="input-bar"
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed bottom-20 sm:bottom-24 left-4 sm:left-6 z-40 w-[calc(100vw-2rem)] sm:w-96"
          >
            <div className={`bg-gradient-to-r ${sectionColor} rounded-2xl shadow-2xl p-1`}>
              <div className="bg-white rounded-xl px-3 py-2.5 flex items-center gap-2">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-[#ff9800] to-[#f57c00] flex items-center justify-center shadow">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <Input
                  ref={inputRef}
                  placeholder="¿En qué puedo ayudarte?"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  className="border-0 shadow-none focus-visible:ring-0 text-sm bg-transparent px-1 h-8"
                />
                <Button
                  size="icon"
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-[#ff9800] to-[#f57c00] hover:from-[#f57c00] hover:to-[#e65100] border-0 shadow"
                >
                  {isLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Send className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Panel de chat completo (stage = "chat") ─────────────────── */}
      <AnimatePresence>
        {stage === "chat" && (
          <>
            {/* Backdrop modal */}
            {isModal && (
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                onClick={() => setIsModal(false)}
              />
            )}

            <motion.div
              key="chat-panel"
              initial={{ opacity: 0, scale: 0.9, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 24 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className={
                isModal
                  ? "fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                  : "fixed bottom-20 sm:bottom-24 left-4 sm:left-6 z-40 w-[calc(100vw-2rem)] sm:w-96"
              }
              style={isModal ? undefined : { maxHeight: "calc(100vh - 14rem)" }}
            >
              <Card
                className="shadow-2xl flex flex-col overflow-hidden pointer-events-auto rounded-2xl border-0"
                style={
                  isModal
                    ? { width: "min(720px, calc(100vw - 2rem))", height: "min(82vh, 720px)" }
                    : { maxHeight: "calc(100vh - 14rem)" }
                }
              >
                {/* Header con gradiente */}
                <CardHeader className={`flex-shrink-0 bg-gradient-to-r ${sectionColor} text-white px-4 py-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center">
                        {currentSection === "info" && <Info className="h-4 w-4" />}
                        {currentSection === "documentos" && <FileText className="h-4 w-4" />}
                        {currentSection === "comunicados" && <Megaphone className="h-4 w-4" />}
                        {currentSection === "atencion" && <Headphones className="h-4 w-4" />}
                      </div>
                      <div>
                        <CardTitle className="text-white text-sm font-semibold leading-tight">
                          {currentSection === "info" && "Información"}
                          {currentSection === "documentos" && "Documentos"}
                          {currentSection === "comunicados" && "Comunicados"}
                          {currentSection === "atencion" && "Asistente Virtual"}
                        </CardTitle>
                        <p className="text-white/70 text-xs leading-tight">
                          {menuOptions.find(o => o.id === currentSection)?.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsModal(prev => !prev)}
                        className="h-8 w-8 text-white hover:bg-white/20 rounded-lg"
                        aria-label={isModal ? "Minimizar" : "Expandir al centro"}
                      >
                        {isModal ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setStage("closed")}
                        className="h-8 w-8 text-white hover:bg-white/20 rounded-lg"
                        aria-label="Cerrar"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0 flex flex-col flex-1 min-h-0 bg-white">
                  {/* Área de mensajes */}
                  <div
                    className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50/60"
                    style={{ scrollbarWidth: "thin", scrollbarColor: "#d1d5db transparent" }}
                  >
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`flex items-end gap-2 ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {message.sender === "bot" && (
                          <div className={`flex-shrink-0 h-7 w-7 rounded-full bg-gradient-to-br ${sectionColor} flex items-center justify-center shadow-sm`}>
                            <Bot className="h-3.5 w-3.5 text-white" />
                          </div>
                        )}
                        <div
                          className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                            message.sender === "user"
                              ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-sm"
                              : "bg-white border border-gray-100 text-gray-800 rounded-bl-sm"
                          }`}
                        >
                          {message.sender === "bot" ? (
                            <div className="text-xs sm:text-sm leading-relaxed space-y-1">
                              {renderMarkdown(message.text)}
                            </div>
                          ) : (
                            <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-line">{message.text}</p>
                          )}
                          <p className={`text-[10px] mt-1.5 ${message.sender === "user" ? "text-blue-200 text-right" : "text-gray-400"}`}>
                            {message.timestamp.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </motion.div>
                    ))}

                    {isLoading && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-2 justify-start">
                        <div className={`flex-shrink-0 h-7 w-7 rounded-full bg-gradient-to-br ${sectionColor} flex items-center justify-center shadow-sm`}>
                          <Bot className="h-3.5 w-3.5 text-white" />
                        </div>
                        <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
                        </div>
                      </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="p-3 border-t border-gray-100 bg-white">
                    <div className="flex gap-2 items-center">
                      <Input
                        placeholder="Escribe tu mensaje..."
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                        className="text-sm rounded-xl border-gray-200 focus-visible:ring-1 focus-visible:ring-orange-400"
                        disabled={isLoading}
                      />
                      <Button
                        size="icon"
                        onClick={handleSendMessage}
                        disabled={!inputMessage.trim() || isLoading}
                        className={`shrink-0 h-9 w-9 rounded-xl bg-gradient-to-br ${sectionColor} hover:opacity-90 border-0 shadow`}
                      >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}