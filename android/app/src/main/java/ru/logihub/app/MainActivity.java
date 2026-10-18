package ru.logihub.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;

import androidx.webkit.WebViewAssetLoader;

/**
 * Android-приложение «ЛогиХаб»: веб-приложение из ассетов APK открывается в WebView.
 * Файлы раздаются по https://appassets.androidplatform.net/assets/www/ – работают ES-модули, localStorage и офлайн-режим.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/www/index.html";
    private static final int PICK_FILES = 1;

    private WebView web;
    private ValueCallback<Uri[]> filesCallback;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);   // вёрстка рассчитана на масштаб 100 % (системный крупный шрифт MIUI ломал сетку)
        s.setUserAgentString(s.getUserAgentString() + " LogiHubApp/1.0");

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (HOST.equals(uri.getHost())) return false;
                // внешние ссылки (Telegram-боты, wiki, GitHub, tel:) – во внешнем приложении
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            // выбор фото к претензии
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filesCallback != null) filesCallback.onReceiveValue(null);
                filesCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), PICK_FILES);
                } catch (Exception e) {
                    filesCallback = null;
                    return false;
                }
                return true;
            }
        });

        web.addJavascriptInterface(new Bridge(), "LogiHubAndroid");

        if (state != null) web.restoreState(state);
        else web.loadUrl(START);
    }

    /** Мост для страницы: печать документа (договор-счёт, ТТН, акт…) через системную печать – в PDF или на принтер. */
    private class Bridge {
        @JavascriptInterface
        public void print(final String title) {
            runOnUiThread(() -> {
                PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                PrintDocumentAdapter adapter = web.createPrintDocumentAdapter(title);
                pm.print(title, adapter, new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == PICK_FILES && filesCallback != null) {
            filesCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            filesCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }
}
