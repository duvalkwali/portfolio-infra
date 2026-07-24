#!/bin/bash
set -e

create_db_and_user() {
    local db=$1 user=$2 pass=$3
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-SQL
        DO \$\$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$user') THEN
                CREATE ROLE $user WITH LOGIN PASSWORD '$pass';
            END IF;
        END
        \$\$;
        SELECT 'CREATE DATABASE $db OWNER $user'
        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')\gexec
        GRANT ALL PRIVILEGES ON DATABASE $db TO $user;
SQL
}

create_db_and_user "ledgerguard" "$LG_DB_USER" "$LG_DB_PASSWORD"
create_db_and_user "relay" "$RELAY_DB_USER" "$RELAY_DB_PASSWORD"
create_db_and_user "documind" "$DOCUMIND_DB_USER" "$DOCUMIND_DB_PASSWORD"
create_db_and_user "aeropulse" "$AERO_DB_USER" "$AERO_DB_PASSWORD"

echo "All databases and roles created."
