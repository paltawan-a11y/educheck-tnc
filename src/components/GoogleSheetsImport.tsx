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

export default function GoogleSheetsImport({ token, onClassroomCreated }: Props) {
  const [step, setStep] = useState<'select-sheet' | 'select-tab' | 'preview' | 'done'>('select-sheet');
  const [sheets, setSheets] = useState<GoogleSheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<GoogleSheet | null>(null);
  const [sheetTabs, setSheetTabs] = useState<SheetInfo[]>([]);
  const [selectedTab, setSelectedTab] = useState<SheetInfo | null>(null);
  const [sheetData, setSheetData] = useState<SheetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classroomDetails, setClassroomDetails] = useState({
    grade: 'ปวช.',
    department: 'สาขาเทคโนโลยีสารสนเทศ',
    subject: '',
  });

  useEffect(() => {
    if (token && step === 'select-sheet') {
      fetchGoogleSheets();
    }
  }, [token, step]);

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

  const handleSelectSheet = async (sheet: GoogleSheet) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/google/sheets/${sheet.id}/metadata`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch sheet metadata');
      const data = await res.json();
      setSelectedSheet(sheet);
      setSheetTabs(data.sheets || []);
      setStep('select-tab');
    } catch (err: any) {
      setError(err.message);
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
      if (!res.ok) throw new Error('Failed to fetch sheet data');
      const data = await res.json();
      setSelectedTab(tab);
      setSheetData(data);
      setClassroomDetails(prev => ({ ...prev, subject: tab.title || '' }));
      setStep('preview');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClassroom = async () => {
    if (!selectedSheet || !selectedTab || !sheetData) return;
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/classrooms/from-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: selectedSheet.id,
          sheetName: selectedTab.title,
          classroomName: classroomDetails.subject || selectedTab.title,
          grade: classroomDetails.grade,
          department: classroomDetails.department,
          subject: classroomDetails.subject,
        })
      });
      
      if (!res.ok) throw new Error('Failed to create classroom');
      const data = await res.json();
      setStep('done');
      setTimeout(() => {
        setStep('select-sheet');
        setSelectedSheet(null);
        setSelectedTab(null);
        setSheetData(null);
        onClassroomCreated?.();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Select Google Sheet
  if (step === 'select-sheet') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-bold">เลือก Google Sheet</h3>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm font-medium flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="font-bold">เกิดข้อผิดพลาด</p>
              <p>{error}</p>
              {error.includes('Google Drive API') && (
                <div className="mt-3 p-2 bg-red-100 rounded border border-red-300 text-xs">
                  <p className="font-bold mb-1">💡 วิธีแก้ไข:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>ไปที่ Google Cloud Console</li>
                    <li>เปิดใช้งาน Google Drive API</li>
                    <li>รอ 1-2 นาที แล้วโหลดหน้าใหม่</li>
                  </ol>
                </div>
              )}
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
                    <h4 className="font-bold group-hover:text-indigo-600 transition-colors">{sheet.name}</h4>
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

  // Step 2: Select Sheet Tab
  if (step === 'select-tab') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => {
              setStep('select-sheet');
              setSelectedSheet(null);
              setSheetTabs([]);
            }}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            ← ย้อนกลับ
          </button>
          <div className="flex-1">
            <h3 className="text-lg font-bold">{selectedSheet?.name}</h3>
            <p className="text-xs text-slate-500">เลือกชีตเพื่อสร้างห้องเรียน</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
            {error}
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
                    <h4 className="font-bold group-hover:text-indigo-600 transition-colors">{tab.title}</h4>
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

  // Step 3: Preview and Config
  if (step === 'preview') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <button
          onClick={() => {
            setStep('select-tab');
            setSelectedTab(null);
            setSheetData(null);
          }}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-sm font-bold text-slate-600"
        >
          ← ย้อนกลับ
        </button>

        <div className="space-y-4">
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl">
            <h4 className="font-bold text-indigo-900 mb-2">ข้อมูลนักเรียน</h4>
            <p className="text-sm text-indigo-800 mb-3">
              พบนักเรียน {sheetData?.studentCount || 0} คน จาก Sheet "{selectedTab?.title}"
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {sheetData?.students.slice(0, 10).map((student, idx) => (
                <div key={idx} className="text-xs text-indigo-700 flex justify-between">
                  <span className="font-bold">{student.studentId}</span>
                  <span>{student.name}</span>
                </div>
              ))}
              {(sheetData?.students.length || 0) > 10 && (
                <div className="text-xs text-indigo-600 pt-2 border-t border-indigo-200 font-bold">
                  +{(sheetData?.students.length || 0) - 10} คนอื่น ๆ...
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">ชื่อรหัสวิชา</label>
              <input
                type="text"
                value={classroomDetails.subject}
                onChange={e => setClassroomDetails(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="เช่น วว101"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1.5">ระดับชั้น</label>
                <select
                  value={classroomDetails.grade}
                  onChange={e => setClassroomDetails(prev => ({ ...prev, grade: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none"
                >
                  <option value="ปวช.">ปวช.</option>
                  <option value="ปวส.">ปวส.</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1.5">สาขา</label>
                <select
                  value={classroomDetails.department}
                  onChange={e => setClassroomDetails(prev => ({ ...prev, department: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none"
                >
                  <option value="สาขาเทคโนโลยีสารสนเทศ">สาขาเทคโนโลยีสารสนเทศ</option>
                  <option value="สาขาเทคโนโลยีธุรกิจดิจิทัล">สาขาเทคโนโลยีธุรกิจดิจิทัล</option>
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
              {error}
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

  // Step 4: Success
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
