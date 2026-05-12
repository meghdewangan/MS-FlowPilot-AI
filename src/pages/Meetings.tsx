import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { FileText, Plus, Upload, Loader2, Play } from "lucide-react";
import { Input } from "../components/ui/input";
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db, auth, OperationType, handleFirestoreError } from "../lib/firebase";
import { summarizeMeeting, extractTasks, transcribeAudio } from "../lib/gemini";
import { v4 as uuidv4 } from "uuid";

interface Meeting {
  id: string;
  title: string;
  createdAt: any;
  status: string;
}

export function Meetings() {
  const [open, setOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");

  const [meetings, setMeetings] = useState<Meeting[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMeetings = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(collection(db, "meetings"), where("ownerId", "==", auth.currentUser.uid));
      const querySnapshot = await getDocs(q);
      const fetchedMeetings: Meeting[] = [];
      querySnapshot.forEach((doc) => {
        fetchedMeetings.push({ id: doc.id, ...doc.data() } as Meeting);
      });
      // Sort by descending created date
      setMeetings(fetchedMeetings.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bTime - aTime;
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "meetings");
    }
  };

  useEffect(() => {
    fetchMeetings();
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) {
         fetchMeetings();
      }
    });
    return () => unsub();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('audio/')) {
        const reader = new FileReader();
        reader.onloadend = async () => {
           const base64AudioMessage = (reader.result as string).split(',')[1];
           setIsProcessing(true);
           try {
             const result = await transcribeAudio(base64AudioMessage, file.type);
             setTranscript(result.trim());
             setUploadedFileName(file.name);
           } catch(error) {
             console.error(error);
             alert("Error transcribing audio. Check console.");
           } finally {
             setIsProcessing(false);
           }
        };
        reader.readAsDataURL(file);
    } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        const text = await file.text();
        setTranscript(text);
        setUploadedFileName(file.name);
    } else if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        setIsProcessing(true);
        try {
          const mammoth = await import('mammoth');
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          setTranscript(result.value);
          setUploadedFileName(file.name);
        } catch(error) {
          console.error(error);
          alert("Error extracting text from DOCX.");
        } finally {
          setIsProcessing(false);
        }
    } else {
        alert("Unsupported file type");
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !transcript) return;
    if (!auth.currentUser) {
      alert("Please login first");
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const summaryResult = await summarizeMeeting(transcript);
      const tasksResult = await extractTasks(transcript);

      const meetingId = uuidv4();
      const stringifiedSummary = JSON.stringify(summaryResult);

      const newMeeting = {
        title,
        ownerId: auth.currentUser.uid,
        transcript,
        summary: stringifiedSummary,
        status: "Completed",
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, "meetings", meetingId), newMeeting);

      // Save tasks
      for (const t of tasksResult) {
        const taskId = uuidv4();
        const newTask = {
          title: t.title || "Untitled Task",
          ownerId: auth.currentUser.uid,
          meetingId,
          assignee: t.assignee || "Unassigned",
          deadline: t.deadline || "None",
          priority: t.priority || "Medium",
          status: "Pending",
          createdAt: serverTimestamp(),
        };
        await setDoc(doc(db, "tasks", taskId), newTask);
      }

      setOpen(false);
      setTitle("");
      setTranscript("");
      setUploadedFileName("");
      await fetchMeetings();
    } catch (error) {
      console.error(error);
      alert("Failed to process meeting. Make sure the transcript has enough context.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meetings</h1>
          <p className="text-slate-400 mt-1">Manage transcripts and AI summaries.</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className="bg-blue-600 hover:bg-blue-700 text-white border-0" />}>
            <Plus className="w-4 h-4 mr-2" /> New Meeting
          </DialogTrigger>
          <DialogContent className="bg-[#111827] border-slate-800 text-white sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Process New Meeting</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Meeting Title</label>
                <Input 
                  placeholder="e.g. Weekly Marketing Sync" 
                  required 
                  className="bg-slate-900 border-slate-700" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Transcript</label>
                {uploadedFileName ? (
                   <div className="min-h-[150px] bg-slate-900 border border-slate-700 rounded-md p-4 flex flex-col items-center justify-center text-slate-400">
                      <FileText className="w-8 h-8 mb-2 text-blue-400" />
                      <p className="text-sm text-center">File uploaded: <span className="text-blue-400 font-medium">{uploadedFileName}</span></p>
                      <button type="button" onClick={() => { setUploadedFileName(""); setTranscript(""); }} className="mt-4 text-xs text-red-400 hover:text-red-300">Remove File</button>
                   </div>
                ) : (
                  <Textarea 
                    placeholder="Paste meeting notes or transcript here..." 
                    className="min-h-[150px] bg-slate-900 border-slate-700 resize-none"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    required
                  />
                )}
              </div>

              {!uploadedFileName && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-slate-700" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-[#111827] px-2 text-slate-400">Or</span>
                    </div>
                  </div>

                  <div 
                    className="border-2 border-dashed border-slate-700 rounded-lg p-6 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-800/50 hover:border-slate-500 cursor-pointer transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-8 h-8 mb-2" />
                    <p className="text-sm">Upload Audio / TXT / DOCX File</p>
                    <p className="text-xs mt-1 opacity-70">MP3, WAV, M4A, TXT, DOCX</p>
                  </div>
                </>
              )}
              <input
                type="file"
                className="hidden"
                accept="audio/*,.txt,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                ref={fileInputRef}
                onChange={handleFileChange}
              />

              <Button type="submit" disabled={isProcessing} className="w-full bg-violet-600 hover:bg-violet-700 text-white border-0">
                {isProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing with AI...</> : 'Generate Analytics'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {meetings.length === 0 && (
          <div className="col-span-3 text-center p-12 py-20 border border-slate-800 rounded-xl bg-[#111827]/50 text-slate-400 border-dashed">
            <p>No meetings found. Click "New Meeting" to get started.</p>
          </div>
        )}
        {meetings.map(m => (
          <Link key={m.id} to={`/meetings/${m.id}`} className="block block group">
            <div className="p-6 rounded-xl bg-gradient-to-br from-slate-800/50 to-[#111827] border border-slate-800 hover:border-blue-500/50 transition-all duration-300">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-blue-500/10 rounded-lg group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6 text-blue-400" />
                </div>
                <span className="text-xs font-medium px-2.5 py-1 bg-green-500/10 text-green-400 rounded-full border border-green-500/20">
                  {m.status}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors">{m.title}</h3>
              <p className="text-sm text-slate-500">
                 {m.createdAt?.toDate ? m.createdAt.toDate().toLocaleDateString() : 'Just now'}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
