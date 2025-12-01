import { EventEmitter, ThemeIcon, TreeItem, TreeItemCollapsibleState } from 'vscode'
import type { Event, ProviderResult, TreeDataProvider } from 'vscode'
import type { MediaItem, Tweet } from './types'
import { xWebApi } from './webApi'
import { logger } from '../utils'

export class TweetTreeItem extends TreeItem {
  constructor(
    public readonly tweet: Tweet,
    public readonly viewType: 'timeline' | 'bookmarks' = 'timeline',
  ) {
    super(TweetTreeItem.getLabel(tweet), TreeItemCollapsibleState.None)

    this.id = `${viewType}-${tweet.id}`
    this.description = TweetTreeItem.getDescription(tweet)
    this.tooltip = TweetTreeItem.getTooltip(tweet)
    this.iconPath = this.getIconPath()
    this.contextValue = this.getContextValue()

    // Make it clickable to view details
    this.command = {
      command: 'vscode-feeds.viewTweet',
      title: 'View Tweet',
      arguments: [tweet],
    }
  }

  private static getLabel(tweet: Tweet): string {
    const author = tweet.author?.name || tweet.author?.username || 'Unknown'
    const hasMedia = tweet.media && tweet.media.length > 0
    const mediaIndicator = hasMedia ? ' 📷' : ''
    return `${author}${mediaIndicator}`
  }

  private static getDescription(tweet: Tweet): string {
    // Truncate text for tree view
    const maxLength = 60
    let text = tweet.text.replace(/\n/g, ' ').trim()
    if (text.length > maxLength) {
      text = `${text.substring(0, maxLength)}...`
    }
    return text
  }

  private static getTooltip(tweet: Tweet): string {
    const author = tweet.author
    const metrics = tweet.public_metrics
    const date = new Date(tweet.created_at).toLocaleString()

    let tooltip = `@${author?.username || 'unknown'}\n`
    tooltip += `${tweet.text}\n\n`
    tooltip += `📅 ${date}\n`

    if (metrics) {
      tooltip += `❤️ ${metrics.like_count} | 🔁 ${metrics.retweet_count} | 💬 ${metrics.reply_count}`
    }

    if (tweet.media && tweet.media.length > 0) {
      tooltip += `\n📎 ${tweet.media.length} media attachment(s)`
    }

    return tooltip
  }

  private getIconPath(): ThemeIcon {
    // Show different icons based on content
    if (this.tweet.media && this.tweet.media.length > 0) {
      const hasVideo = this.tweet.media.some((m: MediaItem) => m.type === 'video' || m.type === 'animated_gif')
      if (hasVideo) {
        return new ThemeIcon('play-circle')
      }
      return new ThemeIcon('file-media')
    }
    return new ThemeIcon('comment')
  }

  private getContextValue(): string {
    const liked = this.tweet.liked ? 'liked' : 'unliked'
    const bookmarked = this.tweet.bookmarked ? 'bookmarked' : 'unbookmarked'
    return `tweet-${liked}-${bookmarked}`
  }
}

export class LoadMoreTreeItem extends TreeItem {
  constructor(
    public readonly nextToken: string,
    public readonly viewType: 'timeline' | 'bookmarks',
  ) {
    super('Load More...', TreeItemCollapsibleState.None)

    this.id = `loadmore-${viewType}`
    this.iconPath = new ThemeIcon('arrow-down')
    this.command = {
      command: 'vscode-feeds.loadMore',
      title: 'Load More',
      arguments: [viewType, nextToken],
    }
  }
}

