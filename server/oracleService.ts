import oracledb from 'oracledb';

// Oracle connection configuration
interface OracleConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  serviceName?: string;
  sid?: string;
}

// Table and schema metadata interfaces
interface OracleTable {
  schema: string;
  tableName: string;
  tableType: string;
  comments?: string;
}

interface OracleColumn {
  columnName: string;
  dataType: string;
  nullable: string;
  dataLength?: number;
  dataPrecision?: number;
  dataScale?: number;
}

class OracleService {
  private static instance: OracleService;
  private connections: Map<string, oracledb.Pool> = new Map();

  private constructor() {
    // Configure Oracle client settings
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    oracledb.fetchArraySize = 100;
  }

  static getInstance(): OracleService {
    if (!OracleService.instance) {
      OracleService.instance = new OracleService();
    }
    return OracleService.instance;
  }

  /**
   * Create connection pool for a database server
   */
  async createConnectionPool(serverId: string, config: OracleConfig): Promise<void> {
    try {
      const connectionString = config.serviceName 
        ? `${config.host}:${config.port}/${config.serviceName}`
        : `${config.host}:${config.port}:${config.sid}`;

      const pool = await oracledb.createPool({
        user: config.user,
        password: config.password,
        connectString: connectionString,
        poolMin: 1,
        poolMax: 5,
        poolIncrement: 1,
        poolTimeout: 60,
        enableStatistics: true
      });

      this.connections.set(serverId, pool);
      console.log(`Oracle connection pool created for server: ${serverId}`);
    } catch (error) {
      console.error(`Failed to create Oracle connection pool for ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Get connection from pool
   */
  private async getConnection(serverId: string): Promise<oracledb.Connection> {
    const pool = this.connections.get(serverId);
    if (!pool) {
      throw new Error(`No connection pool found for server: ${serverId}`);
    }
    return await pool.getConnection();
  }

  /**
   * Test connection to Oracle server
   */
  async testConnection(serverId: string, config: OracleConfig): Promise<boolean> {
    let connection: oracledb.Connection | null = null;
    try {
      // Create temporary connection for testing
      const connectionString = config.serviceName 
        ? `${config.host}:${config.port}/${config.serviceName}`
        : `${config.host}:${config.port}:${config.sid}`;

      connection = await oracledb.getConnection({
        user: config.user,
        password: config.password,
        connectString: connectionString
      });

      // Test with a simple query
      const result = await connection.execute('SELECT 1 FROM DUAL');
      return result.rows && result.rows.length > 0;
    } catch (error) {
      console.error(`Oracle connection test failed for ${serverId}:`, error);
      return false;
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (error) {
          console.error('Error closing test connection:', error);
        }
      }
    }
  }

  /**
   * Fetch all tables and views from Oracle database
   */
  async fetchTables(serverId: string): Promise<OracleTable[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await this.getConnection(serverId);

      const query = `
        SELECT 
          OWNER as "schema",
          TABLE_NAME as "tableName", 
          'TABLE' as "tableType",
          COMMENTS as "comments"
        FROM DBA_TABLES 
        WHERE OWNER NOT IN ('SYS', 'SYSTEM', 'CTXSYS', 'DBSNMP', 'OUTLN', 'WMSYS')
        UNION ALL
        SELECT 
          OWNER as "schema",
          VIEW_NAME as "tableName", 
          'VIEW' as "tableType",
          NULL as "comments"
        FROM DBA_VIEWS 
        WHERE OWNER NOT IN ('SYS', 'SYSTEM', 'CTXSYS', 'DBSNMP', 'OUTLN', 'WMSYS')
        ORDER BY "schema", "tableName"
      `;

      const result = await connection.execute<OracleTable>(query);
      return result.rows || [];
    } catch (error) {
      console.error(`Failed to fetch tables for ${serverId}:`, error);
      throw error;
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (error) {
          console.error('Error closing connection:', error);
        }
      }
    }
  }

  /**
   * Fetch column metadata for a specific table
   */
  async fetchTableColumns(serverId: string, schema: string, tableName: string): Promise<OracleColumn[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await this.getConnection(serverId);

      const query = `
        SELECT 
          COLUMN_NAME as "columnName",
          DATA_TYPE as "dataType",
          NULLABLE as "nullable",
          DATA_LENGTH as "dataLength",
          DATA_PRECISION as "dataPrecision",
          DATA_SCALE as "dataScale"
        FROM DBA_TAB_COLUMNS 
        WHERE OWNER = :schema 
        AND TABLE_NAME = :tableName
        ORDER BY COLUMN_ID
      `;

      const result = await connection.execute<OracleColumn>(query, [schema, tableName]);
      return result.rows || [];
    } catch (error) {
      console.error(`Failed to fetch columns for ${schema}.${tableName}:`, error);
      throw error;
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (error) {
          console.error('Error closing connection:', error);
        }
      }
    }
  }

  /**
   * Execute a dry run query (EXPLAIN PLAN)
   */
  async executeDryRun(serverId: string, sqlQuery: string): Promise<any> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await this.getConnection(serverId);

      // Clear any existing plan
      await connection.execute(`DELETE FROM PLAN_TABLE WHERE STATEMENT_ID = 'QMS_DRY_RUN'`);

      // Generate execution plan
      const explainQuery = `EXPLAIN PLAN SET STATEMENT_ID = 'QMS_DRY_RUN' FOR ${sqlQuery}`;
      await connection.execute(explainQuery);

      // Fetch the execution plan
      const planQuery = `
        SELECT OPERATION, OPTIONS, OBJECT_NAME, COST, CARDINALITY
        FROM PLAN_TABLE 
        WHERE STATEMENT_ID = 'QMS_DRY_RUN'
        ORDER BY ID
      `;

      const result = await connection.execute(planQuery);
      
      return {
        success: true,
        estimatedRows: result.rows?.[0]?.CARDINALITY || 'Unknown',
        estimatedCost: result.rows?.[0]?.COST || 'Unknown',
        executionPlan: result.rows || []
      };
    } catch (error) {
      console.error(`Dry run failed for ${serverId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        estimatedRows: 'Error',
        estimatedCost: 'Error'
      };
    } finally {
      if (connection) {
        try {
          // Clean up
          await connection.execute(`DELETE FROM PLAN_TABLE WHERE STATEMENT_ID = 'QMS_DRY_RUN'`);
          await connection.close();
        } catch (error) {
          console.error('Error during cleanup:', error);
        }
      }
    }
  }

  /**
   * Close all connection pools
   */
  async closeAllConnections(): Promise<void> {
    for (const [serverId, pool] of Array.from(this.connections.entries())) {
      try {
        await pool.close(10); // 10 second drain time
        console.log(`Closed connection pool for ${serverId}`);
      } catch (error) {
        console.error(`Error closing pool for ${serverId}:`, error);
      }
    }
    this.connections.clear();
  }

  /**
   * Get Oracle server configuration based on server details
   */
  static getOracleConfig(server: any): OracleConfig {
    return {
      user: 'oracle_query_mgmt',
      password: 'YourSecurePassword123!',
      host: server.host,
      port: parseInt(server.port) || 1521,
      serviceName: server.serviceName || server.name // Use server name as service name if not specified
    };
  }
}

export default OracleService;
export { OracleConfig, OracleTable, OracleColumn };