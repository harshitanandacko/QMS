// Oracle Database Integration Module
// This module provides Oracle connectivity for the Query Management System

const oracledb = require('oracledb');

// Oracle client configuration
try {
  // Initialize Oracle client (configure path based on your installation)
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  oracledb.autoCommit = false; // For transaction control in approval workflow
  
  // Uncomment and configure when Oracle Instant Client is installed
  // oracledb.initOracleClient({
  //   libDir: '/path/to/oracle/instantclient'
  // });
} catch (err) {
  console.error('Oracle client initialization failed:', err);
}

// Connection pool management
const pools = new Map();

// Database server configurations for your 19 Oracle servers
const serverConfigurations = {
  'tpaoeldbsd001': {
    user: 'oracle_query_mgmt',
    password: process.env.ORACLE_PASSWORD_TPAOELDBSD001 || 'your_password',
    connectString: 'tpaoeldbsd001.domain.com:1521/ORCL',
    poolMin: 2,
    poolMax: 10,
    poolIncrement: 2,
    poolTimeout: 60
  },
  'tpaoeldbsr001': {
    user: 'oracle_query_mgmt',
    password: process.env.ORACLE_PASSWORD_TPAOELDBSR001 || 'your_password',
    connectString: 'tpaoeldbsr001.domain.com:1521/ORCL',
    poolMin: 2,
    poolMax: 10,
    poolIncrement: 2,
    poolTimeout: 60
  },
  // Add configurations for all 19 servers...
  'tpacospgsr001': {
    user: 'oracle_query_mgmt',
    password: process.env.ORACLE_PASSWORD_TPACOSPGSR001 || 'your_password',
    connectString: 'tpacospgsr001.domain.com:1521/ORCL',
    poolMin: 2,
    poolMax: 10,
    poolIncrement: 2,
    poolTimeout: 60
  }
};

// Create connection pool for a specific server
async function createConnectionPool(serverId) {
  const config = serverConfigurations[serverId];
  if (!config) {
    throw new Error(`No configuration found for server: ${serverId}`);
  }

  try {
    const pool = await oracledb.createPool(config);
    pools.set(serverId, pool);
    console.log(`Connection pool created for ${serverId}`);
    return pool;
  } catch (err) {
    console.error(`Failed to create pool for ${serverId}:`, err);
    throw err;
  }
}

// Get connection from pool
async function getConnection(serverId) {
  let pool = pools.get(serverId);
  
  if (!pool) {
    pool = await createConnectionPool(serverId);
  }
  
  return await pool.getConnection();
}

// Execute SQL query with parameters
async function executeQuery(serverId, sqlText, parameters = {}, options = {}) {
  let connection;
  
  try {
    connection = await getConnection(serverId);
    
    const result = await connection.execute(sqlText, parameters, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      ...options
    });
    
    return {
      success: true,
      rows: result.rows,
      rowsAffected: result.rowsAffected,
      metaData: result.metaData
    };
  } catch (err) {
    console.error(`Query execution failed on ${serverId}:`, err);
    return {
      success: false,
      error: err.message,
      code: err.errorNum
    };
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
}

