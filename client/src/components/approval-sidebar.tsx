import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, CheckCircle, User, Mail, Hourglass, Play, Info, RotateCcw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Query {
  id: string;
  title: string;
  status: string;
  submittedBy: string;
  serverId: string;
  createdAt: string;
  submittedAt?: string;
  teamManagerId?: string;
  skipManagerId?: string;
}

interface Approval {
  id: string;
  queryId: string;
  approverType: string;
  status: string;
  createdAt: string;
}

export default function ApprovalSidebar() {
  const { user } = useAuth();
  
  // Mock current query for demonstration - in real app this would come from context or props
  const currentQuery = {
    id: 'QRY-2024-001',
    status: 'submitted',
    submittedAt: new Date().toISOString(),
  };

  // Fetch user's team information to get actual managers
  const { data: teamInfo } = useQuery<{
    id: string;
    name: string;
    managerId: string;
    skipManagerId: string;
  }>({
    queryKey: ['/api/users/me/team'],
    enabled: !!user,
  });

  // Fetch all users to get manager details
  const { data: allUsers = [] } = useQuery<Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    email: string | null;
  }>>({
    queryKey: ['/api/users'],
    enabled: !!teamInfo,
  });

  // Get actual manager details
  const teamManager = allUsers.find(u => u.id === teamInfo?.managerId);
  const skipManager = allUsers.find(u => u.id === teamInfo?.skipManagerId);

  // Default to mock data if real data not available
  const teamManagerName = teamManager ? `${teamManager.firstName || ''} ${teamManager.lastName || ''}`.trim() : 'Sarah Johnson';
  const teamManagerTitle = teamManager?.role === 'team_manager' ? 
    `${teamInfo?.name || ''} Team Manager` : 'Database Team Lead';
  
  const skipManagerName = skipManager ? `${skipManager.firstName || ''} ${skipManager.lastName || ''}`.trim() : 'Michael Chen';
  const skipManagerTitle = skipManager?.role === 'skip_manager' ? 'Skip Level Manager' : 'IT Operations Director';

  const { data: recentQueries = [] } = useQuery<Query[]>({
    queryKey: ["/api/queries"],
    select: (data) => data.slice(0, 3), // Only show recent 3 queries
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Badge className="bg-enterprise-warning text-white">Awaiting Approval</Badge>;
      case 'team_manager_approved':
        return <Badge className="bg-blue-100 text-blue-700">Team Manager Approved</Badge>;
      case 'approved':
        return <Badge className="bg-enterprise-success text-white">Approved</Badge>;
      case 'executed':
        return <Badge className="bg-green-100 text-green-700">Executed</Badge>;
      case 'rejected':
        return <Badge className="bg-enterprise-error text-white">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getApprovalStepStatus = (step: 'team_manager' | 'skip_manager', queryStatus: string) => {
    if (step === 'team_manager') {
      if (queryStatus === 'submitted') return 'pending';
      if (['team_manager_approved', 'approved', 'executed'].includes(queryStatus)) return 'approved';
      if (queryStatus === 'rejected') return 'rejected';
    }
    
    if (step === 'skip_manager') {
      if (['submitted'].includes(queryStatus)) return 'waiting';
      if (queryStatus === 'team_manager_approved') return 'pending';
      if (['approved', 'executed'].includes(queryStatus)) return 'approved';
      if (queryStatus === 'rejected') return 'rejected';
    }
    
    return 'waiting';
  };

  const renderApprovalStep = (
    type: 'team_manager' | 'skip_manager',
    title: string,
    managerName: string,
    managerRole: string,
    status: string
  ) => {
    const getStatusIcon = () => {
      switch (status) {
        case 'pending':
          return <Clock className="text-enterprise-warning text-sm" />;
        case 'approved':
          return <CheckCircle className="text-enterprise-success text-sm" />;
        case 'rejected':
          return <CheckCircle className="text-enterprise-error text-sm" />;
        default:
          return <Clock className="text-gray-400 text-sm" />;
      }
    };

    const getStatusText = () => {
      switch (status) {
        case 'pending':
          return 'Pending';
        case 'approved':
          return 'Approved';
        case 'rejected':
          return 'Rejected';
        case 'waiting':
          return 'Waiting';
        default:
          return 'Waiting';
      }
    };

    const getBgColor = () => {
      switch (status) {
        case 'pending':
          return 'bg-yellow-100';
        case 'approved':
          return 'bg-green-100';
        case 'rejected':
          return 'bg-red-100';
        default:
          return 'bg-gray-100';
      }
    };

    const opacity = status === 'waiting' ? 'opacity-60' : '';

    return (
      <div className="flex items-start space-x-3">
        <div className={`flex-shrink-0 w-8 h-8 ${getBgColor()} rounded-full flex items-center justify-center`}>
          {getStatusIcon()}
        </div>
        <div className={`flex-1 ${opacity}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900">{title}</span>
            <span className={`text-xs ${
              status === 'pending' ? 'text-enterprise-warning' :
              status === 'approved' ? 'text-enterprise-success' :
              status === 'rejected' ? 'text-enterprise-error' :
              'text-gray-500'
            }`}>
              {getStatusText()}
            </span>
          </div>
          <p className="text-xs text-enterprise-muted">{managerName}</p>
          <p className="text-xs text-enterprise-muted">{managerRole}</p>
          <div className="mt-2 flex items-center space-x-2">
            {status === 'pending' ? (
              <>
                <Mail className="text-gray-400 text-xs" />
                <span className="text-xs text-enterprise-muted">Notification sent</span>
              </>
            ) : status === 'waiting' ? (
              <>
                <Hourglass className="text-gray-400 text-xs" />
                <span className="text-xs text-enterprise-muted">Awaiting first approval</span>
              </>
            ) : (
              <>
                <CheckCircle className="text-enterprise-success text-xs" />
                <span className="text-xs text-enterprise-muted">Completed</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const teamManagerStatus = getApprovalStepStatus('team_manager', currentQuery.status);
  const skipManagerStatus = getApprovalStepStatus('skip_manager', currentQuery.status);

  return (
    <aside className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Approval Workflow</h2>
        
        {/* Current Query Status */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <Info className="text-enterprise-blue" />
            <span className="text-sm font-medium text-gray-900">Current Query Status</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Query ID:</span>
              <span className="text-sm font-mono text-gray-900">#{currentQuery.id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Status:</span>
              {getStatusBadge(currentQuery.status)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Submitted:</span>
              <span className="text-sm text-gray-900">
                {currentQuery.submittedAt 
                  ? formatDistanceToNow(new Date(currentQuery.submittedAt), { addSuffix: true })
                  : '2 min ago'
                }
              </span>
            </div>
          </div>
        </div>

        {/* Approval Chain */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-900">Approval Chain</h3>
          
          {/* Step 1: Team Manager */}
          {renderApprovalStep(
            'team_manager',
            'Team Manager',
            teamManagerName,
            teamManagerTitle,
            teamManagerStatus
          )}

          {/* Connector Line */}
          <div className="flex items-center ml-4">
            <div className="w-0.5 h-6 bg-gray-300"></div>
          </div>

          {/* Step 2: Skip Manager */}
          {renderApprovalStep(
            'skip_manager',
            'Skip Manager',
            skipManagerName,
            skipManagerTitle,
            skipManagerStatus
          )}

          {/* Connector Line */}
          <div className="flex items-center ml-4">
            <div className="w-0.5 h-6 bg-gray-300"></div>
          </div>

          {/* Step 3: Execution */}
          <div className="flex items-start space-x-3">
            <div className={`flex-shrink-0 w-8 h-8 ${
              currentQuery.status === 'executed' ? 'bg-green-100' : 'bg-gray-100'
            } rounded-full flex items-center justify-center`}>
              <Play className={`text-sm ${
                currentQuery.status === 'executed' ? 'text-enterprise-success' : 'text-gray-400'
              }`} />
            </div>
            <div className={`flex-1 ${currentQuery.status !== 'executed' ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">Query Execution</span>
                <span className={`text-xs ${
                  currentQuery.status === 'executed' ? 'text-enterprise-success' : 'text-gray-500'
                }`}>
                  {currentQuery.status === 'executed' ? 'Completed' : 'Waiting'}
                </span>
              </div>
              <p className="text-xs text-enterprise-muted">Automated execution after approvals</p>
            </div>
          </div>
        </div>

        {/* Rollback Information */}
        <div className="mt-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <RotateCcw className="text-enterprise-warning" />
            <span className="text-sm font-medium text-gray-900">Rollback Plan</span>
          </div>
          <p className="text-xs text-enterprise-muted mb-2">Automatic rollback available for this query type</p>
          <div className="flex items-center space-x-2">
            <input 
              type="checkbox" 
              id="autoRollback" 
              className="text-enterprise-blue focus:ring-enterprise-blue"
              defaultChecked
            />
            <label htmlFor="autoRollback" className="text-xs text-gray-700">
              Enable auto-rollback on error
            </label>
          </div>
        </div>

        {/* Recent Approvals */}
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Recent Queries</h3>
          <div className="space-y-2">
            {recentQueries.map((query) => (
              <div key={query.id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-900">#{query.id.slice(-3)}</span>
                  {getStatusBadge(query.status)}
                </div>
                <p className="text-xs text-enterprise-muted line-clamp-1">{query.title}</p>
                <p className="text-xs text-enterprise-muted">
                  {formatDistanceToNow(new Date(query.createdAt), { addSuffix: true })}
                </p>
              </div>
            ))}
            {recentQueries.length === 0 && (
              <div className="text-center py-4 text-enterprise-muted">
                <p className="text-xs">No recent queries</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
