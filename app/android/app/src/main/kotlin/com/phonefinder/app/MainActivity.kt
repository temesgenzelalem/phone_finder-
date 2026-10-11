package com.phonefinder.app

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.Location
import android.location.LocationManager
import android.os.BatteryManager
import android.os.Build
import androidx.annotation.NonNull
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    companion object {
        private const val CHANNEL = "com.phonefinder.app/hardware"
    }

    private lateinit var audioAlarmManager: AudioAlarmManager

    override fun configureFlutterEngine(@NonNull flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        audioAlarmManager = AudioAlarmManager(this)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val adminComponent = ComponentName(this, PhoneFinderAdminReceiver::class.java)

            when (call.method) {
                "isDeviceAdminActive" -> {
                    result.success(dpm.isAdminActive(adminComponent))
                }
                "requestDeviceAdmin" -> {
                    val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                        putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent)
                        putExtra(
                            DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                            "Phone Finder requires device admin to lock your screen remotely when reported lost."
                        )
                    }
                    startActivity(intent)
                    result.success(true)
                }
                "lockNow" -> {
                    if (dpm.isAdminActive(adminComponent)) {
                        dpm.lockNow()
                        result.success(true)
                    } else {
                        result.error("NOT_ADMIN", "Device administrator permission is not active.", null)
                    }
                }
                "startAlarm" -> {
                    val duration = call.argument<Int>("duration_seconds") ?: 120
                    audioAlarmManager.startAlarm(duration)
                    result.success(true)
                }
                "stopAlarm" -> {
                    audioAlarmManager.stopAlarm()
                    result.success(true)
                }
                "isAlarmPlaying" -> {
                    result.success(audioAlarmManager.isAlarmPlaying)
                }
                "startForegroundProtection" -> {
                    val intent = Intent(this, LocationForegroundService::class.java).apply {
                        action = LocationForegroundService.ACTION_START
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        startForegroundService(intent)
                    } else {
                        startService(intent)
                    }
                    result.success(true)
                }
                "stopForegroundProtection" -> {
                    val intent = Intent(this, LocationForegroundService::class.java).apply {
                        action = LocationForegroundService.ACTION_STOP
                    }
                    startService(intent)
                    result.success(true)
                }
                "getBatteryStatus" -> {
                    val batteryIntent = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
                    val level = batteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
                    val scale = batteryIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
                    val status = batteryIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1

                    val pct = if (level >= 0 && scale > 0) (level * 100 / scale) else level
                    val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                                     status == BatteryManager.BATTERY_STATUS_FULL

                    result.success(mapOf(
                        "level" to pct,
                        "is_charging" to isCharging
                    ))
                }
                "getLastKnownLocation" -> {
                    val loc: Location? = LocationForegroundService.lastKnownLocation ?: run {
                        try {
                            val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
                            lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                                ?: lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                        } catch (e: SecurityException) {
                            null
                        }
                    }

                    if (loc != null) {
                        result.success(mapOf(
                            "latitude" to loc.latitude,
                            "longitude" to loc.longitude,
                            "accuracy" to loc.accuracy.toDouble(),
                            "altitude" to loc.altitude,
                            "time" to loc.time
                        ))
                    } else {
                        result.success(null)
                    }
                }
                else -> {
                    result.notImplemented()
                }
            }
        }
    }

    override fun onDestroy() {
        if (::audioAlarmManager.isInitialized) {
            audioAlarmManager.stopAlarm()
        }
        super.onDestroy()
    }
}
