package com.chamcong.auto

import android.accessibilityservice.AccessibilityService
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.widget.Toast
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class ChamCongAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "ChamCong"
        private const val COOLDOWN_MS = 5 * 60 * 1000L // 5 minutes
    }

    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val isSending = AtomicBoolean(false)
    private var lastTriggerTime = 0L

    override fun onServiceConnected() {
        super.onServiceConnected()

        val prefs = getSharedPreferences("chamcong_config", MODE_PRIVATE)
        val targetPackage = prefs.getString("humax_package", "") ?: ""
        val apiUrl = prefs.getString("api_url", "") ?: ""
        val telegramId = prefs.getString("telegram_id", "") ?: ""

        Log.i(TAG, "=== SERVICE CONNECTED ===")
        Log.i(TAG, "  targetPackage = '$targetPackage'")
        Log.i(TAG, "  apiUrl        = '$apiUrl'")
        Log.i(TAG, "  telegramId    = '$telegramId'")

        if (targetPackage.isNotBlank()) {
            serviceInfo = serviceInfo.apply {
                packageNames = arrayOf(targetPackage)
            }
            Log.i(TAG, "Package filter applied: $targetPackage")
        } else {
            Log.w(TAG, "WARNING: No package filter set — watching ALL packages!")
            Log.w(TAG, "Go to app settings and save the Humax package name first.")
        }

        mainHandler.post {
            Toast.makeText(this, "ChamCong Service: BẬT ✓", Toast.LENGTH_LONG).show()
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        // Only care about window state changes (app opened/popup appeared)
        val eventType = event.eventType
        val isRelevantType = eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ||
                             eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
        if (!isRelevantType) return

        val pkg = event.packageName?.toString() ?: return

        val prefs = getSharedPreferences("chamcong_config", MODE_PRIVATE)
        val targetPackage = prefs.getString("humax_package", "com.phanmemnhansu") ?: "com.phanmemnhansu"

        // Always log when we see the target package to confirm detection works
        if (pkg == targetPackage) {
            Log.d(TAG, "[DETECTED] Event from target package: $pkg, type=${AccessibilityEvent.eventTypeToString(eventType)}")
        } else {
            return // Not our target app, skip silently
        }

        val now = System.currentTimeMillis()
        val remainingCooldown = COOLDOWN_MS - (now - lastTriggerTime)
        if (remainingCooldown > 0) {
            Log.d(TAG, "Cooldown active, ${remainingCooldown / 1000}s remaining — skip")
            return
        }

        // Already sending check
        if (isSending.get()) {
            Log.d(TAG, "Already sending API request — skip duplicate event")
            return
        }

        lastTriggerTime = now

        // Capture the exact timestamp at the moment of detection.
        // Even if Render takes 50s to cold start, we send THIS time —
        // so the recorded attendance time is always accurate.
        val capturedTime = java.util.Date(now)

        Log.i(TAG, ">>> TRIGGER: Humax App detected — calling attendance API with client_time")

        // Toast MUST run on main thread
        mainHandler.post {
            Toast.makeText(this, "Auto Chấm Công: Đang gửi...", Toast.LENGTH_SHORT).show()
        }

        callAttendanceApi(capturedTime)
    }

    override fun onInterrupt() {
        Log.w(TAG, "Accessibility service interrupted")
    }

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }

    private fun callAttendanceApi(capturedTime: java.util.Date) {
        if (!isSending.compareAndSet(false, true)) {
            Log.d(TAG, "Already sending, skip duplicate")
            return
        }

        val prefs = getSharedPreferences("chamcong_config", MODE_PRIVATE)
        val apiUrl = prefs.getString("api_url", "") ?: ""
        val apiSecret = prefs.getString("api_secret", "") ?: ""
        val telegramId = prefs.getString("telegram_id", "") ?: ""

        Log.i(TAG, "--- callAttendanceApi ---")
        Log.i(TAG, "  apiUrl     = '$apiUrl'")
        Log.i(TAG, "  telegramId = '$telegramId'")
        Log.i(TAG, "  secret set = ${apiSecret.isNotBlank()}")

        if (apiUrl.isBlank() || telegramId.isBlank()) {
            Log.e(TAG, "ABORT: API URL or Telegram ID is blank — check app settings!")
            mainHandler.post {
                Toast.makeText(this, "Lỗi: Chưa cấu hình API URL hoặc Telegram ID!", Toast.LENGTH_LONG).show()
            }
            isSending.set(false)
            return
        }

        // Format as ISO-8601 UTC so the backend can parse it correctly
        val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val clientTimeIso = isoFormat.format(capturedTime)
        val endpoint = "${apiUrl.trimEnd('/')}/api/attendance"
        Log.i(TAG, "  endpoint   = '$endpoint'")
        Log.i(TAG, "  clientTime = '$clientTimeIso'")

        executor.execute {
            try {
                val url = URL(endpoint)
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("x-api-key", apiSecret)
                conn.connectTimeout = 60_000  // 60s to handle Render cold start
                conn.readTimeout = 60_000
                conn.doOutput = true

                // Send client_time so backend records accurate time even on cold start
                val body = """{"telegram_id":$telegramId,"client_time":"$clientTimeIso"}"""
                Log.i(TAG, "  body = $body")
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(body) }

                val code = conn.responseCode
                val response = if (code in 200..299) {
                    conn.inputStream.bufferedReader().readText()
                } else {
                    conn.errorStream?.bufferedReader()?.readText() ?: "No error body"
                }

                Log.i(TAG, "<<< API response [$code]: $response")
                conn.disconnect()

                mainHandler.post {
                    val msg = if (code in 200..299) "✅ Chấm công thành công!" else "⚠️ API lỗi: $code"
                    Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                Log.e(TAG, "API call FAILED", e)
                mainHandler.post {
                    Toast.makeText(this, "❌ Lỗi kết nối: ${e.message}", Toast.LENGTH_LONG).show()
                }
            } finally {
                isSending.set(false)
            }
        }
    }
}
