import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, Download, RotateCcw, X, AlertTriangle, Clock } from "lucide-react";

interface ExecutionResults {
  success: boolean;
  isDryRun?: boolean;
  executionTime?: string;
  rowsAffected?: number;
  memoryUsed?: string;
  estimatedRows?: number;
  estimatedExecutionTime?: string;
  queryPlan?: string;
  warnings?: string[];
  data?: any[];
  errorMessage?: string;
}

interface ExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: ExecutionResults | null;
  queryId?: string;
}

export default function ExecutionModal({ isOpen, onClose, results, queryId }: ExecutionModalProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const rollbackMutation = useMutation({
    mutationFn: async () => {
      if (!queryId) {
        throw new Error("Query ID is required for rollback");
      }
      await apiRequest("POST", `/api/queries/${queryId}/rollback`);
    },
    onSuccess: () => {
      toast({
        title: "Rollback Successful",
        description: "Query has been rolled back successfully",
      });
      onClose();
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
        title: "Rollback Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleExport = async () => {
    if (!results?.data) {
      toast({
        title: "No Data to Export",
        description: "There is no data available to export",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      // Convert data to CSV format
      const headers = Object.keys(results.data[0]).join(',');
      const rows = results.data.map(row => 
        Object.values(row).map(value => 
          typeof value === 'string' ? `"${value}"` : value
        ).join(',')
      );
      const csvContent = [headers, ...rows].join('\n');
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `query_results_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Successful",
        description: "Query results have been exported to CSV",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export query results",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (!results) return null;

  const renderResultsTable = () => {
    if (!results.data || results.data.length === 0) {
      return (
        <div className="text-center py-8 text-enterprise-muted">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No data returned from query</p>
        </div>
      );
    }

    const headers = Object.keys(results.data[0]);
    
    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
          <span className="text-sm font-medium text-gray-700">
            Query Results (First {Math.min(100, results.data.length)} rows)
          </span>
        </div>
        <ScrollArea className="max-h-64">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {headers.map((header) => (
                    <th key={header} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {results.data.slice(0, 100).map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    {headers.map((header) => (
                      <td key={header} className="px-4 py-2 text-gray-900 whitespace-nowrap">
                        {String(row[header] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>
              {results.isDryRun ? 'Dry Run Results' : 'Query Execution Results'}
            </span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-6 p-1">
            {/* Execution Summary */}
            <div className={`border rounded-lg p-4 ${
              results.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center space-x-2 mb-2">
                {results.success ? (
                  <CheckCircle className="text-enterprise-success" />
                ) : (
                  <AlertTriangle className="text-enterprise-error" />
                )}
                <span className={`text-sm font-medium ${
                  results.success ? 'text-green-900' : 'text-red-900'
                }`}>
                  {results.isDryRun 
                    ? (results.success ? 'Dry Run Successful' : 'Dry Run Failed')
                    : (results.success ? 'Execution Successful' : 'Execution Failed')
                  }
                </span>
              </div>

              {results.errorMessage && (
                <div className="mt-2 p-3 bg-red-100 rounded border border-red-200">
                  <p className="text-sm text-red-800">{results.errorMessage}</p>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mt-3">
                {results.isDryRun ? (
                  <>
                    <div>
                      <span className="text-gray-600">Estimated Time:</span>
                      <span className="text-gray-900 ml-2 font-medium">
                        {results.estimatedExecutionTime || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Estimated Rows:</span>
                      <span className="text-gray-900 ml-2 font-medium">
                        {results.estimatedRows?.toLocaleString() || 'N/A'}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="text-gray-600">Execution Time:</span>
                      <span className="text-gray-900 ml-2 font-medium">
                        {results.executionTime || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Rows Affected:</span>
                      <span className="text-gray-900 ml-2 font-medium">
                        {results.rowsAffected?.toLocaleString() || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Memory Used:</span>
                      <span className="text-gray-900 ml-2 font-medium">
                        {results.memoryUsed || 'N/A'}
                      </span>
                    </div>
                  </>
                )}
                <div>
                  <span className="text-gray-600">Status:</span>
                  <Badge 
                    variant={results.success ? "default" : "destructive"}
                    className="ml-2"
                  >
                    {results.success ? 'Success' : 'Failed'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Warnings */}
            {results.warnings && results.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle className="text-enterprise-warning" />
                  <span className="text-sm font-medium text-yellow-900">Warnings</span>
                </div>
                <ul className="text-sm text-yellow-800 space-y-1">
                  {results.warnings.map((warning, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="text-yellow-600">•</span>
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Query Plan (for dry runs) */}
            {results.isDryRun && results.queryPlan && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Clock className="text-enterprise-blue" />
                  <span className="text-sm font-medium text-blue-900">Execution Plan</span>
                </div>
                <div className="bg-white rounded border p-3 font-mono text-sm">
                  <pre className="whitespace-pre-wrap">{results.queryPlan}</pre>
                </div>
              </div>
            )}

            {/* Results Table */}
            {results.success && !results.isDryRun && renderResultsTable()}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-x-2">
                {results.success && results.data && !results.isDryRun && (
                  <Button
                    variant="outline"
                    onClick={handleExport}
                    disabled={isExporting}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {isExporting ? 'Exporting...' : 'Export Results'}
                  </Button>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                {results.success && !results.isDryRun && queryId && (
                  <Button
                    variant="outline"
                    onClick={() => rollbackMutation.mutate()}
                    disabled={rollbackMutation.isPending}
                    className="text-enterprise-warning hover:text-orange-600 border-enterprise-warning"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {rollbackMutation.isPending ? 'Rolling back...' : 'Rollback'}
                  </Button>
                )}
                <Button onClick={onClose} className="bg-enterprise-blue hover:bg-enterprise-blue-dark text-white">
                  Close
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
