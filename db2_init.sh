#!/bin/bash
# Wait for db1 to be ready
until mysql -h db1 -u root -password -e "SELECT 1"; do
  echo "Waiting for db1 database connection..."
  sleep 5
done

# Configure the slave
mysql -u root -password <<-EOSQL
CHANGE MASTER TO
  MASTER_HOST='db1',
  MASTER_USER='repl_user',
  MASTER_PASSWORD='repl_password',
  MASTER_LOG_FILE='mysql-bin.000001',  -- Update based on the SHOW MASTER STATUS output from db1
  MASTER_LOG_POS=583;  -- Update based on the SHOW MASTER STATUS output from db1
START SLAVE;
EOSQL
