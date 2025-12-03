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

  function postMessage(message: unknown) {
    panel.value?.webview.postMessage(message)
  }

  // 更新当前推文状态并同步到 webview
  function updateTweet(updates: Partial<TweetDetail>) {
    if (!currentTweet.value) return
    currentTweet.value = { ...currentTweet.value, ...updates }
    postMessage({ type: 'tweet', tweet: currentTweet.value })
  }

  // 通用的推文操作处理器
  async function handleTweetAction<T>(
    action: () => Promise<T>,
    onSuccess: (result: T) => void,
    errorMsg: string
  ) {
    try {
      const result = await action()
      onSuccess(result)
    }
    catch (err) {
      window.showErrorMessage(`${errorMsg}: ${err}`)
    }
  }

  // 加载更多回复
  async function fetchMoreReplies(tweetId: string, cursor: string) {
    const { replies: moreReplies, cursor: nextCursor } = await xWebApi.getMoreReplies(tweetId, cursor)
    return { moreReplies, nextCursor }
  }

  // 在当前推文中查找目标推文
  function findTweetById(tweetId: string): Tweet | undefined {
    const tweet = currentTweet.value
    if (!tweet) return undefined

    return tweet.replies?.find(r => r.id === tweetId)
      || (tweet.reply_to_tweet?.id === tweetId ? tweet.reply_to_tweet : undefined)
      || (tweet.quoted_tweet?.id === tweetId ? tweet.quoted_tweet : undefined)
  }

  async function handleMessage(message: { type: string, tweetId?: string }): Promise<void> {
    const { type, tweetId } = message

    switch (type) {
      case 'like':
        if (tweetId) {
          await handleTweetAction(
            () => xWebApi.likeTweet(tweetId),
            () => updateTweet({ liked: true }),
            'Failed to like tweet'
          )
        }
        break

      case 'unlike':
        if (tweetId) {
          await handleTweetAction(
            () => xWebApi.unlikeTweet(tweetId),
            () => updateTweet({ liked: false }),
            'Failed to unlike tweet'
          )
        }
        break

      case 'bookmark':
        if (tweetId) {
          await handleTweetAction(
            () => xWebApi.bookmarkTweet(tweetId),
            () => updateTweet({ bookmarked: true }),
            'Failed to bookmark tweet'
          )
        }
        break

      case 'removeBookmark':
        if (tweetId) {
          await handleTweetAction(
            () => xWebApi.removeBookmark(tweetId),
            () => updateTweet({ bookmarked: false }),
            'Failed to remove bookmark'
          )
        }
        break

      case 'viewReply':
        if (tweetId) {
          const targetTweet = findTweetById(tweetId)
          if (targetTweet) {
            await show(targetTweet)
          }
        }
        break

      case 'loadMoreReplies':
        if (currentTweet.value?.repliesCursor) {
          try {
            postMessage({ type: 'loadingMore' })
            const { moreReplies, nextCursor } = await fetchMoreReplies(
              currentTweet.value.id,
              currentTweet.value.repliesCursor
            )
            updateTweet({
              replies: [...(currentTweet.value.replies || []), ...moreReplies],
              repliesCursor: nextCursor,
              hasMoreReplies: !!nextCursor,
            })
          }
          catch (err) {
            logger.error('Failed to load more replies:', err)
            window.showErrorMessage(`Failed to load more replies: ${err}`)
            postMessage({ type: 'loadMoreError' })
          }
        }
        break

      case 'openExternal':
        if (tweetId) {
          env.openExternal(Uri.parse(`https://twitter.com/i/status/${tweetId}`))
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

      // 预加载下一轮回复来确认是否真的有更多内容
      if (tweetDetail.repliesCursor) {
        try {
          const { moreReplies, nextCursor } = await fetchMoreReplies(
            tweetDetail.id,
            tweetDetail.repliesCursor
          )
          if (moreReplies.length > 0) {
            tweetDetail.replies = [...(tweetDetail.replies || []), ...moreReplies]
            tweetDetail.repliesCursor = nextCursor
            tweetDetail.hasMoreReplies = !!nextCursor
          }
          else {
            tweetDetail.repliesCursor = undefined
            tweetDetail.hasMoreReplies = false
          }
        }
        catch (err) {
          logger.warn('Failed to preload more replies:', err)
        }
      }

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
