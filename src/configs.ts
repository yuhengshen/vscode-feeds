import { defineConfigs } from "reactive-vscode";

export const {
  "twitter.ct0": ct0,
  "twitter.authToken": authToken,
  "twitter.twid": twid,
} = defineConfigs("vscode-feeds", {
  "twitter.ct0": String,
  "twitter.authToken": String,
  "twitter.twid": String,
});
