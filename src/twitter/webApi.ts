import type { MediaItem, Tweet, TweetDetail } from "./types";
import { logger } from "../utils";

// X Web GraphQL API endpoints
const X_GRAPHQL_BASE = "https://x.com/i/api/graphql";

// GraphQL query IDs (these may change, need to be updated periodically)
// 可以从 X 网页版的网络请求中获取最新的 query ID
const QUERY_IDS = {
  HomeTimeline: "c-CzHF1LboFilMpsx4ZCrQ",
  HomeLatestTimeline: "BKB7oi212Fi7kQtCBGE4zA",
  UserTweets: "q6xj5bs0hapm9309hexA_g",
  TweetDetail: "xd_EMdYvB9hfZsZ6Idri0w",
  FavoriteTweet: "lI07N6Otwv1PhnEgXILM7A",
  UnfavoriteTweet: "ZYKSe-w7KEslx3JhSIk5LA",
  UserByScreenName: "1VOOyvKkiI3FMmkeDNxM9A",
  Likes: "I9w8GfWYSc6gIt4k5CVfSg",
};

// 默认的 GraphQL 变量和特性
const DEFAULT_FEATURES = {
  rweb_video_screen_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_profile_redirect_enabled: false,
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
  responsive_web_jetfuel_frame: true,
  responsive_web_grok_share_attachment_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  responsive_web_grok_show_grok_translated_post: false,
  responsive_web_grok_analysis_button_from_backend: true,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_grok_community_note_auto_translation_is_enabled: false,
  responsive_web_enhance_cards_enabled: false,
};

export interface WebCredentials {
  ct0: string; // CSRF token
  authToken: string; // auth_token cookie
  twid?: string; // twid cookie containing user ID
}

export class XWebApiService {
  private credentials: WebCredentials | null = null;
  private userId: string | null = null;

  setCredentials(credentials: WebCredentials) {
    this.credentials = credentials;
    // 从 twid 中解析用户 ID
    if (credentials.twid) {
      const twid = credentials.twid;
      // twid 格式: u%3D{userId} 或 u={userId} 或直接是 userId
      if (twid.includes("u%3D")) {
        this.userId = twid.split("u%3D")[1];
      } else if (twid.includes("u=")) {
        this.userId = twid.split("u=")[1];
      } else {
        this.userId = twid;
      }
    } else {
      this.userId = null;
    }
  }

  clearCredentials() {
    this.credentials = null;
    this.userId = null;
  }

  isAuthenticated(): boolean {
    return !!(this.credentials?.ct0 && this.credentials?.authToken);
  }

  private getHeaders(): Record<string, string> {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    let cookieStr = `auth_token=${this.credentials.authToken}; ct0=${this.credentials.ct0}`;
    if (this.credentials.twid) {
      cookieStr += `; twid=${this.credentials.twid}`;
    }

    return {
      Authorization:
        "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
      "Content-Type": "application/json",
      Cookie: cookieStr,
      "X-Csrf-Token": this.credentials.ct0,
      "X-Twitter-Auth-Type": "OAuth2Session",
      "X-Twitter-Active-User": "yes",
      "X-Twitter-Client-Language": "en",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://x.com/home",
      Origin: "https://x.com",
    };
  }

