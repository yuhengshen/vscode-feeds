import { defineExtension, useCommand, watchEffect } from 'reactive-vscode'
import { commands, env, Uri, window } from 'vscode'
import {
  ct0,
  authToken,
} from './configs'
import { logger } from './utils'
import {
  xWebApi,
  getTweetDetailPanel,
} from './twitter'
import type { Tweet } from './twitter'
import { useTwitterTimelineView, useTwitterBookmarksView } from './twitter/useTimelineView'

// Tweet tree item interface for command arguments
interface TweetTreeItemArg {
  tweet: Tweet
}

export = defineExtension(() => {
  logger.info('VS Code Feeds Extension Activated')

  // Initialize X Web API with cookies from settings
  const updateCredentials = () => {
    if (ct0.value && authToken.value) {
      xWebApi.setCredentials({
        ct0: ct0.value,
        authToken: authToken.value,
      })
      commands.executeCommand('setContext', 'vscode-feeds.isAuthenticated', true)
      logger.info('Using X Web Cookie credentials')
      return
    }
    xWebApi.clearCredentials()
    commands.executeCommand('setContext', 'vscode-feeds.isAuthenticated', false)
  }

  // Watch for credential changes
  watchEffect(() => {
    updateCredentials()
  })

  // Create reactive tree views
  const timeline = useTwitterTimelineView()
  const bookmarks = useTwitterBookmarksView()

  // Helper to update tweet in both views
  const updateTweetInViews = (tweet: Tweet) => {
    timeline.updateTweet(tweet)
    bookmarks.updateTweet(tweet)
  }

  // Generic tweet action handler
  const handleTweetAction = async (
    item: TweetTreeItemArg | undefined,
    action: (tweetId: string) => Promise<unknown>,
    update: (tweet: Tweet) => void,
    successMsg: string,
    errorMsg: string
  ) => {
    if (!item?.tweet) return
    try {
      await action(item.tweet.id)
      update(item.tweet)
      updateTweetInViews(item.tweet)
      window.showInformationMessage(successMsg)
    }
    catch (error) {
      window.showErrorMessage(`${errorMsg}: ${error}`)
    }
  }

  // Register commands
  useCommand('vscode-feeds.refreshTimeline', () => {
    logger.info('Refreshing timeline...')
    timeline.refresh()
    bookmarks.refresh()
    window.showInformationMessage('Timeline refreshed')
  })

  useCommand('vscode-feeds.viewTweet', async (tweet: Tweet) => {
    if (!tweet) {
      window.showErrorMessage('No tweet selected')
      return
    }
    logger.info(`Viewing tweet: ${tweet.id}`)
    await getTweetDetailPanel().show(tweet)
  })

  useCommand('vscode-feeds.likeTweet', (item: TweetTreeItemArg) =>
    handleTweetAction(item, xWebApi.likeTweet.bind(xWebApi), t => t.liked = true, 'Tweet liked!', 'Failed to like tweet')
  )

  useCommand('vscode-feeds.unlikeTweet', (item: TweetTreeItemArg) =>
    handleTweetAction(item, xWebApi.unlikeTweet.bind(xWebApi), t => t.liked = false, 'Tweet unliked', 'Failed to unlike tweet')
  )

  useCommand('vscode-feeds.bookmarkTweet', (item: TweetTreeItemArg) =>
    handleTweetAction(item, xWebApi.bookmarkTweet.bind(xWebApi), t => t.bookmarked = true, 'Tweet bookmarked!', 'Failed to bookmark tweet')
  )

  useCommand('vscode-feeds.removeBookmark', (item: TweetTreeItemArg) =>
    handleTweetAction(item, xWebApi.removeBookmark.bind(xWebApi), t => t.bookmarked = false, 'Bookmark removed', 'Failed to remove bookmark')
  )

  useCommand('vscode-feeds.openInBrowser', (item: TweetTreeItemArg) => {
    if (!item?.tweet) return
    env.openExternal(Uri.parse(`https://x.com/i/status/${item.tweet.id}`))
  })

  useCommand('vscode-feeds.switchToForYou', () => {
    timeline.setTimelineType('forYou')
    window.showInformationMessage('Switched to For You timeline')
  })

  useCommand('vscode-feeds.switchToFollowing', () => {
    timeline.setTimelineType('following')
    window.showInformationMessage('Switched to Following timeline')
  })

  useCommand('vscode-feeds.toggleTimelineType', async () => {
    const current = timeline.getTimelineType()
    const items = [
      { label: '$(star) For You', description: 'Recommended tweets', value: 'forYou' as const },
      { label: '$(people) Following', description: 'Tweets from people you follow', value: 'following' as const },
    ]

    const selected = await window.showQuickPick(items, {
      placeHolder: `Current: ${current === 'forYou' ? 'For You' : 'Following'}`,
      title: 'Select Timeline Type',
    })

    if (selected) {
      timeline.setTimelineType(selected.value)
    }
  })

  useCommand('vscode-feeds.loadMore', async (viewType: 'timeline' | 'bookmarks', _nextToken: string) => {
    try {
      if (viewType === 'timeline') {
        await timeline.loadMore()
      }
      else {
        await bookmarks.loadMore()
      }
    }
    catch (error) {
      window.showErrorMessage(`Failed to load more: ${error}`)
    }
  })

  useCommand('vscode-feeds.authenticate', async () => {
    // 引导用户设置 cookies
    const result = await window.showInformationMessage(
      'To authenticate, you need to get cookies from X.com.\n\n' +
      '1. Open X.com in your browser and login\n' +
      '2. Open DevTools (F12) > Application > Cookies\n' +
      '3. Copy the values of "ct0" and "auth_token"',
      'Open Settings',
      'Open X.com',
    )

    if (result === 'Open Settings') {
      commands.executeCommand('workbench.action.openSettings', 'vscode-feeds.twitter')
    }
    else if (result === 'Open X.com') {
      env.openExternal(Uri.parse('https://x.com'))
    }
  })

  useCommand('vscode-feeds.logout', async () => {
    // 清除配置
    const config = await import('vscode').then(v => v.workspace.getConfiguration('vscode-feeds'))
    await config.update('twitter.ct0', '', true)
    await config.update('twitter.authToken', '', true)

    xWebApi.clearCredentials()
    commands.executeCommand('setContext', 'vscode-feeds.isAuthenticated', false)
    timeline.refresh()
    bookmarks.refresh()
    window.showInformationMessage('Logged out from X')
  })

  logger.info('All commands registered')
})
