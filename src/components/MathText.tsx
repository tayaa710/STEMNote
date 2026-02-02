import React, {useState, useCallback} from 'react';
import {StyleSheet, View, useColorScheme} from 'react-native';
import WebView from 'react-native-webview';

interface MathTextProps {
  content: string;
  style?: object;
}

const MathText: React.FC<MathTextProps> = ({content, style}) => {
  const [height, setHeight] = useState(100);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Escape content for safe HTML insertion (preserve newlines for KaTeX)
  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const escapedContent = escapeHtml(content);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
      <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          font-size: 16px;
          line-height: 1.6;
          color: ${isDark ? '#ffffff' : '#333333'};
          background-color: transparent;
          padding: 0;
          word-wrap: break-word;
          white-space: pre-wrap;
        }
        .katex {
          font-size: 1.1em;
        }
        .katex-display {
          margin: 0.5em 0;
          overflow-x: auto;
          overflow-y: hidden;
        }
      </style>
    </head>
    <body>
      <div id="content">${escapedContent}</div>
      <script>
        try {
          if (typeof renderMathInElement === 'function') {
            renderMathInElement(document.body, {
              delimiters: [
                {left: "$$", right: "$$", display: true},
                {left: "$", right: "$", display: false},
                {left: "\\\\[", right: "\\\\]", display: true},
                {left: "\\\\(", right: "\\\\)", display: false}
              ],
              throwOnError: false
            });
          }
        } catch(e) {
          console.error('KaTeX error:', e);
        }

        // Send height to React Native
        setTimeout(function() {
          var height = document.body.scrollHeight;
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'height', value: height}));
        }, 500);
      </script>
    </body>
    </html>
  `;

  const onMessage = useCallback((event: {nativeEvent: {data: string}}) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'height' && data.value > 0) {
        setHeight(data.value + 20); // Add padding
      }
    } catch (e) {
      // Ignore parse errors
    }
  }, []);

  return (
    <View style={[styles.container, style, {height}]}>
      <WebView
        source={{html}}
        style={styles.webview}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        onMessage={onMessage}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        scalesPageToFit={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default MathText;
