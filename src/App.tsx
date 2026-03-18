import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  QrCode,
  Users,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Download,
  LayoutDashboard,
  BookOpen,
  ChevronDown,
  FileX,
  X,
  TrendingUp,
  Clock,
  Award,
  Search,
  Filter,
  RefreshCw,
  ChevronUp,
  Plus,
  Trash2,
  Upload,
  UserPlus,
  ArrowLeft,
  Settings,
  Table as TableIcon,
  FileSpreadsheet,
  Loader
} from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import GoogleLoginButton from './components/GoogleLoginButton';
import IntegratedGoogleSheetsImport from './components/IntegratedGoogleSheetsImport';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// --- Types ---
interface Student {
  studentId: string;
  name: string;
  nickname?: string;
}

interface Classroom {
  id: string;
  name: string;
  subject: string;
  grade: string;
  year: string;
  department: string;
  room: string;
  spreadsheetId: string;
  studentCount?: number;
  students?: Student[];
  attendanceSpreadsheetId?: string;
  scoringSpreadsheetId?: string;
  scoringSheetTabName?: string;
  createdAt: string;
}

interface StudentStat {
  id: string;
  name: string;
  email: string;
  submitted: number;
  total: number;
  score: number;
  maxScore: number;
  scorePercent: number | null;
  status: 'ส่งครบแล้ว' | 'ส่งบางส่วน' | 'ยังไม่ส่ง';
  missingAssignments: string[];
}

interface DashboardData {
  studentCount: number;
  assignmentCount: number;
  submittedPercent: number;
  latePercent: number;
  notSubmittedPercent: number;
  students: StudentStat[];
}

// --- Components ---

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' }>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const variants = {
      primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200',
      secondary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md',
      outline: 'border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 bg-white',
      ghost: 'text-slate-600 hover:bg-slate-100',
      danger: 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'px-5 py-2.5 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 text-sm',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all bg-gray-50/50',
        className
      )}
      {...props}
    />
  )
);

const Card = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden", className)} {...props}>
    {children}
  </div>
);

// --- Stat Card ---
function StatCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: any;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("bg-white p-5 rounded-2xl border shadow-sm relative overflow-hidden", color.split(' ')[0].replace('text-', 'border-').replace('-600', '-100') + ' border')}
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", color.replace('text-', 'bg-').replace('-600', '-100').replace('-500', '-50'))}>
        <Icon className={cn("w-5 h-5", color)} />
      </div>
      <p className="text-xs font-medium text-slate-500 mb-0.5">{label}</p>
      <p className={cn("text-3xl font-black", color)}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </motion.div>
  );
}

const SortIcon = ({ active, order }: { active: boolean; order: 'asc' | 'desc' }) => {
  if (!active) return <ChevronDown className="w-3.5 h-3.5 opacity-20" />;
  return order === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-indigo-600" /> : <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />;
};

