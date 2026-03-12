/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import RouteGuard from "./components/RouteGuard";
import Home from "./pages/Home";
import Quote from "./pages/Quote";
import Careers from "./pages/Careers";
import Team from "./pages/Team";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import CleanerDashboard from "./pages/CleanerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Settings from "./pages/Settings";
import FeedbackButton from "./components/FeedbackButton";

export default function App() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.title = t('common.site_name');
  }, [t, i18n.language]);

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/quote" element={<Quote />} />
              <Route path="/careers" element={<Careers />} />
              <Route path="/team" element={<Team />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={<RouteGuard><Dashboard /></RouteGuard>} />
              <Route path="/cleaner" element={<RouteGuard><CleanerDashboard /></RouteGuard>} />
              <Route path="/admin" element={<RouteGuard><AdminDashboard /></RouteGuard>} />
              <Route path="/settings" element={<RouteGuard><Settings /></RouteGuard>} />
            </Routes>
          </main>
          <Footer />
          <FeedbackButton />
        </div>
      </Router>
    </AuthProvider>
  );
}
