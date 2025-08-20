# Oracle Database Requirements for Query Management System

## Overview
This document outlines all database-side components and configurations required to make the Oracle Query Management System fully functional with your 19 on-premise Oracle database servers (10g and 19c versions).

## 1. Oracle Database Connectivity Requirements

### 1.1 Network Configuration
- **Oracle TNS Listener**: Each Oracle server must have TNS listener configured and running
- **Port Access**: Default Oracle ports (1521, 1522) must be accessible from the application server
- **Firewall Rules**: Allow inbound connections from the application server to Oracle database ports
- **DNS/Hosts Resolution**: Database server hostnames must be resolvable from the application server

### 1.2 Oracle Client Libraries Required on Application Server
```bash
# Oracle Instant Client installation required
- Oracle Instant Client Basic Package
- Oracle Instant Client SDK Package
- Oracle Instant Client SQL*Plus Package (optional for debugging)
```

### 1.3 Environment Variables (Application Server)
```bash
ORACLE_HOME=/path/to/oracle/instantclient
LD_LIBRARY_PATH=$ORACLE_HOME:$LD_LIBRARY_PATH
TNS_ADMIN=/path/to/tns/admin
```

## 2. Database User Accounts & Privileges

### 2.1 Service Account Creation
Create a dedicated service account on each Oracle database:

```sql
-- Create service user for the application
CREATE USER oracle_query_mgmt IDENTIFIED BY "SecurePassword123!";

-- Grant necessary privileges
GRANT CONNECT TO oracle_query_mgmt;
GRANT RESOURCE TO oracle_query_mgmt;
GRANT CREATE SESSION TO oracle_query_mgmt;

-- For query execution (based on requirements)
GRANT SELECT ANY TABLE TO oracle_query_mgmt;     -- For SELECT queries
GRANT INSERT ANY TABLE TO oracle_query_mgmt;     -- For INSERT queries
GRANT UPDATE ANY TABLE TO oracle_query_mgmt;     -- For UPDATE queries
GRANT DELETE ANY TABLE TO oracle_query_mgmt;     -- For DELETE queries

-- For metadata discovery
GRANT SELECT ON sys.dba_tables TO oracle_query_mgmt;
GRANT SELECT ON sys.dba_tab_columns TO oracle_query_mgmt;
GRANT SELECT ON sys.dba_constraints TO oracle_query_mgmt;
GRANT SELECT ON sys.dba_indexes TO oracle_query_mgmt;

-- For execution plans (dry run)
GRANT SELECT ON sys.v_$sql_plan TO oracle_query_mgmt;
GRANT SELECT ON sys.v_$session TO oracle_query_mgmt;
```

### 2.2 Additional Privileges for Advanced Features
```sql
-- For transaction management and rollback
GRANT FLASHBACK ANY TABLE TO oracle_query_mgmt;
GRANT SELECT ANY TRANSACTION TO oracle_query_mgmt;

-- For performance monitoring
GRANT SELECT ON sys.v_$sql TO oracle_query_mgmt;
GRANT SELECT ON sys.v_$sql_text TO oracle_query_mgmt;
GRANT SELECT ON sys.v_$session_longops TO oracle_query_mgmt;
```

## 3. Required Oracle Packages/Components

### 3.1 Oracle Flashback (for Rollback Functionality)
```sql
-- Enable flashback on tables that need rollback capability
ALTER TABLE target_table ENABLE ROW MOVEMENT;
ALTER TABLE target_table FLASHBACK ON;

-- Grant flashback privileges
GRANT FLASHBACK (table_name) TO oracle_query_mgmt;
```

### 3.2 Oracle Explain Plan (for Dry Run)
```sql
-- Ensure PLAN_TABLE exists and is accessible
GRANT SELECT, INSERT, UPDATE, DELETE ON sys.plan_table$ TO oracle_query_mgmt;

-- Or create user-specific plan table
CREATE TABLE oracle_query_mgmt.plan_table AS 
SELECT * FROM sys.plan_table$ WHERE 1=0;
```

