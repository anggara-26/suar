package com.suar.haptics

import android.content.Context
import android.media.AudioAttributes
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray

/**
 * Vibrates under USAGE_ALARM rather than RN's built-in `Vibration` module,
 * which always uses the default (UNKNOWN) usage — Android scales that down to
 * zero amplitude whenever the ringer is in Silent/DND, silencing every app's
 * vibration identically (verified live: even the system UI's own touch
 * haptics show `scale: 0.00` under `dumpsys vibrator_manager` in that state).
 * F3 proximity haptics is a safety-relevant accessibility channel for blind
 * users, so it needs to survive a ringer state a user could easily have
 * flipped by accident — ALARM usage is one of the few Android does not scale
 * down for ringer mode.
 */
class SuarHapticsModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "SuarHaptics"

  private val vibrator: Vibrator
    get() {
      val context = reactApplicationContext
      return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
        manager.defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
      }
    }

  /**
   * @param pattern Same shape as RN's `Vibration.vibrate` pattern: index 0 is
   *   the initial delay, then alternating vibrate/pause durations in ms.
   * @param repeatIndex Index to loop back to, or -1 for no repeat — matches
   *   `VibrationEffect.createWaveform`'s own `repeat` parameter directly.
   */
  @ReactMethod
  fun vibratePattern(pattern: ReadableArray, repeatIndex: Int) {
    val timings = LongArray(pattern.size()) { i -> pattern.getDouble(i).toLong() }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val effect = VibrationEffect.createWaveform(timings, repeatIndex)
      val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build()
      vibrator.vibrate(effect, attributes)
    } else {
      // Pre-26: no VibrationEffect/AudioAttributes overload exists, so this
      // falls back to the legacy call — same ringer-mode scaling RN's own
      // Vibration module already has on these OS versions, nothing lost.
      @Suppress("DEPRECATION")
      vibrator.vibrate(timings, repeatIndex)
    }
  }

  @ReactMethod
  fun cancel() {
    vibrator.cancel()
  }
}
