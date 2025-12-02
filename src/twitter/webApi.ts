import type { MediaItem, TimelineResponse, Tweet, TweetDetail, TwitterUser } from './types'
import { logger } from '../utils'

// X Web GraphQL API endpoints
const X_GRAPHQL_BASE = 'https://x.com/i/api/graphql'
const X_API_BASE = 'https://x.com/i/api'

// GraphQL query IDs (these may change, need to be updated periodically)
// 可以从 X 网页版的网络请求中获取最新的 query ID
const QUERY_IDS = {
  HomeTimeline: 'c-CzHF1LboFilMpsx4ZCrQ',
  HomeLatestTimeline: 'BKB7oi212Fi7kQtCBGE4zA',
  UserTweets: 'q6xj5bs0hapm9309hexA_g',
  TweetDetail: 'xd_EMdYvB9hfZsZ6Idri0w',
  Bookmarks: '2neUNDqrrFzbLui8yallcQ',
  CreateBookmark: 'aoDbu3RHznuiSkQ9aNM67Q',
  DeleteBookmark: 'Wlmlj2-xzyS1GN3a6cj-mQ',
  FavoriteTweet: 'lI07N6Otwv1PhnEgXILM7A',
  UnfavoriteTweet: 'ZYKSe-w7KEslx3JhSIk5LA',
  UserByScreenName: '1VOOyvKkiI3FMmkeDNxM9A',
}

// 默认的 GraphQL 变量和特性
const DEFAULT_FEATURES = {
  rweb_video_screen_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  rweb_tipjar_consumption_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  responsive_web_jetfuel_frame: false,
  responsive_web_grok_share_attachment_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  responsive_web_grok_show_grok_translated_post: false,
  responsive_web_grok_analysis_button_from_backend: false,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_enhance_cards_enabled: false,
}

export interface WebCredentials {
  ct0: string // CSRF token
  authToken: string // auth_token cookie
}

export class XWebApiService {
  private credentials: WebCredentials | null = null
  private userId: string | null = null

  setCredentials(credentials: WebCredentials) {
    this.credentials = credentials
    this.userId = null // 重置缓存的用户ID
  }

  clearCredentials() {
    this.credentials = null
    this.userId = null
  }

  isAuthenticated(): boolean {
    return !!(this.credentials?.ct0 && this.credentials?.authToken)
  }

  private getHeaders(): Record<string, string> {
    if (!this.credentials) {
      throw new Error('Not authenticated')
    }

    return {
      'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
      'Content-Type': 'application/json',
      'Cookie': `auth_token=${this.credentials.authToken}; ct0=${this.credentials.ct0}`,
      'X-Csrf-Token': this.credentials.ct0,
      'X-Twitter-Auth-Type': 'OAuth2Session',
      'X-Twitter-Active-User': 'yes',
      'X-Twitter-Client-Language': 'en',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://x.com/home',
      'Origin': 'https://x.com',
    }
  }

