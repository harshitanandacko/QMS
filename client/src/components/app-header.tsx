import { useAuth } from "@/hooks/useAuth";
import { Database } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppHeader() {
  const { user } = useAuth();

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'team_manager':
        return 'Team Manager';
      case 'skip_manager':
        return 'Skip Manager';
      default:
        return 'Database Analyst';
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-full mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-enterprise-blue rounded-lg flex items-center justify-center">
              <Database className="text-white text-sm" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Oracle Query Management</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-enterprise-muted">
              Welcome, <span className="font-medium">{(user as any)?.firstName || (user as any)?.email || 'User'}</span>
            </span>
            <div className="flex items-center space-x-2 bg-green-100 px-3 py-1 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-green-700">{getRoleBadge((user as any)?.role)}</span>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.href = '/api/logout'}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
