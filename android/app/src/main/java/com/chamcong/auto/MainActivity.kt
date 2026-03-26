package com.chamcong.auto

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val etApiUrl = findViewById<EditText>(R.id.et_api_url)
        val etApiSecret = findViewById<EditText>(R.id.et_api_secret)
        val etTelegramId = findViewById<EditText>(R.id.et_telegram_id)
        val etHumaxPackage = findViewById<EditText>(R.id.et_humax_package)
        val btnSave = findViewById<Button>(R.id.btn_save)
        val btnOpenAccessibility = findViewById<Button>(R.id.btn_open_accessibility)
        val tvStatus = findViewById<TextView>(R.id.tv_status)

        val prefs = getSharedPreferences("chamcong_config", MODE_PRIVATE)
        etApiUrl.setText(prefs.getString("api_url", "https://telegram-ci-co.onrender.com"))
        etApiSecret.setText(prefs.getString("api_secret", ""))
        etTelegramId.setText(prefs.getString("telegram_id", ""))
        etHumaxPackage.setText(prefs.getString("humax_package", "com.phanmemnhansu"))

        btnSave.setOnClickListener {
            val apiUrl = etApiUrl.text.toString().trim()
            val apiSecret = etApiSecret.text.toString().trim()
            val telegramId = etTelegramId.text.toString().trim()
            val humaxPackage = etHumaxPackage.text.toString().trim()

            if (apiUrl.isBlank() || telegramId.isBlank() || humaxPackage.isBlank()) {
                Toast.makeText(this, "Vui lòng điền đầy đủ thông tin", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            prefs.edit()
                .putString("api_url", apiUrl)
                .putString("api_secret", apiSecret)
                .putString("telegram_id", telegramId)
                .putString("humax_package", humaxPackage)
                .apply()

            Toast.makeText(this, "Đã lưu cấu hình ✓", Toast.LENGTH_SHORT).show()
        }

        btnOpenAccessibility.setOnClickListener {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }

        updateStatus(tvStatus)
    }

    override fun onResume() {
        super.onResume()
        val tvStatus = findViewById<TextView>(R.id.tv_status)
        updateStatus(tvStatus)
    }

    private fun updateStatus(tvStatus: TextView) {
        val enabled = isAccessibilityServiceEnabled()
        tvStatus.text = if (enabled) "🟢 Service đang hoạt động" else "🔴 Service chưa bật"
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val service = "${packageName}/${ChamCongAccessibilityService::class.java.canonicalName}"
        val enabledServices = Settings.Secure.getString(
            contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        return enabledServices.contains(service)
    }
}
