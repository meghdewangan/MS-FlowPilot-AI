import { Outlet, Link, useLocation } from "react-router-dom";
import { Sparkles, Calendar, CheckSquare, MessageSquare, Menu, LayoutDashboard } from "lucide-react";
import { useEffect } from "react";
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useState } from "react";

export function AppLayout() {
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  
  useEffect(() => {
    document.documentElement.classList.add('dark');
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return unsub;
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        console.log('Login popup closed by user.');
        return;
      }
      console.error('Error signing in: ', error);
      alert('Error signing in. Please try again.');
    }
  };

  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Meetings", path: "/meetings", icon: Calendar },
    { name: "Tasks", path: "/tasks", icon: CheckSquare },
    { name: "AI Assistant", path: "/assistant", icon: MessageSquare },
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center text-white p-4">
        <div className="w-20 h-20 bg-gradient-to-tr from-blue-500 to-violet-500 rounded-full flex items-center justify-center mb-8 shadow-lg shadow-blue-500/20">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-500 mb-6 text-center">
          FlowPilot AI
        </h1>
        <p className="text-lg text-slate-400 mb-10 max-w-lg text-center leading-relaxed">
          The team productivity operating system. Turn chaotic meetings into structured tasks, automatically.
        </p>
        <button 
          onClick={handleLogin}
          className="bg-white text-slate-900 px-8 py-3 rounded-full font-medium hover:bg-slate-100 transition-colors flex items-center gap-2"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-[#111827] border-r border-slate-800 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-violet-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">FlowPilot</span>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive 
                  ? 'bg-blue-500/10 text-blue-400' 
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-800/50 rounded-lg transition-colors"
               onClick={() => auth.signOut()}>
            <img src={user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName}`} alt="avatar" className="w-8 h-8 rounded-full border border-slate-700" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.displayName}</p>
              <p className="text-xs text-slate-500 truncate">Sign out</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
