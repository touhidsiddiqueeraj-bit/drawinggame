package com.touhidsiddiqueeraj.drawinggame;

import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /**
     * Android hardware back button support.
     *
     * The web app pushes a browser history entry for every screen
     * (home -> picker -> draw), so walking the WebView history pops one
     * screen at a time instead of exiting. When there is nothing left to
     * pop (home screen), fall through to the default behavior.
     */
    @Override
    public void onBackPressed() {
        try {
            WebView wv = (this.bridge != null) ? this.bridge.getWebView() : null;
            if (wv != null && wv.canGoBack()) {
                wv.goBack();
                return;
            }
        } catch (Exception ignore) {
            // never block the default behavior on a weird state
        }
        super.onBackPressed();
    }
}
