
import React, { useState, useRef, useEffect } from 'react';
import { useODT } from './ODTContext';
import { Icons } from './constants';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const HelpChatbot: React.FC = () => {
  const { user } = useODT();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '¡Hola! Soy el Asistente Virtual de APC System. ¿En qué puedo ayudarte hoy?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!user) return null;

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const systemInstruction = `
        Eres el Asistente Virtual de APC System, una plataforma de gestión de proyectos regida por la norma ISO 9001. Tu objetivo es ayudar al usuario a usar la plataforma.
        El usuario con el que estás hablando tiene el rol de: ${user.role}.
        
        Reglas de tu respuesta:
        - Responde SIEMPRE basándote en los permisos de SU rol. No le expliques funcionalidades a las que no tiene acceso (ej. no le expliques facturación a un diseñador).
        - Respuestas cortas, directas y en formato de viñetas si son pasos a seguir.
        - Si el usuario pregunta cómo avanzar una ODT y es operativo, recuérdale que debe subir sus enlaces y dejar un comentario antes de pulsar "Enviar a Corrección".
        - Si es de Cuentas, recuérdale que el cliente y el brief inicial son su responsabilidad.
        - Si es Líder, explícale cómo delegar en la Bandeja de Entrada o en la Caja de QA.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })),
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      const aiResponse = response.text || "Lo siento, no pude procesar tu solicitud.";
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    } catch (error) {
      console.error("Chatbot error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Hubo un error al conectar con el asistente. Por favor, intenta de nuevo." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[3000]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="absolute bottom-20 right-0 w-80 md:w-96 h-[500px] bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-apc-green p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white">
                  <Icons.Ai className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-black text-xs uppercase tracking-widest">Copiloto APC</h3>
                  <p className="text-white/60 text-[8px] font-bold uppercase">Soporte Contextual</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 custom-scrollbar"
            >
              {messages.map((m, i) => (
                <div 
                  key={i} 
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[85%] p-3 rounded-2xl text-[11px] leading-relaxed ${
                      m.role === 'user' 
                        ? 'bg-apc-pink text-white rounded-tr-none shadow-md' 
                        : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none shadow-sm'
                    }`}
                  >
                    <div className="markdown-body">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                      <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-slate-100">
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Escribe tu duda aquí..."
                  className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-apc-green transition-all"
                />
                <button 
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="bg-apc-green text-white p-2 rounded-xl hover:bg-emerald-600 transition-all disabled:opacity-50"
                >
                  <Icons.Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>
              <p className="text-[8px] text-slate-400 text-center mt-2 font-bold uppercase tracking-widest">
                IA entrenada bajo normas ISO 9001
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all ${
          isOpen ? 'bg-slate-900 text-white' : 'bg-apc-green text-white'
        }`}
      >
        {isOpen ? <Icons.X className="w-6 h-6" /> : <Icons.MessageCircle className="w-6 h-6" />}
      </motion.button>
    </div>
  );
};

export default HelpChatbot;
