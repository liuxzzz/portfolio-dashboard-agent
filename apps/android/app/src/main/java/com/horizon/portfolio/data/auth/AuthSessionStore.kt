package com.horizon.portfolio.data.auth

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.time.Instant
import java.util.UUID
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class AuthUser(
    val id: String,
    val phone: String,
)

data class StoredAuthSession(
    val accessToken: String,
    val expiresAt: String,
    val user: AuthUser,
    val instanceId: String,
)

class AuthSessionStore(context: Context) {
    private val preferences = context.getSharedPreferences(
        "portfolio-auth-session",
        Context.MODE_PRIVATE,
    )
    private val mutableSession = MutableStateFlow(readStoredSession())
    val session: StateFlow<StoredAuthSession?> = mutableSession.asStateFlow()

    fun save(accessToken: String, expiresAt: String, user: AuthUser) {
        val session = StoredAuthSession(
            accessToken = accessToken,
            expiresAt = expiresAt,
            user = user,
            instanceId = UUID.randomUUID().toString(),
        )
        preferences.edit()
            .putString(KEY_TOKEN, encrypt(session.accessToken))
            .putString(KEY_EXPIRES_AT, session.expiresAt)
            .putString(KEY_USER_ID, session.user.id)
            .putString(KEY_USER_PHONE, session.user.phone)
            .putString(KEY_INSTANCE_ID, session.instanceId)
            .apply()
        mutableSession.value = session
    }

    fun clear() {
        preferences.edit().clear().apply()
        mutableSession.value = null
    }

    private fun readStoredSession(): StoredAuthSession? {
        val encryptedToken = preferences.getString(KEY_TOKEN, null) ?: return null
        val token = runCatching { decrypt(encryptedToken) }.getOrNull()
            ?: return clearInvalidSession()
        val expiresAt = preferences.getString(KEY_EXPIRES_AT, null) ?: return null
        val userId = preferences.getString(KEY_USER_ID, null) ?: return null
        val phone = preferences.getString(KEY_USER_PHONE, null) ?: return null
        val instanceId = preferences.getString(KEY_INSTANCE_ID, null) ?: return null
        val valid = runCatching { Instant.parse(expiresAt).isAfter(Instant.now()) }
            .getOrDefault(false)
        if (!valid) {
            return clearInvalidSession()
        }
        return StoredAuthSession(token, expiresAt, AuthUser(userId, phone), instanceId)
    }

    private fun encrypt(value: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, encryptionKey())
        val iv = Base64.encodeToString(cipher.iv, Base64.NO_WRAP)
        val ciphertext = Base64.encodeToString(
            cipher.doFinal(value.toByteArray(Charsets.UTF_8)),
            Base64.NO_WRAP,
        )
        return "$iv:$ciphertext"
    }

    private fun decrypt(value: String): String {
        val (encodedIv, encodedCiphertext) = value.split(':', limit = 2)
            .takeIf { it.size == 2 }
            ?: throw IllegalArgumentException("Invalid encrypted session")
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(
            Cipher.DECRYPT_MODE,
            encryptionKey(),
            GCMParameterSpec(128, Base64.decode(encodedIv, Base64.NO_WRAP)),
        )
        return cipher.doFinal(Base64.decode(encodedCiphertext, Base64.NO_WRAP))
            .toString(Charsets.UTF_8)
    }

    private fun encryptionKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keyStore.getKey(KEYSTORE_ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
            .apply {
                init(
                    KeyGenParameterSpec.Builder(
                        KEYSTORE_ALIAS,
                        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                    )
                        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                        .build(),
                )
            }
            .generateKey()
    }

    private fun clearInvalidSession(): StoredAuthSession? {
        preferences.edit().clear().apply()
        return null
    }

    private companion object {
        const val KEY_TOKEN = "access-token"
        const val KEY_EXPIRES_AT = "expires-at"
        const val KEY_USER_ID = "user-id"
        const val KEY_USER_PHONE = "user-phone"
        const val KEY_INSTANCE_ID = "instance-id"
        const val KEYSTORE_ALIAS = "portfolio-auth-token"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}
