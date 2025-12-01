import { Disposable, Uri, ViewColumn, Webview, window } from 'vscode'
import type { WebviewPanel } from 'vscode'
import type { Tweet, TweetDetail } from './types'
import { xWebApi } from './webApi'
import { logger } from '../utils'

export class TweetDetailPanel {
  public static currentPanel: TweetDetailPanel | undefined
  private readonly _panel: WebviewPanel
  private readonly _extensionUri: Uri
  private _disposables: Disposable[] = []
  private _currentTweet: TweetDetail | null = null

  private constructor(panel: WebviewPanel, extensionUri: Uri) {
    this._panel = panel
    this._extensionUri = extensionUri

    // Set up message handling
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        await this._handleMessage(message)
      },
      null,
      this._disposables,
    )

    // Handle panel disposal
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)
  }

  public static async show(extensionUri: Uri, tweet: Tweet): Promise<void> {
    const column = ViewColumn.Beside

    // If panel exists, show it
    if (TweetDetailPanel.currentPanel) {
      TweetDetailPanel.currentPanel._panel.reveal(column)
      await TweetDetailPanel.currentPanel._loadTweet(tweet)
      return
    }

    // Create new panel
    const panel = window.createWebviewPanel(
      'tweetDetail',
      `Tweet by @${tweet.author?.username || 'unknown'}`,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      },
    )

    TweetDetailPanel.currentPanel = new TweetDetailPanel(panel, extensionUri)
    await TweetDetailPanel.currentPanel._loadTweet(tweet)
  }

  private async _loadTweet(tweet: Tweet): Promise<void> {
    try {
      this._panel.title = `Tweet by @${tweet.author?.username || 'unknown'}`
      
      // Show loading state
      this._panel.webview.html = this._getLoadingHtml()

      // Fetch full tweet details with replies
      const tweetDetail = await xWebApi.getTweetDetail(tweet.id)
      this._currentTweet = tweetDetail

      // Update webview
      this._panel.webview.html = this._getHtmlForTweet(tweetDetail)
    }
    catch (error) {
      logger.error('Failed to load tweet details:', error)
      this._panel.webview.html = this._getErrorHtml(error instanceof Error ? error.message : 'Unknown error')
    }
  }

  private async _handleMessage(message: { type: string, tweetId?: string }): Promise<void> {
    switch (message.type) {
      case 'like':
        if (message.tweetId) {
          try {
            await xWebApi.likeTweet(message.tweetId)
            if (this._currentTweet) {
              this._currentTweet.liked = true
              this._panel.webview.html = this._getHtmlForTweet(this._currentTweet)
            }
          }
          catch (error) {
            window.showErrorMessage(`Failed to like tweet: ${error}`)
          }
        }
        break

      case 'unlike':
        if (message.tweetId) {
          try {
            await xWebApi.unlikeTweet(message.tweetId)
            if (this._currentTweet) {
              this._currentTweet.liked = false
              this._panel.webview.html = this._getHtmlForTweet(this._currentTweet)
            }
          }
          catch (error) {
            window.showErrorMessage(`Failed to unlike tweet: ${error}`)
          }
        }
        break

      case 'bookmark':
        if (message.tweetId) {
          try {
            await xWebApi.bookmarkTweet(message.tweetId)
            if (this._currentTweet) {
              this._currentTweet.bookmarked = true
              this._panel.webview.html = this._getHtmlForTweet(this._currentTweet)
            }
          }
          catch (error) {
            window.showErrorMessage(`Failed to bookmark tweet: ${error}`)
          }
        }
        break

      case 'removeBookmark':
        if (message.tweetId) {
          try {
            await xWebApi.removeBookmark(message.tweetId)
            if (this._currentTweet) {
              this._currentTweet.bookmarked = false
              this._panel.webview.html = this._getHtmlForTweet(this._currentTweet)
            }
          }
          catch (error) {
            window.showErrorMessage(`Failed to remove bookmark: ${error}`)
          }
        }
        break

      case 'viewReply':
        if (message.tweetId) {
          try {
            const reply = this._currentTweet?.replies?.find(r => r.id === message.tweetId)
            if (reply) {
              await TweetDetailPanel.show(this._extensionUri, reply)
            }
          }
          catch (error) {
            window.showErrorMessage(`Failed to view reply: ${error}`)
          }
        }
        break

      case 'openExternal':
        if (message.tweetId) {
          const url = `https://twitter.com/i/status/${message.tweetId}`
          import('vscode').then(vscode => vscode.env.openExternal(Uri.parse(url)))
        }
        break
    }
  }

  private _getLoadingHtml(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
          }
          .loader {
            border: 4px solid var(--vscode-widget-border);
            border-top: 4px solid var(--vscode-button-background);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="loader"></div>
      </body>
      </html>
    `
  }

  private _getErrorHtml(error: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            font-family: var(--vscode-font-family);
            color: var(--vscode-errorForeground);
            background: var(--vscode-editor-background);
          }
        </style>
      </head>
      <body>
        <h2>Error Loading Tweet</h2>
        <p>${this._escapeHtml(error)}</p>
      </body>
      </html>
    `
  }

  private _getHtmlForTweet(tweet: TweetDetail): string {
    const author = tweet.author
    const metrics = tweet.public_metrics
    const date = new Date(tweet.created_at).toLocaleString()

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            box-sizing: border-box;
          }
          body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            margin: 0;
            padding: 16px;
            line-height: 1.5;
          }
          .tweet-container {
            max-width: 600px;
            margin: 0 auto;
          }
          .tweet-card {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 16px;
          }
          .tweet-header {
            display: flex;
            align-items: center;
            margin-bottom: 12px;
          }
          .avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            margin-right: 12px;
            background: var(--vscode-button-background);
          }
          .author-info {
            flex: 1;
          }
          .author-name {
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 4px;
          }
          .verified-badge {
            color: var(--vscode-button-background);
          }
          .author-username {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
          }
          .tweet-text {
            font-size: 1.1em;
            margin-bottom: 12px;
            white-space: pre-wrap;
            word-wrap: break-word;
          }
          .tweet-text a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
          }
          .tweet-text a:hover {
            text-decoration: underline;
          }
          .media-container {
            margin: 12px 0;
            border-radius: 12px;
            overflow: hidden;
          }
          .media-grid {
            display: grid;
            gap: 4px;
          }
          .media-grid.single {
            grid-template-columns: 1fr;
          }
          .media-grid.double {
            grid-template-columns: 1fr 1fr;
          }
          .media-grid.triple {
            grid-template-columns: 1fr 1fr;
          }
          .media-grid.quad {
            grid-template-columns: 1fr 1fr;
          }
          .media-item {
            width: 100%;
            max-height: 400px;
            object-fit: cover;
            cursor: pointer;
            transition: opacity 0.2s;
          }
          .media-item:hover {
            opacity: 0.9;
          }
          .video-container {
            position: relative;
            width: 100%;
          }
          .video-container video {
            width: 100%;
            max-height: 400px;
            border-radius: 8px;
          }
          .tweet-date {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
            margin-bottom: 12px;
          }
          .tweet-metrics {
            display: flex;
            gap: 20px;
            padding: 12px 0;
            border-top: 1px solid var(--vscode-widget-border);
            border-bottom: 1px solid var(--vscode-widget-border);
            margin-bottom: 12px;
          }
          .metric {
            display: flex;
            align-items: center;
            gap: 4px;
            color: var(--vscode-descriptionForeground);
          }
          .metric-value {
            font-weight: bold;
            color: var(--vscode-foreground);
          }
          .actions {
            display: flex;
            gap: 12px;
          }
          .action-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            border: none;
            border-radius: 20px;
            cursor: pointer;
            font-size: 0.9em;
            transition: all 0.2s;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
          }
          .action-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
          }
          .action-btn.active {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
          }
          .action-btn.like.active {
            background: #e0245e;
            color: white;
          }
          .action-btn.bookmark.active {
            background: #1da1f2;
            color: white;
          }
          
          /* Quoted Tweet */
          .quoted-tweet {
            border: 1px solid var(--vscode-widget-border);
            border-radius: 12px;
            padding: 12px;
            margin: 12px 0;
          }
          .quoted-tweet .tweet-header {
            margin-bottom: 8px;
          }
          .quoted-tweet .avatar {
            width: 24px;
            height: 24px;
          }
          
          /* Reply to */
          .reply-to {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
            margin-bottom: 8px;
          }
          .reply-to a {
            color: var(--vscode-textLink-foreground);
          }
          
          /* Replies section */
          .replies-section {
            margin-top: 24px;
          }
          .replies-header {
            font-size: 1.2em;
            font-weight: bold;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--vscode-widget-border);
          }
          .reply-card {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: background 0.2s;
          }
          .reply-card:hover {
            background: var(--vscode-list-hoverBackground);
          }
          .reply-card .tweet-header {
            margin-bottom: 8px;
          }
          .reply-card .avatar {
            width: 32px;
            height: 32px;
          }
          .reply-text {
            font-size: 0.95em;
          }
          
          /* External link button */
          .external-link {
            position: absolute;
            top: 16px;
            right: 16px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .external-link:hover {
            background: var(--vscode-button-secondaryHoverBackground);
          }
          
          .no-replies {
            color: var(--vscode-descriptionForeground);
            text-align: center;
            padding: 24px;
          }
        </style>
      </head>
      <body>
        <div class="tweet-container">
          ${tweet.reply_to_tweet ? this._renderReplyTo(tweet.reply_to_tweet) : ''}
          
          <div class="tweet-card" style="position: relative;">
            <button class="external-link" onclick="openExternal('${tweet.id}')" title="Open in Browser">
              ↗
            </button>
            
            <div class="tweet-header">
              ${author?.profile_image_url
                ? `<img class="avatar" src="${author.profile_image_url}" alt="${author.name}">`
                : '<div class="avatar"></div>'
              }
              <div class="author-info">
                <div class="author-name">
                  ${this._escapeHtml(author?.name || 'Unknown')}
                  ${author?.verified ? '<span class="verified-badge">✓</span>' : ''}
                </div>
                <div class="author-username">@${author?.username || 'unknown'}</div>
              </div>
            </div>
            
            <div class="tweet-text">${this._formatTweetText(tweet.text)}</div>
            
            ${tweet.media && tweet.media.length > 0 ? this._renderMedia(tweet.media) : ''}
            
            ${tweet.quoted_tweet ? this._renderQuotedTweet(tweet.quoted_tweet) : ''}
            
            <div class="tweet-date">${date}</div>
            
            ${metrics ? `
              <div class="tweet-metrics">
                <div class="metric">
                  <span class="metric-value">${this._formatNumber(metrics.retweet_count)}</span> Retweets
                </div>
                <div class="metric">
                  <span class="metric-value">${this._formatNumber(metrics.quote_count)}</span> Quotes
                </div>
                <div class="metric">
                  <span class="metric-value">${this._formatNumber(metrics.like_count)}</span> Likes
                </div>
                <div class="metric">
                  <span class="metric-value">${this._formatNumber(metrics.reply_count)}</span> Replies
                </div>
              </div>
            ` : ''}
            
            <div class="actions">
              <button class="action-btn like ${tweet.liked ? 'active' : ''}" 
                      onclick="${tweet.liked ? `unlike('${tweet.id}')` : `like('${tweet.id}')`}">
                ${tweet.liked ? '❤️' : '🤍'} ${tweet.liked ? 'Liked' : 'Like'}
              </button>
              <button class="action-btn bookmark ${tweet.bookmarked ? 'active' : ''}"
                      onclick="${tweet.bookmarked ? `removeBookmark('${tweet.id}')` : `bookmark('${tweet.id}')`}">
                ${tweet.bookmarked ? '🔖' : '📑'} ${tweet.bookmarked ? 'Bookmarked' : 'Bookmark'}
              </button>
            </div>
          </div>
          
          ${this._renderReplies(tweet.replies || [])}
        </div>
        
        <script>
          const vscode = acquireVsCodeApi();
          
          function like(tweetId) {
            vscode.postMessage({ type: 'like', tweetId });
          }
          
          function unlike(tweetId) {
            vscode.postMessage({ type: 'unlike', tweetId });
          }
          
          function bookmark(tweetId) {
            vscode.postMessage({ type: 'bookmark', tweetId });
          }
          
          function removeBookmark(tweetId) {
            vscode.postMessage({ type: 'removeBookmark', tweetId });
          }
          
          function viewReply(tweetId) {
            vscode.postMessage({ type: 'viewReply', tweetId });
          }
          
          function openExternal(tweetId) {
            vscode.postMessage({ type: 'openExternal', tweetId });
          }
        </script>
      </body>
      </html>
    `
  }

  private _renderMedia(media: TweetDetail['media']): string {
    if (!media || media.length === 0)
      return ''

    const gridClass = media.length === 1 ? 'single' : media.length === 2 ? 'double' : media.length === 3 ? 'triple' : 'quad'

    const mediaItems = media.map((item) => {
      if (item.type === 'video' || item.type === 'animated_gif') {
        // Find best quality video
        const variants = item.variants?.filter(v => v.content_type === 'video/mp4') || []
        const bestVariant = variants.sort((a, b) => (b.bit_rate || 0) - (a.bit_rate || 0))[0]
        const videoUrl = bestVariant?.url || item.preview_image_url

        return `
          <div class="video-container">
            <video controls ${item.type === 'animated_gif' ? 'autoplay loop muted' : ''} poster="${item.preview_image_url || ''}">
              <source src="${videoUrl}" type="video/mp4">
              Your browser does not support video playback.
            </video>
          </div>
        `
      }
      else {
        return `<img class="media-item" src="${item.url || item.preview_image_url}" alt="${item.alt_text || 'Image'}" />`
      }
    }).join('')

    return `
      <div class="media-container">
        <div class="media-grid ${gridClass}">
          ${mediaItems}
        </div>
      </div>
    `
  }

  private _renderQuotedTweet(tweet: Tweet): string {
    const author = tweet.author
    return `
      <div class="quoted-tweet">
        <div class="tweet-header">
          ${author?.profile_image_url
            ? `<img class="avatar" src="${author.profile_image_url}" alt="${author.name}">`
            : '<div class="avatar"></div>'
          }
          <div class="author-info">
            <div class="author-name">
              ${this._escapeHtml(author?.name || 'Unknown')}
              ${author?.verified ? '<span class="verified-badge">✓</span>' : ''}
            </div>
            <div class="author-username">@${author?.username || 'unknown'}</div>
          </div>
        </div>
        <div class="tweet-text">${this._formatTweetText(tweet.text)}</div>
      </div>
    `
  }

  private _renderReplyTo(tweet: Tweet): string {
    return `
      <div class="reply-to">
        Replying to <a href="javascript:void(0)" onclick="viewReply('${tweet.id}')">@${tweet.author?.username || 'unknown'}</a>
      </div>
    `
  }

  private _renderReplies(replies: Tweet[]): string {
    if (replies.length === 0) {
      return `
        <div class="replies-section">
          <div class="replies-header">Replies</div>
          <div class="no-replies">No replies yet</div>
        </div>
      `
    }

    const replyCards = replies.map((reply) => {
      const author = reply.author
      return `
        <div class="reply-card" onclick="viewReply('${reply.id}')">
          <div class="tweet-header">
            ${author?.profile_image_url
              ? `<img class="avatar" src="${author.profile_image_url}" alt="${author.name}">`
              : '<div class="avatar"></div>'
            }
            <div class="author-info">
              <div class="author-name">
                ${this._escapeHtml(author?.name || 'Unknown')}
                ${author?.verified ? '<span class="verified-badge">✓</span>' : ''}
              </div>
              <div class="author-username">@${author?.username || 'unknown'}</div>
            </div>
          </div>
          <div class="reply-text">${this._formatTweetText(reply.text)}</div>
        </div>
      `
    }).join('')

    return `
      <div class="replies-section">
        <div class="replies-header">Replies (${replies.length})</div>
        ${replyCards}
      </div>
    `
  }

  private _formatTweetText(text: string): string {
    let formatted = this._escapeHtml(text)

    // Convert URLs to links
    formatted = formatted.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank">$1</a>',
    )

    // Convert @mentions to links
    formatted = formatted.replace(
      /@(\w+)/g,
      '<a href="https://twitter.com/$1" target="_blank">@$1</a>',
    )

    // Convert #hashtags to links
    formatted = formatted.replace(
      /#(\w+)/g,
      '<a href="https://twitter.com/hashtag/$1" target="_blank">#$1</a>',
    )

    return formatted
  }

  private _formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  private _escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  public dispose(): void {
    TweetDetailPanel.currentPanel = undefined

    this._panel.dispose()

    while (this._disposables.length) {
      const disposable = this._disposables.pop()
      if (disposable) {
        disposable.dispose()
      }
    }
  }
}
