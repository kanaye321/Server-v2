import {
  users, assets, components, accessories, licenses, activities, consumables, licenseAssignments, consumableAssignments,
  itEquipment, itEquipmentAssignments,
  type User, type InsertUser,
  type Asset, type InsertAsset,
  type Activity, type InsertActivity,
  type License, type InsertLicense,
  type Accessory, type InsertAccessory,
  type Component, type InsertComponent,
  type Consumable, type InsertConsumable,
  type LicenseAssignment, type InsertLicenseAssignment,
  type ITEquipment, type InsertITEquipment,
  AssetStatus, LicenseStatus, AccessoryStatus, ConsumableStatus,
  // IAM Accounts import
  iamAccounts, type IamAccount
} from "@shared/schema";
import { db } from "./db";
import type {
  InsertZabbixSettings, InsertZabbixSubnet, InsertDiscoveredHost, InsertVMMonitoring, InsertBitlockerKey
} from "@shared/schema";
import * as schema from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import type { IStorage } from "./storage";

interface AssetStats {
  total: number;
  checkedOut: number;
  available: number;
  pending: number;
  overdue: number;
  archived: number;
}

export async function initializeDatabase() {
  try {
    console.log("🔄 Initializing database tables...");

    // Test database connection first
    await db.execute(sql`SELECT 1 as test`);
    console.log("✅ Database connection established/verified");
    console.log("📊 Using database:", process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));

    // Import and run migrations
    const { runMigrations } = await import("./migrate");
    await runMigrations();

    return;

    console.log("🎉 Database initialization completed successfully!");
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, updateData: Partial<InsertUser>): Promise<User | undefined> {
    // Get the current user if we need to return without updates
    if (Object.keys(updateData).length === 0) {
      return await this.getUser(id);
    }

    const [updated] = await db.update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      // Get user info before deletion for audit trail
      const userToDelete = await this.getUser(id);
      if (!userToDelete) {
        console.log(`User ${id} not found`);
        return false;
      }

      console.log(`Deleting user ${userToDelete.username} (ID: ${id}) from PostgreSQL database...`);

      // First, update activities to preserve audit trail - set userId to null and add deletion note
      await db.execute(sql`
        UPDATE activities 
        SET user_id = NULL, 
            notes = COALESCE(notes, '') || ' [User deleted: ' || ${userToDelete.username} || ']'
        WHERE user_id = ${id}
      `);

      console.log(`Updated activities to preserve audit trail for deleted user`);

      // Update assets to remove user assignments
      await db.execute(sql`
        UPDATE assets 
        SET assigned_to = NULL,
            status = 'available',
            checkout_date = NULL,
            expected_checkin_date = NULL
        WHERE assigned_to = ${id}
      `);

      console.log(`Updated assets to remove user assignments`);

      // Then delete the user
      const deleteResult = await db.delete(users)
        .where(eq(users.id, id));

      console.log(`Delete result for user ${id}:`, deleteResult);

      if (deleteResult.rowCount && deleteResult.rowCount > 0) {
        console.log(`User ${userToDelete.username} deleted successfully from PostgreSQL database`);
        return true;
      }

      console.log(`No rows affected when deleting user ${id}`);
      return false;
    } catch (error) {
      console.error(`Error deleting user from PostgreSQL database:`, error);
      throw error;
    }
  }

  // Asset operations
  async getAssets(): Promise<Asset[]> {
    return await db.select().from(assets);
  }

  async getAsset(id: number): Promise<Asset | undefined> {
    const [asset] = await db.select().from(assets).where(eq(assets.id, id));
    return asset;
  }

  async getAssetByTag(assetTag: string): Promise<Asset | undefined> {
    const [asset] = await db.select().from(assets).where(eq(assets.assetTag, assetTag));
    return asset;
  }

  async createAsset(insertAsset: InsertAsset): Promise<Asset> {
    const [asset] = await db.insert(assets).values(insertAsset).returning();
    return asset;
  }

  async updateAsset(id: number, updateData: Partial<InsertAsset>): Promise<Asset | undefined> {
    const [updated] = await db.update(assets)
      .set(updateData)
      .where(eq(assets.id, id))
      .returning();
    return updated;
  }

  async deleteAsset(id: number): Promise<boolean> {
    try {
      console.log(`Deleting asset with ID: ${id} from PostgreSQL database...`);

      // Get asset info before deletion for logging
      const assetToDelete = await this.getAsset(id);
      if (!assetToDelete) {
        console.log(`Asset ${id} not found`);
        return false;
      }

      console.log(`Deleting asset: ${assetToDelete.name} (${assetToDelete.assetTag})`);

      // Delete the asset from PostgreSQL
      const deleteResult = await db.delete(assets)
        .where(eq(assets.id, id));

      console.log(`Delete result for asset ${id}:`, deleteResult);

      if (deleteResult.rowCount && deleteResult.rowCount > 0) {
        console.log(`Asset ${assetToDelete.name} deleted successfully from PostgreSQL database`);
        return true;
      }

      console.log(`No rows affected when deleting asset ${id}`);
      return false;
    } catch (error) {
      console.error(`Error deleting asset from PostgreSQL database:`, error);
      throw error;
    }
  }

  // Component operations
  async getComponents(): Promise<Component[]> {
    try {
      return await db.select().from(components);
    } catch (error) {
      console.error('Error fetching components:', error);
      return [];
    }
  }

  async getComponent(id: number): Promise<Component | undefined> {
    try {
      const [component] = await db.select().from(components).where(eq(components.id, id));
      return component;
    } catch (error) {
      console.error('Error fetching component:', error);
      return undefined;
    }
  }


  async createComponent(data: any) {
    try {
      // Ensure all required fields are present and properly typed
      const componentData = {
        name: data.name,
        type: data.type,
        category: data.category || 'General',
        serialNumber: data.serialNumber || null,
        manufacturer: data.manufacturer || null,
        model: data.model || null,
        specifications: data.specifications || null,
        status: data.status || 'available',
        location: data.location || null,
        assignedTo: data.assignedTo || null,
        purchaseDate: data.purchaseDate || null,
        purchaseCost: data.purchaseCost ? parseFloat(data.purchaseCost.toString()) : null,
        warrantyExpiry: data.warrantyExpiry || null,
        notes: data.notes || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const [component] = await db.insert(schema.components).values(componentData).returning();
      return component;
    } catch (error) {
      console.error('Error creating component in database:', error);
      // If database fails, still try to create in memory storage as fallback
      throw error;
    }
  }

  async updateComponent(id: number, updateData: Partial<InsertComponent>): Promise<Component | undefined> {
    try {
      const [component] = await db.select().from(components).where(eq(components.id, id));
      if (!component) return undefined;

      // Convert quantity from string to number if needed
      if (typeof updateData.quantity === 'string') {
        updateData.quantity = parseInt(updateData.quantity);
      }

      const [updated] = await db.update(components)
        .set(updateData)
        .where(eq(components.id, id))
        .returning();

      if (updated) {
        // Create activity record
        await this.createActivity({
          action: "update",
          itemType: "component",
          itemId: id,
          userId: null,
          timestamp: new Date().toISOString(),
          notes: `Component "${component.name}" updated`,
        });
      }

      return updated;
    } catch (error) {
      console.error('Error updating component:', error);
      throw error;
    }
  }

  async deleteComponent(id: number): Promise<boolean> {
    try {
      console.log(`Deleting component with ID: ${id} from PostgreSQL database...`);

      const [component] = await db.select().from(components).where(eq(components.id, id));
      if (!component) {
        console.log(`Component ${id} not found`);
        return false;
      }

      console.log(`Deleting component: ${component.name}`);

      const deleteResult = await db.delete(components)
        .where(eq(components.id, id));

      console.log(`Delete result for component ${id}:`, deleteResult);

      if (deleteResult.rowCount && deleteResult.rowCount > 0) {
        // Create activity record
        try {
          await this.createActivity({
            action: "delete",
            itemType: "component",
            itemId: id,
            userId: null,
            timestamp: new Date().toISOString(),
            notes: `Component "${component.name}" deleted`,
          });
        } catch (activityError) {
          console.warn("Failed to log component delete activity:", activityError);
        }

        console.log(`Component ${component.name} deleted successfully from PostgreSQL database`);
        return true;
      }

      console.log(`No rows affected when deleting component ${id}`);
      return false;
    } catch (error) {
      console.error('Error deleting component from PostgreSQL database:', error);
      return false;
    }
  }

  // Accessory operations
  async getAccessories(): Promise<Accessory[]> {
    return await db.select().from(accessories);
  }

  async getAccessory(id: number): Promise<Accessory | undefined> {
    const [accessory] = await db.select().from(accessories).where(eq(accessories.id, id));
    return accessory;
  }

  async createAccessory(insertAccessory: InsertAccessory): Promise<Accessory> {
    // Make sure quantity is a number
    const processedAccessory = {
      ...insertAccessory,
      quantity: typeof insertAccessory.quantity === 'string'
        ? parseInt(insertAccessory.quantity)
        : insertAccessory.quantity
    };

    const [accessory] = await db.insert(accessories).values(processedAccessory).returning();

    // Create activity record
    await this.createActivity({
      action: "create",
      itemType: "accessory",
      itemId: accessory.id,
      userId: null,
      timestamp: new Date().toISOString(),
      notes: `Accessory "${accessory.name}" created`,
    });

    return accessory;
  }

  async updateAccessory(id: number, updateData: Partial<InsertAccessory>): Promise<Accessory | undefined> {
    const [accessory] = await db.select().from(accessories).where(eq(accessories.id, id));
    if (!accessory) return undefined;

    // Convert quantity from string to number if needed
    if (typeof updateData.quantity === 'string') {
      updateData.quantity = parseInt(updateData.quantity);
    }

    const [updated] = await db.update(accessories)
      .set(updateData)
      .where(eq(accessories.id, id))
      .returning();

    if (updated) {
      // Create activity record
      await this.createActivity({
        action: "update",
        itemType: "accessory",
        itemId: id,
        userId: null,
        timestamp: new Date().toISOString(),
        notes: `Accessory "${accessory.name}" updated`,
      });
    }

    return updated;
  }

  async deleteAccessory(id: number): Promise<boolean> {
    const [accessory] = await db.select().from(accessories).where(eq(accessories.id, id));
    if (!accessory) return false;

    const [deleted] = await db.delete(accessories)
      .where(eq(accessories.id, id))
      .returning();

    if (deleted) {
      // Create activity record
      await this.createActivity({
        action: "delete",
        itemType: "accessory",
        itemId: id,
        userId: null,
        timestamp: new Date().toISOString(),
        notes: `Accessory "${accessory.name}" deleted`,
      });
    }

    return !!deleted;
  }

  // Consumable operations
  async getConsumables(): Promise<Consumable[]> {
    try {
      // Try database first
      const dbConsumables = await db.select().from(consumables);

      return dbConsumables;
    } catch (error) {
      console.error('Error fetching consumables from database:', error);
      return [];
    }
  }

  async getConsumable(id: number): Promise<Consumable | undefined> {
    try {
      const [consumable] = await db.select().from(consumables).where(eq(consumables.id, id));
      return consumable;
    } catch (error) {
      console.error('Error fetching consumable:', error);
      return undefined;
    }
  }

  async createConsumable(insertConsumable: InsertConsumable): Promise<Consumable> {
    try {
      // Make sure quantity is a number
      const processedConsumable = {
        ...insertConsumable,
        quantity: typeof insertConsumable.quantity === 'string'
          ? parseInt(insertConsumable.quantity)
          : insertConsumable.quantity || 1
      };

      const [consumable] = await db.insert(consumables).values(processedConsumable).returning();

      // Create activity record
      await this.createActivity({
        action: "create",
        itemType: "consumable",
        itemId: consumable.id,
        userId: null,
        timestamp: new Date().toISOString(),
        notes: `Consumable "${consumable.name}" created`,
      });

      return consumable;
    } catch (error) {
      console.error('Error creating consumable:', error);
      throw error;
    }
  }

  async updateConsumable(id: number, updateData: Partial<InsertConsumable>): Promise<Consumable | undefined> {
    const [consumable] = await db.select().from(consumables).where(eq(consumables.id, id));
    if (!consumable) return undefined;

    // Convert quantity from string to number if needed
    if (typeof updateData.quantity === 'string') {
      updateData.quantity = parseInt(updateData.quantity);
    }

    const [updated] = await db.update(consumables)
      .set(updateData)
      .where(eq(consumables.id, id))
      .returning();

    if (updated) {
      // Create activity record
      await this.createActivity({
        action: "update",
        itemType: "consumable",
        itemId: id,
        userId: null,
        timestamp: new Date().toISOString(),
        notes: `Consumable "${consumable.name}" updated`,
      });
    }

    return updated;
  }

  async deleteConsumable(id: number): Promise<boolean> {
    try {
      const consumable = await this.getConsumable(id);
      if (!consumable) return false;

      await db.delete(consumables).where(eq(consumables.id, id));

      // Create activity record
      await this.createActivity({
        action: "delete",
        itemType: "consumable",
        itemId: id,
        userId: null,
        timestamp: new Date().toISOString(),
        notes: `Consumable "${consumable.name}" deleted`,
      });

      return true;
    } catch (error) {
      console.error('Error deleting consumable:', error);
      return false;
    }
  }

  async getConsumableAssignments(consumableId: number): Promise<any[]> {
    try {
      // First try to test the database connection
      await db.execute(sql`SELECT 1`);

      // Check if table exists
      const tableExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_name = 'consumable_assignments'
        );
      `);

      if (!tableExists.rows?.[0]?.exists) {
        console.log('Consumable assignments table does not exist, returning empty array');
        return [];
      }

      const assignments = await db.select()
        .from(schema.consumableAssignments)
        .where(eq(schema.consumableAssignments.consumableId, consumableId))
        .orderBy(desc(schema.consumableAssignments.assignedDate));
      return assignments;
    } catch (error) {
      console.error('Error fetching consumable assignments:', error);
      // Return empty array if database connection fails
      return [];
    }
  }

  async assignConsumable(consumableId: number, assignmentData: any): Promise<any> {
    try {
      // First check if consumable exists using the memory fallback
      let consumable;
      try {
        consumable = await this.getConsumable(consumableId);
      } catch (dbError) {
        console.error('Database error while checking consumable:', dbError);
      }

      if (!consumable) {
        throw new Error('Consumable not found');
      }

      // Try database assignment first
      try {
        // Test database connection
        await db.execute(sql`SELECT 1`);

        // Ensure consumable_assignments table exists
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS consumable_assignments (
            id SERIAL PRIMARY KEY,
            consumable_id INTEGER NOT NULL,
            assigned_to TEXT NOT NULL,
            serial_number TEXT,
            knox_id TEXT,
            quantity INTEGER NOT NULL DEFAULT 1,
            assigned_date TEXT NOT NULL,
            returned_date TEXT,
            status TEXT NOT NULL DEFAULT 'assigned',
            notes TEXT,
            CONSTRAINT fk_consumable_assignment FOREIGN KEY (consumable_id) REFERENCES consumables(id) ON DELETE CASCADE
          );
        `);

        // Create assignment record
        const [assignment] = await db.insert(schema.consumableAssignments).values({
          consumableId,
          assignedTo: assignmentData.assignedTo,
          serialNumber: assignmentData.serialNumber || null,
          knoxId: assignmentData.knoxId || null,
          quantity: assignmentData.quantity || 1,
          assignedDate: new Date().toISOString(),
          status: 'assigned',
          notes: assignmentData.notes || null
        }).returning();

        // Create activity record
        try {
          await this.createActivity({
            action: "checkout",
            itemType: "consumable",
            itemId: consumableId,
            userId: null,
            timestamp: new Date().toISOString(),
            notes: `Consumable assigned to ${assignmentData.assignedTo}`,
          });
        } catch (activityError) {
          console.warn('Failed to create activity record:', activityError);
        }

        return assignment;
      } catch (dbError) {
        console.warn('Database assignment failed, using fallback mode:', dbError);

        // Fallback assignment mode
        const fallbackAssignment = {
          id: Date.now(),
          consumableId,
          assignedTo: assignmentData.assignedTo,
          serialNumber: assignmentData.serialNumber || null,
          knoxId: assignmentData.knoxId || null,
          quantity: assignmentData.quantity || 1,
          assignedDate: new Date().toISOString(),
          status: 'assigned',
          notes: assignmentData.notes || null
        };

        console.log('Assignment created in fallback mode:', fallbackAssignment);
        return fallbackAssignment;
      }
    } catch (error) {
      console.error('Error assigning consumable:', error);
      throw error;
    }
  }

  // License operations
  async getLicenses(): Promise<License[]> {
    return await db.select().from(licenses);
  }

  async getLicense(id: number): Promise<License | undefined> {
    const [license] = await db.select().from(licenses).where(eq(licenses.id, id));
    return license;
  }

  async createLicense(insertLicense: InsertLicense): Promise<License> {
    try {
      // Test database connection
      await db.execute(sql`SELECT 1`);

      const [license] = await db.insert(licenses).values(insertLicense).returning();

      // Create activity record
      await this.createActivity({
        action: "create",
        itemType: "license",
        itemId: license.id,
        userId: null,
        timestamp: new Date().toISOString(),
        notes: `License "${license.name}" created`,
      });

      console.log(`✅ License "${license.name}" created in PostgreSQL database`);
      return license;
    } catch (error) {
      console.error('❌ Database error creating license:', error);
      throw new Error('Failed to create license: Database connection required');
    }
  }

  async updateLicense(id: number, updateData: Partial<InsertLicense>): Promise<License | undefined> {
    const [license] = await db.select().from(licenses).where(eq(licenses.id, id));
    if (!license) return undefined;

    const [updated] = await db.update(licenses)
      .set(updateData)
      .where(eq(licenses.id, id))
      .returning();

    if (updated) {
      // Create activity record
      await this.createActivity({
        action: "update",
        itemType: "license",
        itemId: id,
        userId: null,
        timestamp: new Date().toISOString(),
        notes: `License "${license.name}" updated`,
      });
    }

    return updated;
  }

  async deleteLicense(id: number): Promise<boolean> {
    const [license] = await db.select().from(licenses).where(eq(licenses.id, id));
    if (!license) return false;

    try {
      // First delete all license assignments related to this license
      await db.delete(licenseAssignments)
        .where(eq(licenseAssignments.licenseId, id));

      // Then delete the license
      const [deleted] = await db.delete(licenses)
        .where(eq(licenses.id, id))
        .returning();

      if (deleted) {
        // Create activity record
        await this.createActivity({
          action: "delete",
          itemType: "license",
          itemId: id,
          userId: null,
          timestamp: new Date().toISOString(),
          notes: `License "${license.name}" deleted`,
        });
      }

      return !!deleted;
    } catch (error) {
      console.error("Error deleting license:", error);
      throw error;
    }
  }

  // License assignment operations
  async getLicenseAssignments(licenseId: number): Promise<LicenseAssignment[]> {
    return await db.select()
      .from(licenseAssignments)
      .where(eq(licenseAssignments.licenseId, licenseId))
      .orderBy(licenseAssignments.assignedDate);
  }

  async createLicenseAssignment(insertAssignment: InsertLicenseAssignment): Promise<LicenseAssignment> {
    const [assignment] = await db
      .insert(licenseAssignments)
      .values(insertAssignment)
      .returning();

    // Create activity record
    await this.createActivity({
      action: "update",
      itemType: "license",
      itemId: insertAssignment.licenseId,
      userId: null,
      timestamp: new Date().toISOString(),
      notes: `License seat assigned to: ${insertAssignment.assignedTo}`,
    });

    return assignment;
  }

  // Checkout/checkin operations
  async checkoutAsset(assetId: number, userId: number, expectedCheckinDate?: string, customNotes?: string): Promise<Asset | undefined> {
    const [asset] = await db.select().from(assets).where(eq(assets.id, assetId));
    const [user] = await db.select().from(users).where(eq(users.id, userId));

    if (!asset || !user) return undefined;
    if (asset.status !== AssetStatus.AVAILABLE) return undefined;

    const today = new Date().toISOString().split("T")[0];

    const [updatedAsset] = await db.update(assets)
      .set({
        status: AssetStatus.DEPLOYED,
        assignedTo: userId,
        checkoutDate: today,
        expectedCheckinDate: expectedCheckinDate || null,
      })
      .where(eq(assets.id, assetId))
      .returning();

    if (updatedAsset) {
      // Create activity record
      await this.createActivity({
        action: "checkout",
        itemType: "asset",
        itemId: assetId,
        userId,
        timestamp: new Date().toISOString(),
        notes: customNotes || `Asset ${asset.name} (${asset.assetTag}) checked out to ${user.firstName} ${user.lastName}`,
      });
    }

    return updatedAsset;
  }

  async checkinAsset(assetId: number): Promise<Asset | undefined> {
    const [asset] = await db.select().from(assets).where(eq(assets.id, assetId));

    if (!asset) return undefined;
    if (asset.status !== AssetStatus.DEPLOYED && asset.status !== AssetStatus.OVERDUE) return undefined;

    const [updatedAsset] = await db.update(assets)
      .set({
        status: AssetStatus.AVAILABLE,
        assignedTo: null,
        checkoutDate: null,
        expectedCheckinDate: null,
        knoxId: null, // Clear the Knox ID when checking in
      })
      .where(eq(assets.id, assetId))
      .returning();

    if (updatedAsset) {
      // Create activity record
      await this.createActivity({
        action: "checkin",
        itemType: "asset",
        itemId: assetId,
        userId: asset.assignedTo,
        timestamp: new Date().toISOString(),
        notes: `Asset ${asset.name} (${asset.assetTag}) checked in`,
      });
    }

    return updatedAsset;
  }

  // Activity operations
  async getActivities(): Promise<Activity[]> {
    // Order by timestamp descending for newest first
    return await db.select()
      .from(activities)
      .orderBy(activities.timestamp);
  }

  async getActivitiesByUser(userId: number): Promise<Activity[]> {
    return await db.select()
      .from(activities)
      .where(eq(activities.userId, userId))
      .orderBy(activities.timestamp);
  }

  async getActivitiesByAsset(assetId: number): Promise<Activity[]> {
    return await db.select()
      .from(activities)
      .where(eq(activities.itemId, assetId))
      .orderBy(activities.timestamp);
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const [activity] = await db.insert(activities).values(insertActivity).returning();
    return activity;
  }

  // Stats and summaries
  async getAssetStats(): Promise<AssetStats> {
    const allAssets = await db.select().from(assets);

    return {
      total: allAssets.length,
      checkedOut: allAssets.filter(asset => asset.status === AssetStatus.DEPLOYED).length,
      available: allAssets.filter(asset => asset.status === AssetStatus.AVAILABLE).length,
      pending: allAssets.filter(asset => asset.status === AssetStatus.PENDING).length,
      overdue: allAssets.filter(asset => asset.status === AssetStatus.OVERDUE).length,
      archived: allAssets.filter(asset => asset.status === AssetStatus.ARCHIVED).length,
    };
  }

  // Zabbix settings operations (stub implementations for now)
  async getZabbixSettings(): Promise<any> {
    return undefined;
  }

  async saveZabbixSettings(settings: any): Promise<any> {
    return settings;
  }

  // Zabbix subnet operations (stub implementations)
  async getZabbixSubnets(): Promise<any[]> {
    return [];
  }

  async getZabbixSubnet(id: number): Promise<any> {
    return undefined;
  }

  async createZabbixSubnet(subnet: any): Promise<any> {
    return subnet;
  }

  async deleteZabbixSubnet(id: number): Promise<boolean> {
    return true;
  }

  // VM monitoring operations (stub implementations)
  async getVMMonitoring(): Promise<any[]> {
    return [];
  }

  async getVMMonitoringByVMId(vmId: number): Promise<any> {
    return undefined;
  }

  async createVMMonitoring(monitoring: any): Promise<any> {
    return monitoring;
  }

  async updateVMMonitoring(id: number, monitoring: any): Promise<any> {
    return monitoring;
  }

  // Discovered hosts operations (stub implementations)
  async getDiscoveredHosts(): Promise<any[]> {
    return [];
  }

  async getDiscoveredHost(id: number): Promise<any> {
    return undefined;
  }

  async createDiscoveredHost(host: any): Promise<any> {
    return host;
  }

  async updateDiscoveredHost(id: number, host: any): Promise<any> {
    return host;
  }

  async deleteDiscoveredHost(id: number): Promise<boolean> {
    return true;
  }

  // BitLocker keys operations
  async getBitlockerKeys(): Promise<any[]> {
    try {
      await db.execute(sql`SELECT 1`);
      return await db.select().from(schema.bitlockerKeys);
    } catch (error) {
      console.error('❌ Database error fetching BitLocker keys:', error);
      return [];
    }
  }

  async getBitlockerKey(id: number): Promise<any> {
    try {
      const [key] = await db.select().from(schema.bitlockerKeys).where(eq(schema.bitlockerKeys.id, id));
      return key;
    } catch (error) {
      console.error('❌ Database error fetching BitLocker key:', error);
      return undefined;
    }
  }

  async getBitlockerKeyBySerialNumber(serialNumber: string): Promise<any[]> {
    try {
      return await db.select().from(schema.bitlockerKeys).where(eq(schema.bitlockerKeys.serialNumber, serialNumber));
    } catch (error) {
      console.error('❌ Database error fetching BitLocker keys by serial:', error);
      return [];
    }
  }

  async getBitlockerKeyByIdentifier(identifier: string): Promise<any[]> {
    try {
      return await db.select().from(schema.bitlockerKeys).where(eq(schema.bitlockerKeys.identifier, identifier));
    } catch (error) {
      console.error('❌ Database error fetching BitLocker keys by identifier:', error);
      return [];
    }
  }

  async createBitlockerKey(key: any): Promise<any> {
    try {
      // Test database connection
      await db.execute(sql`SELECT 1`);

      const [newKey] = await db.insert(schema.bitlockerKeys).values({
        ...key,
        dateAdded: new Date(),
        updatedAt: new Date()
      }).returning();

      console.log(`✅ BitLocker key created in PostgreSQL database`);

      try {
        await this.createActivity({
          action: "create",
          itemType: "bitlocker-key",
          itemId: newKey.id,
          userId: null,
          timestamp: new Date().toISOString(),
          notes: `BitLocker key for ${newKey.serialNumber} created`,
        });
      } catch (activityError) {
        console.warn('Failed to create activity log:', activityError);
      }

      return newKey;
    } catch (error) {
      console.error('❌ Database error creating BitLocker key:', error);

      // Re-throw with more specific error message but don't require database
      throw error;
    }
  }

  async updateBitlockerKey(id: number, key: any): Promise<any> {
    try {
      const [updated] = await db.update(schema.bitlockerKeys)
        .set({ ...key, updatedAt: new Date() })
        .where(eq(schema.bitlockerKeys.id, id))
        .returning();

      if (updated) {
        console.log(`✅ BitLocker key updated in PostgreSQL database`);

        await this.createActivity({
          action: "update",
          itemType: "bitlocker-key",
          itemId: id,
          userId: null,
          timestamp: new Date().toISOString(),
          notes: `BitLocker key for ${updated.serialNumber} updated`,
        });
      }

      return updated;
    } catch (error) {
      console.error('❌ Database error updating BitLocker key:', error);
      throw new Error('Failed to update BitLocker key: Database connection required');
    }
  }

  async deleteBitlockerKey(id: number): Promise<boolean> {
    try {
      const [key] = await db.select().from(schema.bitlockerKeys).where(eq(schema.bitlockerKeys.id, id));
      if (!key) return false;

      await db.delete(schema.bitlockerKeys).where(eq(schema.bitlockerKeys.id, id));

      console.log(`✅ BitLocker key deleted from PostgreSQL database`);

      await this.createActivity({
        action: "delete",
        itemType: "bitlocker-key",
        itemId: id,
        userId: null,
        timestamp: new Date().toISOString(),
        notes: `BitLocker key for ${key.serialNumber} deleted`,
      });

      return true;
    } catch (error) {
      console.error('❌ Database error deleting BitLocker key:', error);
      return false;
    }
  }

  // VM Inventory operations - using PostgreSQL tables
  async getVmInventory(): Promise<any[]> {
    try {
      return await db.select().from(schema.vmInventory);
    } catch (error) {
      console.error('Error fetching VM inventory:', error);
      return [];
    }
  }

  async getVmInventoryItem(id: number): Promise<any> {
    try {
      const [vm] = await db.select().from(schema.vmInventory).where(eq(schema.vmInventory.id, id));
      return vm;
    } catch (error) {
      console.error('Error fetching VM inventory item:', error);
      return undefined;
    }
  }

  // Add method to get VMs (alias for VM inventory)
  async getVMs(): Promise<any[]> {
    return this.getVmInventory();
  }

  async getVM(id: number): Promise<any> {
    return this.getVmInventoryItem(id);
  }

  async createVM(vmData: any): Promise<any> {
    return this.createVmInventoryItem(vmData);
  }

  async updateVM(id: number, vmData: any): Promise<any> {
    return this.updateVmInventoryItem(id, vmData);
  }

  async deleteVM(id: number): Promise<boolean> {
    return this.deleteVmInventoryItem(id);
  }

  async createVmInventoryItem(vm: any): Promise<any> {
    try {
      const [newVM] = await db.insert(schema.vmInventory).values({
        startDate: vm.startDate,
        endDate: vm.endDate,
        hypervisor: vm.hypervisor,
        hostName: vm.hostName,
        hostModel: vm.hostModel,
        hostIp: vm.hostIp,
        hostOs: vm.hostOs,
        rack: vm.rack,
        vmId: vm.vmId,
        vmName: vm.vmName,
        vmStatus: vm.vmStatus || vm.powerState || 'stopped',
        vmIp: vm.vmIp,
        internetAccess: vm.internetAccess || false,
        vmOs: vm.vmOs,
        vmOsVersion: vm.vmOsVersion,
        deployedBy: vm.deployedBy,
        user: vm.user,
        department: vm.department,
        jiraTicket: vm.jiraTicket,
        remarks: vm.remarks,
        dateDeleted: vm.dateDeleted,
        // Legacy fields for compatibility
        guestOs: vm.guestOs || vm.vmOs,
        powerState: vm.powerState || vm.vmStatus || 'stopped',
        cpuCount: vm.cpuCount,
        memoryMB: vm.memoryMB,
        diskGB: vm.diskGB,
        ipAddress: vm.ipAddress || vm.vmIp,
        macAddress: vm.macAddress,
        vmwareTools: vm.vmwareTools,
        cluster: vm.cluster,
        datastore: vm.datastore,
        status: vm.status || 'available',
        assignedTo: vm.assignedTo,
        location: vm.location,
        serialNumber: vm.serialNumber,
        model: vm.model,
        manufacturer: vm.manufacturer,
        purchaseDate: vm.purchaseDate,
        purchaseCost: vm.purchaseCost,
        createdDate: vm.createdDate || new Date().toISOString(),
        lastModified: vm.lastModified || new Date().toISOString(),
        notes: vm.notes
      }).returning();

      // Create activity record
      await this.createActivity({
        action: "create",
        itemType: "vm",
        itemId: newVM.id,
        userId: null,
        timestamp: new Date().toISOString(),
        notes: `VM "${newVM.vmName}" created`,
      });

      return newVM;
    } catch (error) {
      console.error('Error creating VM inventory item:', error);
      throw error;
    }
  }

  async updateVmInventoryItem(id: number, vm: any): Promise<any> {
    try {
      const [existingVM] = await db.select().from(schema.vmInventory).where(eq(schema.vmInventory.id, id));
      if (!existingVM) return undefined;

      const updateData: any = {
        lastModified: new Date().toISOString()
      };

      // Map new VM inventory fields
      if (vm.startDate !== undefined) updateData.startDate = vm.startDate;
      if (vm.endDate !== undefined) updateData.endDate = vm.endDate;
      if (vm.hypervisor) updateData.hypervisor = vm.hypervisor;
      if (vm.hostName) updateData.hostName = vm.hostName;
      if (vm.hostModel) updateData.hostModel = vm.hostModel;
      if (vm.hostIp) updateData.hostIp = vm.hostIp;
      if (vm.hostOs) updateData.hostOs = vm.hostOs;
      if (vm.rack) updateData.rack = vm.rack;
      if (vm.vmId) updateData.vmId = vm.vmId;
      if (vm.vmName) updateData.vmName = vm.vmName;
      if (vm.vmStatus) updateData.vmStatus = vm.vmStatus;
      if (vm.vmIp) updateData.vmIp = vm.vmIp;
      if (vm.internetAccess !== undefined) updateData.internetAccess = vm.internetAccess;
      if (vm.vmOs) updateData.vmOs = vm.vmOs;
      if (vm.vmOsVersion) updateData.vmOsVersion = vm.vmOsVersion;
      if (vm.deployedBy) updateData.deployedBy = vm.deployedBy;
      if (vm.user) updateData.user = vm.user;
      if (vm.department) updateData.department = vm.department;
      if (vm.jiraTicket) updateData.jiraTicket = vm.jiraTicket;
      if (vm.remarks) updateData.remarks = vm.remarks;
      if (vm.dateDeleted) updateData.dateDeleted = vm.dateDeleted;

      // Legacy fields for compatibility
      if (vm.guestOs) updateData.guestOs = vm.guestOs;
      if (vm.powerState) updateData.powerState = vm.powerState;
      if (vm.cpuCount) updateData.cpuCount = vm.cpuCount;
      if (vm.memoryMB) updateData.memoryMB = vm.memoryMB;
      if (vm.diskGB) updateData.diskGB = vm.diskGB;
      if (vm.ipAddress) updateData.ipAddress = vm.ipAddress;
      if (vm.macAddress) updateData.macAddress = vm.macAddress;
      if (vm.vmwareTools) updateData.vmwareTools = vm.vmwareTools;
      if (vm.cluster) updateData.cluster = vm.cluster;
      if (vm.datastore) updateData.datastore = vm.datastore;
      if (vm.status) updateData.status = vm.status;
      if (vm.assignedTo) updateData.assignedTo = vm.assignedTo;
      if (vm.location) updateData.location = vm.location;
      if (vm.serialNumber) updateData.serialNumber = vm.serialNumber;
      if (vm.model) updateData.model = vm.model;
      if (vm.manufacturer) updateData.manufacturer = vm.manufacturer;
      if (vm.purchaseDate) updateData.purchaseDate = vm.purchaseDate;
      if (vm.purchaseCost) updateData.purchaseCost = vm.purchaseCost;
      if (vm.notes) updateData.notes = vm.notes;

      const [updatedVM] = await db.update(schema.vmInventory)
        .set(updateData)
        .where(eq(schema.vmInventory.id, id))
        .returning();

      // Create activity record
      await this.createActivity({
        action: "update",
        itemType: "vm",
        itemId: id,
        userId: null,
        timestamp: new Date().toISOString(),
        notes: `VM "${updatedVM.vmName}" updated`,
      });

      return updatedVM;
    } catch (error) {
      console.error('Error updating VM inventory item:', error);
      throw error;
    }
  }

  async deleteVmInventoryItem(id: number): Promise<boolean> {
    try {
      console.log(`Deleting VM with ID: ${id} from PostgreSQL database...`);

      // Get VM info before deletion
      const [vmToDelete] = await db.select().from(schema.vmInventory).where(eq(schema.vmInventory.id, id));
      if (!vmToDelete) {
        console.log(`VM ${id} not found`);
        return false;
      }

      console.log(`Deleting VM: ${vmToDelete.vmName}`);

      const deleteResult = await db.delete(schema.vmInventory).where(eq(schema.vmInventory.id, id));

      console.log(`Delete result for VM ${id}:`, deleteResult);

      if (deleteResult.rowCount && deleteResult.rowCount > 0) {
        // Create activity record
        try {
          await this.createActivity({
            action: "delete",
            itemType: "vm",
            itemId: id,
            userId: null,
            timestamp: new Date().toISOString(),
            notes: `VM "${vmToDelete.vmName}" deleted`,
          });
        } catch (activityError) {
          console.warn("Failed to log VM delete activity:", activityError);
        }

        console.log(`VM ${vmToDelete.vmName} deleted successfully from PostgreSQL database`);
        return true;
      }

      console.log(`No rows affected when deleting VM ${id}`);
      return false;
    } catch (error) {
      console.error('Error deleting VM from PostgreSQL database:', error);
      return false;
    }
  }

  // IT Equipment operations
  async getITEquipment(): Promise<ITEquipment[]> {
    try {
      return await db.select().from(itEquipment);
    } catch (error) {
      console.error('Database error fetching IT equipment:', error);
      return [];
    }
  }

  async getITEquipmentById(id: number): Promise<ITEquipment | null> {
    const [equipment] = await db.select().from(itEquipment).where(eq(itEquipment.id, id));
    return equipment || null;
  }

  async createITEquipment(data: InsertITEquipment): Promise<ITEquipment> {
    try {
      const [equipment] = await db.insert(itEquipment).values({
        ...data,
        assignedQuantity: 0,
        status: data.status || 'available',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }).returning();

      // Create activity record
      await this.createActivity({
        action: "create",
        itemType: "it-equipment",
        itemId: equipment.id,
        userId: null,
        timestamp: new Date().toISOString(),
        notes: `IT Equipment "${equipment.name}" created`,
      });

      return equipment;
    } catch (error) {
      console.error('Database error creating IT equipment:', error);
      throw error;
    }
  }

  async updateITEquipment(id: number, data: Partial<InsertITEquipment>): Promise<ITEquipment | null> {
    try {
      const [equipment] = await db.update(itEquipment)
        .set({
          ...data,
          updatedAt: new Date().toISOString()
        })
        .where(eq(itEquipment.id, id))
        .returning();

      if (equipment) {
        // Create activity record
        await this.createActivity({
          action: "update",
          itemType: "it-equipment",
          itemId: id,
          userId: null,
          timestamp: new Date().toISOString(),
          notes: `IT Equipment "${equipment.name}" updated`,
        });
      }

      return equipment || null;
    } catch (error) {
      console.error('Database error updating IT equipment:', error);
      throw error;
    }
  }

  async deleteITEquipment(id: number): Promise<boolean> {
    try {
      const [equipment] = await db.select().from(itEquipment).where(eq(itEquipment.id, id));
      if (!equipment) return false;

      // Delete related assignments first
      await db.delete(itEquipmentAssignments).where(eq(itEquipmentAssignments.equipmentId, id));

      // Delete the equipment
      const result = await db.delete(itEquipment).where(eq(itEquipment.id, id));

      if (result.rowCount && result.rowCount > 0) {
        // Create activity record
        await this.createActivity({
          action: "delete",
          itemType: "it-equipment",
          itemId: id,
          userId: null,
          timestamp: new Date().toISOString(),
          notes: `IT Equipment "${equipment.name}" deleted`,
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Database error deleting IT equipment:', error);
      return false;
    }
  }

  // IT Equipment Assignment methods
  async getITEquipmentAssignments(equipmentId: number): Promise<any[]> {
    try {
      return await db.select()
        .from(itEquipmentAssignments)
        .where(eq(itEquipmentAssignments.equipmentId, equipmentId))
        .orderBy(desc(itEquipmentAssignments.assignedDate));
    } catch (error) {
      console.error('Database error fetching IT equipment assignments:', error);
      return [];
    }
  }

  async assignITEquipment(equipmentId: number, assignmentData: any): Promise<any> {
    try {
      // Create assignment
      const [assignment] = await db.insert(itEquipmentAssignments).values({
        equipmentId,
        assignedTo: assignmentData.assignedTo,
        serialNumber: assignmentData.serialNumber || null,
        knoxId: assignmentData.knoxId || null,
        quantity: assignmentData.quantity || 1,
        assignedDate: new Date().toISOString(),
        status: 'assigned',
        notes: assignmentData.notes || null
      }).returning();

      // Update equipment assigned quantity
      await db.update(itEquipment)
        .set({
          assignedQuantity: sql`${itEquipment.assignedQuantity} + ${assignmentData.quantity || 1}`,
          updatedAt: new Date().toISOString()
        })
        .where(eq(itEquipment.id, equipmentId));

      // Create activity record
      await this.createActivity({
        action: "checkout",
        itemType: "it-equipment",
        itemId: equipmentId,
        userId: null,
        timestamp: new Date().toISOString(),
        notes: `IT Equipment assigned to ${assignmentData.assignedTo} (Qty: ${assignmentData.quantity || 1})`,
      });

      return assignment;
    } catch (error) {
      console.error('Database error assigning IT equipment:', error);
      throw error;
    }
  }

  async bulkAssignITEquipment(equipmentId: number, assignments: any[]): Promise<any[]> {
    try {
      const createdAssignments = [];

      for (const assignmentData of assignments) {
        const assignment = await this.assignITEquipment(equipmentId, assignmentData);
        createdAssignments.push(assignment);
      }

      return createdAssignments;
    } catch (error) {
      console.error('Database error in bulk assignment:', error);
      throw error;
    }
  }

  async updateSettings(settings: any): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO system_settings (id, site_name, company_name, created_at, updated_at) 
        VALUES (1, ${settings.siteName || 'SRPH-MIS'}, ${settings.companyName || 'SRPH'}, datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET 
          site_name = excluded.site_name,
          company_name = excluded.company_name,
          updated_at = datetime('now')
      `);
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  }

  async getJiraSettings(): Promise<any> {
    try {
      // Test database connection
      await db.execute(sql`SELECT 1`);

      // Create table if it doesn't exist
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS jira_settings (
          id SERIAL PRIMARY KEY,
          settings TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const result = await db.execute(sql`SELECT settings FROM jira_settings WHERE id = 1`);

      if (result.rows && result.rows.length > 0) {
        try {
          const settings = JSON.parse(result.rows[0].settings as string);
          console.log('JIRA settings retrieved from database');
          return settings;
        } catch (parseError) {
          console.error('Error parsing JIRA settings JSON:', parseError);
          return null;
        }
      }

      console.log('No JIRA settings found in database');
      return null;
    } catch (error) {
      console.error('Error fetching JIRA settings:', error);
      throw new Error(`Failed to fetch JIRA settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async saveJiraSettings(settings: any): Promise<any> {
    try {
      // Test database connection
      await db.execute(sql`SELECT 1`);

      // Create jira_settings table if it doesn't exist (PostgreSQL syntax)
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS jira_settings (
          id SERIAL PRIMARY KEY,
          settings TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const settingsJson = JSON.stringify(settings);

      // Use PostgreSQL upsert syntax (INSERT ... ON CONFLICT)
      await db.execute(sql`
        INSERT INTO jira_settings (id, settings, updated_at) 
        VALUES (1, ${settingsJson}, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET 
          settings = EXCLUDED.settings,
          updated_at = CURRENT_TIMESTAMP
      `);

      console.log('JIRA settings saved successfully to database');

      // Return the saved settings
      return settings;
    } catch (error) {
      console.error('Error saving JIRA settings:', error);
      throw new Error(`Failed to save JIRA settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createIssue(issue: any): Promise<any> {
    // For now, store as activity - in real implementation, create issues table
    const activity = {
      id: Date.now(),
      type: 'issue_reported',
      description: `Issue reported: ${issue.title}`,
      userId: 1,
      assetId: null,
      metadata: JSON.stringify(issue),
      timestamp: new Date()
    };

    // Assuming 'this.db' is correctly initialized and available.
    // If 'db' is imported directly at the top level, use 'db' directly.
    // Adjust based on how 'db' is accessed within the class context.
    // For this example, assuming 'db' is accessible as 'this.db' or globally.
    if (this.db) {
      await this.db.insert(activities).values(activity);
    } else {
      // Fallback or throw error if db is not available
      console.error("Database connection not available for createIssue");
      throw new Error("Database connection required");
    }
    return issue;
  }

  async getIssues(): Promise<any[]> {
    // Retrieve from activities table for now
    if (this.db) {
      const result = await this.db.select().from(activities).where(eq(activities.type, 'issue_reported'));
      return result.map(activity => {
        try {
          return JSON.parse(activity.metadata || '{}');
        } catch {
          return {};
        }
      });
    } else {
      console.error("Database connection not available for getIssues");
      return [];
    }
  }

  // IAM Accounts methods
  async getIamAccounts(): Promise<IamAccount[]> {
    try {
      if (!db) {
        console.error('Database connection not available for IAM accounts');
        throw new Error('Database connection required for IAM accounts');
      }

      console.log('Fetching IAM accounts from database...');
      
      // Test database connection
      await db.execute(sql`SELECT 1`);
      
      const accounts = await db.select().from(iamAccounts).orderBy(desc(iamAccounts.id));
      
      console.log(`Database query returned ${accounts.length} IAM accounts`);

      // Map database fields to match the expected interface
      const mappedAccounts = accounts.map(account => {
        console.log('Processing account:', account);
        return {
          id: account.id,
          requestor: account.requestor,
          knoxId: account.knoxId,
          permission: account.permission,
          durationStartDate: account.durationStartDate,
          durationEndDate: account.durationEndDate,
          cloudPlatform: account.cloudPlatform,
          projectAccounts: account.projectAccounts,
          approvalId: account.approvalId,
          remarks: account.remarks,
          status: account.status,
          createdAt: account.createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: account.updatedAt?.toISOString() || new Date().toISOString()
        };
      });
      
      console.log(`Mapped ${mappedAccounts.length} IAM accounts successfully`);
      return mappedAccounts;
    } catch (error) {
      console.error('Error in getIamAccounts:', error);
      throw error;
    }
  }

  async getIamAccount(id: number): Promise<IamAccount | undefined> {
    const [account] = await db.select().from(iamAccounts).where(eq(iamAccounts.id, id));
    if (!account) return undefined;

    // Map database fields to match the expected interface
    return {
      id: account.id,
      requestor: account.requestor,
      knoxId: account.knoxId,
      permission: account.permission,
      durationStartDate: account.durationStartDate,
      durationEndDate: account.durationEndDate,
      cloudPlatform: account.cloudPlatform,
      projectAccounts: account.projectAccounts,
      approvalId: account.approvalId,
      remarks: account.remarks,
      status: account.status,
      createdAt: account.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: account.updatedAt?.toISOString() || new Date().toISOString()
    };
  }

  async createIamAccount(data: Partial<IamAccount>): Promise<IamAccount> {
    if (!db) {
      throw new Error('Database connection required for IAM accounts');
    }

    const newAccountData = {
      requestor: data.requestor!,
      knoxId: data.knoxId!,
      permission: data.permission!,
      durationStartDate: data.durationStartDate || null,
      durationEndDate: data.durationEndDate || null,
      cloudPlatform: data.cloudPlatform!,
      projectAccounts: data.projectAccounts || null,
      approvalId: data.approvalId || null,
      remarks: data.remarks || null,
      status: data.status || 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const [newAccount] = await db.insert(iamAccounts).values(newAccountData).returning();

    // Return properly mapped account data
    return {
      id: newAccount.id,
      requestor: newAccount.requestor,
      knoxId: newAccount.knoxId,
      permission: newAccount.permission,
      durationStartDate: newAccount.durationStartDate,
      durationEndDate: newAccount.durationEndDate,
      cloudPlatform: newAccount.cloudPlatform,
      projectAccounts: newAccount.projectAccounts,
      approvalId: newAccount.approvalId,
      remarks: newAccount.remarks,
      status: newAccount.status,
      createdAt: newAccount.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: newAccount.updatedAt?.toISOString() || new Date().toISOString()
    };
  }

  async updateIamAccount(id: number, data: Partial<IamAccount>): Promise<IamAccount | undefined> {
    if (!db) {
      throw new Error('Database connection required for IAM accounts');
    }

    const updateData: Partial<IamAccount> = {
      requestor: data.requestor,
      knoxId: data.knoxId,
      permission: data.permission,
      durationStartDate: data.durationStartDate || null,
      durationEndDate: data.durationEndDate || null,
      cloudPlatform: data.cloudPlatform,
      projectAccounts: data.projectAccounts || null,
      approvalId: data.approvalId || null,
      remarks: data.remarks || null,
      status: data.status,
      updatedAt: new Date()
    };

    const [updatedAccount] = await db
      .update(iamAccounts)
      .set(updateData)
      .where(eq(iamAccounts.id, id))
      .returning();

    if (!updatedAccount) return undefined;

    // Return properly mapped account data
    return {
      id: updatedAccount.id,
      requestor: updatedAccount.requestor,
      knoxId: updatedAccount.knoxId,
      permission: updatedAccount.permission,
      durationStartDate: updatedAccount.durationStartDate,
      durationEndDate: updatedAccount.durationEndDate,
      cloudPlatform: updatedAccount.cloudPlatform,
      projectAccounts: updatedAccount.projectAccounts,
      approvalId: updatedAccount.approvalId,
      remarks: updatedAccount.remarks,
      status: updatedAccount.status,
      createdAt: updatedAccount.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: updatedAccount.updatedAt?.toISOString() || new Date().toISOString()
    };
  }

  async deleteIamAccount(id: number): Promise<boolean> {
    if (!db) {
      throw new Error('Database connection required for IAM accounts');
    }
    const result = await db.delete(iamAccounts).where(eq(iamAccounts.id, id));
    return result.rowCount > 0;
  }

  async importIamAccounts(accounts: Partial<IamAccount>[]): Promise<{ success: number; failed: number; errors: string[] }> {
    if (!db) {
      throw new Error('Database connection required for IAM accounts');
    }
    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (const account of accounts) {
      try {
        await this.createIamAccount(account);
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Row ${results.success + results.failed}: ${error.message}`);
      }
    }

    return results;
  }
}

// Removed duplicate initializeDatabase function - using the one from the DatabaseStorage class above