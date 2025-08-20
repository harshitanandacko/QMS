import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Eye, Send, Plus, X } from "lucide-react";

interface DatabaseServer {
  id: string;
  name: string;
  version: string;
  type: string;
  status: string;
}

interface DatabaseTable {
  id: string;
  tableName: string;
  schema?: string;
}

interface QueryParameter {
  name: string;
  type: string;
  value: string;
}

interface SqlEditorProps {
  onExecutionComplete: (results: any) => void;
}

export default function SqlEditor({ onExecutionComplete }: SqlEditorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [selectedServer, setSelectedServer] = useState("");
  const [selectedTable, setSelectedTable] = useState("");
  const [queryType, setQueryType] = useState("select");
  const [sqlQuery, setSqlQuery] = useState("");
  const [queryTitle, setQueryTitle] = useState("");
  const [queryDescription, setQueryDescription] = useState("");
  const [parameters, setParameters] = useState<QueryParameter[]>([]);
  const [showParameters, setShowParameters] = useState(false);

  const { data: databaseServers = [] } = useQuery<DatabaseServer[]>({
    queryKey: ["/api/database-servers"],
  });

  const { data: databaseTables = [] } = useQuery<DatabaseTable[]>({
    queryKey: ["/api/database-servers", selectedServer, "tables"],
    enabled: !!selectedServer,
  });

  // Detect parameters in SQL query
  useEffect(() => {
    const paramRegex = /:\w+/g;
    const foundParams = sqlQuery.match(paramRegex) || [];
    const uniqueParams = [...new Set(foundParams)];
    
    if (uniqueParams.length > 0) {
      setShowParameters(true);
      // Update parameters array, preserving existing values
      const newParameters = uniqueParams.map(param => {
        const existing = parameters.find(p => p.name === param);
        return existing || {
          name: param,
          type: 'VARCHAR2',
          value: ''
        };
      });
      setParameters(newParameters);
    } else {
      setShowParameters(false);
      setParameters([]);
    }
  }, [sqlQuery]);

  const dryRunMutation = useMutation({
    mutationFn: async () => {
      if (!sqlQuery.trim() || !selectedServer) {
        throw new Error("Please select a server and enter a SQL query");
      }

      // Create a temporary query for dry run
      const queryData = {
        title: queryTitle || "Dry Run Query",
        description: queryDescription,
        sqlQuery,
        queryType,
        serverId: selectedServer,
        tableId: selectedTable || undefined,
        parameters: parameters.length > 0 ? parameters : undefined,
        isDryRun: true,
      };

      const response = await apiRequest("POST", "/api/queries", queryData);
      const query = await response.json();
      
      // Execute dry run
      const dryRunResponse = await apiRequest("POST", `/api/queries/${query.id}/dry-run`);
      return await dryRunResponse.json();
    },
    onSuccess: (results) => {
      toast({
        title: "Dry Run Successful",
        description: `Estimated ${results.estimatedRows} rows, ${results.estimatedExecutionTime} execution time`,
      });
      onExecutionComplete({
        ...results,
        isDryRun: true,
        success: true,
      });
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
        title: "Dry Run Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!sqlQuery.trim() || !selectedServer || !queryTitle.trim()) {
        throw new Error("Please fill in all required fields");
      }

      const queryData = {
        title: queryTitle,
        description: queryDescription,
        sqlQuery,
        queryType,
        serverId: selectedServer,
        tableId: selectedTable || undefined,
        parameters: parameters.length > 0 ? parameters : undefined,
      };

      const response = await apiRequest("POST", "/api/queries", queryData);
      const query = await response.json();
      
      // Submit for approval
      await apiRequest("POST", `/api/queries/${query.id}/submit`);
      
      return query;
    },
    onSuccess: () => {
      toast({
        title: "Query Submitted",
        description: "Your query has been submitted for approval",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/queries"] });
      
      // Reset form
      setQueryTitle("");
      setQueryDescription("");
      setSqlQuery("");
      setParameters([]);
      setSelectedServer("");
      setSelectedTable("");
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
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateParameter = (index: number, field: keyof QueryParameter, value: string) => {
    const updatedParameters = [...parameters];
    updatedParameters[index] = { ...updatedParameters[index], [field]: value };
    setParameters(updatedParameters);
  };

  const addParameter = () => {
    setParameters([...parameters, { name: ':new_param', type: 'VARCHAR2', value: '' }]);
  };

  const removeParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const groupedServers = databaseServers.reduce((acc, server) => {
    const type = server.type.charAt(0).toUpperCase() + server.type.slice(1);
    if (!acc[type]) acc[type] = [];
    acc[type].push(server);
    return acc;
  }, {} as Record<string, DatabaseServer[]>);

  return (
    <div className="space-y-6">
      {/* Query Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="queryTitle">Query Title *</Label>
          <Input
            id="queryTitle"
            placeholder="Enter query title..."
            value={queryTitle}
            onChange={(e) => setQueryTitle(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="queryDescription">Description</Label>
          <Input
            id="queryDescription"
            placeholder="Brief description of the query..."
            value={queryDescription}
            onChange={(e) => setQueryDescription(e.target.value)}
          />
        </div>
      </div>

      {/* Server and Table Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="server">Database Server *</Label>
          <Select value={selectedServer} onValueChange={setSelectedServer}>
            <SelectTrigger>
              <SelectValue placeholder="Select a database server..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(groupedServers).map(([type, servers]) => (
                <div key={type}>
                  <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase">
                    {type} Servers
                  </div>
                  {servers.map((server) => (
                    <SelectItem key={server.id} value={server.id}>
                      {server.name} (Oracle {server.version})
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
          {selectedServer && (
            <div className="flex items-center space-x-2 text-xs">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-green-600">Connection Status: Online</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="table">Target Table</Label>
          <Select value={selectedTable} onValueChange={setSelectedTable} disabled={!selectedServer}>
            <SelectTrigger>
              <SelectValue placeholder={selectedServer ? "Select a table..." : "Select database server first..."} />
            </SelectTrigger>
            <SelectContent>
              {databaseTables.map((table) => (
                <SelectItem key={table.id} value={table.id}>
                  {table.schema ? `${table.schema}.${table.tableName}` : table.tableName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Query Type Selection */}
      <div className="space-y-2">
        <Label>Query Type</Label>
        <div className="flex items-center space-x-4">
          {['select', 'insert', 'update', 'delete'].map((type) => (
            <label key={type} className="flex items-center space-x-2">
              <input
                type="radio"
                name="queryType"
                value={type}
                checked={queryType === type}
                onChange={(e) => setQueryType(e.target.value)}
                className="text-enterprise-blue focus:ring-enterprise-blue"
              />
              <span className="text-sm text-gray-700">{type.toUpperCase()}</span>
            </label>
          ))}
        </div>
      </div>

      {/* SQL Editor */}
      <div className="space-y-2">
        <Label htmlFor="sqlQuery">SQL Query *</Label>
        <div className="border border-gray-300 rounded-md overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-300 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">SQL Query</span>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-enterprise-muted">
                Line: 1, Column: {sqlQuery.length}
              </span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                Oracle SQL
              </span>
            </div>
          </div>
          <Textarea
            id="sqlQuery"
            className="w-full h-48 p-4 font-mono text-sm border-0 focus:outline-none focus:ring-0 resize-none"
            placeholder="Enter your SQL query here...&#10;Example:&#10;SELECT * FROM employees &#10;WHERE department_id = :dept_id &#10;AND hire_date > :start_date;"
            value={sqlQuery}
            onChange={(e) => setSqlQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Parameter Configuration */}
      {showParameters && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Query Parameters</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addParameter}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Parameter
            </Button>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="space-y-3">
              {parameters.map((param, index) => (
                <div key={index} className="flex items-center space-x-4">
                  <div className="w-32">
                    <Label className="text-xs font-medium text-gray-600">Parameter</Label>
                    <Input
                      value={param.name}
                      onChange={(e) => updateParameter(index, 'name', e.target.value)}
                      className="text-sm"
                      placeholder=":param_name"
                    />
                  </div>
                  <div className="w-24">
                    <Label className="text-xs font-medium text-gray-600">Type</Label>
                    <Select
                      value={param.type}
                      onValueChange={(value) => updateParameter(index, 'type', value)}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NUMBER">NUMBER</SelectItem>
                        <SelectItem value="VARCHAR2">VARCHAR2</SelectItem>
                        <SelectItem value="DATE">DATE</SelectItem>
                        <SelectItem value="TIMESTAMP">TIMESTAMP</SelectItem>
                        <SelectItem value="CLOB">CLOB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs font-medium text-gray-600">Value</Label>
                    <Input
                      value={param.value}
                      onChange={(e) => updateParameter(index, 'value', e.target.value)}
                      placeholder="Enter value..."
                      className="text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeParameter(index)}
                    className="mt-5"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Query Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => dryRunMutation.mutate()}
            disabled={dryRunMutation.isPending || !sqlQuery.trim() || !selectedServer}
          >
            <Eye className="w-4 h-4 mr-2" />
            {dryRunMutation.isPending ? 'Running...' : 'Dry Run'}
          </Button>
          <Button
            type="button"
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || !sqlQuery.trim() || !selectedServer || !queryTitle.trim()}
            className="bg-enterprise-blue hover:bg-enterprise-blue-dark text-white"
          >
            <Send className="w-4 h-4 mr-2" />
            {submitMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
          </Button>
        </div>
        <div className="text-sm text-enterprise-muted flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Estimated execution time: ~2.3s</span>
        </div>
      </div>
    </div>
  );
}
