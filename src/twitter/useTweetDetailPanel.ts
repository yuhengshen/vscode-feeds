import { extensionContext, ref, shallowRef } from 'reactive-vscode'
import { Disposable, env, Uri, ViewColumn, window } from 'vscode'
import type { WebviewPanel } from 'vscode'
import type { Tweet, TweetDetail } from './types'
import { xWebApi } from './webApi'
import { logger } from '../utils'

function getWebviewContent(webview: WebviewPanel['webview']): string {
  if (!extensionContext.value) {
    throw new Error('Extension context not initialized.')
  }

  const scriptUri = webview.asWebviewUri(
    Uri.joinPath(extensionContext.value.extensionUri, 'dist', 'webview', 'main.iife.js')
  )

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; media-src ${webview.cspSource} https:; script-src ${webview.cspSource}; style-src 'unsafe-inline';">
    </head>
    <body>
      <div id="app"></div>
      <script src="${scriptUri}"></script>
    </body>
    </html>
  `
}

// Composable for Tweet Detail Panel
export function useTweetDetailPanel() {
  const panel = shallowRef<WebviewPanel | null>(null)
  const currentTweet = shallowRef<TweetDetail | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const disposables: Disposable[] = []

  function postMessage(message: any) {
    panel.value?.webview.postMessage(message)
  }

  async function handleMessage(message: { type: string, tweetId?: string }): Promise<void> {
    switch (message.type) {
      case 'like':
        if (message.tweetId) {
          try {
            await xWebApi.likeTweet(message.tweetId)
            if (currentTweet.value) {
              currentTweet.value = { ...currentTweet.value, liked: true }
              postMessage({ type: 'tweet', tweet: currentTweet.value })
            }
          }
          catch (err) {
            window.showErrorMessage(`Failed to like tweet: ${err}`)
          }
        }
        break

      case 'unlike':
        if (message.tweetId) {
          try {
            await xWebApi.unlikeTweet(message.tweetId)
            if (currentTweet.value) {
              currentTweet.value = { ...currentTweet.value, liked: false }
              postMessage({ type: 'tweet', tweet: currentTweet.value })
            }
          }
          catch (err) {
            window.showErrorMessage(`Failed to unlike tweet: ${err}`)
          }
        }
        break

      case 'bookmark':
        if (message.tweetId) {
          try {
            await xWebApi.bookmarkTweet(message.tweetId)
            if (currentTweet.value) {
              currentTweet.value = { ...currentTweet.value, bookmarked: true }
              postMessage({ type: 'tweet', tweet: currentTweet.value })
            }
          }
          catch (err) {
            window.showErrorMessage(`Failed to bookmark tweet: ${err}`)
          }
        }
        break

      case 'removeBookmark':
        if (message.tweetId) {
          try {
            await xWebApi.removeBookmark(message.tweetId)
            if (currentTweet.value) {
              currentTweet.value = { ...currentTweet.value, bookmarked: false }
              postMessage({ type: 'tweet', tweet: currentTweet.value })
            }
          }
          catch (err) {
            window.showErrorMessage(`Failed to remove bookmark: ${err}`)
          }
        }
        break

      case 'viewReply':
        if (message.tweetId) {
          try {
            const reply = currentTweet.value?.replies?.find(r => r.id === message.tweetId)
            if (reply) {
              await show(reply)
            }
          }
          catch (err) {
            window.showErrorMessage(`Failed to view reply: ${err}`)
          }
        }
        break

      case 'openExternal':
        if (message.tweetId) {
          const url = `https://twitter.com/i/status/${message.tweetId}`
          env.openExternal(Uri.parse(url))
        }
        break
    }
  }

  async function show(tweet: Tweet): Promise<void> {
    // If panel exists, reveal it
    if (panel.value) {
      panel.value.reveal()
    }
    else {
      // Create new panel
      const newPanel = window.createWebviewPanel(
        'tweetDetail',
        `Tweet by @${tweet.author?.username || 'unknown'}`,
        ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        },
      )

      // Set HTML content
      newPanel.webview.html = getWebviewContent(newPanel.webview)

      // Set up message handling
      disposables.push(
        newPanel.webview.onDidReceiveMessage(handleMessage),
      )

      // Handle panel disposal
      newPanel.onDidDispose(() => {
        panel.value = null
        currentTweet.value = null
        loading.value = false
        error.value = null
        // Dispose all listeners
        disposables.forEach(d => d.dispose())
        disposables.length = 0
      })

      panel.value = newPanel
    }

    // Load tweet
    await loadTweet(tweet)
  }

  async function loadTweet(tweet: Tweet): Promise<void> {
    if (!panel.value) return

    try {
      panel.value.title = `Tweet by @${tweet.author?.username || 'unknown'}`
      loading.value = true
      error.value = null
      postMessage({ type: 'loading' })

      // Fetch full tweet details with replies
      const tweetDetail = await xWebApi.getTweetDetail(tweet.id)
      currentTweet.value = tweetDetail
      loading.value = false
      postMessage({ type: 'tweet', tweet: tweetDetail })
    }
    catch (err) {
      logger.error('Failed to load tweet details:', err)
      loading.value = false
      error.value = err instanceof Error ? err.message : 'Unknown error'
      postMessage({ type: 'error', error: error.value })
    }
  }

  function dispose(): void {
    if (panel.value) {
      panel.value.dispose()
      panel.value = null
    }
    disposables.forEach(d => d.dispose())
    disposables.length = 0
  }

  return {
    panel,
    currentTweet,
    loading,
    error,
    show,
    dispose,
  }
}

// Singleton instance for global access
let tweetDetailPanelInstance: ReturnType<typeof useTweetDetailPanel> | null = null

export function getTweetDetailPanel(): ReturnType<typeof useTweetDetailPanel> {
  if (!tweetDetailPanelInstance) {
    tweetDetailPanelInstance = useTweetDetailPanel()
  }
  return tweetDetailPanelInstance
}
