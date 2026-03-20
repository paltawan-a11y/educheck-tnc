import express from "express";
import path from "path";
import { google } from "googleapis";
import dotenv from "dotenv";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// ========== Simple JSON-based database (Fallback for logs only) ==========
const DATA_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch(e) {}
  }
}


interface Student {
  studentId: string;
  name: string;
  nickname?: string;
}

interface Classroom {
  id: string;
  ownerEmail: string;
  name: string;
  subject: string;
  grade: string;
  year: string;
  department: string;
  room: string;
  spreadsheetId: string;
  students: Student[];
  activeSessionId?: string;
  sheetTabName?: string;
  attendanceSpreadsheetId?: string;
  scoringSpreadsheetId?: string;
  scoringSheetTabName?: string;
  createdAt: string;
}

// Supabase Helpers (replacing readClassrooms/writeClassrooms)
async function getSupabaseClassrooms(): Promise<Classroom[]> {
  const { data, error } = await supabase.from('classrooms').select('*');
  if (error) {
    console.error("Supabase Error (Fetch):", error);
    return [];
  }
  return data.map((item: any) => ({
    ...item.data,
    id: item.id,
    ownerEmail: item.owner_email
  }));
}

async function getSupabaseClassroomById(id: string): Promise<Classroom | null> {
  const { data, error } = await supabase.from('classrooms').select('*').eq('id', id).single();
  if (error || !data) return null;
  return {
    ...data.data,
    id: data.id,
    ownerEmail: data.owner_email
  };
}

async function upsertSupabaseClassroom(classroom: Classroom) {
  const { id, ownerEmail, ...rest } = classroom;
  const { error } = await supabase.from('classrooms').upsert({
    id,
    owner_email: ownerEmail,
    data: rest
  });
  if (error) console.error("Supabase Error (Upsert):", error);
}

async function deleteSupabaseClassroom(id: string) {
  const { error } = await supabase.from('classrooms').delete().eq('id', id);
  if (error) console.error("Supabase Error (Delete):", error);
}

// Extract email from Authorization Bearer token
async function getEmailFromToken(authHeader: string | undefined): Promise<string | null> {
  try {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    const token = authHeader.split(" ")[1];
    if (!token) return null;

    const userOauth = new google.auth.OAuth2();
    userOauth.setCredentials({ access_token: token });
    const oauth2 = google.oauth2({ auth: userOauth, version: "v2" });
    const { data } = await oauth2.userinfo.get();
    return data.email || null;
  } catch (error: any) {
    console.error("Error extracting email from token:", error.message);
    return null;
  }
}

function getColumnLetter(colIndex: number): string {
  let letter = '';
  while (colIndex >= 0) {
    let temp = colIndex % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colIndex = Math.floor((colIndex - temp) / 26) - 1;
  }
  return letter;
}

