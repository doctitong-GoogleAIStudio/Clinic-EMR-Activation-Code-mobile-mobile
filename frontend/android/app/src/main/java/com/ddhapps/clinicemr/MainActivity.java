package com.ddhapps.clinicemr;

import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int BRAND_TEAL = Color.parseColor("#0F766E");

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativePrintPlugin.class);
        super.onCreate(savedInstanceState);
        setupEdgeToEdge();
    }

    /**
     * Android 15+ forces edge-to-edge for apps targeting API 35+, so the WebView
     * would otherwise be drawn under the status bar, navigation bar and keyboard.
     * Pad the WebView by the system insets and paint the status-bar strip in the
     * brand colour so it matches the app header.
     */
    private void setupEdgeToEdge() {
        FrameLayout content = findViewById(android.R.id.content);
        View webView = getBridge().getWebView();
        content.setBackgroundColor(Color.WHITE);

        View statusBarBackground = new View(this);
        statusBarBackground.setBackgroundColor(BRAND_TEAL);
        FrameLayout.LayoutParams statusParams =
            new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, 0, Gravity.TOP);
        content.addView(statusBarBackground, statusParams);

        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(false); // white icons on teal
        controller.setAppearanceLightNavigationBars(true); // dark icons on white

        ViewCompat.setOnApplyWindowInsetsListener(content, (v, insets) -> {
            Insets bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());

            webView.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));

            statusParams.height = bars.top;
            statusBarBackground.setLayoutParams(statusParams);
            return WindowInsetsCompat.CONSUMED;
        });
    }
}
