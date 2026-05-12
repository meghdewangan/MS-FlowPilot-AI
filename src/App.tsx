import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { Meetings } from "./pages/Meetings";
import { MeetingDetail } from "./pages/MeetingDetail";
import { Tasks } from "./pages/Tasks";
import { Assistant } from "./pages/Assistant";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/meetings/:id" element={<MeetingDetail />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/assistant" element={<Assistant />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
