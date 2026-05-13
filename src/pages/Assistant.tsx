import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { chatAboutMeetings } from "../lib/gemini";
import { Button } from "../components/ui/button";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import Markdown from "react-markdown";

export function Assistant() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi! I am FlowPilot AI. I remember everything from your team's past meetings. Ask me what we discussed last week, what your urgent tasks are, or who is responsible for a project." }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    try {
      let pastContext = "Here is the user's past meetings and tasks data:\n\n";
      
      if (auth.currentUser) {
        pastContext += "MEETINGS:\n";
        const mQuery = query(collection(db, "meetings"), where("ownerId", "==", auth.currentUser.uid));
        const mSnapshot = await getDocs(mQuery);
        mSnapshot.forEach(doc => {
          const data = doc.data();
          const dateStr = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : 'Unknown';
          pastContext += `- Meeting: ${data.title} (Date: ${dateStr}). Summary: ${data.summary}\n`;
        });

        pastContext += "\nTASKS:\n";
        const tQuery = query(collection(db, "tasks"), where("ownerId", "==", auth.currentUser.uid));
        const tSnapshot = await getDocs(tQuery);
        tSnapshot.forEach(doc => {
          const data = doc.data();
          pastContext += `- Task: ${data.title}. Assignee: ${data.assignee}. Priority: ${data.priority}. Status: ${data.status}\n`;
        });
      } else {
         pastContext = "No user context available. Tell the user to please sign in.";
      }

      const answer = await chatAboutMeetings(userMsg, pastContext);
      
      setMessages(prev => [...prev, { role: "assistant", text: answer || "I couldn't find an answer." }]);
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, { role: "assistant", text: `Oops, an error occurred: ${err.message}. If you deployed this app to Netlify, keep in mind Netlify only hosts the frontend by default, so the backend API is missing!` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-w-4xl mx-auto bg-[#111827] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-violet-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-semibold text-white">FlowPilot Knowledge Base</h2>
          <p className="text-xs text-blue-400">Powered by Gemini AI</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
                <Bot className="w-4 h-4 text-blue-400" />
              </div>
            )}
            <div className={`p-4 rounded-2xl max-w-[80%] ${
              m.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none leading-relaxed'
            }`}>
              {m.role === 'user' ? (
                m.text
              ) : (
                <div className="[&>p]:mb-2 [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4 [&_strong]:text-white">
                  <Markdown>{m.text}</Markdown>
                </div>
              )}
            </div>
            {m.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
                <User className="w-4 h-4 text-slate-400" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-4 justify-start animate-pulse">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
              <Bot className="w-4 h-4 text-blue-400" />
            </div>
            <div className="p-4 rounded-2xl bg-slate-800 text-slate-400 border border-slate-700 rounded-tl-none">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <form onSubmit={handleSend} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about past meetings or decisions..."
            className="flex-1 bg-slate-800 border items-center border-slate-700 rounded-full px-6 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
          />
          <Button type="submit" disabled={loading} className="rounded-full w-12 h-12 p-0 bg-blue-600 hover:bg-blue-700 flex items-center justify-center shrink-0">
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </div>
    </div>
  )
}