  private async graphqlRequest<T>(
    queryId: string,
    operationName: string,
    variables: Record<string, unknown>,
    method: "GET" | "POST" = "GET",
    skipFeatures = false,
  ): Promise<T> {
    if (!this.isAuthenticated()) {
      throw new Error("Not authenticated. Please configure your X cookies.");
    }

    const features = JSON.stringify(DEFAULT_FEATURES);
    const variablesStr = JSON.stringify(variables);

    let url: string;
    let options: RequestInit;

    if (method === "GET") {
      const params = new URLSearchParams({
        variables: variablesStr,
        features: features,
      });
      url = `${X_GRAPHQL_BASE}/${queryId}/${operationName}?${params}`;
      options = {
        method: "GET",
        headers: this.getHeaders(),
      };
    } else {
      url = `${X_GRAPHQL_BASE}/${queryId}/${operationName}`;
      const body: Record<string, unknown> = { variables, queryId };
      if (!skipFeatures) {
        body.features = DEFAULT_FEATURES;
      }
      options = {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      };
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`X Web API Error: ${response.status}`, errorText);

        if (response.status === 401 || response.status === 403) {
          throw new Error("Authentication failed. Please check your cookies.");
        }
        if (response.status === 404) {
          throw new Error(`API endpoint not found (404). The query ID may be outdated.`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as T;
      return data;
    } catch (error) {
      logger.error("X Web API Request Failed:", error);
      throw error;
    }
  }
  /**
   * 获取主页时间线（For You）
   * @param count 获取数量
   * @param cursor 分页游标
   * @param seenTweetIds 已读推文ID列表，用于过滤已显示的推文
   */
  async getHomeTimeline(
    count: number = 20,
    cursor?: string,
    seenTweetIds?: string[],
  ): Promise<{ tweets: Tweet[]; cursor?: string }> {
    const variables: Record<string, unknown> = {
      count,
      includePromotedContent: false,
      latestControlAvailable: true,
      // 有 cursor 时使用 'ptr' 表示刷新，否则使用 'launch' 表示首次加载
      requestContext: cursor ? "ptr" : "launch",
      withCommunity: true,
    };

    if (cursor) {
      variables.cursor = cursor;
    }

    // 传递已读推文ID，Twitter会过滤这些推文
    if (seenTweetIds && seenTweetIds.length > 0) {
      variables.seenTweetIds = seenTweetIds;
    }

    const data = await this.graphqlRequest<{
      data: {
        home: {
          home_timeline_urt: {
            instructions: Array<{
              type: string;
              entries?: Array<{
                entryId: string;
                sortIndex: string;
                content: {
                  entryType: string;
                  itemContent?: {
                    tweet_results?: {
                      result: RawTweetResult;
                    };
                  };
                  value?: string;
                };
              }>;
            }>;
          };
        };
      };
    }>(QUERY_IDS.HomeTimeline, "HomeTimeline", variables);

    return this.parseTimelineResponse(data.data.home.home_timeline_urt);
  }

  /**
   * 获取主页时间线（Following / Latest）
   * @param count 获取数量
   * @param cursor 分页游标
   * @param seenTweetIds 已读推文ID列表，用于过滤已显示的推文
   */
  async getHomeLatestTimeline(
    count: number = 20,
    cursor?: string,
    seenTweetIds?: string[],
  ): Promise<{ tweets: Tweet[]; cursor?: string }> {
    const variables: Record<string, unknown> = {
      count,
      includePromotedContent: false,
      latestControlAvailable: true,
      requestContext: "launch",
    };

    if (cursor) {
      variables.cursor = cursor;
    }

    // 传递已读推文ID，Twitter会过滤这些推文
    if (seenTweetIds && seenTweetIds.length > 0) {
      variables.seenTweetIds = seenTweetIds;
    }

    const data = await this.graphqlRequest<{
      data: {
        home: {
          home_timeline_urt: {
            instructions: Array<{
              type: string;
              entries?: Array<{
                entryId: string;
                sortIndex: string;
                content: {
                  entryType: string;
                  itemContent?: {
                    tweet_results?: {
                      result: RawTweetResult;
                    };
                  };
                  value?: string;
                };
              }>;
            }>;
          };
        };
      };
    }>(QUERY_IDS.HomeLatestTimeline, "HomeLatestTimeline", variables, "POST");

    return this.parseTimelineResponse(data.data.home.home_timeline_urt);
  }

  /**
   * 获取推文详情
   */
  async getTweetDetail(tweetId: string): Promise<TweetDetail> {
    const variables = {
      focalTweetId: tweetId,
      referrer: "home",
      with_rux_injections: false,
      rankingMode: "Relevance",
      includePromotedContent: false,
      withCommunity: true,
      withQuickPromoteEligibilityTweetFields: true,
      withBirdwatchNotes: true,
      withVoice: true,
    };

    const data = await this.graphqlRequest<{
      data: {
        tweetResult?: {
          result: RawTweetResult;
        };
        threaded_conversation_with_injections_v2?: {
          instructions: Array<{
            type: string;
            entries?: Array<{
              entryId: string;
              sortIndex?: string;
              content: {
                entryType?: string;
                itemContent?: {
                  tweet_results?: {
                    result: RawTweetResult;
                  };
                };
                items?: Array<{
                  item: {
                    itemContent: {
                      tweet_results?: {
                        result: RawTweetResult;
                      };
                    };
                  };
                }>;
                value?: string; // cursor value
              };
            }>;
          }>;
        };
      };
    }>(QUERY_IDS.TweetDetail, "TweetDetail", variables);

    logger.info("TweetDetail response keys:", Object.keys(data.data || {}));

    let mainTweet: Tweet | null = null;
    let replyToTweet: Tweet | null = null;
    const replies: Tweet[] = [];
    let repliesCursor: string | undefined;

    // 解析回复和主推文
    const instructions = data.data.threaded_conversation_with_injections_v2?.instructions || [];
    for (const instruction of instructions) {
      if (!instruction.entries) continue;

      for (const entry of instruction.entries) {
        // 跳过"发现更多"推荐内容（不是真正的回复）
        // 这些条目通常是 tweetdetailrelatedtweets-xxx、who-to-follow-xxx 等
        if (
          entry.entryId.startsWith("tweetdetailrelatedtweets-") ||
          entry.entryId.startsWith("who-to-follow")
        ) {
          logger.info("Skipping non-reply entry:", entry.entryId);
          continue;
        }

        // 获取加载更多回复的游标（可能是 cursor-showmorethreads- 或 cursor-bottom-）
        if (
          entry.entryId.startsWith("cursor-showmorethreads-") ||
          entry.entryId.startsWith("cursor-bottom-")
        ) {
          repliesCursor = entry.content.value;
          continue;
        }

        // 查找焦点推文（主推文）
        if (entry.entryId.includes(tweetId) || entry.entryId.startsWith("tweet-")) {
          if (entry.content.itemContent?.tweet_results?.result) {
            const tweet = this.parseTweet(entry.content.itemContent.tweet_results.result);
            if (tweet) {
              if (tweet.id === tweetId) {
                mainTweet = tweet;
              } else {
                replies.push(tweet);
              }
            }
          }
        }

        // 处理对话线程
        if (entry.entryId.startsWith("conversationthread-") && entry.content.items) {
          // 收集线程中的所有推文
          const threadTweets: Tweet[] = [];
          for (const item of entry.content.items) {
            if (item.item?.itemContent?.tweet_results?.result) {
              const tweet = this.parseTweet(item.item.itemContent.tweet_results.result);
              if (tweet) {
                threadTweets.push(tweet);
              }
            }
          }

          // 在线程中查找主推文及其位置
          const mainTweetIndex = threadTweets.findIndex((t) => t.id === tweetId);
          if (mainTweetIndex !== -1) {
            mainTweet = threadTweets[mainTweetIndex];
            // 主推文之前的是被回复的推文链
            if (mainTweetIndex > 0) {
              // 取最后一条作为直接回复的推文
              replyToTweet = threadTweets[mainTweetIndex - 1];
            }
            // 主推文之后的是回复
            for (let i = mainTweetIndex + 1; i < threadTweets.length; i++) {
              replies.push(threadTweets[i]);
            }
          } else {
            // 如果线程中没有主推文，则全部视为回复
            replies.push(...threadTweets);
          }
        }
      }
    }

    // 如果通过 tweetResult 获取主推文
    if (!mainTweet && data.data.tweetResult?.result) {
      mainTweet = this.parseTweet(data.data.tweetResult.result);
    }

    if (!mainTweet) {
      throw new Error("Failed to parse tweet detail");
    }

    return {
      ...mainTweet,
      replies,
      reply_to_tweet: replyToTweet || undefined,
      repliesCursor,
      hasMoreReplies: !!repliesCursor,
    };
  }

  /**
   * 加载更多回复
   */
  async getMoreReplies(
    tweetId: string,
    cursor: string,
  ): Promise<{ replies: Tweet[]; cursor?: string }> {
    const variables = {
      focalTweetId: tweetId,
      cursor,
      referrer: "tweet",
      with_rux_injections: false,
      rankingMode: "Relevance",
      includePromotedContent: false,
      withCommunity: true,
      withQuickPromoteEligibilityTweetFields: true,
      withBirdwatchNotes: true,
      withVoice: true,
    };

    const data = await this.graphqlRequest<{
      data: {
        threaded_conversation_with_injections_v2?: {
          instructions: Array<{
            type: string;
            entries?: Array<{
              entryId: string;
              content: {
                entryType?: string;
                itemContent?: {
                  tweet_results?: {
                    result: RawTweetResult;
                  };
                  value?: string;
                };
                items?: Array<{
                  item: {
                    itemContent: {
                      tweet_results?: {
                        result: RawTweetResult;
                      };
                    };
                  };
                }>;
                value?: string;
              };
            }>;
            moduleItems?: Array<{
              item: {
                itemContent: {
                  tweet_results?: {
                    result: RawTweetResult;
                  };
                };
              };
            }>;
          }>;
        };
      };
    }>(QUERY_IDS.TweetDetail, "TweetDetail", variables);

    const replies: Tweet[] = [];
    let nextCursor: string | undefined;

    const instructions = data.data.threaded_conversation_with_injections_v2?.instructions || [];
    for (const instruction of instructions) {
      // 处理 moduleItems（分页加载返回的格式）
      if (instruction.type === "TimelineAddToModule" && instruction.moduleItems) {
        for (const item of instruction.moduleItems) {
          if (item.item?.itemContent?.tweet_results?.result) {
            const tweet = this.parseTweet(item.item.itemContent.tweet_results.result);
            if (tweet && tweet.id !== tweetId) {
              replies.push(tweet);
            }
          }
        }
      }

      if (!instruction.entries) continue;

      for (const entry of instruction.entries) {
        // 跳过推荐内容
        if (
          entry.entryId.startsWith("tweetdetailrelatedtweets-") ||
          entry.entryId.startsWith("who-to-follow")
        ) {
          continue;
        }

        // 获取下一页游标
        if (
          entry.entryId.startsWith("cursor-showmorethreads-") ||
          entry.entryId.startsWith("cursor-bottom-")
        ) {
          nextCursor = entry.content.value;
          continue;
        }

        // 解析回复
        if (entry.entryId.startsWith("conversationthread-") && entry.content.items) {
          for (const item of entry.content.items) {
            if (item.item?.itemContent?.tweet_results?.result) {
              const tweet = this.parseTweet(item.item.itemContent.tweet_results.result);
              if (tweet && tweet.id !== tweetId) {
                replies.push(tweet);
              }
            }
          }
        }
      }
    }

    // 如果没有加载到新回复，说明已经到底了，不返回 cursor
    return { replies, cursor: replies.length > 0 ? nextCursor : undefined };
  }

  /**
   * 点赞推文
   */
  async likeTweet(tweetId: string): Promise<boolean> {
    await this.graphqlRequest(
      QUERY_IDS.FavoriteTweet,
      "FavoriteTweet",
      { tweet_id: tweetId },
      "POST",
    );
    return true;
  }

  /**
   * 取消点赞
   */
  async unlikeTweet(tweetId: string): Promise<boolean> {
    await this.graphqlRequest(
      QUERY_IDS.UnfavoriteTweet,
      "UnfavoriteTweet",
      { tweet_id: tweetId },
      "POST",
    );
    return true;
  }

  /**
   * 获取当前用户的点赞列表
   * @param count 获取数量
   * @param cursor 分页游标
   */
  async getLikes(
    count: number = 20,
    cursor?: string,
  ): Promise<{ tweets: Tweet[]; cursor?: string }> {
    // 先获取当前登录用户的 ID
    const userId = this.userId;
    if (!userId) {
      throw new Error("Failed to get current user ID");
    }

    const variables: Record<string, unknown> = {
      userId,
      count,
      includePromotedContent: false,
      withClientEventToken: false,
      withBirdwatchNotes: false,
      withVoice: true,
    };

    if (cursor) {
      variables.cursor = cursor;
    }

    const data = await this.graphqlRequest<LikesApiResponse>(QUERY_IDS.Likes, "Likes", variables);
    // Likes API 响应结构: data.user.result.timeline.timeline
    const timeline = data?.data?.user?.result?.timeline?.timeline;
    if (!timeline) {
      throw new Error("Unexpected Likes API response: timeline is undefined");
    }
    return this.parseTimelineResponse(timeline);
  }

  /**
   * 设置当前用户 ID（外部设置，避免 API 调用）
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * 解析时间线响应
   */
  private parseTimelineResponse(timeline: {
    instructions: Array<{
      type: string;
      entries?: Array<{
        entryId: string;
        sortIndex?: string;
        content: {
          entryType?: string;
          itemContent?: {
            tweet_results?: {
              result: RawTweetResult;
            };
          };
          value?: string;
        };
      }>;
    }>;
  }): { tweets: Tweet[]; cursor?: string } {
    const tweets: Tweet[] = [];
    let bottomCursor: string | undefined;

    for (const instruction of timeline.instructions) {
      if (!instruction.entries) continue;

      for (const entry of instruction.entries) {
        // 获取游标
        if (entry.entryId.startsWith("cursor-bottom")) {
          bottomCursor = entry.content.value;
          continue;
        }
        if (entry.entryId.startsWith("cursor-top")) {
          continue;
        }

        // 跳过广告条目（entryId 包含 promoted）
        if (entry.entryId.includes("promoted") || entry.entryId.includes("Promoted")) {
          logger.info("Skipping promoted entry:", entry.entryId);
          continue;
        }

        // 解析推文
        if (entry.content.itemContent?.tweet_results?.result) {
          const tweet = this.parseTweet(entry.content.itemContent.tweet_results.result);
          if (tweet) {
            tweets.push(tweet);
          }
        }
      }
    }

    return {
      tweets,
      cursor: bottomCursor,
    };
  }

  /**
   * 解析单条推文
   */
  private parseTweet(result: RawTweetResult): Tweet | null {
    // 处理 TweetTombstone 类型（已删除/不可访问的推文）
    if (result.__typename === "TweetTombstone") {
      const tombstone = result.tombstone;
      const richText = tombstone?.text?.text || "This tweet is unavailable";
      // 尝试从 tombstone 中提取推文 ID（如果有的话）
      const tweetId = result.rest_id || `tombstone_${Date.now()}`;

      return {
        id: tweetId,
        text: `⚠️ ${richText}`,
        author_id: "unknown",
        created_at: new Date().toISOString(),
        author: {
          id: "unknown",
          name: "Unavailable",
          username: "unavailable",
          profile_image_url: undefined,
          verified: false,
        },
        public_metrics: {
          retweet_count: 0,
          reply_count: 0,
          like_count: 0,
          quote_count: 0,
        },
      };
    }

    // 处理不同类型的推文结果
    let tweetData = result;
    if (result.__typename === "TweetWithVisibilityResults") {
      tweetData = result.tweet as RawTweetResult;
    }

    // 跳过广告推文
    if (this.isPromotedTweet(result)) {
      logger.info("Skipping promoted tweet");
      return null;
    }

    // 检查是否有必要的数据
    if (!tweetData || !tweetData.legacy) {
      logger.warn("Tweet data or legacy is missing, skipping:", result.__typename);
      return null;
    }

    const legacy = tweetData.legacy;
    // 获取用户信息 - 支持多种可能的数据路径
    const userResult = tweetData.core?.user_results?.result;
    // Likes API 返回的用户信息在 userResult.core 而不是 userResult.legacy
    const userLegacy = userResult?.legacy;
    const userCore = (
      userResult as {
        core?: { name?: string; screen_name?: string; created_at?: string };
      }
    )?.core;

    const tweet: Tweet = {
      id: legacy.id_str,
      text: legacy.full_text || legacy.text || "",
      author_id: legacy.user_id_str,
      created_at: legacy.created_at,
      public_metrics: {
        retweet_count: legacy.retweet_count || 0,
        reply_count: legacy.reply_count || 0,
        like_count: legacy.favorite_count || 0,
        quote_count: legacy.quote_count || 0,
      },
      liked: legacy.favorited,
    };

    // 解析用户信息 - 优先使用 legacy，fallback 到 core
    if (userLegacy?.name || userCore?.name) {
      const userName = userLegacy?.name || userCore?.name || "Unknown";
      const userScreenName = userLegacy?.screen_name || userCore?.screen_name || "unknown";
      tweet.author = {
        id: userLegacy?.id_str || userResult?.rest_id || "unknown",
        name: userName,
        username: userScreenName,
        profile_image_url: userLegacy?.profile_image_url_https?.replace("_normal", "_400x400"),
        verified: userLegacy?.verified || userResult?.is_blue_verified,
        description: userLegacy?.description,
      };
    }

    // 解析媒体
    if (legacy.extended_entities?.media) {
      tweet.media = legacy.extended_entities.media.map(
        (m: RawMedia): MediaItem => ({
          media_key: m.id_str,
          type: m.type === "photo" ? "photo" : m.type === "animated_gif" ? "animated_gif" : "video",
          url: m.media_url_https,
          preview_image_url: m.media_url_https,
          width: m.original_info?.width,
          height: m.original_info?.height,
          variants: m.video_info?.variants?.map(
            (v: { bitrate?: number; content_type: string; url: string }) => ({
              bit_rate: v.bitrate,
              content_type: v.content_type,
              url: v.url,
            }),
          ),
          alt_text: m.ext_alt_text,
        }),
      );
    }

    // 解析引用的推文
    if (tweetData.quoted_status_result?.result) {
      const quotedTweet = this.parseTweet(tweetData.quoted_status_result.result);
      if (quotedTweet) {
        tweet.quoted_tweet = quotedTweet;
      }
    }

    // 记录回复的推文 ID
    if (legacy.in_reply_to_status_id_str) {
      tweet.in_reply_to_status_id = legacy.in_reply_to_status_id_str;
    }

    return tweet;
  }

  /**
   * 检测是否为广告推文
   */
  private isPromotedTweet(result: RawTweetResult): boolean {
    // 检查 promotedMetadata 字段（广告推文通常有这个）
    if ((result as any).promotedMetadata) {
      return true;
    }

    // 检查 card 类型是否为广告
    if ((result as any).card?.legacy?.name?.includes("promo")) {
      return true;
    }

    // 检查是否有广告相关的 typename
    if (result.__typename === "TweetPromotedMetadata") {
      return true;
    }

    // 检查 legacy 中的广告标记
    const legacy = result.legacy || (result.tweet as RawTweetResult)?.legacy;
    if (legacy) {
      // 检查 scopes 中的广告标记
      if ((legacy as any).scopes?.followers === false) {
        return true;
      }
    }

    return false;
  }
}

// Raw API 类型定义
interface RawTweetResult {
  __typename?: string;
  rest_id?: string;
  tweet?: RawTweetResult;
  tombstone?: {
    text?: {
      text?: string;
    };
  };
  core?: {
    user_results?: {
      result?: {
        rest_id: string;
        is_blue_verified?: boolean;
        legacy: {
          id_str: string;
          name: string;
          screen_name: string;
          profile_image_url_https: string;
          verified: boolean;
          description: string;
        };
      };
    };
  };
  quoted_status_result?: {
    result?: RawTweetResult;
  };
  legacy: {
    id_str: string;
    user_id_str: string;
    full_text?: string;
    text?: string;
    created_at: string;
    retweet_count: number;
    reply_count: number;
    favorite_count: number;
    quote_count: number;
    favorited?: boolean;
    in_reply_to_status_id_str?: string;
    extended_entities?: {
      media: RawMedia[];
    };
  };
}

interface RawMedia {
  id_str: string;
  type: string;
  media_url_https: string;
  original_info?: {
    width: number;
    height: number;
  };
  video_info?: {
    variants: Array<{
      bitrate?: number;
      content_type: string;
      url: string;
    }>;
  };
  ext_alt_text?: string;
}

// Timeline instruction 类型
interface TimelineInstruction {
  type: string;
  entries?: Array<{
    entryId: string;
    sortIndex?: string;
    content: {
      entryType?: string;
      itemContent?: {
        tweet_results?: {
          result: RawTweetResult;
        };
      };
      value?: string;
    };
  }>;
}

// Likes API 响应类型
interface LikesApiResponse {
  data?: {
    user?: {
      result?: {
        timeline?: {
          timeline?: {
            instructions: TimelineInstruction[];
          };
        };
      };
    };
  };
}

// 单例
export const xWebApi = new XWebApiService();