  private async graphqlRequest<T>(
    queryId: string,
    operationName: string,
    variables: Record<string, unknown>,
    method: 'GET' | 'POST' = 'GET',
  ): Promise<T> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated. Please configure your X cookies.')
    }

    const features = JSON.stringify(DEFAULT_FEATURES)
    const variablesStr = JSON.stringify(variables)

    let url: string
    let options: RequestInit

    if (method === 'GET') {
      const params = new URLSearchParams({
        variables: variablesStr,
        features: features,
      })
      url = `${X_GRAPHQL_BASE}/${queryId}/${operationName}?${params}`
      options = {
        method: 'GET',
        headers: this.getHeaders(),
      }
    }
    else {
      url = `${X_GRAPHQL_BASE}/${queryId}/${operationName}`
      options = {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          variables,
          features: DEFAULT_FEATURES,
          queryId,
        }),
      }
    }

    logger.info(`X Web API Request: ${method} ${operationName}`)

    try {
      const response = await fetch(url, options)

      logger.info(`Response status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text()
        logger.error(`X Web API Error: ${response.status}`, errorText)

        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed. Please check your cookies.')
        }
        if (response.status === 404) {
          throw new Error(`API endpoint not found (404). The query ID may be outdated.`)
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json() as T
      logger.info(`Response data keys: ${Object.keys(data as object).join(', ')}`)
      return data
    }
    catch (error) {
      logger.error('X Web API Request Failed:', error)
      throw error
    }
  }
  /**
   * 获取主页时间线（For You）
   * @param count 获取数量
   * @param cursor 分页游标
   * @param seenTweetIds 已读推文ID列表，用于过滤已显示的推文
   */
  async getHomeTimeline(count: number = 20, cursor?: string, seenTweetIds?: string[]): Promise<{ tweets: Tweet[], cursor?: string }> {
    const variables: Record<string, unknown> = {
      count,
      includePromotedContent: false,
      latestControlAvailable: true,
      // 有 cursor 时使用 'ptr' 表示刷新，否则使用 'launch' 表示首次加载
      requestContext: cursor ? 'ptr' : 'launch',
      withCommunity: true,
    }

    if (cursor) {
      variables.cursor = cursor
    }

    // 传递已读推文ID，Twitter会过滤这些推文
    if (seenTweetIds && seenTweetIds.length > 0) {
      variables.seenTweetIds = seenTweetIds
    }

    const data = await this.graphqlRequest<{
      data: {
        home: {
          home_timeline_urt: {
            instructions: Array<{
              type: string
              entries?: Array<{
                entryId: string
                sortIndex: string
                content: {
                  entryType: string
                  itemContent?: {
                    tweet_results?: {
                      result: RawTweetResult
                    }
                  }
                  value?: string
                }
              }>
            }>
          }
        }
      }
    }>(QUERY_IDS.HomeTimeline, 'HomeTimeline', variables)

    return this.parseTimelineResponse(data.data.home.home_timeline_urt)
  }

  /**
   * 获取主页时间线（Following / Latest）
   * @param count 获取数量
   * @param cursor 分页游标
   * @param seenTweetIds 已读推文ID列表，用于过滤已显示的推文
   */
  async getHomeLatestTimeline(count: number = 20, cursor?: string, seenTweetIds?: string[]): Promise<{ tweets: Tweet[], cursor?: string }> {
    const variables: Record<string, unknown> = {
      count,
      includePromotedContent: false,
      latestControlAvailable: true,
      requestContext: 'launch',
    }

    if (cursor) {
      variables.cursor = cursor
    }

    // 传递已读推文ID，Twitter会过滤这些推文
    if (seenTweetIds && seenTweetIds.length > 0) {
      variables.seenTweetIds = seenTweetIds
    }

    const data = await this.graphqlRequest<{
      data: {
        home: {
          home_timeline_urt: {
            instructions: Array<{
              type: string
              entries?: Array<{
                entryId: string
                sortIndex: string
                content: {
                  entryType: string
                  itemContent?: {
                    tweet_results?: {
                      result: RawTweetResult
                    }
                  }
                  value?: string
                }
              }>
            }>
          }
        }
      }
    }>(QUERY_IDS.HomeLatestTimeline, 'HomeLatestTimeline', variables, 'POST')

    return this.parseTimelineResponse(data.data.home.home_timeline_urt)
  }

  /**
   * 获取推文详情
   */
  async getTweetDetail(tweetId: string): Promise<TweetDetail> {
    const variables = {
      focalTweetId: tweetId,
      referrer: 'home',
      with_rux_injections: false,
      rankingMode: 'Relevance',
      includePromotedContent: false,
      withCommunity: true,
      withQuickPromoteEligibilityTweetFields: true,
      withBirdwatchNotes: true,
      withVoice: true,
    }

    const data = await this.graphqlRequest<{
      data: {
        tweetResult?: {
          result: RawTweetResult
        }
        threaded_conversation_with_injections_v2?: {
          instructions: Array<{
            type: string
            entries?: Array<{
              entryId: string
              sortIndex?: string
              content: {
                entryType?: string
                itemContent?: {
                  tweet_results?: {
                    result: RawTweetResult
                  }
                }
                items?: Array<{
                  item: {
                    itemContent: {
                      tweet_results?: {
                        result: RawTweetResult
                      }
                    }
                  }
                }>
              }
            }>
          }>
        }
      }
    }>(QUERY_IDS.TweetDetail, 'TweetDetail', variables)

    logger.info('TweetDetail response keys:', Object.keys(data.data || {}))

    let mainTweet: Tweet | null = null
    const replies: Tweet[] = []

    // 解析回复和主推文
    const instructions = data.data.threaded_conversation_with_injections_v2?.instructions || []
    for (const instruction of instructions) {
      if (!instruction.entries)
        continue

      for (const entry of instruction.entries) {
        // 查找焦点推文（主推文）
        if (entry.entryId.includes(tweetId) || entry.entryId.startsWith('tweet-')) {
          if (entry.content.itemContent?.tweet_results?.result) {
            const tweet = this.parseTweet(entry.content.itemContent.tweet_results.result)
            if (tweet) {
              if (tweet.id === tweetId) {
                mainTweet = tweet
              }
              else {
                replies.push(tweet)
              }
            }
          }
        }

        // 处理对话线程
        if (entry.content.items) {
          for (const item of entry.content.items) {
            if (item.item?.itemContent?.tweet_results?.result) {
              const tweet = this.parseTweet(item.item.itemContent.tweet_results.result)
              if (tweet) {
                if (tweet.id === tweetId) {
                  mainTweet = tweet
                }
                else {
                  replies.push(tweet)
                }
              }
            }
          }
        }
      }
    }

    // 如果通过 tweetResult 获取主推文
    if (!mainTweet && data.data.tweetResult?.result) {
      mainTweet = this.parseTweet(data.data.tweetResult.result)
    }

    if (!mainTweet) {
      throw new Error('Failed to parse tweet detail')
    }

    return {
      ...mainTweet,
      replies,
    }
  }

  /**
   * 获取收藏
   */
  async getBookmarks(count: number = 20, cursor?: string): Promise<{ tweets: Tweet[], cursor?: string }> {
    const variables: Record<string, unknown> = {
      count,
      includePromotedContent: false,
    }

    if (cursor) {
      variables.cursor = cursor
    }

    const data = await this.graphqlRequest<{
      data: {
        bookmark_timeline_v2: {
          timeline: {
            instructions: Array<{
              type: string
              entries?: Array<{
                entryId: string
                content: {
                  itemContent?: {
                    tweet_results?: {
                      result: RawTweetResult
                    }
                  }
                  value?: string
                }
              }>
            }>
          }
        }
      }
    }>(QUERY_IDS.Bookmarks, 'Bookmarks', variables)

    const response = this.parseTimelineResponse(data.data.bookmark_timeline_v2.timeline)
    // 标记为已收藏
    response.tweets = response.tweets.map(t => ({ ...t, bookmarked: true }))
    return response
  }

  /**
   * 点赞推文
   */
  async likeTweet(tweetId: string): Promise<boolean> {
    await this.graphqlRequest(
      QUERY_IDS.FavoriteTweet,
      'FavoriteTweet',
      { tweet_id: tweetId },
      'POST',
    )
    return true
  }

  /**
   * 取消点赞
   */
  async unlikeTweet(tweetId: string): Promise<boolean> {
    await this.graphqlRequest(
      QUERY_IDS.UnfavoriteTweet,
      'UnfavoriteTweet',
      { tweet_id: tweetId },
      'POST',
    )
    return true
  }

  /**
   * 收藏推文
   */
  async bookmarkTweet(tweetId: string): Promise<boolean> {
    await this.graphqlRequest(
      QUERY_IDS.CreateBookmark,
      'CreateBookmark',
      { tweet_id: tweetId },
      'POST',
    )
    return true
  }

  /**
   * 取消收藏
   */
  async removeBookmark(tweetId: string): Promise<boolean> {
    await this.graphqlRequest(
      QUERY_IDS.DeleteBookmark,
      'DeleteBookmark',
      { tweet_id: tweetId },
      'POST',
    )
    return true
  }

  /**
   * 解析时间线响应
   */
  private parseTimelineResponse(timeline: {
    instructions: Array<{
      type: string
      entries?: Array<{
        entryId: string
        sortIndex?: string
        content: {
          entryType?: string
          itemContent?: {
            tweet_results?: {
              result: RawTweetResult
            }
          }
          value?: string
        }
      }>
    }>
  }): { tweets: Tweet[], cursor?: string } {
    const tweets: Tweet[] = []
    let bottomCursor: string | undefined

    for (const instruction of timeline.instructions) {
      if (!instruction.entries)
        continue

      for (const entry of instruction.entries) {
        // 获取游标
        if (entry.entryId.startsWith('cursor-bottom')) {
          bottomCursor = entry.content.value
          continue
        }
        if (entry.entryId.startsWith('cursor-top')) {
          continue
        }

        // 解析推文
        if (entry.content.itemContent?.tweet_results?.result) {
          const tweet = this.parseTweet(entry.content.itemContent.tweet_results.result)
          if (tweet) {
            tweets.push(tweet)
          }
        }
      }
    }

    return {
      tweets,
      cursor: bottomCursor,
    }
  }

  /**
   * 解析单条推文
   */
  private parseTweet(result: RawTweetResult): Tweet {
    // 处理不同类型的推文结果
    let tweetData = result
    if (result.__typename === 'TweetWithVisibilityResults') {
      tweetData = result.tweet as RawTweetResult
    }

    const legacy = tweetData.legacy
    const user = tweetData.core?.user_results?.result?.legacy

    const tweet: Tweet = {
      id: legacy.id_str,
      text: legacy.full_text || legacy.text || '',
      author_id: legacy.user_id_str,
      created_at: legacy.created_at,
      public_metrics: {
        retweet_count: legacy.retweet_count || 0,
        reply_count: legacy.reply_count || 0,
        like_count: legacy.favorite_count || 0,
        quote_count: legacy.quote_count || 0,
      },
      liked: legacy.favorited,
      bookmarked: legacy.bookmarked,
    }

    // 解析用户信息
    if (user) {
      tweet.author = {
        id: user.id_str || tweetData.core?.user_results?.result?.rest_id || 'unknown',
        name: user.name,
        username: user.screen_name,
        profile_image_url: user.profile_image_url_https?.replace('_normal', '_400x400'),
        verified: user.verified || tweetData.core?.user_results?.result?.is_blue_verified,
        description: user.description,
      }
    }

    // 解析媒体
    if (legacy.extended_entities?.media) {
      tweet.media = legacy.extended_entities.media.map((m: RawMedia): MediaItem => ({
        media_key: m.id_str,
        type: m.type === 'photo' ? 'photo' : m.type === 'animated_gif' ? 'animated_gif' : 'video',
        url: m.media_url_https,
        preview_image_url: m.media_url_https,
        width: m.original_info?.width,
        height: m.original_info?.height,
        variants: m.video_info?.variants?.map((v: { bitrate?: number, content_type: string, url: string }) => ({
          bit_rate: v.bitrate,
          content_type: v.content_type,
          url: v.url,
        })),
        alt_text: m.ext_alt_text,
      }))
    }

    return tweet
  }
}

// Raw API 类型定义
interface RawTweetResult {
  __typename?: string
  rest_id?: string
  tweet?: RawTweetResult
  core?: {
    user_results?: {
      result?: {
        rest_id: string
        is_blue_verified?: boolean
        legacy: {
          id_str: string
          name: string
          screen_name: string
          profile_image_url_https: string
          verified: boolean
          description: string
        }
      }
    }
  }
  legacy: {
    id_str: string
    user_id_str: string
    full_text?: string
    text?: string
    created_at: string
    retweet_count: number
    reply_count: number
    favorite_count: number
    quote_count: number
    favorited?: boolean
    bookmarked?: boolean
    extended_entities?: {
      media: RawMedia[]
    }
  }
}

interface RawMedia {
  id_str: string
  type: string
  media_url_https: string
  original_info?: {
    width: number
    height: number
  }
  video_info?: {
    variants: Array<{
      bitrate?: number
      content_type: string
      url: string
    }>
  }
  ext_alt_text?: string
}

// 单例
export const xWebApi = new XWebApiService()
