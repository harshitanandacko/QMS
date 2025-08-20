import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import AppHeader from "@/components/app-header";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Clock, CheckCircle, XCircle, User, Database, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Query {
  id: string;
  title: string;
  description?: string;
  sqlQuery: string;
  queryType: string;
  status: string;
  submittedBy: string;
  serverId: string;
  createdAt: string;
  submittedAt?: string;
}

export default function Approvals() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [selectedQuery, setSelectedQuery] = useState<Query | null>(null);
  const [comments, setComments] = useState("");

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

  const { data: pendingQueries = [], isLoading: isLoadingQueries } = useQuery({
    queryKey: ["/api/approvals/pending"],
    enabled: !!user && ((user as any).role === 'team_manager' || (user as any).role === 'skip_manager'),
  });

  const approveMutation = useMutation({
    mutationFn: async ({ approvalId, comments }: { approvalId: string; comments: string }) => {
      await apiRequest("POST", `/api/approvals/${approvalId}/approve`, { comments });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Query approved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/approvals/pending"] });
      setSelectedQuery(null);
      setComments("");
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to approve query",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ approvalId, comments }: { approvalId: string; comments: string }) => {
      await apiRequest("POST", `/api/approvals/${approvalId}/reject`, { comments });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Query rejected",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/approvals/pending"] });
      setSelectedQuery(null);
      setComments("");
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to reject query",
        variant: "destructive",
      });
    },
  });

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
    return null;
  }

  if (!user || (user.role !== 'team_manager' && user.role !== 'skip_manager')) {
    return (
      <div className="min-h-screen bg-enterprise-gray font-enterprise">
        <AppHeader />
        <div className="flex h-screen pt-16">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto text-center">
              <XCircle className="w-16 h-16 text-enterprise-error mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
              <p className="text-enterprise-muted">
                You don't have permission to access the approvals page. 
                Only Team Managers and Skip Managers can approve queries.
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Badge variant="outline" className="text-enterprise-warning border-enterprise-warning">Pending Team Manager</Badge>;
      case 'team_manager_approved':
        return <Badge variant="outline" className="text-blue-600 border-blue-600">Pending Skip Manager</Badge>;
      case 'approved':
        return <Badge variant="outline" className="text-enterprise-success border-enterprise-success">Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-enterprise-error border-enterprise-error">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getQueryTypeBadge = (type: string) => {
    const colors = {
      select: 'bg-blue-100 text-blue-700',
      insert: 'bg-green-100 text-green-700',
      update: 'bg-yellow-100 text-yellow-700',
      delete: 'bg-red-100 text-red-700',
    };
    return <Badge variant="secondary" className={colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-700'}>{type.toUpperCase()}</Badge>;
  };

  return (
    <div className="min-h-screen bg-enterprise-gray font-enterprise">
      <AppHeader />
      
      <div className="flex h-screen pt-16">
        <Sidebar />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Pending Approvals</h1>
              <p className="text-enterprise-muted">
                Review and approve queries submitted for {user.role === 'team_manager' ? 'team manager' : 'skip manager'} approval
              </p>
            </div>

            {isLoadingQueries ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-enterprise-blue mx-auto mb-4"></div>
                <p className="text-enterprise-muted">Loading pending approvals...</p>
              </div>
            ) : pendingQueries.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <CheckCircle className="w-16 h-16 text-enterprise-success mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Approvals</h3>
                  <p className="text-enterprise-muted">
                    All queries have been reviewed. New submissions will appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Query List */}
                <div className="space-y-4">
                  {pendingQueries.map((query: Query) => (
                    <Card 
                      key={query.id} 
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedQuery?.id === query.id ? 'ring-2 ring-enterprise-blue' : ''
                      }`}
                      onClick={() => setSelectedQuery(query)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">{query.title}</CardTitle>
                            <div className="flex items-center space-x-2 mt-2">
                              {getStatusBadge(query.status)}
                              {getQueryTypeBadge(query.queryType)}
                            </div>
                          </div>
                          <Clock className="w-5 h-5 text-enterprise-muted" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center space-x-2 text-enterprise-muted">
                            <User className="w-4 h-4" />
                            <span>Submitted by: {query.submittedBy}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-enterprise-muted">
                            <Database className="w-4 h-4" />
                            <span>Server: {query.serverId}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-enterprise-muted">
                            <Calendar className="w-4 h-4" />
                            <span>
                              Submitted {query.submittedAt ? formatDistanceToNow(new Date(query.submittedAt), { addSuffix: true }) : 'recently'}
                            </span>
                          </div>
                        </div>
                        {query.description && (
                          <p className="text-sm text-enterprise-muted mt-3 line-clamp-2">
                            {query.description}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Query Detail */}
                <div className="lg:sticky lg:top-6">
                  {selectedQuery ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>Query Details</span>
                          <div className="flex items-center space-x-2">
                            {getStatusBadge(selectedQuery.status)}
                            {getQueryTypeBadge(selectedQuery.queryType)}
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Query Info */}
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Query Information</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-enterprise-muted">Title:</span>
                              <span className="font-medium">{selectedQuery.title}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-enterprise-muted">Server:</span>
                              <span className="font-medium">{selectedQuery.serverId}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-enterprise-muted">Submitted by:</span>
                              <span className="font-medium">{selectedQuery.submittedBy}</span>
                            </div>
                          </div>
                          {selectedQuery.description && (
                            <div className="mt-3">
                              <span className="text-enterprise-muted text-sm">Description:</span>
                              <p className="text-sm mt-1">{selectedQuery.description}</p>
                            </div>
                          )}
                        </div>

                        <Separator />

                        {/* SQL Query */}
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">SQL Query</h4>
                          <div className="bg-gray-50 rounded-md p-3 font-mono text-sm">
                            <pre className="whitespace-pre-wrap">{selectedQuery.sqlQuery}</pre>
                          </div>
                        </div>

                        <Separator />

                        {/* Approval Actions */}
                        <div>
                          <h4 className="font-medium text-gray-900 mb-3">Approval Decision</h4>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Comments (optional)
                              </label>
                              <Textarea
                                value={comments}
                                onChange={(e) => setComments(e.target.value)}
                                placeholder="Add any comments about this query..."
                                rows={3}
                              />
                            </div>
                            <div className="flex space-x-3">
                              <Button
                                onClick={() => approveMutation.mutate({ 
                                  approvalId: selectedQuery.id, 
                                  comments 
                                })}
                                disabled={approveMutation.isPending}
                                className="flex-1 bg-enterprise-success hover:bg-green-700 text-white"
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                {approveMutation.isPending ? 'Approving...' : 'Approve'}
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => rejectMutation.mutate({ 
                                  approvalId: selectedQuery.id, 
                                  comments 
                                })}
                                disabled={rejectMutation.isPending}
                                className="flex-1"
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="text-center py-12">
                        <Clock className="w-16 h-16 text-enterprise-muted mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Query</h3>
                        <p className="text-enterprise-muted">
                          Click on a query from the list to review and approve it.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
