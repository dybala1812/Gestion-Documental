import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { InstitutionalNavbar } from "./InstitutionalNavbar";
import { Footer } from "./Footer";
import { Toaster } from "sonner";
import { ChatBot } from "../ChatBot";
import { EleccionesAnuncio } from "../EleccionesAnuncio";
import { AuthProvider } from "../../context/AuthContext";
import { AccessibilityProvider } from "../../context/AccessibilityContext";
import { AccessibilityWidget } from "../AccessibilityWidget";
import { PageTransition } from "../PageTransition";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { GOOGLE_CLIENT_ID } from "../../lib/config";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function Layout() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <AccessibilityProvider>
    <AuthProvider>
      <div className="min-h-screen bg-background flex flex-col">
        <ScrollToTop />
        <InstitutionalNavbar />
        <main className="flex-1">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
        <Footer />
        <ChatBot />
        <AccessibilityWidget />
        <EleccionesAnuncio />
        <Toaster position="top-right" richColors />
      </div>
    </AuthProvider>
    </AccessibilityProvider>
    </GoogleOAuthProvider>
  );
}