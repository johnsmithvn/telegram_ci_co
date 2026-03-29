package com.chamcong.auto

import android.accessibilityservice.AccessibilityService
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
    private val isSending = AtomicBoolean(false)
    private var lastTriggerTime = 0L

    override fun onServiceConnected() {
        super.onServiceConnected()

        val prefs = getSharedPreferences("chamcong_config", MODE_PRIVATE)
        val targetPackage = prefs.getString("humax_package", "") ?: ""

        if (targetPackage.isNotBlank()) {
            serviceInfo = serviceInfo.apply {
                packageNames = arrayOf(targetPackage)
            }
            Log.i(TAG, "Service connected, filtering package: $targetPackage")
        } else {
            Log.w(TAG, "Service connected, no package filter")
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val prefs = getSharedPreferences("chamcong_config", MODE_PRIVATE)
        val targetPackage = prefs.getString("humax_package", "") ?: ""

        if (targetPackage.isNotBlank() && event.packageName?.toString() != targetPackage) {
            return
        }

        val now = System.currentTimeMillis()
        if (now - lastTriggerTime < COOLDOWN_MS) return

        lastTriggerTime = now

        // Capture the exact timestamp at the moment of detection.
        // Even if Render takes 50s to cold start, we send THIS time —
        // so the recorded attendance time is always accurate.
        val capturedTime = java.util.Date(now)

        Log.i(TAG, "Humax App triggered — calling API with client_time")
        Toast.makeText(this, "Auto Chấm Công: Đang gửi...", Toast.LENGTH_SHORT).show()
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

        if (apiUrl.isBlank() || telegramId.isBlank()) {
            Log.e(TAG, "API URL or Telegram ID not configured")
            isSending.set(false)
            return
        }

        // Format as ISO-8601 UTC so the backend can parse it correctly
        val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val clientTimeIso = isoFormat.format(capturedTime)

        executor.execute {
            try {
                val url = URL("${apiUrl.trimEnd('/')}/api/attendance")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("x-api-key", apiSecret)
                conn.connectTimeout = 15_000
                conn.readTimeout = 15_000
                conn.doOutput = true

                // Send client_time so backend records accurate time even on cold start
                val body = """{"telegram_id":$telegramId,"client_time":"$clientTimeIso"}"""
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(body) }

                val code = conn.responseCode
                val response = if (code in 200..299) {
                    conn.inputStream.bufferedReader().readText()
                } else {
                    conn.errorStream?.bufferedReader()?.readText() ?: "No error body"
                }

                Log.i(TAG, "API response [$code]: $response")
                conn.disconnect()
            } catch (e: Exception) {
                Log.e(TAG, "API call failed", e)
            } finally {
                isSending.set(false)
            }
        }
    }
}
