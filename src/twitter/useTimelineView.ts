import type { TreeViewNode } from "reactive-vscode";
import { computed, ref, shallowRef, useTreeView } from "reactive-vscode";
import { ThemeIcon, TreeItemCollapsibleState } from "vscode";
import type { MediaItem, Tweet, ViewType } from "./types";
import { xWebApi } from "./webApi";
import { logger } from "../utils";

export type TimelineType = "forYou" | "following";

// Extended TreeViewNode with tweet data for context menu commands
export interface TweetTreeViewNode extends TreeViewNode {
  tweet: Tweet;
}

function createTweetTreeItem(tweet: Tweet, viewType: ViewType): TweetTreeViewNode {
  const hasMedia = tweet.media && tweet.media.length > 0;
  const hasVideo = tweet.media?.some(
    (m: MediaItem) => m.type === "video" || m.type === "animated_gif",
  );

  const author = tweet.author?.name || tweet.author?.username || "Unknown";
  const mediaIndicator = hasMedia ? " 📷" : "";
  const label = `${author}${mediaIndicator}`;

  // Truncate text for tree view
  const maxLength = 60;
  let text = tweet.text.replace(/\n/g, " ").trim();
  if (text.length > maxLength) {
    text = `${text.substring(0, maxLength)}...`;
  }

  const liked = tweet.liked ? "liked" : "unliked";

  return {
    tweet, // Expose tweet for context menu commands
    treeItem: {
      id: `${viewType}-${tweet.id}`,
      label,
      description: text,
      tooltip: createTooltip(tweet),
      iconPath: hasVideo
        ? new ThemeIcon("play-circle")
        : hasMedia
          ? new ThemeIcon("file-media")
          : new ThemeIcon("comment"),
      contextValue: `tweet-${liked}`,
      collapsibleState: TreeItemCollapsibleState.None,
      command: {
        command: "vscode-feeds.viewTweet",
        title: "View Tweet",
        arguments: [tweet],
      },
    },
  };
}

export function createTooltip(tweet: Tweet): string {
  const author = tweet.author;
  const metrics = tweet.public_metrics;
  const date = new Date(tweet.created_at).toLocaleString();

  let tooltip = `@${author?.username || "unknown"}\n`;
  tooltip += `${tweet.text}\n\n`;
  tooltip += `📅 ${date}\n`;

  if (metrics) {
    tooltip += `❤️ ${metrics.like_count} | 🔁 ${metrics.retweet_count} | 💬 ${metrics.reply_count}`;
  }

  if (tweet.media && tweet.media.length > 0) {
    tooltip += `\n📎 ${tweet.media.length} media attachment(s)`;
  }

  return tooltip;
}

function createAuthPromptNode(): TreeViewNode {
  return {
    treeItem: {
      id: "auth-prompt",
      label: "Please authenticate with X (click to setup)",
      iconPath: new ThemeIcon("key"),
      collapsibleState: TreeItemCollapsibleState.None,
      command: {
        command: "vscode-feeds.authenticate",
        title: "Authenticate",
        arguments: [],
      },
    },
  };
}

function createErrorNode(error: string): TreeViewNode {
  return {
    treeItem: {
      id: "error",
      label: `Error: ${error}`,
      iconPath: new ThemeIcon("error"),
      collapsibleState: TreeItemCollapsibleState.None,
    },
  };
}

function createLoadingNode(): TreeViewNode {
  return {
    treeItem: {
      id: "loading",
      label: "Loading...",
      iconPath: new ThemeIcon("loading~spin"),
      collapsibleState: TreeItemCollapsibleState.None,
    },
  };
}

export function useTimelineProvider(viewType: ViewType) {
  const tweets = shallowRef<Tweet[]>([]);
  const cursor = ref<string | undefined>(undefined);
  const loading = ref(false);
  const error = ref<string | undefined>(undefined);
  const timelineType = ref<TimelineType>("forYou");
  const isAuthenticated = ref(xWebApi.isAuthenticated());
  // 记录上一次请求返回的推文ID，用于告诉API过滤重复内容
  const lastSeenTweetIds = ref<string[]>([]);

  // Check auth status periodically
  const checkAuth = () => {
    isAuthenticated.value = xWebApi.isAuthenticated();
  };

  async function fetchTweets(paginationCursor?: string): Promise<void> {
    if (loading.value) return;

    checkAuth();
    if (!isAuthenticated.value) return;

    loading.value = true;
    error.value = undefined;

    try {
      let response: { tweets: Tweet[]; cursor?: string };
      // 传递上一次请求返回的推文ID
      const seenIds = lastSeenTweetIds.value;

      if (timelineType.value === "following") {
        response = await xWebApi.getHomeLatestTimeline(20, paginationCursor, seenIds);
      } else {
        response = await xWebApi.getHomeTimeline(20, paginationCursor, seenIds);
      }

      tweets.value = response.tweets;

      // 记录本次返回的推文ID，供下次请求使用
      lastSeenTweetIds.value = response.tweets.map((t) => t.id);

      // 更新 cursor
      if (response.cursor) {
        cursor.value = response.cursor;
      }
    } catch (e) {
      logger.error(`Failed to fetch ${viewType}:`, e);
      error.value = e instanceof Error ? e.message : "Unknown error";
    } finally {
      loading.value = false;
    }
  }

  function refresh(): void {
    error.value = undefined;
    checkAuth();
    // 刷新时传递当前 cursor，但替换内容而不是拼接
    fetchTweets(cursor.value);
  }

  function setTimelineType(type: TimelineType): void {
    if (timelineType.value !== type) {
      timelineType.value = type;
      refresh();
    }
  }

  function getTimelineType(): TimelineType {
    return timelineType.value;
  }

  function updateTweet(tweet: Tweet): void {
    const index = tweets.value.findIndex((t) => t.id === tweet.id);
    if (index !== -1) {
      const newTweets = [...tweets.value];
      newTweets[index] = tweet;
      tweets.value = newTweets;
    }
  }

  // Computed tree data that reactively updates
  const treeData = computed<TreeViewNode[]>(() => {
    checkAuth();

    if (!isAuthenticated.value) {
      return [createAuthPromptNode()];
    }

    if (loading.value && tweets.value.length === 0) {
      return [createLoadingNode()];
    }

    if (error.value && tweets.value.length === 0) {
      return [createErrorNode(error.value)];
    }

    const nodes: TreeViewNode[] = tweets.value.map((tweet) => createTweetTreeItem(tweet, viewType));

    return nodes;
  });

  // Initial fetch
  if (xWebApi.isAuthenticated()) {
    fetchTweets();
  }

  return {
    treeData,
    tweets,
    cursor,
    loading,
    error,
    timelineType,
    refresh,
    setTimelineType,
    getTimelineType,
    updateTweet,
    checkAuth,
  };
}

export function useTwitterTimelineView() {
  const provider = useTimelineProvider("timeline");

  const view = useTreeView("twitter-timeline", provider.treeData, {
    showCollapseAll: false,
  });

  return {
    view,
    ...provider,
  };
}
