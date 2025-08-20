# Oracle Query Management System - Implementation Checklist

## Overview
You have TWO types of servers to configure:
1. **Web Application Server** - Where your Oracle Query Management System runs
2. **Oracle Database Servers** - Your 19 on-premise Oracle databases

## PHASE 1: Oracle Database Servers Configuration

### Task: Configure Each of Your 19 Oracle Database Servers

**Location**: On your on-premise datacenters
**Servers**: tpaoeldbsd001, tpaoeldbsr001, tpacospgsd001, tpacospgsr001, etc.

#### Step 1A: Create Service Account (Repeat for Each Oracle Server)
```sql
-- Connect as SYSDBA to each Oracle server
sqlplus sys/your_sys_password@tpaoeldbsd001 as sysdba

-- Create service account
CREATE USER oracle_query_mgmt IDENTIFIED BY "SecurePass123!";

-- Grant permissions
GRANT CONNECT, CREATE SESSION TO oracle_query_mgmt;
GRANT SELECT ANY TABLE TO oracle_query_mgmt;
GRANT INSERT ANY TABLE TO oracle_query_mgmt;
GRANT UPDATE ANY TABLE TO oracle_query_mgmt;
GRANT DELETE ANY TABLE TO oracle_query_mgmt;

-- For metadata discovery
GRANT SELECT ON sys.dba_tables TO oracle_query_mgmt;
GRANT SELECT ON sys.dba_tab_columns TO oracle_query_mgmt;
GRANT SELECT ON sys.dba_constraints TO oracle_query_mgmt;

-- For dry-run execution plans
CREATE TABLE oracle_query_mgmt.plan_table AS 
SELECT * FROM sys.plan_table$ WHERE 1=0;

EXIT;
```

#### Step 1B: Test Service Account
```sql
-- Test the new account works
sqlplus oracle_query_mgmt/SecurePass123!@tpaoeldbsd001
SELECT COUNT(*) FROM dba_tables;
EXIT;
```

#### Step 1C: Network Verification
```bash
# From your web application server, test Oracle listener
telnet tpaoeldbsd001.your-domain.com 1521
# Should connect successfully
```

**Checklist for Oracle Servers:**
- [ ] tpaoeldbsd001 - Service account created ✓
- [ ] tpaoeldbsr001 - Service account created ✓  
- [ ] tpacospgsd001 - Service account created ✓
- [ ] tpacospgsr001 - Service account created ✓
- [ ] tpacospgsr002 - Service account created ✓
- [ ] ... (continue for all 19 servers)

---

## PHASE 2: Web Application Server Configuration

### Task: Configure Your Web Application Server (Where This App Runs)

**Location**: Where your Oracle Query Management System is hosted (Replit, AWS, company server, etc.)

#### Step 2A: Install Oracle Instant Client
```bash
# Download Oracle Instant Client
cd /tmp
wget https://download.oracle.com/otn_software/linux/instantclient/1921000/instantclient-basic-linux.x64-19.21.0.0.0dbru.zip

# Extract and install
sudo mkdir -p /opt/oracle
cd /opt/oracle
sudo unzip /tmp/instantclient-basic-linux.x64-19.21.0.0.0dbru.zip
sudo mv instantclient_19_21 instantclient
sudo chmod -R 755 /opt/oracle/instantclient
```

#### Step 2B: Set Environment Variables
```bash
# Add to your application's environment
export ORACLE_HOME=/opt/oracle/instantclient
export LD_LIBRARY_PATH=$ORACLE_HOME:$LD_LIBRARY_PATH

# For permanent setup (add to ~/.bashrc or your app's startup script)
echo 'export ORACLE_HOME=/opt/oracle/instantclient' >> ~/.bashrc
echo 'export LD_LIBRARY_PATH=$ORACLE_HOME:$LD_LIBRARY_PATH' >> ~/.bashrc
source ~/.bashrc
```

