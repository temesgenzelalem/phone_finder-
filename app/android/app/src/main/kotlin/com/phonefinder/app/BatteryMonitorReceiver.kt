package com.phonefinder.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.BatteryManager
import android.util.Log

class BatteryMonitorReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "BatteryMonitor"

        var onBatteryLowListener: ((batteryLevel: Int) -> Unit)? = null
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        Log.i(TAG, "Received battery broadcast: $action")

        val batteryLevel = getBatteryLevel(context)

        if (action == Intent.ACTION_BATTERY_LOW || batteryLevel <= 15) {
            Log.w(TAG, "Critical low battery detected ($batteryLevel%). Triggering opportunistic capture.")
            onBatteryLowListener?.invoke(batteryLevel)
        }
    }

    private fun getBatteryLevel(context: Context): Int {
        val batteryManager = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        return batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
    }
}