export class TwitterTimelineProvider implements TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: EventEmitter<TreeItem | undefined | null | void> = new EventEmitter()
  readonly onDidChangeTreeData: Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event

  private tweets: Tweet[] = []
  private nextToken?: string
  private loading = false

  constructor(private readonly viewType: 'timeline' | 'bookmarks' = 'timeline') {}

  refresh(): void {
    this.tweets = []
    this.nextToken = undefined
    this._onDidChangeTreeData.fire()
  }

  updateTweet(tweet: Tweet): void {
    const index = this.tweets.findIndex(t => t.id === tweet.id)
    if (index !== -1) {
      this.tweets[index] = tweet
      this._onDidChangeTreeData.fire()
    }
  }

  async loadMore(): Promise<void> {
    if (this.loading || !this.nextToken)
      return
    await this.fetchTweets(this.nextToken)
    this._onDidChangeTreeData.fire()
  }

  private async fetchTweets(_paginationToken?: string): Promise<void> {
    if (this.loading)
      return

    this.loading = true

    try {
      // This uses the old official API - kept for reference
      throw new Error('TwitterTimelineProvider is deprecated, use XTimelineProvider instead')
    }
    catch (error) {
      logger.error(`Failed to fetch ${this.viewType}:`, error)
      throw error
    }
    finally {
      this.loading = false
    }
  }

  getTreeItem(element: TreeItem): TreeItem {
    return element
  }

  async getChildren(_element?: TreeItem): Promise<TreeItem[]> {
    return [new TreeItem('Please use XTimelineProvider instead')]
  }

  getParent(_element: TreeItem): ProviderResult<TreeItem> {
    return null
  }
}

// New provider using X Web API
export class XTimelineProvider implements TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: EventEmitter<TreeItem | undefined | null | void> = new EventEmitter()
  readonly onDidChangeTreeData: Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event

  private tweets: Tweet[] = []
  private cursor?: string
  private loading = false
  private timelineType: 'forYou' | 'following' = 'forYou'

  constructor(private readonly viewType: 'timeline' | 'bookmarks' = 'timeline') {}

  refresh(): void {
    this.tweets = []
    this.cursor = undefined
    this._onDidChangeTreeData.fire()
  }

  setTimelineType(type: 'forYou' | 'following'): void {
    if (this.timelineType !== type) {
      this.timelineType = type
      this.refresh()
    }
  }

  getTimelineType(): 'forYou' | 'following' {
    return this.timelineType
  }

  updateTweet(tweet: Tweet): void {
    const index = this.tweets.findIndex(t => t.id === tweet.id)
    if (index !== -1) {
      this.tweets[index] = tweet
      this._onDidChangeTreeData.fire()
    }
  }

  async loadMore(): Promise<void> {
    if (this.loading || !this.cursor)
      return
    await this.fetchTweets(this.cursor)
    this._onDidChangeTreeData.fire()
  }

  private async fetchTweets(cursor?: string): Promise<void> {
    if (this.loading)
      return

    this.loading = true

    try {
      let response: { tweets: Tweet[], cursor?: string }

      if (this.viewType === 'bookmarks') {
        response = await xWebApi.getBookmarks(20, cursor)
      }
      else if (this.timelineType === 'following') {
        response = await xWebApi.getHomeLatestTimeline(20, cursor)
      }
      else {
        response = await xWebApi.getHomeTimeline(20, cursor)
      }

      if (cursor) {
        // Append to existing tweets
        this.tweets = [...this.tweets, ...response.tweets]
      }
      else {
        // Replace tweets
        this.tweets = response.tweets
      }

      this.cursor = response.cursor
    }
    catch (error) {
      logger.error(`Failed to fetch ${this.viewType}:`, error)
      throw error
    }
    finally {
      this.loading = false
    }
  }

  getTreeItem(element: TreeItem): TreeItem {
    return element
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (element) {
      return []
    }

    // Check if authenticated
    if (!xWebApi.isAuthenticated()) {
      const item = new TreeItem('Please authenticate with X (click to setup)')
      item.command = {
        command: 'vscode-feeds.authenticate',
        title: 'Authenticate',
        arguments: [],
      }
      return [item]
    }

    // If no tweets loaded yet, fetch them
    if (this.tweets.length === 0 && !this.loading) {
      try {
        await this.fetchTweets()
      }
      catch (error) {
        return [
          new TreeItem(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`),
        ]
      }
    }

    const items: TreeItem[] = this.tweets.map(tweet => new TweetTreeItem(tweet, this.viewType))

    // Add load more item if there are more tweets
    if (this.cursor) {
      items.push(new LoadMoreTreeItem(this.cursor, this.viewType))
    }

    return items
  }

  getParent(_element: TreeItem): ProviderResult<TreeItem> {
    return null
  }
}
