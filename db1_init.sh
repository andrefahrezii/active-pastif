#!/bin/bash
# Inisialisasi Master
mysql -u root -password <<-EOSQL
CREATE USER 'repl_user'@'%' IDENTIFIED BY 'repl_password';
GRANT REPLICATION SLAVE ON *.* TO 'repl_user'@'%';
FLUSH PRIVILEGES;
EOSQL