## 4. TNS Configuration (tnsnames.ora)

Create TNS entries for all 19 database servers:

```ini
# Example TNS entries for your servers
TPAOELDBSD001 =
  (DESCRIPTION =
    (ADDRESS = (PROTOCOL = TCP)(HOST = tpaoeldbsd001.domain.com)(PORT = 1521))
    (CONNECT_DATA =
      (SERVER = DEDICATED)
      (SERVICE_NAME = ORCL)
    )
  )

TPAOELDBSR001 =
  (DESCRIPTION =
    (ADDRESS = (PROTOCOL = TCP)(HOST = tpaoeldbsr001.domain.com)(PORT = 1521))
    (CONNECT_DATA =
      (SERVER = DEDICATED)
      (SERVICE_NAME = ORCL)
    )
  )

# ... (similar entries for all 19 servers)
```

## 5. Node.js Oracle Driver Setup

### 5.1 Required npm Package
```bash
npm install oracledb
```

### 5.2 Oracle Client Configuration in Node.js
```javascript
// server/oracle-config.js
const oracledb = require('oracledb');

// Configure Oracle client
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = false; // For transaction control

// Initialize Oracle client (one-time setup)
try {
  oracledb.initOracleClient({
    libDir: '/path/to/oracle/instantclient'
  });
} catch (err) {
  console.error('Oracle client initialization failed:', err);
}

module.exports = oracledb;
```

## 6. Database Connection Pools

### 6.1 Connection Pool Configuration
```javascript
// server/oracle-pools.js
const oracledb = require('./oracle-config');

const pools = {};

const createPool = async (serverId, config) => {
  try {
    const pool = await oracledb.createPool({
      user: config.username,
      password: config.password,
      connectString: config.connectionString,
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 2,
      poolTimeout: 60,
      poolPingInterval: 60
    });
    pools[serverId] = pool;
    return pool;
  } catch (err) {
    console.error(`Failed to create pool for ${serverId}:`, err);
    throw err;
  }
};

const getConnection = async (serverId) => {
  if (!pools[serverId]) {
    throw new Error(`No pool available for server: ${serverId}`);
  }
  return await pools[serverId].getConnection();
};

module.exports = { createPool, getConnection };
```

## 7. Required Oracle System Views & Tables

### 7.1 Metadata Discovery Queries
```sql
-- Get all tables in a schema
SELECT table_name, owner 
FROM dba_tables 
WHERE owner NOT IN ('SYS', 'SYSTEM', 'OUTLN', 'DBSNMP')
ORDER BY owner, table_name;

-- Get table columns
SELECT column_name, data_type, data_length, nullable, data_default
FROM dba_tab_columns 
WHERE owner = :schema_name AND table_name = :table_name
ORDER BY column_id;

-- Get table constraints
SELECT constraint_name, constraint_type, search_condition
FROM dba_constraints 
WHERE owner = :schema_name AND table_name = :table_name;

-- Get indexes
SELECT index_name, uniqueness, status
FROM dba_indexes 
WHERE owner = :schema_name AND table_name = :table_name;
```

### 7.2 Execution Plan Queries
```sql
-- Generate execution plan for dry run
EXPLAIN PLAN FOR :sql_statement;

-- Retrieve execution plan
SELECT plan_table_output 
FROM TABLE(dbms_xplan.display('PLAN_TABLE', NULL, 'ALL'));
```

## 8. Security & Audit Requirements

### 8.1 Database Audit Configuration
```sql
-- Enable audit for the service account
AUDIT SELECT, INSERT, UPDATE, DELETE BY oracle_query_mgmt;
AUDIT CREATE SESSION BY oracle_query_mgmt;

-- Create audit trail views
CREATE OR REPLACE VIEW oracle_query_audit AS
SELECT username, action_name, object_name, timestamp, sql_text
FROM dba_audit_trail
WHERE username = 'ORACLE_QUERY_MGMT';
```

