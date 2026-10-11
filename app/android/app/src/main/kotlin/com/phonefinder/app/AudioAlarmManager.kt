package com.phonefinder.app

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log

class AudioAlarmManager(private val context: Context) {
    companion object {
        private const val TAG = "AudioAlarmManager"
    }

    private var mediaPlayer: MediaPlayer? = null
    private var originalVolume: Int = -1
    private val handler = Handler(Looper.getMainLooper())
    private var autoStopRunnable: Runnable? = null

    val isAlarmPlaying: Boolean
        get() = mediaPlayer?.isPlaying == true

    /**
     * Start playing high-priority siren at maximum volume using USAGE_ALARM stream.
     */
    fun startAlarm(durationSeconds: Int = 120) {
        if (isAlarmPlaying) {
            Log.d(TAG, "Alarm already playing.")
            return
        }

        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

        try {
            // Save original volume
            originalVolume = audioManager.getStreamVolume(AudioManager.STREAM_ALARM)
            val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM)

            // Force max volume on ALARM stream
            audioManager.setStreamVolume(AudioManager.STREAM_ALARM, maxVolume, 0)

            // Resolve default alarm or ringtone URI
            var alertUri: Uri? = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            if (alertUri == null) {
                alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            }

            mediaPlayer = MediaPlayer().apply {
                setDataSource(context, alertUri!!)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setFlags(AudioAttributes.FLAG_AUDIBILITY_ENFORCED)
                        .build()
                )
                isLooping = true
                prepare()
                start()
            }

            Log.i(TAG, "Siren alarm started. Playing for $durationSeconds seconds.")

            // Schedule automatic timeout
            autoStopRunnable = Runnable {
                Log.i(TAG, "Alarm reached duration timeout ($durationSeconds s). Stopping.")
                stopAlarm()
            }
            handler.postDelayed(autoStopRunnable!!, durationSeconds * 1000L)

        } catch (e: Exception) {
            Log.e(TAG, "Failed to start alarm: ${e.message}", e)
            stopAlarm()
        }
    }

    /**
     * Stop alarm and restore previous stream volume.
     */
    fun stopAlarm() {
        autoStopRunnable?.let { handler.removeCallbacks(it) }
        autoStopRunnable = null

        try {
            mediaPlayer?.let {
                if (it.isPlaying) {
                    it.stop()
                }
                it.reset()
                it.release()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing MediaPlayer: ${e.message}")
        } finally {
            mediaPlayer = null
        }

        // Restore original volume if it was saved
        if (originalVolume >= 0) {
            try {
                val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
                audioManager.setStreamVolume(AudioManager.STREAM_ALARM, originalVolume, 0)
            } catch (e: Exception) {
                Log.w(TAG, "Could not restore volume: ${e.message}")
            }
            originalVolume = -1
        }

        Log.i(TAG, "Siren alarm stopped.")
    }
}