const EditClassroomModal = ({ classroom, formData, setFormData, onClose, onSave, loading }: {
  classroom: Classroom | null;
  formData: any;
  setFormData: (d: any) => void;
  onClose: () => void;
  onSave: () => void;
  loading: boolean;
}) => {
  if (!classroom || !formData) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors z-10"><X className="w-5 h-5" /></button>
        <div className="bg-indigo-600 p-6 text-white text-center">
          <h3 className="text-xl font-black">แก้ไขข้อมูลห้องเรียน</h3>
          <p className="text-indigo-100 text-xs opacity-80 mt-1">{classroom.name}</p>
        </div>
        <div className="p-8 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">หัวข้อ/ชื่อย่อ</label>
            <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">รหัสวิชา</label>
            <Input value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">สาขาวิชา</label>
            <select className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 outline-none bg-gray-50/50" value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })}>
              {['สาขาเทคโนโลยีสารสนเทศ', 'สาขาเทคโนโลยีธุรกิจดิจิทัล'].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">ระดับชั้น</label>
            <select className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 outline-none bg-gray-50/50" value={formData.grade} onChange={e => setFormData({ ...formData, grade: e.target.value })}>
              {['ปวช.', 'ปวส.'].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">ห้อง (เช่น 1 หรือ 1/2)</label>
            <Input 
              value={formData.room ?? ''} 
              placeholder="เช่น 1 หรือ 1/2"
              onChange={e => setFormData({ ...formData, room: e.target.value })} 
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={onClose}>ยกเลิก</Button>
            <Button variant="primary" className="flex-1 bg-indigo-600" onClick={onSave} disabled={loading}>
              {loading ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const StudentModal = ({ student, onClose }: { student: StudentStat | null; onClose: () => void }) => {
  if (!student) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors z-10"><X className="w-5 h-5" /></button>
        <div className="bg-indigo-600 p-8 text-white relative">
          <div className="relative z-10">
            <h3 className="text-2xl font-black mb-1">{student.name}</h3>
            <p className="text-indigo-100 text-sm opacity-80">{student.email}</p>
            <div className="flex gap-4 mt-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 mb-1">ความคืบหน้า</p>
                <p className="text-2xl font-black">{Math.round((student.submitted / student.total) * 100)}%</p>
              </div>
              <div className="w-px h-10 bg-indigo-500/50 mt-2" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 mb-1">คะแนนสะสม</p>
                <p className="text-2xl font-black">{student.score} <span className="text-sm font-normal opacity-60">/ {student.maxScore}</span></p>
              </div>
            </div>
          </div>
        </div>
        <div className="p-8">
          <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <FileX className="w-4 h-4 text-red-500" /> งานที่ยังไม่ส่ง ({student.missingAssignments.length})
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            {student.missingAssignments.length > 0 ? (
              student.missingAssignments.map((task, i) => (
                <div key={i} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-600 font-medium">· {task}</div>
              ))
            ) : (
              <div className="py-8 text-center bg-emerald-50 rounded-2xl border border-emerald-100">
                <p className="text-emerald-600 font-bold text-sm">ส่งครบทุกงานแล้ว! 🎉</p>
              </div>
            )}
          </div>
          <Button className="w-full mt-8 py-3" onClick={onClose}>ปิดหน้าต่าง</Button>
        </div>
      </motion.div>
    </div>
  );
};

const Scanner = ({ onScan }: { onScan: (data: string) => void }) => {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner("reader", {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    }, false);

    scanner.render((result) => {
      onScan(result);
    }, (err) => {
      // Ignore errors during scan
    });

    return () => {
      scanner.clear().catch(e => console.error("Failed to clear scanner", e));
    };
  }, []);

  return null;
};

// --- Main App ---
export default function App() {
  const [view, setView] = useState<'home' | 'teacher' | 'student' | 'classroom' | 'manage-classrooms' | 'scoring' | 'student-qrs' | 'student-qr-generator'>('home');
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // User authentication state
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [userLoading, setUserLoading] = useState(false);

  // Form states for creating classroom
  const [newClassroomData, setNewClassroomData] = useState({
    name: '', subject: '', grade: 'ปวช.', year: '1', department: 'สาขาเทคโนโลยีสารสนเทศ', room: '', spreadsheetId: '', scoringSpreadsheetId: ''
  });

  // Student check-in states
  const [studentId, setStudentId] = useState('');
  const [foundStudent, setFoundStudent] = useState<Student | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);

  // Classroom API states
  const [courses, setCourses] = useState<any[]>([]);
  const [loadingClassroom, setLoadingClassroom] = useState(false);
  const [classroomError, setClassroomError] = useState<string | null>(null);

  // Dashboard state
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentStat | null>(null);

  // Search/Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'name' | 'submitted' | 'score'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ส่งครบแล้ว' | 'ส่งบางส่วน' | 'ยังไม่ส่ง'>('all');
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null);
  const [editFormData, setEditFormData] = useState<any>(null);

  // Scoring Setup states
  const [scoringTaskName, setScoringTaskName] = useState('');
  const [availableScoringTabs, setAvailableScoringTabs] = useState<string[]>([]);
  const [isFetchingTabs, setIsFetchingTabs] = useState(false);
  const [isScanned, setIsScanned] = useState(false);
  const [scannedStudent, setScannedStudent] = useState<Student | null>(null);
  const [scoreInput, setScoreInput] = useState('');
  const [scoringSetup, setScoringSetup] = useState(false);
  const [scoringConnectMode, setScoringConnectMode] = useState(false);
  const [scoringConnectStep, setScoringConnectStep] = useState<'sheet' | 'tab' | 'preview'>('sheet');
  const [sheetsList, setSheetsList] = useState<any[]>([]);
  const [selectedScoringFile, setSelectedScoringFile] = useState<any | null>(null);
  const [scoringTabs, setScoringTabs] = useState<any[]>([]);
  const [tempSheetLoading, setTempSheetLoading] = useState(false);
  const [previewStudents, setPreviewStudents] = useState<any[]>([]);

  // CSV Upload state
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Google Sheets import state
  const [classroomCreationMode, setClassroomCreationMode] = useState<'manual' | 'google-sheets'>('manual');
  const [token, setToken] = useState<string | null>(localStorage.getItem('google_access_token'));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const classroomId = params.get('classroomId');
    const sessionId = params.get('sessionId');
    const newToken = params.get('token');

    // Clear URL params immediately to prevent re-triggering
    if (classroomId) {
      window.history.replaceState({}, '', '/');
    }

    if (newToken) {
      localStorage.setItem('google_access_token', newToken);
      window.location.href = '/';
      return;
    } else if (token) {
      // Token exists from localStorage, fetch user info and classrooms
      fetchUserInfo(token);
      fetchClassrooms(token);
    }

    if (classroomId && sessionId) {
      // Only load for student check-in if BOTH classroomId AND sessionId are present
      loadClassroomForCheckin(classroomId, sessionId);
    }

    // Listen for storage changes (logout from GoogleLoginButton)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'google_access_token') {
        if (e.newValue === null) {
          // Token was removed (logout)
          setToken(null);
          handleLogout();
        } else {
          // Token was added or changed (login)
          setToken(e.newValue);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [token]);

  // Fetch classrooms whenever token changes
  useEffect(() => {
    if (token) {
      fetchClassrooms();
    } else {
      setClassrooms([]);
    }
  }, [token]);

  const fetchUserInfo = async (accessToken: string) => {
    try {
      setUserLoading(true);
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser({
          email: data.email,
          name: data.name
        });
      }
    } catch (err) {
      console.error("Failed to fetch user info", err);
    } finally {
      setUserLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setClassrooms([]);
    setSelectedClassroom(null);
    setView('home');
    setStatus(null);
    window.location.reload();
  };

  const fetchClassrooms = async (accessToken?: string) => {
    try {
      const authToken = accessToken || localStorage.getItem('google_access_token');
      if (!authToken) {
        setClassrooms([]);
        return;
      }

      const res = await fetch(`/api/classrooms?t=${Date.now()}`, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });

      if (res.ok) {
        const data = await res.json();
        setClassrooms(data);
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error("Failed to fetch classrooms", err);
    }
  };

  const loadClassroomForCheckin = async (id: string, sessionId: string | null) => {
    try {
      const res = await fetch(`/api/classrooms/${id}`);
      if (!res.ok) throw new Error("ไม่พบห้องเรียน");
      const data = await res.json();
      setSelectedClassroom(data);
      setActiveSessionId(sessionId);
      setView('student');
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
      setView('home');
    }
  };

  const loadClassroomWithStudents = async (id: string, targetView: 'scoring' | 'student-qrs' | 'manage-classrooms' | 'home') => {
    try {
      const authToken = localStorage.getItem('google_access_token');
      const res = await fetch(`/api/classrooms/${id}`, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      if (!res.ok) throw new Error("ไม่พบห้องเรียน");
      const data = await res.json();
      setSelectedClassroom(data);
      setView(targetView);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const lookupGlobalStudent = async (id: string) => {
    if (!id) return;
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/students/search?q=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error("ไม่พบข้อมูลนักเรียน กรุณาแจ้งครูผู้สอนเพื่อเพิ่มรายชื่อก่อนครับ");
      const data = await res.json();
      setFoundStudent(data);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
      setFoundStudent(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!token) {
        throw new Error("กรุณาเข้าสู่ระบบก่อน");
      }

      const res = await fetch('/api/classrooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newClassroomData)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "บันทึกไม่สำเร็จ");
      }
      await fetchClassrooms(token);
      setNewClassroomData({ name: '', subject: '', grade: 'ปวช.', year: '1', department: 'สาขาเทคโนโลยีสารสนเทศ', room: '', spreadsheetId: '', scoringSpreadsheetId: '' });
      setStatus({ type: 'success', message: 'สร้างห้องเรียนเรียบร้อยแล้ว!' });
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClassroomSettings = async (id: string, updates: Partial<Classroom>) => {
    try {
      if (!token) throw new Error("Unauthorized");
      const res = await fetch(`/api/classrooms/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error("Update failed");
      await fetchClassrooms(token);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingClassroom || !editFormData) return;
    setLoading(true);
    try {
      await handleUpdateClassroomSettings(editingClassroom.id, editFormData);
      setEditingClassroom(null);
      setEditFormData(null);
      setStatus({ type: 'success', message: 'แก้ไขข้อมูลสำเร็จ!' });
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      alert("ไม่สามารถบันทึกการแก้ไขได้");
    } finally {
      setLoading(false);
    }
  };

  const fetchSheetsList = async () => {
    if (!token) return;
    setTempSheetLoading(true);
    try {
      const res = await fetch('/api/google/sheets', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSheetsList(data.files || []);
      setScoringConnectStep('sheet');
      setScoringConnectMode(true);
    } catch (err) {
      alert("ไม่สามารถดึงรายชื่อ Google Sheets ได้");
    } finally {
      setTempSheetLoading(false);
    }
  };

  const handleSelectScoringFile = async (sheet: any) => {
    setSelectedScoringFile(sheet);
    setTempSheetLoading(true);
    try {
      const res = await fetch(`/api/google/sheets/${sheet.id}/metadata`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setScoringTabs(data.sheets || []);
      setScoringConnectStep('tab');
    } catch (err) {
      alert("ไม่สามารถดึงข้อมูลแผ่นงานได้");
    } finally {
      setTempSheetLoading(false);
    }
  };

  const handleSelectScoringTab = async (tabTitle: string) => {
    if (!selectedClassroom || !selectedScoringFile) return;
    setTempSheetLoading(true);
    try {
      // Preview student list if possible
      const res = await fetch(`/api/google/sheets/${selectedScoringFile.id}/sheet/${encodeURIComponent(tabTitle)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setPreviewStudents(data.students || []);

      // Update classroom settings
      await handleUpdateClassroomSettings(selectedClassroom.id, {
        scoringSpreadsheetId: selectedScoringFile.id,
        scoringSheetTabName: tabTitle
      });

      setScoringConnectStep('preview');
    } catch (err) {
      alert("ไม่สามารถดึงข้อมูลนักเรียนได้");
    } finally {
      setTempSheetLoading(false);
    }
  };

  const syncStudentsFromScoringSheet = async () => {
    if (!selectedClassroom || !selectedScoringFile || !previewStudents.length || !token) return;
    setLoading(true);
    try {
      // We'll use a new or existing endpoint to update the student list
      const res = await fetch(`/api/classrooms/${selectedClassroom.id}/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ students: previewStudents })
      });
      if (!res.ok) throw new Error("Sync failed");

      await fetchClassrooms(token!);
      // Refresh current selected classroom students
      const updatedCls = await fetch(`/api/classrooms/${selectedClassroom.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json());
      setSelectedClassroom(updatedCls);

      setScoringConnectMode(false);
      setStatus({ type: 'success', message: 'ดึงรายชื่อนักเรียนเรียบร้อยแล้ว' });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClassroom = async (id: string) => {
    if (!confirm('ยืนยันระบบการลบห้องเรียนนี้? ข้อมูลรายชื่อนักเรียนจะหายไปด้วย')) return;
    try {
      if (!token) {
        throw new Error("กรุณาเข้าสู่ระบบก่อน");
      }

      const res = await fetch(`/api/classrooms/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok && res.status === 401) {
        handleLogout();
        return;
      }

      fetchClassrooms(token);
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const generateNewSession = async (classroomId: string) => {
    setSessionLoading(true);
    setStatus(null);
    try {
      // Validate classroom exists
      const classroom = classrooms.find(c => c.id === classroomId);
      if (!classroom) {
        setStatus({ type: 'error', message: 'ไม่พบห้องเรียนในระบบ กรุณารีเฟรชหน้าและลองใหม่' });
        return;
      }

      // Create new session
      const res = await fetch(`/api/classrooms/${classroomId}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'ไม่สามารถสร้าง session ได้');
      }

      const data = await res.json();
      if (!data.sessionId) {
        throw new Error('ไม่ได้รับ session ID จากเซิร์ฟเวอร์');
      }

      // Update state
      setActiveSessionId(data.sessionId);
      setSelectedClassroom({ ...classroom, activeSessionId: data.sessionId });
      setStatus({ type: 'success', message: 'สร้าง QR Code ใหม่สำเร็จ' });
    } catch (err: any) {
      console.error("Failed to generate session:", err);
      const errorMsg = err.message || 'ไม่สามารถสร้าง QR Code ได้';
      setStatus({ type: 'error', message: errorMsg + ' - กรุณาลองใหม่อีกครั้ง' });
    } finally {
      setSessionLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, classroomId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop()?.toLowerCase();

    if (fileExt === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processFileData(results.data, classroomId)
      });
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        processFileData(data, classroomId);
      };
      reader.readAsBinaryString(file);
    } else {
      alert('รองรับเฉพาะไฟล์ .csv, .xlsx และ .xls เท่านั้น');
    }
  };

  const processFileData = async (data: any[], classroomId: string) => {
    const students: Student[] = data.map((row: any) => {
      // Find keys in a case-insensitive way
      const keys = Object.keys(row);

      const findValue = (keywords: string[]) => {
        const matchingKey = keys.find(k =>
          keywords.some(kw => k.toLowerCase().replace(/[^a-zA-Z0-9ก-ฮ]/g, '').includes(kw.toLowerCase().replace(/[^a-zA-Z0-9ก-ฮ]/g, '')))
        );
        return matchingKey ? String(row[matchingKey]).trim() : '';
      };

      const studentId = findValue(['studentId', 'id', 'รหัสนักเรียน', 'รหัสประจำตัว', 'รหัส']);
      const name = findValue(['name', 'ชื่อนามสกุล', 'ชื่อ', 'fullName', 'studentName']);

      return { studentId, name };
    }).filter(s => s.studentId && s.name);

    if (students.length === 0) {
      alert('ไม่พบข้อมูลนักเรียนที่ถูกต้อง\n\nโปรดตรวจสอบว่าไฟล์ของคุณมีหัวคอลัมน์ดังนี้:\n- รหัสนักเรียน (หรือ ID)\n- ชื่อ-นามสกุล (หรือ Name)');
      return;
    }

    try {
      if (!token) {
        alert('กรุณาเข้าสู่ระบบก่อน');
        return;
      }

      const res = await fetch(`/api/classrooms/${classroomId}/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ students })
      });

      if (res.ok) {
        alert(`อัปโหลดรายชื่อสำเร็จ (${students.length} คน)`);
        fetchClassrooms(token);
        if (selectedClassroom?.id === classroomId) {
          const updated = await fetch(`/api/classrooms/${classroomId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(r => r.json());
          setSelectedClassroom(updated);
        }
      } else if (res.status === 401 || res.status === 403) {
        handleLogout();
      } else {
        const error = await res.json();
        alert(`อัปโหลดล้มเหลว: ${error.error}`);
      }
    } catch (err) {
      alert('อัปโหลดล้มเหลว');
    }
  };

  const handleSyncSheets = async (classroomId: string) => {
    setLoading(true);
    try {
      if (!token) {
        alert('กรุณาเข้าสู่ระบบก่อน');
        return;
      }

      const res = await fetch(`/api/classrooms/${classroomId}/sync-sheets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.ok && data.success) {
        alert(`ดึงรายชื่อสำเร็จ (${data.count} คน)`);
        fetchClassrooms(token);
      } else if (res.status === 401 || res.status === 403) {
        handleLogout();
      } else {
        alert(data.error || 'ดึงรายชื่อล้มเหลว');
      }
    } catch (err) {
      alert('ดึงรายชื่อล้มเหลว');
    } finally {
      setLoading(false);
    }
  };

  const lookupStudent = async (id: string) => {
    setStudentId(id);
    if (!selectedClassroom || id.length < 3) {
      setFoundStudent(null);
      return;
    }

    try {
      const res = await fetch(`/api/classrooms/${selectedClassroom.id}/students/${id}`);
      if (res.ok) {
        const student = await res.json();
        setFoundStudent(student);
      } else {
        setFoundStudent(null);
      }
    } catch (err) {
      setFoundStudent(null);
    }
  };

  const handleCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassroom || !foundStudent) return;

    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: foundStudent.studentId,
          name: foundStudent.name,
          grade: selectedClassroom.grade,
          room: selectedClassroom.room,
          classroomId: selectedClassroom.id,
          spreadsheetId: selectedClassroom.spreadsheetId,
          sessionId: activeSessionId // Send the session ID from URL
        }),
      });
      const data = await response.json();
      if (data.success) {
        setStatus({ type: 'success', message: 'เช็คชื่อสำเร็จแล้ว! ยินดีต้อนรับสู่ห้องเรียน' });
        setStudentId('');
        setFoundStudent(null);
      } else {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการบันทึก');
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchClassroomCourses = async () => {
    const token = localStorage.getItem('google_access_token');
    if (!token) return;

    setLoadingClassroom(true);
    setClassroomError(null);
    try {
      const res = await fetch('/api/classroom/courses', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("ดึงข้อมูลห้องเรียนไม่สำเร็จ");
      const data = await res.json();
      setCourses(data.courses || []);
    } catch (err: any) {
      setClassroomError(err.message);
    } finally {
      setLoadingClassroom(false);
    }
  };

  const loadDashboard = async (courseId: string) => {
    const token = localStorage.getItem('google_access_token');
    if (!token) return;

    setLoadingDashboard(true);
    const course = courses.find(c => c.id === courseId);
    setSelectedCourse(course);

    try {
      const res = await fetch(`/api/classroom/courses/${courseId}/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("ดึงข้อมูลสถิติไม่สำเร็จ");
      const data = await res.json();
      setDashboardData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const handleSaveScore = async () => {
    if (!selectedClassroom || !scannedStudent || !scoringTaskName || !scoreInput) {
      alert("ข้อมูลไม่ครบถ้วน");
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: scannedStudent.studentId,
          name: scannedStudent.name,
          classroomId: selectedClassroom.id,
          spreadsheetId: selectedClassroom.spreadsheetId,
          taskName: scoringTaskName,
          score: scoreInput
        }),
      });
      const data = await response.json();
      if (data.success) {
        setStatus({ type: 'success', message: `บันทึกคะแนนให้ ${scannedStudent.name} สำเร็จ` });
        setScoreInput('');
        setIsScanned(false);
        setScannedStudent(null);
      } else {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการบันทึก');
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const toggleSort = (field: 'name' | 'submitted' | 'score') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredStudents = dashboardData?.students
    .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.email.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(s => statusFilter === 'all' || s.status === statusFilter)
    .sort((a, b) => {
      const order = sortOrder === 'asc' ? 1 : -1;
      if (sortField === 'name') return a.name.localeCompare(b.name) * order;
      if (sortField === 'submitted') return (a.submitted - b.submitted) * order;
      if (sortField === 'score') return (a.score - b.score) * order;
      return 0;
    }) || [];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100 pb-20">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => { window.history.pushState({}, '', '/'); setView('home'); setSelectedClassroom(null); setActiveSessionId(null); }}
          >
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <GraduationCap className="text-white w-6 h-6" />
            </div>
            <span className="font-bold text-xl tracking-tight hidden sm:block">EduCheck</span>
          </div>
          <div className="flex items-center gap-3">
            {view !== 'home' && (
              <button
                onClick={() => { setView('home'); setSelectedClassroom(null); setActiveSessionId(null); }}
                className="text-sm text-slate-500 hover:text-indigo-600 font-medium transition-colors hidden sm:flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> กลับหน้าแรก
              </button>
            )}
            <GoogleLoginButton />
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-4 sm:p-8">
        <AnimatePresence mode="wait">
          {/* --- HOME VIEW --- */}
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8 space-y-12"
            >
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-bold mb-6"
                >
                  Secured Attendance System
                </motion.div>
                <h1 className="text-4xl sm:text-6xl font-black text-slate-900 mb-6 tracking-tight">
                  ระบบเช็คชื่อ<br /><span className="text-indigo-600">แบบป้องกันการใช้ซ้ำ</span>
                </h1>
                <p className="text-slate-500 text-lg max-w-2xl mx-auto leading-relaxed">
                  QR Code จะถูกสร้างใหม่แบบครั้งต่อครั้งโดยครูผู้สอน เพื่อป้องกันนักเรียนส่งต่อลิงก์เช็คชื่อกันเองนอกห้องเรียน
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div onClick={() => setView('manage-classrooms')} className="group bg-white p-8 rounded-[2rem] border-2 border-slate-100 shadow-sm hover:shadow-2xl hover:border-indigo-200 hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Settings className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">จัดการห้องเรียน</h2>
                  <p className="text-slate-500 mb-6 text-sm">สร้างห้องเรียนส่วนตัว และอัปโหลดรายชื่อนักเรียนผ่านไฟล์ CSV</p>
                  <div className="flex items-center text-indigo-600 font-bold gap-2">เริ่มสร้าง <ChevronRight className="w-4 h-4" /></div>
                </div>

                <div onClick={() => setView('teacher')} className="group bg-white p-8 rounded-[2rem] border-2 border-slate-100 shadow-sm hover:shadow-2xl hover:border-emerald-200 hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden">
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <QrCode className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">QR Code เช็คชื่อ</h2>
                  <p className="text-slate-500 mb-6 text-sm">สร้าง QR Code แบบครั้งต่อครั้ง (Session-based) สำหรับแต่ละคาบเรียน</p>
                  <div className="flex items-center text-emerald-600 font-bold gap-2">รับรหัส <ChevronRight className="w-4 h-4" /></div>
                </div>

                <div onClick={() => setView('classroom')} className="group bg-white p-8 rounded-[2rem] border-2 border-slate-100 shadow-sm hover:shadow-2xl hover:border-sky-200 hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden">
                  <div className="w-14 h-14 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                    <LayoutDashboard className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">สถิติ Classroom</h2>
                  <p className="text-slate-500 mb-6 text-sm">ดูสรุปงานและคะแนนจาก Google Classroom เพื่อประเมินผล</p>
                  <div className="flex items-center text-sky-600 font-bold gap-2">ดูรายงาน <ChevronRight className="w-4 h-4" /></div>
                </div>

                <div onClick={() => setView('scoring')} className="group bg-white p-8 rounded-[2rem] border-2 border-slate-100 shadow-sm hover:shadow-2xl hover:border-fuchsia-200 hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden">
                  <div className="w-14 h-14 bg-fuchsia-50 text-fuchsia-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-fuchsia-600 group-hover:text-white transition-colors">
                    <Award className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">ระบบให้คะแนน</h2>
                  <p className="text-slate-500 mb-6 text-sm">สแกน QR Code นักเรียนเพื่อกรอกคะแนนลง Google Sheet โดยตรง</p>
                  <div className="flex items-center text-fuchsia-600 font-bold gap-2">เริ่มให้คะแนน <ChevronRight className="w-4 h-4" /></div>
                </div>

                <div onClick={() => setView('student-qr-generator')} className="group bg-white p-8 rounded-[2rem] border-2 border-slate-100 shadow-sm hover:shadow-2xl hover:border-amber-200 hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden">
                  <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                    <UserPlus className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">สร้าง QR ส่วนตัว</h2>
                  <p className="text-slate-500 mb-6 text-sm">ให้นักเรียนสร้าง QR Code ประจำตัวเพื่อใช้ในการเช็คชื่อและรับคะแนน</p>
                  <div className="flex items-center text-amber-600 font-bold gap-2">สร้าง QR <ChevronRight className="w-4 h-4" /></div>
                </div>
              </div>
            </motion.div>
          )}

          {/* --- MANAGE CLASSROOMS VIEW --- */}
          {view === 'manage-classrooms' && (
            <motion.div key="manage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-3xl font-black flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><Settings className="w-6 h-6" /></div>
                    จัดการห้องเรียนของคุณ
                  </h2>
                  <p className="text-slate-500 mt-1 pl-13">สร้างและแก้ไขรายชื่อนักเรียนสำหรับแต่ละรายวิชา</p>
                </div>
              </div>

              <div className="grid gap-8 lg:grid-cols-3">
                {/* Create Form */}
                <div className="lg:col-span-1">
                  <Card className="p-6 sticky top-24">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Plus className="w-5 h-5 text-indigo-600" /> สร้างห้องเรียนใหม่
                    </h3>

                    {/* Mode Toggle */}
                    <div className="flex gap-2 mb-6 bg-slate-100 p-1 rounded-xl">
                      <button
                        onClick={() => setClassroomCreationMode('manual')}
                        className={cn(
                          "flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all",
                          classroomCreationMode === 'manual'
                            ? "bg-white text-indigo-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        ป้อนข้อมูล
                      </button>
                      <button
                        onClick={() => setClassroomCreationMode('google-sheets')}
                        disabled={!token}
                        className={cn(
                          "flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:pointer-events-none",
                          classroomCreationMode === 'google-sheets'
                            ? "bg-white text-indigo-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        Google Sheets
                      </button>
                    </div>

                    {/* Manual Form */}
                    {classroomCreationMode === 'manual' && (
                      <form onSubmit={handleCreateClassroom} className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">หัวข้อ/ชื่อย่อ</label>
                          <Input placeholder="เช่น กราฟิกดีไซน์" value={newClassroomData.name} onChange={e => setNewClassroomData({ ...newClassroomData, name: e.target.value })} required />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">รหัสวิชา</label>
                          <Input placeholder="เช่น วว101" value={newClassroomData.subject} onChange={e => setNewClassroomData({ ...newClassroomData, subject: e.target.value })} required />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">สาขาวิชา</label>
                          <select className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 outline-none bg-gray-50/50" value={newClassroomData.department} onChange={e => setNewClassroomData({ ...newClassroomData, department: e.target.value })}>
                            {['สาขาเทคโนโลยีสารสนเทศ', 'สาขาเทคโนโลยีธุรกิจดิจิทัล'].map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">ระดับชั้น</label>
                          <select className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 outline-none bg-gray-50/50" value={newClassroomData.grade} onChange={e => setNewClassroomData({ ...newClassroomData, grade: e.target.value })}>
                            {['ปวช.', 'ปวส.'].map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">ห้อง (เช่น 1 หรือ 1/2)</label>
                          <Input placeholder="เช่น 1 หรือ 1/2" value={newClassroomData.room} onChange={e => setNewClassroomData({ ...newClassroomData, room: e.target.value })} required />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">ไฟล์รายชื่อ/เช็คชื่อ (Sheet ID)</label>
                          <Input placeholder="ID จาก URL ของ Google Sheet" value={newClassroomData.spreadsheetId} onChange={e => setNewClassroomData({ ...newClassroomData, spreadsheetId: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">ไฟล์คะแนนแยก (Scoring Sheet ID)</label>
                          <Input placeholder="เว้นว่างไว้หากใช้ไฟล์เดียวกัน" value={newClassroomData.scoringSpreadsheetId} onChange={e => setNewClassroomData({ ...newClassroomData, scoringSpreadsheetId: e.target.value })} />
                        </div>
                        <Button className="w-full" disabled={loading}>
                          {loading ? 'กำลังบันทึก...' : 'สร้างห้องเรียน'}
                        </Button>
                        {status && status.type === 'success' && (
                          <p className="text-emerald-600 text-xs font-bold text-center mt-2">✓ {status.message}</p>
                        )}
                      </form>
                    )}

                    {/* Google Sheets Import */}
                    {classroomCreationMode === 'google-sheets' && token && (
                      <IntegratedGoogleSheetsImport token={token} onClassroomCreated={() => fetchClassrooms(token)} />
                    )}

                    {classroomCreationMode === 'google-sheets' && !token && (
                      <div className="text-center py-6">
                        <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-50" />
                        <p className="text-sm text-slate-600 font-bold">โปรดเข้าสู่ระบบก่อน</p>
                      </div>
                    )}
                  </Card>
                </div>

                {/* List of Classrooms */}
                <div className="lg:col-span-2 space-y-4">
                  {classrooms.length === 0 ? (
                    <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-20 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                        <BookOpen className="w-8 h-8" />
                      </div>
                      <h3 className="font-bold text-slate-400">ยังไม่มีห้องเรียน</h3>
                    </div>
                  ) : (
                    classrooms.map(cls => (
                      <Card key={cls.id} className="p-6 group">
                        <div className="flex justify-between items-start">
                          <div className="flex gap-4">
                            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                              <span className="font-black text-xl">{cls.grade}</span>
                            </div>
                            <div>
                              <h3 className="font-bold text-xl leading-tight group-hover:text-indigo-600 transition-colors uppercase">{cls.subject} {cls.name}</h3>
                              <p className="text-slate-500 text-sm">{cls.name} · {cls.grade}{cls.room} {cls.department}</p>
                              <div className="flex items-center gap-4 mt-3">
                                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                                  <Users className="w-3.5 h-3.5" /> {cls.studentCount || 0} คน
                                </span>
                                <label className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 cursor-pointer hover:bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 transition-colors">
                                  <Upload className="w-3.5 h-3.5" /> อัปโหลดรายชื่อ (Excel/CSV)
                                  <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={(e) => handleFileUpload(e, cls.id)} />
                                </label>
                                {cls.spreadsheetId && (
                                  <a
                                    href={`https://docs.google.com/spreadsheets/d/${cls.spreadsheetId}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer hover:bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100 transition-colors"
                                  >
                                    <TableIcon className="w-3.5 h-3.5" /> เปิด Sheet
                                  </a>
                                )}
                                <button
                                  onClick={() => handleSyncSheets(cls.id)}
                                  disabled={loading}
                                  className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 cursor-pointer hover:bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 transition-colors"
                                >
                                  <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> ดึงรายชื่อ
                                </button>
                                <button
                                  onClick={() => loadClassroomWithStudents(cls.id, 'student-qrs')}
                                  className="flex items-center gap-1.5 text-xs font-bold text-fuchsia-600 cursor-pointer hover:bg-fuchsia-50 px-2.5 py-1 rounded-full border border-fuchsia-100 transition-colors"
                                >
                                  <QrCode className="w-3.5 h-3.5" /> QR รายคน
                                </button>
                                <button
                                  onClick={() => {
                                    const sid = prompt("ระบุ ID ของ Google Sheet สำหรับเก็บคะแนน (แยกจากไฟล์หลัก):", cls.scoringSpreadsheetId || "");
                                    if (sid !== null) {
                                      handleUpdateClassroomSettings(cls.id, { scoringSpreadsheetId: sid });
                                    }
                                  }}
                                  className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer hover:bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100 transition-colors"
                                >
                                  <Settings className="w-3.5 h-3.5" /> ตั้งค่าคะแนน
                                </button>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setEditingClassroom(cls);
                              setEditFormData({ ...cls });
                            }}
                            className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
                          >
                            <Settings className="w-5 h-5" />
                          </button>
                          <button onClick={() => handleDeleteClassroom(cls.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* --- TEACHER QR VIEW --- */}
          {view === 'teacher' && (
            <motion.div key="teacher" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-5xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-black mb-2">สร้าง QR Code เช็คชื่อ</h2>
                <p className="text-slate-500">เลือกห้องเรียน แล้วกดปุ่มเพื่อสร้าง QR Code สำหรับคาบเรียนนี้</p>
              </div>

              {classrooms.length === 0 ? (
                <Card className="p-12 text-center max-w-lg mx-auto">
                  <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                  <h3 className="font-bold text-xl mb-2">ยังไม่มีห้องเรียน</h3>
                  <Button onClick={() => setView('manage-classrooms')}>ไปสร้างห้องเรียน</Button>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Left: classroom list */}
                  <div className="space-y-3">
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider px-1 mb-3">เลือกห้องเรียน</p>
                    {classrooms.map(cls => (
                      <div
                        key={cls.id}
                        onClick={() => {
                          const found = classrooms.find(c => c.id === cls.id);
                          if (found) {
                            setSelectedClassroom({ ...found, students: [] });
                            setActiveSessionId(null);
                            setStatus(null);
                          }
                        }}
                        className={cn(
                          "p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between hover:shadow-md",
                          selectedClassroom?.id === cls.id
                            ? "bg-indigo-50 border-indigo-500 shadow-md shadow-indigo-100"
                            : "bg-white border-slate-100 hover:border-indigo-200"
                        )}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm shrink-0",
                            selectedClassroom?.id === cls.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"
                          )}>
                            {cls.grade}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold truncate">{cls.subject} {cls.name}</h4>
                            <p className="text-xs text-slate-400 truncate">{cls.name} · {cls.grade}{cls.room} {cls.department}</p>
                          </div>
                        </div>
                        {selectedClassroom?.id === cls.id && activeSessionId && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 ml-2" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Right: QR panel */}
                  <div>
                    <AnimatePresence mode="wait">
                      {activeSessionId && selectedClassroom ? (
                        <motion.div
                          key={activeSessionId}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ type: "spring", stiffness: 260, damping: 22 }}
                        >
                          <Card className="p-8 flex flex-col items-center shadow-xl shadow-indigo-100/50">
                            {status?.type === 'success' && (
                              <div className="w-full mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-sm font-bold text-center">
                                ✓ {status.message}
                              </div>
                            )}
                            <div className="bg-white p-5 rounded-3xl shadow-lg border border-slate-100 mb-5 relative">
                              <QRCodeSVG
                                value={`${window.location.origin}/?classroomId=${selectedClassroom.id}&sessionId=${activeSessionId}`}
                                size={220}
                                level="H"
                                includeMargin={true}
                              />
                              <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full animate-pulse uppercase">
                                Live
                              </div>
                            </div>
                            <h3 className="font-black text-xl text-center mb-0.5">{selectedClassroom.subject} {selectedClassroom.name}</h3>
                            <p className="text-slate-400 text-sm font-medium mb-5">{selectedClassroom.name} · {selectedClassroom.grade}{selectedClassroom.room} {selectedClassroom.department}</p>
                            <div className="w-full space-y-2.5">
                              <Button
                                className="w-full py-3"
                                variant="primary"
                                onClick={() => generateNewSession(selectedClassroom.id)}
                                disabled={sessionLoading}
                              >
                                {sessionLoading
                                  ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> สร้างรหัสใหม่...</>
                                  : <><RefreshCw className="w-4 h-4" /> รีเฟรช QR Code ใหม่</>
                                }
                              </Button>
                              <Button className="w-full" variant="outline" onClick={() => window.print()}>
                                <Download className="w-4 h-4" /> พิมพ์ QR คาบนี้
                              </Button>
                            </div>
                            <p className="mt-4 text-[10px] text-slate-400 text-center leading-relaxed">
                              รหัส: {activeSessionId?.substring(5, 15)}...<br />
                              รหัสนี้ใช้ได้เฉพาะคาบนี้ หากกด "รีเฟรช" รหัสเดิมจะหมดอายุทันที
                            </p>
                          </Card>
                        </motion.div>
                      ) : selectedClassroom && status?.type === 'error' ? (
                        <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="flex flex-col items-center justify-center p-10 border-2 border-red-200 bg-red-50 rounded-3xl text-center min-h-[320px]">
                          <AlertCircle className="w-14 h-14 mb-3 text-red-500" />
                          <p className="font-bold text-red-700 mb-4">{status.message}</p>
                          <Button variant="outline" onClick={() => generateNewSession(selectedClassroom.id)} disabled={sessionLoading}>
                            {sessionLoading ? 'กำลังลอง...' : 'ลองอีกครั้ง'}
                          </Button>
                        </motion.div>
                      ) : selectedClassroom ? (
                        <motion.div key="ready" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="flex flex-col items-center justify-center p-10 border-2 border-indigo-100 bg-indigo-50/50 rounded-3xl text-center min-h-[320px]">
                          <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center mb-4">
                            <QrCode className="w-10 h-10 text-indigo-500" />
                          </div>
                          <h3 className="font-black text-xl text-slate-700 mb-1">{selectedClassroom.name}</h3>
                          <p className="text-slate-500 text-sm mb-6">{selectedClassroom.subject} · ห้อง {selectedClassroom.room}</p>
                          <div className="w-full space-y-3">
                            <Button className="w-full py-4 text-lg" variant="primary" onClick={() => generateNewSession(selectedClassroom.id)} disabled={sessionLoading}>
                              {sessionLoading ? (
                                <>
                                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                                  สร้างรหัสใหม่...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="w-5 h-5" /> สร้างรหัสครั้งใหม่
                                </>
                              )}
                            </Button>
                            <Button className="w-full" variant="outline" onClick={() => window.print()}>
                              <Download className="w-4 h-4" /> พิมพ์ QR คาบนี้
                            </Button>
                          </div>
                          <p className="mt-4 text-[10px] text-slate-400 text-center leading-tight">
                            * รหัส: {activeSessionId?.substring(5, 13)}...<br />
                            * รหัสนี้ใช้ได้เฉพาะตอนนี้เท่านั้น<br />หากกดปุ่ม "สร้างรหัสครั้งใหม่" รหัสเดิมจะใช้งานไม่ได้ทันที
                          </p>
                        </motion.div>
                      ) : selectedClassroom && !activeSessionId && status?.type === 'error' ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center p-12 border-2 border-red-200 bg-red-50 rounded-3xl">
                          <AlertCircle className="w-16 h-16 mb-4 text-red-500" />
                          <p className="font-bold text-red-700 text-center mb-4">{status.message}</p>
                          <Button variant="outline" onClick={() => generateNewSession(selectedClassroom.id)} disabled={sessionLoading}>
                            {sessionLoading ? 'กำลังลอง...' : 'ลองอีกครั้ง'}
                          </Button>
                        </motion.div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-3xl text-slate-300">
                          <QrCode className="w-16 h-16 mb-4 opacity-50" />
                          <p className="font-bold">กรุณาเลือกห้องเรียนเพื่อเริ่มการเช็คชื่อ</p>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* --- STUDENT CHECK-IN VIEW --- */}
          {view === 'student' && selectedClassroom && (
            <motion.div key="student" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto">
              <Card className="p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />

                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <UserPlus className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-black">{selectedClassroom.subject} {selectedClassroom.name}</h2>
                  <p className="text-slate-500 font-bold mt-1 text-xs">
                    {selectedClassroom.name} · {selectedClassroom.grade}{selectedClassroom.room} {selectedClassroom.department}
                  </p>
                </div>

                {!activeSessionId ? (
                  <div className="p-6 bg-red-50 border border-red-100 rounded-3xl text-center space-y-3 mb-6">
                    <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
                    <h4 className="font-black text-red-700 uppercase tracking-wide">สิทธิ์เข้าถึงไม่ถูกต้อง</h4>
                    <p className="text-xs text-red-600 font-medium">ไม่พบรหัสการเช็คชื่อสำหรับคาบนี้ กรุณาสแกน QR Code ที่หน้าจอครูใหม่เท่านั้น</p>
                  </div>
                ) : (
                  <form onSubmit={handleCheckin} className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">รหัสนักเรียน</label>
                      <div className="relative">
                        <Input
                          required
                          placeholder="กรอกรหัสของคุณ"
                          value={studentId}
                          onChange={(e) => lookupStudent(e.target.value)}
                          className="text-2xl font-black tracking-widest text-center py-4 focus:ring-4 focus:ring-indigo-100 transition-all"
                        />
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      {foundStudent ? (
                        <motion.div
                          key="found"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-5 bg-indigo-50 border-2 border-indigo-100 rounded-2xl text-center"
                        >
                          <p className="text-xl font-black text-indigo-900">{foundStudent.name}</p>
                        </motion.div>
                      ) : studentId.length >= 3 && (
                        <motion.div
                          key="notfound"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold text-center"
                        >
                          ! ไม่พบรหัสนี้ในรายชื่อวิชา
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <Button type="submit" className="w-full py-5 text-xl font-black rounded-2xl" disabled={loading || !foundStudent}>
                      {loading ? 'กำลังบันทึก...' : 'บันทึกการเข้าเรียน'}
                    </Button>
                  </form>
                )}

                {status && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className={cn("mt-6 p-4 rounded-xl flex items-center gap-3",
                      status.type === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"
                    )}>
                    {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                    <p className="font-bold text-sm">{status.message}</p>
                  </motion.div>
                )}
              </Card>
            </motion.div>
          )}

          {/* --- GOOGLE CLASSROOM DASHBOARD --- */}
          {view === 'classroom' && (
            <motion.div key="classroom" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-black tracking-tight flex items-center gap-2">
                    <LayoutDashboard className="w-7 h-7 text-indigo-600" />
                    Classroom Sync Dashboard
                  </h2>
                  <p className="text-slate-500 mt-1 pl-9">วิเคราะห์ข้อมูลการส่งงานและระดับคะแนนจาก Google Classroom</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative group min-w-[240px]">
                    <select
                      className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 appearance-none shadow-sm transition-all"
                      onChange={(e) => loadDashboard(e.target.value)}
                      value={selectedCourse?.id || ''}
                    >
                      <option value="" disabled>เลือกโครงการ/วิชาที่สอน</option>
                      {courses.map(course => (
                        <option key={course.id} value={course.id}>{course.name}</option>
                      ))}
                    </select>
                    <BookOpen className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-indigo-500 transition-colors" />
                  </div>
                  <Button variant="outline" className="p-2.5 h-10 w-10 px-0" onClick={fetchClassroomCourses} disabled={loadingClassroom}>
                    <RefreshCw className={cn("w-4 h-4", loadingClassroom && "animate-spin")} />
                  </Button>
                </div>
              </div>

              {loadingDashboard ? (
                <div className="py-32 text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                  <p className="font-bold text-indigo-600 animate-pulse uppercase tracking-widest text-xs">กำลังประมวลผลข้อมูลชั้นเรียน...</p>
                </div>
              ) : dashboardData ? (
                <div className="space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <StatCard label="นักเรียนทั้งหมด" value={dashboardData.studentCount} sub="คน" icon={Users} color="text-indigo-600" />
                    <StatCard label="ภาระงานทั้งหมด" value={dashboardData.assignmentCount} sub="งาน" icon={BookOpen} color="text-amber-600" />
                    <StatCard label="อัตราการส่งงาน" value={`${Math.round(dashboardData.submittedPercent)}%`} icon={TrendingUp} color="text-emerald-600" />
                    <StatCard label="ส่งงานล่าช้า" value={`${Math.round(dashboardData.latePercent)}%`} icon={Clock} color="text-sky-600" />
                    <StatCard label="คิดเป็นคะแนนเฉลี่ย" value={`${Math.round(dashboardData.students.reduce((acc, s) => acc + (s.scorePercent || 0), 0) / (dashboardData.students.length || 1))}%`} icon={Award} color="text-fuchsia-600" />
                  </div>

                  {/* Table Section */}
                  <Card>
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <h3 className="font-black text-lg flex items-center gap-2">
                        <TableIcon className="w-5 h-5 text-indigo-600" /> รายชื่อและสถานะการส่งงาน
                      </h3>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="ค้นหาชื่อหรือเมล..."
                            className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 transition-all w-full sm:w-64"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm">
                          <Filter className="w-4 h-4 text-slate-400" />
                          <select
                            className="text-xs font-bold bg-transparent outline-none cursor-pointer"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                          >
                            <option value="all">สถานะทั้งหมด</option>
                            <option value="ส่งครบแล้ว">ส่งครบแล้ว</option>
                            <option value="ส่งบางส่วน">ส่งบางส่วน</option>
                            <option value="ยังไม่ส่ง">ยังไม่ส่ง</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/30">
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest cursor-pointer group" onClick={() => toggleSort('name')}>
                              <div className="flex items-center gap-1.5 group-hover:text-indigo-600 transition-colors">นักเรียน <SortIcon active={sortField === 'name'} order={sortOrder} /></div>
                            </th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest cursor-pointer group" onClick={() => toggleSort('submitted')}>
                              <div className="flex items-center gap-1.5 group-hover:text-indigo-600 transition-colors">ความคืบหน้า <SortIcon active={sortField === 'submitted'} order={sortOrder} /></div>
                            </th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest cursor-pointer group" onClick={() => toggleSort('score')}>
                              <div className="flex items-center gap-1.5 group-hover:text-indigo-600 transition-colors">คะแนน <SortIcon active={sortField === 'score'} order={sortOrder} /></div>
                            </th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">แอคชั่น</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredStudents.length > 0 ? (
                            filteredStudents.map((student) => (
                              <tr key={student.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold text-xs uppercase shadow-sm border border-indigo-100">
                                      {student.name.charAt(0)}
                                    </div>
                                    <div>
                                      <p className="font-bold text-slate-900 leading-none mb-1 group-hover:text-indigo-700 transition-colors">{student.name}</p>
                                      <p className="text-[10px] text-slate-400 font-medium">{student.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                      <div
                                        className={cn("h-full transition-all duration-1000", student.submitted === student.total ? "bg-emerald-500" : "bg-indigo-500")}
                                        style={{ width: `${(student.submitted / student.total) * 100}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-black text-slate-600 whitespace-nowrap">{student.submitted}/{student.total}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={cn(
                                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black",
                                    student.status === 'ส่งครบแล้ว' ? "bg-emerald-50 text-emerald-700" :
                                      student.status === 'ส่งบางส่วน' ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                                  )}>
                                    {student.score} / {student.maxScore}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button
                                    onClick={() => setSelectedStudent(student)}
                                    className="p-2 hover:bg-white hover:text-indigo-600 rounded-lg text-slate-300 transition-all border border-transparent hover:border-slate-100 hover:shadow-sm"
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="px-6 py-20 text-center text-slate-300 font-bold">ไม่พบข้อมูลที่ค้นหา...</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              ) : (
                <div className="py-24 text-center">
                  <div className="w-20 h-20 bg-indigo-50 text-indigo-200 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <LayoutDashboard className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-400 max-w-xs mx-auto">กรุณาเลือกรายวิชาด้านบน เพื่อแสดงผล Dashboard</h3>
                </div>
              )}
            </motion.div>
          )}

          {/* --- STUDENT QRS VIEW --- */}
          {view === 'student-qrs' && selectedClassroom && (
            <motion.div key="student-qrs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black">{selectedClassroom.name}</h2>
                  <p className="text-slate-500">
                    {selectedClassroom.subject} · {selectedClassroom.grade}{selectedClassroom.room} {selectedClassroom.department}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setView('manage-classrooms')}>กลับ</Button>
                  <Button variant="outline" onClick={() => window.print()}>พิมพ์ PDF</Button>
                  <Button 
                    variant="primary" 
                    className="bg-emerald-600 hover:bg-emerald-700" 
                    onClick={async () => {
                      if (!selectedClassroom.students?.length) return;
                      const zip = new JSZip();
                      const folderName = `${selectedClassroom.name}_QR_Codes`;
                      const folder = zip.folder(folderName);
                      
                      setLoading(true);
                      setStatus({ type: 'success', message: 'กำลังสร้างไฟล์ ZIP...' });

                      try {
                        for (const student of selectedClassroom.students) {
                          const canvas = document.createElement('canvas');
                          const ctx = canvas.getContext('2d');
                          if (!ctx) continue;
                          
                          // Set canvas size (QR + Label)
                          canvas.width = 400;
                          canvas.height = 480;
                          
                          // White background
                          ctx.fillStyle = 'white';
                          ctx.fillRect(0, 0, canvas.width, canvas.height);
                          
                          // Get SVG data
                          const svgElement = document.getElementById(`qr-${student.studentId}`) as any;
                          if (!svgElement) continue;
                          
                          const svgData = new XMLSerializer().serializeToString(svgElement);
                          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                          const url = URL.createObjectURL(svgBlob);
                          
                          const img = new Image();
                          await new Promise((resolve) => {
                            img.onload = resolve;
                            img.src = url;
                          });
                          
                          // Draw QR
                          ctx.drawImage(img, 50, 20, 300, 300);
                          
                          // Draw Label
                          ctx.fillStyle = 'black';
                          ctx.font = 'bold 24px Arial, sans-serif';
                          ctx.textAlign = 'center';
                          ctx.fillText(student.studentId, 200, 360);
                          
                          ctx.font = '20px Arial, sans-serif';
                          ctx.fillText(student.name, 200, 400);

                          ctx.font = '14px Arial, sans-serif';
                          ctx.fillStyle = '#666';
                          ctx.fillText(`${selectedClassroom.name} · ${selectedClassroom.grade}${selectedClassroom.room}`, 200, 440);
                          
                          // Add to ZIP
                          const pngBlob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
                          if (pngBlob) {
                            folder?.file(`${student.studentId}_${student.name}.png`, pngBlob);
                          }
                          
                          URL.revokeObjectURL(url);
                        }
                        
                        const content = await zip.generateAsync({ type: 'blob' });
                        saveAs(content, `${selectedClassroom.name}_QR_Codes.zip`);
                        setStatus({ type: 'success', message: 'ดาวน์โหลดไฟล์ ZIP สำเร็จ!' });
                        setTimeout(() => setStatus(null), 3000);
                      } catch (err) {
                        console.error(err);
                        alert("เกิดข้อผิดพลาดในการสร้างไฟล์ ZIP");
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                  >
                    {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    โหลดเป็น ZIP (รูปแยกคน)
                  </Button>
                </div>
              </div>

              {status && status.type === 'success' && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-2xl text-center font-bold">
                  {status.message}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 print:grid-cols-3">
                {selectedClassroom.students?.map((student) => (
                  <Card key={student.studentId} className="p-4 flex flex-col items-center text-center space-y-2 border-2 break-inside-avoid">
                    <QRCodeSVG 
                      id={`qr-${student.studentId}`}
                      value={JSON.stringify({ sid: student.studentId, name: student.name, cid: selectedClassroom.id })} 
                      size={140} 
                      level="M" 
                      includeMargin={true}
                    />
                    <p className="text-[10px] font-black uppercase text-slate-400 leading-none">{student.studentId}</p>
                    <p className="text-xs font-bold truncate w-full">{student.name}</p>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* --- SCORING VIEW --- */}
          {view === 'scoring' && (
            <motion.div key="scoring" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-8 pb-20">
              <div className="text-center">
                <h2 className="text-3xl font-black mb-2 flex items-center justify-center gap-3">
                  <Award className="w-8 h-8 text-fuchsia-600" />
                  ระบบให้คะแนน
                </h2>
                <p className="text-slate-500">สแกน QR Code นักเรียนเพื่อบันทึกคะแนนเข้า Google Sheet</p>
              </div>

              {!selectedClassroom ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {classrooms.length === 0 ? (
                    <Card className="col-span-2 p-12 text-center">
                      <p className="text-slate-400 font-bold mb-4">ยังไม่มีห้องเรียนในระบบ</p>
                      <Button onClick={() => setView('manage-classrooms')}>ไปจัดการห้องเรียน</Button>
                    </Card>
                  ) : (
                    classrooms.map(cls => (
                      <Card key={cls.id} className="p-6 cursor-pointer hover:border-fuchsia-500 hover:shadow-lg transition-all border-2 border-transparent group" onClick={() => loadClassroomWithStudents(cls.id, 'scoring')}>
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-bold text-lg group-hover:text-fuchsia-600 transition-colors">{cls.name}</h3>
                            <p className="text-slate-500 text-sm">{cls.subject} · {cls.grade}{cls.room} {cls.department}</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-fuchsia-500" />
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              ) : !scoringSetup ? (
                <Card className="max-w-md mx-auto p-8 space-y-6 shadow-xl border-fuchsia-100">
                  <h3 className="font-bold text-xl text-center">ตั้งค่าการให้คะแนน</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block pl-1">ห้องเรียน</label>
                      <div className="p-4 bg-fuchsia-50/50 rounded-2xl font-bold border border-fuchsia-100 text-fuchsia-900">{selectedClassroom.name}</div>
                    </div>

                    {!scoringConnectMode ? (
                      <>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block pl-1">ไฟล์ Google Sheet สำหรับให้คะแนน</label>
                          <div className="flex flex-col gap-2">
                            <div className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 flex items-center justify-between group">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <FileSpreadsheet className="w-5 h-5 text-fuchsia-600 flex-shrink-0" />
                                <div className="overflow-hidden">
                                  <p className="text-xs font-bold truncate text-slate-900">{selectedClassroom.scoringSheetTabName || selectedClassroom.sheetTabName || 'อิงตามชื่อห้องเรียน'}</p>
                                  <p className="text-[10px] text-slate-400 truncate tracking-tight">{selectedClassroom.scoringSpreadsheetId || selectedClassroom.spreadsheetId || 'ยังไม่ได้ตั้งค่าไฟล์แยก'}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => fetchSheetsList()}
                                className="text-[10px] font-black uppercase text-fuchsia-600 hover:bg-fuchsia-50 px-2 py-1 rounded-lg transition-colors"
                              >
                                เปลี่ยน
                              </button>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block pl-1">ชื่อเครื่องมือ/ชื่องานที่ให้คะแนน</label>
                          <Input
                            placeholder="เช่น ใบงานที่ 1, สอบท้ายบท"
                            value={scoringTaskName}
                            onChange={(e) => setScoringTaskName(e.target.value)}
                            className="bg-white border-slate-200 focus:border-fuchsia-500 focus:ring-fuchsia-100"
                          />
                          <p className="text-[10px] text-slate-400 mt-2 pl-1 leading-relaxed">* ชื่อนี้จะไปปรากฏเป็นชื่อคอลัมน์ใน Google Sheet</p>
                        </div>
                        <Button className="w-full py-4 text-lg bg-fuchsia-600 hover:bg-fuchsia-700 shadow-fuchsia-200" disabled={!scoringTaskName} onClick={() => setScoringSetup(true)}>
                          เริ่มสแกนนักเรียน
                        </Button>
                        <Button variant="outline" className="w-full" onClick={() => setSelectedClassroom(null)}>เปลี่ยนห้องเรียน</Button>
                      </>
                    ) : (
                      <div className="space-y-4 border-2 border-fuchsia-100 p-4 rounded-3xl bg-fuchsia-50/20">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-black text-fuchsia-900 uppercase">เชื่อมต่อ Google Sheets</h4>
                          <button onClick={() => setScoringConnectMode(false)} className="text-xs text-slate-400 font-bold">ยกเลิก</button>
                        </div>

                        <AnimatePresence mode="wait">
                          {scoringConnectStep === 'sheet' && (
                            <motion.div key="sheet" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-2">
                              <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">1. เลือกไฟล์ Google Sheet (ล่าสุด)</p>
                              {tempSheetLoading ? (
                                <div className="py-8 text-center"><Loader className="w-6 h-6 animate-spin text-fuchsia-600 mx-auto" /></div>
                              ) : (
                                <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                  {sheetsList.map(s => (
                                    <button
                                      key={s.id}
                                      onClick={() => handleSelectScoringFile(s)}
                                      className="w-full text-left p-3 rounded-xl hover:bg-white hover:shadow-sm border border-transparent hover:border-fuchsia-100 transition-all group"
                                    >
                                      <p className="text-xs font-bold text-slate-700 group-hover:text-fuchsia-600 truncate">{s.name}</p>
                                      <p className="text-[9px] text-slate-400">แก้ไข: {new Date(s.modifiedTime).toLocaleDateString()}</p>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </motion.div>
                          )}

                          {scoringConnectStep === 'tab' && (
                            <motion.div key="tab" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-2">
                              <button onClick={() => setScoringConnectStep('sheet')} className="text-[10px] font-bold text-fuchsia-600 mb-2">← กลับไปเลือกไฟล์</button>
                              <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">2. เลือกแผ่นงาน (Tab)</p>
                              {tempSheetLoading ? (
                                <div className="py-8 text-center"><Loader className="w-6 h-6 animate-spin text-fuchsia-600 mx-auto" /></div>
                              ) : (
                                <div className="max-h-60 overflow-y-auto space-y-1">
                                  {scoringTabs.map(t => (
                                    <button
                                      key={t.title}
                                      onClick={() => handleSelectScoringTab(t.title)}
                                      className="w-full text-left p-3 rounded-xl hover:bg-white hover:shadow-sm border border-transparent hover:border-fuchsia-100 transition-all text-xs font-bold text-slate-700"
                                    >
                                      {t.title}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </motion.div>
                          )}

                          {scoringConnectStep === 'preview' && (
                            <motion.div key="preview" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                              <div className="p-3 bg-white rounded-2xl border border-fuchsia-100">
                                <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">เชื่อมต่อสำเร็จ ✨</p>
                                <p className="text-xs font-black text-slate-900">{selectedScoringFile?.name}</p>
                                <p className="text-[10px] text-slate-400 font-medium">Tab: {selectedClassroom?.scoringSheetTabName || 'แผ่นงานที่เลือก'}</p>
                              </div>

                              <div className="space-y-2">
                                <p className="text-[10px] font-bold text-slate-500 uppercase">ตรวจพบนักเรียน {previewStudents.length} คน</p>
                                <div className="max-h-32 overflow-y-auto bg-white/50 rounded-xl p-2 border border-slate-100 text-left">
                                  {previewStudents.slice(0, 5).map((s, i) => (
                                    <div key={i} className="text-[9px] flex justify-between py-1 border-b border-white last:border-0 font-medium text-slate-500">
                                      <span>{s.studentId}</span>
                                      <span className="truncate ml-2">{s.name}</span>
                                    </div>
                                  ))}
                                  {previewStudents.length > 5 && <p className="text-[9px] text-slate-300 text-center mt-1">...</p>}
                                </div>
                              </div>

                              <div className="flex flex-col gap-2 pt-2">
                                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100" onClick={syncStudentsFromScoringSheet}>
                                  ดึงรายชื่อนี้เข้าห้องเรียน
                                </Button>
                                <button onClick={() => setScoringConnectMode(false)} className="text-[10px] font-black uppercase text-slate-400 py-2">
                                  ใช้รายชื่อเดิม (เชื่อมแค่ Sheet คะแนน)
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <Card className="p-4 overflow-hidden bg-slate-900 aspect-square flex items-center justify-center relative shadow-2xl rounded-[2rem]">
                      <div id="reader" className="w-full overflow-hidden rounded-2xl"></div>
                      <div className="absolute inset-0 border-2 border-fuchsia-500 pointer-events-none opacity-30 m-8 rounded-[2rem]" />
                      <Scanner
                        onScan={(data) => {
                          try {
                            const parsed = JSON.parse(data);
                            if (parsed.sid) {
                              const student = selectedClassroom.students?.find(s => s.studentId === parsed.sid);
                              if (student) {
                                setScannedStudent(student);
                                setIsScanned(true);
                                setScoreInput('');
                                // Vibrate if mobile
                                if (navigator.vibrate) navigator.vibrate(50);
                              } else {
                                alert(`ไม่พบรหัส ${parsed.sid} ในห้องเรียนนี้`);
                              }
                            }
                          } catch (e) {
                            console.error("Scan error", e);
                          }
                        }}
                      />
                    </Card>
                    <p className="text-center text-xs font-bold text-slate-400">สแกน QR Code ที่ตัวนักเรียนเพื่อกรอกคะแนน</p>
                    <Button variant="outline" className="w-full" onClick={() => { setScoringSetup(false); setIsScanned(false); }}>กลับไปแก้ไขชื่องาน</Button>
                  </div>

                  <div className="space-y-4">
                    <Card className="p-6 shadow-xl border-fuchsia-100 min-h-[400px]">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">ข้อมูลปัจจุบัน</h4>
                      <div className="p-4 bg-fuchsia-50 rounded-2xl border border-fuchsia-100 mb-6">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-[10px] font-black text-fuchsia-400 uppercase">วิชา</p>
                            <p className="font-bold text-fuchsia-900">{selectedClassroom.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-fuchsia-400 uppercase">งาน</p>
                            <p className="font-bold text-fuchsia-900">{scoringTaskName}</p>
                          </div>
                        </div>
                      </div>

                      <AnimatePresence mode="wait">
                        {isScanned && scannedStudent ? (
                          <motion.div key="scored" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                            <div className="text-center p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl">
                              <div className="w-12 h-12 bg-fuchsia-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-black">
                                {scannedStudent.name.charAt(0)}
                              </div>
                              <p className="text-[10px] font-black text-fuchsia-600 uppercase mb-1">สแกนสำเร็จ</p>
                              <p className="text-xl font-black text-slate-900 leading-tight">{scannedStudent.name}</p>
                              <p className="text-xs text-slate-400 font-bold mt-1">รหัส: {scannedStudent.studentId}</p>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 pl-1 uppercase">ป้อนคะแนน</label>
                              <Input
                                type="number"
                                autoFocus
                                className="text-4xl font-black text-center py-6 bg-white border-2 border-fuchsia-200 focus:border-fuchsia-600 focus:ring-fuchsia-100"
                                placeholder="0"
                                value={scoreInput}
                                onChange={(e) => setScoreInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveScore();
                                }}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <Button variant="outline" className="py-4" onClick={() => { setIsScanned(false); setScannedStudent(null); }}>
                                ข้าม/สแกนใหม่
                              </Button>
                              <Button className="py-4 bg-fuchsia-600 hover:bg-fuchsia-700" onClick={handleSaveScore} disabled={loading || !scoreInput}>
                                {loading ? "กำลังบันทึก..." : "ยืนยันผล"}
                              </Button>
                            </div>
                          </motion.div>
                        ) : (
                          <div className="py-24 text-center space-y-4">
                            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto text-slate-200 animate-pulse">
                              <QrCode className="w-10 h-10" />
                            </div>
                            <p className="font-bold text-slate-300">กรุณาสแกน QR Code นักเรียน...</p>
                          </div>
                        )}
                      </AnimatePresence>
                    </Card>

                    {status && (
                      <div className={cn("p-4 rounded-2xl flex items-center gap-3 border shadow-sm",
                        status.type === 'success' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-700 border-red-100"
                      )}>
                        {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                        <p className="font-bold text-sm leading-tight">{status.message}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {view === 'student-qr-generator' && (
            <motion.div key="student-qr-generator" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto pb-20">
              <div className="mb-6">
                <button onClick={() => setView('home')} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold transition-all">
                  <ArrowLeft className="w-4 h-4" /> กลับหน้าแรก
                </button>
              </div>
              <Card className="p-8 shadow-2xl relative overflow-hidden rounded-[2.5rem]">
                <div className="absolute top-0 left-0 w-full h-2 bg-amber-500" />

                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <QrCode className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-black">สร้าง QR สำหรับนักเรียน</h2>
                  <p className="text-slate-500 text-sm mt-1 leading-relaxed">กรอกรหัสและยืนยันชื่อเพื่อสร้าง QR Code<br />สำหรับใช้ในทุกวิชาของคุณ</p>
                </div>

                <div className="space-y-6">
                  {!foundStudent ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">ค้นหาด้วยรหัสนักเรียน</label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="กรอกรหัสของคุณ"
                            className="text-lg font-bold"
                            value={studentId}
                            onChange={(e) => setStudentId(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && lookupGlobalStudent(studentId)}
                          />
                          <Button variant="primary" onClick={() => lookupGlobalStudent(studentId)} disabled={loading}>
                            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "ค้นหา"}
                          </Button>
                        </div>
                      </div>
                      {status && status.type === 'error' && (
                        <p className="text-red-500 text-xs font-bold text-center italic">{status.message}</p>
                      )}
                    </div>
                  ) : (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                      <div className="p-6 bg-amber-50 border-2 border-amber-100 rounded-3xl text-center">
                        <p className="text-[10px] font-black text-amber-600 uppercase mb-1">ยินดีต้อนรับ</p>
                        <p className="text-xl font-black text-slate-900 leading-tight">{foundStudent.name}</p>
                        <p className="text-xs text-slate-400 font-bold mt-1">รหัส: {foundStudent.studentId}</p>
                      </div>

                      <div className="flex flex-col items-center bg-white p-6 rounded-3xl shadow-lg border border-slate-100 relative">
                        <QRCodeSVG
                          value={JSON.stringify({ sid: foundStudent.studentId, name: foundStudent.name })}
                          size={200}
                          level="M"
                          includeMargin={true}
                          id="personal-qr"
                        />
                        <p className="mt-4 text-[10px] font-black text-slate-300 uppercase letter-spacing-wider">Personal QR Code</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Button variant="outline" className="py-4" onClick={() => { setFoundStudent(null); setStudentId(''); setStatus(null); }}>
                          ค้นหาใหม่
                        </Button>
                        <Button className="py-4 bg-amber-600 hover:bg-amber-700 shadow-amber-200" onClick={() => window.print()}>
                          <Download className="w-4 h-4" /> บันทึก/พิมพ์
                        </Button>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-[10px] text-slate-400 font-medium leading-relaxed">
                        * แนะนำให้ "แคปหน้าจอ" เก็บไว้ในมือถือเพื่อใช้สแกนเช็คชื่อและรับคะแนนในทุกๆ วิชาที่รหัสนี้ได้ลงทะเบียนไว้
                      </div>
                    </motion.div>
                  )}
                </div>
              </Card>
            </motion.div>
          )}

        </AnimatePresence>

        <AnimatePresence>
          {selectedStudent && (
            <StudentModal
              student={selectedStudent}
              onClose={() => setSelectedStudent(null)}
            />
          )}
          {editingClassroom && (
            <EditClassroomModal
              classroom={editingClassroom}
              formData={editFormData}
              setFormData={setEditFormData}
              onClose={() => { setEditingClassroom(null); setEditFormData(null); }}
              onSave={handleSaveEdit}
              loading={loading}
            />
          )}
        </AnimatePresence>
      </main>

      <footer className="fixed bottom-0 left-0 w-full bg-white/60 backdrop-blur-sm border-t border-slate-100 py-3 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">
        © 2026 EduCheck Secured v2.0
      </footer>
    </div>
  );
}