### 8.2 Password Management
- Use Oracle Wallet for secure password storage
- Implement password rotation policies
- Use encrypted connections (SSL/TLS)

## 9. Backup & Recovery Prerequisites

### 9.1 Point-in-Time Recovery Setup
```sql
-- Enable archivelog mode for point-in-time recovery
SHUTDOWN IMMEDIATE;
STARTUP MOUNT;
ALTER DATABASE ARCHIVELOG;
ALTER DATABASE OPEN;

-- Configure flashback database
ALTER DATABASE FLASHBACK ON;
```

### 9.2 Table-Level Backup for Rollback
```sql
-- Create backup tables before major operations
CREATE TABLE table_name_backup_YYYYMMDD_HHMMSS AS 
SELECT * FROM table_name;
```

## 10. Performance & Monitoring

### 10.1 Required System Views Access
```sql
-- Performance monitoring views
GRANT SELECT ON sys.v_$session TO oracle_query_mgmt;
GRANT SELECT ON sys.v_$sql TO oracle_query_mgmt;
GRANT SELECT ON sys.v_$sql_text TO oracle_query_mgmt;
GRANT SELECT ON sys.v_$sesstat TO oracle_query_mgmt;
GRANT SELECT ON sys.v_$statname TO oracle_query_mgmt;
```

### 10.2 Query Execution Monitoring
```sql
-- Monitor long-running operations
SELECT opname, target, sofar, totalwork, 
       ROUND(sofar/totalwork*100, 2) AS pct_complete,
       elapsed_seconds, time_remaining
FROM v$session_longops
WHERE username = 'ORACLE_QUERY_MGMT';
```

## 11. Environment-Specific Configuration

### 11.1 Development Environment
- Use read-only replicas where possible
- Implement query timeouts (30 seconds)
- Limited to SELECT operations by default

### 11.2 Production Environment
- Full privileges for approved users
- Extended timeouts for complex queries
- Comprehensive logging and monitoring
- Automatic backup before destructive operations

## 12. Application Server Requirements

### 12.1 Hardware Requirements
- Minimum 8GB RAM for Oracle client libraries
- SSD storage for temporary files and logs
- Network latency < 5ms to database servers

### 12.2 Software Requirements
- Oracle Instant Client 19c or later
- Node.js 18+ with oracledb package
- SSL certificates for encrypted connections

## 13. Deployment Checklist

### Phase 1: Preparation
- [ ] Install Oracle Instant Client on application server
- [ ] Configure TNS entries for all 19 servers
- [ ] Create service accounts on all Oracle databases
- [ ] Grant required privileges
- [ ] Test connectivity from application server

### Phase 2: Application Integration
- [ ] Install oracledb npm package
- [ ] Configure connection pools
- [ ] Implement metadata discovery queries
- [ ] Set up dry-run functionality
- [ ] Configure rollback mechanisms

### Phase 3: Security & Monitoring
- [ ] Enable database auditing
- [ ] Set up encrypted connections
- [ ] Configure monitoring and alerting
- [ ] Implement backup procedures

### Phase 4: Testing
- [ ] Test connections to all 19 servers
- [ ] Verify metadata discovery
- [ ] Test query execution and rollback
- [ ] Performance testing with realistic workloads
- [ ] Security penetration testing

## 14. Troubleshooting Common Issues

### 14.1 Connection Issues
```bash
# Test TNS connectivity
tnsping TPAOELDBSD001

# Test SQL*Plus connection
sqlplus oracle_query_mgmt/password@TPAOELDBSD001
```

### 14.2 Performance Issues
```sql
-- Check connection pool status
SELECT * FROM v$session WHERE username = 'ORACLE_QUERY_MGMT';

-- Monitor query performance
SELECT sql_text, elapsed_time, cpu_time, executions
FROM v$sql WHERE parsing_user_id = 
  (SELECT user_id FROM dba_users WHERE username = 'ORACLE_QUERY_MGMT');
```

This comprehensive setup will enable your Oracle Query Management System to function fully with your 19 on-premise Oracle database servers.