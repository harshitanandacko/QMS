import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import AppHeader from "@/components/app-header";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Database, Calendar, User, Clock, Search, Filter, Download } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

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
  executedAt?: string;
  actualExecutionTime?: string;
  rowsAffected?: string;
}

export default function History() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedQuery, setSelectedQuery] = useState<Query | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

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

  const { data: queries = [], isLoading: isLoadingQueries } = useQuery({
    queryKey: ["/api/queries"],
    enabled: !!isAuthenticated,
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

  const filteredQueries = (queries as any[]).filter((query: Query) => {
    const matchesSearch = query.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         query.sqlQuery.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         query.serverId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || query.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline" className="text-gray-600 border-gray-600">Draft</Badge>;
      case 'submitted':
        return <Badge variant="outline" className="text-enterprise-warning border-enterprise-warning">Pending</Badge>;
      case 'team_manager_approved':
        return <Badge variant="outline" className="text-blue-600 border-blue-600">Team Approved</Badge>;
      case 'approved':
        return <Badge variant="outline" className="text-enterprise-success border-enterprise-success">Approved</Badge>;
      case 'executed':
        return <Badge variant="outline" className="text-green-600 border-green-600">Executed</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-enterprise-error border-enterprise-error">Rejected</Badge>;
      case 'failed':
        return <Badge variant="outline" className="text-red-600 border-red-600">Failed</Badge>;
      case 'rolled_back':
        return <Badge variant="outline" className="text-purple-600 border-purple-600">Rolled Back</Badge>;
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
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Query History</h1>
              <p className="text-enterprise-muted">
                View and manage all your submitted queries and their execution history
              </p>
            </div>

            {/* Filters */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Filter className="w-5 h-5" />
                  <span>Filters</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-enterprise-muted" />
                      <Input
                        placeholder="Search queries, SQL, or servers..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="w-full sm:w-48">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="submitted">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="executed">Executed</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="default">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardContent>
            </Card>

            {isLoadingQueries ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-enterprise-blue mx-auto mb-4"></div>
                <p className="text-enterprise-muted">Loading query history...</p>
              </div>
            ) : filteredQueries.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Database className="w-16 h-16 text-enterprise-muted mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {queries.length === 0 ? 'No Queries Yet' : 'No Matching Queries'}
                  </h3>
                  <p className="text-enterprise-muted">
                    {queries.length === 0 
                      ? 'Start by creating your first database query.'
                      : 'Try adjusting your search or filter criteria.'
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Query List */}
                <div className="space-y-4">
                  {filteredQueries.map((query: Query) => (
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
                          <div className="text-right text-sm text-enterprise-muted">
                            <div>{format(new Date(query.createdAt), 'MMM dd, yyyy')}</div>
                            <div>{format(new Date(query.createdAt), 'HH:mm')}</div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center space-x-2 text-enterprise-muted">
                            <Database className="w-4 h-4" />
                            <span>Server: {query.serverId}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-enterprise-muted">
                            <Calendar className="w-4 h-4" />
                            <span>
                              Created {formatDistanceToNow(new Date(query.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          {query.executedAt && (
                            <div className="flex items-center space-x-2 text-enterprise-muted">
                              <Clock className="w-4 h-4" />
                              <span>
                                Executed {formatDistanceToNow(new Date(query.executedAt), { addSuffix: true })}
                              </span>
                            </div>
                          )}
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
                          <h4 className="font-medium text-gray-900 mb-3">Query Information</h4>
                          <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                              <span className="text-enterprise-muted">Title:</span>
                              <span className="font-medium">{selectedQuery.title}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-enterprise-muted">Server:</span>
                              <span className="font-medium">{selectedQuery.serverId}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-enterprise-muted">Type:</span>
                              <span className="font-medium">{selectedQuery.queryType.toUpperCase()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-enterprise-muted">Created:</span>
                              <span className="font-medium">
                                {format(new Date(selectedQuery.createdAt), 'MMM dd, yyyy HH:mm')}
                              </span>
                            </div>
                            {selectedQuery.submittedAt && (
                              <div className="flex justify-between">
                                <span className="text-enterprise-muted">Submitted:</span>
                                <span className="font-medium">
                                  {format(new Date(selectedQuery.submittedAt), 'MMM dd, yyyy HH:mm')}
                                </span>
                              </div>
                            )}
                            {selectedQuery.executedAt && (
                              <div className="flex justify-between">
                                <span className="text-enterprise-muted">Executed:</span>
                                <span className="font-medium">
                                  {format(new Date(selectedQuery.executedAt), 'MMM dd, yyyy HH:mm')}
                                </span>
                              </div>
                            )}
                          </div>
                          {selectedQuery.description && (
                            <div className="mt-3">
                              <span className="text-enterprise-muted text-sm">Description:</span>
                              <p className="text-sm mt-1">{selectedQuery.description}</p>
                            </div>
                          )}
                        </div>

                        <Separator />

                        {/* Execution Details */}
                        {(selectedQuery.actualExecutionTime || selectedQuery.rowsAffected) && (
                          <>
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">Execution Details</h4>
                              <div className="space-y-2 text-sm">
                                {selectedQuery.actualExecutionTime && (
                                  <div className="flex justify-between">
                                    <span className="text-enterprise-muted">Execution Time:</span>
                                    <span className="font-medium">{selectedQuery.actualExecutionTime}</span>
                                  </div>
                                )}
                                {selectedQuery.rowsAffected && (
                                  <div className="flex justify-between">
                                    <span className="text-enterprise-muted">Rows Affected:</span>
                                    <span className="font-medium">{selectedQuery.rowsAffected}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <Separator />
                          </>
                        )}

                        {/* SQL Query */}
                        <div>
                          <h4 className="font-medium text-gray-900 mb-3">SQL Query</h4>
                          <div className="bg-gray-50 rounded-md p-3 font-mono text-sm max-h-64 overflow-y-auto">
                            <pre className="whitespace-pre-wrap">{selectedQuery.sqlQuery}</pre>
                          </div>
                        </div>

                        {/* Actions */}
                        {selectedQuery.status === 'executed' && (
                          <>
                            <Separator />
                            <div className="flex space-x-3">
                              <Button variant="outline" size="sm" className="flex-1">
                                <Download className="w-4 h-4 mr-2" />
                                Export Results
                              </Button>
                              <Button variant="outline" size="sm" className="flex-1">
                                View Results
                              </Button>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="text-center py-12">
                        <Database className="w-16 h-16 text-enterprise-muted mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Query</h3>
                        <p className="text-enterprise-muted">
                          Click on a query from the list to view its details and execution history.
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
