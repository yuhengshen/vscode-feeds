/**
 * Twitter API Types
 */

export interface TwitterUser {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
  verified?: boolean;
  description?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
}

export interface MediaItem {
  media_key: string;
  type: "photo" | "video" | "animated_gif";
  url?: string;
  preview_image_url?: string;
  width?: number;
  height?: number;
  variants?: MediaVariant[];
  alt_text?: string;
}

export interface MediaVariant {
  bit_rate?: number;
  content_type: string;
  url: string;
}

export interface TweetMetrics {
  retweet_count: number;
  reply_count: number;
  like_count: number;
  quote_count: number;
  bookmark_count?: number;
  impression_count?: number;
}

export interface Tweet {
  id: string;
  text: string;
  author_id: string;
  author?: TwitterUser;
  created_at: string;
  public_metrics?: TweetMetrics;
  attachments?: {
    media_keys?: string[];
  };
  media?: MediaItem[];
  referenced_tweets?: {
    type: "replied_to" | "quoted" | "retweeted";
    id: string;
  }[];
  conversation_id?: string;
  in_reply_to_user_id?: string;
  in_reply_to_status_id?: string; // 回复的推文 ID
  quoted_tweet?: Tweet; // 引用的推文

  // Local state
  liked?: boolean;
}

export interface TweetDetail extends Tweet {
  replies?: Tweet[];
  quoted_tweet?: Tweet;
  reply_to_tweet?: Tweet;
  repliesCursor?: string; // 用于加载更多回复
  hasMoreReplies?: boolean;
}

export interface TimelineResponse {
  tweets: Tweet[];
  nextToken?: string;
  hasMore: boolean;
}

export interface TwitterApiError {
  title: string;
  detail: string;
  type: string;
  status: number;
}

export interface AuthCredentials {
  bearerToken?: string;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  accessTokenSecret?: string;
  // OAuth 2.0 PKCE
  oauth2AccessToken?: string;
  oauth2RefreshToken?: string;
}

export type ViewType = "timeline" | "tweet-detail";
