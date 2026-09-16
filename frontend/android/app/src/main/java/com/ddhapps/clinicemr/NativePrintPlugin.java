package com.ddhapps.clinicemr;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Renders an HTML document in an off-screen WebView and hands it to the Android
 * print framework (Print / Save as PDF). Android WebView ignores window.print(),
 * so the web app calls this instead when running inside the app
 * (see frontend/src/native/index.js).
 */
@CapacitorPlugin(name = "NativePrint")
public class NativePrintPlugin extends Plugin {

    // Kept as a field so the WebView is not garbage-collected mid-render.
    private WebView printWebView;

    @PluginMethod
    public void print(PluginCall call) {
        final String html = call.getString("html", "");
        final String jobName = call.getString("name", "Document");

        if (html == null || html.isEmpty()) {
            call.reject("No HTML supplied");
            return;
        }

        getActivity().runOnUiThread(() -> {
            printWebView = new WebView(getContext());
            printWebView.getSettings().setJavaScriptEnabled(false);
            printWebView.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    try {
                        PrintManager printManager =
                            (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
                        PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(jobName);
                        printManager.print(jobName, adapter, new PrintAttributes.Builder().build());
                        call.resolve();
                    } catch (Exception e) {
                        call.reject("Print failed: " + e.getMessage());
                    }
                    printWebView = null;
                }
            });
            printWebView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
        });
    }
}
