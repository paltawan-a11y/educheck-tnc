import React, { useState, useEffect } from 'react';
import { FileText, Loader, AlertCircle, CheckCircle2, ChevronRight, Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface GoogleSheet {
  id: string;
  name: string;
  modifiedTime: string;
}

interface SheetInfo {
  title: string;
  sheetId: number;
  gridProperties?: { rowCount: number; columnCount: number };
}

interface SheetData {
  sheetName: string;
  studentCount: number;
  students: Array<{ studentId: string; name: string }>;
}

interface Props {
  token: string | null;
  onClassroomCreated?: () => void;
}

export default function IntegratedGoogleSheetsImport({ token, onClassroomCreated }: Props) {
  const [step, setStep] = useState<'form' | 'select-sheet' | 'select-tab' | 'preview' | 'done'>('form');
  
  // Form fields
  const [classroomDetails, setClassroomDetails] = useState({
    name: '',
    subject: '',
    grade: 'ปวช.',
    year: '1',
    department: 'สาขาเทคโนโลยีสารสนเทศ',
    room: '',
  });

  // Google Sheets states
  const [sheets, setSheets] = useState<GoogleSheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<GoogleSheet | null>(null);
  const [sheetTabs, setSheetTabs] = useState<SheetInfo[]>([]);
  const [selectedTab, setSelectedTab] = useState<SheetInfo | null>(null);
  const [sheetData, setSheetData] = useState<SheetData | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGoogleSheets = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!token) {
        throw new Error('ไม่พบ token การยืนยัน กรุณาเข้าสู่ระบบใหม่');
      }
      
      const res = await fetch('/api/google/sheets', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      setSheets(data.files || []);
      
      if (!data.files || data.files.length === 0) {
        setError('ไม่พบ Google Sheet ในไดรฟ์ของคุณ');
      }
    } catch (err: any) {
      console.error('Fetch Google Sheets Error:', err);
      setError(err.message || 'ไม่สามารถดึงข้อมูล Google Sheets ได้');
    } finally {
      setLoading(false);
    }
  };

  const handleContinueToSheets = async () => {
    if (!classroomDetails.name || !classroomDetails.subject || !classroomDetails.room) {
      setError('กรุณากรอกข้อมูลให้ครบ (ชื่อ, รหัสวิชา, ห้อง)');
      return;
    }
    
    setStep('select-sheet');
    await fetchGoogleSheets();
  };

  const handleSelectSheet = async (sheet: GoogleSheet) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/google/sheets/${sheet.id}/metadata`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to fetch sheet metadata');
      }
      const data = await res.json();
      setSelectedSheet(sheet);
      setSheetTabs(data.sheets || []);
      setStep('select-tab');
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถดึงข้อมูล metadata ได้');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTab = async (tab: SheetInfo) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/google/sheets/${selectedSheet?.id}/sheet/${encodeURIComponent(tab.title || '')}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to fetch sheet data');
      }
      const data = await res.json();
      setSelectedTab(tab);
      setSheetData(data);
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถดึงข้อมูล sheet ได้');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClassroom = async () => {
    if (!selectedSheet || !selectedTab || !sheetData) return;
    
    setLoading(true);
    setError(null);
    try {
      if (!confirm(`ยืนยันการสร้างห้องเรียน:\nชื่อ: ${classroomDetails.name}\nวิชา: ${classroomDetails.subject}\nระดับ: ${classroomDetails.grade}${classroomDetails.room}\n\nต้องการดำเนินการต่อหรือไม่?`)) return;

      const res = await fetch('/api/classrooms/from-sheet', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          spreadsheetId: selectedSheet.id,
          sheetName: selectedTab.title,
          classroomName: classroomDetails.name,
          grade: classroomDetails.grade,
          year: classroomDetails.year,
          department: classroomDetails.department,
          subject: classroomDetails.subject,
          room: classroomDetails.room,
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to create classroom');
      }
      
      setStep('done');
      onClassroomCreated?.();
      setTimeout(() => {
        setStep('form');
        setSelectedSheet(null);
        setSelectedTab(null);
        setSheetData(null);
        setClassroomDetails({ name: '', subject: '', grade: 'ปวช.', year: '1', department: 'สาขาเทคโนโลยีสารสนเทศ', room: '' });
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Form Entry
  if (step === 'form') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase mb-1.5 block">ชื่อห้องเรียน</label>
            <input
              type="text"
              placeholder="เช่น กราฟิกดีไซน์"
              value={classroomDetails.name}
              onChange={e => setClassroomDetails({...classroomDetails, name: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-gray-50/50"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase mb-1.5 block">รหัสวิชา</label>
            <input
              type="text"
              placeholder="เช่น วว101"
              value={classroomDetails.subject}
              onChange={e => setClassroomDetails({...classroomDetails, subject: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-gray-50/50"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase mb-1.5 block">สาขาวิชา</label>
            <select
              value={classroomDetails.department}
              onChange={e => setClassroomDetails({...classroomDetails, department: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 outline-none bg-gray-50/50"
            >
              <option value="สาขาเทคโนโลยีสารสนเทศ">สาขาเทคโนโลยีสารสนเทศ</option>
              <option value="สาขาเทคโนโลยีธุรกิจดิจิทัล">สาขาเทคโนโลยีธุรกิจดิจิทัล</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase mb-1.5 block">ระดับชั้น</label>
            <select
              value={classroomDetails.grade}
              onChange={e => setClassroomDetails({...classroomDetails, grade: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 outline-none bg-gray-50/50"
            >
              <option value="ปวช.">ปวช.</option>
              <option value="ปวส.">ปวส.</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase mb-1.5 block">ห้อง (เช่น 1 หรือ 1/2)</label>
            <input
              type="text"
              placeholder="เช่น 1 หรือ 1/2"
              value={classroomDetails.room}
              onChange={e => setClassroomDetails({...classroomDetails, room: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-gray-50/50"
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm font-medium flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleContinueToSheets}
            disabled={!token}
            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            เลือก Google Sheets
          </button>
        </div>
      </motion.div>
    );
  }

  // Step 2: Select Google Sheet
  if (step === 'select-sheet') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <button
          onClick={() => setStep('form')}
          className="text-sm font-bold text-slate-600 hover:text-slate-900"
        >
          ← ย้อนกลับ
        </button>

        <div className="text-sm font-bold text-slate-700 mb-3">
          ชื่อห้องเรียน: <span className="text-indigo-600">{classroomDetails.name}</span>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm font-medium flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold mb-2">เกิดข้อผิดพลาด</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center">
            <Loader className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">กำลังโหลด Google Sheets...</p>
          </div>
        ) : sheets.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-2 opacity-50" />
            <p className="text-slate-600 font-bold">ไม่พบ Google Sheet</p>
            <p className="text-slate-500 text-sm">สร้าง Google Sheet ก่อนแล้วลองอีกครั้ง</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sheets.map(sheet => (
              <button
                key={sheet.id}
                onClick={() => handleSelectSheet(sheet)}
                className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{sheet.name}</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      แก้ไขล่าสุด: {new Date(sheet.modifiedTime).toLocaleDateString('th-TH')}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-colors flex-shrink-0 mt-0.5" />
                </div>
              </button>
            ))}
          </div>
        )}
      </motion.div>
    );
  }

  // Step 3: Select Sheet Tab
  if (step === 'select-tab') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <button
          onClick={() => {
            setStep('select-sheet');
            setSelectedSheet(null);
            setSheetTabs([]);
          }}
          className="text-sm font-bold text-slate-600 hover:text-slate-900"
        >
          ← เลือก Sheet อื่น
        </button>

        <div className="text-sm font-bold text-slate-700 mb-3">
          Google Sheet: <span className="text-indigo-600">{selectedSheet?.name}</span>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm font-medium flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center">
            <Loader className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">กำลังโหลด...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sheetTabs.map((tab, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectTab(tab)}
                className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{tab.title}</h4>
                    {tab.gridProperties && (
                      <p className="text-xs text-slate-400 mt-1">
                        แถว: {tab.gridProperties.rowCount} × คอลัมน์: {tab.gridProperties.columnCount}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-colors flex-shrink-0 mt-0.5" />
                </div>
              </button>
            ))}
          </div>
        )}
      </motion.div>
    );
  }

  // Step 4: Preview
  if (step === 'preview') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <button
          onClick={() => {
            setStep('select-tab');
            setSelectedTab(null);
            setSheetData(null);
          }}
          className="text-sm font-bold text-slate-600 hover:text-slate-900"
        >
          ← เปลี่ยน Sheet
        </button>

        <div className="space-y-4">
          <div className="p-4 bg-indigo-50 border-2 border-indigo-200 rounded-2xl">
            <h4 className="font-bold text-indigo-900 mb-3">ข้อมูลห้องเรียน</h4>
            <div className="space-y-3 text-sm text-indigo-800">
              <div><span className="font-bold">ชื่อ:</span> {classroomDetails.name}</div>
              <div><span className="font-bold">รหัสวิชา:</span> {classroomDetails.subject}</div>
              <div className="pt-2 border-t border-indigo-100">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">รูปแบบที่จะแสดงผล</p>
                <div className="text-lg font-black bg-white px-3 py-2 rounded-xl shadow-sm border border-indigo-100">
                  {classroomDetails.name} · {classroomDetails.grade}{classroomDetails.room} <span className="text-sm font-normal text-slate-400">{classroomDetails.department}</span>
                </div>
              </div>
              <div><span className="font-bold">Google Sheet:</span> {selectedSheet?.name}</div>
              <div><span className="font-bold">Sheet Tab:</span> {selectedTab?.title}</div>
            </div>
          </div>

          <div className="p-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl">
            <h4 className="font-bold text-emerald-900 mb-3">ข้อมูลนักเรียน</h4>
            <p className="text-sm text-emerald-800 mb-3">
              พบนักเรียน <span className="font-bold">{sheetData?.studentCount || 0}</span> คน
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {sheetData?.students.slice(0, 10).map((student, idx) => (
                <div key={idx} className="text-xs text-emerald-700 flex justify-between bg-white/50 p-2 rounded">
                  <span className="font-bold">{student.studentId}</span>
                  <span>{student.name}</span>
                </div>
              ))}
              {(sheetData?.students.length || 0) > 10 && (
                <div className="text-xs text-emerald-600 pt-2 border-t border-emerald-200 font-bold">
                  +{(sheetData?.students.length || 0) - 10} คนอื่น ๆ...
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm font-medium flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleCreateClassroom}
            disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                กำลังสร้าง...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                สร้างห้องเรียน
              </>
            )}
          </button>
        </div>
      </motion.div>
    );
  }

  // Step 5: Success
  if (step === 'done') {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
        <h3 className="text-xl font-black text-slate-900 mb-2">สร้างห้องเรียนสำเร็จ!</h3>
        <p className="text-slate-600 text-sm">ห้องเรียนใหม่ได้ถูกสร้างจาก Google Sheet แล้ว</p>
      </motion.div>
    );
  }

  return null;
}
