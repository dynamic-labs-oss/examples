package com.dynamiclabs.examples.bareflowmetamaskdemo

import android.content.Intent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "BareFlowMetaMaskDemo"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  // Forwards incoming bareflowmetamaskdemo:// intents (see AndroidManifest.xml's
  // intent-filter and dynamicClient.ts's metadata.nativeLink) to this already-running
  // Activity — required because the manifest sets launchMode="singleTask", so a warm
  // app receives the redirect here rather than via a fresh launch Intent. Without this,
  // RN's Linking.getInitialURL()/'url' listeners never see it.
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
  }
}