#### Step 2C: Create TNS Configuration
```bash
# Create network admin directory
sudo mkdir -p /opt/oracle/instantclient/network/admin

# Create tnsnames.ora file
sudo tee /opt/oracle/instantclient/network/admin/tnsnames.ora << EOF
TPAOELDBSD001 =
  (DESCRIPTION =
    (ADDRESS = (PROTOCOL = TCP)(HOST = tpaoeldbsd001.your-domain.com)(PORT = 1521))
    (CONNECT_DATA = (SERVICE_NAME = ORCL))
  )

TPAOELDBSR001 =
  (DESCRIPTION =
    (ADDRESS = (PROTOCOL = TCP)(HOST = tpaoeldbsr001.your-domain.com)(PORT = 1521))
    (CONNECT_DATA = (SERVICE_NAME = ORCL))
  )

# Add entries for all 19 servers...
EOF

# Set TNS_ADMIN environment variable
export TNS_ADMIN=/opt/oracle/instantclient/network/admin
echo 'export TNS_ADMIN=/opt/oracle/instantclient/network/admin' >> ~/.bashrc
```

#### Step 2D: Install Oracle Node.js Driver
```bash
# In your web application directory
npm install oracledb
```

#### Step 2E: Set Database Passwords
```bash
# Set environment variables for each Oracle server password
export ORACLE_PASSWORD_TPAOELDBSD001="SecurePass123!"
export ORACLE_PASSWORD_TPAOELDBSR001="SecurePass123!"
export ORACLE_PASSWORD_TPACOSPGSD001="SecurePass123!"
# ... for all 19 servers

# Or add to your app's environment configuration
```

**Checklist for Web Application Server:**
- [ ] Oracle Instant Client installed ✓
- [ ] Environment variables set ✓
- [ ] TNS configuration created ✓
- [ ] Node.js oracledb package installed ✓
- [ ] Database passwords configured ✓

---

## PHASE 3: Testing & Validation

#### Step 3A: Test TNS Connectivity
```bash
# Test connection to each Oracle server
tnsping TPAOELDBSD001
tnsping TPAOELDBSR001
# ... test all 19 servers
```

#### Step 3B: Test SQL Connectivity
```bash
# Test actual SQL connection
sqlplus oracle_query_mgmt/SecurePass123!@TPAOELDBSD001
SQL> SELECT 1 FROM dual;
SQL> EXIT;
```

#### Step 3C: Test Through Web Application
1. Navigate to your Oracle Query Management System
2. Go to Admin/Database Servers section
3. Use "Test Connection" button for each server
4. Verify all 19 servers show "Connected" status

**Testing Checklist:**
- [ ] TNS ping successful for all 19 servers ✓
- [ ] SQL connection successful for all 19 servers ✓
- [ ] Web application shows all servers as connected ✓

---

## PHASE 4: Enable Oracle Integration in Your Application

#### Step 4A: Uncomment Oracle Routes
In your `server/routes.ts` file, uncomment the Oracle integration:
```typescript
// Change this line:
// const oracleRoutes = require('./oracle-routes');

// To this:
const oracleRoutes = require('./oracle-routes');

// And add this line in your routes section:
app.use('/api', oracleRoutes);
```

#### Step 4B: Test Application Features
1. **Metadata Discovery**: Try discovering tables from each Oracle server
2. **Dry Run**: Execute a SELECT query with dry-run enabled
3. **Query Execution**: Submit and approve a simple SELECT query
4. **Rollback**: Test rollback functionality (if enabled)

**Application Integration Checklist:**
- [ ] Oracle routes enabled in application ✓
- [ ] Metadata discovery working ✓
- [ ] Dry-run functionality working ✓
- [ ] Query execution working ✓
- [ ] Approval workflow working with Oracle ✓

---

## Summary of What Goes Where

### Your 19 Oracle Database Servers (On-Premise)
- Create `oracle_query_mgmt` service account
- Grant appropriate privileges
- Ensure network connectivity
- Test service account login

### Your Web Application Server (Where This App Runs)
- Install Oracle Instant Client
- Configure environment variables
- Set up TNS configuration
- Install Node.js oracledb package
- Configure database passwords
- Enable Oracle routes in application

### What's Already Done
Your Oracle Query Management System web application is complete with:
- ✅ User interface and SQL editor
- ✅ Two-level approval workflow
- ✅ Authentication and role management
- ✅ All 19 database servers pre-configured
- ✅ Oracle integration code ready
- ✅ Dry-run and rollback capabilities built-in

You just need to establish the database connectivity layer!