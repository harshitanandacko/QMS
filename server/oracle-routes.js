// Oracle Database Routes
// These routes integrate Oracle functionality into the existing Query Management System

const express = require('express');
const { isAuthenticated } = require('./replitAuth');
const oracle = require('./oracle-integration');
const { storage } = require('./storage');

const router = express.Router();

// Test connection to a specific Oracle server
router.get('/oracle/test-connection/:serverId', isAuthenticated, async (req, res) => {
  try {
    const { serverId } = req.params;
    
    // Verify server exists in our database
    const server = await storage.getDatabaseServer(serverId);
    if (!server) {
      return res.status(404).json({ error: 'Database server not found' });
    }
    
    const connection = await oracle.getConnection(serverId);
    const result = await connection.execute('SELECT 1 as test FROM dual');
    await connection.close();
    
    res.json({ 
      success: true, 
      message: `Successfully connected to ${server.name}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Connection test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      code: error.errorNum 
    });
  }
});

// Test connections to all Oracle servers
router.get('/oracle/test-all-connections', isAuthenticated, async (req, res) => {
  try {
    const results = await oracle.testAllConnections();
    res.json(results);
  } catch (error) {
    console.error('Connection test failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Discover and update table metadata for a server
router.post('/oracle/discover-metadata/:serverId', isAuthenticated, async (req, res) => {
  try {
    const { serverId } = req.params;
    const { schemaName } = req.body;
    
    // Verify server exists
    const server = await storage.getDatabaseServer(serverId);
    if (!server) {
      return res.status(404).json({ error: 'Database server not found' });
    }
    
    const metadata = await oracle.discoverDatabaseMetadata(serverId, schemaName);
    
    if (!metadata.success) {
      return res.status(500).json(metadata);
    }
    
    // Update our database with discovered tables
    const updatedTables = [];
    for (const table of metadata.tables) {
      try {
        const tableData = {
          id: `${serverId}_${table.schemaName}_${table.tableName}`,
          serverId: serverId,
          schemaName: table.schemaName,
          tableName: table.tableName,
          tableType: 'TABLE',
          rowCount: table.numRows || 0,
          metadata: {
            columns: table.columns,
            tablespace: table.tablespace
          }
        };
        
        // Check if table already exists
        const existingTables = await storage.getTablesForServer(serverId);
        const existingTable = existingTables.find(t => 
          t.schemaName === table.schemaName && t.tableName === table.tableName
        );
        
        if (!existingTable) {
          const newTable = await storage.createDatabaseTable(tableData);
          updatedTables.push(newTable);
        } else {
          updatedTables.push(existingTable);
        }
      } catch (tableError) {
        console.error(`Error updating table ${table.tableName}:`, tableError);
      }
    }
    
    res.json({
      success: true,
      tablesDiscovered: metadata.tables.length,
      tablesUpdated: updatedTables.length,
      tables: updatedTables
    });
  } catch (error) {
    console.error('Metadata discovery failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute dry run for a query
router.post('/oracle/dry-run', isAuthenticated, async (req, res) => {
  try {
    const { serverId, sqlQuery, parameters } = req.body;
    
    if (!serverId || !sqlQuery) {
      return res.status(400).json({ error: 'Server ID and SQL query are required' });
    }
    
    // Verify server exists
    const server = await storage.getDatabaseServer(serverId);
    if (!server) {
      return res.status(404).json({ error: 'Database server not found' });
    }
    
    const result = await oracle.generateExecutionPlan(serverId, sqlQuery, parameters || {});
    
    res.json(result);
  } catch (error) {
    console.error('Dry run failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute approved query
router.post('/oracle/execute-query', isAuthenticated, async (req, res) => {
  try {
    const { queryId } = req.body;
    const userId = req.user.claims.sub;
    
    if (!queryId) {
      return res.status(400).json({ error: 'Query ID is required' });
    }
    
    // Get query details
    const query = await storage.getQuery(queryId);
    if (!query) {
      return res.status(404).json({ error: 'Query not found' });
    }
    
    // Verify query is approved and ready for execution
    if (query.status !== 'approved') {
      return res.status(400).json({ error: 'Query is not approved for execution' });
    }
    
    // Verify user has permission to execute
    const user = await storage.getUser(userId);
    if (!user || (user.role !== 'skip_manager' && query.submittedBy !== userId)) {
      return res.status(403).json({ error: 'Insufficient permissions to execute query' });
    }
    
    const startTime = Date.now();
    
    try {
      // Create backup for destructive operations
      let backupInfo = null;
      const sqlUpper = query.content.trim().toUpperCase();
      if (sqlUpper.startsWith('UPDATE') || sqlUpper.startsWith('DELETE')) {
        // Extract table name for backup
        const tableMatch = query.content.match(/(UPDATE|DELETE\s+FROM)\s+([^\s]+)/i);
        if (tableMatch) {
          const tableName = tableMatch[2];
          backupInfo = await oracle.createTableBackup(query.serverId, tableName, 'BACKUP_SCHEMA');
        }
      }
      
      // Execute the query
      const result = await oracle.executeQuery(
        query.serverId, 
        query.content, 
        query.parameters || {}
      );
      
      const executionTime = Date.now() - startTime;
      
      if (result.success) {
        // Update query status to executed
        await storage.updateQuery(queryId, {
          status: 'executed',
          executedAt: new Date(),
          executedBy: userId,
          results: {
            rowsAffected: result.rowsAffected,
            rows: result.rows?.slice(0, 100), // Limit returned rows
            totalRows: result.rows?.length || 0
          },
          executionTimeMs: executionTime,
          rollbackData: backupInfo
        });
        
        res.json({
          success: true,
          message: 'Query executed successfully',
          results: {
            rowsAffected: result.rowsAffected,
            executionTime: executionTime,
            hasBackup: !!backupInfo
          }
        });
      } else {
        // Update query status to failed
        await storage.updateQuery(queryId, {
          status: 'failed',
          errorMessage: result.error,
          executionTimeMs: executionTime
        });
        
        res.status(500).json({
          success: false,
          error: result.error,
          code: result.code
        });
      }
    } catch (executionError) {
      const executionTime = Date.now() - startTime;
      
      await storage.updateQuery(queryId, {
        status: 'failed',
        errorMessage: executionError.message,
        executionTimeMs: executionTime
      });
      
      throw executionError;
    }
  } catch (error) {
    console.error('Query execution failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rollback executed query
router.post('/oracle/rollback-query', isAuthenticated, async (req, res) => {
  try {
    const { queryId } = req.body;
    const userId = req.user.claims.sub;
    
    if (!queryId) {
      return res.status(400).json({ error: 'Query ID is required' });
    }
    
    // Get query details
    const query = await storage.getQuery(queryId);
    if (!query) {
      return res.status(404).json({ error: 'Query not found' });
    }
    
    // Verify query is executed and has rollback data
    if (query.status !== 'executed') {
      return res.status(400).json({ error: 'Query is not in executed state' });
    }
    
    if (!query.rollbackData) {
      return res.status(400).json({ error: 'No rollback data available for this query' });
    }
    
    // Verify user has permission to rollback
    const user = await storage.getUser(userId);
    if (!user || user.role !== 'skip_manager') {
      return res.status(403).json({ error: 'Only Skip Managers can perform rollbacks' });
    }
    
    try {
      // Extract table information from original query
      const sqlUpper = query.content.trim().toUpperCase();
      const tableMatch = query.content.match(/(UPDATE|DELETE\s+FROM)\s+([^\s]+)/i);
      
      if (!tableMatch) {
        return res.status(400).json({ error: 'Cannot determine table for rollback' });
      }
      
      const tableName = tableMatch[2];
      const result = await oracle.executeRollback(
        query.serverId,
        tableName,
        query.rollbackData.backupTableName,
        'BACKUP_SCHEMA'
      );
      
      if (result.success) {
        // Update query status to rolled back
        await storage.updateQuery(queryId, {
          status: 'rolled_back',
          rollbackExecutedAt: new Date(),
          rollbackExecutedBy: userId
        });
        
        res.json({
          success: true,
          message: 'Query successfully rolled back'
        });
      } else {
        res.status(500).json(result);
      }
    } catch (rollbackError) {
      console.error('Rollback execution failed:', rollbackError);
      res.status(500).json({ error: rollbackError.message });
    }
  } catch (error) {
    console.error('Rollback failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Oracle server status and performance metrics
router.get('/oracle/server-status/:serverId', isAuthenticated, async (req, res) => {
  try {
    const { serverId } = req.params;
    
    // Verify server exists
    const server = await storage.getDatabaseServer(serverId);
    if (!server) {
      return res.status(404).json({ error: 'Database server not found' });
    }
    
    const connection = await oracle.getConnection(serverId);
    
    // Get basic server information
    const serverInfo = await connection.execute(`
      SELECT 
        instance_name,
        host_name,
        version,
        startup_time,
        status,
        database_status
      FROM v$instance
    `);
    
    // Get active sessions count
    const sessionsInfo = await connection.execute(`
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_sessions
      FROM v$session
      WHERE type = 'USER'
    `);
    
    // Get tablespace usage
    const tablespaceInfo = await connection.execute(`
      SELECT 
        tablespace_name,
        ROUND((used_space * 8192) / (1024 * 1024), 2) as used_mb,
        ROUND((tablespace_size * 8192) / (1024 * 1024), 2) as total_mb,
        ROUND((used_percent), 2) as used_percent
      FROM dba_tablespace_usage_metrics
      ORDER BY used_percent DESC
    `);
    
    await connection.close();
    
    res.json({
      success: true,
      serverInfo: serverInfo.rows[0],
      sessions: sessionsInfo.rows[0],
      tablespaces: tablespaceInfo.rows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Server status check failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get query execution statistics
router.get('/oracle/query-stats/:serverId', isAuthenticated, async (req, res) => {
  try {
    const { serverId } = req.params;
    
    const connection = await oracle.getConnection(serverId);
    
    // Get recent query performance
    const queryStats = await connection.execute(`
      SELECT 
        sql_text,
        executions,
        ROUND(elapsed_time / 1000000, 2) as elapsed_seconds,
        ROUND(cpu_time / 1000000, 2) as cpu_seconds,
        disk_reads,
        buffer_gets,
        rows_processed,
        first_load_time,
        last_load_time
      FROM v$sql 
      WHERE parsing_user_id = (
        SELECT user_id FROM dba_users WHERE username = 'ORACLE_QUERY_MGMT'
      )
      AND rownum <= 20
      ORDER BY last_load_time DESC
    `);
    
    await connection.close();
    
    res.json({
      success: true,
      queryStats: queryStats.rows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Query stats retrieval failed:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;