// ========== Main Server ==========
// ========== Main Server Setup ==========
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- Google OAuth2 Setup ---
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// ========== Main Server Function ==========
async function startServer() {
  const PORT_RUN = Number(process.env.PORT || 3000);

  // GET search student by ID across ALL classrooms (Move to top to avoid path conflicts)
  // GET search student by ID across ALL classrooms
  app.get("/api/students/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q) return res.status(400).json({ error: "กรุณาระบุรหัสที่ต้องการค้นหา" });

      const query = String(q).trim();
      const classrooms = await getSupabaseClassrooms();
      
      for (const classroom of classrooms) {
        if (!classroom.students) continue;
        const student = classroom.students.find(s => 
          String(s.studentId).trim() === query || 
          String(s.name).replace(/\s+/g, '').includes(query)
        );
        if (student) {
          return res.json({
            studentId: student.studentId,
            name: student.name
          });
        }
      }
      
      res.status(404).json({ error: "ไม่พบข้อมูลนักเรียนในระบบ" });
    } catch (e) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });


  // =========================================================
  // ===== CLASSROOM MANAGEMENT APIs =========================
  // =========================================================

  // GET all classrooms for logged-in user
  // GET all classrooms for logged-in user
  app.get("/api/classrooms", async (req, res) => {
    try {
      const email = await getEmailFromToken(req.headers.authorization);
      if (!email) {
        return res.status(401).json({ error: "ไม่พบการยืนยัน กรุณาเข้าสู่ระบบ" });
      }
      
      const { data: userClassrooms, error } = await supabase
        .from('classrooms')
        .select('*')
        .eq('owner_email', email);
        
      if (error) throw error;
      
      const summary = (userClassrooms || []).map((item: any) => {
        const cls = item.data;
        return {
          ...cls,
          id: item.id,
          ownerEmail: item.owner_email,
          studentCount: (cls.students || []).length
        };
      });
      res.json(summary);
    } catch (error: any) {
      console.error("Get classrooms error:", error);
      res.status(500).json({ error: "เกิดข้อผิดพลาด" });
    }
  });

  // POST generate new session for a classroom
  // POST generate new session for a classroom
  app.post("/api/classrooms/:id/session", async (req, res) => {
    try {
      const classroom = await getSupabaseClassroomById(req.params.id);
      
      if (!classroom) {
        return res.status(404).json({ error: "ไม่พบห้องเรียน" });
      }
      
      const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      classroom.activeSessionId = newSessionId;
      await upsertSupabaseClassroom(classroom);
      
      res.json({ sessionId: newSessionId, classroomId: req.params.id });
    } catch (error: any) {
      console.error("[Session API] Error:", error);
      res.status(500).json({ error: "ไม่สามารถสร้าง session ได้" });
    }
  });

  // POST create a new classroom
  // POST create a new classroom
  app.post("/api/classrooms", async (req, res) => {
    try {
      const { name, subject, grade, year, department, room, spreadsheetId } = req.body;
      const email = await getEmailFromToken(req.headers.authorization);
      
      if (!email) {
        return res.status(401).json({ error: "ไม่พบการยืนยัน กรุณาเข้าสู่ระบบ" });
      }

      if (!name || !subject || !grade || !department) {
        return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบ (ชื่อ, วิชา, ระดับ, สาขา)" });
      }
      
      const newClassroom: Classroom = {
        id: `cls_${Date.now()}`,
        ownerEmail: email,
        name,
        subject,
        grade,
        year: year || "1",
        department,
        room: room || "",
        spreadsheetId: spreadsheetId || "",
        students: [],
        activeSessionId: "",
        sheetTabName: "",
        attendanceSpreadsheetId: "",
        createdAt: new Date().toISOString(),
      };
      
      await upsertSupabaseClassroom(newClassroom);
      res.json(newClassroom);
    } catch (error: any) {
      console.error("Create classroom error:", error);
      res.status(500).json({ error: "เกิดข้อผิดพลาด" });
    }
  });

  // PATCH update classroom settings
  // PATCH update classroom settings
  app.patch("/api/classrooms/:id", async (req, res) => {
    try {
      const email = await getEmailFromToken(req.headers.authorization);
      if (!email) return res.status(401).json({ error: "Unauthorized" });

      const classroom = await getSupabaseClassroomById(req.params.id);
      if (!classroom) return res.status(404).json({ error: "Not found" });

      if (classroom.ownerEmail !== email) {
        return res.status(403).json({ error: "Forbbiden" });
      }

      const updates = req.body;
      
      const newClassroom = {
        ...classroom,
        ...updates,
        year: updates.year !== undefined ? String(updates.year) : classroom.year,
        room: updates.room !== undefined ? String(updates.room) : classroom.room
      };

      await upsertSupabaseClassroom(newClassroom);
      res.json(newClassroom);
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // DELETE a classroom
  app.delete("/api/classrooms/:id", async (req, res) => {
    try {
      const email = await getEmailFromToken(req.headers.authorization);
      if (!email) {
        return res.status(401).json({ error: "ไม่พบการยืนยัน กรุณาเข้าสู่ระบบ" });
      }
      
      const classroom = await getSupabaseClassroomById(req.params.id);
      if (!classroom) return res.status(404).json({ error: "ไม่พบห้องเรียน" });
      
      if (classroom.ownerEmail !== email) {
        return res.status(403).json({ error: "คุณไม่มีสิทธิ์ลบห้องเรียนนี้" });
      }
      
      await deleteSupabaseClassroom(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete classroom error:", error);
      res.status(500).json({ error: "เกิดข้อผิดพลาด" });
    }
  });

  // GET specific classroom with students (public read for students to check-in)
  app.get("/api/classrooms/:id", async (req, res) => {
    try {
      const classroom = await getSupabaseClassroomById(req.params.id);
      if (!classroom) return res.status(404).json({ error: "ไม่พบห้องเรียน" });
      
      const isOwner = req.headers.authorization ? true : false;
      if (isOwner) {
        res.json(classroom);
      } else {
        const { students, ...publicData } = classroom;
        res.json({
          ...publicData,
          studentCount: students.length
        });
      }
    } catch (error: any) {
      console.error("Get classroom error:", error);
      res.status(500).json({ error: "เกิดข้อผิดพลาด" });
    }
  });

  // POST upload/replace students in a classroom
  // POST upload/replace students in a classroom
  app.post("/api/classrooms/:id/students", async (req, res) => {
    try {
      const { students } = req.body as { students: Student[] };
      const email = await getEmailFromToken(req.headers.authorization);
      
      if (!email) return res.status(401).json({ error: "ไม่พบการยืนยัน" });
      if (!Array.isArray(students)) return res.status(400).json({ error: "รูปแบบไม่ถูกต้อง" });
      
      const classroom = await getSupabaseClassroomById(req.params.id);
      if (!classroom) return res.status(404).json({ error: "ไม่พบห้องเรียน" });
      
      if (classroom.ownerEmail !== email) {
        return res.status(403).json({ error: "No permission" });
      }
      
      classroom.students = students;
      await upsertSupabaseClassroom(classroom);
      res.json({ success: true, count: students.length });
    } catch (error: any) {
      res.status(500).json({ error: "Error" });
    }
  });
  // GET lookup student by ID in a classroom (for student check-in)
  // GET lookup student by ID in a classroom (for student check-in)
  app.get("/api/classrooms/:id/students/:studentId", async (req, res) => {
    const classroom = await getSupabaseClassroomById(req.params.id);
    if (!classroom) return res.status(404).json({ error: "ไม่พบห้องเรียน" });
    const student = classroom.students.find((s) => {
      const searchId = String(req.params.studentId).trim();
      return String(s.studentId).trim() === searchId || String(s.name).replace(/\s+/g, '').includes(searchId);
    });
    if (!student) return res.status(404).json({ error: "ไม่พบรหัสนักเรียนนี้ในรายชื่อ" });
    res.json(student);
  });


  // GET Sync roster from Google Sheet
  app.get("/api/classrooms/:id/sync-sheets", async (req, res) => {
    try {
      const email = await getEmailFromToken(req.headers.authorization);
      if (!email) {
        return res.status(401).json({ error: "ไม่พบการยืนยัน" });
      }
      
      const classroom = await getSupabaseClassroomById(req.params.id);
      if (!classroom) return res.status(404).json({ error: "ไม่พบห้องเรียน" });
      
      if (classroom.ownerEmail !== email) {
        return res.status(403).json({ error: "No permission" });
      }
      
      const spreadsheetId = classroom.spreadsheetId || process.env.GOOGLE_SHEET_ID;
      if (!spreadsheetId) return res.status(400).json({ error: "Missing Sheet ID" });

      const authClient = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), "service-account.json.json"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });
      const sheets = google.sheets({ version: "v4", auth: authClient });
      
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetName = classroom.sheetTabName || spreadsheet.data.sheets?.[0].properties?.title || "Sheet1";

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:B`,
      });

      const rows = response.data.values || [];
      if (rows.length < 2) return res.status(400).json({ error: "No data rows" });

      const syncedStudents: any[] = rows.slice(1).map(row => ({
        studentId: String(row[0] || '').trim(),
        name: String(row[1] || '').trim()
      })).filter(s => s.studentId && s.name);

      if (syncedStudents.length === 0) return res.status(400).json({ error: "No valid students" });

      classroom.students = syncedStudents;
      classroom.sheetTabName = sheetName;
      await upsertSupabaseClassroom(classroom);

      res.json({ success: true, count: syncedStudents.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =========================================================
  // ===== ATTENDANCE API ====================================
  // =========================================================

  // POST save attendance to Google Sheet (Checklist Format)
  app.post("/api/attendance", async (req, res) => {
    try {
      const { studentId, name, grade, room, classroomId, spreadsheetId: reqSheetId, sessionId } = req.body;

      const classroom = await getSupabaseClassroomById(classroomId);
      if (!classroom) return res.status(404).json({ error: "ไม่พบห้องเรียน" });
      
      if (classroom.activeSessionId && classroom.activeSessionId !== sessionId) {
        return res.status(403).json({ error: "QR Code หมดอายุแล้ว กรุณาสแกนใหม่" });
      }

      const spreadsheetId = reqSheetId || classroom.attendanceSpreadsheetId || classroom.spreadsheetId || process.env.GOOGLE_SHEET_ID || "";
      if (!spreadsheetId) {
        return res.status(400).json({ error: "ไม่ได้ตั้งค่า Google Sheet ID สำหรับการบันทึก" });
      }

      // Use Service Account auth
      let authClient: any;
      try {
        authClient = new google.auth.GoogleAuth({
          keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), "service-account.json.json"),
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
      } catch {
        // Fallback local logging
        const logFile = path.join(DATA_DIR, "attendance_log.json");
        let logs: any[] = [];
        if (fs.existsSync(logFile)) logs = JSON.parse(fs.readFileSync(logFile, "utf-8"));
        logs.push({ timestamp: new Date().toLocaleDateString("th-TH"), studentId, name, classroomId });
        fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
        return res.json({ success: true, mode: "local" });
      }

      const sheets = google.sheets({ version: "v4", auth: authClient });
      
      // สร้างชื่อ Sheet ตามรูปแบบ: [วิชา] [ระดับ] [ปี]/[ห้อง] [สาขาย่อ]
      const deptAbbr = classroom.department.includes("เทคโนโลยีสารสนเทศ") ? "ทส." : "ทธด.";
      const generatedSheetName = `${classroom.name} ${classroom.grade}${classroom.year}/${classroom.room} ${deptAbbr}`.trim();
      const sheetName = classroom.sheetTabName || generatedSheetName; 
      
      const today = new Date().toLocaleDateString("th-TH");

      // 1. Ensure Sheet exists and is initialized
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      let sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName);
      let currentSheetId = sheet?.properties?.sheetId;

      if (!sheet) {
        // สร้าง Sheet ใหม่สำหรับวิชานี้
        const addSheetResponse = await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
        });
        
        // ดึง sheetId ที่เพิ่งสร้างมา
        currentSheetId = addSheetResponse.data.replies?.[0]?.addSheet?.properties?.sheetId;

        // เตรียมข้อมูลรายชื่อนักเรียนทั้งหมด (เอาสาขาออก)
        const initialRows = [
          ["รหัสนักศึกษา", "ชื่อ-นามสกุล"],
          ...(classroom.students || []).map(s => [s.studentId, s.name])
        ];

        // เขียนข้อมูลเริ่มต้น (Headers + Roster)
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: "RAW",
          requestBody: { values: initialRows },
        });
      }

      // 2. Fetch current sheet data to find student row and date column
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:Z`, 
      });
      const rows = response.data.values || [];
      const headerRow = rows[0] || ["รหัสนักศึกษา", "ชื่อ-นามสกุล"];

      // 3. Handle Student Row (Find student row index)
      let studentRowIndex = rows.findIndex(row => row[0] === studentId);
      
      if (studentRowIndex === -1) {
        // หากไม่อยู่ในรายชื่อเดิม (เช่น เพิ่มมาระหว่างเทอม) ให้ต่อท้าย (เอาสาขาออก)
        const newStudentRow = [studentId, name];
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: "RAW",
          requestBody: { values: [newStudentRow] },
        });
        // Re-fetch เพื่อหา index ใหม่
        const updatedRows = (await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A:A` })).data.values || [];
        studentRowIndex = updatedRows.length - 1;
      }

      // 4. Handle Date Column (Find today's column)
      let dateColIndex = headerRow.findIndex(cell => cell === today);
      if (dateColIndex === -1) {
        dateColIndex = headerRow.length;
        const colLetter = getColumnLetter(dateColIndex);
        
        // เพิ่มหัวตารางวันที่
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!${colLetter}1`,
          valueInputOption: "RAW",
          requestBody: { values: [[today]] },
        });

        // สร้าง Checkbox (ค่าเริ่มต้นเป็น FALSE) สำหรับทุกแถวที่มีนักเรียน
        const rowCount = Math.max(rows.length, (classroom.students?.length || 0) + 1);
        const dataValidationRange = {
            sheetId: currentSheetId,
            startRowIndex: 1, // ข้ามหัวตาราง
            endRowIndex: rowCount,
            startColumnIndex: dateColIndex,
            endColumnIndex: dateColIndex + 1,
        };

        // ใช้ batchUpdate เพื่อใส่ Data Validation ให้เป็น Checkbox
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                setDataValidation: {
                  range: dataValidationRange,
                  rule: {
                    condition: { type: "BOOLEAN" },
                    showCustomUi: true,
                  },
                },
              },
            ],
          },
        });

        // ตั้งค่าเริ่มต้นให้เป็น FALSE (ช่องว่างที่ยังไม่เช็ค)
        const initialCheckboxes = new Array(rowCount - 1).fill([false]);
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!${colLetter}2:${colLetter}${rowCount}`,
          valueInputOption: "RAW",
          requestBody: { values: initialCheckboxes },
        });
      }

      // 5. Mark Attendance (TRUE as boolean for checkbox)
      const markColLetter = getColumnLetter(dateColIndex);
      const markRange = `${sheetName}!${markColLetter}${studentRowIndex + 1}`;
      
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: markRange,
        valueInputOption: "RAW",
        requestBody: { values: [[true]] }, // ติ๊กถูก Checkbox โดยส่งค่า boolean
      });

      res.json({ success: true, checklist: true });
    } catch (error: any) {
      console.error("Attendance Checklist Error:", error);
      let errorMsg = error.message;
      if (error.response && error.response.status === 403) {
        errorMsg = "Service Account ไม่มีสิทธิ์เข้าถึง Google Sheet กรุณาแชร์ Sheet ให้กับอีเมล Service Account แบบ Editor";
      } else if (error.response && error.response.status === 404) {
        errorMsg = "ไม่พบ Google Sheet หรือไม่ได้แชร์ให้กับ Service Account";
      }
      res.status(500).json({ error: errorMsg });
    }
  });

  // POST save score to Google Sheet
  app.post("/api/score", async (req, res) => {
    try {
      const { studentId, name, classroomId, spreadsheetId: reqSheetId, taskName, score } = req.body;

      if (!classroomId || !studentId || !taskName) {
         return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วน (classroomId, studentId, taskName)" });
      }

      const classroom = await getSupabaseClassroomById(classroomId);
      if (!classroom) return res.status(404).json({ error: "ไม่พบห้องเรียน" });

      const spreadsheetId = reqSheetId || classroom.scoringSpreadsheetId || classroom.attendanceSpreadsheetId || classroom.spreadsheetId || process.env.GOOGLE_SHEET_ID || "";
      if (!spreadsheetId) {
        return res.status(400).json({ error: "ไม่ได้ตั้งค่า Google Sheet ID สำหรับการบันทึก" });
      }

      const authClient = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), "service-account.json.json"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const sheets = google.sheets({ version: "v4", auth: authClient });
      
      const deptAbbr = classroom.department.includes("เทคโนโลยีสารสนเทศ") ? "ทส." : "ทธด.";
      const generatedSheetName = `${classroom.name} ${classroom.grade}${classroom.year}/${classroom.room} ${deptAbbr}`.trim();
      const sheetName = classroom.scoringSheetTabName || classroom.sheetTabName || generatedSheetName; 

      // 1. Ensure Sheet exists
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      let sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName);
      
      if (!sheet) {
        // Create new Sheet if not exists
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
        });
        
        const initialRows = [
          ["รหัสนักศึกษา", "ชื่อ-นามสกุล"],
          ...(classroom.students || []).map(s => [s.studentId, s.name])
        ];

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: "RAW",
          requestBody: { values: initialRows },
        });
      }

      // 2. Fetch data
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:Z`, 
      });
      const rows = response.data.values || [];
      const headerRow = rows[0] || ["รหัสนักศึกษา", "ชื่อ-นามสกุล"];

      // 3. Find Student Row
      let studentRowIndex = rows.findIndex(row => String(row[0]).trim() === String(studentId).trim());
      if (studentRowIndex === -1) {
        const newStudentRow = [studentId, name];
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: "RAW",
          requestBody: { values: [newStudentRow] },
        });
        const updatedRows = (await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A:A` })).data.values || [];
        studentRowIndex = updatedRows.length - 1;
      }

      // 4. Find/Create Task Column
      let taskColIndex = headerRow.findIndex(cell => cell === taskName);
      if (taskColIndex === -1) {
        taskColIndex = headerRow.length;
        const colLetter = getColumnLetter(taskColIndex);
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!${colLetter}1`,
          valueInputOption: "RAW",
          requestBody: { values: [[taskName]] },
        });
      }

      // 5. Write Score
      const markColLetter = getColumnLetter(taskColIndex);
      const markRange = `${sheetName}!${markColLetter}${studentRowIndex + 1}`;
      
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: markRange,
        valueInputOption: "RAW",
        requestBody: { values: [[score]] },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Scoring Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // =========================================================
  // ===== GOOGLE SHEETS Integration APIs ====================
  // =========================================================

  // GET list of Google Sheets from user's Google Drive
  app.get("/api/google/sheets", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "ไม่พบการยืนยัน" });
      }
      
      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(401).json({ error: "Token ไม่ถูกต้อง" });
      }
      
      const userOauth = new google.auth.OAuth2();
      userOauth.setCredentials({ access_token: token });
      
      const drive = google.drive({ version: "v3", auth: userOauth });
      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        spaces: "drive",
        fields: "files(id, name, createdTime, modifiedTime)",
        pageSize: 50,
        orderBy: "modifiedTime desc",
      });
      
      const files = response.data.files || [];
      console.log(`[Google Sheets API] Found ${files.length} sheets`);
      res.json({ files });
    } catch (error: any) {
      console.error("Google Sheets List Error:", error.message || error);
      const errorMsg = error.message || 'ไม่สามารถดึงรายการ Google Sheets ได้';
      res.status(500).json({ error: errorMsg });
    }
  });

  // GET sheets metadata from a Google Sheet
  app.get("/api/google/sheets/:spreadsheetId/metadata", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const token = authHeader.split(" ")[1];
      const userOauth = new google.auth.OAuth2();
      userOauth.setCredentials({ access_token: token });
      
      const sheets = google.sheets({ version: "v4", auth: userOauth });
      const response = await sheets.spreadsheets.get({
        spreadsheetId: req.params.spreadsheetId,
      });
      
      const sheetList = response.data.sheets?.map(s => ({
        title: s.properties?.title,
        sheetId: s.properties?.sheetId,
        gridProperties: s.properties?.gridProperties,
      })) || [];
      
      console.log(`[Sheets Metadata] Retrieved ${sheetList.length} sheets from ${req.params.spreadsheetId}`);
      res.json({ 
        spreadsheetId: req.params.spreadsheetId,
        spreadsheetTitle: response.data.properties?.title,
        sheets: sheetList
      });
    } catch (error: any) {
      console.error("Sheets Metadata Error:", error.message || error);
      const errorMsg = error.message || 'ไม่สามารถดึงข้อมูล metadata ได้';
      res.status(500).json({ error: errorMsg });
    }
  });

  // GET sheet data (to preview and create classroom)
  app.get("/api/google/sheets/:spreadsheetId/sheet/:sheetName", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "ไม่พบการยืนยัน" });
      }
      const token = authHeader.split(" ")[1];
      const userOauth = new google.auth.OAuth2();
      userOauth.setCredentials({ access_token: token });
      
      const sheets = google.sheets({ version: "v4", auth: userOauth });
      const sheetName = decodeURIComponent(req.params.sheetName);
      
      // Read all data from the sheet
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: req.params.spreadsheetId,
        range: `${sheetName}!A:B`, // First 2 columns: ID, Name
      });
      
      const rows = response.data.values || [];
      if (rows.length < 1) {
        return res.status(400).json({ error: "Sheet ว่าง ไม่มีข้อมูล" });
      }
      
      // First row is header, rest are students
      const dataRows = rows.slice(1);
      const students: Student[] = dataRows
        .map(row => ({
          studentId: String(row[0] || '').trim(),
          name: String(row[1] || '').trim()
        }))
        .filter(s => s.studentId && s.name);
      
      console.log(`[Sheet Data] Retrieved ${students.length} students from ${sheetName}`);
      res.json({ 
        sheetName,
        studentCount: students.length,
        students
      });
    } catch (error: any) {
      console.error("Sheet Data Error:", error.message || error)
      const errorMsg = error.message || 'ไม่สามารถดึงข้อมูล sheet ได้';
      res.status(500).json({ error: errorMsg });
    }
  });

  // POST create classroom from Google Sheet
  app.post("/api/classrooms/from-sheet", async (req, res) => {
    try {
      const { spreadsheetId, sheetName, classroomName, grade, year, department, subject, room } = req.body;
      
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const token = authHeader.split(" ")[1];
      
      // Get email from token
      const email = await getEmailFromToken(req.headers.authorization);
      if (!email) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      if (!spreadsheetId || !sheetName) {
        return res.status(400).json({ error: "Missing spreadsheetId or sheetName" });
      }
      
      const userOauth = new google.auth.OAuth2();
      userOauth.setCredentials({ access_token: token });
      
      const sheets = google.sheets({ version: "v4", auth: userOauth });
      const decodedSheetName = decodeURIComponent(sheetName);
      
      // Read students from sheet
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${decodedSheetName}!A:B`, // First 2 columns: ID, Name
      });
      
      const rows = response.data.values || [];
      const dataRows = rows.slice(1);
      const students: Student[] = dataRows
        .map(row => ({
          studentId: String(row[0] || '').trim(),
          name: String(row[1] || '').trim()
        }))
        .filter(s => s.studentId && s.name);
      
      const finalRoom = String(room || req.body.room || "").trim();
      const finalGrade = String(grade || req.body.grade || "ปวช.");
      const finalYear = String(year || req.body.year || "1");

      // Create classroom from sheet
      const newClassroom: Classroom = {
        id: `cls_${Date.now()}`,
        ownerEmail: email,
        name: classroomName || decodedSheetName,
        subject: subject || decodedSheetName,
        grade: finalGrade,
        year: finalYear,
        department: department || "สาขาเทคโนโลยีสารสนเทศ",
        room: finalRoom,
        spreadsheetId,
        students,
        activeSessionId: "",
        sheetTabName: decodedSheetName,
        attendanceSpreadsheetId: "",
        createdAt: new Date().toISOString(),
      };
      
      await upsertSupabaseClassroom(newClassroom);
      res.json({ success: true, classroom: newClassroom });
    } catch (error: any) {
      console.error("Create Classroom Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // =========================================================
  // ===== GOOGLE AUTH APIs ==================================
  // =========================================================

  app.get("/api/auth/url", (req, res) => {
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/classroom.courses.readonly",
        "https://www.googleapis.com/auth/classroom.rosters.readonly",
        "https://www.googleapis.com/auth/classroom.profile.emails",
        "https://www.googleapis.com/auth/classroom.coursework.students.readonly",
      ],
    });
    res.json({ url });
  });

  app.get("/api/auth/callback", async (req, res) => {
    const { code } = req.query;
    try {
      if (!code || typeof code !== "string") throw new Error("No code provided");
      const { tokens } = await oauth2Client.getToken(code);
      res.redirect(`/?token=${tokens.access_token}`);
    } catch (error) {
      console.error("Auth Error:", error);
      res.redirect("/?error=auth_failed");
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const token = authHeader.split(" ")[1];
      const userOauth = new google.auth.OAuth2();
      userOauth.setCredentials({ access_token: token });
      const oauth2 = google.oauth2({ auth: userOauth, version: "v2" });
      const { data } = await oauth2.userinfo.get();
      res.json(data);
    } catch (error: any) {
      console.error("Fetch profile Error:", error);
      res.status(500).json({ error: "Failed to fetch user profile" });
    }
  });

  // =========================================================
  // ===== GOOGLE CLASSROOM APIs =============================
  // =========================================================

  app.get("/api/classroom/courses", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const token = authHeader.split(" ")[1];
      const userOauth = new google.auth.OAuth2();
      userOauth.setCredentials({ access_token: token });
      const classroom = google.classroom({ version: "v1", auth: userOauth });
      const response = await classroom.courses.list({ courseStates: ["ACTIVE"] });
      res.json(response.data);
    } catch (error: any) {
      console.error("Classroom Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/classroom/courses/:courseId/dashboard", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const token = authHeader.split(" ")[1];
      const courseId = req.params.courseId;
      const userOauth = new google.auth.OAuth2();
      userOauth.setCredentials({ access_token: token });
      const classroom = google.classroom({ version: "v1", auth: userOauth });

      let students: any[] = [];
      try {
        const rosterRes = await classroom.courses.students.list({ courseId });
        students = rosterRes.data.students || [];
      } catch (e: any) {
        console.log("Error fetching students:", e.message);
      }

      let courseWorks: any[] = [];
      try {
        const worksRes = await classroom.courses.courseWork.list({ courseId });
        courseWorks = worksRes.data.courseWork || [];
      } catch (e: any) {
        console.log("Error fetching coursework:", e.message);
      }

      const studentStats: Record<string, {
        id: string; name: string; email: string;
        submitted: number; total: number; score: number;
        maxScore: number; missingAssignments: string[];
      }> = {};

      students.forEach((s) => {
        studentStats[s.userId] = {
          id: s.userId,
          name: s.profile?.name?.fullName || "Unknown",
          email: s.profile?.emailAddress || "",
          submitted: 0,
          total: courseWorks.length,
          score: 0,
          maxScore: 0,
          missingAssignments: courseWorks.map((cw) => cw.title),
        };
      });

      let totalSubmissions = 0;
      const totalExpected = students.length * courseWorks.length;
      let lateSubmissions = 0;

      for (const work of courseWorks) {
        try {
          const subRes = await classroom.courses.courseWork.studentSubmissions.list({
            courseId,
            courseWorkId: work.id,
          });
          const submissions = subRes.data.studentSubmissions || [];
          submissions.forEach((sub) => {
            if (studentStats[sub.userId]) {
              if (sub.state === "TURNED_IN" || sub.state === "RETURNED") {
                studentStats[sub.userId].submitted += 1;
                totalSubmissions += 1;
                studentStats[sub.userId].missingAssignments =
                  studentStats[sub.userId].missingAssignments.filter(
                    (title) => title !== work.title
                  );
              }
              if (sub.late) lateSubmissions += 1;
              if (sub.assignedGrade !== undefined)
                studentStats[sub.userId].score += sub.assignedGrade;
              if (work.maxPoints) studentStats[sub.userId].maxScore += work.maxPoints;
            }
          });
        } catch (e: any) {
          console.log("Error fetching submissions for work:", work.id, e.message);
        }
      }

      const stats = Object.values(studentStats).map((s) => {
        const isCompleted = s.total > 0 && s.submitted === s.total;
        const scorePercent = s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : null;
        return {
          ...s,
          status: isCompleted ? "ส่งครบแล้ว" : s.submitted > 0 ? "ส่งบางส่วน" : "ยังไม่ส่ง",
          scorePercent,
        };
      });

      const submittedPercent =
        totalExpected > 0 ? Math.round((totalSubmissions / totalExpected) * 100) : 0;
      const latePercent =
        totalSubmissions > 0 ? Math.round((lateSubmissions / totalSubmissions) * 100) : 0;

      res.json({
        studentCount: students.length,
        assignmentCount: courseWorks.length,
        submittedPercent,
        latePercent,
        notSubmittedPercent: 100 - submittedPercent,
        students: stats,
      });
    } catch (error: any) {
      console.error("Dashboard Error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  });
  const FINAL_PORT = Number(process.env.PORT || 3000);
  if (!process.env.VERCEL) {
    app.listen(FINAL_PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${FINAL_PORT}`);
    });
  }
}

startServer();

export default app;
