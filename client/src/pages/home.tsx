import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import AppHeader from "@/components/app-header";
import Sidebar from "@/components/sidebar";
import QueryWorkspace from "@/components/query-workspace";
import ApprovalSidebar from "@/components/approval-sidebar";

export default function Home() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-enterprise-gray flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-enterprise-blue mx-auto mb-4"></div>
          <p className="text-enterprise-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-enterprise-gray font-enterprise">
      <AppHeader />
      
      <div className="flex h-screen pt-16">
        <Sidebar />
        
        <div className="flex-1 flex overflow-hidden">
          <QueryWorkspace />
          <ApprovalSidebar />
        </div>
      </div>
    </div>
  );
}
