import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Home from './pages/Home';
import AdminLogin from './pages/admin/AdminLogin';
import QuizManager from './pages/admin/QuizManager';
import HostCockpit from './pages/admin/HostCockpit';
import StageScreen from './pages/stage/StageScreen';
import PlayerScreen from './pages/play/PlayerScreen';

function ProtectedHostRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0F1D] flex items-center justify-center text-slate-400">
        Authenticating session...
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Routes>
            {/* Public Home Portal */}
            <Route path="/" element={<Home />} />

            {/* Admin & Host Routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin/quizzes"
              element={
                <ProtectedHostRoute>
                  <QuizManager />
                </ProtectedHostRoute>
              }
            />
            <Route
              path="/admin/rooms/:pin/control"
              element={
                <ProtectedHostRoute>
                  <HostCockpit />
                </ProtectedHostRoute>
              }
            />

            {/* Stage Cinema Screen (Public/Projector mode) */}
            <Route path="/stage/:pin" element={<StageScreen />} />

            {/* Mobile Player Client */}
            <Route path="/play" element={<PlayerScreen />} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
