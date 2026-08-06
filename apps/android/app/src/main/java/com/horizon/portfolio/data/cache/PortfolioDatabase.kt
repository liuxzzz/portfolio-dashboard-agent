package com.horizon.portfolio.data.cache

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Entity(tableName = "dashboard_cache")
data class DashboardCacheEntity(
    @PrimaryKey val ownerUserId: String,
    val payloadJson: String,
    val cachedAtEpochMillis: Long,
)

@Dao
interface DashboardCacheDao {
    @Query("SELECT * FROM dashboard_cache WHERE ownerUserId = :ownerUserId")
    suspend fun get(ownerUserId: String): DashboardCacheEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: DashboardCacheEntity)

    @Query("DELETE FROM dashboard_cache")
    suspend fun clear()
}

@Database(
    entities = [DashboardCacheEntity::class],
    version = 2,
    exportSchema = false,
)
abstract class PortfolioDatabase : RoomDatabase() {
    abstract fun dashboardCacheDao(): DashboardCacheDao

    companion object {
        fun create(context: Context): PortfolioDatabase = Room.databaseBuilder(
            context.applicationContext,
            PortfolioDatabase::class.java,
            "portfolio-dashboard.db",
        ).addMigrations(MIGRATION_1_2).build()

        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // Version 1 had no user owner. Discard it instead of risking cross-user display.
                db.execSQL("DROP TABLE IF EXISTS dashboard_cache")
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS dashboard_cache (
                        ownerUserId TEXT NOT NULL PRIMARY KEY,
                        payloadJson TEXT NOT NULL,
                        cachedAtEpochMillis INTEGER NOT NULL
                    )
                    """.trimIndent(),
                )
            }
        }
    }
}
