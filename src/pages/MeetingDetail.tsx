import { ArrowLeft, Clock, Users, ArrowRight } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { useEffect, useState } from "react";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db, auth, OperationType, handleFirestoreError } from "../lib/firebase";

export function MeetingDetail() {
  const { id } = useParams();
  const [meeting, setMeeting] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!id || !auth.currentUser) return;
      try {
        const docRef = doc(db, "meetings", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setMeeting(docSnap.data());
          
          const q = query(
            collection(db, "tasks"), 
            where("meetingId", "==", id),
            where("ownerId", "==", auth.currentUser.uid)
          );
          const querySnapshot = await getDocs(q);
          const t: any[] = [];
          querySnapshot.forEach((d) => t.push({ id: d.id, ...d.data() }));
          setTasks(t);
        }
      } catch (e) {
         handleFirestoreError(e, OperationType.GET, `meetings/${id}`);
      } finally {
        setLoading(false);
      }
    }
    
    // Sometimes auth.currentUser is not populated immediately, so listen for changes
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) loadData();
    });
    return () => unsub();
  }, [id]);

  if (loading) {
     return <div className="p-8 text-center text-slate-400 animate-pulse">Loading meeting AI insights...</div>;
  }

  if (!meeting) {
     return <div className="p-8 text-center text-slate-400">Meeting not found.</div>;
  }

  let summaryObj: any = {};
  try {
    summaryObj = JSON.parse(meeting.summary);
  } catch (e) {}

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <div className="flex items-center gap-4">
        <Link to="/meetings" className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors">
           <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{meeting.title}</h1>
          <div className="flex items-center text-sm text-slate-400 mt-2 space-x-4">
            <span className="flex items-center"><Clock className="w-4 h-4 mr-1" /> {meeting.createdAt?.toDate?.()?.toLocaleDateString()}</span>
            <span className="flex items-center"><Users className="w-4 h-4 mr-1" /> AI Processed</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Col - Summary */}
        <div className="md:col-span-2 space-y-6">
          <div className="p-6 bg-[#111827] rounded-xl border border-slate-800">
            <h2 className="text-lg font-semibold mb-4 text-blue-400 flex items-center">
               <ArrowRight className="w-5 h-5 mr-2" /> Executive Summary
            </h2>
            <p className="text-slate-300 leading-relaxed">
              {summaryObj.summary || "No summary available."}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-6 bg-[#111827] rounded-xl border border-slate-800">
              <h3 className="font-medium text-emerald-400 mb-3">Key Decisions</h3>
              <ul className="list-disc pl-5 space-y-2 text-slate-300 text-sm">
                {summaryObj.decisions?.length > 0 ? summaryObj.decisions.map((d: any, i: number) => (
                  <li key={i}>{d}</li>
                )) : <li>No key decisions found.</li>}
              </ul>
            </div>
            
            <div className="p-6 bg-[#111827] rounded-xl border border-slate-800">
              <h3 className="font-medium text-red-400 mb-3">Blockers</h3>
              <ul className="list-disc pl-5 space-y-2 text-slate-300 text-sm">
                {summaryObj.blockers?.length > 0 ? summaryObj.blockers.map((b: any, i: number) => (
                  <li key={i}>{b}</li>
                )) : <li>No blockers found.</li>}
              </ul>
            </div>
          </div>
        </div>

        {/* Right Col - Extracted Tasks */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white px-2">Extracted Tasks</h2>
          
          {tasks.length === 0 && (
             <div className="p-8 text-center border border-slate-800 border-dashed rounded-lg bg-slate-900/50 text-slate-400 text-sm">
               No tasks found.
             </div>
          )}

          {tasks.map(t => (
            <div key={t.id} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:bg-slate-800 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-sm text-white">{t.title}</h4>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-400 mt-4">
                <span className="flex items-center gap-1.5"><div className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold">{(t.assignee || "?")[0]}</div> {t.assignee}</span>
                <Badge variant="outline" className={`
                  ${t.priority === 'Critical' ? 'border-red-500/30 text-red-400 bg-red-400/10' : ''}
                  ${t.priority === 'High' ? 'border-orange-500/30 text-orange-400 bg-orange-400/10' : ''}
                  ${t.priority === 'Medium' ? 'border-blue-500/30 text-blue-400 bg-blue-400/10' : ''}
                  ${t.priority === 'Low' ? 'border-slate-500/30 text-slate-400 bg-slate-400/10' : ''}
                `}>{t.priority}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
