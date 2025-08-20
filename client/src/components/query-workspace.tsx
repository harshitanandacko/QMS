import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SqlEditor from "./sql-editor";
import ExecutionModal from "./execution-modal";
import { Indent, CheckCircle, Eye, Send, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Query {
  id: string;
  title: string;
  sqlQuery: string;
  queryType: string;
  status: string;
  createdAt: string;
  serverId: string;
}

interface QueryTemplate {
  id: string;
  name: string;
  description: string;
  sqlTemplate: string;
}

export default function QueryWorkspace() {
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [executionResults, setExecutionResults] = useState<any>(null);

  const { data: recentQueries = [] } = useQuery<Query[]>({
    queryKey: ["/api/queries"],
  });

  const { data: queryTemplates = [] } = useQuery<QueryTemplate[]>({
    queryKey: ["/api/query-templates"],
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'executed':
        return <Badge className="bg-green-100 text-green-700">Executed</Badge>;
      case 'approved':
        return <Badge className="bg-enterprise-success text-white">Approved</Badge>;
      case 'submitted':
        return <Badge className="bg-enterprise-warning text-white">Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-enterprise-error text-white">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleExecutionComplete = (results: any) => {
    setExecutionResults(results);
    setShowExecutionModal(true);
  };

  return (
    <>
      <main className="flex-1 overflow-y-auto p-6">
        {/* Database Configuration Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Database Configuration</h2>
            <p className="text-sm text-enterprise-muted mt-1">Select your target database and configure query parameters</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Database Server Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Database Server</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-enterprise-blue focus:border-transparent">
                  <option value="">Select a database server...</option>
                  <optgroup label="Production Servers">
                    <option value="tpaoeldbsd001">tpaoeldbsd001 (Oracle 19c)</option>
                    <option value="tpaoeldbsr001">tpaoeldbsr001 (Oracle 19c)</option>
                    <option value="tpaoeldbsr002">tpaoeldbsr002 (Oracle 19c)</option>
                  </optgroup>
                  <optgroup label="Test Servers">
                    <option value="tpaoeldbst001">tpaoeldbst001 (Oracle 10g)</option>
                    <option value="tpasolorad005">tpasolorad005 (Oracle 19c)</option>
                    <option value="tpasolorap003">tpasolorap003 (Oracle 19c)</option>
                  </optgroup>
                  <optgroup label="Reporting Servers">
                    <option value="tpasolorar002">tpasolorar002 (Oracle 19c)</option>
                    <option value="tpasolorat002">tpasolorat002 (Oracle 19c)</option>
                    <option value="tpasolorat003">tpasolorat003 (Oracle 19c)</option>
                  </optgroup>
                  <optgroup label="Audit Servers">
                    <option value="tpaoelaudd001">tpaoelaudd001 (Oracle 10g)</option>
                    <option value="tpaoelaudt001">tpaoelaudt001 (Oracle 10g)</option>
                  </optgroup>
                </select>
                <div className="mt-2 flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-green-600">Connection Status: Online</span>
                </div>
              </div>

              {/* Table Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Table</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-enterprise-blue focus:border-transparent">
                  <option value="">Select database server first...</option>
                </select>
                <p className="text-xs text-enterprise-muted mt-1">Tables will load after selecting a database server</p>
              </div>
            </div>
          </div>
        </div>

        {/* SQL Editor Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">SQL Query Editor</h2>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm">
                  <Indent className="w-4 h-4 mr-2" />
                  Format
                </Button>
                <Button variant="outline" size="sm" className="bg-enterprise-warning hover:bg-orange-600 text-white border-enterprise-warning">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Validate
                </Button>
              </div>
            </div>
          </div>
          <div className="p-6">
            <SqlEditor onExecutionComplete={handleExecutionComplete} />
          </div>
        </div>

        {/* Query History & Templates */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Queries */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Queries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentQueries.slice(0, 5).map((query) => (
                  <div key={query.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{query.title}</span>
                      {getStatusBadge(query.status)}
                    </div>
                    <p className="text-xs text-enterprise-muted mb-2 line-clamp-1">
                      {query.sqlQuery.substring(0, 60)}...
                    </p>
                    <div className="flex items-center justify-between text-xs text-enterprise-muted">
                      <span>{formatDistanceToNow(new Date(query.createdAt), { addSuffix: true })}</span>
                      <span>{query.serverId}</span>
                    </div>
                  </div>
                ))}
                {recentQueries.length === 0 && (
                  <div className="text-center py-8 text-enterprise-muted">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recent queries</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Query Templates */}
          <Card>
            <CardHeader>
              <CardTitle>Query Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {queryTemplates.slice(0, 5).map((template) => (
                  <div key={template.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{template.name}</span>
                      <button className="text-enterprise-muted hover:text-enterprise-blue">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-enterprise-muted">{template.description}</p>
                  </div>
                ))}
                {queryTemplates.length === 0 && (
                  <div className="text-center py-8 text-enterprise-muted">
                    <div className="w-8 h-8 mx-auto mb-2 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm">No templates available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <ExecutionModal
        isOpen={showExecutionModal}
        onClose={() => setShowExecutionModal(false)}
        results={executionResults}
      />
    </>
  );
}
