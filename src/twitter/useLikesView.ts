import type { TreeViewNode } from "reactive-vscode";
import { computed, ref, shallowRef, useTreeView } from "reactive-vscode";
import { ThemeIcon, TreeItemCollapsibleState } from "vscode";
import type { Tweet } from "./types";
import { xWebApi } from "./webApi";
import { logger } from "../utils";
import { createTooltip, type TweetTreeViewNode } from "./useTimelineView";
import type { MediaItem } from "./types";

function createLikesTweetTreeItem(tweet: Tweet): TweetTreeViewNode {
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

  return {
    tweet,
    treeItem: {
      id: `likes-${tweet.id}`,
      label,
      description: text,
      tooltip: createTooltip(tweet),
      iconPath: hasVideo
        ? new ThemeIcon("play-circle")
        : hasMedia
          ? new ThemeIcon("file-media")
          : new ThemeIcon("heart-filled"),
      contextValue: "tweet-liked",
      collapsibleState: TreeItemCollapsibleState.None,
      command: {
        command: "vscode-feeds.viewTweet",
        title: "View Tweet",
        arguments: [tweet],
      },
    },
  };
}

function createAuthPromptNode(): TreeViewNode {
  return {
    treeItem: {
      id: "likes-auth-prompt",
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
      id: "likes-error",
      label: `Error: ${error}`,
      iconPath: new ThemeIcon("error"),
      collapsibleState: TreeItemCollapsibleState.None,
    },
  };
}

function createLoadingNode(): TreeViewNode {
  return {
    treeItem: {
      id: "likes-loading",
      label: "Loading...",
      iconPath: new ThemeIcon("loading~spin"),
      collapsibleState: TreeItemCollapsibleState.None,
    },
  };
}

function createEmptyNode(): TreeViewNode {
  return {
    treeItem: {
      id: "likes-empty",
      label: "No liked tweets yet",
      iconPath: new ThemeIcon("heart"),
      collapsibleState: TreeItemCollapsibleState.None,
    },
  };
}

export function useLikesProvider() {
  const tweets = shallowRef<Tweet[]>([]);
  const cursor = ref<string | undefined>(undefined);
  const loading = ref(false);
  const error = ref<string | undefined>(undefined);
  const isAuthenticated = ref(xWebApi.isAuthenticated());

  const checkAuth = () => {
    isAuthenticated.value = xWebApi.isAuthenticated();
  };

  async function fetchLikes(paginationCursor?: string): Promise<void> {
    if (loading.value) return;

    checkAuth();
    if (!isAuthenticated.value) return;

    loading.value = true;
    error.value = undefined;

    try {
      const response = await xWebApi.getLikes(20, paginationCursor);

      tweets.value = response.tweets;

      if (response.cursor) {
        cursor.value = response.cursor;
      }
    } catch (e) {
      logger.error("Failed to fetch likes:", e);
      error.value = e instanceof Error ? e.message : "Unknown error";
    } finally {
      loading.value = false;
    }
  }

  function refresh(): void {
    error.value = undefined;
    checkAuth();
    fetchLikes(cursor.value);
  }

  function updateTweet(tweet: Tweet): void {
    const index = tweets.value.findIndex((t) => t.id === tweet.id);
    if (index !== -1) {
      const newTweets = [...tweets.value];
      newTweets[index] = tweet;
      tweets.value = newTweets;
    }
  }

  // Remove tweet from likes when unliked
  function removeTweet(tweetId: string): void {
    tweets.value = tweets.value.filter((t) => t.id !== tweetId);
  }

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

    if (tweets.value.length === 0) {
      return [createEmptyNode()];
    }

    return tweets.value.map((tweet) => createLikesTweetTreeItem(tweet));
  });

  // Initial fetch
  if (xWebApi.isAuthenticated()) {
    fetchLikes();
  }

  return {
    treeData,
    tweets,
    cursor,
    loading,
    error,
    refresh,
    updateTweet,
    removeTweet,
    checkAuth,
  };
}

export function useTwitterLikesView() {
  const provider = useLikesProvider();

  const view = useTreeView("twitter-likes", provider.treeData, {
    showCollapseAll: false,
  });

  return {
    view,
    ...provider,
  };
}