// Generate execution plan for dry run
async function generateExecutionPlan(serverId, sqlText, parameters = {}) {
  let connection;
  
  try {
    connection = await getConnection(serverId);
    
    // Clear any existing plan
    await connection.execute('DELETE FROM plan_table WHERE statement_id = :id', 
      { id: 'DRYRUN_' + Date.now() });
    
    const statementId = 'DRYRUN_' + Date.now();
    
    // Generate execution plan
    await connection.execute(
      `EXPLAIN PLAN SET STATEMENT_ID = :id FOR ${sqlText}`,
      { id: statementId, ...parameters }
    );
    
    // Retrieve execution plan
    const planResult = await connection.execute(
      `SELECT plan_table_output 
       FROM TABLE(dbms_xplan.display('PLAN_TABLE', :id, 'ALL'))`,
      { id: statementId }
    );
    
    // Estimate rows affected for DML statements
    let estimatedRows = 0;
    if (sqlText.trim().toUpperCase().match(/^(UPDATE|DELETE|INSERT)/)) {
      const countQuery = convertToCountQuery(sqlText);
      if (countQuery) {
        const countResult = await connection.execute(countQuery, parameters);
        estimatedRows = countResult.rows[0]?.COUNT || 0;
      }
    }
    
    return {
      success: true,
      executionPlan: planResult.rows.map(row => row.PLAN_TABLE_OUTPUT).join('\n'),
      estimatedRowsAffected: estimatedRows
    };
  } catch (err) {
    console.error(`Dry run failed on ${serverId}:`, err);
    return {
      success: false,
      error: err.message,
      code: err.errorNum
    };
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
}

// Convert DML query to count query for estimation
function convertToCountQuery(sqlText) {
  const sql = sqlText.trim().toUpperCase();
  
  if (sql.startsWith('UPDATE')) {
    // Extract table and WHERE clause from UPDATE
    const match = sql.match(/UPDATE\s+(\w+)(?:\s+SET\s+.+)?(?:\s+WHERE\s+(.+))?/i);
    if (match) {
      const table = match[1];
      const whereClause = match[2] ? `WHERE ${match[2]}` : '';
      return `SELECT COUNT(*) as COUNT FROM ${table} ${whereClause}`;
    }
  } else if (sql.startsWith('DELETE')) {
    // Extract table and WHERE clause from DELETE
    const match = sql.match(/DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?/i);
    if (match) {
      const table = match[1];
      const whereClause = match[2] ? `WHERE ${match[2]}` : '';
      return `SELECT COUNT(*) as COUNT FROM ${table} ${whereClause}`;
    }
  }
  
  return null;
}

// Discover tables and metadata
async function discoverDatabaseMetadata(serverId, schemaName = null) {
  let connection;
  
  try {
    connection = await getConnection(serverId);
    
    // Get tables
    let tablesQuery = `
      SELECT owner as schema_name, table_name, num_rows, tablespace_name
      FROM dba_tables 
      WHERE owner NOT IN ('SYS', 'SYSTEM', 'OUTLN', 'DBSNMP', 'WMSYS', 'EXFSYS', 'CTXSYS', 'XDB', 'ANONYMOUS', 'XS\$NULL', 'OJVMSYS')
    `;
    
    const parameters = {};
    
    if (schemaName) {
      tablesQuery += ' AND owner = :schema';
      parameters.schema = schemaName.toUpperCase();
    }
    
    tablesQuery += ' ORDER BY owner, table_name';
    
    const tablesResult = await connection.execute(tablesQuery, parameters);
    
    // Get table details for each table
    const tables = [];
    for (const table of tablesResult.rows) {
      const columnsResult = await connection.execute(`
        SELECT column_name, data_type, data_length, nullable, data_default
        FROM dba_tab_columns 
        WHERE owner = :owner AND table_name = :tableName
        ORDER BY column_id
      `, {
        owner: table.SCHEMA_NAME,
        tableName: table.TABLE_NAME
      });
      
      tables.push({
        schemaName: table.SCHEMA_NAME,
        tableName: table.TABLE_NAME,
        numRows: table.NUM_ROWS,
        tablespace: table.TABLESPACE_NAME,
        columns: columnsResult.rows
      });
    }
    
    return {
      success: true,
      tables: tables
    };
  } catch (err) {
    console.error(`Metadata discovery failed on ${serverId}:`, err);
    return {
      success: false,
      error: err.message,
      code: err.errorNum
    };
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
}

// Test connection to all configured servers
async function testAllConnections() {
  const results = {};
  
  for (const serverId of Object.keys(serverConfigurations)) {
    try {
      const connection = await getConnection(serverId);
      await connection.execute('SELECT 1 FROM dual');
      await connection.close();
      results[serverId] = { success: true, message: 'Connection successful' };
    } catch (err) {
      results[serverId] = { 
        success: false, 
        error: err.message,
        code: err.errorNum 
      };
    }
  }
  
  return results;
}

// Create backup before destructive operations
async function createTableBackup(serverId, tableName, schemaName) {
  const backupTableName = `${tableName}_BACKUP_${new Date().toISOString().replace(/[:-]/g, '').split('T')[0]}_${Date.now()}`;
  
  const backupSql = `
    CREATE TABLE ${schemaName}.${backupTableName} AS 
    SELECT * FROM ${schemaName}.${tableName}
  `;
  
  const result = await executeQuery(serverId, backupSql);
  
  if (result.success) {
    return {
      success: true,
      backupTableName: backupTableName,
      backupTime: new Date().toISOString()
    };
  } else {
    return result;
  }
}

// Execute rollback using backup table
async function executeRollback(serverId, originalTable, backupTable, schemaName) {
  let connection;
  
  try {
    connection = await getConnection(serverId);
    
    // Start transaction
    await connection.execute(`TRUNCATE TABLE ${schemaName}.${originalTable}`);
    await connection.execute(`
      INSERT INTO ${schemaName}.${originalTable} 
      SELECT * FROM ${schemaName}.${backupTable}
    `);
    
    await connection.commit();
    
    return {
      success: true,
      message: `Successfully rolled back ${originalTable} from ${backupTable}`
    };
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        console.error('Rollback failed:', rollbackErr);
      }
    }
    
    return {
      success: false,
      error: err.message,
      code: err.errorNum
    };
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
}

// Graceful shutdown - close all pools
async function shutdown() {
  console.log('Closing Oracle connection pools...');
  
  for (const [serverId, pool] of pools) {
    try {
      await pool.close(0); // Force close
      console.log(`Pool closed for ${serverId}`);
    } catch (err) {
      console.error(`Error closing pool for ${serverId}:`, err);
    }
  }
  
  pools.clear();
}

// Handle process termination
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = {
  executeQuery,
  generateExecutionPlan,
  discoverDatabaseMetadata,
  testAllConnections,
  createTableBackup,
  executeRollback,
  getConnection,
  createConnectionPool,
  shutdown
};