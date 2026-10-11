package com.phonefinder.app

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class PhoneFinderAdminReceiver : DeviceAdminReceiver() {
    companion object {
        private const val TAG = "PhoneFinderAdmin"
    }

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.i(TAG, "Phone Finder Device Administrator enabled.")
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Log.w(TAG, "Phone Finder Device Administrator disabled by user.")
    }
}
