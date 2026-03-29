package com.chamcong.auto

import android.accessibilityservice.AccessibilityService
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class ChamCongAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "ChamCong"
        private const val TRIGGER_TEXT = "Xác nhận chấm công"
    }

    private val executor = Executors.newSingleThreadExecutor()
    private val isSending = AtomicBoolean(false)
    private var lastTriggeredText: String? = null

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
            Log.w(TAG, "Service connected, no package filter — listening to ALL apps")
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val prefs = getSharedPreferences("chamcong_config", MODE_PRIVATE)
        val targetPackage = prefs.getString("humax_package", "") ?: ""

        if (targetPackage.isNotBlank() && event.packageName?.toString() != targetPackage) {
            return
        }

        val root = rootInActiveWindow ?: return
        val matchedText = findTriggerText(root, TRIGGER_TEXT)
        root.recycle()

        if (matchedText == null) return

        // Same popup still on screen — skip
        if (matchedText == lastTriggeredText) return

        lastTriggeredText = matchedText
        Log.i(TAG, "Detected NEW popup: '$matchedText' — calling API")
        android.widget.Toast.makeText(this, "Auto Chấm Công: Đang gửi API...", android.widget.Toast.LENGTH_SHORT).show()
        callAttendanceApi()
    }

    override fun onInterrupt() {
        Log.w(TAG, "Accessibility service interrupted")
    }

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }

    /**
     * Finds the full text of a node containing the trigger.
     * e.g. "Xác nhận chấm công lúc 21:08" — the timestamp makes each popup unique.
     */
    private fun findTriggerText(node: AccessibilityNodeInfo, trigger: String): String? {
        val nodeText = node.text?.toString() ?: ""
        if (nodeText.contains(trigger, ignoreCase = true)) {
            return nodeText
        }

        val contentDesc = node.contentDescription?.toString() ?: ""
        if (contentDesc.contains(trigger, ignoreCase = true)) {
            return contentDesc
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val result = findTriggerText(child, trigger)
            child.recycle()
            if (result != null) return result
        }

        return null
    }

    private fun callAttendanceApi() {
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

                val body = """{"telegram_id":$telegramId}"""
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
