import { db } from "./db";
import { sql } from "drizzle-orm";

export async function runMigrations() {
  try {
    console.log("🔄 Starting comprehensive database verification...");

    // Test database connection first
    await db.execute(sql`SELECT 1 as test`);
    console.log("✅ Database connection established");

    // Function to check if table exists
    async function tableExists(tableName: string): Promise<boolean> {
      try {
        const result = await db.execute(sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${tableName}
          );
        `);
        return result.rows[0].exists;
      } catch (error) {
        console.log(`❌ Error checking table ${tableName}:`, error.message);
        return false;
      }
    }

    // Function to check if column exists
    async function columnExists(tableName: string, columnName: string): Promise<boolean> {
      try {
        const result = await db.execute(sql`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = ${tableName}
            AND column_name = ${columnName}
          );
        `);
        return result.rows[0].exists;
      } catch (error) {
        console.log(`❌ Error checking column ${columnName} in ${tableName}:`, error.message);
        return false;
      }
    }

    // Function to add missing column
    async function addColumn(tableName: string, columnName: string, columnDefinition: string) {
      try {
        await db.execute(sql.raw(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`));
        console.log(`✅ Added missing column ${columnName} to ${tableName}`);
      } catch (error) {
        console.log(`⚠️ Could not add column ${columnName} to ${tableName}:`, error.message);
      }
    }

    // Function to add missing columns to VM inventory table
    async function addMissingVMInventoryColumns() {
      console.log("🔎 Checking for missing columns in vm_inventory...");
      const vmInventoryColumns = [
        // Core VM Information - New required fields
        ['vm_id', 'TEXT'],
        ['vm_name', 'TEXT NOT NULL'],
        ['vm_status', 'TEXT NOT NULL DEFAULT \'Active\''],
        ['vm_ip', 'TEXT'],
        ['vm_os', 'TEXT'],
        ['cpu_count', 'INTEGER DEFAULT 0'],
        ['memory_gb', 'INTEGER DEFAULT 0'],
        ['disk_capacity_gb', 'INTEGER DEFAULT 0'],

        // Request and Approval Information
        ['requestor', 'TEXT'],
        ['knox_id', 'TEXT'],
        ['department', 'TEXT'],
        ['start_date', 'TEXT'],
        ['end_date', 'TEXT'],
        ['jira_number', 'TEXT'],
        ['approval_number', 'TEXT'],
        ['remarks', 'TEXT'],

        // Legacy compatibility fields
        ['internet_access', 'BOOLEAN DEFAULT FALSE'],
        ['vm_os_version', 'TEXT'],
        ['hypervisor', 'TEXT'],
        ['host_name', 'TEXT'],
        ['host_model', 'TEXT'],
        ['host_ip', 'TEXT'],
        ['host_os', 'TEXT'],
        ['rack', 'TEXT'],
        ['deployed_by', 'TEXT'],
        ['"user"', 'TEXT'],
        ['jira_ticket', 'TEXT'],
        ['date_deleted', 'TEXT'],
        ['guest_os', 'TEXT'],
        ['power_state', 'TEXT'],
        ['memory_mb', 'INTEGER'],
        ['disk_gb', 'INTEGER'],
        ['ip_address', 'TEXT'],
        ['mac_address', 'TEXT'],
        ['vmware_tools', 'TEXT'],
        ['cluster', 'TEXT'],
        ['datastore', 'TEXT'],
        ['status', 'TEXT DEFAULT \'available\''],
        ['assigned_to', 'INTEGER'],
        ['location', 'TEXT'],
        ['serial_number', 'TEXT'],
        ['model', 'TEXT'],
        ['manufacturer', 'TEXT'],
        ['purchase_date', 'TEXT'],
        ['purchase_cost', 'TEXT'],
        ['created_date', 'TEXT DEFAULT CURRENT_TIMESTAMP'],
        ['last_modified', 'TEXT DEFAULT CURRENT_TIMESTAMP'],
        ['notes', 'TEXT']
      ];

      for (const [columnName, definition] of vmInventoryColumns) {
        if (!(await columnExists('vm_inventory', columnName))) {
          await addColumn('vm_inventory', columnName, definition);
        }
      }
      
      // Specific check for critical fields
      if (!(await columnExists('vm_inventory', 'requestor'))) {
        await addColumn('vm_inventory', 'requestor', 'TEXT');
        console.log("✅ Added missing requestor column");
      }
      if (!(await columnExists('vm_inventory', 'jira_number'))) {
        await addColumn('vm_inventory', 'jira_number', 'TEXT');
        console.log("✅ Added missing jira_number column");
      }
      
      console.log("✅ VM inventory column check completed.");
    }

    // Verify users table and columns
    if (!(await tableExists('users'))) {
      await db.execute(sql`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          email TEXT NOT NULL,
          department TEXT,
          is_admin BOOLEAN DEFAULT FALSE,
          role_id INTEGER,
          permissions JSON DEFAULT '{"assets":{"view":true,"edit":false,"add":false},"components":{"view":true,"edit":false,"add":false},"accessories":{"view":true,"edit":false,"add":false},"consumables":{"view":true,"edit":false,"add":false},"licenses":{"view":true,"edit":false,"add":false},"users":{"view":false,"edit":false,"add":false},"reports":{"view":true,"edit":false,"add":false},"vmMonitoring":{"view":true,"edit":false,"add":false},"networkDiscovery":{"view":true,"edit":false,"add":false},"bitlockerKeys":{"view":false,"edit":false,"add":false},"admin":{"view":false,"edit":false,"add":false}}'
        )
      `);
      console.log("✅ Users table created");
    } else {
      console.log("✅ Users table exists - verifying columns");
      // Check and add missing columns
      const userColumns = [
        ['username', 'TEXT UNIQUE NOT NULL'],
        ['password', 'TEXT NOT NULL'],
        ['first_name', 'TEXT NOT NULL'],
        ['last_name', 'TEXT NOT NULL'],
        ['email', 'TEXT NOT NULL'],
        ['department', 'TEXT'],
        ['is_admin', 'BOOLEAN DEFAULT FALSE'],
        ['role_id', 'INTEGER'],
        ['permissions', 'JSON DEFAULT \'{"assets":{"view":true,"edit":false,"add":false},"components":{"view":true,"edit":false,"add":false},"accessories":{"view":true,"edit":false,"add":false},"consumables":{"view":true,"edit":false,"add":false},"licenses":{"view":true,"edit":false,"add":false},"users":{"view":false,"edit":false,"add":false},"reports":{"view":true,"edit":false,"add":false},"vmMonitoring":{"view":true,"edit":false,"add":false},"networkDiscovery":{"view":true,"edit":false,"add":false},"bitlockerKeys":{"view":false,"edit":false,"add":false},"admin":{"view":false,"edit":false,"add":false}}\'']
      ];

      for (const [columnName, definition] of userColumns) {
        if (!(await columnExists('users', columnName))) {
          await addColumn('users', columnName, definition);
        }
      }
    }

    // Verify assets table and columns
    if (!(await tableExists('assets'))) {
      await db.execute(sql`
        CREATE TABLE assets (
          id SERIAL PRIMARY KEY,
          asset_tag TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          description TEXT,
          category TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'available',
          condition TEXT NOT NULL DEFAULT 'Good',
          purchase_date TEXT,
          purchase_cost TEXT,
          location TEXT,
          serial_number TEXT,
          model TEXT,
          manufacturer TEXT,
          notes TEXT,
          knox_id TEXT,
          ip_address TEXT,
          mac_address TEXT,
          os_type TEXT,
          assigned_to INTEGER REFERENCES users(id),
          checkout_date TEXT,
          expected_checkin_date TEXT,
          finance_updated BOOLEAN DEFAULT FALSE,
          department TEXT
        )
      `);
      console.log("✅ Assets table created");
    } else {
      console.log("✅ Assets table exists - verifying columns");
      const assetColumns = [
        ['asset_tag', 'TEXT NOT NULL UNIQUE'],
        ['name', 'TEXT NOT NULL'],
        ['description', 'TEXT'],
        ['category', 'TEXT NOT NULL'],
        ['status', 'TEXT NOT NULL DEFAULT \'available\''],
        ['condition', 'TEXT NOT NULL DEFAULT \'Good\''],
        ['purchase_date', 'TEXT'],
        ['purchase_cost', 'TEXT'],
        ['location', 'TEXT'],
        ['serial_number', 'TEXT'],
        ['model', 'TEXT'],
        ['manufacturer', 'TEXT'],
        ['notes', 'TEXT'],
        ['knox_id', 'TEXT'],
        ['ip_address', 'TEXT'],
        ['mac_address', 'TEXT'],
        ['os_type', 'TEXT'],
        ['assigned_to', 'INTEGER'],
        ['checkout_date', 'TEXT'],
        ['expected_checkin_date', 'TEXT'],
        ['finance_updated', 'BOOLEAN DEFAULT FALSE'],
        ['department', 'TEXT']
      ];

      for (const [columnName, definition] of assetColumns) {
        if (!(await columnExists('assets', columnName))) {
          await addColumn('assets', columnName, definition);
        }
      }
    }

    // Define all table schemas for verification
    const tableSchemas = {
      components: [
        ['name', 'TEXT NOT NULL'],
        ['type', 'TEXT NOT NULL DEFAULT \'Unknown\''],
        ['category', 'TEXT NOT NULL'],
        ['quantity', 'INTEGER NOT NULL DEFAULT 0'],
        ['status', 'TEXT DEFAULT \'available\''],
        ['description', 'TEXT'],
        ['location', 'TEXT'],
        ['serial_number', 'TEXT'],
        ['model', 'TEXT'],
        ['manufacturer', 'TEXT'],
        ['purchase_date', 'TEXT'],
        ['purchase_cost', 'TEXT'],
        ['warranty_expiry', 'TEXT'],
        ['assigned_to', 'TEXT'],
        ['date_released', 'TEXT'],
        ['date_returned', 'TEXT'],
        ['released_by', 'TEXT'],
        ['returned_to', 'TEXT'],
        ['specifications', 'TEXT'],
        ['notes', 'TEXT'],
        ['created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
        ['updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP']
      ],
      accessories: [
        ['name', 'TEXT NOT NULL'],
        ['category', 'TEXT NOT NULL'],
        ['status', 'TEXT NOT NULL'],
        ['quantity', 'INTEGER NOT NULL DEFAULT 1'],
        ['description', 'TEXT'],
        ['location', 'TEXT'],
        ['serial_number', 'TEXT'],
        ['model', 'TEXT'],
        ['manufacturer', 'TEXT'],
        ['purchase_date', 'TEXT'],
        ['purchase_cost', 'TEXT'],
        ['assigned_to', 'INTEGER'],
        ['knox_id', 'TEXT'],
        ['date_released', 'TEXT'],
        ['date_returned', 'TEXT'],
        ['released_by', 'TEXT'],
        ['returned_to', 'TEXT'],
        ['notes', 'TEXT'],
        ['created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
        ['updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP']
      ],
      consumables: [
        ['name', 'TEXT NOT NULL'],
        ['category', 'TEXT NOT NULL'],
        ['quantity', 'INTEGER NOT NULL DEFAULT 1'],
        ['status', 'TEXT NOT NULL DEFAULT \'available\''],
        ['location', 'TEXT'],
        ['model_number', 'TEXT'],
        ['manufacturer', 'TEXT'],
        ['purchase_date', 'TEXT'],
        ['purchase_cost', 'TEXT'],
        ['notes', 'TEXT']
      ],
      licenses: [
        ['name', 'TEXT NOT NULL'],
        ['key', 'TEXT NOT NULL'],
        ['seats', 'TEXT'],
        ['assigned_seats', 'INTEGER DEFAULT 0'],
        ['company', 'TEXT'],
        ['manufacturer', 'TEXT'],
        ['purchase_date', 'TEXT'],
        ['expiration_date', 'TEXT'],
        ['purchase_cost', 'TEXT'],
        ['status', 'TEXT NOT NULL'],
        ['notes', 'TEXT'],
        ['assigned_to', 'INTEGER']
      ],
      monitor_inventory: [
        ['seat_number', 'TEXT NOT NULL'],
        ['knox_id', 'TEXT'],
        ['asset_number', 'TEXT'],
        ['serial_number', 'TEXT'],
        ['model', 'TEXT'],
        ['remarks', 'TEXT'],
        ['department', 'TEXT'],
        ['created_at', 'TEXT DEFAULT CURRENT_TIMESTAMP'],
        ['updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP']
      ],
      bitlocker_keys: [
        ['serial_number', 'TEXT NOT NULL'],
        ['identifier', 'TEXT NOT NULL'],
        ['recovery_key', 'TEXT NOT NULL'],
        ['notes', 'TEXT'],
        ['date_added', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
        ['updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP']
      ]
    };

    // Verify or create each table with its columns
    for (const [tableName, columns] of Object.entries(tableSchemas)) {
      if (!(await tableExists(tableName))) {
        const columnDefs = columns.map(([name, def]) => `${name} ${def}`).join(', ');
        await db.execute(sql.raw(`CREATE TABLE ${tableName} (id SERIAL PRIMARY KEY, ${columnDefs})`));
        console.log(`✅ ${tableName} table created`);
      } else {
        console.log(`✅ ${tableName} table exists - verifying columns`);
        for (const [columnName, definition] of columns) {
          if (!(await columnExists(tableName, columnName))) {
            await addColumn(tableName, columnName, definition);
          }
        }
      }
    }

    // Create components table
    if (!(await tableExists('components'))) {
      await db.execute(sql`
        CREATE TABLE components (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'Unknown',
          category TEXT NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 0,
          status TEXT DEFAULT 'available',
          description TEXT,
          location TEXT,
          serial_number TEXT,
          model TEXT,
          manufacturer TEXT,
          purchase_date TEXT,
          purchase_cost TEXT,
          warranty_expiry TEXT,
          assigned_to TEXT,
          date_released TEXT,
          date_returned TEXT,
          released_by TEXT,
          returned_to TEXT,
          specifications TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    // Create remaining essential tables with verification
    const essentialTables = [
      {
        name: 'activities',
        sql: `CREATE TABLE activities (
          id SERIAL PRIMARY KEY,
          action TEXT NOT NULL,
          item_type TEXT NOT NULL,
          item_id INTEGER NOT NULL,
          user_id INTEGER REFERENCES users(id),
          timestamp TEXT NOT NULL,
          notes TEXT
        )`
      },
      {
        name: 'license_assignments',
        sql: `CREATE TABLE license_assignments (
          id SERIAL PRIMARY KEY,
          license_id INTEGER NOT NULL,
          assigned_to TEXT NOT NULL,
          notes TEXT,
          assigned_date TEXT NOT NULL
        )`
      },
      {
        name: 'consumable_assignments',
        sql: `CREATE TABLE consumable_assignments (
          id SERIAL PRIMARY KEY,
          consumable_id INTEGER NOT NULL,
          assigned_to TEXT NOT NULL,
          serial_number TEXT,
          knox_id TEXT,
          quantity INTEGER NOT NULL DEFAULT 1,
          assigned_date TEXT NOT NULL,
          returned_date TEXT,
          status TEXT NOT NULL DEFAULT 'assigned',
          notes TEXT
        )`
      },
      {
        name: 'it_equipment',
        sql: `CREATE TABLE it_equipment (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          total_quantity INTEGER,
          assigned_quantity INTEGER DEFAULT 0,
          model TEXT,
          location TEXT,
          date_acquired TEXT,
          knox_id TEXT,
          serial_number TEXT,
          date_release TEXT,
          remarks TEXT,
          status TEXT DEFAULT 'available',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: 'it_equipment_assignments',
        sql: `CREATE TABLE it_equipment_assignments (
          id SERIAL PRIMARY KEY,
          equipment_id INTEGER NOT NULL,
          assigned_to TEXT NOT NULL,
          knox_id TEXT,
          serial_number TEXT,
          quantity INTEGER NOT NULL DEFAULT 1,
          assigned_date TEXT NOT NULL,
          returned_date TEXT,
          status TEXT NOT NULL DEFAULT 'assigned',
          notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`
      }
    ];

    for (const table of essentialTables) {
      if (!(await tableExists(table.name))) {
        await db.execute(sql.raw(table.sql));
        console.log(`✅ ${table.name} table created`);
      }
    }

    // Create license assignments table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS license_assignments (
        id SERIAL PRIMARY KEY,
        license_id INTEGER REFERENCES licenses(id) NOT NULL,
        assigned_to TEXT NOT NULL,
        notes TEXT,
        assigned_date TEXT NOT NULL
      )
    `);
    console.log("✅ License assignments table created/verified");

    // Create consumable assignments table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS consumable_assignments (
        id SERIAL PRIMARY KEY,
        consumable_id INTEGER REFERENCES consumables(id) NOT NULL,
        assigned_to TEXT NOT NULL,
        serial_number TEXT,
        knox_id TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        assigned_date TEXT NOT NULL,
        returned_date TEXT,
        status TEXT NOT NULL DEFAULT 'assigned',
        notes TEXT
      )
    `);
    console.log("✅ Consumable assignments table created/verified");

    // Create activities table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        action TEXT NOT NULL,
        item_type TEXT NOT NULL,
        item_id INTEGER NOT NULL,
        user_id INTEGER REFERENCES users(id),
        timestamp TEXT NOT NULL,
        notes TEXT
      )
    `);
    console.log("✅ Activities table created/verified");

    // Create VM and monitoring tables with verification
    if (!(await tableExists('vm_inventory'))) {
      await db.execute(sql`
        CREATE TABLE vm_inventory (
          id SERIAL PRIMARY KEY,

          -- Core VM Information
          vm_id TEXT,
          vm_name TEXT NOT NULL,
          vm_status TEXT NOT NULL DEFAULT 'Active',
          vm_ip TEXT,
          vm_os TEXT,
          cpu_count INTEGER DEFAULT 0,
          memory_gb INTEGER DEFAULT 0,
          disk_capacity_gb INTEGER DEFAULT 0,

          -- Request and Approval Information
          requestor TEXT,
          knox_id TEXT,
          department TEXT,
          start_date TEXT,
          end_date TEXT,
          jira_number TEXT,
          approval_number TEXT,
          remarks TEXT,

          -- Legacy compatibility fields
          internet_access BOOLEAN DEFAULT FALSE,
          vm_os_version TEXT,
          hypervisor TEXT,
          host_name TEXT,
          host_model TEXT,
          host_ip TEXT,
          host_os TEXT,
          rack TEXT,
          deployed_by TEXT,
          "user" TEXT,
          jira_ticket TEXT,
          date_deleted TEXT,
          guest_os TEXT,
          power_state TEXT,
          memory_mb INTEGER,
          disk_gb INTEGER,
          ip_address TEXT,
          mac_address TEXT,
          vmware_tools TEXT,
          cluster TEXT,
          datastore TEXT,
          status TEXT DEFAULT 'available',
          assigned_to INTEGER,
          location TEXT,
          serial_number TEXT,
          model TEXT,
          manufacturer TEXT,
          purchase_date TEXT,
          purchase_cost TEXT,
          created_date TEXT DEFAULT CURRENT_TIMESTAMP,
          last_modified TEXT DEFAULT CURRENT_TIMESTAMP,
          notes TEXT
        )
      `);
      console.log("✅ VM inventory table created with all required columns");
    } else {
      console.log("✅ VM inventory table exists - verifying columns");
    }

    // Check and add missing columns to existing VM inventory table
    await addMissingVMInventoryColumns();

    // Create VMs table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS vms (
        id SERIAL PRIMARY KEY,
        vm_name TEXT NOT NULL,
        host_name TEXT NOT NULL,
        guest_os TEXT NOT NULL,
        power_state TEXT NOT NULL DEFAULT 'stopped',
        cpu_count INTEGER DEFAULT 1,
        memory_mb INTEGER DEFAULT 1024,
        disk_gb INTEGER DEFAULT 20,
        ip_address TEXT,
        mac_address TEXT,
        vmware_tools TEXT,
        cluster TEXT,
        datastore TEXT,
        status TEXT NOT NULL DEFAULT 'available',
        assigned_to INTEGER REFERENCES users(id),
        location TEXT,
        serial_number TEXT,
        model TEXT,
        manufacturer TEXT,
        purchase_date TEXT,
        purchase_cost TEXT,
        department TEXT,
        description TEXT,
        created_date TEXT DEFAULT CURRENT_TIMESTAMP,
        last_modified TEXT DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      )
    `);
    console.log("✅ VMs table created/verified");

    // Create IT Equipment table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS it_equipment (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        total_quantity INTEGER,
        assigned_quantity INTEGER DEFAULT 0,
        model TEXT,
        location TEXT,
        date_acquired TEXT,
        knox_id TEXT,
        serial_number TEXT,
        date_release TEXT,
        remarks TEXT,
        status TEXT DEFAULT 'available',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ IT Equipment table created/verified");

    // Create IT Equipment Assignments table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS it_equipment_assignments (
        id SERIAL PRIMARY KEY,
        equipment_id INTEGER REFERENCES it_equipment(id) NOT NULL,
        assigned_to TEXT NOT NULL,
        knox_id TEXT,
        serial_number TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        assigned_date TEXT NOT NULL,
        returned_date TEXT,
        status TEXT NOT NULL DEFAULT 'assigned',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ IT Equipment Assignments table created/verified");

    // Verify system and monitoring tables
    const systemTables = [
      {
        name: 'system_settings',
        sql: `CREATE TABLE system_settings (
          id SERIAL PRIMARY KEY,
          site_name TEXT NOT NULL DEFAULT 'SRPH-MIS',
          site_url TEXT NOT NULL DEFAULT '',
          default_language TEXT NOT NULL DEFAULT 'en',
          default_timezone TEXT NOT NULL DEFAULT 'UTC',
          allow_public_registration BOOLEAN DEFAULT FALSE,
          company_name TEXT NOT NULL DEFAULT 'SRPH',
          company_address TEXT DEFAULT '',
          company_phone TEXT DEFAULT '',
          company_email TEXT DEFAULT '',
          company_logo TEXT DEFAULT '',
          mail_driver TEXT DEFAULT '',
          mail_host TEXT DEFAULT '',
          mail_port TEXT DEFAULT '',
          mail_username TEXT DEFAULT '',
          mail_password TEXT DEFAULT '',
          mail_from_address TEXT DEFAULT '',
          mail_from_name TEXT DEFAULT '',
          asset_tag_prefix TEXT DEFAULT 'SRPH',
          asset_tag_zeros INTEGER DEFAULT 5,
          asset_auto_increment BOOLEAN DEFAULT TRUE,
          asset_checkout_policy TEXT DEFAULT '',
          asset_checkout_duration INTEGER DEFAULT 30,
          enable_login_attempts BOOLEAN DEFAULT TRUE,
          max_login_attempts INTEGER DEFAULT 5,
          lockout_duration INTEGER DEFAULT 30,
          password_min_length INTEGER DEFAULT 8,
          require_special_char BOOLEAN DEFAULT TRUE,
          require_uppercase BOOLEAN DEFAULT TRUE,
          require_number BOOLEAN DEFAULT TRUE,
          password_expiry_days INTEGER DEFAULT 90,
          enable_admin_notifications BOOLEAN DEFAULT TRUE,
          enable_user_notifications BOOLEAN DEFAULT TRUE,
          notify_on_checkout BOOLEAN DEFAULT TRUE,
          notify_on_checkin BOOLEAN DEFAULT TRUE,
          notify_on_overdue BOOLEAN DEFAULT TRUE,
          automatic_backups BOOLEAN DEFAULT FALSE,
          backup_frequency TEXT DEFAULT 'daily',
          backup_time TEXT DEFAULT '00:00',
          backup_retention INTEGER DEFAULT 30,
          maintenance_mode BOOLEAN DEFAULT FALSE,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: 'vms',
        sql: `CREATE TABLE vms (
          id SERIAL PRIMARY KEY,
          vm_name TEXT NOT NULL,
          host_name TEXT NOT NULL,
          guest_os TEXT NOT NULL,
          power_state TEXT NOT NULL DEFAULT 'stopped',
          cpu_count INTEGER DEFAULT 1,
          memory_mb INTEGER DEFAULT 1024,
          disk_gb INTEGER DEFAULT 20,
          ip_address TEXT,
          mac_address TEXT,
          vmware_tools TEXT,
          cluster TEXT,
          datastore TEXT,
          status TEXT NOT NULL DEFAULT 'available',
          assigned_to INTEGER,
          location TEXT,
          serial_number TEXT,
          model TEXT,
          manufacturer TEXT,
          purchase_date TEXT,
          purchase_cost TEXT,
          department TEXT,
          description TEXT,
          created_date TEXT DEFAULT CURRENT_TIMESTAMP,
          last_modified TEXT DEFAULT CURRENT_TIMESTAMP,
          notes TEXT
        )`
      },
      {
        name: 'zabbix_settings',
        sql: `CREATE TABLE zabbix_settings (
          id SERIAL PRIMARY KEY,
          server_url TEXT NOT NULL DEFAULT '',
          username TEXT NOT NULL DEFAULT '',
          password TEXT NOT NULL DEFAULT '',
          api_token TEXT DEFAULT '',
          last_sync TIMESTAMP,
          sync_interval INTEGER DEFAULT 30,
          enabled BOOLEAN DEFAULT FALSE,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: 'discovered_hosts',
        sql: `CREATE TABLE discovered_hosts (
          id SERIAL PRIMARY KEY,
          hostname TEXT,
          ip_address TEXT NOT NULL,
          mac_address TEXT,
          status TEXT NOT NULL DEFAULT 'new',
          last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          source TEXT NOT NULL DEFAULT 'zabbix',
          system_info JSON DEFAULT '{}',
          hardware_details JSON DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: 'vm_monitoring',
        sql: `CREATE TABLE vm_monitoring (
          id SERIAL PRIMARY KEY,
          vm_id INTEGER NOT NULL,
          hostname TEXT,
          ip_address TEXT,
          status TEXT,
          cpu_usage REAL,
          memory_usage REAL,
          disk_usage REAL,
          uptime INTEGER,
          network_status TEXT,
          os_name TEXT,
          cpu_cores INTEGER,
          total_memory BIGINT,
          total_disk BIGINT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`
      }
    ];

    for (const table of systemTables) {
      if (!(await tableExists(table.name))) {
        await db.execute(sql.raw(table.sql));
        console.log(`✅ ${table.name} table created`);
      }
    }

    // Create monitoring tables
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS monitoring_dashboards (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        is_public BOOLEAN DEFAULT FALSE,
        refresh_interval INTEGER DEFAULT 30,
        tags TEXT,
        user_id INTEGER REFERENCES users(id),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS monitoring_panels (
        id SERIAL PRIMARY KEY,
        dashboard_id INTEGER NOT NULL REFERENCES monitoring_dashboards(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        datasource TEXT NOT NULL,
        query TEXT NOT NULL,
        refresh_interval INTEGER DEFAULT 30,
        width INTEGER DEFAULT 6,
        height INTEGER DEFAULT 300,
        x_pos INTEGER DEFAULT 0,
        y_pos INTEGER DEFAULT 0,
        thresholds TEXT,
        unit TEXT,
        decimals INTEGER DEFAULT 2,
        show_legend BOOLEAN DEFAULT TRUE,
        color_scheme TEXT DEFAULT 'default',
        config TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS monitoring_datasources (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        url TEXT NOT NULL,
        access TEXT DEFAULT 'proxy',
        basic_auth BOOLEAN DEFAULT FALSE,
        basic_auth_user TEXT,
        basic_auth_password TEXT,
        database TEXT,
        json_data TEXT,
        secure_json_fields TEXT,
        is_default BOOLEAN DEFAULT FALSE,
        status TEXT DEFAULT 'pending',
        last_check TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS monitoring_alert_rules (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        datasource TEXT NOT NULL,
        query TEXT NOT NULL,
        condition TEXT NOT NULL,
        threshold REAL NOT NULL,
        evaluation_interval INTEGER DEFAULT 60,
        for_duration INTEGER DEFAULT 300,
        severity TEXT DEFAULT 'medium',
        enabled BOOLEAN DEFAULT TRUE,
        notification_channels TEXT,
        annotations TEXT,
        labels TEXT,
        state TEXT DEFAULT 'normal',
        last_evaluation TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS monitoring_alerts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        datasource TEXT NOT NULL,
        query TEXT NOT NULL,
        condition TEXT NOT NULL,
        threshold REAL NOT NULL,
        evaluation_interval INTEGER DEFAULT 60,
        for_duration INTEGER DEFAULT 300,
        severity TEXT DEFAULT 'medium',
        enabled BOOLEAN DEFAULT TRUE,
        notification_channels TEXT,
        annotations TEXT,
        labels TEXT,
        state TEXT DEFAULT 'normal',
        last_evaluation TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS monitoring_notifications (
        id SERIAL PRIMARY KEY,
        alert_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        recipient TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        sent_at TEXT,
        error TEXT,
        created_at TEXT NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        read BOOLEAN DEFAULT FALSE,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("✅ Monitoring tables created/verified");

    // Create Zabbix and network discovery tables
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS zabbix_settings (
        id SERIAL PRIMARY KEY,
        server_url TEXT NOT NULL DEFAULT '',
        username TEXT NOT NULL DEFAULT '',
        password TEXT NOT NULL DEFAULT '',
        api_token TEXT DEFAULT '',
        last_sync TIMESTAMP,
        sync_interval INTEGER DEFAULT 30,
        enabled BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS zabbix_subnets (
        id SERIAL PRIMARY KEY,
        cidr_range TEXT NOT NULL,
        description TEXT,
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS discovered_hosts (
        id SERIAL PRIMARY KEY,
        hostname TEXT,
        ip_address TEXT NOT NULL,
        mac_address TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        source TEXT NOT NULL DEFAULT 'zabbix',
        system_info JSON DEFAULT '{}',
        hardware_details JSON DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS vm_monitoring (
        id SERIAL PRIMARY KEY,
        vm_id INTEGER NOT NULL,
        hostname TEXT,
        ip_address TEXT,
        status TEXT,
        cpu_usage REAL,
        memory_usage REAL,
        disk_usage REAL,
        uptime INTEGER,
        network_status TEXT,
        os_name TEXT,
        cpu_cores INTEGER,
        total_memory BIGINT,
        total_disk BIGINT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    console.log("✅ Zabbix and network discovery tables created/verified");

    // Create JIRA settings table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS jira_settings (
        id SERIAL PRIMARY KEY,
        settings TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ JIRA settings table created/verified");

    // Insert default admin user if it doesn't exist
    const adminCheck = await db.execute(sql`
      SELECT COUNT(*) as count FROM users WHERE username = 'admin'
    `);

    if (adminCheck.rows[0].count === 0) {
      const { scrypt, randomBytes } = await import('crypto');
      const { promisify } = await import('util');
      const scryptAsync = promisify(scrypt);

      const salt = randomBytes(16).toString("hex");
      const buf = (await scryptAsync('admin123', salt, 64)) as Buffer;
      const hashedPassword = `${buf.toString("hex")}.${salt}`;

      await db.execute(sql`
        INSERT INTO users (username, password, first_name, last_name, email, is_admin)
        VALUES ('admin', ${hashedPassword}, 'System', 'Administrator', 'admin@example.com', true)
      `);
      console.log("✅ Default admin user created");
    }

    // Insert default system settings if not exists
    const settingsCheck = await db.execute(sql`
      SELECT COUNT(*) as count FROM system_settings
    `);

    if (settingsCheck.rows[0].count === 0) {
      await db.execute(sql`
        INSERT INTO system_settings (site_name, company_name)
        VALUES ('SRPH-MIS', 'SRPH')
      `);
      console.log("✅ Default system settings created");
    }

    // Check final table counts
    const tableQueries = [
      { name: 'users', query: 'SELECT COUNT(*) as count FROM users' },
      { name: 'assets', query: 'SELECT COUNT(*) as count FROM assets' },
      { name: 'components', query: 'SELECT COUNT(*) as count FROM components' },
      { name: 'accessories', query: 'SELECT COUNT(*) as count FROM accessories' },
      { name: 'consumables', query: 'SELECT COUNT(*) as count FROM consumables' },
      { name: 'licenses', query: 'SELECT COUNT(*) as count FROM licenses' },
      { name: 'activities', query: 'SELECT COUNT(*) as count FROM activities' },
      { name: 'vm_inventory', query: 'SELECT COUNT(*) as count FROM vm_inventory' },
      { name: 'monitor_inventory', query: 'SELECT COUNT(*) as count FROM monitor_inventory' },
      { name: 'bitlocker_keys', query: 'SELECT COUNT(*) as count FROM bitlocker_keys' },
      { name: 'it_equipment', query: 'SELECT COUNT(*) as count FROM it_equipment' }
    ];

    // Create IAM Accounts table with proper column verification
    if (!(await tableExists('iam_accounts'))) {
      await db.execute(sql`
        CREATE TABLE iam_accounts (
          id SERIAL PRIMARY KEY,
          requestor TEXT,
          knox_id TEXT,
          permission TEXT,
          duration_start_date TEXT,
          duration_end_date TEXT,
          cloud_platform TEXT,
          project_accounts TEXT,
          approval_id TEXT,
          remarks TEXT,
          status TEXT DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("✅ IAM Accounts table created");
    } else {
      console.log("✅ IAM Accounts table exists - verifying columns");

      // Verify all required columns exist
      const iamAccountColumns = [
        ['requestor', 'TEXT'],
        ['knox_id', 'TEXT'],
        ['permission', 'TEXT'],
        ['duration_start_date', 'TEXT'],
        ['duration_end_date', 'TEXT'],
        ['cloud_platform', 'TEXT'],
        ['project_accounts', 'TEXT'],
        ['approval_id', 'TEXT'],
        ['remarks', 'TEXT'],
        ['status', 'TEXT DEFAULT \'active\''],
        ['created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
        ['updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP']
      ];

      for (const [columnName, definition] of iamAccountColumns) {
        if (!(await columnExists('iam_accounts', columnName))) {
          await addColumn('iam_accounts', columnName, definition);
        }
      }
    }

    // Create VM approval history table if it doesn't exist
    const vmApprovalHistoryTableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'vm_approval_history'
      );
    `);

    if (!vmApprovalHistoryTableExists.rows[0]?.exists) {
      await db.execute(sql`
        CREATE TABLE vm_approval_history (
          id SERIAL PRIMARY KEY,
          vm_id INTEGER NOT NULL REFERENCES vm_inventory(id) ON DELETE CASCADE,
          old_approval_number TEXT,
          new_approval_number TEXT,
          changed_by INTEGER REFERENCES users(id),
          changed_at TIMESTAMP DEFAULT NOW() NOT NULL,
          reason TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `);
      console.log("✅ VM approval history table created");
    } else {
      console.log("✅ VM approval history table exists");
    }

    // Create VM inventory table if it doesn't exist
    const vmInventoryTableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'vm_inventory'
      );
    `);

    if (!vmInventoryTableExists.rows[0]?.exists) {
      await db.execute(sql`
        CREATE TABLE vm_inventory (
          id SERIAL PRIMARY KEY,

          -- Core VM Information
          vm_id TEXT,
          vm_name TEXT NOT NULL,
          vm_status TEXT NOT NULL DEFAULT 'Active',
          vm_ip TEXT,
          vm_os TEXT,
          cpu_count INTEGER DEFAULT 0,
          memory_gb INTEGER DEFAULT 0,
          disk_capacity_gb INTEGER DEFAULT 0,

          -- Request and Approval Information
          requestor TEXT,
          knox_id TEXT,
          department TEXT,
          start_date TEXT,
          end_date TEXT,
          jira_number TEXT,
          approval_number TEXT,
          remarks TEXT,

          -- Legacy compatibility fields
          internet_access BOOLEAN DEFAULT FALSE,
          vm_os_version TEXT,
          hypervisor TEXT,
          host_name TEXT,
          host_model TEXT,
          host_ip TEXT,
          host_os TEXT,
          rack TEXT,
          deployed_by TEXT,
          "user" TEXT,
          jira_ticket TEXT,
          date_deleted TEXT,
          guest_os TEXT,
          power_state TEXT,
          memory_mb INTEGER,
          disk_gb INTEGER,
          ip_address TEXT,
          mac_address TEXT,
          vmware_tools TEXT,
          cluster TEXT,
          datastore TEXT,
          status TEXT DEFAULT 'available',
          assigned_to INTEGER,
          location TEXT,
          serial_number TEXT,
          model TEXT,
          manufacturer TEXT,
          purchase_date TEXT,
          purchase_cost TEXT,
          created_date TEXT DEFAULT CURRENT_TIMESTAMP,
          last_modified TEXT DEFAULT CURRENT_TIMESTAMP,
          notes TEXT
        )
      `);
      console.log("✅ VM inventory table created with all required columns");
    } else {
      console.log("✅ VM inventory table exists - verifying columns");
    }

    // Final comprehensive verification
    const allTables = [
      'users', 'assets', 'components', 'accessories', 'consumables', 'licenses',
      'license_assignments', 'consumable_assignments', 'activities', 'vm_inventory',
      'vms', 'monitor_inventory', 'bitlocker_keys', 'it_equipment', 'it_equipment_assignments',
      'system_settings', 'zabbix_settings', 'discovered_hosts', 'vm_monitoring',
      'monitoring_dashboards', 'monitoring_panels', 'monitoring_datasources', 
      'monitoring_alert_rules', 'monitoring_alerts', 'monitoring_notifications', 'iam_accounts', 'vm_approval_history'
    ];

    console.log("📊 Final comprehensive table verification:");
    let verifiedTables = 0;
    let totalRecords = 0;

    for (const tableName of allTables) {
      try {
        if (await tableExists(tableName)) {
          const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${tableName}`));
          const count = result.rows[0].count;
          console.log(`   ✅ ${tableName}: ${count} records`);
          verifiedTables++;
          totalRecords += parseInt(count);
        } else {
          console.log(`   ❌ ${tableName}: Table missing`);
        }
      } catch (error) {
        console.log(`   ⚠️ ${tableName}: Error checking - ${error.message}`);
      }
    }

    console.log(`\n🎉 Database verification completed successfully!`);
    console.log(`📊 Summary: ${verifiedTables}/${allTables.length} tables verified`);
    console.log(`📈 Total records across all tables: ${totalRecords}`);
    console.log(`🔄 All missing tables and columns have been created automatically`);

    // Log next steps
    if (verifiedTables < allTables.length) {
      console.log(`\n⚠️ Some tables may need manual attention. Check the logs above.`);
    }

  } catch (error) {
    console.error("❌ Migration failed:", error);
    console.error("📍 Error details:", {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    throw error;
  }
}