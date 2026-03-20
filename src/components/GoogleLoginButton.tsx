import React, { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';

export default function GoogleLoginButton() {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null); // สถานะสำหรับเก็บข้อมูลโปรไฟล์

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('token');

    if (accessToken) {
      setToken(accessToken);
      localStorage.setItem('google_access_token', accessToken);
      // Use replaceState to clear the token from URL WITHOUT reloading the page
      window.history.replaceState({}, '', '/');
    } else {
      const savedToken = localStorage.getItem('google_access_token');
      if (savedToken) setToken(savedToken);
    }
  }, []);

  // เมื่อมี Token ให้เรียก API เพื่อดึงข้อมูลโปรไฟล์ (Gmail, รูป)
  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => {
          if (!res.ok) throw new Error("Invalid token");
          return res.json();
        })
        .then(data => setProfile(data))
        .catch(err => {
          console.error("Error fetching profile:", err);
          handleLogout(); // ถ้าระบบบอกว่า Token หมดอายุ/พัง ให้ล็อคเอาท์อัตโนมัติ
        });
    }
  }, [token]);

  const handleLogin = async () => {
    try {
      const response = await fetch('/api/auth/url');
      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Failed to get auth URL:", error);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setProfile(null);
    localStorage.removeItem('google_access_token');
  };


  return (
    <div>
      {!token ? (
        <button
          onClick={handleLogin}
          className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-md inline-flex items-center transition-colors text-sm shadow-sm"
        >
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          เข้าสู่ระบบ
        </button>
      ) : (
        <div className="flex items-center gap-3">
          {profile ? (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full shadow-sm">
              <img
                src={profile.picture}
                alt="Profile"
                className="w-7 h-7 rounded-full"
                referrerPolicy="no-referrer"
              />
              <span className="font-bold text-slate-700 text-sm hidden sm:inline-block">{profile.name}</span>
            </div>
          ) : (
            <span className="text-slate-500 text-sm animate-pulse">กำลังโหลด...</span>
          )}

          <button
            onClick={handleLogout}
            title="ออกจากระบบ"
            className="flex items-center justify-center p-2 rounded-full text-red-600 bg-red-50 hover:bg-red-500 hover:text-white transition-all shadow-sm border border-red-100"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
