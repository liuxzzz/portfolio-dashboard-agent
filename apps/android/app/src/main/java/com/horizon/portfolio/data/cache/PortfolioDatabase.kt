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

@Entity(tableName = "dashboard_cache")
data class DashboardCacheEntity(
    @PrimaryKey val id: Int = CACHE_ID,
    val payloadJson: String,
    val cachedAtEpochMillis: Long,
) {
    companion object {
        const val CACHE_ID = 1
    }
}

@Dao
interface DashboardCacheDao {
    @Query("SELECT * FROM dashboard_cache WHERE id = 1")
    suspend fun get(): DashboardCacheEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: DashboardCacheEntity)
}

@Database(
    entities = [DashboardCacheEntity::class],
    version = 1,
    exportSchema = false,
)
abstract class PortfolioDatabase : RoomDatabase() {
    abstract fun dashboardCacheDao(): DashboardCacheDao

    companion object {
        fun create(context: Context): PortfolioDatabase = Room.databaseBuilder(
            context.applicationContext,
            PortfolioDatabase::class.java,
            "portfolio-dashboard.db",
        ).build()
    }
}
