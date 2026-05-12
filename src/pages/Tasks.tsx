import { useEffect, useState } from "react";
import { Badge } from "../components/ui/badge";
import { CheckCircle2, Circle, Clock, Filter, Loader2 } from "lucide-react";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db, auth, OperationType, handleFirestoreError } from "../lib/firebase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

export function Tasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    async function fetchTasks() {
      if (!auth.currentUser) return;
      try {
        const q = query(
          collection(db, "tasks"), 
          where("ownerId", "==", auth.currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        const t: any[] = [];
        // fetch meeting names manually if needed or just use id
        querySnapshot.forEach((document) => {
          t.push({ id: document.id, ...document.data() });
        });
        
        // Priority ranking: Critical > High > Medium > Low
        const priorityOrder: Record<string, number> = { "Critical": 4, "High": 3, "Medium": 2, "Low": 1 };
        
        setTasks(t.sort((a,b) => {
           const pA = priorityOrder[a.priority] || 0;
           const pB = priorityOrder[b.priority] || 0;
           if (pA !== pB) return pB - pA;
           const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
           const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
           return bTime - aTime;
        }));
      } catch (error) {
         handleFirestoreError(error, OperationType.LIST, "tasks");
      } finally {
        setLoading(false);
      }
    }
    
    fetchTasks();
    const unsub = auth.onAuthStateChanged((user) => {
       if (user) fetchTasks();
    });
    return () => unsub();
  }, []);

  const handleStatusToggle = async (task: any) => {
    const statuses = ["Pending", "In Progress", "Completed"];
    const currentIndex = statuses.indexOf(task.status || "Pending");
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];

    // Optimistically update UI
    setTasks(current => 
      current.map(t => t.id === task.id ? { ...t, status: nextStatus } : t)
    );

    try {
      const taskRef = doc(db, "tasks", task.id);
      await updateDoc(taskRef, { status: nextStatus });
    } catch (error) {
      console.error("Failed to update status", error);
      // Revert optimistic update by handling error
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  if (loading) {
     return <div className="p-12 flex justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  const filteredTasks = tasks.filter(t => statusFilter === "All" || t.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Prioritized Tasks</h1>
          <p className="text-slate-400 mt-1">Smart ranking based on urgency, workload, and deadlines.</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<button className="flex items-center gap-2 px-4 py-2 bg-[#111827] border border-slate-700 rounded-lg text-sm hover:bg-slate-800 transition-colors" />}>
            <Filter className="w-4 h-4" /> Filter: {statusFilter}
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-slate-900 border-slate-700 text-slate-200">
            <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
              <DropdownMenuRadioItem value="All">All</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="Pending">Pending</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="In Progress">In Progress</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="Completed">Completed</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-800/50 text-slate-400 uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Task</th>
                <th className="px-6 py-4 font-medium">Assignee</th>
                <th className="px-6 py-4 font-medium">Priority</th>
                <th className="px-6 py-4 font-medium">Meeting ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredTasks.length === 0 && (
                <tr>
                   <td colSpan={5} className="px-6 py-12 text-center text-slate-400">No tasks found. Process a meeting to extract tasks.</td>
                </tr>
              )}
              {filteredTasks.map(t => (
                <tr key={t.id} className="hover:bg-slate-800/20 transition-colors group">
                  <td className="px-6 py-4 cursor-pointer" onClick={() => handleStatusToggle(t)}>
                    {t.status === "Completed" ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : t.status === "In Progress" ? (
                      <Clock className="w-5 h-5 text-blue-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-500 group-hover:text-slate-400" />
                    )}
                  </td>
                  <td className="px-6 py-4 font-medium text-white">{t.title}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <div className="w-6 h-6 rounded-full bg-slate-700 text-[10px] flex items-center justify-center font-bold">{(t.assignee || "?")[0]}</div>
                       <span className="text-slate-300">{t.assignee}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className={`
                      ${t.priority === 'Critical' ? 'border-red-500/30 text-red-400 bg-red-400/10' : ''}
                      ${t.priority === 'High' ? 'border-orange-500/30 text-orange-400 bg-orange-400/10' : ''}
                      ${t.priority === 'Medium' ? 'border-blue-500/30 text-blue-400 bg-blue-400/10' : ''}
                      ${t.priority === 'Low' ? 'border-slate-500/30 text-slate-400 bg-slate-400/10' : ''}
                    `}>
                      {t.priority}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                    {t.meetingId ? t.meetingId.substring(0, 8) + '...' : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
