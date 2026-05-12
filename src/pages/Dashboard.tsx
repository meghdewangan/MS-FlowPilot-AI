import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { CheckCircle2, Clock, ListTodo, AlertCircle, FileText, Loader2 } from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, auth, OperationType, handleFirestoreError } from "../lib/firebase";
import { Link } from "react-router-dom";

export function Dashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!auth.currentUser) {
        setLoading(false);
        return;
      }
      try {
        const uId = auth.currentUser.uid;
        // Fetch Meetings
        const mQ = query(collection(db, "meetings"), where("ownerId", "==", uId));
        const mSnap = await getDocs(mQ);
        const fetchedMeetings: any[] = [];
        mSnap.forEach((doc) => fetchedMeetings.push({ id: doc.id, ...doc.data() }));
        setMeetings(fetchedMeetings);

        // Fetch Tasks
        const tQ = query(collection(db, "tasks"), where("ownerId", "==", uId));
        const tSnap = await getDocs(tQ);
        const fetchedTasks: any[] = [];
        tSnap.forEach((doc) => fetchedTasks.push({ id: doc.id, ...doc.data() }));
        
        // Priority ranking: Critical > High > Medium > Low
        const priorityOrder: Record<string, number> = { "Critical": 4, "High": 3, "Medium": 2, "Low": 1 };
        fetchedTasks.sort((a,b) => {
           const pA = priorityOrder[a.priority] || 0;
           const pB = priorityOrder[b.priority] || 0;
           if (pA !== pB) return pB - pA;
           const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
           const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
           return bTime - aTime;
        });

        setTasks(fetchedTasks);
      } catch (error) {
         handleFirestoreError(error, OperationType.LIST, "dashboard");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    const unsub = auth.onAuthStateChanged((user) => {
       if (user) fetchData();
    });
    return () => unsub();
  }, []);

  const tasksCompleted = tasks.filter(t => t.status === "Completed").length;
  const pendingPriority = tasks.filter(t => t.status !== "Completed" && (t.priority === "High" || t.priority === "Critical")).length;
  const meetingsSummarized = meetings.length;
  const hoursSaved = (meetingsSummarized * 0.5 + tasksCompleted * 0.25).toFixed(1);

  const priorityTasks = tasks.filter(t => t.status !== "Completed").slice(0, 4);

  if (loading) {
    return <div className="flex justify-center p-12 text-slate-400"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Today at a Glance</h1>
        <p className="text-slate-400 mt-1">Here is what's happening with your team.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Tasks Completed" value={tasksCompleted.toString()} icon={CheckCircle2} color="text-green-400" />
        <MetricCard title="Pending Priority" value={pendingPriority.toString()} icon={AlertCircle} color="text-red-400" />
        <MetricCard title="Hours Saved (Est.)" value={hoursSaved.toString()} icon={Clock} color="text-blue-400" />
        <MetricCard title="Meetings Summarized" value={meetingsSummarized.toString()} icon={FileText} color="text-violet-400" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 bg-[#111827] border-slate-800 text-white">
          <CardHeader>
            <CardTitle>Overview & Recaps</CardTitle>
          </CardHeader>
          <CardContent>
            {meetings.length === 0 && tasks.length === 0 ? (
               <div className="text-center p-8 text-slate-400 border border-slate-800 border-dashed rounded-lg">
                 No data available yet. Process some meetings to get insights!
               </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700">
                  <h3 className="font-semibold text-blue-400 mb-2">Recent Meetings</h3>
                  <p className="text-slate-300 text-sm">
                    {meetings.length > 0 ? `You have processed ${meetings.length} meeting(s) so far. The latest is "${meetings[0]?.title}".` : "No meetings summarized yet."}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700">
                  <h3 className="font-semibold text-green-400 mb-2">Task Progress</h3>
                  <p className="text-slate-300 text-sm">
                    You have {tasks.length} total tasks, and have completed {tasksCompleted} of them. 
                    {pendingPriority > 0 ? ` Focus on your ${pendingPriority} high-priority pending items.` : ' Great job keeping up with priority items!'}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700">
                  <h3 className="font-semibold text-red-400 mb-2">Upcoming Focus</h3>
                  <p className="text-slate-300 text-sm">
                    {priorityTasks.length > 0 ? `Your next highest priority is "${priorityTasks[0]?.title}". Check the Action Items panel to handle it.` : "No pending items on your plate right now. You are all caught up!"}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="col-span-3 bg-[#111827] border-slate-800 text-white flex flex-col">
          <CardHeader>
            <CardTitle>Priority Action Items</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="space-y-4 flex-1">
               {priorityTasks.length === 0 ? (
                 <div className="text-center p-6 text-slate-400 text-sm border border-slate-800 border-dashed rounded-lg">
                   No pending tasks!
                 </div>
               ) : (
                 priorityTasks.map((task) => (
                   <div key={task.id} className="flex justify-between items-center p-3 rounded-md bg-slate-800/30 border border-slate-800">
                     <div className="flex items-center gap-3 overflow-hidden">
                       <div className={`shrink-0 w-2 h-2 rounded-full ${
                         task.priority === 'Critical' ? 'bg-red-500' :
                         task.priority === 'High' ? 'bg-orange-500' :
                         task.priority === 'Medium' ? 'bg-blue-500' : 'bg-slate-500'
                       }`}></div>
                       <span className="text-sm truncate" title={task.title}>{task.title}</span>
                     </div>
                     <span className={`text-xs px-2 py-1 flex-shrink-0 rounded ${
                       task.priority === 'Critical' ? 'text-red-400 bg-red-400/10' :
                       task.priority === 'High' ? 'text-orange-400 bg-orange-400/10' :
                       task.priority === 'Medium' ? 'text-blue-400 bg-blue-400/10' : 'text-slate-400 bg-slate-400/10'
                     }`}>
                       {task.priority || 'Medium'}
                     </span>
                   </div>
                 ))
               )}
            </div>
            
            <Link to="/tasks" className="w-full mt-6 flex items-center justify-center gap-2 py-2 px-4 rounded-md border border-slate-700 text-sm hover:bg-slate-800 text-slate-200 transition-colors">
              <ListTodo className="w-4 h-4" /> View All Tasks
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({ title, value, icon: Icon, color }: any) {
  return (
    <Card className="bg-[#111827] border-slate-800 text-white">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-400">{title}</CardTitle>
        <Icon className={`w-4 h-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}
